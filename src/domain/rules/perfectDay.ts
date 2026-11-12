import { isPerfect } from '../scoring';
import { result } from './helpers';
import type { Rule } from './types';

export const perfectDay: Rule = {
  id: 'perfect-day',
  trigger: 'onLog',
  evaluate(ctx) {
    if (!ctx.event || !isPerfect(ctx.todayScores)) return null;
    return result('perfect-day', 'praise', {});
  },
};
