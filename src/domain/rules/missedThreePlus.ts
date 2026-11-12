import { addDays } from '../dates';
import { DISCIPLINES } from '../types';
import { consecutiveMisses, decayLost, result } from './helpers';
import type { Rule, RuleResult } from './types';

export const missedThreePlus: Rule = {
  id: 'missed-three-plus',
  trigger: 'onDayClose',
  evaluate(ctx) {
    const out: RuleResult[] = [];
    for (const d of DISCIPLINES) {
      const n = consecutiveMisses(ctx, d);
      if (n >= 3) out.push(result('missed-three-plus', 'intervention', { count: n, xpLost: decayLost(ctx, d, addDays(ctx.today, -(n - 1))) }, d));
    }
    return out;
  },
};
