import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser, AuthError } from '@/lib/auth';

const titleWithChars = z.object({ title: z.string(), favoriteChars: z.array(z.string()).default([]) });

const schema = z.object({
  worlds: z.array(
    z.enum(['SERIES', 'MOVIES', 'FOOTBALL', 'GAMES', 'ANIME', 'CARS', 'MUSIC', 'PEOPLE', 'CHARACTERS', 'BOOKS', 'DAILY_LIFE'])
  ),
  connectionStyles: z.array(z.string()).default([]),
  shows: z.array(z.object({ title: z.string(), favoriteChars: z.array(z.string()).default([]), rememberedBits: z.array(z.string()).default([]) })).default([]),
  movies: z.array(titleWithChars).default([]),
  anime: z.array(titleWithChars).default([]),
  games: z.array(titleWithChars).default([]),
  cars: z.array(z.string()).default([]),
  music: z.array(z.string()).default([]),
  people: z.array(z.string()).default([]),
  teams: z.array(z.string()).default([]),
  nationalTeams: z.array(z.string()).default([]),
  players: z.array(z.string()).default([]),
  skip: z.boolean().default(false)
});

/** GET: current preferences, so the onboarding wizard can be revisited later to edit — not
 *  just a one-time signup step. */
export async function GET() {
  try {
    const user = await requireUser();

    const [profile, worlds, shows, movies, anime, games, cars, music, people, teams, players] = await Promise.all([
      db.profile.findUnique({ where: { userId: user.id } }),
      db.favoriteWorld.findMany({ where: { userId: user.id } }),
      db.favoriteShow.findMany({ where: { userId: user.id } }),
      db.favoriteMovie.findMany({ where: { userId: user.id } }),
      db.favoriteAnime.findMany({ where: { userId: user.id } }),
      db.favoriteGame.findMany({ where: { userId: user.id } }),
      db.favoriteCar.findMany({ where: { userId: user.id } }),
      db.favoriteMusic.findMany({ where: { userId: user.id } }),
      db.favoritePerson.findMany({ where: { userId: user.id } }),
      db.favoriteTeam.findMany({ where: { userId: user.id } }),
      db.favoritePlayer.findMany({ where: { userId: user.id } })
    ]);

    return NextResponse.json({
      worlds: worlds.map((w) => w.category),
      connectionStyles: profile?.connectionStyles ?? [],
      shows: shows.map((s) => ({ title: s.title, favoriteChars: s.favoriteChars, rememberedBits: s.rememberedBits })),
      movies: movies.map((m) => ({ title: m.title, favoriteChars: m.favoriteChars })),
      anime: anime.map((a) => ({ title: a.title, favoriteChars: a.favoriteChars })),
      games: games.map((g) => ({ title: g.title, favoriteChars: g.favoriteChars })),
      cars: cars.map((c) => c.name),
      music: music.map((m) => m.name),
      people: people.map((p) => p.name),
      teams: teams.filter((t) => t.kind === 'club').map((t) => t.name),
      nationalTeams: teams.filter((t) => t.kind === 'national').map((t) => t.name),
      players: players.map((p) => p.name)
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
    return NextResponse.json({ error: 'فشل جلب التفضيلات.' }, { status: 500 });
  }
}

/** Item 6: persists onboarding answers and marks the profile complete, or partially complete
 *  if the user skipped steps — every field here is optional by design (item 5). Also the
 *  save path when a user revisits /onboarding later to edit their preferences. */
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

      if (body.anime.length) {
        await tx.favoriteAnime.deleteMany({ where: { userId: user.id } });
        await tx.favoriteAnime.createMany({
          data: body.anime.map((a) => ({ userId: user.id, title: a.title, favoriteChars: a.favoriteChars }))
        });
      }

      if (body.games.length) {
        await tx.favoriteGame.deleteMany({ where: { userId: user.id } });
        await tx.favoriteGame.createMany({
          data: body.games.map((g) => ({ userId: user.id, title: g.title, favoriteChars: g.favoriteChars }))
        });
      }

      if (body.cars.length) {
        await tx.favoriteCar.deleteMany({ where: { userId: user.id } });
        await tx.favoriteCar.createMany({ data: body.cars.map((name) => ({ userId: user.id, name })) });
      }

      if (body.music.length) {
        await tx.favoriteMusic.deleteMany({ where: { userId: user.id } });
        await tx.favoriteMusic.createMany({ data: body.music.map((name) => ({ userId: user.id, name })) });
      }

      if (body.people.length) {
        await tx.favoritePerson.deleteMany({ where: { userId: user.id } });
        await tx.favoritePerson.createMany({ data: body.people.map((name) => ({ userId: user.id, name })) });
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
