import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser, verifyPassword, hashPassword, AuthError } from '@/lib/auth';

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل')
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = schema.parse(await req.json());

    const valid = await verifyPassword(body.currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'كلمة المرور الحالية غير صحيحة.' }, { status: 401 });
    }

    const passwordHash = await hashPassword(body.newPassword);
    await db.user.update({ where: { id: user.id }, data: { passwordHash } });
    await db.auditLog.create({ data: { userId: user.id, action: 'account.password_changed' } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message ?? 'بيانات غير صحيحة.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'فشل تغيير كلمة المرور.' }, { status: 500 });
  }
}
