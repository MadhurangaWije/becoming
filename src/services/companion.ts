import { resolveConfig } from '@/domain/config';
import { addDays, monthStart, weekStart } from '@/domain/dates';
import { TemplateWriter, type MessageWriter } from '@/domain/messages';
import { runRules } from '@/domain/rules/engine';
import type { RuleContext, Trigger } from '@/domain/rules/types';
import { scoreDay } from '@/domain/scoring';
import { statStates } from '@/domain/stats';
import type { CompanionMessage, DayKey, DayRecord, Settings } from '@/domain/types';
import { daysRepo, entriesRepo, messagesRepo, settingsRepo, xpRepo } from '@/data/repos';
import { db } from '@/data/db';

let writer: MessageWriter = new TemplateWriter();
/** Seam: swap the template picker for another writer later (section 10). */
export function setMessageWriter(w: MessageWriter) {
  writer = w;
}

export interface ContextOptions {
  now: Date;
  today: DayKey;
  event?: RuleContext['event'];
  dayClose?: RuleContext['dayClose'];
  week?: RuleContext['week'];
  meta?: RuleContext['meta'];
  /** When evaluating an open day, include its provisional record at the top of `days`. */
  provisional?: boolean;
}

export async function buildContext(opts: ContextOptions, settingsIn?: Settings): Promise<RuleContext> {
  const settings = settingsIn ?? (await settingsRepo.get());
  if (!settings) throw new Error('Not onboarded');
  const cfg = resolveConfig(settings.overrides);
  const { today } = opts;
  const from = addDays(today, -34);
  const fromEntries = monthStart(today) < from ? monthStart(today) : from; // month-to-date needs the whole month
  const [allRecords, entries, xpAll, recentMessages] = await Promise.all([
    daysRepo.all(),
    entriesRepo.between(fromEntries, today),
    xpRepo.all(),
    messagesRepo.since(addDays(today, -13)),
  ]);
  const closedBefore = allRecords.filter((r) => r.closedAt && r.day < today);
  const todayEntries = {
    food: entries.food.filter((e) => e.day === today),
    workout: entries.workout.filter((e) => e.day === today),
    learning: entries.learning.filter((e) => e.day === today),
    expense: entries.expense.filter((e) => e.day === today),
  };
  const todayRec = allRecords.find((r) => r.day === today);
  const todayScores = todayRec?.closedAt && !opts.provisional ? todayRec.scores : scoreDay(todayEntries, !!todayRec?.noSpendDay, settings, cfg);

  let days: DayRecord[] = allRecords.filter((r) => r.day >= from && r.day <= today && (r.closedAt || r.day === today));
  if (opts.provisional) {
    days = days.filter((r) => r.day !== today);
    days.push({ day: today, scores: todayScores, noSpendDay: !!todayRec?.noSpendDay, usedFreeze: [] });
  }
  days.sort((a, b) => b.day.localeCompare(a.day));

  const stats = statStates(closedBefore, xpAll, today, todayScores, cfg);
  let personalBests: RuleContext['personalBests'];
  if (opts.event?.discipline === 'workout' || opts.dayClose) {
    personalBests = await personalBestsBefore(today);
  }

  return {
    now: opts.now,
    today,
    settings,
    days,
    entries,
    stats,
    recentMessages,
    xpEvents: xpAll.filter((e) => e.day >= from),
    todayScores,
    event: opts.event,
    dayClose: opts.dayClose,
    week: opts.week,
    personalBests,
    meta: { lastExportedAt: settings.lastExportedAt, ...opts.meta },
  };
}

async function personalBestsBefore(today: DayKey) {
  const workouts = await db.workout.where('day').below(today).toArray();
  const perDay = new Map<string, number>();
  for (const w of workouts) perDay.set(w.day, (perDay.get(w.day) ?? 0) + w.minutes);
  const longestWorkoutBefore = Math.max(0, ...perDay.values());
  const expenses = await db.expense.where('day').below(today).toArray();
  const weekly = new Map<string, number>();
  for (const e of expenses) {
    const k = weekStart(e.day);
    weekly.set(k, (weekly.get(k) ?? 0) + e.amount);
  }
  // only complete weeks before the current one count
  weekly.delete(weekStart(today));
  const lowestWeekSpendBefore = weekly.size ? Math.min(...weekly.values()) : null;
  return { longestWorkoutBefore, lowestWeekSpendBefore };
}

/** Runs one trigger, writes the resulting messages, returns them. */
export async function runTrigger(trigger: Trigger, opts: ContextOptions, settings?: Settings): Promise<CompanionMessage[]> {
  const ctx = await buildContext(opts, settings);
  const cfg = resolveConfig(ctx.settings.overrides);
  const results = runRules(trigger, ctx, undefined, cfg);
  const recent = [...ctx.recentMessages].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const out: CompanionMessage[] = [];
  for (const r of results) {
    const { text, variant } = writer.write(r, [...out, ...recent]);
    out.unshift(
      await messagesRepo.add({ day: ctx.today, ruleId: r.ruleId, discipline: r.discipline, severity: r.severity, text, variant, vars: r.vars }),
    );
  }
  if (out.length) await refreshAppBadge();
  return out;
}

/** App Badging API: count of unread warnings and interventions. */
export async function refreshAppBadge() {
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  if (!nav.setAppBadge) return;
  const n = await db.messages.filter((m) => !m.readAt && (m.severity === 'warning' || m.severity === 'intervention')).count();
  try {
    if (n) await nav.setAppBadge(n);
    else await nav.clearAppBadge?.();
  } catch {
    /* unsupported */
  }
}
