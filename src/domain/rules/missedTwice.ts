import { addDays } from '../dates';
import { DISCIPLINES } from '../types';
import { consecutiveMisses, decayLost, result } from './helpers';
import type { Rule, RuleResult } from './types';

export const missedTwice: Rule = {
  id: 'missed-twice',
  trigger: 'onDayClose',
  evaluate(ctx) {
    const out: RuleResult[] = [];
    for (const d of DISCIPLINES) {
      if (consecutiveMisses(ctx, d) === 2) out.push(result('missed-twice', 'warning', { count: 2, xpLost: decayLost(ctx, d, addDays(ctx.today, -1)) }, d));
    }
    return out;
  },
};
