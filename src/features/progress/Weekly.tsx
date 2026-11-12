import { useLiveQuery } from 'dexie-react-hooks';
import { Lightbulb } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSettings } from '@/app/hooks';
import { DisciplineIcon, label, statName } from '@/components/discipline';
import { Card, Chip, Empty, SectionTitle, money } from '@/components/ui';
import { addDays, parseDay } from '@/domain/dates';
import type { Discipline } from '@/domain/types';
import { DISCIPLINES } from '@/domain/types';
import { buildWeeklyReview, weeklyLetter } from '@/domain/weeklyReview';
import { db } from '@/data/db';
import { reviewsRepo } from '@/data/repos';

const fmt = (d: string) => parseDay(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export function WeeklyView() {
  const settings = useSettings();
  const reviews = useLiveQuery(() => reviewsRepo.all(), []);
  const [weekStart, setWeekStart] = useState<string>();
  useEffect(() => {
    if (!weekStart && reviews?.length) setWeekStart(reviews[0].weekStart);
  }, [reviews, weekStart]);

  const data = useLiveQuery(async () => {
    if (!weekStart || !settings) return null;
    const end = addDays(weekStart, 6);
    const [records, xp, expenses, review, insights] = await Promise.all([
      db.dayRecords.where('day').between(weekStart, end, true, true).toArray(),
      db.xpEvents.where('day').between(weekStart, end, true, true).toArray(),
      db.expense.where('day').between(addDays(weekStart, -31), end, true, true).toArray(),
      reviewsRepo.get(weekStart),
      db.messages.where('day').equals(end).filter((m) => m.ruleId === 'lopsided' || m.ruleId === 'weak-weekday').toArray(),
    ]);
    return { review: buildWeeklyReview(weekStart, records.filter((r) => r.closedAt), xp, expenses, settings.monthlyBudget), saved: review, insights };
  }, [weekStart, settings]);

  if (!settings) return null;
  if (!reviews?.length) return <Empty>Your first weekly review arrives once a full week (Monday to Sunday) has closed. Keep logging.</Empty>;

  const focus = data?.saved?.focus;
  const r = data?.review;

  return (
    <div>
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Week">
        {reviews.map((w) => (
          <Chip key={w.id} selected={w.weekStart === weekStart} onClick={() => setWeekStart(w.weekStart)} role="tab" aria-selected={w.weekStart === weekStart}>
            {fmt(w.weekStart)}
          </Chip>
        ))}
      </div>
      {r && (
        <>
          <Card className="bg-surface">
            <p className="mb-1 text-caption text-muted">A note from Future {settings.name}</p>
            <p className="whitespace-pre-line">{weeklyLetter(r, settings.name, focus)}</p>
          </Card>

          <SectionTitle>
            {fmt(r.weekStart)} to {fmt(r.weekEnd)}
          </SectionTitle>
          <Card>
            <table className="w-full text-left text-[15px]">
              <caption className="sr-only">Days full and XP per discipline</caption>
              <thead className="text-caption text-muted">
                <tr>
                  <th className="pb-2 font-medium">Discipline</th>
                  <th className="pb-2 text-right font-medium">Full days</th>
                  <th className="pb-2 text-right font-medium">XP earned</th>
                  <th className="pb-2 text-right font-medium">XP lost</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {DISCIPLINES.map((d) => (
                  <tr key={d} className="border-t border-border">
                    <td className="py-2">
                      <span className="flex items-center gap-2">
                        <DisciplineIcon d={d} size={18} /> {label(d)}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      {r.fullDays[d]} / {r.daysTracked}
                    </td>
                    <td className="py-2 text-right text-green-strong">+{r.xpEarned[d]}</td>
                    <td className={`py-2 text-right ${r.xpLost[d] ? 'text-red' : 'text-muted'}`}>{r.xpLost[d] ? `-${r.xpLost[d]}` : '0'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Card className="!p-3">
              <p className="text-caption text-muted">Best day</p>
              <p className="font-semibold">{r.bestDay ? `${parseDay(r.bestDay.day).toLocaleDateString('en-GB', { weekday: 'long' })}, ${Math.round(r.bestDay.avg * 100)}%` : 'None'}</p>
            </Card>
            <Card className="!p-3">
              <p className="text-caption text-muted">Weakest</p>
              <p className="font-semibold">{r.weakest ? `${label(r.weakest)} (${statName(r.weakest)})` : 'None'}</p>
            </Card>
            <Card className="col-span-2 !p-3">
              <p className="text-caption text-muted">Month to date vs budget pace</p>
              <p className="tabular">
                <span className={`font-semibold ${r.monthSpend > r.monthPace ? 'text-red' : ''}`}>{money(r.monthSpend, settings.currency)}</span> spent, pace {money(r.monthPace, settings.currency)}
              </p>
            </Card>
          </div>

          {!!data?.insights.length && (
            <>
              <SectionTitle>Insights</SectionTitle>
              <ul className="space-y-2">
                {data.insights.map((m) => (
                  <li key={m.id} className="flex gap-2 rounded-card bg-blue-soft p-3">
                    <Lightbulb size={20} className="shrink-0 text-blue" aria-hidden />
                    {m.text}
                  </li>
                ))}
              </ul>
            </>
          )}

          <SectionTitle>Pick one focus for next week</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {DISCIPLINES.map((d: Discipline) => (
              <Chip key={d} selected={focus === d} onClick={() => reviewsRepo.setFocus(r.weekStart, d)}>
                <DisciplineIcon d={d} size={18} /> {label(d)}
              </Chip>
            ))}
          </div>
          {focus && <p className="mt-2 text-caption text-muted">Saved. It shows on Today all next week.</p>}
        </>
      )}
    </div>
  );
}
