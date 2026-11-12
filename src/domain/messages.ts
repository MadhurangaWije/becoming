import type { CompanionMessage } from './types';
import type { RuleResult } from './rules/types';

/**
 * Template bank. Voice: the future self speaking to their past self.
 * "I" is the future self, "you" is the user today. Short, specific, no emoji, no guilt-tripping.
 * Discipline-specific variants use keys like 'missed-twice:workout' and fall back to the rule id.
 */
export const TEMPLATES: Record<string, string[]> = {
  'not-logged-today': [
    'Nothing logged yet for {list}. The day is not over. Neither am I.',
    'Still open today: {list}. A small entry now keeps me real.',
    'I can see the gaps: {list}. You have time to close them tonight.',
    '{list} still empty. I did not become me by skipping evenings like this one.',
  ],
  'missed-yesterday': [
    'Yesterday had no {discipline}. One day is just a day. Today decides what it means.',
    'You skipped {discipline} yesterday. I skipped days too. I just never skipped two.',
    'No {discipline} yesterday. Nothing is lost yet. Show up today and it stays that way.',
    'A gap in {discipline} yesterday. Do the minimum today and the line keeps going.',
  ],
  'missed-twice': [
    'Two days without {discipline}. I only exist if you keep going. The minimum today is enough to keep me real.',
    'Two misses in a row on {discipline}. {stat} is starting to fade. One small entry stops it.',
    'This is the second day with no {discipline}. I remember how easy the third one felt. Do not give it to yourself.',
    'Two days off {discipline}. You do not need a perfect day. You need a day.',
  ],
  'missed-twice:workout': [
    'Two days without training. I only exist if you keep moving. Ten minutes today is enough to keep me real.',
    'Two days without a workout. {stat} is fading. A ten-minute walk counts.',
    'Second day with no training. I know the feeling. I also know ten minutes fixes it.',
    'Two rest days you did not plan. Put on the shoes. That is the whole task for now.',
  ],
  'missed-three-plus': [
    '{count} days without {discipline}. {stat} lost {xpLost} XP. I am still here, but I am getting harder to see.',
    '{count} days with no {discipline}. I need you to stop and look at that. Then do the smallest version today.',
    'It has been {count} days on {discipline}. {xpLost} XP gone. This is the moment the old you would quit. You are not the old you.',
    '{count} missed days of {discipline}. I am not angry. I just need you back.',
  ],
  'off-plan-drift': [
    '{count} off-plan meals in 3 days. That is not how I eat, and I am you. Meal 1 tomorrow: {meal1Plan}.',
    'The plan has slipped {count} times in 3 days. Reset with one meal. Meal 1: {meal1Plan}.',
    '{count} deviations in 3 days. I eat the plan because I decided once, not every day. Decide again tomorrow.',
    'Three days of drift, {count} off-plan moments. The fix is boring and it works: {meal1Plan}.',
  ],
  'minimum-only': [
    'Five days of the minimum on {discipline}. It kept me alive. Now give me one full day.',
    '{discipline} has been at the minimum for 5 days. Good floor. Time to raise it once.',
    'Five minimum days in a row on {discipline}. You are showing up. Next, show up fully.',
    'Minimum, minimum, minimum, minimum, minimum. {discipline} is ready for a full day.',
  ],
  'over-pace-month': [
    'You have spent {spent} of {budget} this month, {pct}%. I live on less than this. Slow the next few days.',
    'Month to date: {spent}. Pace says {pace}. A few no-spend days will bring us back.',
    'Spending is ahead of pace: {spent} against {budget}. I remember this month. The fix was small.',
    '{pct}% of the budget is gone. Every rupee from here is a choice. Make them on purpose.',
  ],
  'want-heavy': [
    '{pct}% of this week went to wants. I still buy things I want. Just not most of the time.',
    'Wants and regrets were {pct}% of the week, {wants}. Next week, lead with needs.',
    'This week tilted to wants: {wants}. Nothing wrong with a treat. Something wrong with a habit.',
    '{pct}% of spending this week was optional. I would like a little of that back.',
  ],
  'regret-spend': [
    '{amount} on {category}, tagged regret. Good that you named it. Naming it is how I stopped doing it.',
    'A regret: {amount}. Do not punish yourself. Just remember how it feels next time.',
    'You logged {amount} as regret. That honesty is the part I kept.',
    '{amount} you wish you had kept. Write down why, then let it go.',
  ],
  'lopsided': [
    '{stat} is falling behind the rest. I am only as strong as my weakest part. Give it some attention this week.',
    'Your weakest stat is {stat}. That is the one holding the whole character back.',
    '{stat} is lagging. One focused week closes most of the gap.',
    'The others are pulling ahead of {stat}. Balance is what made me hard to break.',
  ],
  'weak-weekday': [
    '{Discipline} slips on {weekday}s: {weekdayAvg}% against {overallAvg}% overall. Plan {weekday} the night before.',
    'Your {weekday}s are the weak spot for {discipline}. Same day, same pattern. Change one thing about it.',
    '{weekday} keeps breaking {discipline}. I fixed mine by deciding the plan on Sunday.',
    'Strong all week except {weekday} on {discipline}. That one day is the next upgrade.',
  ],
  'streak-at-risk': [
    '{streak} days of {discipline} in a row and nothing logged today. Keep it alive. I remember this streak.',
    'Your {discipline} streak is at {streak} and today is still empty. The minimum keeps it.',
    '{streak} days. Do not let today be the one that ends it.',
    'A {streak}-day {discipline} streak is waiting on you tonight. Small is enough.',
  ],
  'late-eating': [
    'You ate at {time}. The kitchen closes at {cutoff} for both of us.',
    'Food at {time}, after the {cutoff} cutoff. Tomorrow, close the kitchen on time.',
    '{time} is late for me. I stop at {cutoff}. You can too.',
    'Logged at {time}. Past {cutoff}. Notice it, then make tomorrow different.',
  ],
  'carb-creep': [
    'High-carb meals on {count} of the last 5 days. That is creep, not a slip. Pull it back tomorrow.',
    'Carbs ran high {count} times in 5 days. The plan works when the plate looks like the plan.',
    '{count} high-carb days out of 5. I kept carbs moderate. It made everything else easier.',
    'Carb creep: {count} of 5 days. Swap one portion tomorrow and watch how you feel.',
  ],
  'low-veggies': [
    'No vegetables for 2 days. Add a salad with lime to Meal 1. That is how I do it.',
    'Two days without vegetables. One cup with Meal 2 tomorrow fixes it.',
    'Vegetables have been missing for 2 days. Easy win tomorrow.',
    'Two days, no greens. I feel the difference. You will too.',
  ],
  'protein-gap': [
    'Planned meals without protein on {count} of the last 3 days. Protein is the part I never skip.',
    'Protein is missing from your meals lately. Eggs, chicken, yogurt. Pick one each meal.',
    '{count} of 3 days short on protein. The plan is built around it for a reason.',
    'Protein gap on {count} days. Build each meal around the protein first.',
  ],
  'meal-off-window': [
    'Meals have been off their window on {count} of the last 7 days. Timing is part of the plan. Meal 1 is {window}.',
    'Your meal times are drifting: {count} days this week. Set an alarm for {window}.',
    'Off-window meals on {count} days. I eat at the same times so I do not have to think.',
    '{count} days of late or early meals. Anchor Meal 1 at {window} and the rest follows.',
  ],
  'meal3-pending': [
    'You trained. Now Meal 3: {meal3Plan}. Before {cutoff}.',
    'Workout done, Meal 3 still missing. The shake takes two minutes.',
    'Recovery meal is waiting: {meal3Plan}. The kitchen closes at {cutoff}.',
    'Do not let the workout go to waste. Meal 3 before {cutoff}.',
  ],
  'goal-met': [
    '{Discipline} is done for today. That is exactly how I spend my days.',
    'Full marks on {discipline}. Quietly proud of you.',
    '{Discipline} complete. One more piece of me, locked in.',
    'Done with {discipline} for today. This is what keeping a promise looks like.',
  ],
  'perfect-day': [
    'All four, done. A perfect day. This is what my days look like.',
    'A full ring. I remember days like this. They added up.',
    'Perfect day. You did not just move toward me today. You were me.',
    'Four for four. Take a second to notice it.',
  ],
  'streak-milestone': [
    '{streak} days of {discipline} in a row. I remember this stretch. It is where it started to stick.',
    '{streak}-day {discipline} streak. You stopped negotiating with yourself.',
    '{streak} days straight on {discipline}. This is the version of you that becomes me.',
    '{discipline}: {streak} days without a break. Keep the chain going.',
  ],
  'streak-milestone:learning': [
    '{streak} days of learning in a row. I remember this stretch. It is where it started to stick.',
    '{streak} days of learning something new. That compounds. I know, because I am the result.',
    'A {streak}-day learning streak. Your mind is getting harder to bore.',
    '{streak} days straight of learning. Keep feeding it.',
  ],
  'level-up': [
    '{stat} just reached level {level}. You are getting closer to me.',
    'Level {level} on {stat}. I can see more of myself in you now.',
    '{stat} level {level}. That did not happen by luck.',
    '{stat} is level {level} now. Keep going. I am waiting.',
  ],
  comeback: [
    'You came back after {missed} days off. Of all the days, this is the one I am proudest of.',
    '{missed} days away, then a full day of {discipline}. Coming back is the real skill.',
    'Back after {missed} days. Most people do not come back. You did.',
    'A full {discipline} day after {missed} misses. That is the version of you I became.',
  ],
  'personal-best': [
    'New personal best: {what}, {value}. The old record was {previous}.',
    '{value}. Your {what} ever. I remember when that felt impossible.',
    'Personal best on {what}: {value}, up from {previous}.',
    'You just beat {previous}. New {what}: {value}.',
  ],
  'badge-earned': [
    'Badge earned: {badge}. {badgeDescription}.',
    'You earned {badge}. Put it next to the others. I still have mine.',
    '{badge}. {badgeDescription}. Proof, not luck.',
    'New badge: {badge}. Small marker, real progress.',
  ],
  'plan-hundred': [
    '{count} days on plan. That was the goal. Now the target is {next}.',
    '{count} consecutive days eating the plan. I eat like this without thinking now. Next stop: {next}.',
    '{count} plan days in a row. This is who I am. On to {next}.',
    'You did {count} days. Remember the first one? Next target: {next}.',
  ],
  'backup-stale': [
    'Your data has not been exported in {days} days. Export a backup in Settings. I would hate to lose our history.',
    'It has been {days} days since your last backup. One tap in Settings keeps it safe.',
    'Back up your progress. {days} days of history live only on this phone.',
    'Quick favour: export a backup. {days} days is a lot to lose.',
  ],
  'welcome-back': [
    'You were away {days} days. Welcome back. Start with one small entry today.',
    '{days} days away. No lecture. Just log one thing and we are moving again.',
    'Welcome back after {days} days. The streaks reset. I did not.',
    '{days} days off. I am still here. Let us begin again, smaller.',
  ],
};

export function templatesFor(ruleId: string, discipline?: string): string[] {
  return (discipline && TEMPLATES[`${ruleId}:${discipline}`]) || TEMPLATES[ruleId] || ['{ruleId}'];
}

export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

/** Seam for LLM-written messages later (section 10). */
export interface MessageWriter {
  write(result: RuleResult, recent: Pick<CompanionMessage, 'ruleId' | 'variant' | 'discipline'>[]): { text: string; variant: number };
}

/** Picks a variant at random, excluding the one used last time for that rule. */
export class TemplateWriter implements MessageWriter {
  constructor(private random: () => number = Math.random) {}

  write(result: RuleResult, recent: Pick<CompanionMessage, 'ruleId' | 'variant' | 'discipline'>[]) {
    const options = templatesFor(result.ruleId, result.discipline);
    const last = recent.find((m) => m.ruleId === result.ruleId && m.variant !== undefined)?.variant;
    const pool = options.map((_, i) => i).filter((i) => options.length === 1 || i !== last);
    const variant = pool[Math.floor(this.random() * pool.length) % pool.length];
    const text = fill(options[variant], { ruleId: result.ruleId, ...result.vars });
    return { text: text.charAt(0).toUpperCase() + text.slice(1), variant };
  }
}
