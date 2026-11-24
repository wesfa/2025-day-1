// Service worker: makes Macros work offline and lets updates roll out.
// Bump VERSION on every deploy so phones pick up the new files.
const VERSION = '1.6.0';
const CACHE = 'macros-' + VERSION;

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/ai.js',
  './js/app.js',
  './js/calc.js',
  './js/food.js',
  './js/foods.js',
  './js/game.js',
  './js/gym.js',
  './js/icons.js',
  './js/program.js',
  './js/reminders.js',
  './js/report.js',
  './js/settings.js',
  './js/store.js',
  './js/today.js',
  './js/ui.js',
  './js/util.js',
  './js/vault.js',
  './js/weight.js',
  './js/wizard.js',
  './art/m-sky.png',
  './art/m-hill.png',
  './art/m-field.png',
  './art/m-cloud-huge.png',
  './art/m-cloud-wisp.png',
  './art/sky.png',
  './art/horizon.png',
  './art/waves.png',
  './art/spark-a.png',
  './art/spark-b.png',
  './art/shore.png',
  './art/cloud-1.png',
  './art/cloud-2.png',
  './art/cloud-3.png',
  './art/island.png',
  './fonts/dotgothic16.woff2',
  './fonts/vt323.woff2',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => (k.startsWith('macros-') || k.startsWith('trenches-')) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // online food search, scanner lib, ntfy: straight to network

  // Pages: cache first (instant + offline), fall back to network
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html').then((r) => r || fetch(req)));
    return;
  }
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })),
  );
});
