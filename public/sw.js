// Neralla Nexus — PWA Service Worker
// Handles background push events, navigation linking, and instant notification actions.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// --- 1. IndexedDB Offline Queue Helpers ---
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('nexus-offline-sync', 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('mutations')) {
        db.createObjectStore('mutations', { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function enqueueRequest(request) {
  const db = await openDatabase();
  
  let bodyText = '';
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      bodyText = await request.clone().text();
    } catch (e) {
      console.warn('Could not read request body stream:', e);
    }
  }
  
  const headers = {};
  for (const [key, val] of request.headers.entries()) {
    headers[key] = val;
  }

  const mutation = {
    url: request.url,
    method: request.method,
    headers: headers,
    body: bodyText,
    timestamp: Date.now()
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('mutations', 'readwrite');
    const store = transaction.objectStore('mutations');
    const addReq = store.add(mutation);
    addReq.onsuccess = () => resolve();
    addReq.onerror = (e) => reject(e.target.error);
  });
}

async function replayMutations() {
  try {
    const db = await openDatabase();
    const transaction = db.transaction('mutations', 'readonly');
    const store = transaction.objectStore('mutations');
    
    const getAllReq = store.getAll();
    getAllReq.onsuccess = async () => {
      const mutations = getAllReq.result;
      if (mutations.length === 0) return;

      console.log(`[PWA SW] Replaying ${mutations.length} queued offline mutations...`);

      for (const mutation of mutations) {
        try {
          const fetchOptions = {
            method: mutation.method,
            headers: mutation.headers,
          };
          if (mutation.method !== 'GET' && mutation.method !== 'HEAD' && mutation.body) {
            fetchOptions.body = mutation.body;
          }

          const response = await fetch(mutation.url, fetchOptions);
          if (response.ok) {
            const deleteTx = db.transaction('mutations', 'readwrite');
            deleteTx.objectStore('mutations').delete(mutation.id);
            console.log(`[PWA SW] Successfully replayed mutation ${mutation.id}`);
          } else {
            console.warn(`[PWA SW] Replay failed for mutation ${mutation.id} (Status ${response.status})`);
          }
        } catch (err) {
          console.error(`[PWA SW] Network connection error replaying mutation ${mutation.id}:`, err);
          break; // Stop replaying since we might still be offline
        }
      }
    };
  } catch (err) {
    console.error('[PWA SW] Failed to replay mutations:', err);
  }
}

// --- 2. Event Listeners ---
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only queue mutations (POST/PUT/DELETE/PATCH) to API endpoints or Server Actions
  const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method);
  const isApiOrAction = url.pathname.startsWith('/api/') || request.headers.has('Next-Action') || request.headers.has('next-action');

  if (isMutation && isApiOrAction) {
    event.respondWith(
      fetch(request.clone()).catch(async (err) => {
        console.warn('[PWA SW] Mutation failed due to offline status, queueing locally...', request.url);
        try {
          await enqueueRequest(request);
          
          // Return a mock successful response to avoid breaking client flow
          return new Response(
            JSON.stringify({ 
              success: true, 
              offlineQueued: true, 
              message: 'Action saved locally and queued for background synchronization.' 
            }), 
            {
              status: 202,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        } catch (queueErr) {
          console.error('[PWA SW] Failed to enqueue mutation in IndexedDB:', queueErr);
          throw err; // Fallback to raw fetch failure if IndexedDB is inaccessible
        }
      })
    );
  } else {
    // Pass-through standard requests
    event.respondWith(fetch(request));
  }
});

// Replay queue when browser informs SW that connection is restored
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'REPLAY_OFFLINE_MUTATIONS') {
    event.waitUntil(replayMutations());
  }
});

// Standard background sync event
self.addEventListener('sync', (event) => {
  if (event.tag === 'replay-offline-mutations') {
    event.waitUntil(replayMutations());
  }
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
