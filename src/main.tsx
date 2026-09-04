import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  persistQueryClientRestore,
  persistQueryClientSubscribe,
} from '@tanstack/query-persist-client-core';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import { AuthProvider } from './lib/auth';
import './styles.css';

/**
 * Open on what was there last time, then catch up.
 *
 * Every open used to wait on three round trips in a row before anything
 * showed: the profile, then the house and the rota, then the rota's members.
 * On a phone that is a second or two of a blank screen for data that has
 * almost never changed since yesterday. So the last fetched copy of everything
 * is kept on the device and the board is drawn from it straight away, while the
 * real fetch runs behind it and replaces anything that moved.
 *
 * The restore happens before the first render, not alongside it. A provider
 * that restores while rendering still paints one frame with nothing in it,
 * and one frame of nothing is the flash this is here to remove.
 *
 * gcTime has to be at least as long as maxAge or the persisted copy is thrown
 * away on restore.
 */
const A_WEEK = 7 * 24 * 60 * 60 * 1000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A household of six is not a high-churn dataset, and refetching on every
      // window focus makes the balances flicker on a phone that keeps waking.
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      gcTime: A_WEEK,
      retry: 1,
    },
  },
});

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'gharbaar-cache',
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
 * throws away a page that is already current, so a first open loaded twice.
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

async function boot() {
  try {
    await persistQueryClientRestore({ queryClient, persister, maxAge: A_WEEK });
  } catch {
    // A corrupt or missing cache is a slower open, not a broken one.
  }
  persistQueryClientSubscribe({ queryClient, persister });

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
}

void boot();
