import { db } from '@/lib/db';
import { parseDocument } from '@/lib/ai/agents/documentParser';
import { extractConcepts } from '@/lib/ai/agents/conceptExtractor';
import { mapConceptRelations } from '@/lib/ai/agents/knowledgeMapper';
import { retrieveUserMemoryProfile } from '@/lib/ai/agents/preferenceRetriever';
import { findConnectionCandidates } from '@/lib/ai/agents/connectionFinder';
import { factCheckCandidate } from '@/lib/ai/agents/factChecker';
import { critiqueConnection } from '@/lib/ai/agents/connectionCritic';
import { generateMemoryHook } from '@/lib/ai/agents/memoryHookGenerator';
import { generateQuiz } from '@/lib/ai/agents/quizGenerator';
import { runQualityGate } from '@/lib/ai/qualityGate';
import type { DocumentType } from '@prisma/client';

export type PipelineStage =
  | 'EXTRACTING'
  | 'OCR'
  | 'PARSING'
  | 'MAPPING_CONCEPTS'
  | 'FINDING_CONNECTIONS'
  | 'FACT_CHECKING'
  | 'GENERATING'
  | 'READY'
  | 'FAILED';

/**
 * Orchestrates STEP 1–13 end to end for one document. Persists `Document.status` after each
 * stage so the UI's ProcessingSteps component reflects what is actually happening (item 38) —
 * never a canned animation disconnected from real progress.
 */
export async function runPipeline(documentId: string) {
  const document = await db.document.findUniqueOrThrow({ where: { id: documentId } });

  try {
    await setStage(documentId, 'EXTRACTING');
    const buffer = await readStoredFile(document.storageKey);
    const pages = await parseDocument(buffer, document.fileType as DocumentType as 'PDF' | 'PPT' | 'PPTX');

    if (pages.some((p) => p.usedOcr)) await setStage(documentId, 'OCR');

    await setStage(documentId, 'PARSING');
    await db.documentPage.createMany({
      data: pages.map((p) => ({
        documentId,
        pageNumber: p.pageNumber,
        rawText: p.rawText,
        usedOcr: p.usedOcr,
        tables: (p.tables ?? null) as object | undefined
      })),
      skipDuplicates: true
    });
    await db.document.update({ where: { id: documentId }, data: { pageCount: pages.length } });

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
              correctAnswer: q.correctAnswer,
              explanation: q.explanation
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)
      });
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
          type: candidate.type,
          worldCategory: candidate.worldCategory,
          worldRef: candidate.worldRef,
          headline: candidate.headline,
          relationExplain: candidate.relationExplain,
          memoryHook: candidate.memoryHook,
          claimType: candidate.claimType,
          score: gate.score,
          scoreBreakdown: candidate.scoreBreakdown as unknown as object,
          status: gate.status,
          rejectionReason: gate.rejectionReason
        }
      });
      continue; // try the next candidate instead of stopping at the first rejection
    }

    const polishedHook = await generateMemoryHook(candidate, extractedConcept, { userId });
    await db.connection.create({
      data: {
        conceptId: concept.id,
        type: candidate.type,
        worldCategory: candidate.worldCategory,
        worldRef: candidate.worldRef,
        headline: candidate.headline,
        relationExplain: candidate.relationExplain,
        memoryHook: polishedHook,
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
    return; // one strong connection per concept (item 14) — quality over quantity
  }
  // No candidate survived fact-check/critic/threshold: this concept explicitly gets no
  // connection. The UI must render this as "ما لقيت ربط قوي وصادق..." (item 9), not silence.
}

async function setStage(documentId: string, stage: PipelineStage) {
  await db.document.update({ where: { id: documentId }, data: { status: stage } });
}

async function readStoredFile(storageKey: string): Promise<Buffer> {
  const { getStorageDriver } = await import('@/lib/storage');
  return getStorageDriver().read(storageKey);
}
