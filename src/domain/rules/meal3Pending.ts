import { config } from '../config';
import { hhmm, logicalMinutes, toMinutes } from '../dates';
import { foodOn, result, workoutOn } from './helpers';
import type { Rule } from './types';

export const meal3Pending: Rule = {
  id: 'meal3-pending',
  trigger: ['onLog', 'onOpen'],
  evaluate(ctx) {
    if (ctx.event && ctx.event.discipline !== 'workout') return null;
    const workouts = workoutOn(ctx, ctx.today);
    if (!workouts.length) return null;
    if (foodOn(ctx, ctx.today).some((e) => e.slot === 'meal3')) return null;
    const close = ctx.settings.dayCloseHour;
    const now = logicalMinutes(hhmm(ctx.now), close);
    const lastWorkout = Math.max(...workouts.map((w) => (w.time ? logicalMinutes(w.time, close) : 0)));
    const due = now - lastWorkout >= config.companion.meal3PendingMinutes || now >= toMinutes(ctx.settings.goals.food.eatingCutoff);
    if (!due) return null;
    const m3 = ctx.settings.goals.food.mealPlan.find((m) => m.key === 'meal3');
    return result('meal3-pending', 'nudge', { meal3Plan: m3?.plan ?? 'your post-workout meal', cutoff: ctx.settings.goals.food.postWorkoutMealCutoff }, 'food');
  },
};
