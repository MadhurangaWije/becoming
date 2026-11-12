import type { Discipline } from '@/domain/types';
import { entriesRepo, daysRepo, type DraftOf, type EntryMap } from '@/data/repos';
import type { LogEvent } from '@/domain/rules/types';
import type { CompanionMessage } from '@/domain/types';
import { runTrigger } from './companion';
import { recloseIfClosed } from './dayClose';
import { now as clockNow } from './clock';
import { logicalToday } from '@/domain/dates';
import { settingsRepo } from '@/data/repos';

/** A draft entry from any source: the manual form today, a parser later. */
export type DraftEntry = { [D in Discipline]: { discipline: D; draft: DraftOf<D> } }[Discipline];

/** Seam for free-text logging (section 10). v1 ships only the manual form path. */
export interface EntryParser {
  parse(text: string, discipline?: Discipline): Promise<DraftEntry[]>;
}

export const manualParser: EntryParser = {
  async parse() {
    return []; // v1: no free-text parsing
  },
};

export interface SaveResult {
  saved: EntryMap[Discipline][];
  messages: CompanionMessage[];
}

/**
 * The single save funnel used by every log sheet (and later a parser).
 * Saves, clears no-spend on new expenses, re-closes edited closed days, and runs onLog rules.
 */
export async function saveEntries(drafts: DraftEntry[], at: Date = clockNow()): Promise<SaveResult> {
  const settings = await settingsRepo.get();
  const saved: EntryMap[Discipline][] = [];
  const messages: CompanionMessage[] = [];
  const touchedDays = new Set<string>();
  for (const d of drafts) {
    const entry = await entriesRepo.upsert(d.discipline, d.draft as never);
    saved.push(entry);
    touchedDays.add(entry.day);
    if (d.discipline === 'finance') {
      const rec = await daysRepo.get(entry.day);
      if (rec?.noSpendDay) await daysRepo.patch(entry.day, { noSpendDay: false });
    }
  }
  for (const day of touchedDays) await recloseIfClosed(day, at);
  if (settings?.onboardedAt) {
    const today = logicalToday(at, settings.dayCloseHour);
    for (let i = 0; i < drafts.length; i++) {
      const entry = saved[i];
      if (entry.day !== today) continue;
      const event = { discipline: drafts[i].discipline, entry } as LogEvent;
      messages.push(...(await runTrigger('onLog', { now: at, today, event, provisional: true }, settings)));
    }
  }
  return { saved, messages };
}

export async function deleteEntry(discipline: Discipline, id: string, at: Date = clockNow()) {
  const e = await entriesRepo.remove(discipline, id);
  if (e) await recloseIfClosed(e.day, at);
}

export async function setNoSpend(day: string, value: boolean, at: Date = clockNow()) {
  await daysRepo.patch(day, { noSpendDay: value });
  await recloseIfClosed(day, at);
}
