import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser, AuthError } from '@/lib/auth';
import { retrieveUserMemoryProfile } from '@/lib/ai/agents/preferenceRetriever';
import { recordRegeneration } from '@/lib/ai/agents/personalizationEngine';
import { loadInterestFacts } from '@/lib/ai/agents/interestRetriever';
import { connectionRowData, findBridges, sourceRowData } from '@/lib/ai/bridgeEngine';
import { CONNECTION_TYPES } from '@/lib/ai/agents/connectionFinder';
import { checkAndTrackUsage, EntitlementError } from '@/lib/billing/entitlements';
import type { BridgeConnectionType } from '@/lib/ai/types';

const schema = z.object({
  // "🔄 رابط آخر" asks for a different kind of association; "👎 ما فهمته" only needs a different one.
  differentCategory: z.boolean().default(false)
});

function typeOf(scoreBreakdown: unknown): BridgeConnectionType | undefined {
  const t = (scoreBreakdown as { connectionType?: string } | null)?.connectionType;
  return CONNECTION_TYPES.includes(t as BridgeConnectionType) ? (t as BridgeConnectionType) : undefined;
}

/**
 * One fact → one association shown. "Another one" first serves a runner-up that already passed
 * every gate when the fact was processed (instant, no model call); only when none is left does it
 * search again. Never returns an angle this fact has already shown or rejected.
 */
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
    await recordRegeneration(user.id, previous.worldCategory);

    const previousType = typeOf(previous.scoreBreakdown);
    // The one being replaced stops being shown; it stays in the table for analytics.
    const retire = db.connection.update({
      where: { id: previous.id },
      data: { status: 'REJECTED', rejectionReason: body.differentCategory ? 'user_asked_other' : 'user_didnt_get_it' }
    });

    const alternatives = await db.connection.findMany({
      where: { conceptId: previous.conceptId, status: 'ALTERNATIVE' },
      orderBy: { score: 'desc' }
    });
    const pick =
      (body.differentCategory && alternatives.find((a) => typeOf(a.scoreBreakdown) !== previousType)) || alternatives[0];
    if (pick) {
      const [, promoted] = await db.$transaction([
        retire,
        db.connection.update({
          where: { id: pick.id },
          data: { status: 'APPROVED', regenerationOf: previous.id },
          include: { sources: true }
        })
      ]);
      return NextResponse.json({ connection: promoted });
    }

    await checkAndTrackUsage(user.id, 'connections', 'maxConnectionsPerMonth');
    const priorAngles = await db.connection.findMany({ where: { conceptId: previous.conceptId }, select: { worldRef: true } });
    const excludeTypes: BridgeConnectionType[] = body.differentCategory && previousType ? [previousType] : [];

    const concept = previous.concept;
    const profile = await retrieveUserMemoryProfile(user.id);
    const interestFacts = await loadInterestFacts(profile, user.id);
    const result = await findBridges(
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
      { userId: user.id, excludeRefs: priorAngles.map((a) => a.worldRef), excludeTypes, interestFacts }
    );

    const [choice, ...rest] = result.accepted;
    if (!choice) {
      return NextResponse.json({
        connection: null,
        message: 'ما لقيت رابط قوي وواضح ثاني لهذي المعلومة — وما راح أخترع لك واحد.'
      });
    }

    const base = { factType: result.factType, memoryTarget: result.memoryTarget };
    await retire;
    const created = await db.connection.create({
      data: {
        ...connectionRowData(concept.id, concept.atomLabel, choice.candidate, {
          ...base,
          status: 'APPROVED',
          scored: choice,
          regenerationOf: previous.id
        }),
        sources: { create: [sourceRowData(choice.candidate)] }
      },
      include: { sources: true }
    });
    for (const alt of rest.slice(0, 2)) {
      await db.connection.create({
        data: {
          ...connectionRowData(concept.id, concept.atomLabel, alt.candidate, { ...base, status: 'ALTERNATIVE', scored: alt }),
          sources: { create: [sourceRowData(alt.candidate)] }
        }
      });
    }

    return NextResponse.json({ connection: created });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
    if (error instanceof EntitlementError) return NextResponse.json({ error: error.message }, { status: 402 });
    console.error(error);
    return NextResponse.json({ error: 'فشلت إعادة الربط.' }, { status: 500 });
  }
}
