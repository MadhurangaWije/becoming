import { result } from './helpers';
import type { Rule } from './types';

export const goalMet: Rule = {
  id: 'goal-met',
  trigger: 'onLog',
  evaluate(ctx) {
    const d = ctx.event?.discipline;
    if (!d || ctx.todayScores[d] !== 1) return null;
    return result('goal-met', 'praise', {}, d);
  },
};
