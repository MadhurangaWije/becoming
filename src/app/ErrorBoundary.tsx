import { Component, type ReactNode } from 'react';

/** Never leave the user on a blank screen. Data lives in IndexedDB, so a reload is safe. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[Becoming] render error', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto flex min-h-screen max-w-[480px] flex-col justify-center gap-4 px-4">
        <h1 className="text-title">Something went wrong</h1>
        <p className="text-muted">Your data is safe on this device. Reload to continue.</p>
        <pre className="overflow-auto rounded-xl bg-surface p-3 text-caption">{this.state.error.message}</pre>
        <button type="button" className="min-h-[44px] rounded-full bg-green px-5 font-semibold text-black" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
