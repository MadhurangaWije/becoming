import { WEEKDAYS, addDays, weekdayIndex } from '../dates';
import type { DayRecord } from '../types';
import { DISCIPLINES } from '../types';
import { recordOn, result } from './helpers';
import type { Rule } from './types';

export const weakWeekday: Rule = {
  id: 'weak-weekday',
  trigger: 'onWeekClose',
  evaluate(ctx) {
    const end = ctx.week?.end ?? ctx.today;
    const records = Array.from({ length: 28 }, (_, i) => recordOn(ctx, addDays(end, -i))).filter((r): r is DayRecord => !!r);
    if (records.length < 14) return null;
    for (const d of DISCIPLINES) {
      const overall = records.reduce((s, r) => s + r.scores[d], 0) / records.length;
      if (overall < 0.7) continue;
      for (let w = 0; w < 7; w++) {
        const onDay = records.filter((r) => weekdayIndex(r.day) === w);
        if (onDay.length < 2) continue;
        const avg = onDay.reduce((s, r) => s + r.scores[d], 0) / onDay.length;
        if (avg <= 0.4) return result('weak-weekday', 'nudge', { weekday: WEEKDAYS[w], weekdayAvg: Math.round(avg * 100), overallAvg: Math.round(overall * 100) }, d);
      }
    }
    return null;
  },
};
