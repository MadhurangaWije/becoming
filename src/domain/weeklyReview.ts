import { DISCIPLINE_LABELS, STAT_NAMES } from './config';
import { addDays, dayOfMonth, daysInMonth, monthStart, parseDay } from './dates';
import { averageScore } from './scoring';
import type { DayKey, DayRecord, Discipline, ExpenseEntry, XpEvent } from './types';
import { DISCIPLINES } from './types';

export interface WeeklyReviewData {
  weekStart: DayKey;
  weekEnd: DayKey;
  daysTracked: number;
  fullDays: Record<Discipline, number>;
  xpEarned: Record<Discipline, number>;
  xpLost: Record<Discipline, number>;
  bestDay: { day: DayKey; avg: number } | null;
  weakest: Discipline | null;
  monthSpend: number;
  monthPace: number;
  weekSpend: number;
}

export function buildWeeklyReview(
  weekStart: DayKey,
  records: Pick<DayRecord, 'day' | 'scores'>[],
  xpEvents: Pick<XpEvent, 'day' | 'discipline' | 'amount'>[],
  expenses: Pick<ExpenseEntry, 'day' | 'amount'>[],
  monthlyBudget: number,
): WeeklyReviewData {
  const weekEnd = addDays(weekStart, 6);
  const inWeek = <T extends { day: DayKey }>(x: T) => x.day >= weekStart && x.day <= weekEnd;
  const recs = records.filter(inWeek);
  const evs = xpEvents.filter(inWeek);
  const per = <T>(fn: (d: Discipline) => T) => Object.fromEntries(DISCIPLINES.map((d) => [d, fn(d)])) as Record<Discipline, T>;

  const fullDays = per((d) => recs.filter((r) => r.scores[d] === 1).length);
  const xpEarned = per((d) => evs.filter((e) => e.discipline === d && e.amount > 0).reduce((s, e) => s + e.amount, 0));
  const xpLost = per((d) => Math.abs(evs.filter((e) => e.discipline === d && e.amount < 0).reduce((s, e) => s + e.amount, 0)));

  let bestDay: WeeklyReviewData['bestDay'] = null;
  for (const r of recs) {
    const avg = averageScore(r.scores);
    if (!bestDay || avg > bestDay.avg || (avg === bestDay.avg && r.day > bestDay.day)) bestDay = { day: r.day, avg };
  }

  let weakest: Discipline | null = null;
  if (recs.length) {
    const avg = per((d) => recs.reduce((s, r) => s + r.scores[d], 0) / recs.length);
    weakest = DISCIPLINES.reduce((w, d) => (avg[d] < avg[w] ? d : w), DISCIPLINES[0]);
  }

  const mStart = monthStart(weekEnd);
  const monthSpend = expenses.filter((e) => e.day >= mStart && e.day <= weekEnd).reduce((s, e) => s + e.amount, 0);
  const monthPace = (monthlyBudget * dayOfMonth(weekEnd)) / daysInMonth(weekEnd);
  const weekSpend = expenses.filter(inWeek).reduce((s, e) => s + e.amount, 0);

  return { weekStart, weekEnd, daysTracked: recs.length, fullDays, xpEarned, xpLost, bestDay, weakest, monthSpend, monthPace, weekSpend };
}

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The future self's short weekly letter (6.6). */
export function weeklyLetter(review: WeeklyReviewData, name: string, focus?: Discipline): string {
  const lines: string[] = [`${name || 'Hey'},`];
  if (review.bestDay) {
    const pct = Math.round(review.bestDay.avg * 100);
    lines.push(`Your best day this week was ${DOW[parseDay(review.bestDay.day).getDay()]}, at ${pct}%. I remember it.`);
  } else {
    lines.push('This week was quiet. I am still here.');
  }
  if (review.weakest) {
    lines.push(`${STAT_NAMES[review.weakest]} was the weakest part of me this week. ${DISCIPLINE_LABELS[review.weakest]} is where the next step is.`);
  }
  if (focus) lines.push(`You chose ${DISCIPLINE_LABELS[focus].toLowerCase()} as the focus. Good. One thing at a time is how I got here.`);
  else lines.push('Pick one focus for next week. Just one.');
  lines.push('Future you');
  return lines.join('\n');
}
