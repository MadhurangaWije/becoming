import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import { ErrorBoundary } from './app/ErrorBoundary';
import { PwaUpdater } from './app/PwaUpdater';
import { useUi } from './app/uiStore';
import './index.css';

// Capture Chrome's install prompt as early as possible; the Install card and buttons use it.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  useUi.getState().setInstallPrompt(e as Event & { prompt: () => Promise<void> });
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      <PwaUpdater />
    </ErrorBoundary>
  </React.StrictMode>,
);
