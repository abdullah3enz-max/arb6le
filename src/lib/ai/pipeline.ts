import { db } from '@/lib/db';
import { extractConcepts } from '@/lib/ai/agents/conceptExtractor';
import { mapConceptRelations } from '@/lib/ai/agents/knowledgeMapper';
import { retrieveUserMemoryProfile } from '@/lib/ai/agents/preferenceRetriever';
import { loadInterestFacts, type InterestFactRow } from '@/lib/ai/agents/interestRetriever';
import { generateQuiz } from '@/lib/ai/agents/quizGenerator';
import { connectionRowData, findBridges, sourceRowData } from '@/lib/ai/bridgeEngine';
import { normalizeRef } from '@/lib/ai/bridgeScoring';
import { buildFlashcardBack } from '@/lib/study/flashcardText';
import type { ExtractedConcept, ScoredBridge, UserMemoryProfile } from '@/lib/ai/types';

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
    // relatedToJson (below) is display-only metadata — a "related concepts" hint, never load-
    // bearing for connections/flashcards/quizzes. A malformed model response here (a reasoning
    // model narrating its answer instead of returning JSON — observed in production) must not
    // fail the whole document over a feature this cosmetic.
    const relations = await mapConceptRelations(extracted, { userId: document.userId, cacheKeyPrefix }).catch((error) => {
      console.error('Concept relation mapping failed (non-fatal):', documentId, error);
      return [];
    });

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
    await connectAllConcepts(savedConcepts, extracted, document.userId);

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

type SavedConcept = { id: string; title: string; summary: string; atomLabel: string };

/**
 * One concept's connection search failing outright (a malformed/unparseable model response, a
 * transient provider error) must never take the whole document down with it — mapWithConcurrency
 * has no per-item isolation of its own, and the other concepts' connections/flashcards are real,
 * already-committed work that a single bad response has no business discarding. Falls back to
 * the same "no strong connection found" flashcard-only path a normal quality-gate rejection uses.
 */
async function findAndSaveBestConnection(
  concept: SavedConcept,
  extractedConcept: ExtractedConcept,
  ctx: ConnectContext
) {
  try {
    await searchAndSaveConnection(concept, extractedConcept, ctx);
  } catch (error) {
    console.error('Connection search failed for concept (non-fatal):', concept.id, error);
    await createFlashcard(concept, ctx.userId, null);
  }
}

/** One reference may carry at most this many shown associations per document — no monopolies. */
const MAX_APPROVALS_PER_REF = 2;
/** Passing runners-up kept per fact for "🔄 رابط آخر" — shown only on request, never by default. */
const MAX_ALTERNATIVES = 2;
/** Rejected candidates kept per concept for analysis (the debug trace has the full list). */
const STORED_REJECTIONS_PER_CONCEPT = 10;
/** Per association type already shown in this document; keeps one type from taking over. */
const TYPE_REPEAT_PENALTY = 0.02;
const MAX_TYPE_PENALTY = 0.06;

interface ConnectContext {
  profile: UserMemoryProfile;
  userId: string;
  interestFacts: InterestFactRow[];
  refUsage: Map<string, number>;
  typeUsage: Map<string, number>;
}

/**
 * Association diversity: among passing associations, a type already used often in this document
 * loses a little (max 0.06), and a reference at its cap is skipped. A clearly stronger
 * association still wins; near-ties go to variety (sound, anime, movie, number...).
 */
export function pickWithDiversity(
  accepted: ScoredBridge[],
  refUsage: Map<string, number>,
  typeUsage: Map<string, number>
): number {
  let best = -1;
  let bestScore = -Infinity;
  accepted.forEach((a, i) => {
    if ((refUsage.get(normalizeRef(a.candidate.worldRef)) ?? 0) >= MAX_APPROVALS_PER_REF) return;
    const penalty = Math.min(MAX_TYPE_PENALTY, TYPE_REPEAT_PENALTY * (typeUsage.get(a.candidate.connectionType) ?? 0));
    if (a.final - penalty > bestScore) {
      bestScore = a.final - penalty;
      best = i;
    }
  });
  return best;
}

async function searchAndSaveConnection(concept: SavedConcept, extractedConcept: ExtractedConcept, ctx: ConnectContext) {
  const overused = [...ctx.refUsage.entries()].filter(([, n]) => n >= MAX_APPROVALS_PER_REF).map(([ref]) => ref);
  const result = await findBridges(extractedConcept, ctx.profile, {
    userId: ctx.userId,
    excludeRefs: overused,
    interestFacts: ctx.interestFacts
  });
  const base = { factType: result.factType, memoryTarget: result.memoryTarget };

  if (result.rejected.length) {
    await db.connection.createMany({
      data: result.rejected.slice(0, STORED_REJECTIONS_PER_CONCEPT).map((r) =>
        connectionRowData(concept.id, concept.atomLabel, r.candidate, {
          ...base,
          status: r.quality === null ? 'REJECTED' : 'BELOW_THRESHOLD',
          rejected: r
        })
      )
    });
  }

  // Picked and reserved synchronously (no await in between): other concepts run in parallel.
  const index = pickWithDiversity(result.accepted, ctx.refUsage, ctx.typeUsage);
  if (index === -1) {
    // NO STRONG ASSOCIATION FOUND — no bridge, but the fact still becomes a flashcard.
    await createFlashcard(concept, ctx.userId, null);
    return;
  }
  const chosen = result.accepted[index]!;
  const refKey = normalizeRef(chosen.candidate.worldRef);
  ctx.refUsage.set(refKey, (ctx.refUsage.get(refKey) ?? 0) + 1);
  ctx.typeUsage.set(chosen.candidate.connectionType, (ctx.typeUsage.get(chosen.candidate.connectionType) ?? 0) + 1);

  const connection = await db.connection.create({
    data: {
      ...connectionRowData(concept.id, concept.atomLabel, chosen.candidate, { ...base, status: 'APPROVED', scored: chosen }),
      sources: { create: [sourceRowData(chosen.candidate)] }
    }
  });

  const alternatives = result.accepted.filter((_, i) => i !== index).slice(0, MAX_ALTERNATIVES);
  for (const alt of alternatives) {
    await db.connection.create({
      data: {
        ...connectionRowData(concept.id, concept.atomLabel, alt.candidate, { ...base, status: 'ALTERNATIVE', scored: alt }),
        sources: { create: [sourceRowData(alt.candidate)] }
      }
    });
  }

  await createFlashcard(concept, ctx.userId, { id: connection.id, atomEmoji: connection.atomEmoji, bridgeLine: connection.bridgeLine });
}

/** Runs the connection stage for every saved concept of a document (shared by first processing
 * and by rebuildConnections). */
async function connectAllConcepts(
  savedConcepts: (SavedConcept & { title: string })[],
  extracted: ExtractedConcept[],
  userId: string
) {
  const profile = await retrieveUserMemoryProfile(userId);
  // RETRIEVAL before generation: verified facts about the student's interests, fetched once and
  // shared, so interest associations rest on stored facts rather than the model's memory.
  const interestFacts = await loadInterestFacts(profile, userId);
  const ctx: ConnectContext = { profile, userId, interestFacts, refUsage: new Map(), typeUsage: new Map() };
  // Concurrency is capped, not unlimited: a real provider still has a requests-per-minute ceiling.
  const concurrency = Math.max(1, Number(process.env.PIPELINE_CONCEPT_CONCURRENCY ?? '4'));
  await mapWithConcurrency(savedConcepts, concurrency, (concept) =>
    findAndSaveBestConnection(concept, extracted.find((c) => c.title === concept.title)!, ctx)
  );
}

/**
 * Re-runs ONLY the connection stage on an already-processed document, from its saved concepts —
 * for comparing engines/models on the same real file without re-uploading it. Clears the old
 * connections and their flashcards first so nothing is duplicated; the quiz is left untouched.
 */
export async function rebuildConnections(documentId: string): Promise<void> {
  const document = await db.document.findUniqueOrThrow({ where: { id: documentId } });
  const concepts = await db.concept.findMany({ where: { documentId }, orderBy: { orderIndex: 'asc' } });
  if (concepts.length === 0) throw new Error('ما فيه مفاهيم مستخرجة لهذا الملف.');

  await setStage(documentId, 'FINDING_CONNECTIONS');
  try {
    const conceptIds = concepts.map((c) => c.id);
    await db.flashcard.deleteMany({ where: { conceptId: { in: conceptIds } } });
    await db.connection.deleteMany({ where: { conceptId: { in: conceptIds } } });

    const extracted: ExtractedConcept[] = concepts.map((c) => ({
      title: c.title,
      summary: c.summary,
      importance: c.importance,
      conceptType: c.conceptType,
      sourcePageNumbers: c.sourcePageIds.map(Number),
      atomLabel: c.atomLabel,
      atomEmoji: c.atomEmoji
    }));
    await connectAllConcepts(concepts, extracted, document.userId);
  } finally {
    await setStage(documentId, 'READY');
  }
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
