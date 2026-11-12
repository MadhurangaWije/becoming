import type { LevelUp } from '../closeDay';
import type {
  CompanionMessage,
  DayKey,
  DayRecord,
  Discipline,
  ExpenseEntry,
  FoodEntry,
  LearningEntry,
  Score,
  Settings,
  Severity,
  StatState,
  WorkoutEntry,
  XpEvent,
} from '../types';

export type Trigger = 'onLog' | 'onOpen' | 'onDayClose' | 'onWeekClose';

export type LogEvent =
  | { discipline: 'food'; entry: FoodEntry }
  | { discipline: 'workout'; entry: WorkoutEntry }
  | { discipline: 'learning'; entry: LearningEntry }
  | { discipline: 'finance'; entry: ExpenseEntry };

export interface RuleContext {
  now: Date;
  today: DayKey; // for onDayClose: the day being closed
  settings: Settings;
  days: DayRecord[]; // last 35 days, newest first (for onLog/onOpen, index 0 is today's provisional record)
  entries: { food: FoodEntry[]; workout: WorkoutEntry[]; learning: LearningEntry[]; expense: ExpenseEntry[] }; // last 35 days
  stats: Record<Discipline, StatState>;
  recentMessages: CompanionMessage[]; // last 14 days
  xpEvents: XpEvent[]; // last 35 days
  todayScores: Record<Discipline, Score>;
  event?: LogEvent;
  dayClose?: {
    levelUps: LevelUp[];
    newBadges: string[];
    streakAfter: Record<Discipline, number>;
    missesBefore: Record<Discipline, number>;
    longestBefore: Record<Discipline, number>;
    planHundred?: number | null;
  };
  week?: { start: DayKey; end: DayKey };
  personalBests?: { longestWorkoutBefore: number; lowestWeekSpendBefore: number | null };
  meta?: { lastExportedAt?: string; welcomeBackDays?: number };
}

export interface RuleResult {
  ruleId: string;
  discipline?: Discipline;
  severity: Severity;
  vars: Record<string, string | number>;
}

export interface Rule {
  id: string;
  trigger: Trigger | Trigger[];
  evaluate(ctx: RuleContext): RuleResult | RuleResult[] | null;
}
