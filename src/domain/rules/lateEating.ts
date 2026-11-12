import { isLate } from '../scoring';
import { lastDays, result } from './helpers';
import type { Rule } from './types';

export const lateEating: Rule = {
  id: 'late-eating',
  trigger: 'onLog',
  evaluate(ctx) {
    const ev = ctx.event;
    if (!ev || ev.discipline !== 'food') return null;
    const goals = ctx.settings.goals.food;
    const close = ctx.settings.dayCloseHour;
    if (!isLate(ev.entry, goals, close)) return null;
    const days = new Set(lastDays(ctx, 7));
    const lateDays = new Set(ctx.entries.food.filter((e) => days.has(e.day) && isLate(e, goals, close)).map((e) => e.day));
    lateDays.add(ev.entry.day);
    const cutoff = ev.entry.slot === 'meal3' ? goals.postWorkoutMealCutoff : goals.eatingCutoff;
    return result('late-eating', lateDays.size >= 3 ? 'warning' : 'nudge', { time: ev.entry.time, cutoff, count: lateDays.size }, 'food');
  },
};
