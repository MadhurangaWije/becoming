# Becoming: Implementation Spec

Nov 12, 2026 · @Kanishka Wijesekara

## 1. Overview

Becoming is a single-user, offline-first React PWA that tracks four daily disciplines, turns them into game stats, and calls the user out when they drift. It installs on a phone home screen and also runs as a normal web app on desktop.

The four disciplines and their stats:

| Discipline | Stat | Daily goal (default, editable) |
| --- | --- | --- |
| Food: eat healthy | Fuel | Follow the 3-meal plan (about 1,750 kcal and 155 g protein a day); nothing outside the plan; nothing after 6pm |
| Workout: move every day | Body | 30 minutes minimum of any workout; 90 minutes is the bonus cap |
| Learning: learn something new daily | Mind | At least 1 learning entry |
| Finance: mindful spending | Wealth | Every expense logged and tagged, every day; month's spend within the 150,000 LKR monthly budget |

**In scope for v1**

- Structured daily logging for all four disciplines
- Stats, XP, levels, decay, streaks and badges
- A rules-based companion that detects deviation and sends escalating messages
- Progress views: day ring, year heatmap, weekly review
- Install, offline use, local reminders, JSON export and import

**Out of scope for v1**

- Any LLM or free-text parsing (see section 10)
- Accounts, backend, cloud sync, multi-user or social features
- Calorie or macro counting, bank integrations, wearable integrations

**Product principles**

- Logging one item takes under 10 seconds and at most 3 taps plus optional text.
- The app never needs a network connection after first load.
- The companion speaks as the user's future self: honest about slips, proud of wins, never insulting.

## 2. Tech stack and architecture

The app is a static client-side bundle. All data is stored on the device in the browser's IndexedDB; there is no server, backend or external database. IndexedDB is used instead of localStorage because localStorage is capped at about 5 MB, stores only strings and cannot be queried by day.

| Concern | Choice |
| --- | --- |
| Framework | React 18+ with TypeScript, built with Vite |
| PWA | `vite-plugin-pwa` (Workbox): precache the app shell, web app manifest, update prompt |
| Storage | IndexedDB through Dexie, with `dexie-react-hooks` for live queries |
| State | Dexie live queries for persisted data; Zustand for UI state only |
| Routing | React Router |
| Styling | Tailwind CSS, mobile-first, light theme with design tokens (see 7.1) |
| Charts | Hand-rolled SVG for ring and heatmap; Recharts only if a trend chart needs it |
| Animation | Framer Motion for level-up and ring-fill moments |
| Dates | date-fns; all day keys are local-time `YYYY-MM-DD` strings |
| Tests | Vitest for engines; React Testing Library for key flows |

**Layering**

Keep game and companion logic as pure TypeScript with no React or Dexie imports, so it is unit-testable and reusable.

```
src/
  domain/          # pure logic, no I/O
    types.ts       # all entities from section 3
    scoring.ts     # day score per discipline
    xp.ts          # XP, levels, decay
    streaks.ts
    badges.ts
    rules/         # one file per companion rule + engine.ts
    messages.ts    # template bank and picker
  data/
    db.ts          # Dexie schema and migrations
    repos/         # typed read/write functions per table
    backup.ts      # export / import JSON
  services/
    dayClose.ts    # end-of-day evaluation (see 5.6)
    notifications.ts
    parser.ts      # EntryParser interface, manual impl only (see 10)
  features/
    today/  log/  progress/  companion/  settings/  onboarding/
  components/      # shared UI: Ring, StatBar, Sheet, Chip, Heatmap
  app/             # router, layout, providers
```

**Rules for the implementation**

- Every function in `domain/` takes data in and returns data out. Time is passed in as an argument, never read from `Date.now()` inside.
- All tunable numbers (XP values, thresholds, decay rates) live in one `domain/config.ts` object, with user overrides stored in `settings`.
- Derived values (day score, level) are recomputed from logs; only XP events and messages are stored as history.

## 3. Data model

Nine Dexie tables hold everything; all records carry `id` (uuid), `createdAt` and `updatedAt` (ISO strings).

```ts
type Discipline = 'food' | 'workout' | 'learning' | 'finance';
type DayKey = string; // 'YYYY-MM-DD' in local time

interface MealSlot {                // one planned meal, defined in settings
  key: 'meal1' | 'meal2' | 'meal3';
  label: string;                    // e.g. "First meal"
  windowStart: string;              // 'HH:mm'
  windowEnd: string;                // 'HH:mm'
  plan: string;                     // e.g. "Eggs + lime + salad"
  postWorkout: boolean; proteinG: number; kcal: number;             // true = no fixed window, follows the workout
}

interface FoodEntry {
  id: string; day: DayKey;
  slot: 'meal1' | 'meal2' | 'meal3' | 'extra'; // extra = anything outside the plan
  description: string;              // what was actually eaten
  rating: 'on_plan' | 'close' | 'off_plan';
  carbs: 'low' | 'moderate' | 'high';
  protein: boolean;                 // a real protein source was included
  veggies: boolean;                 // vegetables or salad were included
  time: string;                     // 'HH:mm', defaults to now; used for the eating cutoff
}

interface WorkoutEntry {
  id: string; day: DayKey;
  kind: 'gym' | 'home' | 'run' | 'walk' | 'sport' | 'yoga' | 'other';
  minutes: number;
  intensity: 'light' | 'moderate' | 'hard';
  notes?: string;                   // e.g. "chest and back"
}

interface LearningEntry {
  id: string; day: DayKey;
  summary: string;                  // "Today I learned..."
  topic?: string;                   // user-defined tag, autocompleted from history
  source?: 'book' | 'course' | 'video' | 'article' | 'practice' | 'other';
  minutes?: number;
}

interface ExpenseEntry {
  id: string; day: DayKey;
  amount: number;                   // in settings.currency
  category: string;                 // from settings.expenseCategories
  tag: 'need' | 'want' | 'regret';
  note?: string;
}

interface DayRecord {               // one per day, written at day close
  day: DayKey;                      // primary key
  scores: Record<Discipline, 0 | 0.5 | 1>;  // miss, minimum, full
  noSpendDay: boolean;
  closedAt?: string;                // set once the day is evaluated
  usedFreeze: Discipline[];         // streak freezes consumed
  reflection?: string;              // optional one-line note
}

interface XpEvent {                 // append-only ledger
  id: string; day: DayKey; discipline: Discipline;
  amount: number;                   // negative for decay
  reason: 'log' | 'goal_met' | 'bonus' | 'streak' | 'perfect_day' | 'decay' | 'comeback';
}

interface CompanionMessage {
  id: string; day: DayKey;
  ruleId: string;
  discipline?: Discipline;
  severity: 'praise' | 'nudge' | 'warning' | 'intervention';
  text: string;
  readAt?: string;
  response?: string;                // user's answer to an intervention
}

interface Badge { id: string; badgeId: string; earnedOn: DayKey; }

interface Settings {                // single row, id = 'me'
  name: string;
  currency: string;                 // 'LKR'
  monthlyBudget: number;            // default 150000
  expenseCategories: string[];
  weekStartsOn: 'monday';
  goals: {
    food: { mealPlan: MealSlot[]; eatingCutoff: string; postWorkoutMealCutoff: string }; // 'HH:mm', defaults '18:00' and '18:30'
    workout: { minMinutes: number; bonusCapMinutes: number };
    learning: { minEntries: number };
  };
  whys: Record<Discipline, string>; // the user's reason for each goal
  futureSelf: {
    horizonDate: DayKey;            // default: 1 year after onboarding
    statement: string;              // one or two lines: who I am by then
    identities: Record<Discipline, string>; // e.g. food: "I eat clean without thinking about it"
  };
  reminderTimes: { midday?: string; evening: string }; // 'HH:mm'
  dayCloseHour: number;             // default 3 (3am), late-night logs count for the previous day
  streakFreezes: number;            // current balance
  onboardedAt?: string;
}
```

**Indexes**

- Entry tables: `id`, `day`
- `xpEvents`: `id`, `day`, `discipline`
- `messages`: `id`, `day`, `ruleId`, `readAt`
- `dayRecords`: `day`

**Notes**

- Entries can be added or edited for today and the previous 2 days. Editing a closed day re-runs day close for that day and replaces its XP events.
- Default expense categories: Groceries, Eating out, Transport, Bills, Shopping, Health, Entertainment, Other.

* A tenth table, `weeklyReviews` (`weekStart: DayKey`, `focus?: Discipline`, `generatedAt`), stores the focus picked in the weekly review (section 7).

## 4. Daily logging

Logging is structured quick entry: taps for the fields the app scores on, plus a short free-text field for what actually happened. Each discipline card on the Today screen opens a bottom sheet.

| Discipline | Required input | Optional input | Shortcuts |
| --- | --- | --- | --- |
| Food | Meal slot; one tap for "Ate as planned", or description, rating, carbs, protein and veggies for a variation (see 4.1) | Time, if not now | Planned meal prefilled per slot; recent variations as one-tap chips |
| Workout | Kind, minutes, intensity | Notes | Built-in timer that fills minutes on stop; minute presets 15 / 30 / 45 / 60 / 90; "repeat last workout" |
| Learning | Summary text ("Today I learned...") | Topic tag, source, minutes | Topic autocomplete from past entries |
| Finance | Amount, category, tag (need / want / regret) | Note | Numeric keypad first; last-used category preselected; "No spend today" button |

**Behaviour**

- A discipline can have many entries per day. Each sheet lists today's entries with edit and delete.
- Saving an entry immediately recomputes the day's provisional score and updates the ring and stat bars.
- The meal slot defaults from the time of day; the day defaults to today, with a date switcher limited to the previous 2 days.
- Tagging an expense as regret prompts for a one-line note (skippable).
- "No spend today" sets a flag on the day and is cleared automatically if an expense is added.
- Voice input is not custom-built; the text fields simply allow the keyboard's dictation.

**Validation**

- Workout minutes: 1 to 300. Expense amount: greater than 0. Description and summary: 2 to 280 characters.

### 4.1 Food plan

Food is tracked against a fixed 3-meal plan, and the main goal is to stick to it for 100 days or more. The plan below is the default `mealPlan` in settings and is editable. It totals about 1,750 kcal and 155 g protein a day.

| Slot | Window | Planned meal | Protein | Calories | Default flags |
| --- | --- | --- | --- | --- | --- |
| Meal 1 | 11:00 to 11:30 | 2 whole eggs + 3 egg whites, 2 slices whole-grain bread, 50 g paneer, a small handful of nuts (about 20 g), salad with lime | about 45 g | about 650 | Carbs moderate, protein yes, veggies yes |
| Meal 2 | 15:00 to 15:30 | 200 g cooked chicken, fish or lean beef (stir-fried in about 1 tbsp oil), 200 g cooked rice, 1 cup of vegetables (mallum, beans, carrot, cabbage and similar) | about 69 g | about 760 | Carbs moderate, protein yes, veggies yes |
| Meal 3 (post-workout) | Right after the workout | Whey isolate shake (1 scoop in water), 170 g plain Greek yogurt, a handful of berries, 1 tsp to 1 tbsp honey | about 42 g | about 325 | Carbs low, protein yes, veggies no |

- **Logging a planned meal:** the food sheet shows the three slots as cards with the planned meal on each. "Ate as planned" logs the slot in one tap with rating `on_plan`, the default flags and the current time.
- **Logging a variation:** "Ate something else" opens the form: description, rating (`on_plan` / `close` / `off_plan`), carbs (low / moderate / high), protein and veggies toggles, time.
- **Anything outside the three meals** is logged in slot `extra` and is always treated as a deviation, whatever its rating.
- **Eating cutoff:** nothing is eaten after 18:00. The only exception is Meal 3, which may run to 18:30 because workouts end by 17:30 at the latest. The food sheet has a visible "I ate after 6pm" button that logs an entry with the current time; any entry after 18:00 (after 18:30 for Meal 3) is recorded as a deviation. Water, plain tea and black coffee are not logged.
- **Meal 3 and the workout:** Meal 3 has no fixed window. Once a workout is logged, Today prompts for Meal 3.
- **Timing:** Meal 1 or Meal 2 logged more than 60 minutes outside its window is flagged as off-window. This does not lower the day score but feeds a companion rule.
- **Protein and calories:** the Today food card shows protein and calories from meals logged as planned against the day's totals, for example "114 of 156 g protein". Variations do not carry numbers in v1.

### 4.2 The 100-day plan challenge

- A plan day is a day with a Full food score (5.1).
- Today shows "Day {n} of 100 on plan", where `n` is the current run of consecutive plan days, plus the total number of plan days since the start.
- A streak freeze (5.5) does not protect this run; only actual plan days count. A broken run restarts at day 1 and the best run is kept.
- Reaching 100 earns the Hundred Days badge and a celebration, and the target moves to the next 100.

## 5. Game system

Each discipline feeds one stat (Fuel, Body, Mind, Wealth). Days are scored, scores earn XP, XP fills levels, and neglect drains the bar. All numbers below are defaults in `domain/config.ts`.

### 5.1 Day score per discipline

| Discipline | Full (1) | Minimum (0.5) | Miss (0) |
| --- | --- | --- | --- |
| Food | All 3 planned meals logged, each `on_plan` or `close` and at least 2 `on_plan`; no `extra` entries; nothing after the cutoff; no `high` carb entry | At least 2 planned meals logged as `on_plan` or `close`, with at most 1 violation (an `extra` entry, an `off_plan` meal, a `high` carb entry, or eating after the cutoff) | Anything less |
| Workout | Total minutes >= `minMinutes` (30) | 10 to 29 minutes | Under 10 minutes |
| Learning | At least `minEntries` (1) entry | Not used | No entry |
| Finance | Every expense logged and tagged, or "No spend today" set; no regret tag | Expenses logged, but at least one tagged regret | Nothing logged and no-spend not set |

The day ring on the Today screen has four quarters. A quarter is filled for Full, half-filled for Minimum, empty for Miss. A perfect day is four Full scores.

### 5.2 XP

| Event | XP | Goes to |
| --- | --- | --- |
| Full score | 20 | That stat |
| Minimum score | 10 | That stat |
| Workout beyond the minimum | +1 per 6 extra minutes, up to +10 at 90 minutes | Body |
| All 3 meals on plan, vegetables in at least 1, no violations | +5 | Fuel |
| Extra learning entries | +5 each, up to +10 | Mind |
| No-spend day | +5 | Wealth |
| Month-to-date spend at or under the monthly budget pace | +5 | Wealth |
| Perfect day | +10 | Each of the four stats |
| Streak milestone (every 7 days) | +25 | That stat |
| Comeback: first Full day after 2 or more misses | +10 | That stat |

XP is awarded at day close (5.6), not per log, so editing entries cannot double-count. The Today screen shows provisional XP for the current day.

### 5.3 Levels

- Every stat starts at level 1 with 0 XP.
- XP needed to go from level `n` to `n + 1` is `100 + 50 * (n - 1)`.
- Overall level is the lowest of the four stat levels, so the weakest discipline holds the character back.
- Overall titles: level 1 Rookie, 3 Apprentice, 5 Disciplined, 8 Relentless, 12 Unshakeable, 16 Master.

### 5.4 Decay

- The first missed day in a discipline costs nothing.
- The second consecutive miss costs 10 XP in that stat; the third and every later consecutive miss costs 15 XP.
- Decay cannot push a stat below the start of its current level. Levels are never lost; the bar empties.
- A stat that decayed today is shown with a visible "fading" state on its bar.

### 5.5 Streaks and freezes

- Each discipline has a streak: consecutive days with a score of 0.5 or more. There is also a perfect-day streak.
- If a day is a miss and the user holds a streak freeze, one freeze is consumed automatically and the streak continues. Decay still applies.
- The user earns 1 freeze each time any discipline streak reaches a multiple of 7. At most 3 can be banked.
- Store the longest streak per discipline for personal-best messages.

### 5.6 Day close

There is no server, so day close runs on the device.

1. On every app open or resume, find all days before today (using `dayCloseHour` as the boundary) that have no `closedAt`.
2. For each, oldest first: compute scores, write the `DayRecord`, apply freezes, update streaks, write XP events including decay, check badges, and run the companion's day-close rules.
3. Days with no app activity at all are closed as four misses.
4. If more than 14 days are unclosed, close them without generating per-day messages and show a single "welcome back" message.

### 5.7 Badges

| Badge | Condition |
| --- | --- |
| First Step | First entry in any discipline |
| Full Ring | First perfect day |
| Week Strong | 7-day streak in a discipline (one badge per discipline) |
| Iron Month | 30-day streak in a discipline (one per discipline) |
| Perfect Week | 7 perfect days in a row |
| Century | 100 workouts logged |
| Scholar | 100 learning entries |
| Clean Plate | 30 Full food days in total |
| Tight Fist | 10 no-spend days |
| Comeback | Full day after 3 or more consecutive misses |
| Balanced | All four stats at level 5 or higher |
| Hundred Days | 100 consecutive plan days (4.2) |

## 6. Companion

The companion is a deterministic rules engine plus a template bank. Rules read the logs and decide what to say; templates decide how to say it. It is presented as the user's future self, a better version of them who already lives these disciplines (see 6.6). It appears on the Today screen and as a message feed on the Coach tab.

### 6.1 Engine

```ts
interface RuleContext {
  now: Date; today: DayKey;
  settings: Settings;
  days: DayRecord[];        // last 35 days, newest first
  entries: { food: FoodEntry[]; workout: WorkoutEntry[]; learning: LearningEntry[]; expense: ExpenseEntry[] }; // last 35 days
  stats: Record<Discipline, { xp: number; level: number; streak: number; longestStreak: number }>;
  recentMessages: CompanionMessage[]; // last 14 days
}

interface RuleResult {
  ruleId: string; discipline?: Discipline;
  severity: 'praise' | 'nudge' | 'warning' | 'intervention';
  vars: Record<string, string | number>; // values for the template
}

interface Rule {
  id: string;
  trigger: 'onLog' | 'onOpen' | 'onDayClose' | 'onWeekClose';
  evaluate(ctx: RuleContext): RuleResult | null;
}
```

- The engine runs all rules for a trigger, then filters: a rule does not fire again for the same discipline within 24 hours, and at most 3 non-praise messages are created per day, highest severity first.
- Praise is never suppressed by the cap.

### 6.2 Deviation rules

| Rule id | Trigger | Condition | Severity |
| --- | --- | --- | --- |
| `not-logged-today` | onOpen, after evening reminder time | A discipline has no entry today | nudge |
| `missed-yesterday` | onDayClose | Score 0 after a non-miss day | nudge |
| `missed-twice` | onDayClose | 2 consecutive misses in a discipline | warning |
| `missed-three-plus` | onDayClose | 3 or more consecutive misses | intervention |
| `off-plan-drift` | onDayClose | Food violations (`extra`, `off_plan`, or after the cutoff) on 3 consecutive days, or 4 or more in the last 3 days | warning |
| `minimum-only` | onDayClose | 5 consecutive days at Minimum, never Full, in a discipline | nudge |
| `over-pace-month` | onDayClose | Month-to-date spend exceeds 110% of the pace (monthly budget x day of month / days in month), or crosses 80% or 100% of the monthly budget | warning |
| `want-heavy` | onDayClose | Want plus regret spending is over 50% of the last 7 days' total | nudge |
| `regret-spend` | onLog | An expense is tagged regret | nudge |
| `lopsided` | onWeekClose | Highest stat level minus lowest is 3 or more, or one stat earned under half the average XP this week | nudge |
| `weak-weekday` | onWeekClose | Over the last 4 weeks, a discipline averages 0.4 or less on one weekday while averaging 0.7 or more overall | nudge |
| `streak-at-risk` | onOpen, after evening reminder time | A streak of 5 or more has no qualifying entry today | warning |

Rules specific to the food plan:

| Rule id | Trigger | Condition | Severity |
| --- | --- | --- | --- |
| `late-eating` | onLog | A food entry is timed after 18:00 (after 18:30 for Meal 3) | nudge; warning if it is the 3rd time in 7 days |
| `carb-creep` | onDayClose | A `high` carb entry on 3 of the last 5 days | warning |
| `low-veggies` | onDayClose | No entry with vegetables on 2 consecutive days | nudge |
| `protein-gap` | onDayClose | A planned meal logged without protein on 2 of the last 3 days | nudge |
| `meal-off-window` | onDayClose | Meal 1 or Meal 2 logged more than 60 minutes outside its window on 3 of the last 7 days | nudge |
| `meal3-pending` | onLog (workout) and onOpen | A workout is logged and Meal 3 is still not logged 45 minutes later, or by 18:00 | nudge |

### 6.3 Praise rules

| Rule id | Trigger | Condition |
| --- | --- | --- |
| `goal-met` | onLog | A discipline reaches Full today (once per discipline per day) |
| `perfect-day` | onLog | All four reach Full |
| `streak-milestone` | onDayClose | A streak reaches 3, 7, 14, 30, 60, 100 |
| `level-up` | onDayClose | A stat or the overall level increases |
| `comeback` | onDayClose | Full day after 2 or more misses |
| `personal-best` | onLog or onDayClose | Longest workout, longest streak, or lowest-spend week so far |
| `badge-earned` | onDayClose | Any new badge |

### 6.4 Escalation and interventions

- **Nudge:** one line on the Today screen and in the feed.
- **Warning:** a card pinned to the top of Today until dismissed. It quotes the user's own "why" for that discipline from settings.
- **Intervention:** a full-screen check-in on next open. It states the facts ("3 days without a workout; Body lost 40 XP"), shows the "why", and asks "What got in the way?" with choices: Too busy, Tired, Forgot, Lost motivation, Other (text). The answer is saved to `response`. It then offers the minimum version for today as a single button that opens the relevant log sheet.

### 6.5 Message templates

- `domain/messages.ts` holds at least 4 variants per rule id, with `{placeholders}` filled from `vars`.
- The picker chooses a variant at random, excluding the one used last time for that rule.
- Voice: the future self speaking to their past self. First person ("I") for the future self, "you" for the user today. Short, specific numbers, no emoji, no guilt-tripping. The future self has already done this and knows it is possible. Examples:
  - `missed-twice` (workout): "Two days without training. I only exist if you keep moving. Ten minutes today is enough to keep me real."
  - `off-plan-drift`: "{count} off-plan meals in 3 days. That is not how I eat, and I am you. Meal 1 tomorrow: {meal1Plan}."
  - `late-eating`: "You ate at {time}. The kitchen closes at {cutoff} for both of us."
  - `streak-milestone`: "{streak} days of learning in a row. I remember this stretch. It is where it started to stick."
  - `comeback`: "You came back after {missed} days off. Of all the days, this is the one I am proudest of."
  - `level-up`: "{stat} just reached level {level}. You are getting closer to me."

### 6.6 Companion persona: the future self

- **Who it is:** the user at `futureSelf.horizonDate` (default 1 year ahead), having kept all four disciplines. It is displayed as "Future {name}".
- **Set up in onboarding:** the user writes a one or two line statement of who they are by then, plus one identity line per discipline (for example "I train every day without negotiating with myself"). Warnings and interventions quote these lines alongside the "why".
- **Visual:** one SVG figure of the future self. Its clarity tracks progress: a faint outline at overall level 1, more solid and detailed at each title threshold in 5.3, fully formed at Master. A stat that is decaying dims the matching part of the figure.
- **Mood:** 4 expressions (proud, steady, concerned, disappointed) derived from the last 3 days: average score 0.85 or more is proud, 0.6 or more steady, 0.35 or more concerned, otherwise disappointed.
- **Distance:** Today shows one line under the figure: "{daysLeft} days until you are me" and the percentage of days so far that were Full in at least 3 disciplines.
- **Weekly letter:** the weekly review opens with a short templated note from the future self, built from that week's best day, weakest discipline and chosen focus.
- **When the horizon date arrives:** show a review of the whole period and ask the user to set a new statement and date.

## 7. Screens and navigation

The app has four bottom-nav tabs (Today, Progress, Coach, Settings), plus onboarding and modal sheets. On screens wider than 900px the nav becomes a left sidebar and Today shows the four cards in a 2x2 grid.

| Screen | Purpose | Contents |
| --- | --- | --- |
| Onboarding | First run only | Name; monthly budget in LKR (default 150,000); confirm or adjust the meal plan, eating cutoff and other default goals; write a one-line "why" for each discipline; describe the future self (statement, target date, one identity line per discipline); evening reminder time; install prompt |
| Today | Home; log and see the day | Companion with latest message; day ring; four discipline cards showing today's status, streak and a "+" button; overall level and title; "Day {n} of 100 on plan" counter; month-to-date spend against the monthly budget; pinned warning card if any |
| Log sheet | Add and edit entries | One bottom sheet per discipline, as specified in section 4 |
| Progress: Stats | Character sheet | Four stat bars with level, XP to next level, fading state; overall level; current and longest streaks; freezes held; badges grid |
| Progress: History | The record | Year heatmap with a discipline filter (colour intensity = score, or sum of four for "All"); tap a day to open its entries; searchable learning journal; expense list with totals by category and by tag for the selected week or month |
| Progress: Weekly review | Reflection | Generated at week close (Monday start). Shows days Full per discipline, XP earned and lost, best day, weakest discipline, month-to-date spend versus budget pace, and any `lopsided` or `weak-weekday` insight. Ends with a prompt to pick one focus for next week, saved and shown on Today |
| Coach | Message feed | All companion messages, newest first, filterable by severity; intervention responses shown inline |
| Intervention | Check-in | Full-screen flow from 6.4 |
| Settings | Configuration | Goals and budget; expense categories; "why" statements; reminder times; day close hour; export and import; reset all data (with typed confirmation) |

**Interaction details**

- Level-up, perfect day and badge moments get a short full-screen celebration (under 2 seconds, skippable by tap). Respect `prefers-reduced-motion`.
- Every empty state says what to do next, for example "No meals logged yet. Tap + to add breakfast."
- Touch targets are at least 44px. Colour is never the only signal for a score; pair it with an icon or label.
- Each discipline has one consistent accent colour across the ring, cards, bars and heatmap.

### 7.1 Visual design

The app should feel simple, bright and modern: a white canvas, black text, green as the highlight and blue as the second accent. When in doubt, remove an element instead of adding one.

**Colour tokens** (define once as CSS variables and map them into the Tailwind theme; never hard-code hex values in components)

| Token | Hex | Use |
| --- | --- | --- |
| `bg` | #FFFFFF | Page background |
| `surface` | #F6F8F7 | Cards, sheets, input backgrounds |
| `border` | #E5E9E7 | Hairline dividers and card outlines |
| `text` | #0A0A0A | Primary text, icons |
| `text-muted` | #5F6B66 | Secondary text, captions |
| `green` | #22C55E | Primary highlight: main buttons, ring fill, progress, success, active nav |
| `green-strong` | #15803D | Green text and icons on white (the lighter green is for fills only) |
| `green-soft` | #E8F9EE | Tinted backgrounds for praise and completed states |
| `blue` | #2563EB | Secondary accent: links, secondary buttons, info |
| `blue-soft` | #EAF1FE | Tinted backgrounds for info and selected chips |
| `black` | #0A0A0A | High-emphasis surfaces such as the level badge and celebration screens |
| `amber` | #D97706 | Warnings only |
| `red` | #DC2626 | Deviations, decay and interventions only |

**Discipline accents**

| Stat | Colour | Icon |
| --- | --- | --- |
| Fuel (food) | #22C55E green | Leaf or utensils |
| Body (workout) | #2563EB blue | Dumbbell |
| Mind (learning) | #0EA5E9 sky | Book |
| Wealth (finance) | #0A0A0A black | Wallet |

Always show the icon or label with the colour, so the four are distinguishable without relying on hue.

**Typography**

- One typeface: Inter, self-hosted in the bundle so it works offline. No font CDN.
- Sizes: 28px bold for screen titles, 20px semibold for card titles, 16px regular for body, 13px medium for captions. Body text is never below 16px on mobile.
- Numbers (XP, levels, money, streaks) use tabular figures and are the largest element on their card.
- Money is formatted as `LKR 1,200` with thousands separators and no decimals.

**Shape, spacing and depth**

- 8px spacing grid; 16px screen padding; 12px gaps between cards.
- Cards: 16px corner radius, `surface` fill or white with a 1px `border`. Use at most one soft shadow level, reserved for sheets and floating buttons.
- Buttons and chips are pill-shaped. One primary button per screen, green fill with black text; everything else is secondary or text style.
- Icons: Lucide, 1.5px stroke, 24px.
- Generous white space. No gradients, patterns or decorative illustrations apart from the future-self figure.

**Motion**

- Transitions take 150 to 250ms with an ease-out curve. Bottom sheets slide up; the ring and stat bars animate to their new value on every log.
- Tapping a primary action gives immediate visual feedback, plus light haptic feedback through `navigator.vibrate` where supported.
- Celebrations are the only large animations (see interaction details above).

**UX rules**

- Today must answer three questions without scrolling on a typical phone: how is today going, what is left to do, and what does my future self say.
- The most common action on each screen is reachable with the thumb, in the lower half.
- No screen shows more than one pinned warning at a time.
- Forms use chips, steppers and presets before keyboards. The keyboard opens only for descriptions, learning summaries and amounts.
- Text contrast meets WCAG AA (4.5:1 for body text). Do not put white text on the `green` fill at small sizes; use black text or `green-strong`.
- A dark theme is out of scope for v1, but because all colours are tokens it can be added later without touching components.

## 8. PWA requirements

The app must be installable, work fully offline, and keep the user's data safe on one device.

- **Manifest:** name and short name "Becoming", `display: standalone`, portrait orientation, theme and background colours, maskable icons at 192 and 512px, and `shortcuts` for "Log meal", "Log workout", "Log learning" and "Log expense" that deep-link to the matching log sheet.
- **Service worker:** precache the full app shell and assets; no runtime API calls exist. Show an "Update available" prompt when a new version is waiting instead of reloading silently.
- **Offline:** every feature works with no network after the first load.
- **Storage durability:** call `navigator.storage.persist()` after onboarding and show the result in Settings.
- **Backup:** export all tables to a single versioned JSON file; import validates the version, then replaces all data after confirmation. Show "last exported" in Settings and a companion nudge if it is over 30 days old.
- **Install:** capture `beforeinstallprompt` on Chromium and offer an install button in onboarding and Settings; on iOS Safari show "Share, then Add to Home Screen" instructions.
- **iOS details:** `apple-touch-icon`, status bar meta tags, and safe-area insets for the bottom nav.

**Reminders (known limitation)**

A PWA with no backend cannot reliably fire a notification at a set time while the app is closed. v1 therefore does the following:

- Request notification permission in onboarding, explained as optional.
- While the app is open or recently backgrounded, show the midday and evening reminders as local notifications through the service worker.
- Always show the same reminders in-app on next open, driven by the `not-logged-today` and `streak-at-risk` rules, so nothing depends on notifications being delivered.
- Use the App Badging API where available to show a count of unread warnings on the app icon.

Reliable closed-app reminders need Web Push with a small scheduled sender; that is deferred to section 10. Check current browser support for notifications and badging on Android Chrome and iOS Safari at implementation time.

## 9. Build milestones

Build in six milestones, in order. Each ends with a working, installable app and passing tests.

1. **Foundation.** Vite, React, TypeScript, Tailwind, router, PWA plugin, Dexie schema, settings repo, app layout with bottom nav, onboarding flow.
   - Done when: the app installs on a phone, loads offline, and onboarding saves settings that survive a restart.
2. **Logging.** Four log sheets, entry repos, Today screen with discipline cards and entry lists, edit and delete, date switcher.
   - Done when: each entry type can be added in 3 taps plus text, edited, and deleted, and shows on Today immediately.
3. **Game engine.** `scoring`, `xp`, `streaks`, `badges`, day close service, day ring, stat bars, Stats screen.
   - Done when: unit tests cover every row of tables 5.1 and 5.2, level thresholds, decay floor, freeze use, and closing multiple skipped days; the ring and bars update on each log.
4. **Companion.** Rules engine, all rules in 6.2 and 6.3, template bank, Coach feed, pinned warnings, intervention flow, character moods.
   - Done when: each rule has a unit test for firing and not firing; the 24-hour cooldown and daily cap are tested; an intervention response is saved and visible in the feed.
5. **Progress.** Year heatmap, day detail, learning journal search, expense summaries, weekly review with focus selection.
   - Done when: the heatmap renders 365 days smoothly on a mid-range phone and the weekly review numbers match the underlying logs in a test fixture.
6. **Polish.** Celebrations, reminders and badging, export and import, storage persistence, update prompt, empty states, accessibility pass, responsive desktop layout.
   - Done when: export then import on a fresh install restores identical data; Lighthouse PWA checks pass; all flows work with keyboard and screen reader labels.

**Testing and dev aids**

- A seed script generates 90 days of realistic mixed data for development and for the progress screens.
- A hidden debug panel in Settings (dev builds only) can set the current date, to test day close, decay and streaks without waiting.
- Domain code targets 90% or higher line coverage; UI gets smoke tests for the four logging flows and onboarding.

## 10. Deferred, and the seams to leave

None of the following is built in v1, but v1 should not block it.

| Later feature | Seam to leave in v1 |
| --- | --- |
| Local or cloud LLM for free-text logging ("rice and curry for lunch, 45 min gym") | `services/parser.ts` defines `EntryParser { parse(text, discipline): Promise<DraftEntry[]> }`. v1 ships only the manual form path; log sheets save through a single `saveEntries(drafts)` function a parser can also call |
| LLM-written companion messages and weekly review narrative | Rules return `RuleResult` with `vars`, separate from text. A `MessageWriter` interface wraps the template picker so another writer can replace it |
| Reliable push reminders | `services/notifications.ts` hides the delivery method behind `scheduleReminder` and `cancelReminder` |
| Cloud sync or multi-device | All writes go through `data/repos`; every record has `id` and `updatedAt` |
| Meal photos | `FoodEntry` can gain an optional `photoBlobId` without a schema break |
| Reward fund from saved money, richer cross-discipline insights, a growing world visual | Read-only over existing logs; no v1 change needed |
