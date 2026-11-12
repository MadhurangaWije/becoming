import { motion } from 'framer-motion';
import { TrendingDown } from 'lucide-react';
import type { Discipline } from '@/domain/types';
import { levelProgress } from '@/domain/xp';
import { ACCENT, DisciplineIcon, statName } from './discipline';

export function StatBar({ d, xp, fading, compact }: { d: Discipline; xp: number; fading?: boolean; compact?: boolean }) {
  const p = levelProgress(xp);
  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-medium">
          <DisciplineIcon d={d} size={compact ? 18 : 24} />
          {statName(d)}
          {fading && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-soft px-2 py-0.5 text-caption text-red">
              <TrendingDown size={14} aria-hidden /> fading
            </span>
          )}
        </span>
        <span className="tabular text-caption text-muted">
          Lv <span className="text-body font-semibold text-text">{p.level}</span>
          {!compact && <> · {p.toNext} XP to next</>}
        </span>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-surface"
        role="progressbar"
        aria-label={`${statName(d)} level ${p.level}`}
        aria-valuemin={0}
        aria-valuemax={p.needed}
        aria-valuenow={p.intoLevel}
      >
        <motion.div
          className={`h-full rounded-full ${ACCENT[d].bg} ${fading ? 'opacity-40' : ''}`}
          initial={false}
          animate={{ width: `${Math.max(2, p.fraction * 100)}%` }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
