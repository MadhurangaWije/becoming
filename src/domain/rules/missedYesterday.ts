import { addDays } from '../dates';
import { DISCIPLINES } from '../types';
import { recordOn, result } from './helpers';
import type { Rule, RuleResult } from './types';

export const missedYesterday: Rule = {
  id: 'missed-yesterday',
  trigger: 'onDayClose',
  evaluate(ctx) {
    const day = recordOn(ctx, ctx.today);
    const before = recordOn(ctx, addDays(ctx.today, -1));
    if (!day || !before) return null;
    const out: RuleResult[] = [];
    for (const d of DISCIPLINES) if (day.scores[d] === 0 && before.scores[d] > 0) out.push(result('missed-yesterday', 'nudge', {}, d));
    return out;
  },
};
