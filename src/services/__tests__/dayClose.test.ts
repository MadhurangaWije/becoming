import { beforeEach, describe, expect, it } from 'vitest';
import { addDays } from '@/domain/dates';
import { db } from '@/data/db';
import { exportAll, importAll, validateBackup, clearAll, migrateBackup } from '@/data/backup';
import { settingsRepo } from '@/data/repos';
import { buildContext, runTrigger } from '../companion';
import { runDayClose } from '../dayClose';
import { deleteEntry, saveEntries, setNoSpend } from '../parser';
import { settings } from '@/test/fixtures';

const FIRST = '2026-03-02'; // Monday
const at = (day: string, h = 12, m = 0) => {
  const [y, mo, d] = day.split('-').map(Number);
  return new Date(y, mo - 1, d, h, m);
};

async function onboard(firstDay = FIRST) {
  await settingsRepo.save(settings({ firstDay, onboardedAt: at(firstDay, 8).toISOString(), lastExportedAt: at(firstDay, 8).toISOString() }));
}

const perfectDrafts = (day: string) => [
  { discipline: 'food' as const, draft: { day, slot: 'meal1' as const, description: 'plan', rating: 'on_plan' as const, carbs: 'moderate' as const, protein: true, veggies: true, time: '11:10', asPlanned: true } },
  { discipline: 'food' as const, draft: { day, slot: 'meal2' as const, description: 'plan', rating: 'on_plan' as const, carbs: 'moderate' as const, protein: true, veggies: true, time: '15:10', asPlanned: true } },
  { discipline: 'food' as const, draft: { day, slot: 'meal3' as const, description: 'plan', rating: 'on_plan' as const, carbs: 'low' as const, protein: true, veggies: false, time: '17:40', asPlanned: true } },
  { discipline: 'workout' as const, draft: { day, kind: 'gym' as const, minutes: 30, intensity: 'moderate' as const, time: '16:30' } },
  { discipline: 'learning' as const, draft: { day, summary: 'Learned a thing' } },
  { discipline: 'finance' as const, draft: { day, amount: 500, category: 'Groceries', tag: 'need' as const } },
];

beforeEach(async () => {
  await clearAll();
});

describe('day close service (5.6)', () => {
  it('does nothing before onboarding', async () => {
    expect((await runDayClose(at('2026-03-05'))).closed).toEqual([]);
  });

  it('closes multiple skipped days, oldest first, as misses with decay', async () => {
    await onboard();
    await saveEntries(perfectDrafts(FIRST), at(FIRST, 20));
    const r = await runDayClose(at('2026-03-06', 9));
    expect(r.closed).toEqual(['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05']);
    const recs = await db.dayRecords.orderBy('day').toArray();
    expect(recs.map((x) => x.scores.workout)).toEqual([1, 0, 0, 0]);
    expect(recs.every((x) => x.closedAt)).toBe(true);
    const wk = (await db.xpEvents.where('discipline').equals('workout').toArray()).sort((a, b) => a.day.localeCompare(b.day));
    // day 1: +20 full +10 perfect; then misses: 0, -10, -15 (level 1 floor is 0 XP)
    const total = wk.reduce((s, e) => s + e.amount, 0);
    expect(total).toBe(30 - 10 - 15);
    // second run is a no-op
    expect((await runDayClose(at('2026-03-06', 10))).closed).toEqual([]);
    // messages: missed-yesterday, missed-twice, missed-three-plus generated
    const ids = new Set((await db.messages.toArray()).map((m) => m.ruleId));
    expect(ids.has('missed-yesterday')).toBe(true);
    expect(ids.has('missed-twice')).toBe(true);
    expect(ids.has('missed-three-plus')).toBe(true);
    // badges: first step, full ring
    const badges = (await db.badges.toArray()).map((b) => b.badgeId).sort();
    expect(badges).toEqual(['first-step', 'full-ring']);
  });

  it('respects the day close hour: 2am still belongs to yesterday', async () => {
    await onboard();
    const r = await runDayClose(at('2026-03-04', 2));
    expect(r.closed).toEqual(['2026-03-02']);
  });

  it('more than 14 unclosed days close silently with one welcome-back message', async () => {
    await onboard();
    const r = await runDayClose(at('2026-03-25', 9));
    expect(r.closed).toHaveLength(23);
    expect(r.silent).toBe(true);
    const msgs = await db.messages.toArray();
    expect(msgs.map((m) => m.ruleId)).toEqual(['welcome-back']);
    expect(msgs[0].text).toContain('23');
  });

  it('creates a weekly review row when a Sunday closes', async () => {
    await onboard();
    await runDayClose(at('2026-03-09', 9)); // closes Mon..Sun
    expect((await db.weeklyReviews.toArray()).map((r) => r.weekStart)).toEqual([FIRST]);
  });

  it('uses and earns streak freezes', async () => {
    await onboard();
    for (let i = 0; i < 7; i++) await saveEntries(perfectDrafts(addDays(FIRST, i)), at(addDays(FIRST, i), 20));
    await runDayClose(at(addDays(FIRST, 7), 9));
    expect((await settingsRepo.get())!.streakFreezes).toBe(3);
    // day 8: nothing logged -> 4 streaks at risk, 3 freezes held, used in discipline order
    await runDayClose(at(addDays(FIRST, 8), 9));
    const rec = await db.dayRecords.get(addDays(FIRST, 7));
    expect(rec!.usedFreeze).toEqual(['food', 'workout', 'learning']);
    expect((await settingsRepo.get())!.streakFreezes).toBe(0);
  });

  it('editing a closed day re-runs close and replaces its XP events', async () => {
    await onboard();
    await runDayClose(at('2026-03-03', 9));
    expect((await db.dayRecords.get(FIRST))!.scores.workout).toBe(0);
    const { saved } = await saveEntries([{ discipline: 'workout', draft: { day: FIRST, kind: 'run', minutes: 40, intensity: 'hard' } }], at('2026-03-03', 10));
    expect((await db.dayRecords.get(FIRST))!.scores.workout).toBe(1);
    const ev = await db.xpEvents.where('day').equals(FIRST).filter((e) => e.discipline === 'workout').toArray();
    expect(ev.reduce((s, e) => s + e.amount, 0)).toBe(20 + 1);
    await deleteEntry('workout', saved[0].id, at('2026-03-03', 11));
    expect((await db.dayRecords.get(FIRST))!.scores.workout).toBe(0);
    expect(await db.xpEvents.where('day').equals(FIRST).filter((e) => e.discipline === 'workout').count()).toBe(0);
  });

  it('no-spend is cleared automatically when an expense is added', async () => {
    await onboard();
    await setNoSpend(FIRST, true, at(FIRST));
    expect((await db.dayRecords.get(FIRST))!.noSpendDay).toBe(true);
    await saveEntries([{ discipline: 'finance', draft: { day: FIRST, amount: 100, category: 'Other', tag: 'want' } }], at(FIRST));
    expect((await db.dayRecords.get(FIRST))!.noSpendDay).toBe(false);
  });
});

describe('companion service', () => {
  it('runs onLog rules on save and writes messages with template text', async () => {
    await onboard();
    const { messages } = await saveEntries([{ discipline: 'finance', draft: { day: FIRST, amount: 2500, category: 'Eating out', tag: 'regret' } }], at(FIRST, 13));
    expect(messages.map((m) => m.ruleId)).toEqual(['regret-spend']);
    expect(messages[0].text).not.toMatch(/\{\w+\}/);
  });

  it('goal-met fires once per discipline per day', async () => {
    await onboard();
    const a = await saveEntries([{ discipline: 'learning', draft: { day: FIRST, summary: 'one' } }], at(FIRST, 13));
    const b = await saveEntries([{ discipline: 'learning', draft: { day: FIRST, summary: 'two' } }], at(FIRST, 14));
    expect(a.messages.map((m) => m.ruleId)).toEqual(['goal-met']);
    expect(b.messages).toEqual([]);
  });

  it('onOpen after the evening reminder nudges about unlogged disciplines, and an intervention response is saved', async () => {
    await onboard();
    const out = await runTrigger('onOpen', { now: at(FIRST, 21), today: FIRST, provisional: true });
    expect(out.map((m) => m.ruleId)).toContain('not-logged-today');
    await runDayClose(at('2026-03-06', 9));
    const iv = (await db.messages.toArray()).find((m) => m.severity === 'intervention')!;
    await db.messages.update(iv.id, { response: 'Too busy' });
    expect((await db.messages.get(iv.id))!.response).toBe('Too busy');
  });

  it('builds a context with last 35 days, newest first', async () => {
    await onboard();
    await runDayClose(at('2026-03-06', 9));
    const ctx = await buildContext({ now: at('2026-03-06'), today: '2026-03-06', provisional: true });
    expect(ctx.days[0].day).toBe('2026-03-06');
    expect(ctx.days[1].day).toBe('2026-03-05');
  });
});

describe('backup (8)', () => {
  it('export then import on a fresh database restores identical data', async () => {
    await onboard();
    await saveEntries(perfectDrafts(FIRST), at(FIRST, 20));
    await runDayClose(at('2026-03-04', 9));
    const before = await exportAll('2026-03-04T10:00:00.000Z');
    const json = JSON.parse(JSON.stringify(before));
    await clearAll();
    expect(await db.food.count()).toBe(0);
    await importAll(validateBackup(json));
    const after = await exportAll('2026-03-04T10:00:00.000Z');
    const sort = (t: Record<string, unknown[]>) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, [...v].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))]));
    expect(sort(after.tables)).toEqual(sort(before.tables));
  });

  it('rejects files that are not a backup or are from a newer version', () => {
    expect(() => validateBackup({ foo: 1 })).toThrow('not a Becoming backup');
    expect(() => validateBackup({ format: 'becoming-backup', version: 99, tables: {} })).toThrow('Unsupported backup version');
  });
});

describe('backup validation and migration', () => {
  const base = async () => JSON.parse(JSON.stringify(await exportAll('2026-03-04T10:00:00.000Z')));

  it('includes counts and app info', async () => {
    await onboard();
    const f = await base();
    expect(f.counts.settings).toBe(1);
    expect(f.app.name).toBe('Becoming');
  });

  it('rejects truncated files, missing settings, and versions without an upgrade path', async () => {
    await onboard();
    await saveEntries(perfectDrafts(FIRST), at(FIRST, 20));
    const f = await base();
    f.tables.food.pop();
    expect(() => validateBackup(f)).toThrow('truncated');
    const g = await base();
    g.tables.settings = [];
    g.counts.settings = 0;
    expect(() => validateBackup(g)).toThrow('no settings');
    const h = { ...(await base()), version: 0 };
    expect(() => validateBackup(h)).toThrow('Unsupported backup version');
  });

  it('accepts files without counts (older exports)', async () => {
    await onboard();
    const f = await base();
    delete f.counts;
    expect(validateBackup(f).tables.settings).toHaveLength(1);
  });

  it('migrateBackup errors when a step is missing', () => {
    expect(() => migrateBackup({ format: 'becoming-backup', version: -1, exportedAt: '', tables: {} as never })).toThrow('No upgrade path');
  });
});
