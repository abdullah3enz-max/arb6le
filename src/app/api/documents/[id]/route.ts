import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUser, AuthError } from '@/lib/auth';

async function loadOwnedDocument(userId: string, documentId: string) {
  const document = await db.document.findUnique({ where: { id: documentId } });
  if (!document || document.userId !== userId) return null; // tenant isolation — never leak existence
  return document;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const document = await loadOwnedDocument(user.id, id);
    if (!document) return NextResponse.json({ error: 'الملف غير موجود.' }, { status: 404 });

    const concepts = await db.concept.findMany({
      where: { documentId: id },
      orderBy: { orderIndex: 'asc' },
      // Newest first: the page shows connections[0], so a successful 🔄 regeneration must win
      // over the connection it replaced.
      include: {
        connections: { where: { status: 'APPROVED' }, orderBy: { createdAt: 'desc' }, include: { sources: true } }
      }
    });

    const quizzes = await db.quiz.findMany({ where: { documentId: id }, include: { questions: true } });

    return NextResponse.json({ document, concepts, quizzes, canRebuild: user.role !== 'STUDENT' });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
    return NextResponse.json({ error: 'فشل جلب الملف.' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const document = await loadOwnedDocument(user.id, id);
    if (!document) return NextResponse.json({ error: 'الملف غير موجود.' }, { status: 404 });

    await db.document.delete({ where: { id } }); // cascades to pages/concepts/connections/quizzes
    await db.auditLog.create({ data: { userId: user.id, action: 'document.deleted', metaJson: { documentId: id } } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
    return NextResponse.json({ error: 'فشل حذف الملف.' }, { status: 500 });
  }
}
