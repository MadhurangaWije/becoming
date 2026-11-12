import { STAT_NAMES } from '../config';
import { titleFor } from '../xp';
import { result } from './helpers';
import type { Rule } from './types';

export const levelUp: Rule = {
  id: 'level-up',
  trigger: 'onDayClose',
  evaluate(ctx) {
    if (!ctx.dayClose) return null;
    return ctx.dayClose.levelUps.map((u) =>
      u.discipline === 'overall'
        ? { ...result('level-up', 'praise', { stat: 'Your overall level', level: u.level, title: titleFor(u.level) }), discipline: undefined }
        : result('level-up', 'praise', { level: u.level, stat: STAT_NAMES[u.discipline] }, u.discipline),
    );
  },
};
