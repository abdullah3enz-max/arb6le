import { NextRequest, NextResponse } from 'next/server';
import { requireUser, AuthError } from '@/lib/auth';
import { enforceRateLimit, RateLimitError } from '@/lib/security/rateLimit';
import type { SearchEntity } from '../anime/route';

/**
 * Live music search via Deezer's public search API — free, keyless, real cover art.
 * Deezer blocks browser CORS on this endpoint, so it must be proxied server-side rather
 * than called directly from the onboarding UI.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    enforceRateLimit(`search:music:${user.id}`, 20, 10_000);

    const q = req.nextUrl.searchParams.get('q')?.trim();
    if (!q || q.length < 2) return NextResponse.json({ results: [] });

    const res = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(q)}&limit=8`);
    if (!res.ok) return NextResponse.json({ results: [] });

    const data = await res.json();
    const results: SearchEntity[] = (data.data ?? []).map((a: { id: number; name: string; picture_medium?: string; nb_fan?: number }) => ({
      id: String(a.id),
      name: a.name,
      subtitle: a.nb_fan ? `${a.nb_fan.toLocaleString('en-US')} fan` : undefined,
      imageUrl: a.picture_medium
    }));

    return NextResponse.json({ results });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
    if (error instanceof RateLimitError) return NextResponse.json({ error: error.message }, { status: 429 });
    return NextResponse.json({ results: [] });
  }
}
