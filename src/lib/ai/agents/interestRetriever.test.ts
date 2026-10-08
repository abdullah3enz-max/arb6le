import { describe, expect, it } from 'vitest';
import { interestsOf } from './interestRetriever';
import type { UserMemoryProfile } from '@/lib/ai/types';

const base: UserMemoryProfile = {
  preferredWorlds: [],
  favoriteTeams: [],
  favoritePlayers: [],
  favoriteShows: [],
  favoriteMovies: [],
  favoriteAnime: [],
  favoriteGames: [],
  favoriteCars: [],
  favoriteMusic: [],
  favoritePeople: [],
  connectionStyles: [],
  weights: {}
};

describe('interestsOf', () => {
  it('a student who ticked series/anime without naming titles still gets series and anime material', () => {
    const pool = interestsOf({ ...base, preferredWorlds: ['SERIES', 'ANIME', 'FOOTBALL'], favoritePlayers: ['Cristiano Ronaldo'] });
    expect(pool.filter((i) => i.world === 'SERIES').length).toBeGreaterThan(0);
    expect(pool.filter((i) => i.world === 'ANIME').length).toBeGreaterThan(0);
    // A named football player means no filler football titles.
    expect(pool.filter((i) => i.world === 'FOOTBALL').map((i) => i.name)).toEqual(['Cristiano Ronaldo']);
  });

  it('every student gets series and anime material, even with no worlds chosen', () => {
    const pool = interestsOf(base);
    expect(pool.filter((i) => i.world === 'SERIES')).toHaveLength(5);
    expect(pool.filter((i) => i.world === 'ANIME')).toHaveLength(5);
    expect(pool.filter((i) => i.world === 'GAMES')).toHaveLength(0); // other worlds only when chosen
  });

  it('named titles replace the defaults for their world', () => {
    const pool = interestsOf({ ...base, preferredWorlds: ['ANIME'], favoriteAnime: ['My Hero Academia'] });
    expect(pool.filter((i) => i.world === 'ANIME')).toEqual([{ name: 'My Hero Academia', world: 'ANIME' }]);
    expect(pool.filter((i) => i.world === 'SERIES')).toHaveLength(5);
  });
});
