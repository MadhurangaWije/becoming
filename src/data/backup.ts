import { db, TABLES, type TableName } from './db';

export const BACKUP_FORMAT = 'becoming-backup';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  tables: Record<TableName, unknown[]>;
}

export async function exportAll(exportedAt: string): Promise<BackupFile> {
  const tables = {} as Record<TableName, unknown[]>;
  await db.transaction('r', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) tables[t] = await db.table(t).toArray();
  });
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt, tables };
}

export class BackupError extends Error {}

export function validateBackup(data: unknown): BackupFile {
  if (!data || typeof data !== 'object') throw new BackupError('This file is not a Becoming backup.');
  const f = data as Partial<BackupFile>;
  if (f.format !== BACKUP_FORMAT) throw new BackupError('This file is not a Becoming backup.');
  if (typeof f.version !== 'number' || f.version > BACKUP_VERSION) throw new BackupError(`Unsupported backup version ${f.version}. This app reads version ${BACKUP_VERSION} or older.`);
  if (!f.tables || typeof f.tables !== 'object') throw new BackupError('Backup has no tables.');
  for (const t of TABLES) {
    if (f.tables[t] !== undefined && !Array.isArray(f.tables[t])) throw new BackupError(`Table ${t} is malformed.`);
  }
  return f as BackupFile;
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

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
