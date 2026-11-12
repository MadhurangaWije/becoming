import { describe, expect, it } from 'vitest';
import { BADGES, evaluateBadges, planHundredReached } from '../badges';
import { closeDay, emptyEntries, type CloseDayInput } from '../closeDay';
import { addDays, dayRange } from '../dates';
import { distance, fadingOn, moodFrom } from '../futureSelf';
import { statStates } from '../stats';
import { liveStreak, longestStreak, missesEndingOn, perfectStreakEndingOn, planChallenge, streakEndingOn } from '../streaks';
import type { DayRecord, Discipline } from '../types';
import { buildWeeklyReview, weeklyLetter } from '../weeklyReview';
import { all, entries, expense, learning, planDay, record, run, scores, settings, workout, xp } from '@/test/fixtures';

const zero = { food: 0, workout: 0, learning: 0, finance: 0 };

function input(p: Partial<CloseDayInput>): CloseDayInput {
  return {
    day: '2026-03-10',
    entries: emptyEntries(),
    noSpendDay: false,
    history: [],
    xpBefore: { ...zero },
    freezes: 0,
    settings: settings(),
    monthSpendToDate: 0,
    now: new Date(2026, 2, 11, 3),
    ...p,
  };
}

describe('5.5 Streaks', () => {
  const recs = [...run('2026-03-05', 5, scores(1, 0.5, 0, 1)), record('2026-03-06', scores(0, 1, 0, 1), { usedFreeze: ['food'] })];

  it('counts consecutive days at 0.5 or more, freezes included', () => {
    expect(streakEndingOn(recs, 'workout', '2026-03-06')).toBe(6);
    expect(streakEndingOn(recs, 'food', '2026-03-06')).toBe(6);
    expect(streakEndingOn(recs, 'learning', '2026-03-06')).toBe(0);
  });
  it('a gap breaks the streak', () => {
    expect(streakEndingOn(recs, 'workout', '2026-03-08')).toBe(0);
  });
  it('misses are counted on actual scores, ignoring freezes', () => {
    expect(missesEndingOn(recs, 'food', '2026-03-06')).toBe(1);
    expect(missesEndingOn(recs, 'learning', '2026-03-06')).toBe(6);
  });
  it('longest streak per discipline', () => {
    const r = [...run('2026-03-03', 3, all(1)), record('2026-03-04', all(0)), ...run('2026-03-09', 5, all(1))];
    expect(longestStreak(r, 'food')).toBe(5);
    expect(longestStreak([...run('2026-03-03', 3, all(1)), ...run('2026-03-09', 2, all(1))], 'food')).toBe(3);
  });
  it('live streak includes today only when today qualifies', () => {
    const r = run('2026-03-09', 4, all(1));
    expect(liveStreak(r, 'food', '2026-03-10', 0)).toBe(4);
    expect(liveStreak(r, 'food', '2026-03-10', 0.5)).toBe(5);
  });
  it('perfect-day streak', () => {
    expect(perfectStreakEndingOn([...run('2026-03-09', 3, all(1))], '2026-03-09')).toBe(3);
  });
});

describe('4.2 Plan challenge', () => {
  it('counts the current run of Full food days; freezes do not protect it', () => {
    const r = [...run('2026-03-05', 5, scores(1, 0, 0, 0)), record('2026-03-06', all(0), { usedFreeze: ['food'] }), ...run('2026-03-09', 3, scores(1, 0, 0, 0))];
    expect(planChallenge(r, '2026-03-10', 0)).toEqual({ run: 3, best: 5, total: 8, target: 100 });
    expect(planChallenge(r, '2026-03-10', 1).run).toBe(4);
  });
  it('target moves to the next 100 after reaching it', () => {
    const r = run('2026-06-30', 100, scores(1, 0, 0, 0));
    expect(planChallenge(r, '2026-07-01', 0)).toMatchObject({ run: 100, target: 200 });
    expect(planHundredReached(r, '2026-06-30')).toBe(100);
    expect(planHundredReached(r, '2026-06-29')).toBe(null);
  });
});

describe('closeDay', () => {
  it('scores, streaks and XP for a perfect day', () => {
    const r = closeDay(
      input({
        entries: entries({ food: planDay(), workout: [workout({ minutes: 45 })], learning: [learning()], expense: [expense()] }),
        history: run('2026-03-09', 6, all(1)),
      }),
    );
    expect(r.record.scores).toEqual(all(1));
    expect(r.streakAfter.food).toBe(7);
    const sum = (d: Discipline) => r.xp.filter((e) => e.discipline === d).reduce((s, e) => s + e.amount, 0);
    expect(sum('workout')).toBe(20 + 2 + 10 + 25);
    expect(sum('food')).toBe(20 + 5 + 10 + 25);
    expect(r.freezesEarned).toBe(3); // four streaks hit 7, capped at 3 banked
    expect(r.freezes).toBe(3);
  });

  it('a miss with a freeze held consumes it, keeps the streak, and still decays', () => {
    // yesterday was already a frozen workout miss, so today is the 2nd consecutive miss
    const history = [...run('2026-03-08', 5, all(1)), record('2026-03-09', scores(1, 0, 1, 1), { usedFreeze: ['workout'] })];
    const r = closeDay(input({ history, freezes: 2, xpBefore: { ...zero, workout: 160 }, entries: entries({ food: planDay(), learning: [learning()], expense: [expense()] }) }));
    expect(r.record.usedFreeze).toEqual(['workout']);
    // 2 - 1 used, then food/learning/finance streaks reach 7 and refill to the cap of 3
    expect(r.freezes).toBe(3);
    expect(r.freezesEarned).toBe(2);
    expect(r.streakAfter.workout).toBe(7);
    expect(r.missesBefore.workout).toBe(1);
    expect(r.xp.find((e) => e.discipline === 'workout' && e.reason === 'decay')?.amount).toBe(-10);
  });

  it('does not use a freeze without a streak to protect', () => {
    const r = closeDay(input({ freezes: 2 }));
    expect(r.record.usedFreeze).toEqual([]);
    expect(r.freezes).toBe(2);
  });

  it('closes multiple skipped days in order with growing decay and floor', () => {
    let history: DayRecord[] = [];
    let xpTotals = { ...zero, workout: 130 };
    let freezes = 0;
    const decays: number[] = [];
    for (const day of dayRange('2026-03-01', '2026-03-05')) {
      const r = closeDay(input({ day, history, xpBefore: xpTotals, freezes }));
      history = [...history, r.record];
      xpTotals = r.xpAfter;
      freezes = r.freezes;
      decays.push(Math.abs(r.xp.find((e) => e.discipline === 'workout' && e.reason === 'decay')?.amount ?? 0));
    }
    expect(decays).toEqual([0, 10, 15, 5, 0]); // floor at level 2 start (100 XP)
    expect(xpTotals.workout).toBe(100);
    expect(history.every((h) => h.scores.workout === 0)).toBe(true);
  });

  it('reports level-ups including overall', () => {
    const r = closeDay(
      input({
        entries: entries({ food: planDay(), workout: [workout()], learning: [learning()], expense: [expense()] }),
        xpBefore: { food: 90, workout: 90, learning: 90, finance: 90 },
      }),
    );
    expect(r.levelUps.map((u) => u.discipline)).toEqual(['food', 'workout', 'learning', 'finance', 'overall']);
  });

  it('no-spend flag is dropped when expenses exist', () => {
    expect(closeDay(input({ noSpendDay: true, entries: entries({ expense: [expense()] }) })).record.noSpendDay).toBe(false);
    expect(closeDay(input({ noSpendDay: true })).record.noSpendDay).toBe(true);
  });
});

describe('5.7 Badges', () => {
  const base = { owned: new Set<string>(), counts: { anyEntries: 0, workouts: 0, learning: 0 }, levels: { food: 1, workout: 1, learning: 1, finance: 1 }, missesBefore: { ...zero } };

  it('defines all badges', () => {
    expect(BADGES).toHaveLength(1 + 1 + 4 + 4 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1);
  });

  it('awards each condition', () => {
    const records = run('2026-03-10', 30, all(1)).map((r, i) => ({ ...r, noSpendDay: i < 10 }));
    const got = evaluateBadges({ ...base, day: '2026-03-10', records, counts: { anyEntries: 5, workouts: 100, learning: 100 }, levels: { food: 5, workout: 5, learning: 5, finance: 6 } });
    expect(got).toEqual(
      expect.arrayContaining(['first-step', 'full-ring', 'week-strong-food', 'iron-month-finance', 'perfect-week', 'century', 'scholar', 'clean-plate', 'tight-fist', 'balanced']),
    );
    expect(got).not.toContain('hundred-days');
    expect(got).not.toContain('comeback');
  });

  it('does not re-award owned badges', () => {
    const got = evaluateBadges({ ...base, owned: new Set(['first-step']), day: '2026-03-10', records: [record('2026-03-10', all(0))], counts: { anyEntries: 3, workouts: 0, learning: 0 } });
    expect(got).toEqual([]);
  });

  it('comeback after 3+ misses, hundred days', () => {
    const records = [record('2026-03-10', scores(0, 1, 0, 0))];
    expect(evaluateBadges({ ...base, day: '2026-03-10', records, missesBefore: { ...zero, workout: 3 } })).toContain('comeback');
    expect(evaluateBadges({ ...base, day: '2026-03-10', records, missesBefore: { ...zero, workout: 2 } })).not.toContain('comeback');
    expect(evaluateBadges({ ...base, day: '2026-06-30', records: run('2026-06-30', 100, scores(1, 0, 0, 0)) })).toContain('hundred-days');
  });
});

describe('6.6 Future self', () => {
  it('mood from the last 3 days', () => {
    expect(moodFrom(run('2026-03-10', 3, all(1)))).toBe('proud');
    expect(moodFrom(run('2026-03-10', 3, scores(1, 1, 0.5, 0)))).toBe('steady'); // 0.625
    expect(moodFrom(run('2026-03-10', 3, scores(1, 0.5, 0, 0)))).toBe('concerned'); // 0.375
    expect(moodFrom(run('2026-03-10', 3, scores(1, 0, 0, 0)))).toBe('disappointed');
    expect(moodFrom([])).toBe('steady');
    // only the last 3 count
    expect(moodFrom([...run('2026-03-07', 5, all(0)), ...run('2026-03-10', 3, all(1))])).toBe('proud');
  });
  it('distance: days left and % strong days', () => {
    const recs = [record('2026-03-08', scores(1, 1, 1, 0)), record('2026-03-09', scores(1, 1, 0, 0))];
    expect(distance(recs, '2026-03-10', '2026-03-20')).toEqual({ daysLeft: 10, strongDaysPct: 50, daysSoFar: 2 });
  });
  it('fading stats', () => {
    expect([...fadingOn([xp('2026-03-09', 'food', -10, 'decay'), xp('2026-03-09', 'workout', 20)], '2026-03-09')]).toEqual(['food']);
  });
});

describe('stats', () => {
  it('derives xp, level, streak, longest and fading', () => {
    const closed = run('2026-03-09', 3, scores(1, 0, 0, 0));
    const events = [xp('2026-03-07', 'food', 120), xp('2026-03-09', 'workout', -10, 'decay')];
    const s = statStates(closed, events, '2026-03-10', scores(1, 0, 0, 0));
    expect(s.food).toMatchObject({ xp: 120, level: 2, streak: 4, longestStreak: 4, fading: false });
    expect(s.workout.fading).toBe(true);
  });
});

describe('Weekly review', () => {
  it('numbers match the underlying fixture', () => {
    const start = '2026-03-09'; // Monday
    const records = [
      record(start, all(1)),
      record(addDays(start, 1), scores(1, 0, 0.5, 0.5)),
      record(addDays(start, 2), scores(0.5, 1, 0, 1)),
      record(addDays(start, 7), all(1)), // next week, excluded
    ];
    const events = [xp(start, 'food', 30), xp(addDays(start, 1), 'workout', -10, 'decay'), xp(addDays(start, 2), 'workout', 20), xp('2026-03-01', 'food', 99)];
    const expenses = [expense({ day: '2026-03-02', amount: 5000 }), expense({ day: start, amount: 2000 }), expense({ day: addDays(start, 3), amount: 1000 })];
    const r = buildWeeklyReview(start, records, events, expenses, 150000);
    expect(r.fullDays).toEqual({ food: 2, workout: 2, learning: 1, finance: 2 });
    expect(r.xpEarned).toEqual({ food: 30, workout: 20, learning: 0, finance: 0 });
    expect(r.xpLost).toEqual({ food: 0, workout: 10, learning: 0, finance: 0 });
    expect(r.bestDay).toEqual({ day: start, avg: 1 });
    expect(r.weakest).toBe('learning');
    expect(r.weekSpend).toBe(3000);
    expect(r.monthSpend).toBe(8000);
    expect(Math.round(r.monthPace)).toBe(72581); // 15/31 of budget
    const letter = weeklyLetter(r, 'Kani', 'learning');
    expect(letter).toContain('Monday');
    expect(letter).toContain('Mind was the weakest');
    expect(letter).toContain('learning as the focus');
  });
});
