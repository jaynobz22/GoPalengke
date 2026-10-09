// GoPalengke Service Worker — offline app shell + background push notifications
// Registered from src/lib/register-sw.ts (production only) and pushNotifications.ts

const NOTIFICATION_ICON = '/icon-192.png';
const NOTIFICATION_BADGE = '/icon-192.png';

const CACHE_NAME = 'gopalengke-shell-v1';
const CORE_FILES = ['/', '/manifest.json', '/favicon.png', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.allSettled(CORE_FILES.map((f) => cache.add(f))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.filter((n) => n.startsWith('gopalengke-shell-') && n !== CACHE_NAME).map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch database/API calls
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/~oauth')) return;

  // Pages: always try the network first, fall back to cache when offline
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put('/', fresh.clone()).catch(() => {});
        return fresh;
      } catch {
        return (await caches.match(req)) || (await caches.match('/')) ||
          new Response('<h1>Offline</h1><p>Walang internet. Subukan ulit mamaya.</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  // Hashed build files + icons: cache first
  if (url.pathname.startsWith('/assets/') || CORE_FILES.includes(url.pathname)) {
    event.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) (await caches.open(CACHE_NAME)).put(req, res.clone()).catch(() => {});
      return res;
    })());
  }
});

self.addEventListener('push', (event) => {
  let payload;

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    try {
      payload = { title: 'GoPalengke', body: event.data ? event.data.text() : '' };
    } catch {
      payload = { title: 'GoPalengke', body: 'May bagong update.' };
    }
  }

  const title = payload.title || 'GoPalengke';
  const body = payload.body || '';
  const url = payload.url || '/';

  const options = {
    body: body,
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_BADGE,
    vibrate: [200, 100, 200],
    tag: payload.tag || 'gopalengke-notification',
    renotify: true,
    data: {
      url: url,
      dateOfArrival: Date.now(),
    },
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Try to focus an existing window
      for (const client of allClients) {
        if (client.url.includes(self.location.origin)) {
          if ('focus' in client) {
            await client.focus();
            // Navigate to the target URL
            if (client.url !== self.location.origin + targetUrl) {
              await client.navigate(self.location.origin + targetUrl);
            }
            return;
          }
        }
      }

      // No existing window — open a new one
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});
