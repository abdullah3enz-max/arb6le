'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface SavedPreferences {
  shows: { title: string }[];
  movies: { title: string }[];
  anime: { title: string }[];
  games: { title: string }[];
  cars: string[];
  music: string[];
  people: string[];
  teams: string[];
  nationalTeams: string[];
  players: string[];
}

/** Item 17: "اهتماماتك [chips] ... تعديل اهتماماتي" — visible right on the dashboard, not
 *  buried inside settings. */
export function InterestsBar() {
  const [prefs, setPrefs] = useState<SavedPreferences | null>(null);

  useEffect(() => {
    fetch('/api/onboarding')
      .then((r) => (r.ok ? r.json() : null))
      .then(setPrefs)
      .catch(() => setPrefs(null));
  }, []);

  if (!prefs) return null;

  const chips = [
    ...prefs.shows.map((s) => s.title),
    ...prefs.movies.map((m) => m.title),
    ...prefs.anime.map((a) => a.title),
    ...prefs.games.map((g) => g.title),
    ...prefs.cars,
    ...prefs.music,
    ...prefs.people,
    ...prefs.teams,
    ...prefs.nationalTeams,
    ...prefs.players
  ];

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold text-ink-500">❤️ اهتماماتك:</span>
      {chips.slice(0, 8).map((name) => (
        <span key={name} className="rounded-full bg-ink-100 px-3 py-1 text-xs font-semibold text-ink-800">
          {name}
        </span>
      ))}
      {chips.length > 8 && <span className="text-xs text-ink-400">+{chips.length - 8}</span>}
      <Link href="/onboarding" className="text-xs font-bold text-accent-500 hover:underline">
        تعديل اهتماماتي
      </Link>
    </div>
  );
}
