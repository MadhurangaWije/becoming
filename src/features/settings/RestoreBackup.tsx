import { Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { BackupError, importAll, readBackupFile, summarize, type BackupFile } from '@/data/backup';

/** Pick a backup file, show what is in it, confirm, then replace all data. Used in Settings and onboarding. */
export function RestoreBackup({ label = 'Import backup', replacing, onRestored }: { label?: string; replacing: boolean; onRestored?: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      setPending(await readBackupFile(f));
      setMsg('');
    } catch (e) {
      setMsg(e instanceof BackupError ? e.message : 'Could not read that file.');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const restore = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await importAll(pending);
      try {
        await navigator.storage?.persist?.();
      } catch {
        /* unsupported */
      }
      setPending(null);
      setMsg('Backup restored.');
      onRestored?.();
    } catch {
      setMsg('Restore failed. Your existing data was not changed.');
    } finally {
      setBusy(false);
    }
  };

  const s = pending && summarize(pending);
  return (
    <div className="space-y-3">
      <Button variant="secondary" onClick={() => fileRef.current?.click()}>
        <Upload size={18} aria-hidden /> {label}
      </Button>
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Backup file" data-testid="backup-file" />
      {pending && s && (
        <div role="alertdialog" aria-label="Confirm restore" className={`space-y-3 rounded-xl border p-3 ${replacing ? 'border-amber/40 bg-amber-soft' : 'border-blue/30 bg-blue-soft'}`}>
          <p>
            Backup from {new Date(s.exportedAt).toLocaleString('en-GB')}: <span className="tabular font-semibold">{s.entries}</span> entries, <span className="tabular font-semibold">{s.days}</span> days, <span className="tabular font-semibold">{s.badges}</span> badges.
          </p>
          {replacing && <p className="text-[15px]">This replaces all data on this device. It cannot be undone.</p>}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button variant={replacing ? 'danger' : 'primary'} disabled={busy} onClick={restore}>
              {replacing ? 'Replace my data' : 'Restore'}
            </Button>
          </div>
        </div>
      )}
      {msg && (
        <p role="status" className="text-[15px]">
          {msg}
        </p>
      )}
    </div>
  );
}
