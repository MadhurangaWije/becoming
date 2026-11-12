import { useLiveQuery } from 'dexie-react-hooks';
import { Award, Flame, Lock, Snowflake, Trophy } from 'lucide-react';
import { useTodayView } from '@/app/hooks';
import { FutureSelfFigure } from '@/components/FutureSelf';
import { StatBar } from '@/components/StatBar';
import { DisciplineIcon, label } from '@/components/discipline';
import { Card, SectionTitle } from '@/components/ui';
import { BADGES } from '@/domain/badges';
import { config, TITLES } from '@/domain/config';
import { DISCIPLINES } from '@/domain/types';
import { db } from '@/data/db';

export function StatsView() {
  const view = useTodayView();
  const badges = useLiveQuery(() => db.badges.toArray(), []);
  if (!view) return null;
  const earned = new Map((badges ?? []).map((b) => [b.badgeId, b.earnedOn]));
  const fading = new Set(DISCIPLINES.filter((d) => view.stats[d].fading));
  const nextTitle = TITLES.find((t) => t.level > view.overall.level);

  return (
    <div>
      <Card className="flex items-center gap-4">
        <FutureSelfFigure tier={view.overall.tier} mood={view.mood} fading={fading} size={72} />
        <div>
          <p className="text-caption text-muted">Overall level</p>
          <p className="tabular text-title">{view.overall.level}</p>
          <p className="font-semibold">{view.overall.title}</p>
          {nextTitle && <p className="text-caption text-muted">Next: {nextTitle.title} at level {nextTitle.level}. The weakest stat sets the pace.</p>}
        </div>
      </Card>

      <SectionTitle>Stats</SectionTitle>
      <Card className="space-y-4">
        {DISCIPLINES.map((d) => (
          <StatBar key={d} d={d} xp={view.stats[d].xp} fading={view.stats[d].fading} />
        ))}
      </Card>

      <SectionTitle>Streaks</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        {DISCIPLINES.map((d) => (
          <Card key={d} className="!p-3">
            <p className="flex items-center gap-2 text-caption text-muted">
              <DisciplineIcon d={d} size={18} /> {label(d)}
            </p>
            <p className="mt-1 flex items-center gap-1">
              <Flame size={18} aria-hidden className="text-green-strong" />
              <span className="tabular text-card">{view.stats[d].streak}</span>
              <span className="text-caption text-muted">current</span>
            </p>
            <p className="flex items-center gap-1 text-caption text-muted">
              <Trophy size={14} aria-hidden /> best <span className="tabular">{view.stats[d].longestStreak}</span>
            </p>
          </Card>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[15px]">
        <span className="flex items-center gap-1">
          <Snowflake size={18} className="text-blue" aria-hidden /> <span className="tabular font-semibold">{view.settings.streakFreezes}</span> of {config.freezes.max} freezes
        </span>
        <span className="flex items-center gap-1">
          <Flame size={18} aria-hidden /> <span className="tabular font-semibold">{view.perfectStreak}</span> perfect-day streak
        </span>
        <span className="flex items-center gap-1">
          Best plan run <span className="tabular font-semibold">{view.plan.best}</span>
        </span>
      </div>

      <SectionTitle>
        Badges <span className="text-caption text-muted">{earned.size} of {BADGES.length}</span>
      </SectionTitle>
      <ul className="grid grid-cols-2 gap-3 min-[600px]:grid-cols-3">
        {BADGES.map((b) => {
          const on = earned.get(b.id);
          return (
            <li key={b.id} className={`rounded-card border p-3 ${on ? 'border-green/50 bg-green-soft' : 'border-border text-muted'}`}>
              <p className="flex items-center gap-2 font-semibold">
                {on ? <Award size={18} className="text-green-strong" aria-hidden /> : <Lock size={16} aria-hidden />}
                <span className={on ? 'text-text' : ''}>{b.name}</span>
              </p>
              <p className="mt-1 text-caption">{b.description}</p>
              {on && <p className="mt-1 text-caption text-green-strong">Earned {on}</p>}
              <span className="sr-only">{on ? 'Earned' : 'Locked'}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
