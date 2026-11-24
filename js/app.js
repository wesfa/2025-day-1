// App shell: router, taskbar, Start menu, service worker, timers.
import { S, save, activeWorkout } from './store.js';
import { actions, on, setRerender, setNavigate, go, drawModals, closeAllModals, modalOpen, msgBox, toast, unlockAudio } from './ui.js';
import { icon } from './icons.js';
import { dayKey, clockNow, esc, isStandalone } from './util.js';
import { renderToday } from './today.js';
import { renderFood, view as foodView } from './food.js';
import { renderGym, renderWorkout, tickWorkoutClock } from './gym.js';
import { renderWeight, drawWeightChart, resetWeightView } from './weight.js';
import { renderSettings, renderReminders, applyTheme, openInstallHelp, APP_VERSION } from './settings.js';
import { renderWizard, setWizardDone } from './wizard.js';
import { syncPush } from './reminders.js';
import './report.js';

const SCREENS = {
  today: { render: renderToday, title: 'Today' },
  food: { render: renderFood, title: 'Food' },
  gym: { render: renderGym, title: 'Gym' },
  workout: { render: renderWorkout, title: 'Workout' },
  weight: { render: renderWeight, title: 'Weight', after: drawWeightChart },
  reminders: { render: renderReminders, title: 'Reminders' },
  settings: { render: renderSettings, title: 'Settings' },
};

const TASKS = [
  ['today', 'Today', 'calendar'],
  ['food', 'Food', 'burger'],
  ['gym', 'Gym', 'dumbbell'],
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

function render() {
  if (!S.setupDone) {
    document.body.classList.add('in-wizard');
    $app.innerHTML = renderWizard();
    $task.innerHTML = '';
    return;
  }
  document.body.classList.remove('in-wizard');
  const r = route();
  const sameRoute = r === lastRoute;
  const y = window.scrollY;
  $app.innerHTML = SCREENS[r].render();
  renderTaskbar(r);
  if (SCREENS[r].after) SCREENS[r].after();
  window.scrollTo(0, sameRoute ? y : 0);
  lastRoute = r;
  lastHash = location.hash;
  document.title = `${SCREENS[r].title} - Trenches`;
  drawModals();
}
setRerender(render);

function renderTaskbar(r) {
  const act = activeWorkout();
  const gymRoute = act ? 'workout' : 'gym';
  $task.innerHTML = `
    <button class="btn start-btn ${$start.classList.contains('open') ? 'on' : ''}" data-act="start">${icon('football', 20)}<span>Start</span></button>
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
    <div class="sm-side"><span>TRENCHES<b>98</b></span></div>
    <div class="sm-items">
      ${item('#/today', 'Today', 'calendar')}
      ${item('#/food', 'Food Diary', 'burger')}
      ${item('#/gym', 'Gym', 'dumbbell')}
      ${item('#/weight', 'Weight', 'scale')}
      <div class="sm-sep"></div>
      ${item('', 'Weekly Report', 'trophy', 'sm-weekly')}
      ${item('#/reminders', 'Reminders', 'bell')}
      ${item('', 'Exercise Library', 'book', 'sm-lib')}
      ${item('', 'Plate Calculator', 'plate', 'sm-plates')}
      ${item('#/settings', 'Control Panel', 'gear')}
      <div class="sm-sep"></div>
      ${deferredInstall ? item('', 'Install App', 'phone', 'sm-install') : isStandalone() ? '' : item('', 'Add to Home Screen', 'phone', 'sm-howto')}
      ${item('', 'About', 'football', 'sm-about')}
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
  'sm-install': async () => {
    toggleStart(false);
    if (!deferredInstall) { openInstallHelp(); return; }
    deferredInstall.prompt();
    await deferredInstall.userChoice.catch(() => {});
    deferredInstall = null;
  },
  'sm-about': () => {
    toggleStart(false);
    msgBox({ title: 'About Trenches', ico: 'football', text: `<p><b>TRENCHES 98</b> v${APP_VERSION}</p><p>Nutrition + training for defensive linemen. Win the trenches.</p><p class="muted small">Food data: built-in list + Open Food Facts. Your data stays on this phone.</p>` });
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
  if (fn) { e.preventDefault(); fn(el, e); }
});
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
  if (location.hash !== hash) history.pushState(null, '', hash);
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
    save(true);
    if (navigator.setAppBadge && S.setupDone) {
      const need = S.weights[dayKey()] == null ? 1 : 0;
      (need ? navigator.setAppBadge(need) : navigator.clearAppBadge()).catch(() => {});
    }
  } else {
    if (dayKey() !== lastDay) { lastDay = dayKey(); foodView.date = lastDay; }
    if (!modalOpen()) render();
    syncPush().catch(() => {});
  }
});

// ---------- Service worker (offline + updates) ----------
function promptUpdate(reg) {
  msgBox({
    title: 'Update available', ico: 'floppy',
    text: '<p>A new version of Trenches is ready.</p><p class="muted small">Your data is safe - it stays on your phone.</p>',
    buttons: [['Restart now', true], ['Later', false]],
  }).then((yes) => { if (yes && reg.waiting) reg.waiting.postMessage('skip-waiting'); });
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
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
  });
}

// ---------- Boot ----------
setWizardDone((finished) => {
  if (finished) {
    go('#/today');
    if (!isStandalone()) setTimeout(openInstallHelp, 400);
    else toast(`Let's go${S.profile.name ? ', ' + esc(S.profile.name) : ''}!`, 'football');
    return;
  }
  render();
  window.scrollTo(0, 0);
});

applyTheme();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
render();
syncPush().catch(() => {});
