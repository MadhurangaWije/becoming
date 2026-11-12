import { lastDays, recordOn, result, violationsOn } from './helpers';
import type { Rule } from './types';

export const offPlanDrift: Rule = {
  id: 'off-plan-drift',
  trigger: 'onDayClose',
  evaluate(ctx) {
    const days = lastDays(ctx, 3);
    if (!days.every((d) => recordOn(ctx, d))) return null;
    const counts = days.map((d) => violationsOn(ctx, d));
    const total = counts.reduce((a, b) => a + b, 0);
    if (!counts.every((c) => c > 0) && total < 4) return null;
    const meal1 = ctx.settings.goals.food.mealPlan.find((m) => m.key === 'meal1');
    return result('off-plan-drift', 'warning', { count: total, meal1Plan: meal1?.plan ?? 'Meal 1 as planned' }, 'food');
  },
};
