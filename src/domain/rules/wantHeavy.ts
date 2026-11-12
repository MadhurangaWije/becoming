import { formatMoney, lastDays, result } from './helpers';
import type { Rule } from './types';

export const wantHeavy: Rule = {
  id: 'want-heavy',
  trigger: 'onDayClose',
  evaluate(ctx) {
    const days = new Set(lastDays(ctx, 7));
    const week = ctx.entries.expense.filter((e) => days.has(e.day));
    const total = week.reduce((s, e) => s + e.amount, 0);
    if (total <= 0) return null;
    const wants = week.filter((e) => e.tag !== 'need').reduce((s, e) => s + e.amount, 0);
    if (wants / total <= 0.5) return null;
    return result('want-heavy', 'nudge', { pct: Math.round((wants / total) * 100), wants: formatMoney(wants, ctx.settings.currency) }, 'finance');
  },
};
