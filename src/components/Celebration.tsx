import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Award, Check, Sparkles, Trophy } from 'lucide-react';
import { useEffect } from 'react';
import { useUi } from '@/app/uiStore';

const ICONS = { 'level-up': Sparkles, 'perfect-day': Check, badge: Award, hundred: Trophy };

/** Short full-screen celebration: under 2 seconds, skippable by tap, respects reduced motion. */
export function CelebrationLayer() {
  const current = useUi((s) => s.celebrations[0]);
  const next = useUi((s) => s.shiftCelebration);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(next, 1800);
    return () => clearTimeout(t);
  }, [current, next]);

  const Icon = current ? ICONS[current.kind] : Sparkles;
  return (
    <AnimatePresence>
      {current && (
        <motion.button
          type="button"
          key={current.title + current.kind}
          onClick={next}
          aria-live="assertive"
          aria-label={`${current.title}. ${current.subtitle ?? ''} Tap to continue.`}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black px-8 text-center text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            initial={reduce ? false : { scale: 0.4, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14 }}
            className="flex h-24 w-24 items-center justify-center rounded-full bg-green text-black"
          >
            <Icon size={48} strokeWidth={1.5} />
          </motion.div>
          <motion.h2 initial={reduce ? false : { y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="text-title">
            {current.title}
          </motion.h2>
          {current.subtitle && <p className="text-body text-white/80">{current.subtitle}</p>}
          <span className="absolute bottom-10 text-caption text-white/60">Tap to continue</span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
