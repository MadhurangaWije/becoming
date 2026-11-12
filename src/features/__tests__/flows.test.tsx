import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { clearAll } from '@/data/backup';
import { db } from '@/data/db';
import { settingsRepo } from '@/data/repos';
import { logicalToday } from '@/domain/dates';
import { settings } from '@/test/fixtures';

const today = () => logicalToday(new Date(), 3);

async function onboarded() {
  const t = today();
  await settingsRepo.save(settings({ firstDay: t, onboardedAt: new Date().toISOString(), lastExportedAt: new Date().toISOString(), reminderTimes: { evening: '23:59' } }));
}

async function openSheet(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  await user.click(await screen.findByRole('button', { name }));
  return screen.findByRole('dialog');
}

beforeEach(async () => {
  await clearAll();
});

describe('onboarding', () => {
  it('walks through all steps and saves settings', async () => {
    const user = userEvent.setup();
    render(<App memory={['/']} />);
    await user.type(await screen.findByLabelText('Your name'), 'Kani');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Your goals')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(await screen.findByLabelText(/Workout: Why move/), 'To keep up with my kids');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(await screen.findByLabelText(/Who I am by then/), 'Strong and calm.');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Start becoming' }));
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
    const s = await settingsRepo.get();
    expect(s).toMatchObject({ name: 'Kani', monthlyBudget: 150000, firstDay: today() });
    expect(s!.whys.workout).toBe('To keep up with my kids');
    expect(s!.futureSelf.statement).toBe('Strong and calm.');
    expect(s!.onboardedAt).toBeTruthy();
  });
});

describe('logging flows', () => {
  beforeEach(onboarded);

  it('food: ate as planned in one tap', async () => {
    const user = userEvent.setup();
    render(<App memory={['/']} />);
    const sheet = await openSheet(user, /Log food/i);
    await user.click(within(sheet).getByRole('button', { name: 'Meal 1: ate as planned' }));
    await waitFor(async () => expect(await db.food.count()).toBe(1));
    const e = (await db.food.toArray())[0];
    expect(e).toMatchObject({ slot: 'meal1', rating: 'on_plan', asPlanned: true, protein: true, veggies: true, day: today() });
    expect(await screen.findByText(/1 of 3 meals · 45 of 156 g protein/)).toBeInTheDocument();
  });

  it('food: a variation via the form', async () => {
    const user = userEvent.setup();
    render(<App memory={['/']} />);
    const sheet = await openSheet(user, /Log food/i);
    await user.click(within(sheet).getByRole('button', { name: 'Meal 2: ate something else' }));
    await user.type(within(sheet).getByLabelText('What did you eat?'), 'Kottu');
    await user.click(within(sheet).getByRole('button', { name: 'High' }));
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect(await db.food.count()).toBe(1));
    expect((await db.food.toArray())[0]).toMatchObject({ slot: 'meal2', description: 'Kottu', carbs: 'high', rating: 'close' });
  });

  it('workout: kind, preset, save; then edit and delete', async () => {
    const user = userEvent.setup();
    render(<App memory={['/']} />);
    let sheet = await openSheet(user, /Log workout/i);
    await user.click(within(sheet).getByRole('button', { name: 'Run' }));
    await user.click(within(sheet).getByRole('button', { name: '45' }));
    await user.click(within(sheet).getByRole('button', { name: 'Save workout' }));
    await waitFor(async () => expect(await db.workout.count()).toBe(1));
    expect((await db.workout.toArray())[0]).toMatchObject({ kind: 'run', minutes: 45 });
    expect(await screen.findByText('45 of 30 min')).toBeInTheDocument();

    sheet = await openSheet(user, /Log workout/i);
    await user.click(await within(sheet).findByRole('button', { name: 'Edit entry' }));
    await user.click(await within(sheet).findByRole('button', { name: '60' }));
    await user.click(within(sheet).getByRole('button', { name: 'Save workout' }));
    await waitFor(async () => expect((await db.workout.toArray())[0].minutes).toBe(60));

    sheet = await openSheet(user, /Log workout/i);
    await user.click(await within(sheet).findByRole('button', { name: 'Delete entry' }));
    await waitFor(async () => expect(await db.workout.count()).toBe(0));
  });

  it('learning: summary and save', async () => {
    const user = userEvent.setup();
    render(<App memory={['/']} />);
    const sheet = await openSheet(user, /Log learning/i);
    await user.type(within(sheet).getByLabelText('Today I learned...'), 'How Dexie live queries work');
    await user.click(within(sheet).getByRole('button', { name: 'Save learning' }));
    await waitFor(async () => expect(await db.learning.count()).toBe(1));
    expect(await screen.findByText(/How Dexie live queries work/)).toBeInTheDocument();
  });

  it('learning: rejects a too-short summary', async () => {
    const user = userEvent.setup();
    render(<App memory={['/']} />);
    const sheet = await openSheet(user, /Log learning/i);
    await user.type(within(sheet).getByLabelText('Today I learned...'), 'x');
    await user.click(within(sheet).getByRole('button', { name: 'Save learning' }));
    expect(await within(sheet).findByRole('alert')).toHaveTextContent('Write 2 to 280 characters');
    expect(await db.learning.count()).toBe(0);
  });

  it('finance: amount, category, tag; and no-spend', async () => {
    const user = userEvent.setup();
    render(<App memory={['/']} />);
    let sheet = await openSheet(user, /Log finance/i);
    await user.click(within(sheet).getByRole('button', { name: 'No spend today' }));
    await waitFor(async () => expect((await db.dayRecords.get(today()))?.noSpendDay).toBe(true));
    expect(await screen.findByText('No-spend day')).toBeInTheDocument();

    sheet = await openSheet(user, /Log finance/i);
    await user.type(within(sheet).getByLabelText('Amount'), '1200');
    await user.click(within(sheet).getByRole('button', { name: 'Transport' }));
    await user.click(within(sheet).getByRole('button', { name: 'Want' }));
    await user.click(within(sheet).getByRole('button', { name: 'Save expense' }));
    await waitFor(async () => expect(await db.expense.count()).toBe(1));
    expect((await db.expense.toArray())[0]).toMatchObject({ amount: 1200, category: 'Transport', tag: 'want' });
    expect((await db.dayRecords.get(today()))?.noSpendDay).toBe(false);
    await waitFor(async () => expect((await settingsRepo.get())?.lastExpenseCategory).toBe('Transport'));
  });
});
