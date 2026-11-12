import { STAT_NAMES } from '../config';
import { addDays, weekStart } from '../dates';
import { DISCIPLINES } from '../types';
import { formatMoney, recordOn, result, workoutOn } from './helpers';
import type { Rule, RuleResult } from './types';

export const personalBest: Rule = {
  id: 'personal-best',
  trigger: ['onLog', 'onDayClose'],
  evaluate(ctx) {
    const out: RuleResult[] = [];
    if (ctx.event) {
      if (ctx.event.discipline !== 'workout' || !ctx.personalBests) return null;
      const total = workoutOn(ctx, ctx.today).reduce((s, w) => s + w.minutes, 0);
      const best = ctx.personalBests.longestWorkoutBefore;
      if (best > 0 && total > best) {
        out.push(result('personal-best', 'praise', { what: 'longest workout day', value: `${total} minutes`, previous: `${best} minutes` }, 'workout'));
      }
      return out;
    }
    if (!ctx.dayClose) return null;
    const rec = recordOn(ctx, ctx.today);
    for (const d of DISCIPLINES) {
      const prev = ctx.dayClose.longestBefore[d];
      const s = ctx.dayClose.streakAfter[d];
      if (rec && rec.scores[d] >= 0.5 && prev >= 3 && s === prev + 1) {
        out.push(result('personal-best', 'praise', { what: `longest ${STAT_NAMES[d]} streak`, value: `${s} days`, previous: `${prev} days` }, d));
      }
    }
    // Lowest-spend week, checked when the week's last day (Sunday) closes
    const start = weekStart(ctx.today);
    if (ctx.personalBests && addDays(start, 6) === ctx.today) {
      const spent = ctx.entries.expense.filter((e) => e.day >= start && e.day <= ctx.today).reduce((s, e) => s + e.amount, 0);
      const prev = ctx.personalBests.lowestWeekSpendBefore;
      if (prev !== null && spent < prev) {
        const cur = ctx.settings.currency;
        out.push(result('personal-best', 'praise', { what: 'lowest-spend week', value: formatMoney(spent, cur), previous: formatMoney(prev, cur) }, 'finance'));
      }
    }
    return out;
  },
};
