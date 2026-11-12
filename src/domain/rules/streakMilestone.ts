import { DISCIPLINES } from '../types';
import { recordOn, result } from './helpers';
import type { Rule, RuleResult } from './types';

export const MILESTONES = [3, 7, 14, 30, 60, 100];

export const streakMilestone: Rule = {
  id: 'streak-milestone',
  trigger: 'onDayClose',
  evaluate(ctx) {
    const rec = recordOn(ctx, ctx.today);
    if (!ctx.dayClose || !rec) return null;
    const out: RuleResult[] = [];
    for (const d of DISCIPLINES) {
      const s = ctx.dayClose.streakAfter[d];
      if (rec.scores[d] >= 0.5 && MILESTONES.includes(s)) out.push(result('streak-milestone', 'praise', { streak: s }, d));
    }
    return out;
  },
};
