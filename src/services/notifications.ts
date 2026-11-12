// Delivery of reminders is hidden behind scheduleReminder / cancelReminder so Web Push
// can replace it later (section 10). v1: local notifications while the app is open or
// recently backgrounded; in-app rules cover the rest.

const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function permission(): NotificationPermission | 'unsupported' {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}

export async function requestPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

async function show(title: string, body: string, tag: string) {
  if (permission() !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, tag, icon: '/icon-192.png', badge: '/icon-192.png' });
    else new Notification(title, { body, tag });
  } catch {
    /* ignore */
  }
}

/** Fires at the next occurrence of `time` ('HH:mm') while the page stays alive. */
export function scheduleReminder(id: string, time: string, title: string, body: string, nowFn: () => Date = () => new Date()) {
  cancelReminder(id);
  const [h, m] = time.split(':').map(Number);
  const n = nowFn();
  const at = new Date(n);
  at.setHours(h, m, 0, 0);
  if (at <= n) at.setDate(at.getDate() + 1);
  const ms = at.getTime() - n.getTime();
  if (ms > 2 ** 31 - 1) return;
  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id);
      void show(title, body, id);
      scheduleReminder(id, time, title, body, nowFn);
    }, ms),
  );
}

export function cancelReminder(id: string) {
  const t = timers.get(id);
  if (t) clearTimeout(t);
  timers.delete(id);
}

export function scheduleDailyReminders(times: { midday?: string; evening: string }, name: string) {
  if (times.midday) scheduleReminder('midday', times.midday, 'Becoming', `Midday check, ${name || 'you'}. Anything to log?`);
  else cancelReminder('midday');
  scheduleReminder('evening', times.evening, 'Becoming', 'Evening check. Close out today before it closes on you.');
}
