import { addDays, monthStart } from '../dates';
import { formatMoney, monthSpend, pace, result } from './helpers';
import type { Rule } from './types';

export const overPaceMonth: Rule = {
  id: 'over-pace-month',
  trigger: 'onDayClose',
  evaluate(ctx) {
    const budget = ctx.settings.monthlyBudget;
    const spent = monthSpend(ctx, ctx.today);
    const before = ctx.today === monthStart(ctx.today) ? 0 : monthSpend(ctx, addDays(ctx.today, -1));
    const p = pace(ctx, ctx.today);
    const crossed = [1, 0.8].find((t) => spent >= budget * t && before < budget * t);
    const overPace = spent > p * 1.1;
    if (!crossed && !overPace) return null;
    const cur = ctx.settings.currency;
    return result(
      'over-pace-month',
      'warning',
      {
        spent: formatMoney(spent, cur),
        budget: formatMoney(budget, cur),
        pace: formatMoney(p, cur),
        pct: Math.round((spent / budget) * 100),
        kind: crossed ? 'crossed' : 'pace',
      },
      'finance',
    );
  },
};
