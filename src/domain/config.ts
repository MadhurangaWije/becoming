import type { Discipline, MealSlot, Settings } from './types';

/** Every tunable number lives here. User overrides are stored in settings.overrides. */
export const config = {
  xp: {
    full: 20,
    minimum: 10,
    workoutBonusEveryMinutes: 6,
    workoutBonusMax: 10,
    foodPlanBonus: 5,
    learningExtraEach: 5,
    learningExtraMax: 10,
    noSpend: 5,
    underPace: 5,
    perfectDay: 10,
    streakMilestone: 25,
    streakMilestoneEvery: 7,
    comeback: 10,
    comebackMinMisses: 2,
  },
  decay: { secondMiss: 10, thirdPlusMiss: 15 },
  levels: { base: 100, step: 50 },
  freezes: { earnEvery: 7, max: 3 },
  workout: { minimumFloor: 10, maxMinutes: 300 },
  food: { offWindowMinutes: 60, planChallengeTarget: 100 },
  companion: {
    cooldownHours: 24,
    dailyNonPraiseCap: 3,
    catchUpSilentAfterDays: 14,
    meal3PendingMinutes: 45,
    backupNudgeDays: 30,
  },
  editWindowDays: 2,
  textMin: 2,
  textMax: 280,
};

export type Config = typeof config;

/** Merge numeric overrides ("xp.full": 25) into a copy of config. */
export function resolveConfig(overrides?: Partial<Record<string, number>>): Config {
  const c: Config = JSON.parse(JSON.stringify(config));
  if (!overrides) return c;
  for (const [path, value] of Object.entries(overrides)) {
    if (typeof value !== 'number') continue;
    const [group, key] = path.split('.');
    const g = (c as unknown as Record<string, Record<string, number>>)[group];
    if (g && key in g) g[key] = value;
  }
  return c;
}

export const TITLES: { level: number; title: string }[] = [
  { level: 1, title: 'Rookie' },
  { level: 3, title: 'Apprentice' },
  { level: 5, title: 'Disciplined' },
  { level: 8, title: 'Relentless' },
  { level: 12, title: 'Unshakeable' },
  { level: 16, title: 'Master' },
];

export const STAT_NAMES: Record<Discipline, string> = {
  food: 'Fuel',
  workout: 'Body',
  learning: 'Mind',
  finance: 'Wealth',
};

export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  food: 'Food',
  workout: 'Workout',
  learning: 'Learning',
  finance: 'Finance',
};

export const DEFAULT_MEAL_PLAN: MealSlot[] = [
  {
    key: 'meal1',
    label: 'Meal 1',
    windowStart: '11:00',
    windowEnd: '11:30',
    plan: '2 whole eggs + 3 egg whites, 2 slices whole-grain bread, 50 g paneer, a small handful of nuts (about 20 g), salad with lime',
    postWorkout: false,
    proteinG: 45,
    kcal: 650,
  },
  {
    key: 'meal2',
    label: 'Meal 2',
    windowStart: '15:00',
    windowEnd: '15:30',
    plan: '200 g cooked chicken, fish or lean beef (stir-fried in about 1 tbsp oil), 200 g cooked rice, 1 cup of vegetables',
    postWorkout: false,
    proteinG: 69,
    kcal: 760,
  },
  {
    key: 'meal3',
    label: 'Meal 3 (post-workout)',
    windowStart: '',
    windowEnd: '',
    plan: 'Whey isolate shake (1 scoop in water), 170 g plain Greek yogurt, a handful of berries, 1 tsp to 1 tbsp honey',
    postWorkout: true,
    proteinG: 42,
    kcal: 325,
  },
];

/** Default flags used by "Ate as planned" per slot (section 4.1). */
export const PLANNED_FLAGS: Record<string, { carbs: 'low' | 'moderate' | 'high'; protein: boolean; veggies: boolean }> = {
  meal1: { carbs: 'moderate', protein: true, veggies: true },
  meal2: { carbs: 'moderate', protein: true, veggies: true },
  meal3: { carbs: 'low', protein: true, veggies: false },
};

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Groceries',
  'Eating out',
  'Transport',
  'Bills',
  'Shopping',
  'Health',
  'Entertainment',
  'Other',
];

export function defaultSettings(today: string, horizonDate: string): Settings {
  return {
    id: 'me',
    name: '',
    currency: 'LKR',
    monthlyBudget: 150000,
    expenseCategories: [...DEFAULT_EXPENSE_CATEGORIES],
    weekStartsOn: 'monday',
    goals: {
      food: { mealPlan: DEFAULT_MEAL_PLAN.map((m) => ({ ...m })), eatingCutoff: '18:00', postWorkoutMealCutoff: '18:30' },
      workout: { minMinutes: 30, bonusCapMinutes: 90 },
      learning: { minEntries: 1 },
    },
    whys: { food: '', workout: '', learning: '', finance: '' },
    futureSelf: {
      horizonDate,
      statement: '',
      identities: { food: '', workout: '', learning: '', finance: '' },
    },
    reminderTimes: { midday: '12:30', evening: '20:00' },
    dayCloseHour: 3,
    streakFreezes: 0,
    firstDay: today,
  };
}
