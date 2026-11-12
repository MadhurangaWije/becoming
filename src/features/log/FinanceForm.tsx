import { useLiveQuery } from 'dexie-react-hooks';
import { Ban } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Chip, ChipGroup, Field, inputClass } from '@/components/ui';
import type { DayKey, ExpenseEntry, ExpenseTag, Settings } from '@/domain/types';
import { db } from '@/data/db';
import { settingsRepo } from '@/data/repos';
import { now } from '@/services/clock';
import { saveEntries, setNoSpend } from '@/services/parser';

type Draft = Omit<ExpenseEntry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

export function FinanceForm({ day, editId, settings, onSaved }: { day: DayKey; editId?: string; settings: Settings; onSaved: () => void }) {
  const [form, setForm] = useState<Draft>({ day, amount: 0, category: settings.lastExpenseCategory ?? settings.expenseCategories[0], tag: 'need', note: '' });
  const [error, setError] = useState('');
  const dayInfo = useLiveQuery(async () => ({ rec: await db.dayRecords.get(day), count: await db.expense.where('day').equals(day).count() }), [day]);

  useEffect(() => {
    if (editId) db.expense.get(editId).then((e) => e && setForm(e));
  }, [editId]);

  const save = async () => {
    if (!(form.amount > 0)) return setError('Enter an amount greater than 0.');
    await saveEntries([{ discipline: 'finance', draft: { ...form, note: form.note?.trim() || undefined } }], now());
    if (settings.lastExpenseCategory !== form.category) await settingsRepo.patch({ lastExpenseCategory: form.category });
    onSaved();
  };

  const noSpend = !!dayInfo?.rec?.noSpendDay;

  return (
    <div className="space-y-4">
      <Field label={`Amount (${settings.currency})`}>
        <input
          autoFocus
          inputMode="decimal"
          className={`${inputClass} tabular !text-[28px] font-bold`}
          value={form.amount ? form.amount.toLocaleString('en-US') : ''}
          onChange={(e) => setForm({ ...form, amount: Number(e.target.value.replace(/[^\d.]/g, '')) || 0 })}
          placeholder="0"
          aria-label="Amount"
        />
      </Field>
      <Field label="Category">
        <div className="flex flex-wrap gap-2">
          {settings.expenseCategories.map((c) => (
            <Chip key={c} selected={form.category === c} onClick={() => setForm({ ...form, category: c })}>
              {c}
            </Chip>
          ))}
        </div>
      </Field>
      <Field label="Tag">
        <ChipGroup<ExpenseTag> label="Tag" value={form.tag} onChange={(tag) => setForm({ ...form, tag })} options={[{ value: 'need', label: 'Need' }, { value: 'want', label: 'Want' }, { value: 'regret', label: 'Regret' }]} />
      </Field>
      {form.tag === 'regret' ? (
        <Field label="What happened? (one line, optional)">
          <input className={inputClass} value={form.note ?? ''} maxLength={280} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Impulse buy on the way home" />
        </Field>
      ) : (
        <Field label="Note (optional)">
          <input className={inputClass} value={form.note ?? ''} maxLength={280} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </Field>
      )}
      {error && <p role="alert" className="text-red">{error}</p>}
      <Button variant="primary" className="w-full" onClick={save}>
        Save expense
      </Button>
      {!form.id && !dayInfo?.count && (
        <Button
          variant={noSpend ? 'dark' : 'secondary'}
          className="w-full"
          aria-pressed={noSpend}
          onClick={async () => {
            await setNoSpend(day, !noSpend, now());
            if (!noSpend) onSaved();
          }}
        >
          <Ban size={18} aria-hidden /> {noSpend ? 'No-spend day set. Tap to undo' : 'No spend today'}
        </Button>
      )}
    </div>
  );
}
