// Service worker: makes Macros work offline and lets updates roll out.
// Bump VERSION on every deploy so phones pick up the new files.
const VERSION = '1.17.0';
const CACHE = 'macros-' + VERSION;

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/ai.js',
  './js/body-grid.js',
  './js/bodymap.js',
  './js/bulk.js',
  './js/coach.js',
  './js/exlib.js',
  './js/fastfood.js',
  './js/app.js',
  './js/calc.js',
  './js/food.js',
  './js/foods.js',
  './js/game.js',
  './js/grocery.js',
  './js/gym.js',
  './js/icons.js',
  './js/program.js',
  './js/ranks.js',
  './js/reminders.js',
  './js/report.js',
  './js/settings.js',
  './js/sleep.js',
  './js/sky.js',
  './js/smartlist.js',
  './js/store.js',
  './js/strength.js',
  './js/today.js',
  './js/ui.js',
  './js/util.js',
  './js/vault.js',
  './js/weight.js',
  './js/wizard.js',
  './art/city/birds-a.png',
  './art/city/birds-b.png',
  './art/city/cloud-1.png',
  './art/city/cloud-2.png',
  './art/city/cloud-3.png',
  './art/city/cloud-deck.png',
  './art/city/dock-dawn.png',
  './art/city/dock-day.png',
  './art/city/dock-dusk.png',
  './art/city/dock-golden.png',
  './art/city/dock-night.png',
  './art/city/embers.png',
  './art/city/far-dawn.png',
  './art/city/far-day.png',
  './art/city/far-dusk.png',
  './art/city/far-golden.png',
  './art/city/far-night.png',
  './art/city/fog.png',
  './art/city/haze-dawn.png',
  './art/city/haze-day.png',
  './art/city/haze-dusk.png',
  './art/city/haze-golden.png',
  './art/city/haze-night.png',
  './art/city/holo.png',
  './art/city/mid-dawn.png',
  './art/city/mid-day.png',
  './art/city/mid-dusk.png',
  './art/city/mid-golden.png',
  './art/city/mid-night.png',
  './art/city/near-dawn.png',
  './art/city/near-day.png',
  './art/city/near-dusk.png',
  './art/city/near-golden.png',
  './art/city/near-night.png',
  './art/city/pyramid-dawn.png',
  './art/city/pyramid-day.png',
  './art/city/pyramid-dusk.png',
  './art/city/pyramid-golden.png',
  './art/city/pyramid-night.png',
  './art/city/rain-far.png',
  './art/city/rain.png',
  './art/city/ref-a-dawn.png',
  './art/city/ref-a-day.png',
  './art/city/ref-a-dusk.png',
  './art/city/ref-a-golden.png',
  './art/city/ref-a-night.png',
  './art/city/ref-b-dawn.png',
  './art/city/ref-b-day.png',
  './art/city/ref-b-dusk.png',
  './art/city/ref-b-golden.png',
  './art/city/ref-b-night.png',
  './art/city/ring-1.png',
  './art/city/ring-2.png',
  './art/city/ring-3.png',
  './art/city/ring-4.png',
  './art/city/side-dawn.png',
  './art/city/side-day.png',
  './art/city/side-dusk.png',
  './art/city/side-golden.png',
  './art/city/side-night.png',
  './art/city/sky-dawn.png',
  './art/city/sky-day.png',
  './art/city/sky-dusk.png',
  './art/city/sky-golden.png',
  './art/city/sky-night.png',
  './art/city/snow-far.png',
  './art/city/snow.png',
  './art/city/stars-a.png',
  './art/city/stars-b.png',
  './art/city/sun-day.png',
  './art/city/sun-low.png',
  './art/city/water-dawn.png',
  './art/city/water-day.png',
  './art/city/water-dusk.png',
  './art/city/water-golden.png',
  './art/city/water-night.png',
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
