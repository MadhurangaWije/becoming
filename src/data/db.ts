import Dexie, { type Table } from 'dexie';
import type {
  Badge,
  CompanionMessage,
  DayRecord,
  ExpenseEntry,
  FoodEntry,
  LearningEntry,
  Settings,
  WeeklyReview,
  WorkoutEntry,
  XpEvent,
} from '@/domain/types';

export class BecomingDB extends Dexie {
  settings!: Table<Settings, string>;
  food!: Table<FoodEntry, string>;
  workout!: Table<WorkoutEntry, string>;
  learning!: Table<LearningEntry, string>;
  expense!: Table<ExpenseEntry, string>;
  dayRecords!: Table<DayRecord, string>;
  xpEvents!: Table<XpEvent, string>;
  messages!: Table<CompanionMessage, string>;
  badges!: Table<Badge, string>;
  weeklyReviews!: Table<WeeklyReview, string>;

  constructor(name = 'becoming') {
    super(name);
    this.version(1).stores({
      settings: 'id',
      food: 'id, day',
      workout: 'id, day',
      learning: 'id, day',
      expense: 'id, day',
      dayRecords: 'day',
      xpEvents: 'id, day, discipline',
      messages: 'id, day, ruleId, readAt',
      badges: 'id, &badgeId',
      weeklyReviews: 'id, &weekStart',
    });
  }
}

export const db = new BecomingDB();

export const TABLES = [
  'settings',
  'food',
  'workout',
  'learning',
  'expense',
  'dayRecords',
  'xpEvents',
  'messages',
  'badges',
  'weeklyReviews',
] as const;
export type TableName = (typeof TABLES)[number];
