import { HardDrive, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSettings } from '@/app/hooks';
import { InstallButton } from '@/components/Install';
import { DisciplineIcon, label } from '@/components/discipline';
import { Button, Card, Chip, Field, SectionTitle, Stepper, inputClass } from '@/components/ui';
import type { Discipline, MealSlot, Settings } from '@/domain/types';
import { DISCIPLINES } from '@/domain/types';
import { BackupError, clearAll, downloadJson, exportAll, importAll, validateBackup } from '@/data/backup';
import { settingsRepo } from '@/data/repos';
import { stamp } from '@/services/clock';
import { permission, requestPermission, scheduleDailyReminders } from '@/services/notifications';
import { DebugPanel } from './DebugPanel';

export function SettingsScreen() {
  const settings = useSettings();
  if (!settings) return null;
  return <SettingsForm key={settings.updatedAt} settings={settings} />;
}

function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section id={id}>
      <SectionTitle>{title}</SectionTitle>
      <Card className="space-y-4">{children}</Card>
    </section>
  );
}

function SettingsForm({ settings }: { settings: Settings }) {
  const [s, setS] = useState(settings);
  const [newCat, setNewCat] = useState('');
  const dirty = JSON.stringify(s) !== JSON.stringify(settings);
  const set = (p: Partial<Settings>) => setS((c) => ({ ...c, ...p }));
  const setFood = (p: Partial<Settings['goals']['food']>) => set({ goals: { ...s.goals, food: { ...s.goals.food, ...p } } });
  const setMeal = (i: number, p: Partial<MealSlot>) => setFood({ mealPlan: s.goals.food.mealPlan.map((m, j) => (j === i ? { ...m, ...p } : m)) });

  useEffect(() => {
    if (location.hash === '#future') document.getElementById('future')?.scrollIntoView();
  }, []);

  const save = async () => {
    await settingsRepo.save(s);
    scheduleDailyReminders(s.reminderTimes, s.name);
  };

  return (
    <div className="pb-24">
      <h1 className="text-title">Settings</h1>

      <Section title="Goals and budget">
        <Field label="Name">
          <input className={inputClass} value={s.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label={`Monthly budget (${s.currency})`}>
          <input className={`${inputClass} tabular`} inputMode="numeric" value={s.monthlyBudget.toLocaleString('en-US')} onChange={(e) => set({ monthlyBudget: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })} />
        </Field>
        <Field label="Workout minimum (minutes)">
          <Stepper label="Workout minimum" value={s.goals.workout.minMinutes} step={5} min={10} max={180} unit="min" onChange={(v) => set({ goals: { ...s.goals, workout: { ...s.goals.workout, minMinutes: v } } })} />
        </Field>
        <Field label="Workout bonus cap (minutes)">
          <Stepper label="Workout bonus cap" value={s.goals.workout.bonusCapMinutes} step={5} min={s.goals.workout.minMinutes} max={300} unit="min" onChange={(v) => set({ goals: { ...s.goals, workout: { ...s.goals.workout, bonusCapMinutes: v } } })} />
        </Field>
        <Field label="Learning entries per day">
          <Stepper label="Learning entries per day" value={s.goals.learning.minEntries} step={1} min={1} max={5} onChange={(v) => set({ goals: { ...s.goals, learning: { minEntries: v } } })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Eating cutoff">
            <input type="time" className={inputClass} value={s.goals.food.eatingCutoff} onChange={(e) => setFood({ eatingCutoff: e.target.value })} />
          </Field>
          <Field label="Meal 3 cutoff">
            <input type="time" className={inputClass} value={s.goals.food.postWorkoutMealCutoff} onChange={(e) => setFood({ postWorkoutMealCutoff: e.target.value })} />
          </Field>
        </div>
        {s.goals.food.mealPlan.map((m, i) => (
          <div key={m.key} className="space-y-2 rounded-xl bg-surface p-3">
            <p className="font-semibold">{m.label}</p>
            {!m.postWorkout && (
              <div className="flex items-center gap-2">
                <input type="time" aria-label={`${m.label} window start`} className={inputClass} value={m.windowStart} onChange={(e) => setMeal(i, { windowStart: e.target.value })} />
                <span className="text-muted">to</span>
                <input type="time" aria-label={`${m.label} window end`} className={inputClass} value={m.windowEnd} onChange={(e) => setMeal(i, { windowEnd: e.target.value })} />
              </div>
            )}
            <textarea aria-label={`${m.label} plan`} rows={2} className={inputClass} value={m.plan} onChange={(e) => setMeal(i, { plan: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Protein (g)">
                <input inputMode="numeric" className={inputClass} value={m.proteinG} onChange={(e) => setMeal(i, { proteinG: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="Calories">
                <input inputMode="numeric" className={inputClass} value={m.kcal} onChange={(e) => setMeal(i, { kcal: Number(e.target.value) || 0 })} />
              </Field>
            </div>
          </div>
        ))}
      </Section>

      <Section title="Expense categories">
        <div className="flex flex-wrap gap-2">
          {s.expenseCategories.map((c) => (
            <Chip key={c} onClick={() => s.expenseCategories.length > 1 && set({ expenseCategories: s.expenseCategories.filter((x) => x !== c) })} aria-label={`Remove ${c}`}>
              {c} <X size={14} aria-hidden />
            </Chip>
          ))}
        </div>
        <div className="flex gap-2">
          <input className={inputClass} value={newCat} placeholder="New category" onChange={(e) => setNewCat(e.target.value)} aria-label="New category" />
          <Button
            variant="secondary"
            aria-label="Add category"
            disabled={!newCat.trim() || s.expenseCategories.includes(newCat.trim())}
            onClick={() => {
              set({ expenseCategories: [...s.expenseCategories, newCat.trim()] });
              setNewCat('');
            }}
          >
            <Plus size={18} />
          </Button>
        </div>
      </Section>

      <Section title="Why each one matters">
        {DISCIPLINES.map((d) => (
          <Field key={d} label={label(d)}>
            <input className={inputClass} maxLength={140} value={s.whys[d]} onChange={(e) => set({ whys: { ...s.whys, [d]: e.target.value } })} />
          </Field>
        ))}
      </Section>

      <Section title="Future you" id="future">
        <Field label="Who I am by then">
          <textarea className={inputClass} rows={3} maxLength={240} value={s.futureSelf.statement} onChange={(e) => set({ futureSelf: { ...s.futureSelf, statement: e.target.value } })} />
        </Field>
        <Field label="Target date">
          <input type="date" className={inputClass} value={s.futureSelf.horizonDate} onChange={(e) => set({ futureSelf: { ...s.futureSelf, horizonDate: e.target.value } })} />
        </Field>
        {DISCIPLINES.map((d: Discipline) => (
          <Field key={d} label={`${label(d)} identity`}>
            <div className="flex items-center gap-2">
              <DisciplineIcon d={d} />
              <input className={inputClass} maxLength={140} value={s.futureSelf.identities[d]} onChange={(e) => set({ futureSelf: { ...s.futureSelf, identities: { ...s.futureSelf.identities, [d]: e.target.value } } })} />
            </div>
          </Field>
        ))}
      </Section>

      <Section title="Reminders and day">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Midday">
            <input type="time" className={inputClass} value={s.reminderTimes.midday ?? ''} onChange={(e) => set({ reminderTimes: { ...s.reminderTimes, midday: e.target.value || undefined } })} />
          </Field>
          <Field label="Evening">
            <input type="time" className={inputClass} value={s.reminderTimes.evening} onChange={(e) => set({ reminderTimes: { ...s.reminderTimes, evening: e.target.value } })} />
          </Field>
        </div>
        <Field label="Day closes at" hint="Logs before this hour count for the previous day.">
          <Stepper label="Day close hour" value={s.dayCloseHour} step={1} min={0} max={6} unit=":00" onChange={(v) => set({ dayCloseHour: v })} />
        </Field>
        <NotificationRow />
      </Section>

      <DataSection settings={settings} />

      <Section title="Install">
        <InstallButton />
      </Section>

      {import.meta.env.DEV && <DebugPanel />}

      {dirty && (
        <div className="fixed inset-x-4 bottom-24 z-30 mx-auto flex max-w-[528px] gap-3 rounded-full bg-white p-2 shadow-soft min-[900px]:bottom-6 min-[900px]:left-auto min-[900px]:right-8">
          <Button variant="secondary" onClick={() => setS(settings)}>
            Discard
          </Button>
          <Button variant="primary" className="flex-1" onClick={save}>
            Save changes
          </Button>
        </div>
      )}
    </div>
  );
}

function NotificationRow() {
  const [p, setP] = useState(permission());
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-[15px]">
        Notifications: <span className="font-medium">{p}</span>
      </span>
      {p === 'default' && (
        <Button variant="secondary" onClick={async () => setP(await requestPermission())}>
          Allow
        </Button>
      )}
    </div>
  );
}

function DataSection({ settings }: { settings: Settings }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const [pending, setPending] = useState<ReturnType<typeof validateBackup> | null>(null);
  const [confirmReset, setConfirmReset] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  const doExport = async () => {
    const at = stamp();
    const data = await exportAll(at);
    downloadJson(data, `becoming-backup-${at.slice(0, 10)}.json`);
    await settingsRepo.patch({ lastExportedAt: at });
    setMsg('Backup exported.');
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      setPending(validateBackup(JSON.parse(await f.text())));
      setMsg('');
    } catch (e) {
      setMsg(e instanceof BackupError ? e.message : 'Could not read that file.');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <Section title="Your data">
      <p className="flex items-center gap-2 text-[15px]">
        <HardDrive size={18} aria-hidden />
        Storage: {persisted === null ? 'unknown' : persisted ? 'persistent (protected from cleanup)' : 'best effort (may be cleared by the browser)'}
      </p>
      {!persisted && (
        <Button variant="text" onClick={async () => setPersisted((await navigator.storage?.persist?.()) ?? false)}>
          Request persistent storage
        </Button>
      )}
      <p className="text-[15px] text-muted">Last exported: {settings.lastExportedAt ? new Date(settings.lastExportedAt).toLocaleString('en-GB') : 'never'}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={doExport}>
          Export backup
        </Button>
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>
          Import backup
        </Button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Backup file" />
      </div>
      {pending && (
        <div role="alertdialog" aria-label="Confirm import" className="space-y-3 rounded-xl border border-amber/40 bg-amber-soft p-3">
          <p>
            Replace all data on this device with the backup from {new Date(pending.exportedAt).toLocaleString('en-GB')}? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await importAll(pending);
                setPending(null);
                setMsg('Backup restored.');
              }}
            >
              Replace my data
            </Button>
          </div>
        </div>
      )}
      {msg && <p role="status" className="text-[15px]">{msg}</p>}

      <div className="border-t border-border pt-4">
        {!showReset ? (
          <Button variant="danger" onClick={() => setShowReset(true)}>
            Reset all data
          </Button>
        ) : (
          <div className="space-y-2">
            <Field label='Type "RESET" to delete everything on this device'>
              <input className={inputClass} value={confirmReset} onChange={(e) => setConfirmReset(e.target.value)} autoCapitalize="characters" />
            </Field>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => { setShowReset(false); setConfirmReset(''); }}>
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={confirmReset !== 'RESET'}
                onClick={async () => {
                  await clearAll();
                  location.assign('/');
                }}
              >
                Delete everything
              </Button>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
