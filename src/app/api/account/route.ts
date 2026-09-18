import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser, verifyPassword, AuthError } from '@/lib/auth';

const schema = z.object({
  name: z.string().min(1).max(80).optional(),
  email: z.string().email().optional(),
  // Only required when actually changing the email — changing your name needs no re-auth.
  currentPassword: z.string().optional()
});

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = schema.parse(await req.json());

    if (body.email && body.email !== user.email) {
      if (!body.currentPassword || !(await verifyPassword(body.currentPassword, user.passwordHash))) {
        return NextResponse.json({ error: 'كلمة المرور الحالية غير صحيحة.' }, { status: 401 });
      }
      const existing = await db.user.findUnique({ where: { email: body.email } });
      if (existing && existing.id !== user.id) {
        return NextResponse.json({ error: 'هذا البريد مستخدم من حساب ثاني.' }, { status: 409 });
      }
    }

    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.email ? { email: body.email } : {})
      },
      select: { id: true, name: true, email: true }
    });

    await db.auditLog.create({ data: { userId: user.id, action: 'account.updated', metaJson: { fields: Object.keys(body) } } });

    return NextResponse.json({ user: updated });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'بيانات غير صحيحة.' }, { status: 400 });
    return NextResponse.json({ error: 'فشل تحديث الحساب.' }, { status: 500 });
  }
}
