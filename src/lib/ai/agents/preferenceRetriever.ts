import { db } from '@/lib/db';
import type { UserMemoryProfile } from '@/lib/ai/types';

const DEFAULT_STYLES = ['stories', 'characters', 'events', 'cause_effect', 'comparisons', 'visual'];

/** Builds the "USER MEMORY PROFILE" (item 6) fresh from current DB state — never stale. */
export async function retrieveUserMemoryProfile(userId: string): Promise<UserMemoryProfile> {
  const [profile, worlds, teams, players, movies, shows, weights] = await Promise.all([
    db.profile.findUnique({ where: { userId } }),
    db.favoriteWorld.findMany({ where: { userId } }),
    db.favoriteTeam.findMany({ where: { userId } }),
    db.favoritePlayer.findMany({ where: { userId } }),
    db.favoriteMovie.findMany({ where: { userId } }),
    db.favoriteShow.findMany({ where: { userId } }),
    db.preference.findMany({ where: { userId } })
  ]);

  const memoryProfile: UserMemoryProfile = {
    preferredWorlds: worlds.map((w) => w.category),
    favoriteTeams: teams.map((t) => t.name),
    favoritePlayers: players.map((p) => p.name),
    favoriteShows: shows.map((s) => s.title),
    favoriteMovies: movies.map((m) => m.title),
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
