import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { createSessionToken, hashPassword, setSessionCookie } from '@/lib/auth';
import { enforceRateLimit, RateLimitError } from '@/lib/security/rateLimit';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
  name: z.string().min(1).max(80)
});

export async function POST(req: NextRequest) {
  try {
    enforceRateLimit(`register:${req.headers.get('x-forwarded-for') ?? 'unknown'}`, 5, 60_000);

    const body = schema.parse(await req.json());
    const existing = await db.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return NextResponse.json({ error: 'هذا البريد مسجل مسبقًا.' }, { status: 409 });
    }

    const user = await db.user.create({
      data: {
        email: body.email,
        name: body.name,
        passwordHash: await hashPassword(body.password)
      }
    });

    await db.profile.create({ data: { userId: user.id } });
    await db.gamificationProfile.create({ data: { userId: user.id } });
    await db.auditLog.create({ data: { userId: user.id, action: 'user.registered' } });

    const token = await createSessionToken(user.id);
    await setSessionCookie(token);

    return NextResponse.json({ id: user.id, email: user.email, name: user.name });
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: error.message }, { status: 429 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors[0]?.message ?? 'بيانات غير صحيحة.' }, { status: 400 });
    return NextResponse.json({ error: 'فشل إنشاء الحساب.' }, { status: 500 });
  }
}
