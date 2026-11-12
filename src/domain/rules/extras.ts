// Rules beyond the 6.2/6.3 tables that other sections of the spec call for.
import { config } from '../config';
import { result } from './helpers';
import type { Rule } from './types';

/** 4.2: reaching each 100 consecutive plan days. */
export const planHundred: Rule = {
  id: 'plan-hundred',
  trigger: 'onDayClose',
  evaluate(ctx) {
    const n = ctx.dayClose?.planHundred;
    return n ? result('plan-hundred', 'praise', { count: n, next: n + 100 }, 'food') : null;
  },
};

/** 8: backup older than 30 days. */
export const backupStale: Rule = {
  id: 'backup-stale',
  trigger: 'onOpen',
  evaluate(ctx) {
    const since = ctx.meta?.lastExportedAt ?? ctx.settings.onboardedAt;
    if (!since) return null;
    const days = Math.floor((ctx.now.getTime() - new Date(since).getTime()) / 86400000);
    if (days < config.companion.backupNudgeDays) return null;
    return result('backup-stale', 'nudge', { days, never: ctx.meta?.lastExportedAt ? 0 : 1 });
  },
};

/** 5.6 step 4: a single message after a long absence. */
export const welcomeBack: Rule = {
  id: 'welcome-back',
  trigger: 'onOpen',
  evaluate(ctx) {
    const days = ctx.meta?.welcomeBackDays;
    return days ? result('welcome-back', 'praise', { days }) : null;
  },
};
