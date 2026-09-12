'use client';

import { useEffect, useState } from 'react';

interface Profile {
  xp: number;
  level: number;
  streakDays: number;
  achievementsJson: string[];
}

export function GamificationBar() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    fetch('/api/gamification')
      .then((r) => r.json())
      .then((d) => setProfile(d.profile))
      .catch(() => {});
  }, []);

  if (!profile) return null;

  const xpIntoLevel = profile.xp % 200;

  return (
    <div className="flex items-center gap-4 rounded-xl2 border border-ink-100 bg-white px-4 py-2.5 shadow-card">
      <div className="text-center">
        <div className="text-xs font-bold text-ink-400">المستوى</div>
        <div className="text-lg font-extrabold text-ink-900">{profile.level}</div>
      </div>
      <div className="w-28">
        <div className="mb-1 text-[11px] text-ink-400">{xpIntoLevel} / 200 XP</div>
        <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
          <div className="h-full rounded-full bg-accent-500" style={{ width: `${(xpIntoLevel / 200) * 100}%` }} />
        </div>
      </div>
      <div className="flex items-center gap-1 text-sm font-bold text-ink-700">
        <span>🔥</span>
        <span>{profile.streakDays}</span>
      </div>
    </div>
  );
}
