import { DISCIPLINE_LABELS } from '../config';
import { DISCIPLINES } from '../types';
import { afterEvening, hasEntryToday, result } from './helpers';
import type { Rule } from './types';

export const notLoggedToday: Rule = {
  id: 'not-logged-today',
  trigger: 'onOpen',
  evaluate(ctx) {
    if (!afterEvening(ctx)) return null;
    const missing = DISCIPLINES.filter((d) => !hasEntryToday(ctx, d));
    if (!missing.length) return null;
    const list = missing.map((d) => DISCIPLINE_LABELS[d].toLowerCase());
    const joined = list.length === 1 ? list[0] : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
    return result('not-logged-today', 'nudge', { list: joined, count: missing.length });
  },
};
