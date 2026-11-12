import { useState } from 'react';
import { InstallButton, IosInstallFirst } from '@/components/Install';
import { DisciplineIcon, label } from '@/components/discipline';
import { Button, Field, Stepper, inputClass } from '@/components/ui';
import { defaultSettings } from '@/domain/config';
import { addDays, logicalToday } from '@/domain/dates';
import type { Discipline, MealSlot, Settings } from '@/domain/types';
import { DISCIPLINES } from '@/domain/types';
import { settingsRepo } from '@/data/repos';
import { now, stamp } from '@/services/clock';
import { requestPermission } from '@/services/notifications';
import { RestoreBackup } from '@/features/settings/RestoreBackup';

const STEPS = ['You', 'Goals', 'Why', 'Future you', 'Reminders'] as const;

const IDENTITY_HINT: Record<Discipline, string> = {
  food: 'I eat clean without thinking about it',
  workout: 'I train every day without negotiating with myself',
  learning: 'I learn something new every single day',
  finance: 'I spend on purpose and save the rest',
};

const WHY_HINT: Record<Discipline, string> = {
  food: 'Why eat to the plan?',
  workout: 'Why move every day?',
  learning: 'Why learn daily?',
  finance: 'Why spend mindfully?',
};

export function Onboarding({ onDone }: { onDone: () => void }) {
  const t = now();
  const [s, setS] = useState<Settings>(() => {
    const today = logicalToday(t, 3);
    return defaultSettings(today, addDays(today, 365));
  });
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [notif, setNotif] = useState<string>('');

  const set = (p: Partial<Settings>) => setS((cur) => ({ ...cur, ...p }));
  const setMeal = (i: number, p: Partial<MealSlot>) => {
    const plan = s.goals.food.mealPlan.map((m, j) => (j === i ? { ...m, ...p } : m));
    set({ goals: { ...s.goals, food: { ...s.goals.food, mealPlan: plan } } });
  };

  const canNext = [s.name.trim().length > 0 && s.monthlyBudget > 0, true, true, s.futureSelf.statement.trim().length > 0, true][step];

  const finish = async () => {
    setSaving(true);
    const today = logicalToday(now(), s.dayCloseHour);
    let persisted = false;
    try {
      persisted = (await navigator.storage?.persist?.()) ?? false;
    } catch {
      /* unsupported */
    }
    await settingsRepo.save({ ...s, name: s.name.trim(), firstDay: today, onboardedAt: stamp(), persisted });
    onDone();
  };

  return (
    <div className="safe-top mx-auto flex min-h-screen max-w-[560px] flex-col px-4 pb-8 pt-6">
      <div className="mb-6">
        <p className="text-caption text-muted">
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </p>
        <div className="mt-2 flex gap-1" aria-hidden>
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-green' : 'bg-border'}`} />
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-5">
        {step === 0 && (
          <>
            <h1 className="text-title">Become who you said you would.</h1>
            <p className="text-muted">Four daily disciplines. Your future self keeps score.</p>
            <IosInstallFirst />
            <Field label="Your name">
              <input className={inputClass} value={s.name} onChange={(e) => set({ name: e.target.value })} autoComplete="given-name" placeholder="Name" />
            </Field>
            <Field label={`Monthly budget (${s.currency})`}>
              <input
                className={`${inputClass} tabular`}
                inputMode="numeric"
                value={s.monthlyBudget ? s.monthlyBudget.toLocaleString('en-US') : ''}
                onChange={(e) => set({ monthlyBudget: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })}
              />
            </Field>
            <section aria-label="Restore from backup" className="space-y-2 border-t border-border pt-5">
              <h2 className="font-semibold">Moving from another phone?</h2>
              <p className="text-[15px] text-muted">Restore the backup you exported from Settings on your old device. Your logs, levels, streaks and messages come with it.</p>
              <RestoreBackup label="Restore from backup" replacing={false} onRestored={onDone} />
            </section>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="text-title">Your goals</h1>
            <p className="text-muted">The defaults follow your plan. Adjust anything that is off.</p>
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-card">
                <DisciplineIcon d="food" /> Meal plan
              </h2>
              {s.goals.food.mealPlan.map((m, i) => (
                <div key={m.key} className="space-y-2 rounded-card bg-surface p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{m.label}</span>
                    <span className="tabular text-caption text-muted">
                      {m.proteinG} g protein · {m.kcal} kcal
                    </span>
                  </div>
                  {!m.postWorkout ? (
                    <div className="flex items-center gap-2">
                      <input type="time" aria-label={`${m.label} window start`} className={`${inputClass} !min-h-[44px] !py-2`} value={m.windowStart} onChange={(e) => setMeal(i, { windowStart: e.target.value })} />
                      <span className="text-muted">to</span>
                      <input type="time" aria-label={`${m.label} window end`} className={`${inputClass} !min-h-[44px] !py-2`} value={m.windowEnd} onChange={(e) => setMeal(i, { windowEnd: e.target.value })} />
                    </div>
                  ) : (
                    <p className="text-caption text-muted">Right after your workout</p>
                  )}
                  <textarea aria-label={`${m.label} plan`} rows={2} className={inputClass} value={m.plan} onChange={(e) => setMeal(i, { plan: e.target.value })} />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Eating cutoff">
                  <input type="time" className={inputClass} value={s.goals.food.eatingCutoff} onChange={(e) => set({ goals: { ...s.goals, food: { ...s.goals.food, eatingCutoff: e.target.value } } })} />
                </Field>
                <Field label="Meal 3 cutoff">
                  <input
                    type="time"
                    className={inputClass}
                    value={s.goals.food.postWorkoutMealCutoff}
                    onChange={(e) => set({ goals: { ...s.goals, food: { ...s.goals.food, postWorkoutMealCutoff: e.target.value } } })}
                  />
                </Field>
              </div>
            </section>
            <section className="space-y-2">
              <h2 className="flex items-center gap-2 text-card">
                <DisciplineIcon d="workout" /> Workout minimum
              </h2>
              <Stepper label="Workout minimum minutes" value={s.goals.workout.minMinutes} unit="min" step={5} min={10} max={180} onChange={(v) => set({ goals: { ...s.goals, workout: { ...s.goals.workout, minMinutes: v } } })} />
            </section>
            <section className="space-y-2">
              <h2 className="flex items-center gap-2 text-card">
                <DisciplineIcon d="learning" /> Learning entries per day
              </h2>
              <Stepper label="Learning entries per day" value={s.goals.learning.minEntries} step={1} min={1} max={5} onChange={(v) => set({ goals: { ...s.goals, learning: { minEntries: v } } })} />
            </section>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-title">Why does each one matter?</h1>
            <p className="text-muted">One line each. Your future self will quote these back when you drift.</p>
            {DISCIPLINES.map((d) => (
              <Field key={d} label={`${label(d)}: ${WHY_HINT[d]}`}>
                <input className={inputClass} value={s.whys[d]} maxLength={140} onChange={(e) => set({ whys: { ...s.whys, [d]: e.target.value } })} />
              </Field>
            ))}
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="text-title">Describe future you</h1>
            <p className="text-muted">Who are you by the date below, having kept all four? This is who will talk to you.</p>
            <Field label="Who I am by then (one or two lines)">
              <textarea className={inputClass} rows={3} maxLength={240} value={s.futureSelf.statement} onChange={(e) => set({ futureSelf: { ...s.futureSelf, statement: e.target.value } })} placeholder="Lean, strong, calm with money, always learning." />
            </Field>
            <Field label="Target date">
              <input type="date" className={inputClass} value={s.futureSelf.horizonDate} onChange={(e) => set({ futureSelf: { ...s.futureSelf, horizonDate: e.target.value } })} />
            </Field>
            {DISCIPLINES.map((d) => (
              <Field key={d} label={`${label(d)} identity`}>
                <input
                  className={inputClass}
                  maxLength={140}
                  placeholder={IDENTITY_HINT[d]}
                  value={s.futureSelf.identities[d]}
                  onChange={(e) => set({ futureSelf: { ...s.futureSelf, identities: { ...s.futureSelf.identities, [d]: e.target.value } } })}
                />
              </Field>
            ))}
          </>
        )}

        {step === 4 && (
          <>
            <h1 className="text-title">Reminders</h1>
            <p className="text-muted">The app will also remind you in-app when you open it, so notifications are optional.</p>
            <Field label="Evening check-in">
              <input type="time" className={inputClass} value={s.reminderTimes.evening} onChange={(e) => set({ reminderTimes: { ...s.reminderTimes, evening: e.target.value } })} />
            </Field>
            <Field label="Midday check-in (optional)">
              <input type="time" className={inputClass} value={s.reminderTimes.midday ?? ''} onChange={(e) => set({ reminderTimes: { ...s.reminderTimes, midday: e.target.value || undefined } })} />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" onClick={async () => setNotif(String(await requestPermission()))}>
                Allow notifications
              </Button>
              {notif && <span className="text-caption text-muted">Notifications: {notif}</span>}
            </div>
            <div className="space-y-2 pt-2">
              <h2 className="text-card">Install</h2>
              <InstallButton />
            </div>
          </>
        )}
      </div>

      <div className="sticky bottom-0 mt-8 flex gap-3 bg-bg pb-2 pt-3">
        {step > 0 && (
          <Button variant="secondary" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button variant="primary" className="flex-1" disabled={!canNext} onClick={() => setStep(step + 1)}>
            Continue
          </Button>
        ) : (
          <Button variant="primary" className="flex-1" disabled={saving} onClick={finish}>
            Start becoming
          </Button>
        )}
      </div>
    </div>
  );
}
