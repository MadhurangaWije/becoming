import { useLiveQuery } from 'dexie-react-hooks';
import { Pencil, Trash2 } from 'lucide-react';
import { useSettings } from '@/app/hooks';
import { useUi } from '@/app/uiStore';
import { Sheet } from '@/components/Sheet';
import { label } from '@/components/discipline';
import { Segmented, money } from '@/components/ui';
import { config } from '@/domain/config';
import { addDays, logicalToday, parseDay } from '@/domain/dates';
import type { DayKey, Discipline } from '@/domain/types';
import { tableFor, type AnyEntry } from '@/data/repos';
import { now } from '@/services/clock';
import { deleteEntry } from '@/services/parser';
import { FinanceForm } from './FinanceForm';
import { FoodForm } from './FoodForm';
import { LearningForm } from './LearningForm';
import { WorkoutForm } from './WorkoutForm';

export function LogSheet() {
  const sheet = useUi((s) => s.sheet);
  const close = useUi((s) => s.closeSheet);
  const open = useUi((s) => s.openSheet);
  const settings = useSettings();
  if (!settings) return null;
  const today = logicalToday(now(), settings.dayCloseHour);
  const day = sheet?.day ?? today;
  const d = sheet?.discipline;

  return (
    <Sheet open={!!sheet} onClose={close} title={d ? `Log ${label(d).toLowerCase()}` : ''}>
      {d && (
        <div className="space-y-4">
          <DateSwitcher today={today} day={day} onChange={(nd) => open(d, nd)} />
          <EntryList key={`${d}-${day}`} d={d} day={day} editId={sheet?.editId} onEdit={(id) => open(d, day, id)} currency={settings.currency} />
          {d === 'food' && <FoodForm key={`${day}-${sheet?.editId}`} day={day} today={today} editId={sheet?.editId} settings={settings} onSaved={close} />}
          {d === 'workout' && <WorkoutForm key={`${day}-${sheet?.editId}`} day={day} editId={sheet?.editId} settings={settings} onSaved={close} />}
          {d === 'learning' && <LearningForm key={`${day}-${sheet?.editId}`} day={day} editId={sheet?.editId} onSaved={close} />}
          {d === 'finance' && <FinanceForm key={`${day}-${sheet?.editId}`} day={day} editId={sheet?.editId} settings={settings} onSaved={close} />}
        </div>
      )}
    </Sheet>
  );
}

/** Today and the previous 2 days only. */
function DateSwitcher({ today, day, onChange }: { today: DayKey; day: DayKey; onChange: (d: DayKey) => void }) {
  const opts = Array.from({ length: config.editWindowDays + 1 }, (_, i) => addDays(today, -i));
  const name = (d: DayKey, i: number) => (i === 0 ? 'Today' : i === 1 ? 'Yesterday' : parseDay(d).toLocaleDateString('en-GB', { weekday: 'short' }));
  return <Segmented label="Day" value={day} onChange={onChange} options={opts.map((d, i) => ({ value: d, label: name(d, i) }))} />;
}

function describe(d: Discipline, e: AnyEntry, currency: string): string {
  switch (d) {
    case 'food': {
      const f = e as import('@/domain/types').FoodEntry;
      return `${f.time} · ${f.slot === 'extra' ? 'Extra' : f.slot.replace('meal', 'Meal ')} · ${f.description}`;
    }
    case 'workout': {
      const w = e as import('@/domain/types').WorkoutEntry;
      return `${w.minutes} min ${w.kind}, ${w.intensity}${w.notes ? ` · ${w.notes}` : ''}`;
    }
    case 'learning': {
      const l = e as import('@/domain/types').LearningEntry;
      return `${l.summary}${l.topic ? ` · ${l.topic}` : ''}`;
    }
    case 'finance': {
      const x = e as import('@/domain/types').ExpenseEntry;
      return `${money(x.amount, currency)} · ${x.category} · ${x.tag}`;
    }
  }
}

function EntryList({ d, day, editId, onEdit, currency }: { d: Discipline; day: DayKey; editId?: string; onEdit: (id: string) => void; currency: string }) {
  const entries = useLiveQuery(() => (tableFor(d).where('day').equals(day).toArray() as Promise<AnyEntry[]>).then((a) => a.sort((x, y) => x.createdAt.localeCompare(y.createdAt))), [d, day]);
  if (!entries?.length) return null;
  return (
    <ul className="divide-y divide-border rounded-card border border-border" aria-label="Logged entries">
      {entries.map((e) => (
        <li key={e.id} className={`flex items-center gap-2 py-1 pl-3 pr-1 ${editId === e.id ? 'bg-blue-soft' : ''}`}>
          <span className="min-w-0 flex-1 truncate text-[15px]">{describe(d, e, currency)}</span>
          <button type="button" aria-label="Edit entry" onClick={() => onEdit(e.id)} className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface">
            <Pencil size={18} />
          </button>
          <button type="button" aria-label="Delete entry" onClick={() => deleteEntry(d, e.id, now())} className="flex h-11 w-11 items-center justify-center rounded-full text-red hover:bg-red-soft">
            <Trash2 size={18} />
          </button>
        </li>
      ))}
    </ul>
  );
}
