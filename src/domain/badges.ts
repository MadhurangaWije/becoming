import { DISCIPLINE_LABELS } from './config';
import { isPerfect } from './scoring';
import { perfectStreakEndingOn, planChallenge, streakEndingOn } from './streaks';
import type { DayKey, DayRecord, Discipline } from './types';
import { DISCIPLINES } from './types';

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
}

const perDiscipline = (prefix: string, name: string, n: number): BadgeDef[] =>
  DISCIPLINES.map((d) => ({ id: `${prefix}-${d}`, name: `${name}: ${DISCIPLINE_LABELS[d]}`, description: `${n}-day ${DISCIPLINE_LABELS[d].toLowerCase()} streak` }));

export const BADGES: BadgeDef[] = [
  { id: 'first-step', name: 'First Step', description: 'First entry in any discipline' },
  { id: 'full-ring', name: 'Full Ring', description: 'First perfect day' },
  ...perDiscipline('week-strong', 'Week Strong', 7),
  ...perDiscipline('iron-month', 'Iron Month', 30),
  { id: 'perfect-week', name: 'Perfect Week', description: '7 perfect days in a row' },
  { id: 'century', name: 'Century', description: '100 workouts logged' },
  { id: 'scholar', name: 'Scholar', description: '100 learning entries' },
  { id: 'clean-plate', name: 'Clean Plate', description: '30 Full food days in total' },
  { id: 'tight-fist', name: 'Tight Fist', description: '10 no-spend days' },
  { id: 'comeback', name: 'Comeback', description: 'Full day after 3 or more consecutive misses' },
  { id: 'balanced', name: 'Balanced', description: 'All four stats at level 5 or higher' },
  { id: 'hundred-days', name: 'Hundred Days', description: '100 consecutive plan days' },
];

export const badgeById = (id: string) => BADGES.find((b) => b.id === id);

export interface BadgeInput {
  owned: Set<string>;
  day: DayKey; // the day just closed
  records: Pick<DayRecord, 'day' | 'scores' | 'usedFreeze' | 'noSpendDay'>[]; // all closed records including `day`
  counts: { anyEntries: number; workouts: number; learning: number };
  levels: Record<Discipline, number>;
  missesBefore: Record<Discipline, number>; // consecutive misses before `day`
}

/** Returns badge ids newly earned. */
export function evaluateBadges(input: BadgeInput): string[] {
  const { owned, day, records } = input;
  const earned: string[] = [];
  const check = (id: string, cond: boolean) => {
    if (cond && !owned.has(id)) earned.push(id);
  };
  const today = records.find((r) => r.day === day);

  check('first-step', input.counts.anyEntries > 0);
  check('full-ring', records.some((r) => isPerfect(r.scores)));
  for (const d of DISCIPLINES) {
    const streak = streakEndingOn(records, d, day);
    check(`week-strong-${d}`, streak >= 7);
    check(`iron-month-${d}`, streak >= 30);
  }
  check('perfect-week', perfectStreakEndingOn(records, day) >= 7);
  check('century', input.counts.workouts >= 100);
  check('scholar', input.counts.learning >= 100);
  check('clean-plate', records.filter((r) => r.scores.food === 1).length >= 30);
  check('tight-fist', records.filter((r) => r.noSpendDay).length >= 10);
  check('comeback', !!today && DISCIPLINES.some((d) => today.scores[d] === 1 && input.missesBefore[d] >= 3));
  check('balanced', DISCIPLINES.every((d) => input.levels[d] >= 5));
  const plan = planChallenge(records.filter((r) => r.day < day), day, today?.scores.food ?? 0);
  check('hundred-days', plan.run >= 100);
  return earned;
}

/** True when the plan run just crossed a multiple of 100 on `day`. */
export function planHundredReached(records: Pick<DayRecord, 'day' | 'scores'>[], day: DayKey): number | null {
  const today = records.find((r) => r.day === day);
  if (!today || today.scores.food !== 1) return null;
  const run = planChallenge(records.filter((r) => r.day < day), day, 1).run;
  return run > 0 && run % 100 === 0 ? run : null;
}

