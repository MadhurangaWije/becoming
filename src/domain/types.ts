// All entities from spec section 3. Pure types, no runtime imports.

export type Discipline = 'food' | 'workout' | 'learning' | 'finance';
export const DISCIPLINES: Discipline[] = ['food', 'workout', 'learning', 'finance'];
export type DayKey = string; // 'YYYY-MM-DD' in local time
export type Score = 0 | 0.5 | 1;
export type MealKey = 'meal1' | 'meal2' | 'meal3';
export type FoodSlot = MealKey | 'extra';

export interface Timestamps {
  createdAt: string;
  updatedAt: string;
}

export interface MealSlot {
  key: MealKey;
  label: string;
  windowStart: string; // 'HH:mm'
  windowEnd: string; // 'HH:mm'
  plan: string;
  postWorkout: boolean; // true = no fixed window, follows the workout
  proteinG: number;
  kcal: number;
}

export interface FoodEntry extends Timestamps {
  id: string;
  day: DayKey;
  slot: FoodSlot;
  description: string;
  rating: 'on_plan' | 'close' | 'off_plan';
  carbs: 'low' | 'moderate' | 'high';
  protein: boolean;
  veggies: boolean;
  time: string; // 'HH:mm'
  asPlanned?: boolean; // logged via "Ate as planned" (carries the plan's protein/kcal)
}

export type WorkoutKind = 'gym' | 'home' | 'run' | 'walk' | 'sport' | 'yoga' | 'other';
export interface WorkoutEntry extends Timestamps {
  id: string;
  day: DayKey;
  kind: WorkoutKind;
  minutes: number;
  intensity: 'light' | 'moderate' | 'hard';
  notes?: string;
  time?: string; // 'HH:mm' when logged, used for the Meal 3 prompt
}

export type LearningSource = 'book' | 'course' | 'video' | 'article' | 'practice' | 'other';
export interface LearningEntry extends Timestamps {
  id: string;
  day: DayKey;
  summary: string;
  topic?: string;
  source?: LearningSource;
  minutes?: number;
}

export type ExpenseTag = 'need' | 'want' | 'regret';
export interface ExpenseEntry extends Timestamps {
  id: string;
  day: DayKey;
  amount: number;
  category: string;
  tag: ExpenseTag;
  note?: string;
}

export interface DayRecord {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  day: DayKey; // primary key
  scores: Record<Discipline, Score>;
  noSpendDay: boolean;
  closedAt?: string;
  usedFreeze: Discipline[];
  reflection?: string;
}

export type XpReason = 'log' | 'goal_met' | 'bonus' | 'streak' | 'perfect_day' | 'decay' | 'comeback';
export interface XpEvent extends Timestamps {
  id: string;
  day: DayKey;
  discipline: Discipline;
  amount: number;
  reason: XpReason;
}

export type Severity = 'praise' | 'nudge' | 'warning' | 'intervention';
export interface CompanionMessage extends Timestamps {
  id: string;
  day: DayKey;
  ruleId: string;
  discipline?: Discipline;
  severity: Severity;
  text: string;
  variant?: number;
  vars?: Record<string, string | number>;
  readAt?: string;
  dismissedAt?: string;
  response?: string;
}

export interface Badge extends Timestamps {
  id: string;
  badgeId: string;
  earnedOn: DayKey;
}

export interface WeeklyReview extends Timestamps {
  id: string;
  weekStart: DayKey;
  focus?: Discipline;
  generatedAt: string;
}

export interface Settings {
  id: 'me';
  createdAt?: string;
  updatedAt?: string;
  name: string;
  currency: string;
  monthlyBudget: number;
  expenseCategories: string[];
  weekStartsOn: 'monday';
  goals: {
    food: { mealPlan: MealSlot[]; eatingCutoff: string; postWorkoutMealCutoff: string };
    workout: { minMinutes: number; bonusCapMinutes: number };
    learning: { minEntries: number };
  };
  whys: Record<Discipline, string>;
  futureSelf: {
    horizonDate: DayKey;
    statement: string;
    identities: Record<Discipline, string>;
  };
  reminderTimes: { midday?: string; evening: string };
  dayCloseHour: number;
  streakFreezes: number;
  onboardedAt?: string;
  firstDay?: DayKey; // first day tracked (onboarding day)
  lastExportedAt?: string;
  lastExpenseCategory?: string;
  persisted?: boolean;
  overrides?: Partial<Record<string, number>>; // tunable number overrides for config
}

export interface DayEntries {
  food: FoodEntry[];
  workout: WorkoutEntry[];
  learning: LearningEntry[];
  expense: ExpenseEntry[];
}

export interface StatState {
  xp: number;
  level: number;
  streak: number;
  longestStreak: number;
}
