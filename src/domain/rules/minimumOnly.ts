import { DISCIPLINES } from '../types';
import { lastDays, recordOn, result } from './helpers';
import type { Rule, RuleResult } from './types';

export const minimumOnly: Rule = {
  id: 'minimum-only',
  trigger: 'onDayClose',
  evaluate(ctx) {
    const days = lastDays(ctx, 5).map((d) => recordOn(ctx, d));
    if (days.some((r) => !r)) return null;
    const out: RuleResult[] = [];
    for (const d of DISCIPLINES) if (days.every((r) => r!.scores[d] === 0.5)) out.push(result('minimum-only', 'nudge', { count: 5 }, d));
    return out;
  },
};
