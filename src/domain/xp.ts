import { config as defaultConfig, TITLES, type Config } from './config';
import { dayOfMonth, daysInMonth } from './dates';
import { isPerfect, summarizeFood, totalWorkoutMinutes } from './scoring';
import type { DayEntries, DayKey, Discipline, Score, Settings, XpReason } from './types';
import { DISCIPLINES } from './types';

// ---- Levels (5.3) ----

/** XP needed to go from level n to n + 1. */
export function xpForNextLevel(level: number, cfg: Config = defaultConfig): number {
  return cfg.levels.base + cfg.levels.step * (level - 1);
}

/** Total XP at which `level` starts. */
export function levelStartXp(level: number, cfg: Config = defaultConfig): number {
  let total = 0;
  for (let n = 1; n < level; n++) total += xpForNextLevel(n, cfg);
  return total;
}

export function levelFromXp(xp: number, cfg: Config = defaultConfig): number {
  let level = 1;
  let remaining = Math.max(0, xp);
  while (remaining >= xpForNextLevel(level, cfg)) {
    remaining -= xpForNextLevel(level, cfg);
    level++;
  }
  return level;
}

export interface LevelProgress {
  level: number;
  intoLevel: number; // XP earned inside current level
  needed: number; // XP to complete this level
  toNext: number;
  fraction: number;
}

export function levelProgress(xp: number, cfg: Config = defaultConfig): LevelProgress {
  const level = levelFromXp(xp, cfg);
  const start = levelStartXp(level, cfg);
  const needed = xpForNextLevel(level, cfg);
  const intoLevel = Math.max(0, xp - start);
  return { level, intoLevel, needed, toNext: needed - intoLevel, fraction: intoLevel / needed };
}

/** Overall level is the lowest of the four stat levels. */
export function overallLevel(levels: Record<Discipline, number>): number {
  return Math.min(...DISCIPLINES.map((d) => levels[d]));
}

export function titleFor(level: number): string {
  let t = TITLES[0].title;
  for (const row of TITLES) if (level >= row.level) t = row.title;
  return t;
}

/** 0..5 index of the current title tier. */
export function titleTier(level: number): number {
  let tier = 0;
  TITLES.forEach((row, i) => {
    if (level >= row.level) tier = i;
  });
  return tier;
}

// ---- Decay (5.4) ----

/** Decay for the k-th consecutive miss (k = 1 is free). */
export function decayForMiss(consecutiveMisses: number, cfg: Config = defaultConfig): number {
  if (consecutiveMisses <= 1) return 0;
  if (consecutiveMisses === 2) return cfg.decay.secondMiss;
  return cfg.decay.thirdPlusMiss;
}

/** Decay cannot push a stat below the start of its current level. */
export function clampDecay(currentXp: number, decay: number, cfg: Config = defaultConfig): number {
  const floor = levelStartXp(levelFromXp(currentXp, cfg), cfg);
  return Math.max(0, Math.min(decay, currentXp - floor));
}

// ---- Day XP (5.2) ----

export interface XpDraft {
  day: DayKey;
  discipline: Discipline;
  amount: number;
  reason: XpReason;
}

export interface DayXpInput {
  day: DayKey;
  scores: Record<Discipline, Score>;
  entries: DayEntries;
  noSpendDay: boolean;
  settings: Pick<Settings, 'goals' | 'monthlyBudget' | 'dayCloseHour'>;
  monthSpendToDate: number; // spend from the 1st of the month through `day`
  streakAfter: Record<Discipline, number>; // streak including this day
  missesBefore: Record<Discipline, number>; // consecutive actual misses immediately before this day
  xpBefore: Record<Discipline, number>;
}

/** Underspend check: month-to-date at or under the budget pace for this day of month. */
export function budgetPace(day: DayKey, monthlyBudget: number): number {
  return (monthlyBudget * dayOfMonth(day)) / daysInMonth(day);
}

export function computeDayXp(input: DayXpInput, cfg: Config = defaultConfig): XpDraft[] {
  const { day, scores, entries, settings } = input;
  const out: XpDraft[] = [];
  const add = (discipline: Discipline, amount: number, reason: XpReason) => {
    if (amount !== 0) out.push({ day, discipline, amount, reason });
  };

  for (const d of DISCIPLINES) {
    const s = scores[d];
    if (s === 1) add(d, cfg.xp.full, 'goal_met');
    else if (s === 0.5) add(d, cfg.xp.minimum, 'log');
  }

  // Workout beyond the minimum: +1 per 6 extra minutes, up to +10 at the cap
  if (scores.workout === 1) {
    const total = Math.min(totalWorkoutMinutes(entries.workout), settings.goals.workout.bonusCapMinutes);
    const extra = total - settings.goals.workout.minMinutes;
    add('workout', Math.min(cfg.xp.workoutBonusMax, Math.max(0, Math.floor(extra / cfg.xp.workoutBonusEveryMinutes))), 'bonus');
  }

  // All 3 meals on plan, vegetables in at least 1, no violations
  const food = summarizeFood(entries.food, settings.goals.food, settings.dayCloseHour);
  if (food.onPlanSlots.length === 3 && food.hasVeggies && food.violations.length === 0) add('food', cfg.xp.foodPlanBonus, 'bonus');

  // Extra learning entries
  const extraLearning = entries.learning.length - settings.goals.learning.minEntries;
  if (extraLearning > 0) add('learning', Math.min(cfg.xp.learningExtraMax, extraLearning * cfg.xp.learningExtraEach), 'bonus');

  // Finance bonuses
  if (input.noSpendDay && entries.expense.length === 0) add('finance', cfg.xp.noSpend, 'bonus');
  if (scores.finance > 0 && input.monthSpendToDate <= budgetPace(day, settings.monthlyBudget)) add('finance', cfg.xp.underPace, 'bonus');

  if (isPerfect(scores)) for (const d of DISCIPLINES) add(d, cfg.xp.perfectDay, 'perfect_day');

  for (const d of DISCIPLINES) {
    const streak = input.streakAfter[d];
    if (scores[d] >= 0.5 && streak > 0 && streak % cfg.xp.streakMilestoneEvery === 0) add(d, cfg.xp.streakMilestone, 'streak');
    if (scores[d] === 1 && input.missesBefore[d] >= cfg.xp.comebackMinMisses) add(d, cfg.xp.comeback, 'comeback');
  }

  // Decay, clamped to the floor of the current level after today's gains
  for (const d of DISCIPLINES) {
    if (scores[d] !== 0) continue;
    const decay = decayForMiss(input.missesBefore[d] + 1, cfg);
    if (!decay) continue;
    const gained = out.filter((e) => e.discipline === d).reduce((s, e) => s + e.amount, 0);
    const clamped = clampDecay(input.xpBefore[d] + gained, decay, cfg);
    if (clamped > 0) add(d, -clamped, 'decay');
  }
  return out;
}

export function sumXp(events: { discipline: Discipline; amount: number }[]): Record<Discipline, number> {
  const totals: Record<Discipline, number> = { food: 0, workout: 0, learning: 0, finance: 0 };
  for (const e of events) totals[e.discipline] += e.amount;
  return totals;
}
