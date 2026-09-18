import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser, AuthError } from '@/lib/auth';
import { retrieveUserMemoryProfile } from '@/lib/ai/agents/preferenceRetriever';
import { findConnectionCandidates } from '@/lib/ai/agents/connectionFinder';
import { factCheckCandidate } from '@/lib/ai/agents/factChecker';
import { critiqueConnection } from '@/lib/ai/agents/connectionCritic';
import { runQualityGate } from '@/lib/ai/qualityGate';
import { recordRegeneration } from '@/lib/ai/agents/personalizationEngine';
import { checkAndTrackUsage, EntitlementError } from '@/lib/billing/entitlements';

const schema = z.object({
  // "🔄 اربطها بشيء آخر" (item 13) — force a different interest category than last time,
  // as opposed to "👎 ما فهمته" which just tries again within the same category.
  differentCategory: z.boolean().default(false)
});

/** Item 13/18: "ما فهمته" / "اربطها بشيء آخر" — never returns the same worldRef angle twice. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = schema.parse(await req.json().catch(() => ({})));

    const previous = await db.connection.findUnique({
      where: { id },
      include: { concept: { include: { document: true } } }
    });
    if (!previous || previous.concept.document.userId !== user.id) {
      return NextResponse.json({ error: 'الربط غير موجود.' }, { status: 404 });
    }

    await checkAndTrackUsage(user.id, 'connections', 'maxConnectionsPerMonth');
    await recordRegeneration(user.id, previous.worldCategory);

    const priorAngles = await db.connection.findMany({
      where: { conceptId: previous.conceptId },
      select: { worldRef: true }
    });

    const profile = await retrieveUserMemoryProfile(user.id);
    const concept = previous.concept;

    const candidates = await findConnectionCandidates(
      {
        title: concept.title,
        summary: concept.summary,
        atomLabel: concept.atomLabel,
        atomEmoji: concept.atomEmoji,
        importance: concept.importance,
        conceptType: concept.conceptType,
        sourcePageNumbers: concept.sourcePageIds.map(Number)
      },
      profile,
      { userId: user.id, cacheKeyPrefix: `regen:${id}:${Date.now()}`, excludeWorldRefs: priorAngles.map((a) => a.worldRef) }
    );

    const filtered = body.differentCategory ? candidates.filter((c) => c.worldCategory !== previous.worldCategory) : candidates;
    const pool = filtered.length > 0 ? filtered : candidates;

    for (const candidate of pool.slice(0, 3)) {
      const factCheck = await factCheckCandidate(candidate);
      if (!factCheck.passed) continue;

      const critic = await critiqueConnection(
        candidate,
        {
          title: concept.title,
          summary: concept.summary,
          atomLabel: concept.atomLabel,
          atomEmoji: concept.atomEmoji,
          importance: concept.importance,
          conceptType: concept.conceptType,
          sourcePageNumbers: []
        },
        { userId: user.id }
      );
      const gate = runQualityGate(candidate, critic);
      if (!gate.approved) continue;

      const created = await db.connection.create({
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
          regenerationOf: previous.id,
          sources: {
            create: candidate.sources.map((s) => ({
              sourceType: s.sourceType,
              url: s.url,
              title: s.title,
              confidence: s.confidence,
              evidenceSnippet: s.evidenceSnippet
            }))
          }
        },
        include: { sources: true }
      });

      return NextResponse.json({ connection: created });
    }

    return NextResponse.json({
      connection: null,
      message: 'ما لقيت رابط قوي وصادق ثاني لهذا المفهوم، بس ما راح أخترع لك واحد.'
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
    if (error instanceof EntitlementError) return NextResponse.json({ error: error.message }, { status: 402 });
    console.error(error);
    return NextResponse.json({ error: 'فشلت إعادة الربط.' }, { status: 500 });
  }
}
