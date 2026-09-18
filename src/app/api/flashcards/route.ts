import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser, AuthError } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const documentId = req.nextUrl.searchParams.get('documentId');
    const flashcards = await db.flashcard.findMany({
      where: { userId: user.id, ...(documentId ? { concept: { documentId } } : {}) },
      include: { concept: true }
    });
    return NextResponse.json({ flashcards });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
    return NextResponse.json({ error: 'فشل جلب البطاقات.' }, { status: 500 });
  }
}

const schema = z.object({ conceptId: z.string(), connectionId: z.string().optional() });

/** Item 21: "حولها إلى Flashcards" — front is the concept, back weaves in the approved
 *  connection's memory hook when one exists, so recall benefits from the same anchor. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = schema.parse(await req.json());

    const concept = await db.concept.findUnique({
      where: { id: body.conceptId },
      include: { document: true, connections: { where: { status: 'APPROVED' }, take: 1 } }
    });
    if (!concept || concept.document.userId !== user.id) {
      return NextResponse.json({ error: 'المفهوم غير موجود.' }, { status: 404 });
    }

    const connection = concept.connections[0];
    const back = connection ? `${concept.summary}\n\n${connection.atomEmoji} ${connection.bridgeLine}` : concept.summary;

    const flashcard = await db.flashcard.create({
      data: {
        userId: user.id,
        conceptId: concept.id,
        front: concept.title,
        back,
        connectionId: connection?.id
      }
    });

    return NextResponse.json({ flashcard });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'بيانات غير صحيحة.' }, { status: 400 });
    return NextResponse.json({ error: 'فشل إنشاء البطاقة.' }, { status: 500 });
  }
}
