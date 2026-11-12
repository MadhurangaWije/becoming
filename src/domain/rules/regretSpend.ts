import { formatMoney, result } from './helpers';
import type { Rule } from './types';

export const regretSpend: Rule = {
  id: 'regret-spend',
  trigger: 'onLog',
  evaluate(ctx) {
    const ev = ctx.event;
    if (!ev || ev.discipline !== 'finance' || ev.entry.tag !== 'regret') return null;
    return result('regret-spend', 'nudge', { amount: formatMoney(ev.entry.amount, ctx.settings.currency), category: ev.entry.category }, 'finance');
  },
};
