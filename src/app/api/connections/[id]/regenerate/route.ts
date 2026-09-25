import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser, AuthError } from '@/lib/auth';
import { retrieveUserMemoryProfile } from '@/lib/ai/agents/preferenceRetriever';
import { recordRegeneration } from '@/lib/ai/agents/personalizationEngine';
import { connectionRowData, findBridges, sourceRowData } from '@/lib/ai/bridgeEngine';
import { CONNECTION_TYPES } from '@/lib/ai/agents/connectionFinder';
import { checkAndTrackUsage, EntitlementError } from '@/lib/billing/entitlements';
import type { BridgeConnectionType } from '@/lib/ai/types';

const schema = z.object({
  // "🔄 اربطها بشيء آخر" — a different kind of bridge, not just a different reference;
  // "👎 ما فهمته" only needs a different reference.
  differentCategory: z.boolean().default(false)
});

/** Never returns an angle this concept has already shown or rejected. */
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
    const previousType = (previous.scoreBreakdown as { connectionType?: string } | null)?.connectionType;
    const excludeTypes: BridgeConnectionType[] =
      body.differentCategory && CONNECTION_TYPES.includes(previousType as BridgeConnectionType)
        ? [previousType as BridgeConnectionType]
        : [];

    const concept = previous.concept;
    const profile = await retrieveUserMemoryProfile(user.id);
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
      { userId: user.id, excludeRefs: priorAngles.map((a) => a.worldRef), excludeTypes }
    );

    const choice = result.accepted[0];
    if (!choice) {
      return NextResponse.json({
        connection: null,
        message: 'ما لقيت رابط قوي وصادق ثاني لهذا المفهوم، بس ما راح أخترع لك واحد.'
      });
    }

    const created = await db.connection.create({
      data: {
        ...connectionRowData(concept.id, concept.atomLabel, choice.candidate, {
          status: 'APPROVED',
          score: choice.score,
          memoryTarget: result.memoryTarget,
          scored: choice,
          regenerationOf: previous.id
        }),
        sources: { create: [sourceRowData(choice.candidate)] }
      },
      include: { sources: true }
    });

    return NextResponse.json({ connection: created });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
    if (error instanceof EntitlementError) return NextResponse.json({ error: error.message }, { status: 402 });
    console.error(error);
    return NextResponse.json({ error: 'فشلت إعادة الربط.' }, { status: 500 });
  }
}
