import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import { AuthProvider } from './lib/auth';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A household of six is not a high-churn dataset, and refetching on every
      // window focus makes the balances flicker on a phone that keeps waking.
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: 1,
    },
  },
});

/**
 * Take a new build the moment it lands.
 *
 * The service worker calls skipWaiting, so a fresh one activates straight away,
 * but the page it replaced keeps running the old JavaScript until something
 * reloads it. That is the gap where the app looks like it has not been updated
 * even though the new files are already on the device.
 *
 * Only a replaced worker is worth a reload. The very first install also fires
 * controllerchange when the new worker claims the page, and reloading then
 * throws away a page that is already current, which on a first open meant the
 * splash played, the page reloaded, and the splash played again.
 *
 * The guard matters: without it, a worker that claims control during startup
 * can reload the page in a loop.
 */
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
);
