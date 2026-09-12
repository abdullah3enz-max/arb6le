import { db } from '@/lib/db';

const XP_PER_LEVEL = 200;

/** Item 24: XP/Streak/Level bookkeeping — deliberately simple, no dark-pattern loops. */
export async function addXp(userId: string, amount: number, achievement?: string) {
  const profile = await db.gamificationProfile.upsert({
    where: { userId },
    create: { userId, xp: 0 },
    update: {}
  });

  const today = new Date().toDateString();
  const lastActive = profile.lastActiveDate?.toDateString();
  const isConsecutiveDay = lastActive
    ? new Date(profile.lastActiveDate!).getTime() > Date.now() - 1000 * 60 * 60 * 48 && lastActive !== today
    : false;
  const streakDays = lastActive === today ? profile.streakDays : isConsecutiveDay ? profile.streakDays + 1 : 1;

  const newXp = profile.xp + amount;
  const achievements = new Set<string>(profile.achievementsJson as string[]);
  if (achievement) achievements.add(achievement);
  if (streakDays >= 7) achievements.add('streak_7');
  if (newXp >= 1000) achievements.add('xp_1000');

  await db.gamificationProfile.update({
    where: { userId },
    data: {
      xp: newXp,
      level: Math.floor(newXp / XP_PER_LEVEL) + 1,
      streakDays,
      lastActiveDate: new Date(),
      achievementsJson: Array.from(achievements)
    }
  });
}
