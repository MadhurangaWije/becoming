import { useState } from 'react';
import { Segmented } from '@/components/ui';
import { HistoryView } from './History';
import { StatsView } from './Stats';
import { WeeklyView } from './Weekly';

type Tab = 'stats' | 'history' | 'weekly';

export function ProgressScreen() {
  const [tab, setTab] = useState<Tab>(() => {
    try {
      return (sessionStorage.getItem('becoming.progressTab') as Tab) || 'stats';
    } catch {
      return 'stats';
    }
  });
  const change = (t: Tab) => {
    setTab(t);
    try {
      sessionStorage.setItem('becoming.progressTab', t);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="space-y-4">
      <h1 className="text-title">Progress</h1>
      <Segmented
        label="Progress view"
        value={tab}
        onChange={change}
        options={[
          { value: 'stats', label: 'Stats' },
          { value: 'history', label: 'History' },
          { value: 'weekly', label: 'Weekly' },
        ]}
      />
      {tab === 'stats' && <StatsView />}
      {tab === 'history' && <HistoryView />}
      {tab === 'weekly' && <WeeklyView />}
    </div>
  );
}
