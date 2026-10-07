import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser, AuthError } from '@/lib/auth';
import { applyFeedbackToPreferences } from '@/lib/ai/agents/personalizationEngine';
import { addXp } from '@/lib/gamification';

const schema = z.object({
  reaction: z.enum(['LOVE', 'LIKE', 'NEUTRAL', 'DISLIKE', 'INCORRECT']),
  note: z.string().max(1000).optional(),
  /** 👎 why — an internal reject code, defaulting from the reaction when the UI doesn't ask. */
  reason: z.enum(['weak_relation', 'too_long', 'confusing', 'obscure_reference', 'forced_interest', 'inaccurate']).optional()
});

const DEFAULT_REASON: Partial<Record<string, string>> = { DISLIKE: 'confusing', INCORRECT: 'inaccurate' };

/** Item 29: on INCORRECT, this is exactly the audit record the spec asks to keep — connectionId,
 *  concept, generated_claim, source, user_feedback — nothing is silently discarded. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = schema.parse(await req.json());

    const connection = await db.connection.findUnique({
      where: { id },
      include: { concept: { include: { document: true } } }
    });
    if (!connection || connection.concept.document.userId !== user.id) {
      return NextResponse.json({ error: 'الربط غير موجود.' }, { status: 404 });
    }

    // The feedback-loop record: what kind of fact, what kind of association, which interest world,
    // the association itself and its score — plus why, when the student rejected it.
    const breakdown = (connection.scoreBreakdown ?? {}) as { factType?: string; connectionType?: string };
    const snapshot = {
      fact_type: breakdown.factType ?? null,
      association_type: breakdown.connectionType ?? null,
      interest_category: connection.worldCategory,
      association: connection.bridgeLine,
      score: connection.score,
      reason: body.reason ?? DEFAULT_REASON[body.reaction] ?? null
    };
    await db.connectionFeedback.create({
      data: {
        userId: user.id,
        connectionId: id,
        reaction: body.reaction,
        generatedClaim: connection.bridgeLine,
        note: body.note ? `${JSON.stringify(snapshot)}\n${body.note}` : JSON.stringify(snapshot)
      }
    });

    await applyFeedbackToPreferences({
      userId: user.id,
      reaction: body.reaction,
      worldCategory: connection.worldCategory,
      associationLevel: connection.associationLevel,
      associationType: breakdown.connectionType,
      factType: breakdown.factType
    });

    if (body.reaction === 'LOVE' || body.reaction === 'LIKE') {
      await addXp(user.id, body.reaction === 'LOVE' ? 15 : 8, `world_${connection.worldCategory.toLowerCase()}`);
    }

    if (body.reaction === 'INCORRECT') {
      await db.auditLog.create({
        data: {
          userId: user.id,
          action: 'connection.flagged_incorrect',
          metaJson: { connectionId: id, concept: connection.conceptId, claim: connection.bridgeLine }
        }
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'بيانات غير صحيحة.' }, { status: 400 });
    return NextResponse.json({ error: 'فشل حفظ التقييم.' }, { status: 500 });
  }
}
