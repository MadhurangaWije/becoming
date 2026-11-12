import { defaultSettings } from '@/domain/config';
import { addDays } from '@/domain/dates';
import type { RuleContext } from '@/domain/rules/types';
import type {
  CompanionMessage,
  DayEntries,
  DayKey,
  DayRecord,
  Discipline,
  ExpenseEntry,
  FoodEntry,
  LearningEntry,
  Score,
  Settings,
  WorkoutEntry,
  XpEvent,
} from '@/domain/types';

let n = 0;
const id = () => `id-${++n}`;
const ts = { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };

export const DAY = '2026-03-10'; // a Tuesday

export function settings(p: Partial<Settings> = {}): Settings {
  return { ...defaultSettings('2026-01-01', '2027-01-01'), name: 'Kani', onboardedAt: '2026-01-01T08:00:00.000Z', ...p };
}

export function food(p: Partial<FoodEntry> = {}): FoodEntry {
  return { id: id(), day: DAY, slot: 'meal1', description: 'plan', rating: 'on_plan', carbs: 'moderate', protein: true, veggies: true, time: '11:15', ...ts, ...p };
}

/** A clean, Full food day. */
export function planDay(day = DAY): FoodEntry[] {
  return [
    food({ day, slot: 'meal1', time: '11:10' }),
    food({ day, slot: 'meal2', time: '15:10' }),
    food({ day, slot: 'meal3', time: '17:45', carbs: 'low', veggies: false }),
  ];
}

export function workout(p: Partial<WorkoutEntry> = {}): WorkoutEntry {
  return { id: id(), day: DAY, kind: 'gym', minutes: 30, intensity: 'moderate', ...ts, ...p };
}

export function learning(p: Partial<LearningEntry> = {}): LearningEntry {
  return { id: id(), day: DAY, summary: 'Today I learned something', ...ts, ...p };
}

export function expense(p: Partial<ExpenseEntry> = {}): ExpenseEntry {
  return { id: id(), day: DAY, amount: 1000, category: 'Groceries', tag: 'need', ...ts, ...p };
}

export function entries(p: Partial<DayEntries> = {}): DayEntries {
  return { food: [], workout: [], learning: [], expense: [], ...p };
}

export const scores = (food: Score, workout: Score, learning: Score, finance: Score): Record<Discipline, Score> => ({ food, workout, learning, finance });
export const all = (s: Score) => scores(s, s, s, s);

export function record(day: DayKey, s: Record<Discipline, Score>, p: Partial<DayRecord> = {}): DayRecord {
  return { day, scores: s, noSpendDay: false, usedFreeze: [], closedAt: `${day}T23:00:00.000Z`, ...p };
}

/** Records for `count` days ending on `end` (inclusive), oldest first. */
export function run(end: DayKey, count: number, s: Record<Discipline, Score>): DayRecord[] {
  return Array.from({ length: count }, (_, i) => record(addDays(end, -(count - 1 - i)), s));
}

export function xp(day: DayKey, discipline: Discipline, amount: number, reason: XpEvent['reason'] = 'goal_met'): XpEvent {
  return { id: id(), day, discipline, amount, reason, ...ts };
}

export function message(p: Partial<CompanionMessage>): CompanionMessage {
  return { id: id(), day: DAY, ruleId: 'x', severity: 'nudge', text: 't', ...ts, ...p };
}

const zeroStats = () => ({ xp: 0, level: 1, streak: 0, longestStreak: 0 });

export function ctx(p: Partial<RuleContext> = {}): RuleContext {
  return {
    now: new Date(2026, 2, 10, 12, 0),
    today: DAY,
    settings: settings(),
    days: [],
    entries: entries(),
    stats: { food: zeroStats(), workout: zeroStats(), learning: zeroStats(), finance: zeroStats() },
    recentMessages: [],
    xpEvents: [],
    todayScores: all(0),
    ...p,
  };
}

/** Newest-first day records for a context. */
export const newestFirst = (records: DayRecord[]) => [...records].sort((a, b) => b.day.localeCompare(a.day));
