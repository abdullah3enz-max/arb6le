import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUser, AuthError } from '@/lib/auth';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const quiz = await db.quiz.findUnique({ where: { id }, include: { questions: true } });
    if (!quiz || quiz.userId !== user.id) return NextResponse.json({ error: 'الاختبار غير موجود.' }, { status: 404 });
    return NextResponse.json({ quiz });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
    return NextResponse.json({ error: 'فشل جلب الاختبار.' }, { status: 500 });
  }
}
