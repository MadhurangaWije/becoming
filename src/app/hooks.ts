import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { logicalToday } from '@/domain/dates';
import { db } from '@/data/db';
import { now } from '@/services/clock';
import { refreshAppBadge, runTrigger } from '@/services/companion';
import { runDayClose } from '@/services/dayClose';
import { scheduleDailyReminders } from '@/services/notifications';
import { loadTodayView } from '@/services/snapshot';
import { useUi } from './uiStore';

/** Settings row, live. `undefined` while loading, `null` when not onboarded. */
export function useSettings() {
  return useLiveQuery(async () => (await db.settings.get('me')) ?? null, []);
}

export function useTodayView() {
  const tick = useUi((s) => s.tick);
  return useLiveQuery(() => loadTodayView(now()), [tick]);
}

/** On open and every resume: close past days, then run onOpen rules. Also keeps "today" fresh. */
export function useAppLifecycle(onboarded: boolean) {
  const celebrate = useUi((s) => s.celebrate);
  const bump = useUi((s) => s.bump);

  useEffect(() => {
    if (!onboarded) return;
    let lastDay = '';
    let busy = false;

    const run = async () => {
      if (busy) return;
      busy = true;
      try {
        const t = now();
        const report = await runDayClose(t);
        if (report.celebrations.length) celebrate(report.celebrations);
        const settings = await db.settings.get('me');
        if (!settings) return;
        await runTrigger('onOpen', { now: t, today: logicalToday(t, settings.dayCloseHour), provisional: true }, settings);
        scheduleDailyReminders(settings.reminderTimes, settings.name);
        await refreshAppBadge();
        lastDay = logicalToday(t, settings.dayCloseHour);
      } catch (e) {
        console.error('[Becoming] lifecycle', e);
      } finally {
        busy = false;
      }
    };

    void run();
    const onVisible = () => document.visibilityState === 'visible' && void run();
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(async () => {
      bump(); // refresh time-dependent views (meal 3 prompts, evening rules)
      const settings = await db.settings.get('me');
      if (settings && logicalToday(now(), settings.dayCloseHour) !== lastDay) void run();
    }, 60000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, [onboarded, celebrate, bump]);
}
