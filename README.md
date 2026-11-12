# Becoming

Offline-first React PWA that tracks four daily disciplines (Food, Workout, Learning, Finance), turns them into game stats, and has your future self call you out when you drift. Implements `Becoming Implementation Spec.md`.

## Run

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit + integration + UI smoke tests
npm run coverage   # domain coverage
npm run build      # production bundle + service worker in dist/
npm run preview    # serve dist/ (test install/offline here)
npm run icons      # regenerate PNG icons (no dependencies)
```

Dev builds have a **Debug** section at the bottom of Settings: set the clock (to test day close, decay, streaks) and seed 90 days of realistic data.

## Your data

All data lives on the device (IndexedDB). **Settings → Export backup** saves everything to one JSON file (on phones it opens the share sheet: Save to Files, Drive, AirDrop, email). On a new phone, choose **Restore from backup** on the first onboarding screen. The file format is documented in [docs/backup-format.md](docs/backup-format.md), which is also the contract for migrating to a backend later.

## Layout

```
src/domain/     pure logic, no I/O; time is always passed in
  config.ts     every tunable number (user overrides in settings.overrides)
  scoring.ts xp.ts streaks.ts badges.ts closeDay.ts stats.ts futureSelf.ts weeklyReview.ts
  rules/        one file per companion rule + engine.ts (cooldown, daily cap)
  messages.ts   template bank (4+ variants per rule) + MessageWriter seam
src/data/       Dexie schema, repos (all writes), backup.ts (versioned JSON)
src/services/   dayClose, companion runner, parser.ts (saveEntries funnel + EntryParser seam),
                notifications (scheduleReminder/cancelReminder seam), clock, snapshot (view models)
src/features/   today, log, progress, companion, settings, onboarding
src/components/ Ring, StatBar, Sheet, Heatmap, FutureSelf figure, Celebration, ui primitives
```

## Interpretation notes

Places where the spec left room and a choice was made:

- **Food violations** are counted per entry: an extra eaten late with high carbs is one violation, not three.
- **Late-night logs** (before `dayCloseHour`) count as after the eating cutoff.
- **"24-hour" cooldown** for day-close rules means "not on the same evaluated day", so catching up several days still produces one message per day. Live triggers (onLog/onOpen) also use a real 24-hour window.
- **Streak freezes** are only spent when there is a streak to protect, in discipline order (food, workout, learning, finance).
- **Decay** is clamped against XP after that day's gains, so it never crosses the current level's floor.
- **Hundred Days** is one badge; each further 100 gets a `plan-hundred` celebration message and the target moves on.
- Extra rules beyond the 6.2/6.3 tables, required elsewhere in the spec: `plan-hundred` (4.2), `backup-stale` (8), `welcome-back` (5.6).
- Re-closing an edited past day recomputes that day's scores and XP only; later days' streak math is not replayed.
