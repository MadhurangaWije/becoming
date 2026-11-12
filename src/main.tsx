import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import { ErrorBoundary } from './app/ErrorBoundary';
import { PwaUpdater } from './app/PwaUpdater';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      <PwaUpdater />
    </ErrorBoundary>
  </React.StrictMode>,
);
