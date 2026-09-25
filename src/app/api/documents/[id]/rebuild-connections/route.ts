import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AuthError } from '@/lib/auth';
import { requireStaff } from '@/lib/rbac';
import { rebuildConnections } from '@/lib/ai/pipeline';

/**
 * Staff-only (each run re-spends model calls on every concept): re-runs the connection engine on
 * one of your own already-processed documents, so engines and models can be compared on the
 * same real file without re-uploading it.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireStaff();
    const { id } = await params;

    const document = await db.document.findUnique({ where: { id } });
    if (!document || document.userId !== user.id) {
      return NextResponse.json({ error: 'الملف غير موجود.' }, { status: 404 });
    }
    if (document.status !== 'READY') {
      return NextResponse.json({ error: 'الملف لازم يكون جاهز قبل إعادة بناء الروابط.' }, { status: 400 });
    }

    rebuildConnections(id).catch((err) => console.error('Connection rebuild failed', id, err));
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'غير مسموح.' }, { status: 403 });
    return NextResponse.json({ error: 'فشلت إعادة بناء الروابط.' }, { status: 500 });
  }
}
