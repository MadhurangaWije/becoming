import { useLiveQuery } from 'dexie-react-hooks';
import { Pencil, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSettings } from '@/app/hooks';
import { useUi } from '@/app/uiStore';
import { Heatmap, type HeatFilter } from '@/components/Heatmap';
import { DisciplineIcon, SCORE_LABEL, label } from '@/components/discipline';
import { Button, Card, Empty, Segmented, SectionTitle, inputClass, money } from '@/components/ui';
import { config } from '@/domain/config';
import { addDays, diffDays, logicalToday, monthStart, parseDay, weekStart } from '@/domain/dates';
import { scoreDay } from '@/domain/scoring';
import type { DayKey, Discipline } from '@/domain/types';
import { DISCIPLINES } from '@/domain/types';
import { db } from '@/data/db';
import { entriesRepo } from '@/data/repos';
import { now } from '@/services/clock';

export function HistoryView() {
  const settings = useSettings();
  const tick = useUi((s) => s.tick);
  const today = settings ? logicalToday(now(), settings.dayCloseHour) : '';
  const [filter, setFilter] = useState<HeatFilter>('all');
  const [selected, setSelected] = useState<DayKey | undefined>();
  const records = useLiveQuery(async () => {
    if (!settings) return [];
    const all = await db.dayRecords.toArray();
    const closed = all.filter((r) => r.closedAt);
    // include today's provisional score
    const e = await entriesRepo.forDay(today);
    const rec = all.find((r) => r.day === today);
    closed.push({ day: today, scores: scoreDay(e, !!rec?.noSpendDay, settings), noSpendDay: !!rec?.noSpendDay, usedFreeze: [] });
    return closed;
  }, [settings, today, tick]);

  if (!settings) return null;

  return (
    <div>
      <Card>
        <Segmented
          label="Heatmap filter"
          value={filter}
          onChange={setFilter}
          options={[{ value: 'all' as HeatFilter, label: 'All' }, ...DISCIPLINES.map((d) => ({ value: d as HeatFilter, label: label(d) }))]}
        />
        <div className="mt-3">
          <Heatmap records={records ?? []} today={today} filter={filter} selected={selected} onSelect={setSelected} />
        </div>
        <label className="mt-2 flex items-center gap-2 text-caption text-muted">
          Jump to day
          <input type="date" className="rounded-lg border border-border px-2 py-1" max={today} value={selected ?? ''} onChange={(e) => setSelected(e.target.value || undefined)} />
        </label>
      </Card>
      {selected && <DayDetail day={selected} today={today} currency={settings.currency} />}
      <Journal />
      <ExpenseSummary today={today} currency={settings.currency} />
    </div>
  );
}

function DayDetail({ day, today, currency }: { day: DayKey; today: DayKey; currency: string }) {
  const openSheet = useUi((s) => s.openSheet);
  const data = useLiveQuery(async () => ({ e: await entriesRepo.forDay(day), r: await db.dayRecords.get(day) }), [day]);
  if (!data) return null;
  const { e, r } = data;
  const editable = diffDays(day, today) <= config.editWindowDays && day <= today;
  const lines: Record<Discipline, string[]> = {
    food: e.food.map((f) => `${f.time} ${f.slot === 'extra' ? 'Extra' : f.slot.replace('meal', 'Meal ')}: ${f.description} (${f.rating.replace('_', ' ')})`),
    workout: e.workout.map((w) => `${w.minutes} min ${w.kind}, ${w.intensity}${w.notes ? `: ${w.notes}` : ''}`),
    learning: e.learning.map((l) => l.summary),
    finance: [...e.expense.map((x) => `${money(x.amount, currency)} ${x.category} (${x.tag})`), ...(r?.noSpendDay ? ['No-spend day'] : [])],
  };
  return (
    <>
      <SectionTitle>{parseDay(day).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</SectionTitle>
      <Card className="space-y-3">
        {DISCIPLINES.map((d) => (
          <div key={d}>
            <div className="flex items-center gap-2">
              <DisciplineIcon d={d} size={18} />
              <span className="font-medium">{label(d)}</span>
              {r?.closedAt && <span className="text-caption text-muted">{SCORE_LABEL[r.scores[d]]}{r.usedFreeze.includes(d) ? ' · freeze used' : ''}</span>}
              {editable && (
                <button type="button" className="ml-auto flex h-11 w-11 items-center justify-center rounded-full text-blue hover:bg-blue-soft" aria-label={`Edit ${label(d)} for this day`} onClick={() => openSheet(d, day)}>
                  <Pencil size={18} />
                </button>
              )}
            </div>
            {lines[d].length ? (
              <ul className="ml-7 list-disc text-[15px] text-muted">
                {lines[d].map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            ) : (
              <p className="ml-7 text-[15px] text-muted">Nothing logged.</p>
            )}
          </div>
        ))}
        {r?.reflection && <p className="border-t border-border pt-2 italic">{r.reflection}</p>}
      </Card>
    </>
  );
}

function Journal() {
  const [q, setQ] = useState('');
  const entries = useLiveQuery(() => db.learning.orderBy('day').reverse().toArray(), []);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (entries ?? []).filter((e) => !s || e.summary.toLowerCase().includes(s) || e.topic?.toLowerCase().includes(s)).slice(0, 100);
  }, [entries, q]);
  return (
    <>
      <SectionTitle>Learning journal</SectionTitle>
      <div className="relative mb-3">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <input className={`${inputClass} pl-11`} placeholder="Search what you learned" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search learning journal" />
      </div>
      {!entries?.length ? (
        <Empty>Your journal is empty. Log one thing you learned today.</Empty>
      ) : !shown.length ? (
        <Empty>No entries match “{q}”.</Empty>
      ) : (
        <ul className="divide-y divide-border rounded-card border border-border">
          {shown.map((e) => (
            <li key={e.id} className="px-3 py-2">
              <p>{e.summary}</p>
              <p className="text-caption text-muted">
                {e.day}
                {e.topic && ` · ${e.topic}`}
                {e.source && ` · ${e.source}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function ExpenseSummary({ today, currency }: { today: DayKey; currency: string }) {
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [offset, setOffset] = useState(0);
  const range = useMemo(() => {
    if (period === 'week') {
      const s = addDays(weekStart(today), -7 * offset);
      return { from: s, to: addDays(s, 6), name: offset === 0 ? 'This week' : `Week of ${s}` };
    }
    const d = parseDay(monthStart(today));
    d.setMonth(d.getMonth() - offset);
    const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { from, to: `${from.slice(0, 8)}${String(end.getDate()).padStart(2, '0')}`, name: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) };
  }, [period, offset, today]);
  const expenses = useLiveQuery(() => db.expense.where('day').between(range.from, range.to, true, true).toArray(), [range.from, range.to]);
  const total = (expenses ?? []).reduce((s, e) => s + e.amount, 0);
  const group = (key: 'category' | 'tag') => {
    const m = new Map<string, number>();
    for (const e of expenses ?? []) m.set(e[key], (m.get(e[key]) ?? 0) + e.amount);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  return (
    <>
      <SectionTitle>Spending</SectionTitle>
      <Card className="space-y-3">
        <Segmented
          label="Period"
          value={period}
          onChange={(p) => {
            setPeriod(p);
            setOffset(0);
          }}
          options={[
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ]}
        />
        <div className="flex items-center justify-between">
          <Button variant="text" onClick={() => setOffset(offset + 1)} aria-label="Previous period">
            Previous
          </Button>
          <span className="font-medium">{range.name}</span>
          <Button variant="text" disabled={offset === 0} onClick={() => setOffset(offset - 1)} aria-label="Next period">
            Next
          </Button>
        </div>
        <p className="tabular text-title">{money(total, currency)}</p>
        {!expenses?.length ? (
          <Empty>No expenses in this period.</Empty>
        ) : (
          <div className="grid gap-4 min-[600px]:grid-cols-2">
            {(['category', 'tag'] as const).map((k) => (
              <div key={k}>
                <h3 className="mb-2 text-caption text-muted">By {k}</h3>
                <ul className="space-y-2">
                  {group(k).map(([name, amt]) => (
                    <li key={name}>
                      <div className="flex justify-between text-[15px]">
                        <span className="capitalize">{name}</span>
                        <span className="tabular">{money(amt, currency)}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-surface" aria-hidden>
                        <div className={`h-full rounded-full ${name === 'regret' ? 'bg-red' : name === 'want' ? 'bg-amber' : 'bg-finance'}`} style={{ width: `${(amt / total) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
