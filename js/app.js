// App shell: router, taskbar, Start menu, service worker, timers.
import { S, save, activeWorkout, rawAtLoad, replaceState, enableMirror, totals, targets } from './store.js';
import { readMirror, snapshot } from './vault.js';
import { actions, on, setRerender, setNavigate, go, drawModals, closeAllModals, modalOpen, msgBox, toast, unlockAudio } from './ui.js';
import { icon } from './icons.js';
import { dayKey, clockNow, esc, fmt, longDate, isStandalone, buzz, HAPTIC, hapticsUsed, setHaptics } from './util.js';
import { renderToday } from './today.js';
import { renderFood, view as foodView } from './food.js';
import { renderGym, renderWorkout, tickWorkoutClock } from './gym.js';
import { renderRanks } from './ranks.js';
import { renderWeight, drawWeightChart, resetWeightView } from './weight.js';
import { renderSettings, renderReminders, applyTheme, openInstallHelp, APP_VERSION } from './settings.js';
import { renderWizard, setWizardDone } from './wizard.js';
import { syncPush } from './reminders.js';
import './report.js';
import { openAI } from './ai.js';
import { renderGame, mountGame } from './game.js';
import { renderSleep } from './sleep.js';
import { renderGrocery } from './grocery.js';
import { openFastFood } from './fastfood.js';

const SCREENS = {
  today: { render: renderToday, title: 'Today' },
  food: { render: renderFood, title: 'Food' },
  gym: { render: renderGym, title: 'Gym' },
  ranks: { render: renderRanks, title: 'Ranks' },
  workout: { render: renderWorkout, title: 'Workout' },
  weight: { render: renderWeight, title: 'Weight', after: drawWeightChart },
  reminders: { render: renderReminders, title: 'Reminders' },
  settings: { render: renderSettings, title: 'Settings' },
  play: { render: renderGame, title: 'Gridlock', after: mountGame },
  sleep: { render: renderSleep, title: 'Sleep' },
  grocery: { render: renderGrocery, title: 'Grocery List' },
};

const TASKS = [
  ['today', 'Today', 'calendar'],
  ['food', 'Food', 'burger'],
  ['gym', 'Gym', 'dumbbell'],
  ['ranks', 'Ranks', 'trophy'],
  ['weight', 'Weight', 'scale'],
];

const $app = document.getElementById('app');
const $task = document.getElementById('taskbar');
const $start = document.getElementById('startmenu');
let lastRoute = '';
let lastHash = location.hash;
let lastDay = dayKey();

function route() {
  const r = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
  return SCREENS[r] ? r : 'today';
}

// ---------- Glance: open to the city ----------
// Opening the app (or coming back after 30+ minutes away) shows just the sky and today's calories.
// One tap anywhere goes into the normal Today screen. Off switch: Control Panel > Look & sky.
const GLANCE_AWAY = 30 * 60 * 1000;
let hiddenAt = 0;
const wantGlance = () => S.setupDone && S.settings.glance !== false && route() === 'today' && !activeWorkout() && !modalOpen();
let glance = wantGlance();

// In the City scheme the numbers are lit windows on the face of the tall tower at the left: same pixel grid,
// same window colors as the art, so they look like part of the building (tools/skyline.py side_structure).
const FACADE = {   // the tower's wall and window colors at each time of day (from the art's painter)
  dawn: ['#170f1c', '#d0784a', '#f0a060', '#ffd7a0'], day: ['#2a3748', '#a9c0d6', '#dbe8f3', '#ffffff'],
  golden: ['#2a1f28', '#e0a070', '#ffc890', '#fff0c0'], dusk: ['#120a06', '#c8742a', '#f09a3a', '#ffd48a'],
  night: ['#07080d', '#e0943a', '#ffb54a', '#ffe2a0'],
};
const GLYPH = {
  0: '###/#.#/#.#/#.#/###', 1: '.#./##./.#./.#./###', 2: '###/..#/###/#../###', 3: '###/..#/###/..#/###', 4: '#.#/#.#/###/..#/..#',
  5: '###/#../###/..#/###', 6: '###/#../###/#.#/###', 7: '###/..#/..#/.#./.#.', 8: '###/#.#/###/#.#/###', 9: '###/#.#/###/..#/###',
  P: '##./#.#/##./#../#..', C: '.##/#../#../#../.##', F: '###/#../##./#../#..', K: '#.#/#.#/##./#.#/#.#', A: '.#./#.#/###/#.#/#.#',
  L: '#../#../#../#../###', '/': '..#/..#/.#./#../#..', ' ': '.../.../.../.../...',
};
function fillFacade(t, tg) {
  const cv = document.getElementById('city-facade');
  if (!cv || document.documentElement.dataset.theme !== 'dusk') return false;
  const g = cv.getContext('2d');
  const [wall, ...lit] = FACADE[document.documentElement.dataset.sky] || FACADE.night;
  const W = cv.width;
  g.clearRect(0, 0, W, cv.height);
  g.fillStyle = wall;
  g.fillRect(0, 0, W, cv.height);   // a quiet stretch of wall (the windows here go dark)
  // a light per font pixel, varied like the real windows (most warm, some brighter, a few hot)
  const shade = (x, y) => { const h = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1; return lit[h > 0.94 ? 2 : h > 0.62 ? 1 : 0]; };
  const text = (str, y, s) => {
    const chars = String(str).split('');
    const w = chars.reduce((a, ch) => a + (ch === ' ' ? 2 : 3) * s + s, -s);
    let x = Math.round((W - w) / 2);
    for (const ch of chars) {
      const rows = (GLYPH[ch] || GLYPH[' ']).split('/');
      const cw = ch === ' ' ? 2 : 3;
      rows.forEach((row, ry) => row.split('').forEach((c, rx) => {
        if (c !== '#') return;
        for (let i = 0; i < s; i++) for (let j = 0; j < s; j++) { const px = x + rx * s + i; const py = y + ry * s + j; g.fillStyle = shade(px, py); g.fillRect(px, py, 1, 1); }
      }));
      x += cw * s + s;
    }
  };
  const r = (v) => String(Math.max(0, Math.round(v)));
  text(r(t.cal), 3, 2);                       // calories eaten, big
  text(`/${r(tg.cal)}`, 16, 1);               // of the goal
  text(`P${r(t.p)}`, 28, 2);                  // protein, carbs, fat
  text(`C${r(t.c)}`, 42, 2);
  text(`F${r(t.f)}`, 56, 2);
  cv.dataset.text = `${r(t.cal)} /${r(tg.cal)} P${r(t.p)} C${r(t.c)} F${r(t.f)}`;
  return true;
}

function renderGlance() {
  const k = dayKey();
  const t = totals(k);
  const tg = targets(k);
  const left = tg.cal - t.cal;
  const pct = Math.max(0, Math.min(100, (t.cal / (tg.cal || 1)) * 100));
  const h = new Date().getHours();
  const hello = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  document.body.classList.toggle('bb-on', fillFacade(t, tg));
  return `<button class="glance-view" data-act="glance-open" aria-label="Today: ${fmt(t.cal)} of ${fmt(tg.cal)} calories, ${fmt(t.p)} of ${tg.p} grams protein, ${fmt(t.c)} of ${tg.c} carbs, ${fmt(t.f)} of ${tg.f} fat. Tap to open.">
    <span class="gl-box">
      <span class="gl-hello">${hello}</span>
      <span class="gl-date">${esc(longDate(new Date()))}</span>
      <span class="gl-cal"><b class="vt">${fmt(t.cal)}</b><span class="gl-of">/ ${fmt(tg.cal)} kcal</span></span>
      <span class="gl-bar"><i style="width:${pct.toFixed(1)}%"></i></span>
      <span class="gl-left">${left >= 0 ? `${fmt(left)} left today` : `${fmt(-left)} over today`}</span>
      <span class="gl-macs">${[['p', 'Protein'], ['c', 'Carbs'], ['f', 'Fat']].map(([m, l]) => `
        <span class="gl-mac"><span class="gl-ml c-${m}">${l}</span><span class="gl-mv"><b>${fmt(t[m])}</b>/${fmt(tg[m])}g</span>
          <span class="gl-mbar"><i class="m-${m}" style="width:${Math.max(0, Math.min(100, (t[m] / (tg[m] || 1)) * 100)).toFixed(1)}%"></i></span></span>`).join('')}
      </span>
    </span>
    <span class="gl-tap">tap anywhere</span>
  </button>`;
}
on({
  'glance-open': () => {
    glance = false;
    document.body.classList.add('from-glance');
    setTimeout(() => document.body.classList.remove('from-glance'), 500);
    render();
  },
});

function render() {
  if (!S.setupDone) {
    document.body.classList.add('in-wizard');
    $app.innerHTML = renderWizard();
    $task.innerHTML = '';
    return;
  }
  document.body.classList.remove('in-wizard');
  if (glance && route() !== 'today') glance = false;   // navigating anywhere else leaves the glance
  document.body.classList.toggle('glance', glance);
  if (!glance) document.body.classList.remove('bb-on');
  if (glance) {
    $app.innerHTML = renderGlance();
    renderTaskbar(route());
    window.scrollTo(0, 0);
    lastRoute = '';
    document.title = 'Macros';
    return;
  }
  const r = route();
  const sameRoute = r === lastRoute;
  const y = window.scrollY;
  $app.innerHTML = SCREENS[r].render();
  renderTaskbar(r);
  if (SCREENS[r].after) SCREENS[r].after();
  window.scrollTo(0, sameRoute ? y : 0);
  lastRoute = r;
  lastHash = location.hash;
  document.title = `${SCREENS[r].title} - Macros`;
  drawModals();
}
setRerender(render);

function renderTaskbar(r) {
  const act = activeWorkout();
  const gymRoute = act ? 'workout' : 'gym';
  $task.innerHTML = `
    <button class="btn start-btn ${$start.classList.contains('open') ? 'on' : ''}" data-act="start">${icon(S.settings.theme === 'island' ? 'palm' : 'sun', 20)}<span>Start</span></button>
    <div class="tasks">
      ${TASKS.map(([k, l, ic]) => {
        const target = k === 'gym' ? gymRoute : k;
        const on = r === k || (k === 'gym' && r === 'workout');
        return `<button class="btn task ${on ? 'on' : ''} ${k === 'gym' && act ? 'live' : ''}" data-act="nav" data-to="#/${target}">${icon(ic, 20)}<span>${l}</span></button>`;
      }).join('')}
    </div>
    <div class="tray sunken"><span id="clock">${clockNow()}</span></div>`;
}

// ---------- Start menu ----------
function renderStart() {
  const item = (to, label, ic, act = 'nav') => `<button class="sm-item" data-act="${act}" ${to ? `data-to="${to}"` : ''}>${icon(ic, 24)}<span>${label}</span></button>`;
  $start.innerHTML = `
    <div class="sm-side"><span>MACROS<b>98</b></span></div>
    <div class="sm-items">
      ${item('', 'Weekly Report', 'trophy', 'sm-weekly')}
      ${item('#/sleep', 'Sleep', 'moon')}
      ${item('#/grocery', 'Grocery List', 'cart')}
      ${item('', 'Fast Food Mode', 'burger', 'sm-ff')}
      ${item('#/reminders', 'Reminders', 'bell')}
      ${item('', 'Exercise Library', 'book', 'sm-lib')}
      ${item('', 'Plate Calculator', 'plate', 'sm-plates')}
      ${item('#/settings', 'Control Panel', 'gear')}
      ${item('#/play', 'Gridlock (game)', 'blocks')}
      <div class="sm-sep"></div>
      ${deferredInstall ? item('', 'Install App', 'phone', 'sm-install') : isStandalone() ? '' : item('', 'Add to Home Screen', 'phone', 'sm-howto')}
      ${item('', 'About', 'sun', 'sm-about')}
    </div>`;
}
function toggleStart(open) {
  const isOpen = open ?? !$start.classList.contains('open');
  if (isOpen) renderStart();
  $start.classList.toggle('open', isOpen);
  const b = $task.querySelector('.start-btn');
  if (b) b.classList.toggle('on', isOpen);
}

let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; });

on({
  start: () => toggleStart(),
  nav: (el) => go(el.dataset.to),
  'sm-lib': () => { toggleStart(false); actions['ex-library'](); },
  'sm-plates': (el) => { toggleStart(false); actions['plate-calc'](el); },
  'sm-howto': () => { toggleStart(false); openInstallHelp(); },
  'sm-weekly': () => { toggleStart(false); actions.weekly(); },
  'sm-ff': () => { toggleStart(false); openFastFood(); },
  'sm-ai': () => { toggleStart(false); openAI(); },
  'sm-install': async () => {
    toggleStart(false);
    if (!deferredInstall) { openInstallHelp(); return; }
    deferredInstall.prompt();
    await deferredInstall.userChoice.catch(() => {});
    deferredInstall = null;
  },
  'sm-about': () => {
    toggleStart(false);
    msgBox({ title: 'About Macros', ico: 'sun', text: `<p><b>MACROS 98</b> v${APP_VERSION}</p><p>Food, training and weight - all in one place.</p><p class="muted small">Food data: built-in list + Open Food Facts. Your data stays on this phone.</p>` });
  },
  'check-update': async () => {
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    if (!reg) { toast('Updates need the installed app', 'warn'); return; }
    await reg.update().catch(() => {});
    if (reg.waiting) promptUpdate(reg); else toast('You have the latest version');
  },
});

// ---------- Global event delegation ----------
document.addEventListener('click', (e) => {
  unlockAudio();
  const el = e.target.closest('[data-act]');
  if (!el) {
    if ($start.classList.contains('open') && !e.target.closest('#startmenu')) toggleStart(false);
    return;
  }
  if (el.disabled) return;
  if ($start.classList.contains('open') && !el.closest('#startmenu') && el.dataset.act !== 'start') toggleStart(false);
  const fn = actions[el.dataset.act];
  if (fn) {
    e.preventDefault();
    const before = hapticsUsed();
    fn(el, e);
    if (hapticsUsed() === before) { const k = hapticFor(el); if (k) buzz(HAPTIC[k]); }
  }
});

// Which presses get a little tick: main buttons, navigation, logging and confirmations - not every control.
const TICK_ACTS = new Set(['nav', 'start', 'open-add', 'sug-add', 'day-set', 'pick-food', 'quick-add', 'ai-open', 'start-tpl',
  'go-workout', 'diary-day', 'diary-today', 'scan-barcode', 'fav', 'rest-skip', 'rest-add', 'weekly', 'set-add', 'ex-menu', 'cp-cat',
  'rpe-set', 'rpe-ask', 'sl-bed', 'sl-up', 'sl-pick', 'sl-q', 'ff-open', 'ff-chain', 'ff-budget', 'gr-staples', 'gr-add']);
function hapticFor(el) {
  const act = el.dataset.act;
  if (el.classList.contains('danger')) return 'warn';
  if (el.closest('.modal-wrap') && el.dataset.v === 'true') return 'press';  // "Yes" in a confirm box
  if (el.classList.contains('primary')) return 'press';
  if (TICK_ACTS.has(act) || el.classList.contains('task') || el.classList.contains('sm-item') || el.classList.contains('tab') || el.classList.contains('meal-btn') || el.classList.contains('chk')) return 'tap';
  return null;
}
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (el && actions[el.dataset.change]) actions[el.dataset.change](el, e);
});
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input]');
  if (el && actions[el.dataset.input]) actions[el.dataset.input](el, e);
});
// Select-all on focus makes editing numbers on a phone much faster
document.addEventListener('focusin', (e) => {
  const t = e.target;
  if (t.matches && t.matches('input[type="number"]') && t.value) setTimeout(() => { try { t.select(); } catch (err) { /* ignore */ } }, 0);
});
function routeChanged() {
  if (route() === 'weight' && lastRoute !== 'weight') resetWeightView();
  if (route() === 'food' && lastRoute !== 'food') foodView.date = dayKey();
}
setNavigate((hash) => {
  toggleStart(false);
  closeAllModals();
  if (location.hash !== hash) {
    try { history.pushState(null, '', hash); } catch (e) { lastHash = hash; location.hash = hash; }
  }
  routeChanged();
  render();
});
// Back button / swipe-back
function onHistory() {
  if (location.hash === lastHash) return;
  lastHash = location.hash;
  closeAllModals();
  routeChanged();
  render();
}
window.addEventListener('hashchange', onHistory);
window.addEventListener('popstate', onHistory);

// ---------- Timers ----------
setInterval(() => {
  tickWorkoutClock();
}, 1000);
setInterval(() => {
  const c = document.getElementById('clock');
  if (c) c.textContent = clockNow();
  const k = dayKey();
  if (k !== lastDay) { lastDay = k; foodView.date = k; if (!modalOpen()) render(); }
}, 15000);

// ---------- Visibility: badge + reminder sync ----------
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    save(true);
    if (navigator.setAppBadge && S.setupDone) {
      const need = S.weights[dayKey()] == null ? 1 : 0;
      (need ? navigator.setAppBadge(need) : navigator.clearAppBadge()).catch(() => {});
    }
  } else {
    if (dayKey() !== lastDay) { lastDay = dayKey(); foodView.date = lastDay; }
    if (hiddenAt && Date.now() - hiddenAt > GLANCE_AWAY && wantGlance()) { glance = true; toggleStart(false); }
    if (!modalOpen()) render();
    syncPush().catch(() => {});
  }
});

// ---------- Service worker (offline + updates) ----------
// Reload only after the user accepts an update. (On the very first visit the new worker
// also takes control, and reloading then would throw people out of the setup wizard.)
let reloadOnControllerChange = false;
function promptUpdate(reg) {
  msgBox({
    title: 'Update available', ico: 'floppy',
    text: '<p>A new version of Macros is ready.</p><p class="muted small">Your data is safe - it stays on your phone.</p>',
    buttons: [['Restart now', true], ['Later', false]],
  }).then((yes) => {
    if (yes && reg.waiting) { reloadOnControllerChange = true; reg.waiting.postMessage('skip-waiting'); }
  });
}
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      if (reg.waiting && navigator.serviceWorker.controller) promptUpdate(reg);
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) promptUpdate(reg);
        });
      });
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch((e) => console.warn('SW failed', e));
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!reloadOnControllerChange) return;
      reloadOnControllerChange = false;
      location.reload();
    });
  });
}

// ---------- Boot ----------
setWizardDone((finished) => {
  if (finished) {
    go('#/today');
    if (finished === 'restored') return;
    if (!isStandalone()) setTimeout(openInstallHelp, 400);
    else toast('Let\'s go!', 'palm');
    return;
  }
  render();
  window.scrollTo(0, 0);
});

// ---------- Data safety (runs once at startup) ----------
// 1. If the IndexedDB mirror holds newer data than localStorage (or localStorage came back empty
//    or unreadable), restore from the mirror.
// 2. Take a restore point before each app update and once a day.
// 3. Switch the mirror on so every save is written to both places.
async function protectData() {
  let recovered = false;
  try {
    const m = await readMirror();
    if (m) {
      const copy = JSON.parse(m);
      const newer = (copy.savedAt || 0) > (S.savedAt || 0);
      if (copy.setupDone && (!rawAtLoad || newer)) { replaceState(copy); recovered = true; }
    }
  } catch (e) {
    console.warn('mirror check failed', e);
  }
  enableMirror();
  const before = rawAtLoad;
  if (before && S.settings.lastVersion !== APP_VERSION) {
    await snapshot(`Before update to v${APP_VERSION}`, before);
    S.settings.lastSnapDay = dayKey();
  } else if (before && S.settings.lastSnapDay !== dayKey()) {
    await snapshot('Start of day', before);
    S.settings.lastSnapDay = dayKey();
  }
  S.settings.lastVersion = APP_VERSION;
  save(true);
  if (recovered) {
    render();
    toast('Recovered your data from the backup copy', 'floppy');
  }
}

applyTheme();
setHaptics(S.settings.haptics);
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
render();
protectData().finally(() => syncPush().catch(() => {}));
