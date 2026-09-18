import { NextRequest, NextResponse } from 'next/server';
import { requireUser, AuthError } from '@/lib/auth';
import { enforceRateLimit, RateLimitError } from '@/lib/security/rateLimit';

export interface SearchEntity {
  id: string;
  name: string;
  subtitle?: string;
  imageUrl?: string;
}

/**
 * Live anime search via Jikan (unofficial MyAnimeList API) — free, keyless, real posters.
 * Server-side proxy because it's called from the onboarding UI as-you-type; also keeps our
 * own rate limit in front of Jikan's (3 req/sec) so a fast typist can't trip it.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    enforceRateLimit(`search:anime:${user.id}`, 20, 10_000);

    const q = req.nextUrl.searchParams.get('q')?.trim();
    if (!q || q.length < 2) return NextResponse.json({ results: [] });

    const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=8&sfw=true`);
    if (!res.ok) return NextResponse.json({ results: [] });

    const data = await res.json();
    const results: SearchEntity[] = (data.data ?? []).map((a: { mal_id: number; title: string; year?: number; images?: { jpg?: { image_url?: string } } }) => ({
      id: String(a.mal_id),
      name: a.title,
      subtitle: a.year ? String(a.year) : undefined,
      imageUrl: a.images?.jpg?.image_url
    }));

    return NextResponse.json({ results });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
    if (error instanceof RateLimitError) return NextResponse.json({ error: error.message }, { status: 429 });
    return NextResponse.json({ results: [] });
  }
}
