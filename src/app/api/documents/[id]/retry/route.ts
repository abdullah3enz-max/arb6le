import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUser, AuthError } from '@/lib/auth';
import { runPipeline } from '@/lib/ai/pipeline';

/**
 * Retries a FAILED document without re-uploading — the (userId, contentHash) unique
 * constraint would otherwise make a re-upload of the same file a silent no-op "duplicate".
 * Clears any partial concepts/connections/quiz from the failed attempt (cascades from
 * Concept) before re-running, so a step that failed partway through never leaves duplicates.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const document = await db.document.findUnique({ where: { id } });
    if (!document || document.userId !== user.id) {
      return NextResponse.json({ error: 'الملف غير موجود.' }, { status: 404 });
    }
    if (document.status !== 'FAILED') {
      return NextResponse.json({ error: 'الملف مو بحالة فشل — ما يحتاج إعادة محاولة.' }, { status: 400 });
    }

    await db.concept.deleteMany({ where: { documentId: id } });
    await db.quiz.deleteMany({ where: { documentId: id } });
    await db.document.update({ where: { id }, data: { status: 'UPLOADED', errorMessage: null } });

    runPipeline(id).catch((err) => console.error('Pipeline retry failed', id, err));

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
    return NextResponse.json({ error: 'فشلت إعادة المحاولة.' }, { status: 500 });
  }
}
