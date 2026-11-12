import { foodOn, lastDays, recordOn, result } from './helpers';
import type { Rule } from './types';

export const lowVeggies: Rule = {
  id: 'low-veggies',
  trigger: 'onDayClose',
  evaluate(ctx) {
    const days = lastDays(ctx, 2);
    if (!days.every((d) => recordOn(ctx, d))) return null;
    if (days.some((d) => foodOn(ctx, d).some((e) => e.veggies))) return null;
    return result('low-veggies', 'nudge', {}, 'food');
  },
};
