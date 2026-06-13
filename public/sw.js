// Neralla Nexus — PWA Service Worker
// Provides pass-through fetch caching to satisfy browser installation criteria.

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
