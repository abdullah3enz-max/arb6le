import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUser, AuthError } from '@/lib/auth';

const IMPORTANCE_THRESHOLD = 60;

/** Study Mode's "معلومات مهمة" tab — a calm, read-only feed of the user's highest-importance
 * concepts across every document, each with its approved memory bridge when one exists. Not a
 * graded/rated flow like Flashcards — just a fast reference to skim before an exam. */
export async function GET() {
  try {
    const user = await requireUser();
    const concepts = await db.concept.findMany({
      where: { importance: { gte: IMPORTANCE_THRESHOLD }, document: { userId: user.id, status: 'READY' } },
      include: {
        document: { select: { id: true, fileName: true } },
        connections: { where: { status: 'APPROVED' }, take: 1 }
      },
      orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
      take: 50
    });

    return NextResponse.json({
      concepts: concepts.map((c) => ({
        id: c.id,
        title: c.title,
        summary: c.summary,
        atomLabel: c.atomLabel,
        atomEmoji: c.atomEmoji,
        importance: c.importance,
        documentId: c.document.id,
        documentName: c.document.fileName,
        connection: c.connections[0]
          ? { atomEmoji: c.connections[0].atomEmoji, bridgeLine: c.connections[0].bridgeLine, worldRef: c.connections[0].worldRef }
          : null
      }))
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
    return NextResponse.json({ error: 'فشل جلب المعلومات المهمة.' }, { status: 500 });
  }
}
