import { foodOn, lastDays, result } from './helpers';
import type { Rule } from './types';

export const proteinGap: Rule = {
  id: 'protein-gap',
  trigger: 'onDayClose',
  evaluate(ctx) {
    const n = lastDays(ctx, 3).filter((d) => foodOn(ctx, d).some((e) => e.slot !== 'extra' && !e.protein)).length;
    return n >= 2 ? result('protein-gap', 'nudge', { count: n }, 'food') : null;
  },
};
