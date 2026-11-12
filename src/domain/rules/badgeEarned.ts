import { badgeById } from '../badges';
import { result } from './helpers';
import type { Rule } from './types';

export const badgeEarned: Rule = {
  id: 'badge-earned',
  trigger: 'onDayClose',
  evaluate(ctx) {
    if (!ctx.dayClose) return null;
    return ctx.dayClose.newBadges.map((id) => {
      const b = badgeById(id);
      return result('badge-earned', 'praise', { badge: b?.name ?? id, badgeId: id, badgeDescription: b?.description ?? '' });
    });
  },
};
