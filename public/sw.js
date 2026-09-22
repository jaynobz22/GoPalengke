// GoPalengke Service Worker — handles background push notifications
// Registered from src/lib/pushNotifications.ts

const NOTIFICATION_ICON = '/icon-192.png';
const NOTIFICATION_BADGE = '/icon-192.png';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
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
