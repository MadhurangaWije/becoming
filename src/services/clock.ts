import { logicalToday } from '@/domain/dates';

// The single place the app reads the wall clock. Dev builds can override it from the debug panel.
const KEY = 'becoming.clockOffsetMs';

function offset(): number {
  if (!import.meta.env.DEV) return 0;
  try {
    return Number(localStorage.getItem(KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

export function now(): Date {
  return new Date(Date.now() + offset());
}

export function setDebugNow(target: Date | null) {
  try {
    if (!target) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, String(target.getTime() - Date.now()));
  } catch {
    /* storage unavailable */
  }
}

export function isClockOverridden() {
  return offset() !== 0;
}

export function today(dayCloseHour: number) {
  return logicalToday(now(), dayCloseHour);
}

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try {
      return crypto.randomUUID();
    } catch {
      /* insecure context */
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const stamp = () => now().toISOString();
