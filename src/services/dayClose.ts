import { evaluateBadges, badgeById, planHundredReached } from '@/domain/badges';
import { closeDay, type LevelUp } from '@/domain/closeDay';
import { resolveConfig, STAT_NAMES } from '@/domain/config';
import { addDays, dayRange, endOfLogicalDay, logicalToday, monthStart, weekStart } from '@/domain/dates';
import { isPerfect } from '@/domain/scoring';
import { longestStreak } from '@/domain/streaks';
import type { DayKey, Discipline, Settings } from '@/domain/types';
import { DISCIPLINES } from '@/domain/types';
import { levelFromXp, sumXp, titleFor } from '@/domain/xp';
import { db } from '@/data/db';
import { badgesRepo, daysRepo, entriesRepo, reviewsRepo, settingsRepo, xpRepo } from '@/data/repos';
import type { Celebration } from '@/app/uiStore';
import { runTrigger } from './companion';

export interface DayCloseReport {
  closed: DayKey[];
  silent: boolean;
  celebrations: Celebration[];
}

let running: Promise<DayCloseReport> | null = null;

/** 5.6: close every unclosed day before today, oldest first. Safe to call on every open/resume. */
export function runDayClose(now: Date): Promise<DayCloseReport> {
  if (!running) running = doRun(now).finally(() => (running = null));
  return running;
}

async function doRun(now: Date): Promise<DayCloseReport> {
  const report: DayCloseReport = { closed: [], silent: false, celebrations: [] };
  const settings = await settingsRepo.get();
  if (!settings?.onboardedAt || !settings.firstDay) return report;
  const cfg = resolveConfig(settings.overrides);
  const today = logicalToday(now, settings.dayCloseHour);
  const yesterday = addDays(today, -1);
  if (yesterday < settings.firstDay) return report;

  const records = await daysRepo.all();
  const closedSet = new Set(records.filter((r) => r.closedAt).map((r) => r.day));
  const todo = dayRange(settings.firstDay, yesterday).filter((d) => !closedSet.has(d));
  if (!todo.length) return report;

  const silent = todo.length > cfg.companion.catchUpSilentAfterDays;
  report.silent = silent;
  Object.assign(report, await closeDays(todo, now, silent), { silent });
  if (silent) {
    await runTrigger('onOpen', { now, today, meta: { welcomeBackDays: todo.length } });
  }
  return report;
}

/** Closes the given days oldest first, including week close on Sundays. */
export async function closeDays(todo: DayKey[], now: Date, silent: boolean): Promise<DayCloseReport> {
  const report: DayCloseReport = { closed: [], silent, celebrations: [] };
  for (const day of [...todo].sort()) {
    const r = await closeOne(day, now, { silent });
    report.closed.push(day);
    if (!silent) report.celebrations.push(...r.celebrations);
    // Week close: the closed day is a Sunday (Monday-start weeks)
    if (addDays(weekStart(day), 6) === day) await closeWeek(weekStart(day), silent);
  }
  return report;
}

async function closeWeek(start: DayKey, silent: boolean) {
  await reviewsRepo.ensure(start);
  if (silent) return;
  const end = addDays(start, 6);
  await runTrigger('onWeekClose', { now: endOfLogicalDay(end, (await settingsRepo.get())!.dayCloseHour), today: end, week: { start, end } });
}

interface CloseOptions {
  silent?: boolean;
  reclose?: boolean;
}

/** Closes (or re-closes) a single day. */
export async function closeOne(day: DayKey, now: Date, opts: CloseOptions = {}): Promise<{ celebrations: Celebration[] }> {
  const settings = (await settingsRepo.get()) as Settings;
  const cfg = resolveConfig(settings.overrides);
  const [entries, allRecords, xpAll, monthEntries] = await Promise.all([
    entriesRepo.forDay(day),
    daysRepo.all(),
    xpRepo.all(),
    db.expense.where('day').between(monthStart(day), day, true, true).toArray(),
  ]);
  const existing = allRecords.find((r) => r.day === day);
  const history = allRecords.filter((r) => r.closedAt && r.day < day);
  const xpBefore = sumXp(xpAll.filter((e) => e.day < day));

  // Re-close: refund freezes this day consumed, then decide again.
  let freezes = settings.streakFreezes;
  if (existing?.closedAt) freezes = Math.min(cfg.freezes.max, freezes + existing.usedFreeze.length);

  const result = closeDay(
    {
      day,
      entries,
      noSpendDay: !!existing?.noSpendDay,
      reflection: existing?.reflection,
      history,
      xpBefore,
      freezes,
      settings,
      monthSpendToDate: monthEntries.reduce((s, e) => s + e.amount, 0),
      now,
    },
    cfg,
  );

  await db.transaction('rw', [db.dayRecords, db.xpEvents, db.settings], async () => {
    await daysRepo.put({ ...existing, ...result.record });
    await xpRepo.replaceDay(day, result.xp);
    await settingsRepo.patch({ streakFreezes: result.freezes });
  });

  const celebrations: Celebration[] = [];
  if (opts.reclose) return { celebrations };

  // Badges
  const owned = new Set((await badgesRepo.all()).map((b) => b.badgeId));
  const records = [...history, result.record];
  const levels = Object.fromEntries(DISCIPLINES.map((d) => [d, levelFromXp(result.xpAfter[d], cfg)])) as Record<Discipline, number>;
  const newBadges = evaluateBadges({ owned, day, records, counts: await entriesRepo.counts(), levels, missesBefore: result.missesBefore });
  for (const id of newBadges) await badgesRepo.add(id, day);

  if (!opts.silent) {
    const longestBefore = Object.fromEntries(DISCIPLINES.map((d) => [d, longestStreak(history, d)])) as Record<Discipline, number>;
    const planHundred = planHundredReached(records, day);
    await runTrigger('onDayClose', {
      now: endOfLogicalDay(day, settings.dayCloseHour),
      today: day,
      dayClose: { levelUps: result.levelUps, newBadges, streakAfter: result.streakAfter, missesBefore: result.missesBefore, longestBefore, planHundred },
    });
    celebrations.push(...levelUpCelebrations(result.levelUps));
    if (isPerfect(result.record.scores)) celebrations.push({ kind: 'perfect-day', title: 'Perfect day', subtitle: 'All four disciplines, full.' });
    for (const id of newBadges) celebrations.push({ kind: 'badge', title: badgeById(id)?.name ?? id, subtitle: badgeById(id)?.description });
    if (planHundred) celebrations.push({ kind: 'hundred', title: `${planHundred} days on plan`, subtitle: `Next target: ${planHundred + 100}` });
  }
  return { celebrations };
}

function levelUpCelebrations(ups: LevelUp[]): Celebration[] {
  return ups.map((u) =>
    u.discipline === 'overall'
      ? { kind: 'level-up', title: `Level ${u.level}`, subtitle: `You are now ${titleFor(u.level)}.` }
      : { kind: 'level-up', title: `${STAT_NAMES[u.discipline]} level ${u.level}`, subtitle: 'You are getting closer to me.' },
  );
}

/** Editing an entry on a closed day re-runs day close for that day and replaces its XP events. */
export async function recloseIfClosed(day: DayKey, now: Date) {
  const rec = await daysRepo.get(day);
  if (rec?.closedAt) await closeOne(day, now, { reclose: true });
}
