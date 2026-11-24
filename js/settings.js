// Settings, profile, targets, reminders + notifications, backup, install help.
import { S, save, targets, currentWeight, replaceState, resetState, DEFAULT_REMINDERS } from './store.js';
import { calcTargets, PHASES } from './calc.js';
import { busyOn, planFor, dateRule, blockKind, importSchedule, DATE_KINDS, buildICS, newTopic, syncPush, sendTest, untilText } from './reminders.js';
import { dayKey, addDays, parseDay, prettyDay, shortDate, esc, r0, r1, num, uid, fmtTime, DOW, saveFile, isIOS, isAndroid, isStandalone, toMin } from './util.js';
import { win, group, btn, field, numInput, select, dayPicker, on, openModal, closeModal, closeAllModals, rerender, drawModals, toast, confirmBox, msgBox, formData } from './ui.js';
import { icon } from './icons.js';
import { resetProgram } from './gym.js';
import { aiSettingsGroup } from './ai.js';

export const APP_VERSION = '1.3.2';

export const THEMES = {
  island: 'Island',
  classic: 'Classic Teal',
  slate: 'Slate',
  storm: 'Rainy Day',
  maroon: 'Gameday Maroon',
  night: 'High Contrast Night',
};

export function applyTheme() {
  document.documentElement.dataset.theme = THEMES[S.settings.theme] ? S.settings.theme : 'island';
  const meta = document.querySelector('meta[name="theme-color"]');
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--desk').trim();
  if (meta && bg) meta.setAttribute('content', bg);
}

const heightOpts = () => {
  const out = [];
  for (let i = 60; i <= 84; i++) out.push([i, `${Math.floor(i / 12)}' ${i % 12}"`]);
  return out;
};

// ================= Settings / Control Panel =================
export function renderSettings() {
  const p = S.profile;
  const tg = targets();
  const auto = S.targets.auto;
  const calc = calcTargets(p, currentWeight());
  const lastB = S.settings.lastBackup;
  const backupAge = lastB ? Math.floor((Date.now() - lastB) / 86400000) : null;

  return win('Control Panel', `
    ${group('Profile', `
      <form id="prof" onsubmit="return false">
        <div class="grid2">
          ${field('Name', `<input class="inp" name="name" value="${esc(p.name)}" placeholder="Your name">`)}
          ${field('Position', select('position', [['DE', 'DE'], ['DT', 'DT'], ['DE/DT', 'DE / DT'], ['NT', 'Nose tackle']], p.position))}
          ${field('Age', numInput('age', p.age, { step: 1 }))}
          ${field('Height', select('heightIn', heightOpts(), p.heightIn))}
          ${field('Start weight (lb)', numInput('startWeight', p.startWeight))}
          ${field('Goal weight (lb)', numInput('goalWeight', p.goalWeight))}
          ${field('Pace (lb/week)', select('rate', [[0.25, '0.25 - slow & lean'], [0.5, '0.5 - recommended'], [0.75, '0.75'], [1, '1.0 - aggressive']], p.rate))}
          ${field('Sex (for calorie math)', select('sex', [['m', 'Male'], ['f', 'Female']], p.sex))}
        </div>
        ${field('Training phase', select('phase', Object.entries(PHASES).map(([k, v]) => [k, v.label]), p.phase))}
        <div class="btn-row">${btn('Save profile', 'prof-save', { cls: 'primary grow', type: 'submit' })}</div>
      </form>`)}

    ${group('Daily targets', `
      <div class="target-grid">
        <div class="stat sunken"><span>Calories</span><b class="vt">${tg.cal}</b></div>
        <div class="stat sunken"><span>Protein</span><b class="vt">${tg.p}g</b></div>
        <div class="stat sunken"><span>Carbs</span><b class="vt">${tg.c}g</b></div>
        <div class="stat sunken"><span>Fat</span><b class="vt">${tg.f}g</b></div>
        <div class="stat sunken"><span>Water</span><b class="vt">${tg.water}oz</b></div>
      </div>
      <p class="muted small">How it's figured: maintenance ~${calc.maintenance} kcal (${esc((PHASES[p.phase] || PHASES.off).label.toLowerCase())}) ${calc.delta >= 0 ? '+' : '-'} ${Math.abs(calc.delta)} to ${calc.dir > 0 ? 'gain' : calc.dir < 0 ? 'lose' : 'hold'} ${p.rate} lb/week. Protein ~1g per lb, fat 25%, the rest carbs - linemen need carbs to fuel practice. Auto mode updates as your weight changes.</p>
      <label class="check"><input type="checkbox" data-change="t-auto" ${auto ? 'checked' : ''}><span>Auto-calculate (recommended)</span></label>
      ${auto ? '' : `<form id="tg" onsubmit="return false"><div class="grid2">
        ${field('Calories', numInput('cal', S.targets.cal))}${field('Protein g', numInput('p', S.targets.p))}
        ${field('Carbs g', numInput('c', S.targets.c))}${field('Fat g', numInput('f', S.targets.f))}
        ${field('Water oz', numInput('water', S.targets.water))}</div>
        <div class="btn-row">${btn('Save targets', 't-save', { cls: 'primary grow', type: 'submit' })}</div></form>`}
      <p class="muted small">Coach or nutritionist gave you numbers? Turn off auto and type them in.</p>`)}

    ${aiSettingsGroup()}

    ${group('Reminders', `<p>Weigh-in, meal, and gym reminders that skip school and work hours.</p>${btn('Open Reminders', 'nav', { data: 'data-to="#/reminders"', ico: 'bell', cls: 'wide' })}`)}

    ${group('Appearance', `
      ${field('Color scheme', select('theme', Object.entries(THEMES), S.settings.theme, { data: 'data-change="theme"' }))}
      <label class="check"><input type="checkbox" data-change="set-sound" ${S.settings.sound ? 'checked' : ''}><span>Beep when rest timer ends</span></label>
      <label class="check"><input type="checkbox" data-change="set-restauto" ${S.settings.restAuto ? 'checked' : ''}><span>Start rest timer when I check off a set</span></label>`)}

    ${group('Backup', `
      <p class="muted small">Your data lives only on this phone. Export a backup now and then (save it to Files / Drive) so you never lose your history.${backupAge != null ? ` Last backup: ${backupAge === 0 ? 'today' : backupAge + ' days ago'}.` : ' No backup yet.'}</p>
      <div class="btn-row">${btn('Export backup', 'backup-export', { ico: 'floppy' })}${btn('Import backup', 'backup-import')}</div>
      <input type="file" id="backup-file" accept=".json,application/json,text/plain" hidden data-change="backup-file">`)}

    ${group('Program', `<p class="muted small">Restore the default DE/DT 4-day program (your workout history is kept).</p>${btn('Reset program to default', 'reset-program')}`)}

    ${group('App', `
      <p>MACROS v${APP_VERSION}${isStandalone() ? ' · installed' : ''}</p>
      <div class="btn-row">${btn('Add to Home Screen', 'install-help', { ico: 'phone' })}${btn('Check for update', 'check-update')}</div>
      <div class="btn-row">${btn('Erase all data', 'reset-all', { cls: 'danger' })}</div>
      <p class="muted small">Calorie and macro targets are estimates for healthy athletes. If you're under 18, loop in your coach, athletic trainer, or doctor before big weight changes.</p>`)}
  `, { ico: 'gear' });
}

on({
  'prof-save': () => {
    const v = formData(document.getElementById('prof'));
    Object.assign(S.profile, {
      name: v.name.trim(), position: v.position, age: num(v.age, 17), heightIn: num(v.heightIn, 72),
      startWeight: num(v.startWeight, S.profile.startWeight), goalWeight: num(v.goalWeight, S.profile.goalWeight),
      rate: num(v.rate, 0.5), sex: v.sex, phase: v.phase,
    });
    save(); toast('Profile saved - targets updated'); rerender();
  },
  't-auto': (el) => {
    S.targets.auto = el.checked;
    if (!el.checked) { const t = calcTargets(S.profile, currentWeight()); Object.assign(S.targets, { cal: t.cal, p: t.p, c: t.c, f: t.f, water: t.water }); }
    save(); rerender();
  },
  't-save': () => {
    const v = formData(document.getElementById('tg'));
    Object.assign(S.targets, { cal: num(v.cal), p: num(v.p), c: num(v.c), f: num(v.f), water: num(v.water) });
    save(); toast('Targets saved'); rerender();
  },
  theme: (el) => { S.settings.theme = el.value; save(); applyTheme(); rerender(); },
  'set-sound': (el) => { S.settings.sound = el.checked; save(); },
  'set-restauto': (el) => { S.settings.restAuto = el.checked; save(); },
  'backup-export': async () => {
    S.settings.lastBackup = Date.now(); save(true);
    const ok = await saveFile(`macros-backup-${dayKey()}.json`, JSON.stringify(S, null, 1));
    if (ok) toast('Backup exported', 'floppy');
    rerender();
  },
  'backup-import': () => document.getElementById('backup-file').click(),
  'backup-file': async (el) => {
    const file = el.files && el.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || !data.profile || !data.days) throw new Error('not a backup');
      if (!(await confirmBox('Replace everything on this phone with this backup?', 'Import backup', 'Replace'))) return;
      replaceState(data);
      toast('Backup restored', 'floppy');
      location.reload();
    } catch (e) {
      msgBox({ title: 'Import failed', text: 'That file isn\'t a Macros backup.' });
    }
  },
  'reset-program': async () => {
    if (!(await confirmBox('Replace your program days with the default DE/DT program?'))) return;
    resetProgram(); toast('Program reset'); rerender();
  },
  'reset-all': async () => {
    if (!(await confirmBox('Erase ALL food logs, weigh-ins and workouts on this phone? This cannot be undone. Export a backup first!', 'Erase all data', 'Erase'))) return;
    if (!(await confirmBox('Last chance. Really erase everything?', 'Erase all data', 'Erase'))) return;
    resetState(); location.hash = '#/today'; location.reload();
  },
  'install-help': () => openInstallHelp(),
});

// ================= Install help =================
export function openInstallHelp() {
  const ios = isIOS(); const android = isAndroid();
  const iosSteps = `<ol class="steps">
      <li>Open this page in <b>Safari</b> (not Chrome or an in-app browser).</li>
      <li>Tap the <b>Share</b> button (square with an arrow up) at the bottom of the screen.</li>
      <li>Scroll down and tap <b>Add to Home Screen</b>.</li>
      <li>Keep the name <b>Macros</b> and tap <b>Add</b>.</li>
      <li>Open it from the new icon. It runs full-screen and works offline.</li>
    </ol>`;
  const androidSteps = `<ol class="steps">
      <li>Open this page in <b>Chrome</b>.</li>
      <li>Tap the <b>three dots</b> menu (top right).</li>
      <li>Tap <b>Add to Home screen</b> or <b>Install app</b>.</li>
      <li>Tap <b>Install</b>. The Macros icon shows up on your home screen.</li>
    </ol>`;
  openModal(() => win('Add to Home Screen', `
    ${isStandalone() ? `<p class="ok-line">${icon('check', 16)} You're running the installed app. You're all set.</p>` : ''}
    ${ios || !android ? group('iPhone', iosSteps) : ''}
    ${android || !ios ? group('Android', androidSteps) : ''}
    <p class="muted small">Important on iPhone: the home-screen app keeps its own data, separate from Safari. Do your logging from the icon. Moving phones? Export a backup in Control Panel first.</p>
    <div class="btn-row">${btn('Got it', 'modal-close', { cls: 'primary grow' })}</div>
  `, { cls: 'dialog', close: 'modal-close', ico: 'phone' }));
}

// ================= Reminders screen =================
const BLOCK_KINDS = { school: 'School', work: 'Work', other: 'Other' };

function rangeText(d) {
  const to = d.to || d.from;
  return to === d.from ? prettyDay(d.from) : `${prettyDay(d.from, { short: true })} - ${prettyDay(to, { short: true })}`;
}

export function renderReminders() {
  const sch = S.schedule;
  const N = S.notify;
  const today = dayKey();
  const busyRows = sch.busy.map((b) => `
    <button class="row" data-act="busy-edit" data-id="${b.id}">
      <span class="row-main"><span class="row-name">${esc(b.label)}</span><span class="row-sub">${BLOCK_KINDS[blockKind(b)]} · ${b.days.map((d) => DOW[d]).join(' ')} · ${fmtTime(b.start)} - ${fmtTime(b.end)}</span></span>
    </button>`).join('');
  const dates = (sch.dates || []).slice().sort((x, y) => (x.from < y.from ? -1 : 1));
  const upcoming = dates.filter((d) => (d.to || d.from) >= today);
  const past = dates.length - upcoming.length;
  const dateRows = upcoming.map((d) => `
    <button class="row" data-act="date-edit" data-id="${d.id}">
      <span class="row-main"><span class="row-name">${esc(d.label)}</span><span class="row-sub">${esc(rangeText(d))}${d.kind === 'early' && d.end ? ` · out at ${fmtTime(d.end)}` : ''}</span></span>
      <span class="tag kind-${d.kind}">${DATE_KINDS[d.kind]}</span>
    </button>`).join('');
  const remRows = S.reminders.map((r) => `
    <div class="row static ${r.on ? '' : 'off'}">
      <label class="check inline"><input type="checkbox" data-change="rem-toggle" data-id="${r.id}" ${r.on ? 'checked' : ''}><span class="sr">On</span></label>
      <button class="row-main link-row" data-act="rem-edit" data-id="${r.id}"><span class="row-name">${esc(r.label)}</span><span class="row-sub">${fmtTime(r.time)} · ${r.days.length === 7 ? 'every day' : r.days.map((d) => DOW[d]).join(' ')}</span></button>
    </div>`).join('');

  // the next 7 real days, with holidays / early dismissal / trips applied
  const grid = `<div class="week-grid">${[0, 1, 2, 3, 4, 5, 6].map((i) => {
    const key = addDays(today, i);
    const rule = dateRule(key);
    const plan = planFor(key);
    const busy = busyOn(key);
    return `<div class="wg-day ${i === 0 ? 'today' : ''}"><div class="wg-h">${DOW[parseDay(key).getDay()]} ${shortDate(key)}</div>
      ${rule ? `<div class="wg-rule kind-${rule.kind}">${esc(rule.label)}</div>` : ''}
      ${busy.map(([s, e, l]) => `<div class="wg-busy">${esc(l)}<br>${fmtTime(toHHMM(s))}-${fmtTime(toHHMM(e))}</div>`).join('')}
      ${plan.map((it) => `<div class="wg-item ${it.moved ? 'moved' : ''}"><b>${fmtTime(it.time)}</b> ${esc(it.labels.join(' + '))}</div>`).join('') || '<div class="muted small">-</div>'}
    </div>`;
  }).join('')}</div>`;

  const push = N.method === 'ntfy' && N.topic
    ? `<p class="ok-line">${icon('check', 16)} Phone alerts ON - ${esc(untilText())}</p>
       <p class="muted small">Topic: <code class="sel">${esc(N.topic)}</code></p>
       <p class="muted small">Alerts get queued ~2 days ahead every time you open Macros, so just keep using the app. Changed your schedule? Old alerts already queued (up to 2 days) still go out.</p>
       <div class="btn-row">${btn('Send test', 'ntfy-test')}${btn('Sync now', 'ntfy-sync')}${btn('Turn off', 'ntfy-off', { cls: 'danger' })}</div>`
    : `<ol class="steps">
        <li>Install the free <b>ntfy</b> app (App Store / Google Play).</li>
        <li>Tap ${btn('Set up phone alerts', 'ntfy-setup', { cls: 'primary' })} here - you'll get a private topic name.</li>
        <li>In ntfy tap <b>+</b>, paste the topic, subscribe, and allow notifications.</li>
      </ol>
      <p class="muted small">Real push notifications at the right times, no account needed. Reminder text (like "Log lunch") is sent through ntfy.sh - your food and weight data never leaves this phone.</p>`;

  return win('Reminders', `
    <p class="muted small">Tell Macros when you're at school or work. Reminders that land in those blocks get moved to right before or after, and nothing fires while you're asleep.</p>
    ${group('My week', `
      ${busyRows || '<p class="empty">No school/work blocks yet.</p>'}
      <div class="btn-row">${btn('+ Add school / work / practice', 'busy-add')}</div>
      <div class="grid2">
        ${field('Wake up', `<input class="inp" type="time" value="${sch.wake}" data-change="sch-wake">`)}
        ${field('Bedtime', `<input class="inp" type="time" value="${sch.sleep}" data-change="sch-sleep">`)}
      </div>`)}
    ${group('Days off & trips', `
      <p class="muted small">No school skips school blocks. Early dismissal ends school early. Out of town skips school and work and pauses weigh-in, gym and pre-practice reminders (meal reminders keep going).</p>
      ${dateRows || '<p class="empty">No upcoming days off.</p>'}
      ${past ? `<p class="muted small">${past} past date${past > 1 ? 's' : ''} hidden.</p>` : ''}
      <div class="btn-row">${btn('+ Add dates', 'date-add')}${btn('Import schedule file', 'sched-import', { ico: 'floppy' })}</div>`)}
    ${group('Reminders', remRows + `<div class="btn-row">${btn('+ Custom reminder', 'rem-add')}${btn('Restore defaults', 'rem-reset')}</div>`)}
    ${group('Next 7 days', `<p class="muted small">Gray = busy. <span class="moved-key">Highlighted</span> = moved to fit around school/work.</p>${grid}`)}
    ${group('Phone alerts (push notifications)', push)}
    ${group('Calendar alerts (backup option)', `
      <p class="muted small">Adds repeating events with alerts to your phone's calendar. Works with no extra app, but it only knows your normal week - not days off or trips (phone alerts do). Re-download if your schedule changes (delete the old "Macros" events first).</p>
      ${btn('Download calendar file', 'ics-download', { ico: 'calendar' })}`)}
  `, { ico: 'bell' });
}

function toHHMM(m) { return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; }

// ---- busy block editor ----
function openBusy(b) {
  const isNew = !b;
  b = b || { id: 'b' + uid(), label: 'Work', kind: 'work', days: [6], start: '10:00', end: '16:00' };
  openModal(() => win(isNew ? 'Add Busy Block' : 'Edit Busy Block', `
    <form id="busy" onsubmit="return false">
      ${field('What is it?', `<input class="inp" name="label" value="${esc(b.label)}" list="busy-labels">
        <datalist id="busy-labels"><option value="School"><option value="Work"><option value="Practice"><option value="Church"><option value="Class"></datalist>`)}
      ${field('Type', select('kind', Object.entries(BLOCK_KINDS), blockKind(b)), { hint: 'School blocks are skipped on days off. Out-of-town dates skip everything.' })}
      ${field('Days', dayPicker('days', b.days))}
      <div class="grid2">
        ${field('Starts', `<input class="inp" type="time" name="start" value="${b.start}">`)}
        ${field('Ends', `<input class="inp" type="time" name="end" value="${b.end}">`)}
      </div>
      <p class="muted small">Different hours on different days (like work shifts)? Add one block per shift.</p>
      <div class="btn-row">${btn('Save', 'busy-save', { cls: 'primary grow', type: 'submit', data: `data-id="${b.id}"` })}${isNew ? '' : btn('Delete', 'busy-del', { cls: 'danger', data: `data-id="${b.id}"` })}${btn('Cancel', 'modal-close')}</div>
    </form>`, { cls: 'dialog', close: 'modal-close', ico: 'calendar' }));
}

// ---- days off / early dismissal / trip editor ----
function openDate(d) {
  const isNew = !d;
  d = d || { id: 'd' + uid(), label: '', kind: 'off', from: dayKey(), to: dayKey(), end: '13:25' };
  openModal(() => win(isNew ? 'Add Dates' : 'Edit Dates', `
    <form id="dt" onsubmit="return false">
      ${field('What is it?', `<input class="inp" name="label" value="${esc(d.label)}" placeholder="e.g. Thanksgiving break">`)}
      ${field('Type', select('kind', [['off', 'No school'], ['early', 'Early dismissal'], ['away', 'Out of town']], d.kind))}
      <div class="grid2">
        ${field('From', `<input class="inp" type="date" name="from" value="${d.from}">`)}
        ${field('To', `<input class="inp" type="date" name="to" value="${d.to || d.from}">`)}
      </div>
      ${field('School lets out at (early dismissal only)', `<input class="inp" type="time" name="end" value="${d.end || '13:25'}">`)}
      <div class="btn-row">${btn('Save', 'date-save', { cls: 'primary grow', type: 'submit', data: `data-id="${d.id}"` })}${isNew ? '' : btn('Delete', 'date-del', { cls: 'danger', data: `data-id="${d.id}"` })}${btn('Cancel', 'modal-close')}</div>
    </form>`, { cls: 'dialog', close: 'modal-close', ico: 'calendar' }));
}

// ---- schedule file import (a file Claude makes, or pasted text) ----
function openImport() {
  openModal(() => win('Import Schedule', `
    <p>Load a schedule file with your school hours and days off.</p>
    <label class="btn wide">${icon('floppy', 16)}<span>Choose schedule file</span><input type="file" accept=".json,application/json,text/plain" hidden data-change="sched-file"></label>
    ${field('...or paste it here', '<textarea id="sched-paste" class="inp" rows="4" placeholder="{&quot;type&quot;: &quot;macros-schedule&quot;, ...}"></textarea>')}
    <p class="muted small">School hours in the file replace your school hours. Your work blocks and reminders aren't touched.</p>
    <div class="btn-row">${btn('Import pasted text', 'sched-paste-go', { cls: 'primary grow' })}${btn('Cancel', 'modal-close')}</div>
  `, { cls: 'dialog', close: 'modal-close', ico: 'floppy' }));
}
async function doImport(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { msgBox({ title: 'Import failed', text: 'That isn\'t a schedule file.' }); return; }
  try {
    const r = importSchedule(data);
    closeModal(); schedChanged();
    msgBox({ title: 'Schedule imported', ico: 'calendar', text: `<p>Loaded ${r.blocks} weekly block${r.blocks === 1 ? '' : 's'} and ${r.dates} date${r.dates === 1 ? '' : 's'}${r.reminders ? `, and updated ${r.reminders} reminder${r.reminders === 1 ? '' : 's'}` : ''}.</p><p class="muted small">Check "Next 7 days" to see where reminders land.</p>` });
  } catch (e) {
    msgBox({ title: 'Import failed', text: 'That isn\'t a schedule file.' });
  }
}

// ---- reminder editor ----
function openRem(r) {
  const isNew = !r;
  r = r || { id: 'r' + uid(), kind: 'custom', label: 'Reminder', msg: '', time: '17:00', days: [0, 1, 2, 3, 4, 5, 6], on: true, prefer: 'after' };
  openModal(() => win(isNew ? 'New Reminder' : 'Edit Reminder', `
    <form id="rem" onsubmit="return false">
      ${field('Title', `<input class="inp" name="label" value="${esc(r.label)}">`)}
      ${field('Message', `<input class="inp" name="msg" value="${esc(r.msg)}" placeholder="What should it say?">`)}
      ${field('Preferred time', `<input class="inp" type="time" name="time" value="${r.time}">`)}
      ${field('Days', dayPicker('days', r.days))}
      ${field('If it lands during school/work, move it', select('prefer', [['after', 'right after'], ['before', 'right before']], r.prefer))}
      <div class="btn-row">${btn('Save', 'rem-save', { cls: 'primary grow', type: 'submit', data: `data-id="${r.id}"` })}${isNew || !String(r.id).startsWith('r') ? '' : btn('Delete', 'rem-del', { cls: 'danger', data: `data-id="${r.id}"` })}${btn('Cancel', 'modal-close')}</div>
    </form>`, { cls: 'dialog', close: 'modal-close', ico: 'bell' }));
}

function schedChanged() {
  save();
  if (S.notify.method === 'ntfy') { S.notify.lastSync = 0; syncPush({ force: true }).catch(() => {}); }
  rerender();
}

on({
  'busy-add': () => openBusy(null),
  'busy-edit': (el) => openBusy(S.schedule.busy.find((b) => b.id === el.dataset.id)),
  'busy-save': (el) => {
    const v = formData(document.getElementById('busy'));
    if (!v.days.length) { toast('Pick at least one day', 'warn'); return; }
    if (toMin(v.end) <= toMin(v.start)) { toast('End time must be after start', 'warn'); return; }
    const b = { id: el.dataset.id, label: v.label.trim() || 'Busy', kind: v.kind || 'other', days: v.days.map(Number), start: v.start, end: v.end };
    const i = S.schedule.busy.findIndex((x) => x.id === b.id);
    if (i >= 0) S.schedule.busy[i] = b; else S.schedule.busy.push(b);
    closeModal(); schedChanged();
  },
  'busy-del': (el) => { S.schedule.busy = S.schedule.busy.filter((b) => b.id !== el.dataset.id); closeModal(); schedChanged(); },
  'date-add': () => openDate(null),
  'date-edit': (el) => openDate((S.schedule.dates || []).find((d) => d.id === el.dataset.id)),
  'date-save': (el) => {
    const v = formData(document.getElementById('dt'));
    if (!v.from) { toast('Pick a start date', 'warn'); return; }
    const to = v.to && v.to >= v.from ? v.to : v.from;
    const d = { id: el.dataset.id, label: v.label.trim() || DATE_KINDS[v.kind], kind: v.kind, from: v.from, to };
    if (v.kind === 'early') d.end = v.end || '13:25';
    S.schedule.dates = (S.schedule.dates || []).filter((x) => x.id !== d.id).concat(d).sort((x, y) => (x.from < y.from ? -1 : 1));
    closeModal(); schedChanged();
  },
  'date-del': (el) => { S.schedule.dates = (S.schedule.dates || []).filter((d) => d.id !== el.dataset.id); closeModal(); schedChanged(); },
  'sched-import': () => openImport(),
  'sched-file': async (el) => { const f = el.files && el.files[0]; if (f) doImport(await f.text()); },
  'sched-paste-go': () => { const t = document.getElementById('sched-paste'); if (t && t.value.trim()) doImport(t.value); else toast('Paste the schedule text first', 'warn'); },
  'sch-wake': (el) => { S.schedule.wake = el.value || '06:00'; schedChanged(); },
  'sch-sleep': (el) => { S.schedule.sleep = el.value || '22:30'; schedChanged(); },
  'rem-toggle': (el) => { const r = S.reminders.find((x) => x.id === el.dataset.id); if (r) r.on = el.checked; schedChanged(); },
  'rem-edit': (el) => openRem(S.reminders.find((x) => x.id === el.dataset.id)),
  'rem-add': () => openRem(null),
  'rem-save': (el) => {
    const v = formData(document.getElementById('rem'));
    if (!v.days.length) { toast('Pick at least one day', 'warn'); return; }
    const old = S.reminders.find((x) => x.id === el.dataset.id);
    const r = { ...(old || { kind: 'custom', on: true }), id: el.dataset.id, label: v.label.trim() || 'Reminder', msg: v.msg.trim(), time: v.time, days: v.days.map(Number), prefer: v.prefer };
    if (old) Object.assign(old, r); else S.reminders.push(r);
    closeModal(); schedChanged();
  },
  'rem-del': (el) => { S.reminders = S.reminders.filter((r) => r.id !== el.dataset.id); closeModal(); schedChanged(); },
  'rem-reset': async () => {
    if (!(await confirmBox('Restore the default reminders? Custom reminders are removed.'))) return;
    S.reminders = DEFAULT_REMINDERS(); schedChanged();
  },
  'ics-download': async () => {
    await saveFile('macros-reminders.ics', buildICS(), 'text/calendar');
    msgBox({ title: 'Calendar file', ico: 'calendar', text: `<p>${isIOS() ? 'Open the file and tap <b>Add All</b> to put the reminders in your Calendar. If it saved to Files, open it from the Files app.' : 'Open the downloaded file with your Calendar app and import it.'}</p>` });
  },
  'ntfy-setup': async () => {
    S.notify.topic = S.notify.topic || newTopic();
    S.notify.method = 'ntfy';
    S.notify.sent = {}; S.notify.lastSync = 0; save(true);
    try { await navigator.clipboard.writeText(S.notify.topic); } catch (e) { /* ignore */ }
    rerender();
    await msgBox({ title: 'Phone alerts', ico: 'bell', text: `<p>Your private topic (copied to clipboard):</p><p><code class="sel">${esc(S.notify.topic)}</code></p><p>In the <b>ntfy</b> app: tap <b>+</b>, paste it, tap <b>Subscribe</b>, and allow notifications. Then come back and tap <b>Send test</b>.</p>` });
    try { const r = await syncPush({ force: true }); toast(`Queued ${r.queued} reminders`, 'bell'); } catch (e) { toast('Could not reach ntfy - check your connection', 'warn'); }
    rerender();
  },
  'ntfy-test': async () => {
    try { await sendTest(); toast('Test sent - check your phone', 'bell'); } catch (e) { toast('Send failed - check your connection', 'warn'); }
  },
  'ntfy-sync': async () => {
    try { const r = await syncPush({ force: true }); toast(r.queued ? `Queued ${r.queued} new reminders` : 'Already up to date', 'bell'); } catch (e) { toast('Sync failed - check your connection', 'warn'); }
    rerender();
  },
  'ntfy-off': async () => {
    if (!(await confirmBox('Turn off phone alerts? (Already-queued alerts for the next day or two will still arrive.)'))) return;
    S.notify.method = 'none'; save(); rerender();
  },
});
