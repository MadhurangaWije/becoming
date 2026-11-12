import { config as defaultConfig, type Config } from './config';
import { addDays } from './dates';
import { scoreDay } from './scoring';
import { missesEndingOn, streakEndingOn } from './streaks';
import { computeDayXp, levelFromXp, overallLevel, type XpDraft } from './xp';
import type { DayEntries, DayKey, DayRecord, Discipline, Settings } from './types';
import { DISCIPLINES } from './types';

export interface CloseDayInput {
  day: DayKey;
  entries: DayEntries;
  noSpendDay: boolean;
  reflection?: string;
  history: DayRecord[]; // closed records strictly before `day`
  xpBefore: Record<Discipline, number>;
  freezes: number;
  settings: Pick<Settings, 'goals' | 'monthlyBudget' | 'dayCloseHour'>;
  monthSpendToDate: number;
  now: Date;
}

export interface LevelUp {
  discipline: Discipline | 'overall';
  level: number;
}

export interface CloseDayResult {
  record: DayRecord;
  xp: XpDraft[];
  freezes: number;
  freezesEarned: number;
  streakBefore: Record<Discipline, number>;
  streakAfter: Record<Discipline, number>;
  missesBefore: Record<Discipline, number>;
  xpAfter: Record<Discipline, number>;
  levelUps: LevelUp[];
}

const perDiscipline = <T>(fn: (d: Discipline) => T) => Object.fromEntries(DISCIPLINES.map((d) => [d, fn(d)])) as Record<Discipline, T>;

/** Section 5.6 step 2 for a single day: scores, freezes, streaks, XP (incl. decay). */
export function closeDay(input: CloseDayInput, cfg: Config = defaultConfig): CloseDayResult {
  const { day, history } = input;
  const yesterday = addDays(day, -1);
  const scores = scoreDay(input.entries, input.noSpendDay, input.settings, cfg);
  const streakBefore = perDiscipline((d) => streakEndingOn(history, d, yesterday));
  const missesBefore = perDiscipline((d) => missesEndingOn(history, d, yesterday));

  let freezes = input.freezes;
  const usedFreeze: Discipline[] = [];
  for (const d of DISCIPLINES) {
    if (scores[d] === 0 && streakBefore[d] > 0 && freezes > 0) {
      freezes--;
      usedFreeze.push(d);
    }
  }

  const streakAfter = perDiscipline((d) => (scores[d] >= 0.5 || usedFreeze.includes(d) ? streakBefore[d] + 1 : 0));

  let freezesEarned = 0;
  for (const d of DISCIPLINES) {
    if (scores[d] >= 0.5 && streakAfter[d] % cfg.freezes.earnEvery === 0 && freezes < cfg.freezes.max) {
      freezes++;
      freezesEarned++;
    }
  }

  const xp = computeDayXp(
    {
      day,
      scores,
      entries: input.entries,
      noSpendDay: input.noSpendDay,
      settings: input.settings,
      monthSpendToDate: input.monthSpendToDate,
      streakAfter,
      missesBefore,
      xpBefore: input.xpBefore,
    },
    cfg,
  );

  const xpAfter = perDiscipline((d) => input.xpBefore[d] + xp.filter((e) => e.discipline === d).reduce((s, e) => s + e.amount, 0));
  const levelsBefore = perDiscipline((d) => levelFromXp(input.xpBefore[d], cfg));
  const levelsAfter = perDiscipline((d) => levelFromXp(xpAfter[d], cfg));
  const levelUps: LevelUp[] = DISCIPLINES.filter((d) => levelsAfter[d] > levelsBefore[d]).map((d) => ({ discipline: d, level: levelsAfter[d] }));
  if (overallLevel(levelsAfter) > overallLevel(levelsBefore)) levelUps.push({ discipline: 'overall', level: overallLevel(levelsAfter) });

  const record: DayRecord = {
    day,
    scores,
    noSpendDay: input.noSpendDay && input.entries.expense.length === 0,
    closedAt: input.now.toISOString(),
    usedFreeze,
    reflection: input.reflection,
  };

  return { record, xp, freezes, freezesEarned, streakBefore, streakAfter, missesBefore, xpAfter, levelUps };
}

export const emptyEntries = (): DayEntries => ({ food: [], workout: [], learning: [], expense: [] });
