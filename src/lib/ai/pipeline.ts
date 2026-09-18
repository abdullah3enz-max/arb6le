import { db } from '@/lib/db';
import { extractConcepts } from '@/lib/ai/agents/conceptExtractor';
import { mapConceptRelations } from '@/lib/ai/agents/knowledgeMapper';
import { retrieveUserMemoryProfile } from '@/lib/ai/agents/preferenceRetriever';
import { findConnectionCandidates } from '@/lib/ai/agents/connectionFinder';
import { factCheckCandidate } from '@/lib/ai/agents/factChecker';
import { critiqueConnection } from '@/lib/ai/agents/connectionCritic';
import { generateQuiz } from '@/lib/ai/agents/quizGenerator';
import { runQualityGate } from '@/lib/ai/qualityGate';

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
    for (const concept of savedConcepts) {
      await findAndSaveBestConnection(
        concept,
        extracted.find((c) => c.title === concept.title)!,
        profile,
        document.userId,
        cacheKeyPrefix
      );
    }

    await setStage(documentId, 'GENERATING');
    // Quiz generation is best-effort: the concepts and connections above are the core value
    // and already committed. A quiz-step failure (a model returning an unexpected shape, a
    // transient provider error) must not discard minutes of real, already-approved work — it
    // just means this document ends up with no quiz yet, which the UI already handles.
    try {
      const quizQuestions = await generateQuiz(extracted, { userId: document.userId, cacheKeyPrefix });
      if (quizQuestions.length > 0) {
        const quiz = await db.quiz.create({
          data: { userId: document.userId, documentId, title: `اختبار: ${document.fileName}` }
        });
        await db.quizQuestion.createMany({
          data: quizQuestions
            .map((q) => {
              const concept = savedConcepts.find((c) => c.title === q.conceptTitle);
              if (!concept) return null;
              return {
                quizId: quiz.id,
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
            .filter((x): x is NonNullable<typeof x> => x !== null)
        });
      }
    } catch (quizError) {
      console.error('Quiz generation failed (non-fatal):', documentId, quizError);
    }

    await setStage(documentId, 'READY');
  } catch (error) {
    await db.document.update({
      where: { id: documentId },
      data: { status: 'FAILED', errorMessage: error instanceof Error ? error.message : 'Unknown pipeline error' }
    });
    throw error;
  }
}

async function findAndSaveBestConnection(
  concept: { id: string; title: string },
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
    return; // one strong bridge per fact (item 14) — quality over quantity
  }
  // No candidate survived fact-check/critic/threshold: this concept explicitly gets no
  // connection. The UI must render this as "ما لقيت ربط قوي وصادق..." (item 9), not silence.
}

async function setStage(documentId: string, stage: PipelineStage) {
  await db.document.update({ where: { id: documentId }, data: { status: stage } });
}
