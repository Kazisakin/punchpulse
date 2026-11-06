// Offline cache. Bump VERSION on each release.
const VERSION = 'punchpulse-v1.4.0';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './vendor/three.module.min.js',
  './vendor/RoomEnvironment.js',
  './src/main.js',
  './src/config.js',
  './src/arena.js',
  './src/gloves.js',
  './src/targets.js',
  './src/effects.js',
  './src/audio.js',
  './src/chart.js',
  './src/ui.js',
  './src/storage.js',
  './src/iap.js',
  './src/gfx.js',
  './src/progression.js',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the browser's HTTP cache so a new version never stores stale files
  e.waitUntil(caches.open(VERSION)
    .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// network first (3 s timeout), cache as fallback
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const res = await Promise.race([
        fetch(e.request, { cache: 'no-cache' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
      ]);
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    } catch {
      const hit = await cache.match(e.request, { ignoreSearch: true });
      return hit || Response.error();
    }
  })());
});
