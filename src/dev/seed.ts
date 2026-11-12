// Generates realistic mixed data for development and the progress screens.
import { DEFAULT_EXPENSE_CATEGORIES, PLANNED_FLAGS } from '@/domain/config';
import { addDays, dayRange, logicalToday } from '@/domain/dates';
import type { ExpenseEntry, FoodEntry, LearningEntry, Settings, WorkoutEntry } from '@/domain/types';
import { db } from '@/data/db';
import { closeDays } from '@/services/dayClose';
import { uuid } from '@/services/clock';

/** Deterministic PRNG so seeds are reproducible. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const TOPICS = ['TypeScript', 'Finance', 'Nutrition', 'History', 'Design', 'Psychology', 'Sinhala'];
const LEARNED = [
  'how compound interest depends more on time than on rate',
  'that protein timing matters less than daily total',
  'the difference between a type alias and an interface',
  'why sleep debt affects decision making',
  'how the Kandyan kingdom resisted for so long',
  'that whitespace is a design element, not empty space',
  'how index funds keep costs low',
  'the Pareto principle applied to habits',
];
const VARIATIONS = ['Rice and chicken curry', 'Kottu roti', 'String hoppers with dhal', 'Egg roti', 'Chicken salad', 'Fried rice'];

export interface SeedData {
  food: FoodEntry[];
  workout: WorkoutEntry[];
  learning: LearningEntry[];
  expense: ExpenseEntry[];
  noSpendDays: string[];
}

/** Pure generator: `days` of data ending on `lastDay`. */
export function generateSeed(settings: Settings, lastDay: string, days = 90, seed = 42): SeedData {
  const r = rng(seed);
  const out: SeedData = { food: [], workout: [], learning: [], expense: [], noSpendDays: [] };
  const t = new Date().toISOString();
  const ts = { createdAt: t, updatedAt: t };
  const from = addDays(lastDay, -(days - 1));
  dayRange(from, lastDay).forEach((day, i) => {
    const progress = i / days; // discipline improves over time
    const good = r() < 0.55 + progress * 0.35;
    const slump = i % 23 >= 20; // occasional 3-day slumps

    // Food
    for (const m of settings.goals.food.mealPlan) {
      if (slump && r() < 0.6) continue;
      if (good || r() < 0.6) {
        out.food.push({ id: uuid(), day, slot: m.key, description: m.plan, rating: 'on_plan', ...PLANNED_FLAGS[m.key], time: m.windowStart || '17:40', asPlanned: true, ...ts });
      } else {
        const desc = VARIATIONS[Math.floor(r() * VARIATIONS.length)];
        out.food.push({ id: uuid(), day, slot: m.key, description: desc, rating: r() < 0.5 ? 'close' : 'off_plan', carbs: r() < 0.3 ? 'high' : 'moderate', protein: r() < 0.7, veggies: r() < 0.5, time: m.windowStart || '17:50', ...ts });
      }
    }
    if (!good && r() < 0.3) out.food.push({ id: uuid(), day, slot: 'extra', description: 'Biscuits with tea', rating: 'off_plan', carbs: 'high', protein: false, veggies: false, time: r() < 0.5 ? '19:30' : '16:00', ...ts });

    // Workout
    if (!slump && (good || r() < 0.5)) {
      const minutes = [20, 30, 45, 60, 75, 90][Math.floor(r() * 6)];
      out.workout.push({ id: uuid(), day, kind: (['gym', 'run', 'walk', 'home'] as const)[Math.floor(r() * 4)], minutes, intensity: minutes > 50 ? 'hard' : 'moderate', time: '16:45', ...ts });
    }

    // Learning
    if (!slump && (good || r() < 0.55)) {
      const n = r() < 0.2 ? 2 : 1;
      for (let k = 0; k < n; k++) out.learning.push({ id: uuid(), day, summary: LEARNED[Math.floor(r() * LEARNED.length)], topic: TOPICS[Math.floor(r() * TOPICS.length)], source: (['book', 'video', 'article', 'course'] as const)[Math.floor(r() * 4)], minutes: 20, ...ts });
    }

    // Finance
    if (r() < 0.15) out.noSpendDays.push(day);
    else if (!slump || r() < 0.5) {
      const n = 1 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const cat = DEFAULT_EXPENSE_CATEGORIES[Math.floor(r() * DEFAULT_EXPENSE_CATEGORIES.length)];
        const tag = r() < 0.65 ? 'need' : r() < 0.8 ? 'want' : 'regret';
        out.expense.push({ id: uuid(), day, amount: Math.round((300 + r() * 4500) / 50) * 50, category: cat, tag, ...ts });
      }
    }
  });
  return out;
}

/** Replaces all logs with seed data and closes every seeded day. */
export async function seedDatabase(now: Date, days = 90) {
  const settings = await db.settings.get('me');
  if (!settings) throw new Error('Onboard first');
  const today = logicalToday(now, settings.dayCloseHour);
  const lastDay = addDays(today, -1);
  const data = generateSeed(settings, lastDay, days);
  const firstDay = addDays(lastDay, -(days - 1));
  await db.transaction('rw', [db.food, db.workout, db.learning, db.expense, db.dayRecords, db.xpEvents, db.messages, db.badges, db.weeklyReviews, db.settings], async () => {
    for (const t of [db.food, db.workout, db.learning, db.expense, db.dayRecords, db.xpEvents, db.messages, db.badges, db.weeklyReviews]) await t.clear();
    await db.food.bulkAdd(data.food);
    await db.workout.bulkAdd(data.workout);
    await db.learning.bulkAdd(data.learning);
    await db.expense.bulkAdd(data.expense);
    const t = new Date().toISOString();
    await db.dayRecords.bulkAdd(data.noSpendDays.map((day) => ({ id: day, day, scores: { food: 0, workout: 0, learning: 0, finance: 0 }, noSpendDay: true, usedFreeze: [], createdAt: t, updatedAt: t })));
    await db.settings.put({ ...settings, firstDay, streakFreezes: 0 });
  });
  await closeDays(dayRange(firstDay, lastDay), now, false);
}
