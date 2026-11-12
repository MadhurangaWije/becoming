import { Share } from 'lucide-react';
import { useUi } from '@/app/uiStore';
import { Button } from './ui';

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function InstallButton() {
  const prompt = useUi((s) => s.installPrompt);
  const setPrompt = useUi((s) => s.setInstallPrompt);
  if (isStandalone()) return <p className="text-muted">Becoming is installed on this device.</p>;
  if (prompt)
    return (
      <Button
        variant="secondary"
        onClick={async () => {
          await prompt.prompt();
          setPrompt(null);
        }}
      >
        Install Becoming
      </Button>
    );
  if (isIos())
    return (
      <p className="flex flex-wrap items-center gap-1 text-muted">
        Tap <Share size={18} aria-label="Share" className="text-blue" /> Share, then <span className="font-medium text-text">Add to Home Screen</span>.
      </p>
    );
  return <p className="text-muted">Use your browser menu to install or add Becoming to your home screen.</p>;
}
