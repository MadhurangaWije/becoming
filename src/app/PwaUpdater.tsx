import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui';

/** Shows "Update available" when a new service worker is waiting, instead of reloading silently. */
export function PwaUpdater() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });

  if (!needRefresh) return null;
  return (
    <div role="status" className="fixed inset-x-4 top-4 z-50 mx-auto flex max-w-[520px] items-center justify-between gap-3 rounded-card bg-black p-3 pl-4 text-white shadow-soft">
      <span>Update available</span>
      <div className="flex gap-2">
        <button type="button" className="min-h-[44px] px-3 text-white/70" onClick={() => setNeedRefresh(false)}>
          Later
        </button>
        <Button variant="primary" onClick={() => updateServiceWorker(true)}>
          Reload
        </Button>
      </div>
    </div>
  );
}
