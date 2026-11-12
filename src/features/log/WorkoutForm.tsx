import { useLiveQuery } from 'dexie-react-hooks';
import { Play, Repeat, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button, Chip, ChipGroup, Field, Stepper, inputClass } from '@/components/ui';
import { config } from '@/domain/config';
import { hhmm } from '@/domain/dates';
import type { DayKey, Settings, WorkoutEntry, WorkoutKind } from '@/domain/types';
import { db } from '@/data/db';
import { now } from '@/services/clock';
import { saveEntries } from '@/services/parser';

type Draft = Omit<WorkoutEntry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
const KINDS: WorkoutKind[] = ['gym', 'home', 'run', 'walk', 'sport', 'yoga', 'other'];
const PRESETS = [15, 30, 45, 60, 90];
const TIMER_KEY = 'becoming.workoutTimerStart';

export function WorkoutForm({ day, editId, settings, onSaved }: { day: DayKey; editId?: string; settings: Settings; onSaved: () => void }) {
  const last = useLiveQuery(() => db.workout.orderBy('day').last(), []);
  const [form, setForm] = useState<Draft>({ day, kind: 'gym', minutes: settings.goals.workout.minMinutes, intensity: 'moderate', notes: '' });
  const [timerStart, setTimerStart] = useState<number | null>(() => {
    try {
      return Number(localStorage.getItem(TIMER_KEY)) || null;
    } catch {
      return null;
    }
  });
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const tick = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (editId) db.workout.get(editId).then((e) => e && setForm(e));
  }, [editId]);

  useEffect(() => {
    if (!timerStart) return;
    const update = () => setElapsed(Math.floor((Date.now() - timerStart) / 1000));
    update();
    tick.current = setInterval(update, 1000);
    return () => clearInterval(tick.current);
  }, [timerStart]);

  const startTimer = () => {
    const t = Date.now();
    setTimerStart(t);
    try {
      localStorage.setItem(TIMER_KEY, String(t));
    } catch {
      /* ignore */
    }
  };
  const stopTimer = () => {
    const mins = Math.max(1, Math.round(elapsed / 60));
    setForm((f) => ({ ...f, minutes: Math.min(config.workout.maxMinutes, mins) }));
    setTimerStart(null);
    setElapsed(0);
    try {
      localStorage.removeItem(TIMER_KEY);
    } catch {
      /* ignore */
    }
  };

  const save = async () => {
    if (form.minutes < 1 || form.minutes > config.workout.maxMinutes) return setError(`Minutes must be 1 to ${config.workout.maxMinutes}.`);
    await saveEntries([{ discipline: 'workout', draft: { ...form, notes: form.notes?.trim() || undefined, time: form.time ?? hhmm(now()) } }], now());
    onSaved();
  };

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <div className="space-y-4">
      {!form.id && last && (
        <Button variant="text" onClick={() => setForm({ ...form, kind: last.kind, minutes: last.minutes, intensity: last.intensity, notes: last.notes ?? '' })}>
          <Repeat size={18} aria-hidden /> Repeat last: {last.minutes} min {last.kind}
        </Button>
      )}
      <Field label="Kind">
        <ChipGroup label="Workout kind" value={form.kind} onChange={(kind) => setForm({ ...form, kind })} options={KINDS.map((k) => ({ value: k, label: k[0].toUpperCase() + k.slice(1) }))} />
      </Field>
      <Field label="Minutes">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Chip key={p} selected={form.minutes === p} onClick={() => setForm({ ...form, minutes: p })}>
                {p}
              </Chip>
            ))}
          </div>
          <Stepper label="Minutes" value={form.minutes} onChange={(minutes) => setForm({ ...form, minutes })} unit="min" step={5} min={1} max={config.workout.maxMinutes} />
          <div className="flex items-center gap-3">
            {timerStart ? (
              <Button variant="dark" onClick={stopTimer}>
                <Square size={16} aria-hidden /> Stop <span className="tabular">{mm}:{ss}</span>
              </Button>
            ) : (
              <Button variant="secondary" onClick={startTimer}>
                <Play size={16} aria-hidden /> Start timer
              </Button>
            )}
          </div>
        </div>
      </Field>
      <Field label="Intensity">
        <ChipGroup label="Intensity" value={form.intensity} onChange={(intensity) => setForm({ ...form, intensity })} options={[{ value: 'light', label: 'Light' }, { value: 'moderate', label: 'Moderate' }, { value: 'hard', label: 'Hard' }]} />
      </Field>
      <Field label="Notes (optional)">
        <input className={inputClass} value={form.notes ?? ''} maxLength={280} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Chest and back" />
      </Field>
      {error && <p role="alert" className="text-red">{error}</p>}
      <Button variant="primary" className="w-full" onClick={save}>
        Save workout
      </Button>
    </div>
  );
}
