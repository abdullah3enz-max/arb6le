import { NextRequest, NextResponse } from 'next/server';
import { requireUser, AuthError } from '@/lib/auth';
import { enforceRateLimit, RateLimitError } from '@/lib/security/rateLimit';
import type { SearchEntity } from '../anime/route';

/**
 * Live search for "any public figure" (item 2) via Wikipedia's public API — free, keyless,
 * real thumbnails. Two calls: full-text search for candidates, then pageimages for thumbnails.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    enforceRateLimit(`search:people:${user.id}`, 20, 10_000);

    const q = req.nextUrl.searchParams.get('q')?.trim();
    if (!q || q.length < 2) return NextResponse.json({ results: [] });

    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=8&format=json&origin=*`
    );
    if (!searchRes.ok) return NextResponse.json({ results: [] });
    const searchData = await searchRes.json();
    const pageIds: number[] = (searchData.query?.search ?? []).map((s: { pageid: number }) => s.pageid);
    if (pageIds.length === 0) return NextResponse.json({ results: [] });

    const imagesRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&pageids=${pageIds.join('|')}&prop=pageimages|description&piprop=thumbnail&pithumbsize=100&format=json&origin=*`
    );
    const imagesData = imagesRes.ok ? await imagesRes.json() : { query: { pages: {} } };
    const pages = imagesData.query?.pages ?? {};

    const results: SearchEntity[] = (searchData.query?.search ?? []).map((s: { pageid: number; title: string }) => {
      const page = pages[String(s.pageid)];
      return {
        id: String(s.pageid),
        name: s.title,
        subtitle: page?.description,
        imageUrl: page?.thumbnail?.source
      };
    });

    return NextResponse.json({ results });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
    if (error instanceof RateLimitError) return NextResponse.json({ error: error.message }, { status: 429 });
    return NextResponse.json({ results: [] });
  }
}
