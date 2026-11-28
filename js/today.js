// Today dashboard.
import { S, save, day, peekDay, totals, targets, activeWorkout, nextTemplate, workoutOn, streak, getEx, getFood, MEALS } from './store.js';
import { FOOD_BY_ID } from './foods.js';
import { dayKey, esc, r0, r1, fmt, longDate, buzz, isStandalone, fmtTime } from './util.js';
import { win, group, bar, btn, on, rerender, toast } from './ui.js';
import { icon } from './icons.js';
import { openAddFood, openFoodDetail, mealForNow, microStrip } from './food.js';
import { logWeight, weightStats, goalSuggestion, goalSuggestionBox } from './weight.js';
import { dueNow, dateRule, DATE_KINDS } from './reminders.js';
import './ai.js';
import { sleepCard } from './sleep.js';

// High-protein / calorie-dense staples the coach can suggest
const PROTEIN_PICKS = [
  'b:chicken-breast-grilled-4-oz-cooked', 'b:greek-yogurt-plain-nonfat-6-oz', 'b:protein-shake-ready-to-drink-11-oz-bottle',
  'b:whey-protein-powder-1-scoop', 'b:tuna-canned-in-water-1-can-drained', 'b:cottage-cheese-2-1-2-cup',
  'b:ultra-filtered-milk-2-1-cup', 'b:beef-jerky-1-oz', 'b:egg-large-1-egg', 'b:ground-beef-93-7-cooked-4-oz',
  'b:string-cheese-1-stick', 'b:turkey-deli-sliced-2-oz',
];
const CARB_PICKS = [
  'b:white-rice-1-cup-cooked', 'b:bagel-plain-1-medium', 'b:pb-j-sandwich-1-sandwich', 'b:chocolate-milk-lowfat-1-cup',
  'b:banana-1-medium', 'b:oats-rolled-dry-1-2-cup', 'b:pasta-1-cup-cooked', 'b:granola-1-2-cup', 'b:milk-whole-1-cup',
];

function suggestions(left) {
  const out = [];
  const pool = (ids) => {
    // recents/favorites first so suggestions feel personal
    const mine = [...S.favs, ...S.recent].map(getFood).filter(Boolean);
    const base = ids.map((id) => FOOD_BY_ID[id]).filter(Boolean);
    const seen = new Set();
    return [...mine, ...base].filter((f) => (seen.has(f.id) ? false : seen.add(f.id)));
  };
  if (left.p > 20) {
    const picks = pool(PROTEIN_PICKS)
      .filter((f) => f.p >= 8 && f.cal <= Math.max(200, left.cal + 100))
      .sort((a, b) => b.p / Math.max(b.cal, 1) - a.p / Math.max(a.cal, 1));
    out.push(...picks.slice(0, 3));
  }
  if (left.cal > 400 && left.c > 40) {
    const picks = pool(CARB_PICKS).filter((f) => f.c >= 20 && f.cal <= left.cal + 100 && !out.includes(f))
      .sort((a, b) => b.cal - a.cal);
    out.push(...picks.slice(0, 2));
  }
  return out.slice(0, 2);
}

export function renderToday() {
  const k = dayKey();
  const t = totals(k);
  const tg = targets(k);
  const d = peekDay(k);
  const left = { cal: tg.cal - t.cal, p: tg.p - t.p, c: tg.c - t.c, f: tg.f - t.f };
  const wst = weightStats();
  const weighed = S.weights[k];
  const st = streak();
  const act = activeWorkout();
  const doneToday = workoutOn(k);
  const next = nextTemplate();
  const due = dueNow().filter((r) => r.kind !== 'weigh');
  const rule = dateRule(k);
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // --- weigh-in ---
  const weigh = weighed != null
    ? `<div class="weigh-done">${icon('check', 16)} <b class="vt">${r1(weighed)}</b> lb today
        <span class="muted small">trend ${r1(wst.now)} · ${Math.abs(wst.toGo) <= 0.5 ? 'at your goal' : `${r1(Math.abs(wst.toGo))} lb to goal ${r1(wst.goal)}`}</span></div>`
    : `<div class="alert">
        <div class="alert-head">${icon('scale', 20)}<b>Daily weigh-in</b></div>
        <form class="weigh-form" onsubmit="return false">
          <input id="t-weigh" class="inp big-num" type="number" inputmode="decimal" step="0.1" placeholder="${wst.latest ?? S.profile.startWeight}">
          <span class="unit">lb</span>
          ${btn('Log', 't-weigh', { cls: 'primary', type: 'submit' })}
        </form>
      </div>`;

  // --- training ---
  let train;
  if (act) train = `<p><b>${esc(act.name)}</b> is in progress.</p>${btn('Resume workout', 'go-workout', { cls: 'primary wide', ico: 'dumbbell' })}`;
  else if (doneToday.length) train = `<p class="ok-line">${icon('check', 16)} Done: ${esc(doneToday.map((w) => w.name).join(', '))}</p><p class="muted small">Recovery = protein + carbs + sleep. Get 8+ hours.</p>`;
  else if (next) train = `<p class="next-name">${esc(next.name)}</p><p class="muted small">${next.items.slice(0, 4).map((i) => esc(getEx(i.ex).name)).join(' · ')}${next.items.length > 4 ? ' ...' : ''}</p>
      <div class="btn-row">${btn('Start', 'start-tpl', { cls: 'primary grow', data: `data-id="${next.id}"`, ico: 'dumbbell' })}${tg.dayType ? btn(tg.dayType === 'train' ? 'Rest day' : 'Train today', 'day-set', { data: `data-type="${tg.dayType === 'train' ? 'rest' : 'train'}"` }) : ''}</div>
      ${tg.dayType === 'rest' ? '<p class="muted small">Rest day - recover, stretch, and still hit your protein.</p>' : ''}`;
  else train = btn('Open gym', 'nav', { data: 'data-to="#/gym"' });

  const sug = suggestions(left);
  const sleep = sleepCard();
  const DAY = 86400000;
  const showInstall = !isStandalone() && !(S.settings.hideInstallUntil > Date.now());
  const backupDue = Date.now() - (S.settings.lastBackup || S.created || Date.now()) > 14 * DAY && !(S.settings.hideBackupUntil > Date.now());
  const showSky = S.settings.theme === 'dusk' && !S.settings.loc && !(S.settings.hideSkyUntil > Date.now());
  const nudges = `
    ${showSky ? `<div class="alert soft nudge">${icon('sun', 16)}<span>Show the real sky and weather where you live?</span>${btn('Use my location', 'sky-gps')}<button class="btn sq" data-act="hide-sky" aria-label="Not now">${icon('close', 8)}</button></div>` : ''}
    ${showInstall ? `<div class="alert soft nudge">${icon('phone', 16)}<span>Put Macros on your home screen for full-screen + offline.</span>${btn('How', 'install-help')}<button class="btn sq" data-act="hide-install" aria-label="Dismiss">${icon('close', 8)}</button></div>` : ''}
    ${backupDue ? `<div class="alert soft nudge">${icon('floppy', 16)}<span>Back up your data (it only lives on this phone).</span>${btn('Backup', 'backup-export')}<button class="btn sq" data-act="hide-backup" aria-label="Later">${icon('close', 8)}</button></div>` : ''}`;

  return `
  <div class="today-hero">
    <div class="th-hello">${hello}</div>
    <div class="th-date">${esc(longDate(new Date()))}${st ? ` <span class="th-streak">${icon('flame', 14)} ${st}-day streak</span>` : ''}</div>
  </div>
  ${nudges}
  ${win(hello, `
    <div class="today-top">
      <span>${esc(longDate(new Date()))}</span>
      ${st ? `<span class="streak">${icon('flame', 16)} ${st}-day streak</span>` : '<span class="muted small">Log food to start a streak</span>'}
    </div>
    ${rule ? `<div class="day-rule"><span class="tag kind-${rule.kind}">${DATE_KINDS[rule.kind]}</span> ${esc(rule.label)}${rule.kind === 'early' && rule.end ? ` - out at ${fmtTime(rule.end)}` : ''}</div>` : ''}
    ${weigh}
    ${due.length ? `<div class="alert soft">${icon('bell', 16)} <span>${due.map((r) => esc(r.label)).join(' · ')}</span></div>` : ''}
    ${tg.dayType ? `<div class="day-type">
      <span class="tag dt-${tg.dayType}">${tg.dayType === 'train' ? 'Training day' : 'Rest day'}</span>
      <span class="muted small">${tg.dayDelta > 0 ? '+' : ''}${fmt(tg.dayDelta)} kcal vs avg day</span>
    </div>` : ''}
    ${goalSuggestionBox(goalSuggestion(), true)}
    <div class="cal-box panel sunken">
      <div class="cal-nums">
        <div><span>Eaten</span><b class="vt">${fmt(t.cal)}</b></div>
        <div class="cal-op">/</div>
        <div><span>Goal</span><b class="vt">${fmt(tg.cal)}</b></div>
        <div class="cal-left ${left.cal < 0 ? 'bad' : ''}"><span>${left.cal >= 0 ? 'Left' : 'Over'}</span><b class="vt">${fmt(Math.abs(left.cal))}</b></div>
      </div>
      ${bar(t.cal, tg.cal, { label: 'Calories' })}
    </div>
    <div class="mac-grid today-macs">
      ${[['p', 'Protein'], ['c', 'Carbs'], ['f', 'Fat']].map(([m, l]) => `
        <div class="macro">
          <span class="mac-l c-${m}">${l}</span>
          ${bar(t[m], tg[m], { cls: 'thin m-' + m, label: l })}
          <span class="mac-v"><b class="vt c-${m}">${r0(t[m])}</b>/${tg[m]}g</span>
        </div>`).join('')}
    </div>
    ${microStrip(t, tg)}
  `, { ico: 'calendar', cls: 'today-main' })}

  ${win('Log Food', `
    ${btn('Snap a photo - AI logs it', 'ai-open', { cls: 'primary wide ai-cta', ico: 'camera', data: `data-meal="${mealForNow()}"` })}
    <div class="meal-btns">${MEALS.map((m) => `<button class="btn meal-btn ${m === mealForNow() ? 'now' : ''}" data-act="open-add" data-meal="${m}"><span>${m}${m === mealForNow() ? '<em class="mb-next">next</em>' : ''}</span><small>${fmt(d.food.filter((e) => e.meal === m).reduce((a, e) => a + e.cal * e.qty, 0))} kcal</small></button>`).join('')}</div>
    ${sug.length ? `<div class="sub-head">Coach says: ${left.p > 20 ? `you need <b class="c-p">${r0(left.p)}g protein</b>` : `<b>${fmt(left.cal)} kcal</b> left`}. Try:</div>
      <div class="sug-list">${sug.map((f) => `<button class="sug" data-act="sug-add" data-fid="${esc(f.id)}"><span>${esc(f.name)}</span><small>${esc(f.serving)} · ${fmt(f.cal)} kcal · <span class="c-p">${r0(f.p)}g P</span></small><b>+</b></button>`).join('')}</div>` : ''}
    ${left.cal < -300 && tg.dir < 0 ? '<p class="muted small">Over today. No stress - one day doesn\'t matter, the weekly average does.</p>' : ''}
    <div class="btn-row">${btn('Eating out? Fast food mode', 'ff-open', { ico: 'burger', cls: 'wide', data: `data-meal="${mealForNow()}"` })}</div>
  `, { ico: 'burger' })}

  ${win('Training', train, { ico: 'dumbbell' })}

  ${sleep ? win('Sleep', sleep, { ico: 'moon' }) : ''}

  <div class="btn-row center bottom-links">${btn('Weekly report', 'weekly', { ico: 'trophy' })}${btn('Reminders', 'nav', { ico: 'bell', data: 'data-to="#/reminders"' })}${btn('Gridlock', 'nav', { ico: 'blocks', data: 'data-to="#/play"' })}</div>
  `;
}

on({
  't-weigh': () => {
    const v = document.getElementById('t-weigh').value;
    if (logWeight(dayKey(), v)) { toast(`Logged ${r1(Number(v))} lb`, 'scale'); rerender(); }
  },
  'hide-install': () => { S.settings.hideInstallUntil = Date.now() + 3 * 86400000; save(); rerender(); },
  'hide-sky': () => { S.settings.hideSkyUntil = Date.now() + 30 * 86400000; save(); rerender(); },
  'hide-backup': () => { S.settings.hideBackupUntil = Date.now() + 7 * 86400000; save(); rerender(); },
  'day-set': (el) => {
    const d = day(dayKey());
    d.dayType = el.dataset.type;
    save(); buzz(10);
    const t = targets(dayKey());
    toast(`${t.dayType === 'train' ? 'Training' : 'Rest'} day: ${fmt(t.cal)} kcal, ${t.c}g carbs`, t.dayType === 'train' ? 'dumbbell' : 'check');
    rerender();
  },
  'sug-add': (el) => {
    const f = getFood(el.dataset.fid);
    if (f) openFoodDetail(f, { date: dayKey(), meal: mealForNow() });
  },
});

export { openAddFood };
