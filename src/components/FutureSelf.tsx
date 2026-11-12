import type { Mood } from '@/domain/futureSelf';
import type { Discipline } from '@/domain/types';

/**
 * The future-self figure. Clarity tracks the overall title tier (0 Rookie .. 5 Master):
 * a faint dashed outline at tier 0, more solid and detailed at each tier, fully formed at Master.
 * Parts map to disciplines: head = Mind, torso = Fuel, arms/legs = Body, ground/base = Wealth.
 * A fading stat dims its part.
 */
export function FutureSelfFigure({ tier, mood, fading, size = 96 }: { tier: number; mood: Mood; fading: Set<Discipline>; size?: number }) {
  const t = Math.max(0, Math.min(5, tier));
  const base = 0.35 + t * 0.13; // opacity
  const dash = t === 0 ? '4 4' : t === 1 ? '8 3' : undefined;
  const sw = 2 + t * 0.35;
  const part = (d: Discipline) => (fading.has(d) ? base * 0.35 : base);
  const fillOp = t >= 3 ? 0.08 + (t - 3) * 0.06 : 0;

  const mouth: Record<Mood, string> = {
    proud: 'M44 37 Q50 43 56 37',
    steady: 'M45 38 Q50 40 55 38',
    concerned: 'M45 39 L55 39',
    disappointed: 'M44 41 Q50 36 56 41',
  };
  const brows: Record<Mood, [string, string]> = {
    proud: ['M41 25 L47 24', 'M53 24 L59 25'],
    steady: ['M41 25 L47 25', 'M53 25 L59 25'],
    concerned: ['M41 24 L47 26', 'M53 26 L59 24'],
    disappointed: ['M41 26 L47 24', 'M53 24 L59 26'],
  };

  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 100 120" role="img" aria-label={`Your future self, looking ${mood}`} className="text-text">
      <g fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash}>
        {/* Wealth: ground */}
        <path d="M18 114 H82" opacity={part('finance')} />
        {t >= 4 && <path d="M28 118 H72" opacity={part('finance') * 0.6} />}
        {/* Body: legs and arms */}
        <g opacity={part('workout')}>
          <path d="M42 84 L38 112" />
          <path d="M58 84 L62 112" />
          <path d="M34 54 Q24 66 26 80" />
          <path d="M66 54 Q76 66 74 80" />
        </g>
        {/* Fuel: torso */}
        <path d="M34 52 Q50 46 66 52 L60 86 Q50 89 40 86 Z" opacity={part('food')} fill="currentColor" fillOpacity={fillOp} />
        {t >= 2 && <path d="M50 54 V82" opacity={part('food') * 0.4} />}
        {/* Mind: head */}
        <g opacity={part('learning')}>
          <circle cx="50" cy="31" r="16" fill="currentColor" fillOpacity={fillOp} />
          {t >= 1 && (
            <>
              <circle cx="44" cy="30" r="1.4" fill="currentColor" stroke="none" />
              <circle cx="56" cy="30" r="1.4" fill="currentColor" stroke="none" />
              <path d={mouth[mood]} strokeDasharray={undefined} strokeWidth={2} />
            </>
          )}
          {t >= 2 && (
            <>
              <path d={brows[mood][0]} strokeWidth={1.6} strokeDasharray={undefined} />
              <path d={brows[mood][1]} strokeWidth={1.6} strokeDasharray={undefined} />
            </>
          )}
          {t >= 5 && <path d="M38 14 L44 8 L50 13 L56 8 L62 14" strokeWidth={2} className="text-green-strong" stroke="currentColor" />}
        </g>
      </g>
    </svg>
  );
}
