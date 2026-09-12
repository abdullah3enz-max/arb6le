import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUser, AuthError } from '@/lib/auth';

export async function GET() {
  try {
    const user = await requireUser();
    const profile = await db.gamificationProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {}
    });
    return NextResponse.json({ profile });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
    return NextResponse.json({ error: 'فشل جلب البيانات.' }, { status: 500 });
  }
}
