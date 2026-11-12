import { isOffWindow } from '../scoring';
import { foodOn, lastDays, result } from './helpers';
import type { Rule } from './types';

export const mealOffWindow: Rule = {
  id: 'meal-off-window',
  trigger: 'onDayClose',
  evaluate(ctx) {
    const plan = ctx.settings.goals.food.mealPlan;
    const n = lastDays(ctx, 7).filter((d) => foodOn(ctx, d).some((e) => isOffWindow(e, plan))).length;
    if (n < 3) return null;
    const m1 = plan.find((m) => m.key === 'meal1');
    return result('meal-off-window', 'nudge', { count: n, window: m1 ? `${m1.windowStart} to ${m1.windowEnd}` : '' }, 'food');
  },
};
