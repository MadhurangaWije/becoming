import { Download, MoreHorizontal, Share, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useUi } from '@/app/uiStore';
import { Button } from './ui';

// iOS has no install API: no beforeinstallprompt, and pages cannot open the browser's own
// Share menu (navigator.share opens a different sheet without "Add to Home Screen").
// So on iOS we show precise, browser-specific instructions; elsewhere a real Install button.

export type IosBrowser = 'safari' | 'chrome' | 'firefox' | 'edge' | 'other';

export interface InstallEnv {
  standalone: boolean;
  ios: boolean;
  iosBrowser: IosBrowser;
  ipad: boolean;
}

export function installEnv(): InstallEnv {
  const ua = navigator.userAgent;
  const ipad = /ipad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const ios = ipad || /iphone|ipod/i.test(ua);
  const iosBrowser: IosBrowser = /CriOS/.test(ua) ? 'chrome' : /FxiOS/.test(ua) ? 'firefox' : /EdgiOS/.test(ua) ? 'edge' : /Safari/.test(ua) ? 'safari' : 'other';
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return { standalone: !!standalone, ios, iosBrowser, ipad };
}

/** Where the Share button lives in each iOS browser. */
function shareLocation(env: InstallEnv): string {
  switch (env.iosBrowser) {
    case 'chrome':
      return 'the Share icon at the right end of the address bar';
    case 'safari':
      return env.ipad ? 'the Share icon at the top right' : 'the Share icon in the bottom toolbar (tap the address bar first if the toolbar is hidden)';
    case 'firefox':
    case 'edge':
      return 'the menu, then Share';
    default:
      return 'your browser’s Share button';
  }
}

export function IosInstallSteps({ env }: { env: InstallEnv }) {
  const menu = env.iosBrowser === 'firefox' || env.iosBrowser === 'edge';
  return (
    <ol className="list-decimal space-y-1 pl-5 text-[15px]">
      <li>
        Tap {menu ? <MoreHorizontal size={16} aria-hidden className="inline align-[-2px] text-blue" /> : <Share size={16} aria-hidden className="inline align-[-2px] text-blue" />}{' '}
        {shareLocation(env)}.
      </li>
      <li>
        Scroll down and tap <span className="font-semibold">Add to Home Screen</span>.
      </li>
      <li>Open Becoming from your home screen.</li>
    </ol>
  );
}

/** Keeps the deferred Chrome install prompt in the store, and clears it once installed. */
export function useInstallState() {
  const prompt = useUi((s) => s.installPrompt);
  const setPrompt = useUi((s) => s.setInstallPrompt);
  const [env, setEnv] = useState(installEnv);
  useEffect(() => {
    const onInstalled = () => {
      setPrompt(null);
      setEnv(installEnv());
    };
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, [setPrompt]);
  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    setPrompt(null);
  };
  return { env, prompt, install };
}

/** Used in onboarding and Settings. */
export function InstallButton() {
  const { env, prompt, install } = useInstallState();
  if (env.standalone) return <p className="text-muted">Becoming is installed on this device.</p>;
  if (prompt)
    return (
      <Button variant="secondary" onClick={install}>
        <Download size={18} aria-hidden /> Install Becoming
      </Button>
    );
  if (env.ios) return <IosInstallSteps env={env} />;
  return <p className="text-muted">Use your browser menu to install or add Becoming to your home screen.</p>;
}

const DISMISS_KEY = 'becoming.installCardDismissed';

/** Card on Today: real Install button where the browser supports it, exact steps on iOS. */
export function InstallCard() {
  const { env, prompt, install } = useInstallState();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  if (env.standalone || dismissed || (!prompt && !env.ios)) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <section aria-label="Install Becoming" className="relative rounded-card border border-blue/30 bg-blue-soft p-3 pr-12">
      <p className="font-semibold">Install Becoming</p>
      <p className="mt-0.5 text-[15px] text-muted">It opens full screen, works offline, and keeps your data safer on this device.</p>
      {prompt ? (
        <Button variant="secondary" className="mt-2" onClick={install}>
          <Download size={18} aria-hidden /> Install
        </Button>
      ) : (
        <div className="mt-2">
          <IosInstallSteps env={env} />
          <p className="mt-2 text-caption text-muted">Data in this browser tab does not move to the installed app. Use Settings, Export backup, then Import there.</p>
        </div>
      )}
      <button type="button" aria-label="Dismiss install card" onClick={dismiss} className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/60">
        <X size={20} />
      </button>
    </section>
  );
}

/** First onboarding screen on iOS: install before entering anything, since tab data stays in the tab. */
export function IosInstallFirst() {
  const { env } = useInstallState();
  if (!env.ios || env.standalone) return null;
  return (
    <section aria-label="Install first" className="rounded-card border border-blue/30 bg-blue-soft p-3">
      <p className="font-semibold">Install first</p>
      <p className="mt-0.5 text-[15px] text-muted">On iPhone and iPad, the home screen app keeps its own data. Set Becoming up there, not in this tab.</p>
      <div className="mt-2">
        <IosInstallSteps env={env} />
      </div>
      <p className="mt-2 text-caption text-muted">You can also continue here and move your data later with Export and Import.</p>
    </section>
  );
}
