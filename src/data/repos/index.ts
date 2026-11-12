// Typed read/write functions per table. All writes in the app go through here.
import { addDays } from '@/domain/dates';
import type {
  Badge,
  CompanionMessage,
  DayEntries,
  DayKey,
  DayRecord,
  Discipline,
  ExpenseEntry,
  FoodEntry,
  LearningEntry,
  Settings,
  WeeklyReview,
  WorkoutEntry,
  XpEvent,
} from '@/domain/types';
import { stamp, uuid } from '@/services/clock';
import { db } from '../db';

// ---------- settings ----------

export const settingsRepo = {
  get: () => db.settings.get('me'),
  async save(s: Settings) {
    const t = stamp();
    await db.settings.put({ ...s, id: 'me', createdAt: s.createdAt ?? t, updatedAt: t });
  },
  async patch(p: Partial<Settings>) {
    const cur = await db.settings.get('me');
    if (!cur) throw new Error('No settings');
    await db.settings.put({ ...cur, ...p, id: 'me', updatedAt: stamp() });
  },
};

// ---------- entries ----------

export type EntryMap = {
  food: FoodEntry;
  workout: WorkoutEntry;
  learning: LearningEntry;
  finance: ExpenseEntry;
};
export type AnyEntry = EntryMap[Discipline];
export type DraftOf<D extends Discipline> = Omit<EntryMap[D], 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

export const tableFor = (d: Discipline) => {
  switch (d) {
    case 'food':
      return db.food;
    case 'workout':
      return db.workout;
    case 'learning':
      return db.learning;
    case 'finance':
      return db.expense;
  }
};

export const entriesRepo = {
  async upsert<D extends Discipline>(d: D, draft: DraftOf<D>): Promise<EntryMap[D]> {
    const table = tableFor(d) as unknown as import('dexie').Table<EntryMap[D], string>;
    const t = stamp();
    const existing = draft.id ? await table.get(draft.id) : undefined;
    const entry = { ...draft, id: draft.id ?? uuid(), createdAt: existing?.createdAt ?? t, updatedAt: t } as EntryMap[D];
    await table.put(entry);
    return entry;
  },
  async remove(d: Discipline, id: string) {
    const table = tableFor(d);
    const e = await table.get(id);
    await table.delete(id);
    return e as AnyEntry | undefined;
  },
  async forDay(day: DayKey): Promise<DayEntries> {
    const [food, workout, learning, expense] = await Promise.all([
      db.food.where('day').equals(day).toArray(),
      db.workout.where('day').equals(day).toArray(),
      db.learning.where('day').equals(day).toArray(),
      db.expense.where('day').equals(day).toArray(),
    ]);
    return { food, workout, learning, expense };
  },
  async between(from: DayKey, to: DayKey): Promise<DayEntries> {
    const [food, workout, learning, expense] = await Promise.all([
      db.food.where('day').between(from, to, true, true).toArray(),
      db.workout.where('day').between(from, to, true, true).toArray(),
      db.learning.where('day').between(from, to, true, true).toArray(),
      db.expense.where('day').between(from, to, true, true).toArray(),
    ]);
    return { food, workout, learning, expense };
  },
  async lastDays(today: DayKey, n: number) {
    return entriesRepo.between(addDays(today, -(n - 1)), today);
  },
  async counts() {
    const [food, workout, learning, expense] = await Promise.all([db.food.count(), db.workout.count(), db.learning.count(), db.expense.count()]);
    return { anyEntries: food + workout + learning + expense, workouts: workout, learning };
  },
};

// ---------- day records ----------

export const daysRepo = {
  get: (day: DayKey) => db.dayRecords.get(day),
  all: () => db.dayRecords.orderBy('day').toArray(),
  closed: async () => (await db.dayRecords.orderBy('day').toArray()).filter((r) => !!r.closedAt),
  async put(r: DayRecord) {
    const t = stamp();
    await db.dayRecords.put({ ...r, id: r.id ?? r.day, createdAt: r.createdAt ?? t, updatedAt: t });
  },
  /** Provisional fields (no-spend flag, reflection) on a day not yet closed. */
  async patch(day: DayKey, p: Partial<Pick<DayRecord, 'noSpendDay' | 'reflection'>>) {
    const cur = await db.dayRecords.get(day);
    const base: DayRecord = cur ?? { day, scores: { food: 0, workout: 0, learning: 0, finance: 0 }, noSpendDay: false, usedFreeze: [] };
    await daysRepo.put({ ...base, ...p });
  },
};

// ---------- XP ledger ----------

export const xpRepo = {
  all: () => db.xpEvents.toArray(),
  since: (day: DayKey) => db.xpEvents.where('day').aboveOrEqual(day).toArray(),
  async replaceDay(day: DayKey, events: Omit<XpEvent, 'id' | 'createdAt' | 'updatedAt'>[]) {
    const t = stamp();
    await db.xpEvents.where('day').equals(day).delete();
    await db.xpEvents.bulkAdd(events.map((e) => ({ ...e, id: uuid(), createdAt: t, updatedAt: t })));
  },
};

// ---------- companion messages ----------

export const messagesRepo = {
  all: () => db.messages.toArray().then((m) => m.sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
  since: (day: DayKey) => db.messages.where('day').aboveOrEqual(day).toArray(),
  async add(m: Omit<CompanionMessage, 'id' | 'createdAt' | 'updatedAt'>) {
    const t = stamp();
    const msg = { ...m, id: uuid(), createdAt: t, updatedAt: t };
    await db.messages.add(msg);
    return msg;
  },
  async patch(id: string, p: Partial<CompanionMessage>) {
    await db.messages.update(id, { ...p, updatedAt: stamp() });
  },
  async markAllRead() {
    const t = stamp();
    await db.messages.filter((m) => !m.readAt).modify({ readAt: t, updatedAt: t });
  },
};

// ---------- badges ----------

export const badgesRepo = {
  all: () => db.badges.toArray(),
  async add(badgeId: string, earnedOn: DayKey) {
    const t = stamp();
    const b: Badge = { id: uuid(), badgeId, earnedOn, createdAt: t, updatedAt: t };
    await db.badges.add(b);
    return b;
  },
};

// ---------- weekly reviews ----------

export const reviewsRepo = {
  all: () => db.weeklyReviews.orderBy('weekStart').reverse().toArray(),
  get: (weekStart: DayKey) => db.weeklyReviews.where('weekStart').equals(weekStart).first(),
  async ensure(weekStart: DayKey): Promise<WeeklyReview> {
    const cur = await reviewsRepo.get(weekStart);
    if (cur) return cur;
    const t = stamp();
    const r: WeeklyReview = { id: uuid(), weekStart, generatedAt: t, createdAt: t, updatedAt: t };
    await db.weeklyReviews.add(r);
    return r;
  },
  async setFocus(weekStart: DayKey, focus: Discipline) {
    const r = await reviewsRepo.ensure(weekStart);
    await db.weeklyReviews.update(r.id, { focus, updatedAt: stamp() });
  },
};
