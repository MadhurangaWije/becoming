import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import type { Discipline, Score } from '@/domain/types';
import { DISCIPLINES } from '@/domain/types';
import { ACCENT, SCORE_LABEL, label } from './discipline';

/**
 * Day ring with four quarters (clockwise from top: food, workout, learning, finance).
 * Each quarter is filled for Full, half-filled for Minimum, empty for Miss.
 */
export function Ring({ scores, size = 168, centre }: { scores: Record<Discipline, Score>; size?: number; centre?: React.ReactNode }) {
  const stroke = size * 0.1;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = c * 0.02;
  const quarter = c / 4 - gap;
  const perfect = DISCIPLINES.every((d) => scores[d] === 1);
  const summary = DISCIPLINES.map((d) => `${label(d)} ${SCORE_LABEL[scores[d]]}`).join(', ');

  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`Today: ${summary}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {DISCIPLINES.map((d, i) => {
          const offset = -(i * (c / 4) + gap / 2);
          return (
            <g key={d}>
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-border" strokeDasharray={`${quarter} ${c - quarter}`} strokeDashoffset={offset} strokeLinecap="round" />
              <motion.circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                strokeWidth={stroke}
                className={ACCENT[d].stroke}
                strokeLinecap="round"
                strokeDashoffset={offset}
                initial={false}
                animate={{ strokeDasharray: `${quarter * scores[d]} ${c - quarter * scores[d]}`, opacity: scores[d] ? 1 : 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              />
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {centre ?? (perfect ? <Check size={40} className="text-green-strong" aria-hidden /> : null)}
      </div>
    </div>
  );
}

/** Small legend that pairs each colour with an icon-free label and the score word. */
export function RingLegend({ scores }: { scores: Record<Discipline, Score> }) {
  return (
    <ul className="grid grid-cols-1 gap-x-4 gap-y-1 text-caption min-[480px]:grid-cols-2">
      {DISCIPLINES.map((d) => (
        <li key={d} className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${ACCENT[d].bg}`} aria-hidden />
          <span>{label(d)}</span>
          <span className="ml-auto whitespace-nowrap text-muted min-[480px]:ml-0">{SCORE_LABEL[scores[d]]}</span>
        </li>
      ))}
    </ul>
  );
}
