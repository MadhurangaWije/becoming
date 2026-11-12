import { resolveConfig } from '@/domain/config';
import { addDays, dayOfMonth, daysInMonth, logicalToday, monthStart, weekStart } from '@/domain/dates';
import { distance, horizonReached, moodFrom, type Mood } from '@/domain/futureSelf';
import { isPerfect, plannedNutrition, scoreDay, totalWorkoutMinutes } from '@/domain/scoring';
import { perfectStreak, statStates, type StatView } from '@/domain/stats';
import { planChallenge, type PlanChallenge } from '@/domain/streaks';
import type { CompanionMessage, DayEntries, DayKey, DayRecord, Discipline, Score, Settings } from '@/domain/types';
import { computeDayXp, levelFromXp, overallLevel, titleFor, titleTier } from '@/domain/xp';
import { db } from '@/data/db';
import { daysRepo, entriesRepo, reviewsRepo, xpRepo } from '@/data/repos';

export interface TodayView {
  settings: Settings;
  today: DayKey;
  entries: DayEntries;
  record?: DayRecord;
  scores: Record<Discipline, Score>;
  provisionalXp: number;
  stats: Record<Discipline, StatView>;
  overall: { level: number; title: string; tier: number };
  perfectStreak: number;
  plan: PlanChallenge;
  nutrition: ReturnType<typeof plannedNutrition>;
  workoutMinutes: number;
  month: { spent: number; budget: number; pace: number };
  mood: Mood;
  distance: ReturnType<typeof distance>;
  horizonReached: boolean;
  latestMessage?: CompanionMessage;
  pinnedWarning?: CompanionMessage;
  pendingIntervention?: CompanionMessage;
  focus?: Discipline;
  meal3Due: boolean;
  unread: number;
}

export async function loadTodayView(now: Date): Promise<TodayView | null> {
  const settings = await db.settings.get('me');
  if (!settings?.onboardedAt) return null;
  const cfg = resolveConfig(settings.overrides);
  const today = logicalToday(now, settings.dayCloseHour);
  const [entries, records, xpAll, messages, monthExpenses, review] = await Promise.all([
    entriesRepo.forDay(today),
    daysRepo.all(),
    xpRepo.all(),
    db.messages.where('day').aboveOrEqual(addDays(today, -14)).toArray(),
    db.expense.where('day').between(monthStart(today), today, true, true).toArray(),
    reviewsRepo.get(weekStart(addDays(weekStart(today), -1))),
  ]);
  const record = records.find((r) => r.day === today);
  const closed = records.filter((r) => r.closedAt && r.day < today);
  const scores = scoreDay(entries, !!record?.noSpendDay, settings, cfg);
  const stats = statStates(closed, xpAll, today, scores, cfg);
  const levels = Object.fromEntries(Object.entries(stats).map(([d, s]) => [d, s.level])) as Record<Discipline, number>;
  const level = overallLevel(levels);

  const missesBefore = { food: 0, workout: 0, learning: 0, finance: 0 };
  const streakAfter = { food: 0, workout: 0, learning: 0, finance: 0 };
  const provisional = computeDayXp(
    {
      day: today,
      scores,
      entries,
      noSpendDay: !!record?.noSpendDay,
      settings,
      monthSpendToDate: monthExpenses.reduce((s, e) => s + e.amount, 0),
      streakAfter: Object.fromEntries(Object.entries(stats).map(([d, s]) => [d, scores[d as Discipline] >= 0.5 ? s.streak : 0])) as typeof streakAfter,
      missesBefore,
      xpBefore: Object.fromEntries(Object.entries(stats).map(([d, s]) => [d, s.xp])) as typeof missesBefore,
    },
    cfg,
  ).filter((e) => e.amount > 0);

  const sorted = [...messages].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const spent = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const workoutsToday = entries.workout.length > 0;
  const meal3Logged = entries.food.some((e) => e.slot === 'meal3');

  return {
    settings,
    today,
    entries,
    record,
    scores,
    provisionalXp: provisional.reduce((s, e) => s + e.amount, 0),
    stats,
    overall: { level, title: titleFor(level), tier: titleTier(level) },
    perfectStreak: perfectStreak(closed, today, isPerfect(scores)),
    plan: planChallenge(closed, today, scores.food, cfg.food.planChallengeTarget),
    nutrition: plannedNutrition(entries.food, settings.goals.food.mealPlan),
    workoutMinutes: totalWorkoutMinutes(entries.workout),
    month: { spent, budget: settings.monthlyBudget, pace: (settings.monthlyBudget * dayOfMonth(today)) / daysInMonth(today) },
    mood: moodFrom(closed),
    distance: distance(closed, today, settings.futureSelf.horizonDate),
    horizonReached: horizonReached(today, settings.futureSelf.horizonDate),
    latestMessage: sorted.find((m) => !m.dismissedAt),
    pinnedWarning: sorted.find((m) => m.severity === 'warning' && !m.dismissedAt),
    pendingIntervention: sorted.find((m) => m.severity === 'intervention' && !m.response && !m.dismissedAt),
    focus: review?.focus,
    meal3Due: workoutsToday && !meal3Logged,
    unread: sorted.filter((m) => !m.readAt).length,
  };
}

/** Everything the Stats screen needs. */
export async function loadStatsView(now: Date) {
  const view = await loadTodayView(now);
  if (!view) return null;
  const badges = await db.badges.toArray();
  const cfg = resolveConfig(view.settings.overrides);
  return { ...view, badges, levelOf: (xp: number) => levelFromXp(xp, cfg), cfg };
}
