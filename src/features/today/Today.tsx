import { AlertTriangle, Flame, Plus, Snowflake, Target, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTodayView } from '@/app/hooks';
import { useUi } from '@/app/uiStore';
import { FutureSelfFigure } from '@/components/FutureSelf';
import { InstallCard } from '@/components/Install';
import { Ring, RingLegend } from '@/components/Ring';
import { ACCENT, DisciplineIcon, SCORE_LABEL, label, statName } from '@/components/discipline';
import { Button, money } from '@/components/ui';
import { parseDay } from '@/domain/dates';
import type { Discipline } from '@/domain/types';
import { DISCIPLINES } from '@/domain/types';
import { messagesRepo } from '@/data/repos';
import { stamp } from '@/services/clock';
import type { TodayView } from '@/services/snapshot';

const fmtDate = (day: string) => parseDay(day).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

export function TodayScreen() {
  const view = useTodayView();
  if (!view) return <div aria-busy="true" className="h-40" />;
  const { settings, scores, stats } = view;
  const fading = new Set(DISCIPLINES.filter((d) => stats[d].fading));

  return (
    <div className="space-y-3">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-title">Today</h1>
          <p className="text-caption text-muted">{fmtDate(view.today)}</p>
        </div>
        <Link to="/progress" className="flex items-center gap-2 rounded-full bg-black px-3 py-2 text-white" aria-label={`Overall level ${view.overall.level}, ${view.overall.title}`}>
          <span className="tabular text-card leading-none">{view.overall.level}</span>
          <span className="text-caption text-white/80">{view.overall.title}</span>
        </Link>
      </header>

      {/* What does my future self say */}
      <section aria-label="Future self" className="flex gap-3 rounded-card bg-surface p-3">
        <FutureSelfFigure tier={view.overall.tier} mood={view.mood} fading={fading} size={56} />
        <div className="min-w-0 flex-1">
          <p className="text-caption text-muted">Future {settings.name}</p>
          <p className="mt-0.5 leading-snug">{view.latestMessage?.text ?? settings.futureSelf.statement ?? 'Log something. I am watching, kindly.'}</p>
          <p className="mt-1 text-caption text-muted">
            <span className="tabular">{view.distance.daysLeft}</span> days until you are me · <span className="tabular">{view.distance.strongDaysPct}%</span> strong days
          </p>
        </div>
      </section>

      <InstallCard />

      {view.horizonReached && (
        <Link to="/settings#future" className="block rounded-card border border-blue bg-blue-soft p-3 text-blue">
          Your target date has arrived. Look back, then set a new statement and date.
        </Link>
      )}

      {view.pinnedWarning && <WarningCard view={view} />}

      {/* How is today going */}
      <section aria-label="Today's progress" className="flex items-center gap-4 rounded-card border border-border p-3">
        <Ring
          scores={scores}
          size={124}
          centre={
            <div>
              <div className="tabular text-card">+{view.provisionalXp}</div>
              <div className="text-caption text-muted">XP today</div>
            </div>
          }
        />
        <div className="min-w-0 flex-1 space-y-2">
          <RingLegend scores={scores} />
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-caption text-muted">
            {view.perfectStreak > 0 && (
              <span className="flex items-center gap-1">
                <Flame size={14} aria-hidden className="text-green-strong" /> {view.perfectStreak} perfect
              </span>
            )}
            {settings.streakFreezes > 0 && (
              <span className="flex items-center gap-1">
                <Snowflake size={14} aria-hidden className="text-blue" /> {settings.streakFreezes} freeze{settings.streakFreezes > 1 ? 's' : ''}
              </span>
            )}
            {view.focus && (
              <span className="flex items-center gap-1">
                <Target size={14} aria-hidden /> Focus: {label(view.focus)}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* What is left to do */}
      <section aria-label="Disciplines" className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-2">
        {DISCIPLINES.map((d) => (
          <DisciplineCard key={d} d={d} view={view} />
        ))}
      </section>
    </div>
  );
}

function WarningCard({ view }: { view: TodayView }) {
  const m = view.pinnedWarning!;
  const d = m.discipline;
  return (
    <section role="alert" className="relative rounded-card border border-amber/40 bg-amber-soft p-3 pr-12">
      <p className="flex items-start gap-2">
        <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber" aria-hidden />
        <span>{m.text}</span>
      </p>
      {d && (view.settings.whys[d] || view.settings.futureSelf.identities[d]) && (
        <blockquote className="mt-2 border-l-2 border-amber pl-3 text-[15px] text-muted">
          {view.settings.whys[d] && <p>Your why: “{view.settings.whys[d]}”</p>}
          {view.settings.futureSelf.identities[d] && <p>“{view.settings.futureSelf.identities[d]}”</p>}
        </blockquote>
      )}
      <button type="button" aria-label="Dismiss warning" className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/60" onClick={() => messagesRepo.patch(m.id, { dismissedAt: stamp(), readAt: m.readAt ?? stamp() })}>
        <X size={20} />
      </button>
    </section>
  );
}

function statusLine(d: Discipline, view: TodayView): string {
  const e = view.entries;
  const s = view.settings;
  switch (d) {
    case 'food': {
      const slots = new Set(e.food.filter((f) => f.slot !== 'extra').map((f) => f.slot));
      if (!e.food.length) return 'No meals logged yet. Tap + to add Meal 1.';
      return `${slots.size} of 3 meals · ${view.nutrition.protein} of ${view.nutrition.targetProtein} g protein`;
    }
    case 'workout':
      return e.workout.length ? `${view.workoutMinutes} of ${s.goals.workout.minMinutes} min` : 'No workout yet. Tap + to log one.';
    case 'learning':
      return e.learning.length ? `${e.learning.length} entr${e.learning.length > 1 ? 'ies' : 'y'}: ${e.learning[e.learning.length - 1].summary}` : 'Nothing learned yet. Tap + to write one line.';
    case 'finance':
      if (view.record?.noSpendDay && !e.expense.length) return 'No-spend day';
      return e.expense.length ? `${money(e.expense.reduce((t, x) => t + x.amount, 0), s.currency)} today, ${e.expense.length} logged` : 'No expenses yet. Tap + or mark no spend.';
  }
}

function DisciplineCard({ d, view }: { d: Discipline; view: TodayView }) {
  const openSheet = useUi((s) => s.openSheet);
  const score = view.scores[d];
  const stat = view.stats[d];
  const monthPct = Math.min(100, (view.month.spent / view.month.budget) * 100);
  const overPace = view.month.spent > view.month.pace;

  return (
    <article className={`rounded-card border p-3 ${score === 1 ? 'border-green/50 bg-green-soft' : 'border-border bg-white'}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${ACCENT[d].soft}`}>
          <DisciplineIcon d={d} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="font-semibold">{label(d)}</h3>
            <span className={`text-caption ${score === 1 ? 'text-green-strong' : score === 0.5 ? 'text-blue' : 'text-muted'}`}>{SCORE_LABEL[score]}</span>
            {stat.streak > 0 && (
              <span className="tabular ml-auto flex items-center gap-1 text-caption text-muted" aria-label={`${stat.streak} day streak`}>
                <Flame size={14} aria-hidden /> {stat.streak}
              </span>
            )}
          </div>
          <p className="truncate text-[15px] text-muted">{statusLine(d, view)}</p>
        </div>
        <button
          type="button"
          onClick={() => openSheet(d)}
          aria-label={`Log ${label(d).toLowerCase()}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green text-black transition active:scale-95"
        >
          <Plus size={24} strokeWidth={2} />
        </button>
      </div>

      {d === 'food' && (
        <div className="mt-2 flex items-center justify-between gap-2 text-caption">
          <span>
            Day <span className="tabular font-semibold">{view.plan.run}</span> of {view.plan.target} on plan
          </span>
          <span className="tabular text-muted">{view.plan.total} plan days total</span>
        </div>
      )}
      {d === 'food' && view.meal3Due && (
        <Button variant="secondary" className="mt-2 w-full" onClick={() => openSheet('food')}>
          Workout done. Log Meal 3
        </Button>
      )}
      {d === 'finance' && (
        <div className="mt-2">
          <div className="flex justify-between text-caption">
            <span className="tabular">
              {money(view.month.spent, view.settings.currency)} of {money(view.month.budget, view.settings.currency)}
            </span>
            <span className={overPace ? 'text-red' : 'text-muted'}>{overPace ? 'Ahead of pace' : 'On pace'}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface" aria-hidden>
            <div className={`h-full ${overPace ? 'bg-red' : 'bg-finance'}`} style={{ width: `${monthPct}%` }} />
          </div>
        </div>
      )}
      <span className="sr-only">
        {statName(d)} level {stat.level}
      </span>
    </article>
  );
}
