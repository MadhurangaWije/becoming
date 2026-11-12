import { memo, useEffect, useMemo, useRef } from 'react';
import { addDays, parseDay, weekStart } from '@/domain/dates';
import type { DayKey, DayRecord, Discipline } from '@/domain/types';
import { DISCIPLINES } from '@/domain/types';
import { ACCENT } from './discipline';

export type HeatFilter = Discipline | 'all';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Year heatmap: 53 Monday-start weeks ending at `today`. Intensity = score (or sum of four for All). */
export const Heatmap = memo(function Heatmap({
  records,
  today,
  filter,
  selected,
  onSelect,
}: {
  records: DayRecord[];
  today: DayKey;
  filter: HeatFilter;
  selected?: DayKey;
  onSelect: (day: DayKey) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth;
  }, [today]);
  const byDay = useMemo(() => new Map(records.map((r) => [r.day, r])), [records]);
  const start = addDays(weekStart(today), -52 * 7);
  const cell = 12;
  const gap = 3;
  const weeks = 53;
  const top = 16;
  const fillClass = filter === 'all' ? 'fill-green' : ACCENT[filter].fill;

  const cells: JSX.Element[] = [];
  const months: JSX.Element[] = [];
  let lastMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const wkStart = addDays(start, w * 7);
    const m = parseDay(wkStart).getMonth();
    if (m !== lastMonth) {
      months.push(
        <text key={`m${w}`} x={w * (cell + gap)} y={10} className="fill-muted" fontSize={10}>
          {MONTHS[m]}
        </text>,
      );
      lastMonth = m;
    }
    for (let d = 0; d < 7; d++) {
      const day = addDays(wkStart, d);
      if (day > today) continue;
      const r = byDay.get(day);
      const value = !r ? 0 : filter === 'all' ? DISCIPLINES.reduce((s, k) => s + r.scores[k], 0) / 4 : r.scores[filter];
      const label = !r ? `${day}: no data` : filter === 'all' ? `${day}: ${Math.round(value * 100)}%` : `${day}: ${value === 1 ? 'Full' : value === 0.5 ? 'Minimum' : 'Miss'}`;
      cells.push(
        <g key={day} onClick={() => onSelect(day)} className="cursor-pointer">
          <title>{label}</title>
          <rect x={w * (cell + gap)} y={top + d * (cell + gap)} width={cell} height={cell} rx={3} className="fill-surface" />
          {value > 0 && <rect x={w * (cell + gap)} y={top + d * (cell + gap)} width={cell} height={cell} rx={3} className={fillClass} opacity={0.25 + value * 0.75} />}
          {selected === day && <rect x={w * (cell + gap) - 1} y={top + d * (cell + gap) - 1} width={cell + 2} height={cell + 2} rx={4} fill="none" className="stroke-text" strokeWidth={1.5} />}
        </g>,
      );
    }
  }

  return (
    <div ref={scroller} className="overflow-x-auto pb-2">
      <svg width={weeks * (cell + gap)} height={top + 7 * (cell + gap)} role="img" aria-label="Year heatmap. Use Jump to day for keyboard access.">
        {months}
        {cells}
      </svg>
    </div>
  );
});
