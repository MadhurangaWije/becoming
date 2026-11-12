import { useLiveQuery } from 'dexie-react-hooks';
import { AlertOctagon, AlertTriangle, Info, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSettings } from '@/app/hooks';
import { DisciplineIcon } from '@/components/discipline';
import { Empty, Segmented } from '@/components/ui';
import { parseDay } from '@/domain/dates';
import type { Severity } from '@/domain/types';
import { messagesRepo } from '@/data/repos';
import { refreshAppBadge } from '@/services/companion';

const SEV: Record<Severity, { Icon: typeof Info; cls: string; label: string }> = {
  praise: { Icon: Sparkles, cls: 'bg-green-soft text-green-strong', label: 'Praise' },
  nudge: { Icon: Info, cls: 'bg-blue-soft text-blue', label: 'Nudge' },
  warning: { Icon: AlertTriangle, cls: 'bg-amber-soft text-amber', label: 'Warning' },
  intervention: { Icon: AlertOctagon, cls: 'bg-red-soft text-red', label: 'Check-in' },
};

export function CoachScreen() {
  const settings = useSettings();
  const [filter, setFilter] = useState<'all' | Severity>('all');
  const messages = useLiveQuery(() => messagesRepo.all(), []);

  useEffect(() => {
    const t = setTimeout(() => messagesRepo.markAllRead().then(refreshAppBadge), 800);
    return () => clearTimeout(t);
  }, []);

  const shown = (messages ?? []).filter((m) => filter === 'all' || m.severity === filter);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-title">Coach</h1>
        <p className="text-caption text-muted">Future {settings?.name}, talking to you.</p>
      </header>
      <Segmented
        label="Filter by severity"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'All' },
          { value: 'praise', label: 'Praise' },
          { value: 'nudge', label: 'Nudges' },
          { value: 'warning', label: 'Warnings' },
          { value: 'intervention', label: 'Check-ins' },
        ]}
      />
      {!shown.length ? (
        <Empty>No messages yet. Log something today and your future self will have something to say.</Empty>
      ) : (
        <ul className="space-y-3">
          {shown.map((m) => {
            const s = SEV[m.severity];
            return (
              <li key={m.id} className="rounded-card border border-border p-3">
                <div className="mb-1 flex items-center gap-2 text-caption">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${s.cls}`}>
                    <s.Icon size={14} aria-hidden /> {s.label}
                  </span>
                  {m.discipline && <DisciplineIcon d={m.discipline} size={16} />}
                  <span className="ml-auto text-muted">{parseDay(m.day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                  {!m.readAt && <span className="h-2 w-2 rounded-full bg-red" aria-label="Unread" />}
                </div>
                <p>{m.text}</p>
                {m.response && (
                  <p className="mt-2 rounded-xl bg-surface px-3 py-2 text-[15px]">
                    <span className="text-muted">You said: </span>
                    {m.response}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
