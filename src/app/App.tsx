import { BarChart3, MessageCircle, Settings as SettingsIcon, Sun } from 'lucide-react';
import { useEffect } from 'react';
import { BrowserRouter, MemoryRouter, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CelebrationLayer } from '@/components/Celebration';
import type { Discipline } from '@/domain/types';
import { CoachScreen } from '@/features/companion/Coach';
import { InterventionGate } from '@/features/companion/Intervention';
import { LogSheet } from '@/features/log/LogSheet';
import { Onboarding } from '@/features/onboarding/Onboarding';
import { ProgressScreen } from '@/features/progress/Progress';
import { SettingsScreen } from '@/features/settings/Settings';
import { TodayScreen } from '@/features/today/Today';
import { useAppLifecycle, useSettings, useTodayView } from './hooks';
import { useUi } from './uiStore';

const NAV = [
  { to: '/', label: 'Today', Icon: Sun },
  { to: '/progress', label: 'Progress', Icon: BarChart3 },
  { to: '/coach', label: 'Coach', Icon: MessageCircle },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon },
];

function Nav({ unread }: { unread: number }) {
  return (
    <nav
      aria-label="Main"
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/95 backdrop-blur min-[900px]:inset-y-0 min-[900px]:left-0 min-[900px]:right-auto min-[900px]:w-56 min-[900px]:border-r min-[900px]:border-t-0 min-[900px]:pt-6"
    >
      <div className="mx-auto hidden px-6 pb-6 text-card min-[900px]:block">Becoming</div>
      <ul className="mx-auto flex max-w-[560px] justify-around min-[900px]:flex-col min-[900px]:gap-1 min-[900px]:px-3">
        {NAV.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1 min-[900px]:flex-none">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[12px] font-medium min-[900px]:min-h-[44px] min-[900px]:flex-row min-[900px]:justify-start min-[900px]:gap-3 min-[900px]:rounded-full min-[900px]:px-4 min-[900px]:text-body ${
                  isActive ? 'text-green-strong min-[900px]:bg-green-soft' : 'text-muted hover:text-text'
                }`
              }
            >
              <Icon size={24} strokeWidth={1.5} aria-hidden />
              <span>{label}</span>
              {to === '/coach' && unread > 0 && (
                <span className="absolute right-[calc(50%-22px)] top-2 h-2 w-2 rounded-full bg-red min-[900px]:static min-[900px]:ml-auto" aria-label={`${unread} unread`} />
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Opens a log sheet from manifest shortcuts: /?log=food */
function DeepLinks() {
  const [params, setParams] = useSearchParams();
  const openSheet = useUi((s) => s.openSheet);
  useEffect(() => {
    const log = params.get('log') as Discipline | null;
    if (log && ['food', 'workout', 'learning', 'finance'].includes(log)) {
      openSheet(log);
      params.delete('log');
      setParams(params, { replace: true });
    }
  }, [params, setParams, openSheet]);
  return null;
}

function Shell() {
  const view = useTodayView();
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0); // may return a Promise in newer browsers; never return it from an effect
  }, [location.pathname]);
  return (
    <div className="min-h-screen bg-bg min-[900px]:pl-56">
      <main className="safe-top mx-auto max-w-[560px] px-4 pb-28 pt-4 min-[900px]:max-w-[960px] min-[900px]:px-8 min-[900px]:pb-12">
        <Routes>
          <Route path="/" element={<TodayScreen />} />
          <Route path="/progress" element={<ProgressScreen />} />
          <Route path="/coach" element={<CoachScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Nav unread={view?.unread ?? 0} />
      <LogSheet />
      <InterventionGate />
      <DeepLinks />
    </div>
  );
}

function Gate() {
  const settings = useSettings();
  const navigate = useNavigate();
  const onboarded = !!settings?.onboardedAt;
  useAppLifecycle(onboarded);
  if (settings === undefined) return <div className="min-h-screen bg-bg" aria-busy="true" />;
  if (!onboarded) return <Onboarding onDone={() => navigate('/', { replace: true })} />;
  return <Shell />;
}

export function App({ memory }: { memory?: string[] }) {
  const content = (
    <>
      <Gate />
      <CelebrationLayer />
    </>
  );
  return memory ? <MemoryRouter initialEntries={memory}>{content}</MemoryRouter> : <BrowserRouter>{content}</BrowserRouter>;
}
