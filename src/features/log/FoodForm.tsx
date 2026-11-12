import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Moon, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Chip, ChipGroup, Field, Toggle, inputClass } from '@/components/ui';
import { PLANNED_FLAGS, config } from '@/domain/config';
import { hhmm, toMinutes } from '@/domain/dates';
import { isLate } from '@/domain/scoring';
import type { DayKey, FoodEntry, FoodSlot, MealKey, Settings } from '@/domain/types';
import { db } from '@/data/db';
import { now } from '@/services/clock';
import { saveEntries } from '@/services/parser';

type Draft = Omit<FoodEntry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

function defaultSlot(time: string, hasWorkout: boolean): MealKey {
  const m = toMinutes(time);
  if (hasWorkout || m >= 16 * 60 + 30) return 'meal3';
  if (m < 13 * 60) return 'meal1';
  return 'meal2';
}

export function FoodForm({ day, today, editId, settings, onSaved }: { day: DayKey; today: DayKey; editId?: string; settings: Settings; onSaved: () => void }) {
  const plan = settings.goals.food.mealPlan;
  const nowTime = hhmm(now());
  const dayData = useLiveQuery(async () => ({ food: await db.food.where('day').equals(day).toArray(), workouts: await db.workout.where('day').equals(day).count() }), [day]);
  const recent = useLiveQuery(async () => {
    const all = await db.food.orderBy('day').reverse().limit(120).toArray();
    const seen = new Set<string>();
    return all.filter((e) => !e.asPlanned && !seen.has(e.description.toLowerCase()) && seen.add(e.description.toLowerCase())).slice(0, 6);
  }, []);
  const [form, setForm] = useState<Draft | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!editId) return;
    db.food.get(editId).then((e) => e && setForm(e));
  }, [editId]);

  const timeFor = (slot: FoodSlot) => {
    if (day === today) return nowTime;
    const m = plan.find((p) => p.key === slot);
    return m?.windowStart || '17:30';
  };

  const logged = new Set(dayData?.food.map((f) => f.slot));
  const suggested = defaultSlot(nowTime, (dayData?.workouts ?? 0) > 0 && !logged.has('meal3'));

  const save = async (draft: Draft) => {
    if (draft.description.trim().length < config.textMin || draft.description.length > config.textMax) {
      setError(`Description must be ${config.textMin} to ${config.textMax} characters.`);
      return;
    }
    await saveEntries([{ discipline: 'food', draft: { ...draft, description: draft.description.trim() } }], now());
    onSaved();
  };

  const asPlanned = (slot: MealKey) => {
    const m = plan.find((p) => p.key === slot)!;
    return save({ day, slot, description: m.plan, rating: 'on_plan', ...PLANNED_FLAGS[slot], time: timeFor(slot), asPlanned: true });
  };

  const variation = (slot: FoodSlot, p: Partial<Draft> = {}) =>
    setForm({ day, slot, description: '', rating: slot === 'extra' ? 'off_plan' : 'close', carbs: 'moderate', protein: true, veggies: false, time: timeFor(slot), ...p });

  if (form) {
    const late = isLate(form, settings.goals.food, settings.dayCloseHour);
    return (
      <div className="space-y-4">
        <Field label="Meal">
          <ChipGroup
            label="Meal slot"
            value={form.slot}
            onChange={(slot) => setForm({ ...form, slot })}
            options={[...plan.map((m) => ({ value: m.key as FoodSlot, label: m.label.replace(' (post-workout)', '') })), { value: 'extra', label: 'Extra' }]}
          />
        </Field>
        <Field label="What did you eat?">
          <input autoFocus className={inputClass} value={form.description} maxLength={config.textMax} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Rice and chicken curry" />
        </Field>
        {!form.id && !!recent?.length && (
          <div className="flex flex-wrap gap-2" aria-label="Recent variations">
            {recent.map((r) => (
              <Chip key={r.id} onClick={() => setForm({ ...form, description: r.description, rating: r.rating, carbs: r.carbs, protein: r.protein, veggies: r.veggies })}>
                {r.description}
              </Chip>
            ))}
          </div>
        )}
        <Field label="How close to the plan?">
          <ChipGroup label="Rating" value={form.rating} onChange={(rating) => setForm({ ...form, rating })} options={[{ value: 'on_plan', label: 'On plan' }, { value: 'close', label: 'Close' }, { value: 'off_plan', label: 'Off plan' }]} />
        </Field>
        <Field label="Carbs">
          <ChipGroup label="Carbs" value={form.carbs} onChange={(carbs) => setForm({ ...form, carbs })} options={[{ value: 'low', label: 'Low' }, { value: 'moderate', label: 'Moderate' }, { value: 'high', label: 'High' }]} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Toggle label="Protein" checked={form.protein} onChange={(protein) => setForm({ ...form, protein })} />
          <Toggle label="Vegetables" checked={form.veggies} onChange={(veggies) => setForm({ ...form, veggies })} />
        </div>
        <Field label="Time">
          <input type="time" className={inputClass} value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
        </Field>
        {(form.slot === 'extra' || late) && <p className="rounded-xl bg-red-soft p-3 text-[15px] text-red">{late ? 'After the cutoff. This counts as a deviation.' : 'Outside the plan. This counts as a deviation.'}</p>}
        {error && <p role="alert" className="text-red">{error}</p>}
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setForm(null)}>
            Back
          </Button>
          <Button variant="primary" className="flex-1" onClick={() => save(form)}>
            Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {plan.map((m) => {
        const done = logged.has(m.key);
        return (
          <div key={m.key} className={`rounded-card border p-3 ${m.key === suggested && !done ? 'border-green' : 'border-border'} ${done ? 'bg-green-soft' : ''}`}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">{m.label}</h3>
              <span className="tabular text-caption text-muted">{m.postWorkout ? 'After workout' : `${m.windowStart} to ${m.windowEnd}`}</span>
            </div>
            <p className="mt-1 text-[15px] text-muted">{m.plan}</p>
            <p className="tabular mt-1 text-caption text-muted">
              {m.proteinG} g protein · {m.kcal} kcal
            </p>
            {done ? (
              <p className="mt-2 flex items-center gap-1 text-green-strong">
                <Check size={18} aria-hidden /> Logged
              </p>
            ) : (
              <div className="mt-2 flex gap-2">
                <Button variant={m.key === suggested ? 'primary' : 'secondary'} className="flex-1" onClick={() => asPlanned(m.key)} aria-label={`${m.label}: ate as planned`}>
                  Ate as planned
                </Button>
                <Button variant="text" onClick={() => variation(m.key)} aria-label={`${m.label}: ate something else`}>
                  Something else
                </Button>
              </div>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => variation('extra')}>
          <Plus size={18} aria-hidden /> Outside the plan
        </Button>
        <Button variant="danger" onClick={() => variation('extra', { time: day === today ? nowTime : '19:00', description: '' })}>
          <Moon size={18} aria-hidden /> I ate after {settings.goals.food.eatingCutoff}
        </Button>
      </div>
      <p className="text-caption text-muted">Water, plain tea and black coffee do not need logging.</p>
    </div>
  );
}
