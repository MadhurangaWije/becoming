import { db, TABLES, type TableName } from './db';

// Backup file format. Documented in docs/backup-format.md: it doubles as the
// migration contract for moving to a new device or to a future backend.

export const BACKUP_FORMAT = 'becoming-backup';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  app?: { name: string; schemaVersion: number };
  counts?: Partial<Record<TableName, number>>;
  tables: Record<TableName, unknown[]>;
}

export async function exportAll(exportedAt: string): Promise<BackupFile> {
  const tables = {} as Record<TableName, unknown[]>;
  await db.transaction('r', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) tables[t] = await db.table(t).toArray();
  });
  const counts = Object.fromEntries(TABLES.map((t) => [t, tables[t].length])) as Record<TableName, number>;
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt, app: { name: 'Becoming', schemaVersion: db.verno }, counts, tables };
}

export class BackupError extends Error {}

/**
 * Upgrades an older backup to the current version, one step at a time.
 * Add a step here whenever BACKUP_VERSION is bumped, so old files always import.
 */
const MIGRATIONS: Record<number, (f: BackupFile) => BackupFile> = {
  // 1: (f) => ({ ...f, version: 2, tables: { ...f.tables, newTable: [] } }),
};

export function migrateBackup(file: BackupFile): BackupFile {
  let f = file;
  while (f.version < BACKUP_VERSION) {
    const step = MIGRATIONS[f.version];
    if (!step) throw new BackupError(`No upgrade path from backup version ${f.version}.`);
    f = step(f);
  }
  return f;
}

export function validateBackup(data: unknown): BackupFile {
  if (!data || typeof data !== 'object') throw new BackupError('This file is not a Becoming backup.');
  const f = data as Partial<BackupFile>;
  if (f.format !== BACKUP_FORMAT) throw new BackupError('This file is not a Becoming backup.');
  if (typeof f.version !== 'number' || f.version < 1 || f.version > BACKUP_VERSION) {
    throw new BackupError(`Unsupported backup version ${f.version}. This app reads versions 1 to ${BACKUP_VERSION}. Update the app and try again.`);
  }
  if (!f.tables || typeof f.tables !== 'object') throw new BackupError('Backup has no tables.');
  for (const t of TABLES) {
    if (f.tables[t] !== undefined && !Array.isArray(f.tables[t])) throw new BackupError(`Table ${t} is malformed.`);
  }
  const settings = (f.tables.settings ?? []) as { id?: string }[];
  if (!settings.some((s) => s.id === 'me')) throw new BackupError('Backup has no settings. It may be incomplete.');
  if (f.counts) {
    for (const t of TABLES) {
      const expected = f.counts[t];
      if (expected !== undefined && (f.tables[t]?.length ?? 0) !== expected) throw new BackupError(`Backup looks truncated: ${t} has ${f.tables[t]?.length ?? 0} of ${expected} records.`);
    }
  }
  return migrateBackup(f as BackupFile);
}

function readText(file: Blob): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

/** Parses and validates a user-picked file. */
export async function readBackupFile(file: Blob): Promise<BackupFile> {
  let data: unknown;
  try {
    data = JSON.parse(await readText(file));
  } catch {
    throw new BackupError('Could not read that file. Pick the .json file you exported.');
  }
  return validateBackup(data);
}

/** Replaces all data with the backup's contents (caller confirms first). */
export async function importAll(file: BackupFile) {
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear();
      const rows = file.tables[t] ?? [];
      if (rows.length) await db.table(t).bulkAdd(rows);
    }
  });
}

export async function clearAll() {
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) await db.table(t).clear();
  });
}

export function summarize(file: BackupFile) {
  const n = (t: TableName) => file.tables[t]?.length ?? 0;
  const entries = n('food') + n('workout') + n('learning') + n('expense');
  const days = n('dayRecords');
  return { entries, days, badges: n('badges'), exportedAt: file.exportedAt };
}

export function backupFilename(exportedAt: string) {
  return `becoming-backup-${exportedAt.slice(0, 10)}.json`;
}

export type SaveOutcome = 'shared' | 'downloaded' | 'cancelled';

/**
 * On phones, opens the share sheet with the file (Save to Files, Drive, AirDrop, email),
 * which works inside installed iOS apps where downloads often do not.
 * Falls back to a normal download elsewhere.
 */
export async function saveBackup(data: BackupFile): Promise<SaveOutcome> {
  const json = JSON.stringify(data, null, 2);
  const filename = backupFilename(data.exportedAt);
  const file = typeof File !== 'undefined' ? new File([json], filename, { type: 'application/json' }) : null;
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  if (file && coarse && nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Becoming backup' });
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
      // fall through to download
    }
  }
  downloadJson(json, filename);
  return 'downloaded';
}

function downloadJson(json: string, filename: string) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
