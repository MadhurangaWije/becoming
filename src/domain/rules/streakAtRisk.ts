import { DISCIPLINES } from '../types';
import { afterEvening, result } from './helpers';
import type { Rule, RuleResult } from './types';

export const streakAtRisk: Rule = {
  id: 'streak-at-risk',
  trigger: 'onOpen',
  evaluate(ctx) {
    if (!afterEvening(ctx)) return null;
    const out: RuleResult[] = [];
    for (const d of DISCIPLINES) {
      if (ctx.todayScores[d] >= 0.5) continue;
      const streak = ctx.stats[d].streak;
      if (streak >= 5) out.push(result('streak-at-risk', 'warning', { streak }, d));
    }
    return out;
  },
};
