import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { createSessionToken, setSessionCookie, verifyPassword } from '@/lib/auth';
import { enforceRateLimit, RateLimitError } from '@/lib/security/rateLimit';

const schema = z.object({ email: z.string().email(), password: z.string() });

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    enforceRateLimit(`login:${ip}`, 10, 60_000);

    const body = schema.parse(await req.json());
    const user = await db.user.findUnique({ where: { email: body.email } });

    if (!user || user.status === 'DISABLED' || !(await verifyPassword(body.password, user.passwordHash))) {
      return NextResponse.json({ error: 'البريد أو كلمة المرور غير صحيحة.' }, { status: 401 });
    }

    const token = await createSessionToken(user.id);
    await setSessionCookie(token);
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    return NextResponse.json({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: error.message }, { status: 429 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'بيانات غير صحيحة.' }, { status: 400 });
    return NextResponse.json({ error: 'فشل تسجيل الدخول.' }, { status: 500 });
  }
}
