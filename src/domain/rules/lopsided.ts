import { STAT_NAMES } from '../config';
import { DISCIPLINES } from '../types';
import { result } from './helpers';
import type { Rule } from './types';

export const lopsided: Rule = {
  id: 'lopsided',
  trigger: 'onWeekClose',
  evaluate(ctx) {
    const levels = DISCIPLINES.map((d) => ctx.stats[d].level);
    const max = Math.max(...levels);
    const min = Math.min(...levels);
    if (max - min >= 3) {
      const weak = DISCIPLINES[levels.indexOf(min)];
      const strong = DISCIPLINES[levels.indexOf(max)];
      return result('lopsided', 'nudge', { gap: max - min, strongStat: STAT_NAMES[strong], weakLevel: min, strongLevel: max, kind: 'levels' }, weak);
    }
    if (!ctx.week) return null;
    const { start, end } = ctx.week;
    const earned = Object.fromEntries(
      DISCIPLINES.map((d) => [d, ctx.xpEvents.filter((e) => e.discipline === d && e.day >= start && e.day <= end && e.amount > 0).reduce((s, e) => s + e.amount, 0)]),
    ) as Record<string, number>;
    const avg = DISCIPLINES.reduce((s, d) => s + earned[d], 0) / 4;
    if (avg <= 0) return null;
    const weak = DISCIPLINES.find((d) => earned[d] < avg / 2);
    if (!weak) return null;
    return result('lopsided', 'nudge', { earned: earned[weak], avg: Math.round(avg), kind: 'week' }, weak);
  },
};
