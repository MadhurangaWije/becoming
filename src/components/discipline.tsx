import { BookOpen, Dumbbell, Utensils, Wallet, type LucideIcon } from 'lucide-react';
import { DISCIPLINE_LABELS, STAT_NAMES } from '@/domain/config';
import type { Discipline, Score } from '@/domain/types';

export const DISCIPLINE_ICON: Record<Discipline, LucideIcon> = {
  food: Utensils,
  workout: Dumbbell,
  learning: BookOpen,
  finance: Wallet,
};

/** Tailwind classes per discipline accent (tokens only). */
export const ACCENT: Record<Discipline, { text: string; bg: string; stroke: string; fill: string; soft: string }> = {
  food: { text: 'text-green-strong', bg: 'bg-food', stroke: 'stroke-food', fill: 'fill-food', soft: 'bg-green-soft' },
  workout: { text: 'text-workout', bg: 'bg-workout', stroke: 'stroke-workout', fill: 'fill-workout', soft: 'bg-blue-soft' },
  learning: { text: 'text-[rgb(var(--acc-learning))]', bg: 'bg-learning', stroke: 'stroke-learning', fill: 'fill-learning', soft: 'bg-blue-soft' },
  finance: { text: 'text-finance', bg: 'bg-finance', stroke: 'stroke-finance', fill: 'fill-finance', soft: 'bg-surface' },
};

export const label = (d: Discipline) => DISCIPLINE_LABELS[d];
export const statName = (d: Discipline) => STAT_NAMES[d];

export const SCORE_LABEL: Record<Score, string> = { 1: 'Full', 0.5: 'Minimum', 0: 'Not yet' };

export function DisciplineIcon({ d, size = 24, className = '' }: { d: Discipline; size?: number; className?: string }) {
  const Icon = DISCIPLINE_ICON[d];
  return <Icon size={size} strokeWidth={1.5} className={`${ACCENT[d].text} ${className}`} aria-hidden />;
}
