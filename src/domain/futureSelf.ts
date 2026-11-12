import { diffDays } from './dates';
import { averageScore } from './scoring';
import type { DayKey, DayRecord, Discipline } from './types';
import { DISCIPLINES } from './types';

export type Mood = 'proud' | 'steady' | 'concerned' | 'disappointed';

/** Mood from the last 3 closed days' average score (6.6). */
export function moodFrom(records: Pick<DayRecord, 'day' | 'scores'>[]): Mood {
  const last = [...records].sort((a, b) => b.day.localeCompare(a.day)).slice(0, 3);
  if (!last.length) return 'steady';
  const avg = last.reduce((s, r) => s + averageScore(r.scores), 0) / last.length;
  if (avg >= 0.85) return 'proud';
  if (avg >= 0.6) return 'steady';
  if (avg >= 0.35) return 'concerned';
  return 'disappointed';
}

export interface Distance {
  daysLeft: number;
  strongDaysPct: number; // % of days so far with Full in at least 3 disciplines
  daysSoFar: number;
}

export function distance(records: Pick<DayRecord, 'scores'>[], today: DayKey, horizon: DayKey): Distance {
  const strong = records.filter((r) => DISCIPLINES.filter((d) => r.scores[d] === 1).length >= 3).length;
  return {
    daysLeft: Math.max(0, diffDays(today, horizon)),
    strongDaysPct: records.length ? Math.round((strong / records.length) * 100) : 0,
    daysSoFar: records.length,
  };
}

/** Disciplines whose stat decayed on `day`, used for the "fading" state and dimming figure parts. */
export function fadingOn(xpEvents: { day: DayKey; discipline: Discipline; reason: string }[], day: DayKey): Set<Discipline> {
  return new Set(xpEvents.filter((e) => e.day === day && e.reason === 'decay').map((e) => e.discipline));
}

export const horizonReached = (today: DayKey, horizon: DayKey) => today >= horizon;
