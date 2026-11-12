import { config as defaultConfig, type Config } from '../config';
import type { Severity } from '../types';
import { badgeEarned } from './badgeEarned';
import { carbCreep } from './carbCreep';
import { comeback } from './comeback';
import { backupStale, planHundred, welcomeBack } from './extras';
import { goalMet } from './goalMet';
import { lateEating } from './lateEating';
import { levelUp } from './levelUp';
import { lopsided } from './lopsided';
import { lowVeggies } from './lowVeggies';
import { meal3Pending } from './meal3Pending';
import { mealOffWindow } from './mealOffWindow';
import { minimumOnly } from './minimumOnly';
import { missedThreePlus } from './missedThreePlus';
import { missedTwice } from './missedTwice';
import { missedYesterday } from './missedYesterday';
import { notLoggedToday } from './notLoggedToday';
import { offPlanDrift } from './offPlanDrift';
import { overPaceMonth } from './overPaceMonth';
import { perfectDay } from './perfectDay';
import { personalBest } from './personalBest';
import { proteinGap } from './proteinGap';
import { regretSpend } from './regretSpend';
import { streakAtRisk } from './streakAtRisk';
import { streakMilestone } from './streakMilestone';
import { wantHeavy } from './wantHeavy';
import { weakWeekday } from './weakWeekday';
import type { Rule, RuleContext, RuleResult, Trigger } from './types';

export const ALL_RULES: Rule[] = [
  // deviation (6.2)
  notLoggedToday,
  missedYesterday,
  missedTwice,
  missedThreePlus,
  offPlanDrift,
  minimumOnly,
  overPaceMonth,
  wantHeavy,
  regretSpend,
  lopsided,
  weakWeekday,
  streakAtRisk,
  lateEating,
  carbCreep,
  lowVeggies,
  proteinGap,
  mealOffWindow,
  meal3Pending,
  // praise (6.3)
  goalMet,
  perfectDay,
  streakMilestone,
  levelUp,
  comeback,
  personalBest,
  badgeEarned,
  // supporting
  planHundred,
  backupStale,
  welcomeBack,
];

export const SEVERITY_RANK: Record<Severity, number> = { praise: 0, nudge: 1, warning: 2, intervention: 3 };

const hasTrigger = (r: Rule, t: Trigger) => (Array.isArray(r.trigger) ? r.trigger.includes(t) : r.trigger === t);

/** Rules whose per-occurrence vars make them distinct (e.g. one badge-earned per badge). */
const keyOf = (r: RuleResult) => `${r.ruleId}|${r.discipline ?? ''}|${r.ruleId === 'badge-earned' || r.ruleId === 'level-up' ? `${r.vars.badgeId ?? ''}${r.vars.level ?? ''}` : ''}`;

/**
 * Runs all rules for a trigger and applies the filters from 6.1:
 * - a rule does not fire again for the same discipline within 24 hours
 *   (for day-close triggers, "within 24 hours" means the same evaluated day)
 * - at most 3 non-praise messages per day, highest severity first; praise is never capped.
 */
export function runRules(trigger: Trigger, ctx: RuleContext, rules: Rule[] = ALL_RULES, cfg: Config = defaultConfig): RuleResult[] {
  const candidates: RuleResult[] = [];
  for (const rule of rules) {
    if (!hasTrigger(rule, trigger)) continue;
    const r = rule.evaluate(ctx);
    if (!r) continue;
    candidates.push(...(Array.isArray(r) ? r : [r]));
  }

  const seen = new Set<string>();
  const cooldownMs = cfg.companion.cooldownHours * 3600000;
  const logical = trigger === 'onDayClose' || trigger === 'onWeekClose';
  const fresh = candidates.filter((c) => {
    const k = keyOf(c);
    if (seen.has(k)) return false;
    seen.add(k);
    return !ctx.recentMessages.some((m) => {
      if (m.ruleId !== c.ruleId || (m.discipline ?? '') !== (c.discipline ?? '')) return false;
      if (c.ruleId === 'badge-earned' || c.ruleId === 'level-up') return m.day === ctx.today && JSON.stringify(m.vars ?? {}) === JSON.stringify(c.vars);
      if (m.day === ctx.today) return true;
      return !logical && ctx.now.getTime() - new Date(m.createdAt).getTime() < cooldownMs;
    });
  });

  const praise = fresh.filter((c) => c.severity === 'praise');
  const usedToday = ctx.recentMessages.filter((m) => m.day === ctx.today && m.severity !== 'praise').length;
  const room = Math.max(0, cfg.companion.dailyNonPraiseCap - usedToday);
  const others = fresh
    .filter((c) => c.severity !== 'praise')
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
    .slice(0, room);
  return [...others, ...praise];
}
