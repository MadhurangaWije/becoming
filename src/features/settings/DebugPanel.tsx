import { useState } from 'react';
import { useUi } from '@/app/uiStore';
import { Button, Card, Field, SectionTitle, inputClass } from '@/components/ui';
import { toDayKey } from '@/domain/dates';
import { seedDatabase } from '@/dev/seed';
import { isClockOverridden, now, setDebugNow } from '@/services/clock';
import { runDayClose } from '@/services/dayClose';

/** Dev builds only: set the current date to test day close, decay and streaks. */
export function DebugPanel() {
  const bump = useUi((s) => s.bump);
  const celebrate = useUi((s) => s.celebrate);
  const cur = now();
  const [date, setDate] = useState(toDayKey(cur));
  const [time, setTime] = useState(cur.toTimeString().slice(0, 5));
  const [busy, setBusy] = useState('');

  const apply = async (target: Date | null) => {
    setDebugNow(target);
    bump();
    setBusy('Closing days...');
    const r = await runDayClose(now());
    celebrate(r.celebrations);
    setBusy(`Clock set. Closed ${r.closed.length} day(s).`);
  };

  return (
    <section>
      <SectionTitle>Debug (dev only)</SectionTitle>
      <Card className="space-y-3">
        <p className="text-caption text-muted">
          Now: {now().toLocaleString('en-GB')} {isClockOverridden() && '(overridden)'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Date">
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Time">
            <input type="time" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => apply(new Date(`${date}T${time}:00`))}>
            Set clock
          </Button>
          <Button variant="secondary" onClick={() => apply(new Date(now().getTime() + 86400000))}>
            +1 day
          </Button>
          <Button variant="text" onClick={() => apply(null)}>
            Reset clock
          </Button>
        </div>
        <Button
          variant="secondary"
          onClick={async () => {
            setBusy('Seeding 90 days...');
            await seedDatabase(now(), 90);
            bump();
            setBusy('Seeded 90 days.');
          }}
        >
          Seed 90 days of data
        </Button>
        {busy && <p role="status" className="text-caption">{busy}</p>}
      </Card>
    </section>
  );
}
