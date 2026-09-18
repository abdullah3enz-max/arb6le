import { db } from '@/lib/db';
import type { UserMemoryProfile } from '@/lib/ai/types';

const DEFAULT_STYLES = ['fast', 'smart', 'visual'];

/** Builds the "USER MEMORY PROFILE" (item 6) fresh from current DB state — never stale. */
export async function retrieveUserMemoryProfile(userId: string): Promise<UserMemoryProfile> {
  const [profile, worlds, teams, players, movies, shows, anime, games, cars, music, people, weights] = await Promise.all([
    db.profile.findUnique({ where: { userId } }),
    db.favoriteWorld.findMany({ where: { userId } }),
    db.favoriteTeam.findMany({ where: { userId } }),
    db.favoritePlayer.findMany({ where: { userId } }),
    db.favoriteMovie.findMany({ where: { userId } }),
    db.favoriteShow.findMany({ where: { userId } }),
    db.favoriteAnime.findMany({ where: { userId } }),
    db.favoriteGame.findMany({ where: { userId } }),
    db.favoriteCar.findMany({ where: { userId } }),
    db.favoriteMusic.findMany({ where: { userId } }),
    db.favoritePerson.findMany({ where: { userId } }),
    db.preference.findMany({ where: { userId } })
  ]);

  const memoryProfile: UserMemoryProfile = {
    preferredWorlds: worlds.map((w) => w.category),
    favoriteTeams: teams.map((t) => t.name),
    favoritePlayers: players.map((p) => p.name),
    favoriteShows: shows.map((s) => s.title),
    favoriteMovies: movies.map((m) => m.title),
    favoriteAnime: anime.map((a) => a.title),
    favoriteGames: games.map((g) => g.title),
    favoriteCars: cars.map((c) => c.name),
    favoriteMusic: music.map((m) => m.name),
    favoritePeople: people.map((p) => p.name),
    connectionStyles: profile?.connectionStyles?.length ? profile.connectionStyles : DEFAULT_STYLES,
    weights: Object.fromEntries(weights.map((w) => [w.key, w.weight]))
  };

  await db.profile.upsert({
    where: { userId },
    create: { userId, memoryProfileJson: memoryProfile as unknown as object, onboardingComplete: false },
    update: { memoryProfileJson: memoryProfile as unknown as object }
  });

  return memoryProfile;
}
