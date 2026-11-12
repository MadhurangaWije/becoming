import { config } from '../config';
import { DISCIPLINES } from '../types';
import { recordOn, result } from './helpers';
import type { Rule, RuleResult } from './types';

export const comeback: Rule = {
  id: 'comeback',
  trigger: 'onDayClose',
  evaluate(ctx) {
    const rec = recordOn(ctx, ctx.today);
    if (!ctx.dayClose || !rec) return null;
    const out: RuleResult[] = [];
    for (const d of DISCIPLINES) {
      const missed = ctx.dayClose.missesBefore[d];
      if (rec.scores[d] === 1 && missed >= config.xp.comebackMinMisses) out.push(result('comeback', 'praise', { missed }, d));
    }
    return out;
  },
};
