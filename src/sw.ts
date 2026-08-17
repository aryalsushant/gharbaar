/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

/**
 * The service worker exists for two reasons, and only one of them is caching.
 *
 * The other is push. On iPhone this file is the *only* way a notification can
 * ever arrive, and only when the app has been added to the home screen. A tab
 * in Safari cannot receive push no matter what permission it has been granted.
 */

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

// A new worker should take over immediately rather than waiting for every tab
// to close, otherwise a phone that never fully quits the app stays on an old
// build indefinitely.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

type Payload = {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
};

self.addEventListener('push', (event) => {
  let payload: Payload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { body: event.data?.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'Gharbaar', {
      body: payload.body ?? '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // Tagging replaces an earlier notification about the same night instead
      // of stacking three reminders about one dinner.
      tag: payload.tag ?? 'gharbaar',
      data: { url: payload.url ?? '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data?.url as string) ?? '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus the app if it is already open rather than opening a second copy.
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
