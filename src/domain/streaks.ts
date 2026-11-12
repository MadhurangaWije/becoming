import { addDays } from './dates';
import { isPerfect } from './scoring';
import type { DayKey, DayRecord, Discipline, Score } from './types';
import { DISCIPLINES } from './types';

type RecordLike = Pick<DayRecord, 'day' | 'scores' | 'usedFreeze'>;

const qualifies = (r: RecordLike, d: Discipline) => r.scores[d] >= 0.5 || r.usedFreeze.includes(d);

function byDay(records: RecordLike[]): Map<DayKey, RecordLike> {
  return new Map(records.map((r) => [r.day, r]));
}

/** Current streak ending on `endDay` (inclusive): consecutive qualifying days, freezes included. */
export function streakEndingOn(records: RecordLike[], d: Discipline, endDay: DayKey): number {
  const map = byDay(records);
  let n = 0;
  for (let day = endDay; ; day = addDays(day, -1)) {
    const r = map.get(day);
    if (!r || !qualifies(r, d)) break;
    n++;
  }
  return n;
}

/** Consecutive actual misses (score 0) ending on `endDay`. Freezes do not hide misses. */
export function missesEndingOn(records: RecordLike[], d: Discipline, endDay: DayKey): number {
  const map = byDay(records);
  let n = 0;
  for (let day = endDay; ; day = addDays(day, -1)) {
    const r = map.get(day);
    if (!r || r.scores[d] !== 0) break;
    n++;
  }
  return n;
}

export function longestStreak(records: RecordLike[], d: Discipline): number {
  const sorted = [...records].sort((a, b) => a.day.localeCompare(b.day));
  let best = 0;
  let run = 0;
  let prev: DayKey | null = null;
  for (const r of sorted) {
    const contiguous = prev !== null && addDays(prev, 1) === r.day;
    if (!qualifies(r, d)) run = 0;
    else run = contiguous ? run + 1 : 1;
    best = Math.max(best, run);
    prev = r.day;
  }
  return best;
}

export function perfectStreakEndingOn(records: RecordLike[], endDay: DayKey): number {
  const map = byDay(records);
  let n = 0;
  for (let day = endDay; ; day = addDays(day, -1)) {
    const r = map.get(day);
    if (!r || !isPerfect(r.scores)) break;
    n++;
  }
  return n;
}

/**
 * Streak to show today: includes today if today already qualifies (provisional),
 * otherwise the streak as of yesterday, which is still alive.
 */
export function liveStreak(closed: RecordLike[], d: Discipline, today: DayKey, todayScore: Score): number {
  const prior = streakEndingOn(closed, d, addDays(today, -1));
  return todayScore >= 0.5 ? prior + 1 : prior;
}

export function allStreaks(records: RecordLike[], endDay: DayKey): Record<Discipline, number> {
  return Object.fromEntries(DISCIPLINES.map((d) => [d, streakEndingOn(records, d, endDay)])) as Record<Discipline, number>;
}

// ---- 100-day plan challenge (4.2): only actual Full food days count, no freezes ----

export interface PlanChallenge {
  run: number;
  best: number;
  total: number;
  target: number;
}

export function planChallenge(records: Pick<DayRecord, 'day' | 'scores'>[], today: DayKey, todayFoodScore: Score, step = 100): PlanChallenge {
  const full = new Set(records.filter((r) => r.scores.food === 1 && r.day < today).map((r) => r.day));
  if (todayFoodScore === 1) full.add(today);
  let run = 0;
  const start = todayFoodScore === 1 ? today : addDays(today, -1);
  for (let day = start; full.has(day); day = addDays(day, -1)) run++;
  const sorted = [...full].sort();
  let best = 0;
  let cur = 0;
  let prev: string | null = null;
  for (const day of sorted) {
    cur = prev && addDays(prev, 1) === day ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = day;
  }
  const target = (Math.floor(run / step) + 1) * step;
  return { run, best, total: full.size, target };
}
