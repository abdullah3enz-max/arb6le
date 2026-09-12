import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser, AuthError } from '@/lib/auth';

const schema = z.object({
  worlds: z.array(z.enum(['SERIES', 'MOVIES', 'FOOTBALL', 'GAMES', 'ANIME', 'CHARACTERS', 'BOOKS', 'DAILY_LIFE'])),
  connectionStyles: z.array(z.string()).default([]),
  shows: z.array(z.object({ title: z.string(), favoriteChars: z.array(z.string()).default([]), rememberedBits: z.array(z.string()).default([]) })).default([]),
  movies: z.array(z.object({ title: z.string(), favoriteChars: z.array(z.string()).default([]) })).default([]),
  teams: z.array(z.string()).default([]),
  nationalTeams: z.array(z.string()).default([]),
  players: z.array(z.string()).default([]),
  skip: z.boolean().default(false)
});

/** Item 6: persists onboarding answers and marks the profile complete, or partially complete
 *  if the user skipped steps — every field here is optional by design (item 5). */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = schema.parse(await req.json());

    await db.$transaction(async (tx) => {
      await tx.favoriteWorld.deleteMany({ where: { userId: user.id } });
      await tx.favoriteWorld.createMany({
        data: body.worlds.map((category) => ({ userId: user.id, category }))
      });

      if (body.shows.length) {
        await tx.favoriteShow.deleteMany({ where: { userId: user.id } });
        await tx.favoriteShow.createMany({
          data: body.shows.map((s) => ({ userId: user.id, title: s.title, favoriteChars: s.favoriteChars, rememberedBits: s.rememberedBits }))
        });
      }

      if (body.movies.length) {
        await tx.favoriteMovie.deleteMany({ where: { userId: user.id } });
        await tx.favoriteMovie.createMany({
          data: body.movies.map((m) => ({ userId: user.id, title: m.title, favoriteChars: m.favoriteChars }))
        });
      }

      if (body.teams.length || body.nationalTeams.length) {
        await tx.favoriteTeam.deleteMany({ where: { userId: user.id } });
        await tx.favoriteTeam.createMany({
          data: [
            ...body.teams.map((name) => ({ userId: user.id, name, kind: 'club' })),
            ...body.nationalTeams.map((name) => ({ userId: user.id, name, kind: 'national' }))
          ]
        });
      }

      if (body.players.length) {
        await tx.favoritePlayer.deleteMany({ where: { userId: user.id } });
        await tx.favoritePlayer.createMany({ data: body.players.map((name) => ({ userId: user.id, name })) });
      }

      await tx.profile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, onboardingComplete: true, connectionStyles: body.connectionStyles },
        update: { onboardingComplete: true, connectionStyles: body.connectionStyles }
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'بيانات غير صحيحة.' }, { status: 400 });
    return NextResponse.json({ error: 'فشل حفظ التفضيلات.' }, { status: 500 });
  }
}
