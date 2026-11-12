import { DISCIPLINE_LABELS, STAT_NAMES } from '../config';
import { addDays, dayOfMonth, daysInMonth, hhmm, logicalMinutes, monthStart, toMinutes } from '../dates';
import { foodViolations } from '../scoring';
import type { DayKey, DayRecord, Discipline, Severity } from '../types';
import type { RuleContext, RuleResult } from './types';

export const recordOn = (ctx: RuleContext, day: DayKey): DayRecord | undefined => ctx.days.find((r) => r.day === day);

export const foodOn = (ctx: RuleContext, day: DayKey) => ctx.entries.food.filter((e) => e.day === day);
export const workoutOn = (ctx: RuleContext, day: DayKey) => ctx.entries.workout.filter((e) => e.day === day);
export const learningOn = (ctx: RuleContext, day: DayKey) => ctx.entries.learning.filter((e) => e.day === day);
export const expensesOn = (ctx: RuleContext, day: DayKey) => ctx.entries.expense.filter((e) => e.day === day);

/** Days ending at ctx.today going back n days (inclusive), newest first. */
export const lastDays = (ctx: RuleContext, n: number): DayKey[] => Array.from({ length: n }, (_, i) => addDays(ctx.today, -i));

/** Consecutive misses (score 0) ending at ctx.today, from the records. */
export function consecutiveMisses(ctx: RuleContext, d: Discipline): number {
  let n = 0;
  for (let day = ctx.today; ; day = addDays(day, -1)) {
    const r = recordOn(ctx, day);
    if (!r || r.scores[d] !== 0) break;
    n++;
  }
  return n;
}

export function violationsOn(ctx: RuleContext, day: DayKey): number {
  return foodViolations(foodOn(ctx, day), ctx.settings.goals.food, ctx.settings.dayCloseHour).length;
}

export function hasEntryToday(ctx: RuleContext, d: Discipline): boolean {
  const day = ctx.today;
  switch (d) {
    case 'food':
      return foodOn(ctx, day).length > 0;
    case 'workout':
      return workoutOn(ctx, day).length > 0;
    case 'learning':
      return learningOn(ctx, day).length > 0;
    case 'finance':
      return expensesOn(ctx, day).length > 0 || !!recordOn(ctx, day)?.noSpendDay;
  }
}

export function afterEvening(ctx: RuleContext): boolean {
  return logicalMinutes(hhmm(ctx.now), ctx.settings.dayCloseHour) >= toMinutes(ctx.settings.reminderTimes.evening);
}

export function monthSpend(ctx: RuleContext, through: DayKey): number {
  const start = monthStart(through);
  return ctx.entries.expense.filter((e) => e.day >= start && e.day <= through).reduce((s, e) => s + e.amount, 0);
}

export function pace(ctx: RuleContext, day: DayKey): number {
  return (ctx.settings.monthlyBudget * dayOfMonth(day)) / daysInMonth(day);
}

export function result(ruleId: string, severity: Severity, vars: RuleResult['vars'] = {}, discipline?: Discipline): RuleResult {
  const base: RuleResult['vars'] = discipline
    ? { discipline: DISCIPLINE_LABELS[discipline].toLowerCase(), Discipline: DISCIPLINE_LABELS[discipline], stat: STAT_NAMES[discipline] }
    : {};
  return { ruleId, severity, discipline, vars: { ...base, ...vars } };
}

export const formatMoney = (amount: number, currency = 'LKR') => `${currency} ${Math.round(amount).toLocaleString('en-US')}`;

export function decayLost(ctx: RuleContext, d: Discipline, fromDay: DayKey): number {
  return Math.abs(ctx.xpEvents.filter((e) => e.discipline === d && e.reason === 'decay' && e.day >= fromDay && e.day <= ctx.today).reduce((s, e) => s + e.amount, 0));
}
