import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { useTodayView } from '@/app/hooks';
import { useUi } from '@/app/uiStore';
import { FutureSelfFigure } from '@/components/FutureSelf';
import { DisciplineIcon, label } from '@/components/discipline';
import { Button, Chip, inputClass } from '@/components/ui';
import type { Discipline } from '@/domain/types';
import { DISCIPLINES } from '@/domain/types';
import { messagesRepo } from '@/data/repos';
import { stamp } from '@/services/clock';
import { refreshAppBadge } from '@/services/companion';

const REASONS = ['Too busy', 'Tired', 'Forgot', 'Lost motivation', 'Other'];

/** 6.4: full-screen check-in on next open, until answered. */
export function InterventionGate() {
  const view = useTodayView();
  const openSheet = useUi((s) => s.openSheet);
  const [reason, setReason] = useState('');
  const [other, setOther] = useState('');
  // After answering, the message is no longer pending; keep the follow-up screen open via `done`.
  const [done, setDone] = useState<{ discipline?: Discipline } | null>(null);
  const m = done ? undefined : view?.pendingIntervention;
  const answered = !!done;
  const active = m ?? done;

  const d = done ? done.discipline : m?.discipline;
  const settings = view?.settings;

  const submit = async () => {
    if (!m) return;
    const response = reason === 'Other' ? other.trim() || 'Other' : reason;
    setDone({ discipline: m.discipline });
    await messagesRepo.patch(m.id, { response, readAt: stamp() });
    await refreshAppBadge();
  };

  const close = () => {
    setDone(null);
    setReason('');
    setOther('');
  };

  return (
    <AnimatePresence>
      {active && settings && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Check-in"
          className="safe-top fixed inset-0 z-40 overflow-y-auto bg-white"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="mx-auto flex min-h-full max-w-[560px] flex-col gap-5 px-4 pb-10 pt-8">
            <div className="flex items-center gap-3">
              <FutureSelfFigure tier={view!.overall.tier} mood="concerned" fading={new Set(DISCIPLINES.filter((x) => view!.stats[x].fading))} size={64} />
              <div>
                <p className="text-caption text-muted">Future {settings.name}</p>
                <h1 className="text-title">Check-in</h1>
              </div>
            </div>
            {!answered && m ? (
              <>
                <p className="text-card font-medium">{m.text}</p>
                {d && (
                  <div className="space-y-2 rounded-card bg-surface p-4">
                    <p className="flex items-center gap-2 text-caption text-muted">
                      <DisciplineIcon d={d} size={18} /> {label(d)}
                    </p>
                    {settings.whys[d] && <p>Your why: “{settings.whys[d]}”</p>}
                    {settings.futureSelf.identities[d] && <p className="text-muted">“{settings.futureSelf.identities[d]}”</p>}
                  </div>
                )}
                <fieldset className="space-y-3">
                  <legend className="mb-3 text-card">What got in the way?</legend>
                  <div className="flex flex-wrap gap-2">
                    {REASONS.map((r) => (
                      <Chip key={r} selected={reason === r} onClick={() => setReason(r)}>
                        {r}
                      </Chip>
                    ))}
                  </div>
                  {reason === 'Other' && <input autoFocus className={inputClass} value={other} maxLength={280} onChange={(e) => setOther(e.target.value)} placeholder="What happened?" aria-label="Other reason" />}
                </fieldset>
                <div className="mt-auto flex gap-3">
                  <Button variant="text" onClick={async () => { await messagesRepo.patch(m.id, { dismissedAt: stamp(), readAt: stamp() }); close(); }}>
                    Not now
                  </Button>
                  <Button variant="primary" className="flex-1" disabled={!reason} onClick={submit}>
                    Answer
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-card">Thank you for being honest. Now the smallest version, today.</p>
                {d && (
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={() => {
                      close();
                      openSheet(d);
                    }}
                  >
                    Do the minimum {label(d).toLowerCase()} now
                  </Button>
                )}
                <Button variant="secondary" className="w-full" onClick={close}>
                  Later
                </Button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
