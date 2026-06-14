// Neralla Nexus — PWA Service Worker
// Handles background push events, navigation linking, and instant notification actions.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through fetch event handler to satisfy Chrome/Safari installability rules
  event.respondWith(fetch(event.request));
});

// 1. Handle background Push Notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'Nexus Alert';
    const options = {
      body: data.body || '',
      icon: data.icon || '/logo.png',
      badge: data.badge || data.icon || '/logo.png',
      data: {
        url: data.url || '/dashboard',
        reminderId: data.reminderId || null,
      },
      actions: data.actions || [],
      vibrate: [200, 100, 200],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('Failed to display background push notification:', err);
  }
});

// 2. Handle Notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const reminderId = event.notification.data?.reminderId;

  if (event.action === 'taken' && reminderId) {
    // Mark medicine taken in the background
    event.waitUntil(
      fetch('/api/medication/log-bg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminderId, status: 'taken' }),
      })
      .then((res) => {
        if (!res.ok) console.error('Failed to log taken state in background');
      })
      .catch((err) => console.error('Error logging taken state in background:', err))
    );
  } else if (event.action === 'snooze' && reminderId) {
    // Snooze reminder in the background
    event.waitUntil(
      fetch('/api/medication/log-bg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminderId, status: 'snoozed' }),
      })
      .then((res) => {
        if (!res.ok) console.error('Failed to log snooze state in background');
      })
      .catch((err) => console.error('Error logging snooze state in background:', err))
    );
  } else {
    // Normal tap: navigate/focus
    const url = event.notification.data?.url || '/dashboard';
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          // If already open, focus and navigate it
          const clientPath = new URL(client.url).pathname;
          if (clientPath === new URL(url, self.location.origin).pathname && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
    );
  }
});
