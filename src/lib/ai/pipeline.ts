import { db } from '@/lib/db';
import { extractConcepts } from '@/lib/ai/agents/conceptExtractor';
import { mapConceptRelations } from '@/lib/ai/agents/knowledgeMapper';
import { retrieveUserMemoryProfile } from '@/lib/ai/agents/preferenceRetriever';
import { findConnectionCandidates } from '@/lib/ai/agents/connectionFinder';
import { factCheckCandidate } from '@/lib/ai/agents/factChecker';
import { critiqueConnection } from '@/lib/ai/agents/connectionCritic';
import { generateQuiz } from '@/lib/ai/agents/quizGenerator';
import { runQualityGate } from '@/lib/ai/qualityGate';
import { buildFlashcardBack } from '@/lib/study/flashcardText';
import type { ExtractedConcept } from '@/lib/ai/types';

export type PipelineStage =
  | 'MAPPING_CONCEPTS'
  | 'FINDING_CONNECTIONS'
  | 'FACT_CHECKING'
  | 'GENERATING'
  | 'READY'
  | 'FAILED';

/**
 * Orchestrates concept extraction through quiz generation for one document. Text extraction
 * happens client-side before upload (src/lib/client/extractDocument.ts) and DocumentPage rows
 * already exist by the time this runs — so this starts straight at concept mapping. Persists
 * `Document.status` after each stage so the UI's ProcessingSteps component reflects what is
 * actually happening (item 38), never a canned animation disconnected from real progress.
 */
export async function runPipeline(documentId: string) {
  const document = await db.document.findUniqueOrThrow({ where: { id: documentId } });

  try {
    const pages = await db.documentPage.findMany({ where: { documentId }, orderBy: { pageNumber: 'asc' } });
    if (pages.length === 0) {
      throw new Error('لا يوجد نص مستخرج لهذا الملف — يُفترض أن يُستخرج النص في المتصفح قبل الرفع.');
    }

    await setStage(documentId, 'MAPPING_CONCEPTS');
    const cacheKeyPrefix = document.contentHash;
    const extracted = await extractConcepts(pages, { userId: document.userId, cacheKeyPrefix });
    const relations = await mapConceptRelations(extracted, { userId: document.userId, cacheKeyPrefix });

    const savedConcepts = await Promise.all(
      extracted.map((c, index) =>
        db.concept.create({
          data: {
            documentId,
            title: c.title,
            summary: c.summary,
            atomLabel: c.atomLabel,
            atomEmoji: c.atomEmoji,
            importance: c.importance,
            conceptType: c.conceptType,
            sourcePageIds: c.sourcePageNumbers.map(String),
            orderIndex: index,
            relatedToJson: relations.filter((r) => r.fromTitle === c.title) as unknown as object
          }
        })
      )
    );

    await setStage(documentId, 'FINDING_CONNECTIONS');
    const profile = await retrieveUserMemoryProfile(document.userId);

    await setStage(documentId, 'FACT_CHECKING');
    // Each concept's connection search is fully independent (its own LLM calls, its own
    // Connection/Flashcard rows, no shared cache key — see connectionFinder/connectionCritic,
    // which never pass a cacheKey at all) — so this no longer processes them one at a time.
    // Concurrency is capped, not unlimited: a real provider still has a requests-per-minute
    // ceiling, and firing 20+ concepts at once would just trade "slow" for "rate-limited".
    const concurrency = Math.max(1, Number(process.env.PIPELINE_CONCEPT_CONCURRENCY ?? '4'));
    await mapWithConcurrency(savedConcepts, concurrency, (concept) =>
      findAndSaveBestConnection(
        concept,
        extracted.find((c) => c.title === concept.title)!,
        profile,
        document.userId,
        cacheKeyPrefix
      )
    );

    await setStage(documentId, 'GENERATING');
    // Quiz generation is best-effort: the concepts and connections above are the core value
    // and already committed. A quiz-step failure (a model returning an unexpected shape, a
    // transient provider error) must not discard minutes of real, already-approved work — it
    // just means this document ends up with no quiz yet, which the UI already handles.
    await generateAndAttachQuiz(document, extracted, savedConcepts, cacheKeyPrefix);

    await setStage(documentId, 'READY');
  } catch (error) {
    await db.document.update({
      where: { id: documentId },
      data: { status: 'FAILED', errorMessage: error instanceof Error ? error.message : 'Unknown pipeline error' }
    });
    throw error;
  }
}

/**
 * Generates quiz questions for a document's already-extracted concepts and attaches them —
 * shared by runPipeline (first processing) and regenerateQuiz (repairing a document that ended
 * up with no quiz). Best-effort and non-throwing: a quiz-step failure must never take down
 * the caller's already-committed concepts/connections/flashcards.
 */
async function generateAndAttachQuiz(
  document: { id: string; userId: string; fileName: string },
  extracted: ExtractedConcept[],
  savedConcepts: { id: string; title: string }[],
  cacheKeyPrefix: string
): Promise<boolean> {
  try {
    const quizQuestions = await generateQuiz(extracted, { userId: document.userId, cacheKeyPrefix });
    // The model echoes back conceptTitle rather than an id, and routinely doesn't reproduce it
    // byte-for-byte (extra whitespace, different quotes, minor rewording) — an exact-string
    // match here silently dropped every question in a quiz whenever that happened, producing
    // a Quiz row with a title but zero questions (indistinguishable from a real bug to a
    // student). Match on a normalized title instead; this only affects which existing concept
    // a real, already-generated question attaches to, never invents content.
    const conceptByNormalizedTitle = new Map(savedConcepts.map((c) => [normalizeConceptTitle(c.title), c]));
    const matchedQuestions = quizQuestions
      .map((q) => {
        const concept = conceptByNormalizedTitle.get(normalizeConceptTitle(q.conceptTitle));
        if (!concept) {
          console.warn('Quiz question dropped — no matching concept for title:', document.id, q.conceptTitle);
          return null;
        }
        return {
          conceptId: concept.id,
          kind: q.kind,
          prompt: q.prompt,
          choicesJson: (q.choices ?? null) as object | undefined,
          // Defensive: some models return TRUE_FALSE answers as a JSON boolean despite the
          // prompt asking for a string — coerce rather than let a type-mismatch this far
          // into a multi-minute run discard everything already generated.
          correctAnswer: String(q.correctAnswer),
          explanation: q.explanation
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    // Only create the Quiz once at least one question actually attached to a real concept —
    // a Quiz with zero questions reads as broken, not as "nothing generated yet".
    if (matchedQuestions.length === 0) return false;

    const quiz = await db.quiz.create({
      data: { userId: document.userId, documentId: document.id, title: `اختبار: ${document.fileName}` }
    });
    await db.quizQuestion.createMany({
      data: matchedQuestions.map((q) => ({ ...q, quizId: quiz.id }))
    });
    return true;
  } catch (quizError) {
    console.error('Quiz generation failed (non-fatal):', document.id, quizError);
    return false;
  }
}

/**
 * Repairs a document that finished processing (concepts/flashcards intact) but ended up with
 * no quiz — most commonly one processed before generateAndAttachQuiz's normalized-title match,
 * where every question silently failed to attach. Re-runs only the quiz step, from the concepts
 * already saved in the database, rather than the whole pipeline.
 */
export async function regenerateQuiz(documentId: string): Promise<void> {
  const document = await db.document.findUniqueOrThrow({ where: { id: documentId } });
  if (document.status !== 'READY') {
    throw new Error('الملف لازم يكون بحالة "جاهز" قبل إعادة توليد الاختبار.');
  }

  const concepts = await db.concept.findMany({ where: { documentId }, orderBy: { orderIndex: 'asc' } });
  if (concepts.length === 0) {
    throw new Error('ما فيه مفاهيم مستخرجة لهذا الملف.');
  }

  const extracted: ExtractedConcept[] = concepts.map((c) => ({
    title: c.title,
    summary: c.summary,
    importance: c.importance,
    conceptType: c.conceptType,
    sourcePageNumbers: c.sourcePageIds.map(Number),
    atomLabel: c.atomLabel,
    atomEmoji: c.atomEmoji
  }));

  await db.quiz.deleteMany({ where: { documentId } });
  // A regen-scoped cache key, unlike runPipeline's plain contentHash, so this always calls the
  // model again instead of ever replaying a cached response from the run being repaired.
  const created = await generateAndAttachQuiz(document, extracted, concepts, `${document.contentHash}:regen:${Date.now()}`);
  if (!created) {
    throw new Error('ما قدرنا نولّد أسئلة اختبار من محتوى هذا الملف حاليًا — جرب مرة ثانية بعد شوي.');
  }
}

/**
 * One concept's connection search failing outright (a malformed/unparseable model response, a
 * transient provider error) must never take the whole document down with it — mapWithConcurrency
 * has no per-item isolation of its own, and the other concepts' connections/flashcards are real,
 * already-committed work that a single bad response has no business discarding. Falls back to
 * the same "no strong connection found" flashcard-only path a normal quality-gate rejection uses.
 */
async function findAndSaveBestConnection(
  concept: { id: string; title: string; summary: string; atomLabel: string },
  extractedConcept: Parameters<typeof findConnectionCandidates>[0],
  profile: Parameters<typeof findConnectionCandidates>[1],
  userId: string,
  cacheKeyPrefix: string
) {
  try {
    await searchAndSaveConnection(concept, extractedConcept, profile, userId, cacheKeyPrefix);
  } catch (error) {
    console.error('Connection search failed for concept (non-fatal):', concept.id, error);
    await createFlashcard(concept, userId, null);
  }
}

async function searchAndSaveConnection(
  concept: { id: string; title: string; summary: string; atomLabel: string },
  extractedConcept: Parameters<typeof findConnectionCandidates>[0],
  profile: Parameters<typeof findConnectionCandidates>[1],
  userId: string,
  cacheKeyPrefix: string
) {
  const candidates = await findConnectionCandidates(extractedConcept, profile, { userId, cacheKeyPrefix });

  for (const candidate of candidates.slice(0, 3)) {
    const factCheck = await factCheckCandidate(candidate);
    if (!factCheck.passed) continue;

    const critic = await critiqueConnection(candidate, extractedConcept, { userId });
    const gate = runQualityGate(candidate, critic);

    if (!gate.approved) {
      await db.connection.create({
        data: {
          conceptId: concept.id,
          associationLevel: candidate.associationLevel,
          worldCategory: candidate.worldCategory,
          worldRef: candidate.worldRef,
          atomEmoji: candidate.atomEmoji,
          atomLabel: candidate.atomLabel,
          bridgeLine: candidate.bridgeLine,
          whyOneLiner: candidate.whyOneLiner,
          claimType: candidate.claimType,
          score: gate.score,
          scoreBreakdown: candidate.scoreBreakdown as unknown as object,
          status: gate.status,
          rejectionReason: gate.rejectionReason
        }
      });
      continue; // try the next candidate instead of stopping at the first rejection
    }

    const connection = await db.connection.create({
      data: {
        conceptId: concept.id,
        associationLevel: candidate.associationLevel,
        worldCategory: candidate.worldCategory,
        worldRef: candidate.worldRef,
        atomEmoji: candidate.atomEmoji,
        atomLabel: candidate.atomLabel,
        bridgeLine: candidate.bridgeLine,
        whyOneLiner: candidate.whyOneLiner,
        claimType: candidate.claimType,
        score: gate.score,
        scoreBreakdown: candidate.scoreBreakdown as unknown as object,
        status: 'APPROVED',
        sources: {
          create: candidate.sources.map((s) => ({
            sourceType: s.sourceType,
            url: s.url,
            title: s.title,
            confidence: s.confidence,
            evidenceSnippet: s.evidenceSnippet
          }))
        }
      }
    });
    await createFlashcard(concept, userId, { id: connection.id, atomEmoji: connection.atomEmoji, bridgeLine: connection.bridgeLine });
    return; // one strong bridge per fact (item 14) — quality over quantity
  }
  // No candidate survived fact-check/critic/threshold: this concept explicitly gets no
  // connection (the UI renders this as "ما لقيت ربط قوي وصادق..."), but it still becomes a
  // flashcard — a student needs to memorize the fact itself even without a mnemonic bridge.
  await createFlashcard(concept, userId, null);
}

/** Every concept becomes a flashcard automatically the moment its processing finishes — Study
 * Mode's Flashcards tab must never require a manual "convert" step to have anything in it. */
async function createFlashcard(
  concept: { id: string; title: string; summary: string; atomLabel: string },
  userId: string,
  bridge: { id: string; atomEmoji: string; bridgeLine: string } | null
) {
  const flashcard = await db.flashcard.create({
    data: {
      userId,
      conceptId: concept.id,
      front: concept.title,
      back: buildFlashcardBack({ summary: concept.summary, atomLabel: concept.atomLabel, bridge }),
      connectionId: bridge?.id
    }
  });
  await db.reviewItem.create({ data: { userId, flashcardId: flashcard.id, dueAt: new Date() } });
}

async function setStage(documentId: string, stage: PipelineStage) {
  await db.document.update({ where: { id: documentId }, data: { status: stage } });
}

/**
 * Runs `fn` over `items` with at most `limit` in flight at once — a fixed-size worker pool
 * pulling from a shared cursor, rather than chunking into sequential batches of `limit` (which
 * would leave a worker idle for the rest of a batch just because one other item in it happened
 * to take longer). No new dependency: this is the entire feature p-limit/p-map provide here.
 * Exported only for pipeline.test.ts.
 */
export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await fn(items[current]!);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Collapses whitespace/case/punctuation differences so a model's echoed conceptTitle matches
 * the concept it actually meant, without requiring byte-identical strings (see call site).
 * Exported only for pipeline.test.ts. */
export function normalizeConceptTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,:;!?"'«»“”‘’،؛؟]/g, '');
}
