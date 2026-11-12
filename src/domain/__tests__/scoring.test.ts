import { describe, expect, it } from 'vitest';
import { DEFAULT_MEAL_PLAN } from '../config';
import {
  foodViolations,
  isLate,
  isOffWindow,
  isPerfect,
  plannedNutrition,
  scoreDay,
  scoreFinance,
  scoreFood,
  scoreLearning,
  scoreWorkout,
} from '../scoring';
import { entries, expense, food, learning, planDay, settings, workout } from '@/test/fixtures';

const goals = settings().goals.food;

describe('5.1 Food score', () => {
  it('Full: all 3 planned meals, on plan or close with at least 2 on plan, no violations', () => {
    expect(scoreFood(planDay(), goals)).toBe(1);
    const withClose = planDay();
    withClose[1] = { ...withClose[1], rating: 'close' };
    expect(scoreFood(withClose, goals)).toBe(1);
  });

  it('not Full when only 1 meal is on plan', () => {
    const f = planDay().map((e, i) => (i > 0 ? { ...e, rating: 'close' as const } : e));
    expect(scoreFood(f, goals)).toBe(0.5);
  });

  it('extra entry blocks Full but allows Minimum', () => {
    expect(scoreFood([...planDay(), food({ slot: 'extra', time: '13:00' })], goals)).toBe(0.5);
  });

  it('eating after the cutoff blocks Full', () => {
    expect(scoreFood([...planDay(), food({ slot: 'extra', time: '19:30' })], goals)).toBe(0.5);
    const late3 = planDay();
    late3[2] = { ...late3[2], time: '18:20' }; // meal 3 may run to 18:30
    expect(scoreFood(late3, goals)).toBe(1);
    late3[2] = { ...late3[2], time: '18:45' };
    expect(scoreFood(late3, goals)).toBe(0.5);
  });

  it('a high carb entry blocks Full', () => {
    const f = planDay();
    f[1] = { ...f[1], carbs: 'high' };
    expect(scoreFood(f, goals)).toBe(0.5);
  });

  it('Minimum: 2 planned meals on plan or close, at most 1 violation', () => {
    expect(scoreFood(planDay().slice(0, 2), goals)).toBe(0.5);
    const offPlan = planDay();
    offPlan[2] = { ...offPlan[2], rating: 'off_plan' };
    expect(scoreFood(offPlan, goals)).toBe(0.5);
  });

  it('Miss: 2 violations, or fewer than 2 good planned meals', () => {
    expect(scoreFood([...planDay().slice(0, 2), food({ slot: 'extra', time: '13:00' }), food({ slot: 'extra', time: '14:00' })], goals)).toBe(0);
    expect(scoreFood(planDay().slice(0, 1), goals)).toBe(0);
    expect(scoreFood([], goals)).toBe(0);
  });

  it('late-night entries before the day close hour count as late', () => {
    expect(isLate(food({ slot: 'extra', time: '01:30' }), goals, 3)).toBe(true);
    expect(isLate(food({ slot: 'meal1', time: '11:00' }), goals, 3)).toBe(false);
  });

  it('counts one violation per entry even with several kinds', () => {
    const v = foodViolations([food({ slot: 'extra', carbs: 'high', time: '20:00' })], goals);
    expect(v).toHaveLength(1);
    expect(v[0].kinds).toEqual(['extra', 'high_carb', 'late']);
  });

  it('flags meals more than 60 minutes outside their window', () => {
    expect(isOffWindow(food({ slot: 'meal1', time: '12:31' }), DEFAULT_MEAL_PLAN)).toBe(true);
    expect(isOffWindow(food({ slot: 'meal1', time: '12:30' }), DEFAULT_MEAL_PLAN)).toBe(false);
    expect(isOffWindow(food({ slot: 'meal1', time: '09:59' }), DEFAULT_MEAL_PLAN)).toBe(true);
    expect(isOffWindow(food({ slot: 'meal3', time: '09:00' }), DEFAULT_MEAL_PLAN)).toBe(false);
    expect(isOffWindow(food({ slot: 'extra', time: '09:00' }), DEFAULT_MEAL_PLAN)).toBe(false);
  });
});

describe('5.1 Workout score', () => {
  it('Full at >= 30 minutes total', () => {
    expect(scoreWorkout([workout({ minutes: 30 })], 30)).toBe(1);
    expect(scoreWorkout([workout({ minutes: 15 }), workout({ minutes: 15 })], 30)).toBe(1);
  });
  it('Minimum at 10 to 29 minutes', () => {
    expect(scoreWorkout([workout({ minutes: 10 })], 30)).toBe(0.5);
    expect(scoreWorkout([workout({ minutes: 29 })], 30)).toBe(0.5);
  });
  it('Miss under 10 minutes', () => {
    expect(scoreWorkout([workout({ minutes: 9 })], 30)).toBe(0);
    expect(scoreWorkout([], 30)).toBe(0);
  });
});

describe('5.1 Learning score', () => {
  it('Full with at least minEntries, Miss otherwise', () => {
    expect(scoreLearning([learning()], 1)).toBe(1);
    expect(scoreLearning([], 1)).toBe(0);
    expect(scoreLearning([learning()], 2)).toBe(0);
  });
});

describe('5.1 Finance score', () => {
  it('Full when expenses logged with no regret, or no-spend set', () => {
    expect(scoreFinance([expense()], false)).toBe(1);
    expect(scoreFinance([], true)).toBe(1);
  });
  it('Minimum when any expense is tagged regret', () => {
    expect(scoreFinance([expense(), expense({ tag: 'regret' })], false)).toBe(0.5);
  });
  it('Miss when nothing logged and no-spend not set', () => {
    expect(scoreFinance([], false)).toBe(0);
  });
});

describe('scoreDay', () => {
  it('scores all four and detects a perfect day', () => {
    const s = scoreDay(entries({ food: planDay(), workout: [workout()], learning: [learning()], expense: [expense()] }), false, settings());
    expect(s).toEqual({ food: 1, workout: 1, learning: 1, finance: 1 });
    expect(isPerfect(s)).toBe(true);
  });
  it('ignores a stale no-spend flag when expenses exist', () => {
    expect(scoreDay(entries({ expense: [expense({ tag: 'regret' })] }), true, settings()).finance).toBe(0.5);
  });
});

describe('plannedNutrition', () => {
  it('sums protein and kcal for meals logged as planned only', () => {
    const f = [food({ slot: 'meal1', asPlanned: true }), food({ slot: 'meal2', asPlanned: true }), food({ slot: 'meal3' })];
    expect(plannedNutrition(f, DEFAULT_MEAL_PLAN)).toEqual({ protein: 114, kcal: 1410, targetProtein: 156, targetKcal: 1735 });
  });
});
