import { config as defaultConfig, type Config } from './config';
import { logicalMinutes, toMinutes } from './dates';
import type {
  DayEntries,
  Discipline,
  ExpenseEntry,
  FoodEntry,
  LearningEntry,
  MealKey,
  MealSlot,
  Score,
  Settings,
  WorkoutEntry,
} from './types';

export const MEAL_KEYS: MealKey[] = ['meal1', 'meal2', 'meal3'];

type FoodGoals = Settings['goals']['food'];

/** True if this food entry was eaten after the cutoff (18:00, or 18:30 for Meal 3). */
export function isLate(entry: Pick<FoodEntry, 'slot' | 'time'>, goals: FoodGoals, dayCloseHour = 3): boolean {
  const cutoff = entry.slot === 'meal3' ? goals.postWorkoutMealCutoff : goals.eatingCutoff;
  return logicalMinutes(entry.time, dayCloseHour) > toMinutes(cutoff);
}

/** Meal 1 or Meal 2 logged more than `offWindowMinutes` outside its window. Does not affect score. */
export function isOffWindow(entry: Pick<FoodEntry, 'slot' | 'time'>, plan: MealSlot[], cfg: Config = defaultConfig): boolean {
  if (entry.slot !== 'meal1' && entry.slot !== 'meal2') return false;
  const slot = plan.find((m) => m.key === entry.slot);
  if (!slot || slot.postWorkout || !slot.windowStart || !slot.windowEnd) return false;
  const t = toMinutes(entry.time);
  return t < toMinutes(slot.windowStart) - cfg.food.offWindowMinutes || t > toMinutes(slot.windowEnd) + cfg.food.offWindowMinutes;
}

export interface FoodViolation {
  entryId: string;
  kinds: ('extra' | 'off_plan' | 'high_carb' | 'late')[];
}

/** Each entry with any deviation counts as one violation. */
export function foodViolations(food: FoodEntry[], goals: FoodGoals, dayCloseHour = 3): FoodViolation[] {
  const out: FoodViolation[] = [];
  for (const e of food) {
    const kinds: FoodViolation['kinds'] = [];
    if (e.slot === 'extra') kinds.push('extra');
    else if (e.rating === 'off_plan') kinds.push('off_plan');
    if (e.carbs === 'high') kinds.push('high_carb');
    if (isLate(e, goals, dayCloseHour)) kinds.push('late');
    if (kinds.length) out.push({ entryId: e.id, kinds });
  }
  return out;
}

export interface FoodSummary {
  okSlots: MealKey[]; // slots with an on_plan or close entry
  onPlanSlots: MealKey[];
  violations: FoodViolation[];
  hasVeggies: boolean;
  hasHighCarb: boolean;
}

export function summarizeFood(food: FoodEntry[], goals: FoodGoals, dayCloseHour = 3): FoodSummary {
  const okSlots = MEAL_KEYS.filter((k) => food.some((e) => e.slot === k && (e.rating === 'on_plan' || e.rating === 'close')));
  const onPlanSlots = MEAL_KEYS.filter((k) => food.some((e) => e.slot === k && e.rating === 'on_plan'));
  return {
    okSlots,
    onPlanSlots,
    violations: foodViolations(food, goals, dayCloseHour),
    hasVeggies: food.some((e) => e.veggies),
    hasHighCarb: food.some((e) => e.carbs === 'high'),
  };
}

export function scoreFood(food: FoodEntry[], goals: FoodGoals, dayCloseHour = 3): Score {
  const s = summarizeFood(food, goals, dayCloseHour);
  if (s.okSlots.length === 3 && s.onPlanSlots.length >= 2 && s.violations.length === 0) return 1;
  if (s.okSlots.length >= 2 && s.violations.length <= 1) return 0.5;
  return 0;
}

export function totalWorkoutMinutes(workout: WorkoutEntry[]): number {
  return workout.reduce((sum, w) => sum + w.minutes, 0);
}

export function scoreWorkout(workout: WorkoutEntry[], minMinutes: number, cfg: Config = defaultConfig): Score {
  const total = totalWorkoutMinutes(workout);
  if (total >= minMinutes) return 1;
  if (total >= cfg.workout.minimumFloor) return 0.5;
  return 0;
}

export function scoreLearning(learning: LearningEntry[], minEntries: number): Score {
  return learning.length >= minEntries ? 1 : 0;
}

export function scoreFinance(expenses: ExpenseEntry[], noSpendDay: boolean): Score {
  if (expenses.length > 0) return expenses.some((e) => e.tag === 'regret') ? 0.5 : 1;
  return noSpendDay ? 1 : 0;
}

export function scoreDay(
  entries: DayEntries,
  noSpendDay: boolean,
  settings: Pick<Settings, 'goals' | 'dayCloseHour'>,
  cfg: Config = defaultConfig,
): Record<Discipline, Score> {
  return {
    food: scoreFood(entries.food, settings.goals.food, settings.dayCloseHour),
    workout: scoreWorkout(entries.workout, settings.goals.workout.minMinutes, cfg),
    learning: scoreLearning(entries.learning, settings.goals.learning.minEntries),
    finance: scoreFinance(entries.expense, noSpendDay && entries.expense.length === 0),
  };
}

export function isPerfect(scores: Record<Discipline, Score>): boolean {
  return scores.food === 1 && scores.workout === 1 && scores.learning === 1 && scores.finance === 1;
}

export function averageScore(scores: Record<Discipline, Score>): number {
  return (scores.food + scores.workout + scores.learning + scores.finance) / 4;
}

/** Protein and kcal from meals logged as planned (section 4.1). */
export function plannedNutrition(food: FoodEntry[], plan: MealSlot[]) {
  let protein = 0;
  let kcal = 0;
  const counted = new Set<string>();
  for (const e of food) {
    if (!e.asPlanned || e.slot === 'extra' || counted.has(e.slot)) continue;
    const slot = plan.find((m) => m.key === e.slot);
    if (!slot) continue;
    counted.add(e.slot);
    protein += slot.proteinG;
    kcal += slot.kcal;
  }
  return {
    protein,
    kcal,
    targetProtein: plan.reduce((s, m) => s + m.proteinG, 0),
    targetKcal: plan.reduce((s, m) => s + m.kcal, 0),
  };
}
