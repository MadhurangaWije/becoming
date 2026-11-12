import { describe, expect, it } from 'vitest';
import { addDays } from '../dates';
import { TEMPLATES, TemplateWriter, fill, templatesFor } from '../messages';
import { badgeEarned } from '../rules/badgeEarned';
import { carbCreep } from '../rules/carbCreep';
import { comeback } from '../rules/comeback';
import { ALL_RULES, runRules } from '../rules/engine';
import { backupStale, planHundred, welcomeBack } from '../rules/extras';
import { goalMet } from '../rules/goalMet';
import { lateEating } from '../rules/lateEating';
import { levelUp } from '../rules/levelUp';
import { lopsided } from '../rules/lopsided';
import { lowVeggies } from '../rules/lowVeggies';
import { meal3Pending } from '../rules/meal3Pending';
import { mealOffWindow } from '../rules/mealOffWindow';
import { minimumOnly } from '../rules/minimumOnly';
import { missedThreePlus } from '../rules/missedThreePlus';
import { missedTwice } from '../rules/missedTwice';
import { missedYesterday } from '../rules/missedYesterday';
import { notLoggedToday } from '../rules/notLoggedToday';
import { offPlanDrift } from '../rules/offPlanDrift';
import { overPaceMonth } from '../rules/overPaceMonth';
import { perfectDay } from '../rules/perfectDay';
import { personalBest } from '../rules/personalBest';
import { proteinGap } from '../rules/proteinGap';
import { regretSpend } from '../rules/regretSpend';
import { streakAtRisk } from '../rules/streakAtRisk';
import { streakMilestone } from '../rules/streakMilestone';
import type { Rule, RuleContext, RuleResult } from '../rules/types';
import { wantHeavy } from '../rules/wantHeavy';
import { weakWeekday } from '../rules/weakWeekday';
import type { Discipline } from '../types';
import { DAY, all, ctx, entries, expense, food, learning, message, newestFirst, record, run, scores, workout, xp } from '@/test/fixtures';

const zero = { food: 0, workout: 0, learning: 0, finance: 0 };
const evening = new Date(2026, 2, 10, 21, 0);
const asList = (r: RuleResult | RuleResult[] | null) => (r === null ? [] : Array.isArray(r) ? r : [r]);
const fires = (rule: Rule, c: RuleContext) => asList(rule.evaluate(c));
const stat = (streak = 0, level = 1) => ({ xp: 0, level, streak, longestStreak: streak });
const days = (...recs: ReturnType<typeof record>[]) => newestFirst(recs);
const dayClose = (p: Partial<NonNullable<RuleContext['dayClose']>> = {}) => ({
  levelUps: [],
  newBadges: [],
  streakAfter: { ...zero },
  missesBefore: { ...zero },
  longestBefore: { ...zero },
  ...p,
});

describe('not-logged-today', () => {
  it('fires after the evening reminder when a discipline has no entry', () => {
    const r = fires(notLoggedToday, ctx({ now: evening, entries: entries({ food: [food()], workout: [workout()] }) }));
    expect(r).toHaveLength(1);
    expect(r[0].vars.list).toBe('learning and finance');
  });
  it('does not fire before the evening reminder or when everything is logged', () => {
    expect(fires(notLoggedToday, ctx({ now: new Date(2026, 2, 10, 12) }))).toEqual([]);
    const full = entries({ food: [food()], workout: [workout()], learning: [learning()] });
    expect(fires(notLoggedToday, ctx({ now: evening, entries: full, days: [record(DAY, all(0), { noSpendDay: true, closedAt: undefined })] }))).toEqual([]);
  });
});

describe('missed-yesterday', () => {
  it('fires on a miss after a non-miss day', () => {
    const r = fires(missedYesterday, ctx({ days: days(record(addDays(DAY, -1), all(1)), record(DAY, scores(1, 0, 1, 1))) }));
    expect(r.map((x) => x.discipline)).toEqual(['workout']);
  });
  it('does not fire after a previous miss', () => {
    expect(fires(missedYesterday, ctx({ days: days(record(addDays(DAY, -1), all(0)), record(DAY, all(0))) }))).toEqual([]);
  });
});

describe('missed-twice', () => {
  it('fires on exactly 2 consecutive misses, as a warning', () => {
    const r = fires(missedTwice, ctx({ days: days(record(addDays(DAY, -2), all(1)), ...run(DAY, 2, scores(1, 0, 1, 1))), xpEvents: [xp(DAY, 'workout', -10, 'decay')] }));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ discipline: 'workout', severity: 'warning' });
    expect(r[0].vars.xpLost).toBe(10);
  });
  it('does not fire on 1 or 3 misses', () => {
    expect(fires(missedTwice, ctx({ days: days(record(DAY, all(0))) }))).toEqual([]);
    expect(fires(missedTwice, ctx({ days: days(...run(DAY, 3, all(0))) }))).toEqual([]);
  });
});

describe('missed-three-plus', () => {
  it('fires as an intervention on 3+ misses with XP lost', () => {
    const r = fires(missedThreePlus, ctx({ days: days(...run(DAY, 4, scores(1, 0, 1, 1))), xpEvents: [xp(addDays(DAY, -2), 'workout', -10, 'decay'), xp(addDays(DAY, -1), 'workout', -15, 'decay'), xp(DAY, 'workout', -15, 'decay')] }));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ severity: 'intervention', discipline: 'workout', vars: expect.objectContaining({ count: 4, xpLost: 40 }) });
  });
  it('does not fire on 2 misses', () => {
    expect(fires(missedThreePlus, ctx({ days: days(...run(DAY, 2, all(0))) }))).toEqual([]);
  });
});

describe('off-plan-drift', () => {
  const three = days(...run(DAY, 3, all(0.5)));
  it('fires on violations 3 days running', () => {
    const f = [0, 1, 2].map((i) => food({ day: addDays(DAY, -i), slot: 'extra', time: '13:00' }));
    const r = fires(offPlanDrift, ctx({ days: three, entries: entries({ food: f }) }));
    expect(r[0]).toMatchObject({ severity: 'warning', vars: expect.objectContaining({ count: 3 }) });
    expect(String(r[0].vars.meal1Plan)).toContain('eggs');
  });
  it('fires on 4+ violations in 3 days', () => {
    const f = [0, 0, 0, 0].map(() => food({ day: DAY, slot: 'extra', time: '13:00' }));
    expect(fires(offPlanDrift, ctx({ days: three, entries: entries({ food: f }) }))).toHaveLength(1);
  });
  it('does not fire on 2 violations', () => {
    const f = [food({ day: DAY, slot: 'extra', time: '13:00' }), food({ day: addDays(DAY, -1), rating: 'off_plan' })];
    expect(fires(offPlanDrift, ctx({ days: three, entries: entries({ food: f }) }))).toEqual([]);
  });
});

describe('minimum-only', () => {
  it('fires after 5 Minimum days', () => {
    expect(fires(minimumOnly, ctx({ days: days(...run(DAY, 5, scores(0.5, 1, 1, 1))) }))[0].discipline).toBe('food');
  });
  it('does not fire if any Full day', () => {
    expect(fires(minimumOnly, ctx({ days: days(...run(addDays(DAY, -1), 4, scores(0.5, 1, 1, 1)), record(DAY, all(1))) }))).toEqual([]);
  });
});

describe('over-pace-month', () => {
  it('fires above 110% of pace', () => {
    // pace on Mar 10 = 48,387; 110% = 53,226
    const r = fires(overPaceMonth, ctx({ entries: entries({ expense: [expense({ day: '2026-03-02', amount: 40000 }), expense({ day: DAY, amount: 14000 })] }) }));
    expect(r[0]).toMatchObject({ severity: 'warning', vars: expect.objectContaining({ kind: 'pace', spent: 'LKR 54,000' }) });
  });
  it('fires when crossing 80% of budget', () => {
    const c = ctx({ today: '2026-03-28', entries: entries({ expense: [expense({ day: '2026-03-02', amount: 110000 }), expense({ day: '2026-03-28', amount: 11000 })] }) });
    expect(fires(overPaceMonth, c)[0].vars.kind).toBe('crossed');
  });
  it('does not fire under pace', () => {
    expect(fires(overPaceMonth, ctx({ entries: entries({ expense: [expense({ amount: 30000 })] }) }))).toEqual([]);
  });
});

describe('want-heavy', () => {
  it('fires when wants and regrets exceed 50% of the last 7 days', () => {
    const e = [expense({ amount: 1000, tag: 'need' }), expense({ amount: 800, tag: 'want', day: addDays(DAY, -3) }), expense({ amount: 300, tag: 'regret' })];
    expect(fires(wantHeavy, ctx({ entries: entries({ expense: e }) }))[0].vars.pct).toBe(52);
  });
  it('does not fire at 50% or with older spending', () => {
    expect(fires(wantHeavy, ctx({ entries: entries({ expense: [expense({ amount: 500 }), expense({ amount: 500, tag: 'want' })] }) }))).toEqual([]);
    expect(fires(wantHeavy, ctx({ entries: entries({ expense: [expense({ amount: 500, tag: 'want', day: addDays(DAY, -7) })] }) }))).toEqual([]);
  });
});

describe('regret-spend', () => {
  it('fires on a regret-tagged log', () => {
    const e = expense({ tag: 'regret', amount: 2500, category: 'Eating out' });
    expect(fires(regretSpend, ctx({ event: { discipline: 'finance', entry: e } }))[0].vars).toMatchObject({ amount: 'LKR 2,500', category: 'Eating out' });
  });
  it('does not fire otherwise', () => {
    expect(fires(regretSpend, ctx({ event: { discipline: 'finance', entry: expense({ tag: 'want' }) } }))).toEqual([]);
    expect(fires(regretSpend, ctx())).toEqual([]);
  });
});

describe('lopsided', () => {
  it('fires when level gap >= 3', () => {
    const r = fires(lopsided, ctx({ stats: { food: stat(0, 5), workout: stat(0, 2), learning: stat(0, 4), finance: stat(0, 4) } }));
    expect(r[0]).toMatchObject({ discipline: 'workout', vars: expect.objectContaining({ gap: 3 }) });
  });
  it('fires when one stat earned under half the weekly average', () => {
    const week = { start: '2026-03-09', end: '2026-03-15' };
    const ev = [xp(DAY, 'food', 100), xp(DAY, 'workout', 100), xp(DAY, 'learning', 100), xp(DAY, 'finance', 20)];
    expect(fires(lopsided, ctx({ week, xpEvents: ev }))[0].discipline).toBe('finance');
  });
  it('does not fire when balanced', () => {
    const week = { start: '2026-03-09', end: '2026-03-15' };
    const ev = (['food', 'workout', 'learning', 'finance'] as Discipline[]).map((d) => xp(DAY, d, 80));
    expect(fires(lopsided, ctx({ week, xpEvents: ev }))).toEqual([]);
  });
});

describe('weak-weekday', () => {
  const end = '2026-03-15'; // Sunday
  it('fires when one weekday averages <= 0.4 while overall >= 0.7', () => {
    const recs = run(end, 28, all(1)).map((r) => (new Date(r.day + 'T12:00').getDay() === 1 ? { ...r, scores: scores(1, 0, 1, 1) } : r));
    const r = fires(weakWeekday, ctx({ today: end, days: newestFirst(recs), week: { start: '2026-03-09', end } }));
    expect(r[0]).toMatchObject({ discipline: 'workout', vars: expect.objectContaining({ weekday: 'Monday' }) });
  });
  it('does not fire when consistent', () => {
    expect(fires(weakWeekday, ctx({ today: end, days: newestFirst(run(end, 28, all(1))) }))).toEqual([]);
  });
});

describe('streak-at-risk', () => {
  it('fires after evening for a 5+ streak with nothing today', () => {
    const r = fires(streakAtRisk, ctx({ now: evening, stats: { food: stat(6), workout: stat(4), learning: stat(9), finance: stat(0) }, todayScores: scores(0, 0, 1, 0) }));
    expect(r.map((x) => x.discipline)).toEqual(['food']);
    expect(r[0].severity).toBe('warning');
  });
  it('does not fire before evening', () => {
    expect(fires(streakAtRisk, ctx({ stats: { food: stat(6), workout: stat(0), learning: stat(0), finance: stat(0) } }))).toEqual([]);
  });
});

describe('late-eating', () => {
  it('nudges on a late entry and warns on the 3rd in 7 days', () => {
    const e = food({ slot: 'extra', time: '19:10' });
    expect(fires(lateEating, ctx({ event: { discipline: 'food', entry: e } }))[0]).toMatchObject({ severity: 'nudge', vars: expect.objectContaining({ time: '19:10', cutoff: '18:00' }) });
    const past = [food({ day: addDays(DAY, -2), slot: 'extra', time: '20:00' }), food({ day: addDays(DAY, -5), slot: 'extra', time: '21:00' })];
    expect(fires(lateEating, ctx({ event: { discipline: 'food', entry: e }, entries: entries({ food: [...past, e] }) }))[0].severity).toBe('warning');
  });
  it('allows Meal 3 until 18:30', () => {
    expect(fires(lateEating, ctx({ event: { discipline: 'food', entry: food({ slot: 'meal3', time: '18:25' }) } }))).toEqual([]);
    expect(fires(lateEating, ctx({ event: { discipline: 'food', entry: food({ slot: 'meal3', time: '18:35' }) } }))[0].vars.cutoff).toBe('18:30');
  });
});

describe('carb-creep', () => {
  it('fires on high carbs on 3 of 5 days', () => {
    const f = [0, 2, 4].map((i) => food({ day: addDays(DAY, -i), carbs: 'high' }));
    expect(fires(carbCreep, ctx({ entries: entries({ food: f }) }))).toHaveLength(1);
  });
  it('does not fire on 2 of 5', () => {
    const f = [0, 5, 2].map((i) => food({ day: addDays(DAY, -i), carbs: 'high' }));
    expect(fires(carbCreep, ctx({ entries: entries({ food: f }) }))).toEqual([]);
  });
});

describe('low-veggies', () => {
  const two = days(...run(DAY, 2, all(0.5)));
  it('fires with no vegetables on 2 consecutive days', () => {
    const f = [food({ veggies: false }), food({ day: addDays(DAY, -1), veggies: false })];
    expect(fires(lowVeggies, ctx({ days: two, entries: entries({ food: f }) }))).toHaveLength(1);
  });
  it('does not fire if either day had vegetables', () => {
    const f = [food({ veggies: false }), food({ day: addDays(DAY, -1), veggies: true })];
    expect(fires(lowVeggies, ctx({ days: two, entries: entries({ food: f }) }))).toEqual([]);
  });
});

describe('protein-gap', () => {
  it('fires when a planned meal lacks protein on 2 of 3 days', () => {
    const f = [food({ protein: false }), food({ day: addDays(DAY, -2), slot: 'meal2', protein: false })];
    expect(fires(proteinGap, ctx({ entries: entries({ food: f }) }))).toHaveLength(1);
  });
  it('ignores extras and a single day', () => {
    const f = [food({ protein: false }), food({ day: addDays(DAY, -1), slot: 'extra', protein: false })];
    expect(fires(proteinGap, ctx({ entries: entries({ food: f }) }))).toEqual([]);
  });
});

describe('meal-off-window', () => {
  it('fires on 3 of 7 days off window', () => {
    const f = [0, 3, 6].map((i) => food({ day: addDays(DAY, -i), slot: 'meal1', time: '13:00' }));
    expect(fires(mealOffWindow, ctx({ entries: entries({ food: f }) }))[0].vars.window).toBe('11:00 to 11:30');
  });
  it('does not fire on 2', () => {
    const f = [0, 3].map((i) => food({ day: addDays(DAY, -i), slot: 'meal2', time: '17:00' }));
    expect(fires(mealOffWindow, ctx({ entries: entries({ food: f }) }))).toEqual([]);
  });
});

describe('meal3-pending', () => {
  const w = workout({ time: '16:30' });
  it('fires 45 minutes after a workout without Meal 3', () => {
    expect(fires(meal3Pending, ctx({ now: new Date(2026, 2, 10, 17, 20), entries: entries({ workout: [w] }) }))).toHaveLength(1);
  });
  it('fires by 18:00 regardless', () => {
    expect(fires(meal3Pending, ctx({ now: new Date(2026, 2, 10, 18, 0), entries: entries({ workout: [workout({ time: '17:45' })] }) }))).toHaveLength(1);
  });
  it('does not fire too early, with Meal 3 logged, or without a workout', () => {
    expect(fires(meal3Pending, ctx({ now: new Date(2026, 2, 10, 17, 0), entries: entries({ workout: [w] }) }))).toEqual([]);
    expect(fires(meal3Pending, ctx({ now: new Date(2026, 2, 10, 18, 0), entries: entries({ workout: [w], food: [food({ slot: 'meal3' })] }) }))).toEqual([]);
    expect(fires(meal3Pending, ctx({ now: new Date(2026, 2, 10, 18, 0) }))).toEqual([]);
    expect(fires(meal3Pending, ctx({ now: new Date(2026, 2, 10, 18, 0), entries: entries({ workout: [w] }), event: { discipline: 'learning', entry: learning() } }))).toEqual([]);
  });
});

describe('praise rules', () => {
  it('goal-met fires when the logged discipline reaches Full', () => {
    expect(fires(goalMet, ctx({ event: { discipline: 'workout', entry: workout() }, todayScores: scores(0, 1, 0, 0) }))[0].severity).toBe('praise');
    expect(fires(goalMet, ctx({ event: { discipline: 'workout', entry: workout() }, todayScores: scores(0, 0.5, 0, 0) }))).toEqual([]);
  });
  it('perfect-day fires when all four are Full', () => {
    expect(fires(perfectDay, ctx({ event: { discipline: 'learning', entry: learning() }, todayScores: all(1) }))).toHaveLength(1);
    expect(fires(perfectDay, ctx({ event: { discipline: 'learning', entry: learning() }, todayScores: scores(1, 1, 1, 0.5) }))).toEqual([]);
  });
  it('streak-milestone at 3, 7, 14, 30, 60, 100', () => {
    const c = ctx({ days: days(record(DAY, all(1))), dayClose: dayClose({ streakAfter: { food: 7, workout: 8, learning: 3, finance: 0 } }) });
    expect(fires(streakMilestone, c).map((r) => [r.discipline, r.vars.streak])).toEqual([
      ['food', 7],
      ['learning', 3],
    ]);
    expect(fires(streakMilestone, ctx({ days: days(record(DAY, all(1))), dayClose: dayClose({ streakAfter: { food: 8, workout: 0, learning: 0, finance: 0 } }) }))).toEqual([]);
  });
  it('level-up for stats and overall', () => {
    const r = fires(levelUp, ctx({ dayClose: dayClose({ levelUps: [{ discipline: 'learning', level: 3 }, { discipline: 'overall', level: 3 }] }) }));
    expect(r).toHaveLength(2);
    expect(r[0].vars).toMatchObject({ stat: 'Mind', level: 3 });
    expect(r[1].vars.title).toBe('Apprentice');
    expect(fires(levelUp, ctx({ dayClose: dayClose() }))).toEqual([]);
  });
  it('comeback after 2+ misses', () => {
    expect(fires(comeback, ctx({ days: days(record(DAY, scores(0, 1, 0, 0))), dayClose: dayClose({ missesBefore: { ...zero, workout: 2 } }) }))[0].vars.missed).toBe(2);
    expect(fires(comeback, ctx({ days: days(record(DAY, scores(0, 1, 0, 0))), dayClose: dayClose({ missesBefore: { ...zero, workout: 1 } }) }))).toEqual([]);
  });
  it('personal-best: longest workout', () => {
    const c = ctx({ event: { discipline: 'workout', entry: workout({ minutes: 70 }) }, entries: entries({ workout: [workout({ minutes: 70 })] }), personalBests: { longestWorkoutBefore: 60, lowestWeekSpendBefore: null } });
    expect(fires(personalBest, c)[0].vars.value).toBe('70 minutes');
    expect(fires(personalBest, { ...c, personalBests: { longestWorkoutBefore: 90, lowestWeekSpendBefore: null } })).toEqual([]);
  });
  it('personal-best: longest streak and lowest-spend week', () => {
    const c = ctx({ days: days(record(DAY, all(1))), dayClose: dayClose({ longestBefore: { ...zero, food: 9 }, streakAfter: { ...zero, food: 10 } }) });
    expect(fires(personalBest, c)[0].vars.what).toBe('longest Fuel streak');
    expect(fires(personalBest, ctx({ days: days(record(DAY, all(1))), dayClose: dayClose({ longestBefore: { ...zero, food: 9 }, streakAfter: { ...zero, food: 11 } }) }))).toEqual([]);
    const sunday = '2026-03-15';
    const wk = ctx({ today: sunday, days: days(record(sunday, all(1))), dayClose: dayClose(), entries: entries({ expense: [expense({ day: sunday, amount: 3000 })] }), personalBests: { longestWorkoutBefore: 0, lowestWeekSpendBefore: 5000 } });
    expect(fires(personalBest, wk)[0].vars.what).toBe('lowest-spend week');
  });
  it('badge-earned per new badge', () => {
    expect(fires(badgeEarned, ctx({ dayClose: dayClose({ newBadges: ['first-step', 'full-ring'] }) })).map((r) => r.vars.badge)).toEqual(['First Step', 'Full Ring']);
  });
  it('plan-hundred, backup-stale, welcome-back', () => {
    expect(fires(planHundred, ctx({ dayClose: dayClose({ planHundred: 100 }) }))[0].vars.next).toBe(200);
    expect(fires(planHundred, ctx({ dayClose: dayClose() }))).toEqual([]);
    expect(fires(backupStale, ctx({ now: new Date(2026, 2, 10), meta: { lastExportedAt: '2026-01-01T00:00:00Z' } }))).toHaveLength(1);
    expect(fires(backupStale, ctx({ now: new Date(2026, 2, 10), meta: { lastExportedAt: '2026-03-01T00:00:00Z' } }))).toEqual([]);
    expect(fires(welcomeBack, ctx({ meta: { welcomeBackDays: 20 } }))[0].vars.days).toBe(20);
    expect(fires(welcomeBack, ctx())).toEqual([]);
  });
});

describe('6.1 engine filters', () => {
  const nudge = (id: string, discipline?: Discipline): Rule => ({ id, trigger: 'onDayClose', evaluate: () => ({ ruleId: id, discipline, severity: 'nudge', vars: {} }) });
  const of = (id: string, severity: RuleResult['severity'], trigger: Rule['trigger'] = 'onDayClose'): Rule => ({ id, trigger, evaluate: () => ({ ruleId: id, severity, vars: {} }) });

  it('runs only rules for the trigger', () => {
    expect(runRules('onOpen', ctx(), [nudge('a')])).toEqual([]);
    expect(runRules('onDayClose', ctx(), [nudge('a')])).toHaveLength(1);
  });

  it('24h cooldown per rule and discipline', () => {
    const recent = [message({ ruleId: 'a', discipline: 'food', day: DAY })];
    expect(runRules('onDayClose', ctx({ recentMessages: recent }), [nudge('a', 'food')])).toEqual([]);
    expect(runRules('onDayClose', ctx({ recentMessages: recent }), [nudge('a', 'workout')])).toHaveLength(1);
    // the next evaluated day is allowed
    expect(runRules('onDayClose', ctx({ today: addDays(DAY, 1), recentMessages: recent }), [nudge('a', 'food')])).toHaveLength(1);
    // for live triggers, a message created less than 24h ago blocks across the day boundary
    const live: Rule = { ...nudge('b', 'food'), trigger: 'onOpen' };
    const yesterdayEvening = message({ ruleId: 'b', discipline: 'food', day: addDays(DAY, -1), createdAt: new Date(2026, 2, 9, 22).toISOString() });
    expect(runRules('onOpen', ctx({ now: new Date(2026, 2, 10, 12), recentMessages: [yesterdayEvening] }), [live])).toEqual([]);
    expect(runRules('onOpen', ctx({ now: new Date(2026, 2, 10, 23), recentMessages: [yesterdayEvening] }), [live])).toHaveLength(1);
  });

  it('caps non-praise at 3 per day, highest severity first; praise is never capped', () => {
    const rules = [of('n1', 'nudge'), of('n2', 'nudge'), of('w1', 'warning'), of('i1', 'intervention'), of('p1', 'praise'), of('p2', 'praise')];
    const out = runRules('onDayClose', ctx(), rules);
    expect(out.map((r) => r.ruleId)).toEqual(['i1', 'w1', 'n1', 'p1', 'p2']);
    const used = [message({ ruleId: 'x1', day: DAY }), message({ ruleId: 'x2', day: DAY, severity: 'warning' })];
    expect(runRules('onDayClose', ctx({ recentMessages: used }), rules).map((r) => r.ruleId)).toEqual(['i1', 'p1', 'p2']);
  });

  it('every rule id has at least 4 template variants', () => {
    for (const r of ALL_RULES) expect(TEMPLATES[r.id]?.length ?? 0).toBeGreaterThanOrEqual(4);
  });
});

describe('6.5 templates', () => {
  it('fills placeholders and prefers discipline variants', () => {
    expect(fill('{a} and {b}', { a: 1 })).toBe('1 and {b}');
    expect(templatesFor('missed-twice', 'workout')[0]).toContain('training');
    expect(templatesFor('missed-twice', 'food')[0]).not.toContain('training');
  });
  it('never repeats the last variant for a rule', () => {
    const w = new TemplateWriter(() => 0);
    const res = { ruleId: 'level-up', severity: 'praise' as const, vars: { stat: 'Body', level: 4 } };
    const first = w.write(res, []);
    expect(first.variant).toBe(0);
    expect(first.text).toBe('Body just reached level 4. You are getting closer to me.');
    const second = w.write(res, [{ ruleId: 'level-up', variant: 0 }]);
    expect(second.variant).toBe(1);
  });
});
