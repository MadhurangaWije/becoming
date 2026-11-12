import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Button, Chip, ChipGroup, Field, inputClass } from '@/components/ui';
import { config } from '@/domain/config';
import type { DayKey, LearningEntry, LearningSource } from '@/domain/types';
import { db } from '@/data/db';
import { now } from '@/services/clock';
import { saveEntries } from '@/services/parser';

type Draft = Omit<LearningEntry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
const SOURCES: LearningSource[] = ['book', 'course', 'video', 'article', 'practice', 'other'];

export function LearningForm({ day, editId, onSaved }: { day: DayKey; editId?: string; onSaved: () => void }) {
  const [form, setForm] = useState<Draft>({ day, summary: '' });
  const [error, setError] = useState('');
  const topics = useLiveQuery(async () => {
    const all = await db.learning.toArray();
    const count = new Map<string, number>();
    for (const e of all) if (e.topic) count.set(e.topic, (count.get(e.topic) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, []);

  useEffect(() => {
    if (editId) db.learning.get(editId).then((e) => e && setForm(e));
  }, [editId]);

  const save = async () => {
    const summary = form.summary.trim();
    if (summary.length < config.textMin || summary.length > config.textMax) return setError(`Write ${config.textMin} to ${config.textMax} characters.`);
    await saveEntries([{ discipline: 'learning', draft: { ...form, summary, topic: form.topic?.trim() || undefined } }], now());
    onSaved();
  };

  const matching = (topics ?? []).filter((t) => !form.topic || (t.toLowerCase().includes(form.topic.toLowerCase()) && t !== form.topic)).slice(0, 5);

  return (
    <div className="space-y-4">
      <Field label="Today I learned...">
        <textarea autoFocus rows={3} className={inputClass} maxLength={config.textMax} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="that compound interest needs time more than rate" />
      </Field>
      <Field label="Topic (optional)">
        <input className={inputClass} list="topic-list" value={form.topic ?? ''} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="Finance" />
        <datalist id="topic-list">
          {topics?.map((t) => <option key={t} value={t} />)}
        </datalist>
      </Field>
      {matching.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Past topics">
          {matching.map((t) => (
            <Chip key={t} onClick={() => setForm({ ...form, topic: t })}>
              {t}
            </Chip>
          ))}
        </div>
      )}
      <Field label="Source (optional)">
        <ChipGroup label="Source" value={form.source} onChange={(source) => setForm({ ...form, source: form.source === source ? undefined : source })} options={SOURCES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))} />
      </Field>
      <Field label="Minutes (optional)">
        <div className="flex flex-wrap gap-2">
          {[10, 20, 30, 60].map((m) => (
            <Chip key={m} selected={form.minutes === m} onClick={() => setForm({ ...form, minutes: form.minutes === m ? undefined : m })}>
              {m}
            </Chip>
          ))}
        </div>
      </Field>
      {error && <p role="alert" className="text-red">{error}</p>}
      <Button variant="primary" className="w-full" onClick={save}>
        Save learning
      </Button>
    </div>
  );
}
