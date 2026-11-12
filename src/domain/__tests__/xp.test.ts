import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../config';
import {
  budgetPace,
  clampDecay,
  computeDayXp,
  decayForMiss,
  levelFromXp,
  levelProgress,
  levelStartXp,
  overallLevel,
  titleFor,
  titleTier,
  xpForNextLevel,
  type DayXpInput,
} from '../xp';
import { all, entries, expense, food, learning, planDay, scores, settings, workout } from '@/test/fixtures';

const zero = { food: 0, workout: 0, learning: 0, finance: 0 };

function input(p: Partial<DayXpInput>): DayXpInput {
  return {
    day: '2026-03-10',
    scores: all(0),
    entries: entries(),
    noSpendDay: false,
    settings: settings(),
    monthSpendToDate: 999999,
    streakAfter: { ...zero },
    missesBefore: { ...zero },
    xpBefore: { ...zero },
    ...p,
  };
}

const total = (events: { discipline: string; amount: number; reason: string }[], d: string, reason?: string) =>
  events.filter((e) => e.discipline === d && (!reason || e.reason === reason)).reduce((s, e) => s + e.amount, 0);

describe('5.2 XP table', () => {
  it('Full score: 20, Minimum: 10', () => {
    const ev = computeDayXp(input({ scores: scores(1, 0.5, 0, 0) }));
    expect(total(ev, 'food', 'goal_met')).toBe(20);
    expect(total(ev, 'workout', 'log')).toBe(10);
    expect(total(ev, 'learning')).toBe(0);
  });

  it('workout bonus: +1 per 6 extra minutes, capped at +10 at 90 minutes', () => {
    const at = (minutes: number) => total(computeDayXp(input({ scores: scores(0, 1, 0, 0), entries: entries({ workout: [workout({ minutes })] }) })), 'workout', 'bonus');
    expect(at(30)).toBe(0);
    expect(at(36)).toBe(1);
    expect(at(41)).toBe(1);
    expect(at(60)).toBe(5);
    expect(at(90)).toBe(10);
    expect(at(150)).toBe(10);
  });

  it('food bonus +5: all 3 on plan, vegetables, no violations', () => {
    const ok = computeDayXp(input({ scores: scores(1, 0, 0, 0), entries: entries({ food: planDay() }) }));
    expect(total(ok, 'food', 'bonus')).toBe(5);
    const close = planDay();
    close[0] = { ...close[0], rating: 'close' };
    expect(total(computeDayXp(input({ scores: scores(1, 0, 0, 0), entries: entries({ food: close }) })), 'food', 'bonus')).toBe(0);
    const noVeg = planDay().map((e) => ({ ...e, veggies: false }));
    expect(total(computeDayXp(input({ scores: scores(1, 0, 0, 0), entries: entries({ food: noVeg }) })), 'food', 'bonus')).toBe(0);
  });

  it('extra learning entries: +5 each, up to +10', () => {
    const at = (n: number) => total(computeDayXp(input({ scores: scores(0, 0, 1, 0), entries: entries({ learning: Array.from({ length: n }, () => learning()) }) })), 'learning', 'bonus');
    expect(at(1)).toBe(0);
    expect(at(2)).toBe(5);
    expect(at(3)).toBe(10);
    expect(at(5)).toBe(10);
  });

  it('no-spend day +5', () => {
    expect(total(computeDayXp(input({ scores: scores(0, 0, 0, 1), noSpendDay: true })), 'finance', 'bonus')).toBe(5);
    expect(total(computeDayXp(input({ scores: scores(0, 0, 0, 1), noSpendDay: true, entries: entries({ expense: [expense()] }) })), 'finance', 'bonus')).toBe(0);
  });

  it('month-to-date at or under budget pace +5', () => {
    const pace = budgetPace('2026-03-10', 150000); // 10/31 of budget
    expect(Math.round(pace)).toBe(48387);
    const under = computeDayXp(input({ scores: scores(0, 0, 0, 1), monthSpendToDate: 40000, entries: entries({ expense: [expense()] }) }));
    expect(total(under, 'finance', 'bonus')).toBe(5);
    const over = computeDayXp(input({ scores: scores(0, 0, 0, 1), monthSpendToDate: 60000, entries: entries({ expense: [expense()] }) }));
    expect(total(over, 'finance', 'bonus')).toBe(0);
    const missed = computeDayXp(input({ scores: scores(0, 0, 0, 0), monthSpendToDate: 0 }));
    expect(total(missed, 'finance', 'bonus')).toBe(0);
  });

  it('perfect day: +10 to each stat', () => {
    const ev = computeDayXp(input({ scores: all(1), entries: entries({ workout: [workout()] }) }));
    for (const d of ['food', 'workout', 'learning', 'finance']) expect(total(ev, d, 'perfect_day')).toBe(10);
  });

  it('streak milestone every 7 days: +25', () => {
    const ev = computeDayXp(input({ scores: scores(0, 0, 1, 0), streakAfter: { ...zero, learning: 14 } }));
    expect(total(ev, 'learning', 'streak')).toBe(25);
    const ev2 = computeDayXp(input({ scores: scores(0, 0, 1, 0), streakAfter: { ...zero, learning: 8 } }));
    expect(total(ev2, 'learning', 'streak')).toBe(0);
  });

  it('comeback: first Full day after 2+ misses: +10', () => {
    expect(total(computeDayXp(input({ scores: scores(0, 1, 0, 0), missesBefore: { ...zero, workout: 2 }, entries: entries({ workout: [workout()] }) })), 'workout', 'comeback')).toBe(10);
    expect(total(computeDayXp(input({ scores: scores(0, 1, 0, 0), missesBefore: { ...zero, workout: 1 }, entries: entries({ workout: [workout()] }) })), 'workout', 'comeback')).toBe(0);
    expect(total(computeDayXp(input({ scores: scores(0, 0.5, 0, 0), missesBefore: { ...zero, workout: 3 } })), 'workout', 'comeback')).toBe(0);
  });
});

describe('5.3 Levels', () => {
  it('XP needed from n to n+1 is 100 + 50(n-1)', () => {
    expect(xpForNextLevel(1)).toBe(100);
    expect(xpForNextLevel(2)).toBe(150);
    expect(xpForNextLevel(5)).toBe(300);
  });
  it('level thresholds', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(99)).toBe(1);
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(249)).toBe(2);
    expect(levelFromXp(250)).toBe(3);
    expect(levelStartXp(4)).toBe(450);
    expect(levelProgress(300)).toMatchObject({ level: 3, intoLevel: 50, needed: 200, toNext: 150 });
  });
  it('overall level is the lowest stat level', () => {
    expect(overallLevel({ food: 5, workout: 3, learning: 7, finance: 4 })).toBe(3);
  });
  it('titles', () => {
    expect(titleFor(1)).toBe('Rookie');
    expect(titleFor(2)).toBe('Rookie');
    expect(titleFor(3)).toBe('Apprentice');
    expect(titleFor(5)).toBe('Disciplined');
    expect(titleFor(8)).toBe('Relentless');
    expect(titleFor(12)).toBe('Unshakeable');
    expect(titleFor(20)).toBe('Master');
    expect(titleTier(16)).toBe(5);
  });
  it('config overrides apply', () => {
    expect(xpForNextLevel(1, resolveConfig({ 'levels.base': 200 }))).toBe(200);
  });
});

describe('5.4 Decay', () => {
  it('first miss free, second 10, third and later 15', () => {
    expect(decayForMiss(1)).toBe(0);
    expect(decayForMiss(2)).toBe(10);
    expect(decayForMiss(3)).toBe(15);
    expect(decayForMiss(9)).toBe(15);
  });
  it('cannot push below the start of the current level', () => {
    expect(clampDecay(105, 15)).toBe(5);
    expect(clampDecay(100, 15)).toBe(0);
    expect(clampDecay(5, 10)).toBe(5);
    expect(clampDecay(180, 15)).toBe(15);
  });
  it('is written as a negative decay event, clamped', () => {
    const ev = computeDayXp(input({ scores: all(0), missesBefore: { ...zero, workout: 1, food: 2 }, xpBefore: { ...zero, workout: 104, food: 300 } }));
    expect(total(ev, 'workout', 'decay')).toBe(-4);
    expect(total(ev, 'food', 'decay')).toBe(-15);
    expect(total(ev, 'learning', 'decay')).toBe(0);
  });
});

describe('fixture sanity', () => {
  it('food helper defaults to an on-plan meal', () => {
    expect(food().rating).toBe('on_plan');
  });
});
