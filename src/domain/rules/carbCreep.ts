import { foodOn, lastDays, result } from './helpers';
import type { Rule } from './types';

export const carbCreep: Rule = {
  id: 'carb-creep',
  trigger: 'onDayClose',
  evaluate(ctx) {
    const n = lastDays(ctx, 5).filter((d) => foodOn(ctx, d).some((e) => e.carbs === 'high')).length;
    return n >= 3 ? result('carb-creep', 'warning', { count: n }, 'food') : null;
  },
};
