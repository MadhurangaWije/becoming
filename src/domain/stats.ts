import { config as defaultConfig, type Config } from './config';
import { addDays } from './dates';
import { liveStreak, longestStreak, perfectStreakEndingOn } from './streaks';
import { levelFromXp, sumXp } from './xp';
import type { DayKey, DayRecord, Discipline, Score, StatState, XpEvent } from './types';
import { DISCIPLINES } from './types';

export interface StatView extends StatState {
  fading: boolean;
}

/** Current stat state per discipline from closed records and the XP ledger. */
export function statStates(
  closed: DayRecord[],
  xpEvents: Pick<XpEvent, 'day' | 'discipline' | 'amount' | 'reason'>[],
  today: DayKey,
  todayScores: Record<Discipline, Score>,
  cfg: Config = defaultConfig,
): Record<Discipline, StatView> {
  const totals = sumXp(xpEvents);
  const yesterday = addDays(today, -1);
  const fading = new Set(xpEvents.filter((e) => e.reason === 'decay' && e.day === yesterday).map((e) => e.discipline));
  return Object.fromEntries(
    DISCIPLINES.map((d) => {
      const streak = liveStreak(closed, d, today, todayScores[d]);
      return [
        d,
        {
          xp: totals[d],
          level: levelFromXp(totals[d], cfg),
          streak,
          longestStreak: Math.max(longestStreak(closed, d), streak),
          fading: fading.has(d),
        },
      ];
    }),
  ) as Record<Discipline, StatView>;
}

export function perfectStreak(closed: DayRecord[], today: DayKey, todayPerfect: boolean): number {
  const prior = perfectStreakEndingOn(closed, addDays(today, -1));
  return todayPerfect ? prior + 1 : prior;
}
