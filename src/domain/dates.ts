import type { DayKey } from './types';

// Small pure date helpers working on local-time 'YYYY-MM-DD' keys.

const pad = (n: number) => String(n).padStart(2, '0');

export function toDayKey(d: Date): DayKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDay(day: DayKey): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(day: DayKey, n: number): DayKey {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return toDayKey(d);
}

/** Whole days from a to b (b - a). */
export function diffDays(a: DayKey, b: DayKey): number {
  const ms = parseDay(b).getTime() - parseDay(a).getTime();
  return Math.round(ms / 86400000);
}

/** The logical "today": before dayCloseHour, the previous calendar day. */
export function logicalToday(now: Date, dayCloseHour: number): DayKey {
  const d = new Date(now);
  if (d.getHours() < dayCloseHour) d.setDate(d.getDate() - 1);
  return toDayKey(d);
}

export function dayRange(from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function hhmm(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * Minutes since the start of the logical day. Times before dayCloseHour
 * belong to the night after the calendar day, so they sort after 23:59.
 */
export function logicalMinutes(time: string, dayCloseHour: number): number {
  const m = toMinutes(time);
  return m < dayCloseHour * 60 ? m + 24 * 60 : m;
}

/** Monday-based week start. */
export function weekStart(day: DayKey): DayKey {
  const d = parseDay(day);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  return addDays(day, -dow);
}

/** 0 = Monday ... 6 = Sunday */
export function weekdayIndex(day: DayKey): number {
  return (parseDay(day).getDay() + 6) % 7;
}

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function monthStart(day: DayKey): DayKey {
  return day.slice(0, 8) + '01';
}

export function daysInMonth(day: DayKey): number {
  const d = parseDay(day);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export function dayOfMonth(day: DayKey): number {
  return Number(day.slice(8, 10));
}

/** End of the logical day as a Date (the moment the day closes). */
export function endOfLogicalDay(day: DayKey, dayCloseHour: number): Date {
  const d = parseDay(addDays(day, 1));
  d.setHours(dayCloseHour, 0, 0, 0);
  return d;
}
