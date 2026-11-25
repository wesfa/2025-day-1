// Sleep: one tap at night ("Going to bed"), one in the morning ("I'm up"), or type the times in.
// Each night is saved under the morning you woke up: S.sleep.log['2026-11-25'] = { bed: '22:40', wake: '06:05', q: 4 }.
// Shows last night, the 7-day average, sleep debt against your goal, how steady your bedtime is, and the bedtime
// that gets you your goal before your alarm. The reminders (log your sleep, wind down, bedtime) live with the others.
import { S, save } from './store.js';
import { dayKey, addDays, prettyDay, esc, toMin, fromMin, fmtTime, pad2, buzz, HAPTIC, parseDay, DOW1 } from './util.js';
import { win, group, btn, field, select, on, rerender, toast, confirmBox, openModal, closeModal, formData } from './ui.js';
import { icon } from './icons.js';
import { syncPush, remTime, placeReminder } from './reminders.js';

export const QUALITY = ['', 'Awful', 'Rough', 'OK', 'Good', 'Great'];
const HOUR = 3600000;
const FALL_ASLEEP = 15;  // minutes it usually takes to fall asleep
const SLEEP_REMS = ['sleeplog', 'winddown', 'bedtime'];

const hhmm = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const goalH = () => Number(S.sleep.goal) || 9;

// Minutes asleep for a logged night (bed after midnight works too)
export function nightMins(n) {
  if (!n || !n.bed || !n.wake) return 0;
  let m = toMin(n.wake) - toMin(n.bed);
  if (m <= 0) m += 1440;
  return m;
}
export function hm(mins) {
  const r = Math.max(0, Math.round(mins));
  return `${Math.floor(r / 60)}h ${pad2(r % 60)}m`;
}

// The night that ended this morning (or on `key`)
export const nightOf = (key = dayKey()) => S.sleep.log[key] || null;

// Short last night? Used to go a little lighter in the gym.
export function shortNight() {
  const n = nightOf();
  const m = n ? nightMins(n) : 0;
  return m && m < 6.5 * 60 ? m : 0;
}

export function sleepStats(days = 7, end = dayKey()) {
  const goal = goalH() * 60;
  const nights = [];
  for (let i = days - 1; i >= 0; i--) {
    const k = addDays(end, -i);
    const n = S.sleep.log[k];
    if (n && n.bed && n.wake) nights.push({ k, ...n, mins: nightMins(n) });
  }
  const avg = nights.length ? nights.reduce((a, n) => a + n.mins, 0) / nights.length : null;
  const debt = nights.reduce((a, n) => a + Math.max(0, goal - n.mins), 0);
  // How steady your bedtime is: average distance from your usual bedtime. Bedtimes before noon count as after midnight.
  const bedM = nights.map((n) => { const m = toMin(n.bed); return m < 12 * 60 ? m + 1440 : m; });
  const mean = bedM.length ? bedM.reduce((a, b) => a + b, 0) / bedM.length : 0;
  const spread = bedM.length >= 3 ? bedM.reduce((a, b) => a + Math.abs(b - mean), 0) / bedM.length : null;
  return { goal, nights, avg, debt, spread, usualBed: bedM.length ? fromMin(Math.round(mean) % 1440) : null };
}

// Lights out to get your goal before your wake-up time (with time to fall asleep)
export function idealBedtime(hours = goalH()) {
  const m = toMin(S.schedule.wake || '06:00') - hours * 60 - FALL_ASLEEP;
  return fromMin(((m % 1440) + 1440) % 1440);
}
function bedToWake() {
  let m = toMin(S.schedule.wake || '06:00') - toMin(S.schedule.sleep || '22:30');
  if (m <= 0) m += 1440;
  return m;
}

function logNight(key, bed, wake, q) {
  S.sleep.log[key] = { bed, wake, ...(q ? { q } : {}) };
  save(true);
}

// ================= Today card =================
// Night: "Going to bed". Morning: "I'm up" (after going to bed) or a quick form. After logging: last night + how it was.
export function sleepCard({ compact = false } = {}) {
  const now = new Date();
  const h = now.getHours();
  const nowM = h * 60 + now.getMinutes();
  const k = dayKey();
  const night = nightOf(k);
  const bedAt = S.sleep.bedAt && Date.now() - S.sleep.bedAt < 16 * HOUR ? S.sleep.bedAt : 0;
  const morning = h >= 3 && h < 17;
  const evening = nowM >= toMin(S.schedule.sleep || '22:30') - 150 || h < 3;
  const link = compact ? '' : `<button class="link small" data-act="nav" data-to="#/sleep">Sleep history</button>`;

  if (bedAt && !night && morning) {
    return `<div class="sleep-card">
      <p>${icon('moon', 16)} In bed at <b>${fmtTime(hhmm(new Date(bedAt)))}</b>. Morning!</p>
      <div class="btn-row">${btn('I\'m up', 'sl-up', { cls: 'primary grow', ico: 'sun' })}${btn('Fix times', 'sl-add')}</div>
    </div>`;
  }
  if (bedAt && !morning) {
    return `<div class="sleep-card">
      <p>${icon('moon', 16)} In bed since <b>${fmtTime(hhmm(new Date(bedAt)))}</b>. Good night - phone down.</p>
      <div class="btn-row">${btn('Not yet', 'sl-unbed')}</div>
    </div>`;
  }
  if (!night && morning) {
    return `<div class="sleep-card">
      <p><b>How did you sleep?</b></p>
      <div class="sl-form">
        ${field('Bed', `<input id="sl-bed" class="inp" type="time" value="${esc(S.schedule.sleep || '22:30')}">`)}
        ${field('Up', `<input id="sl-wake" class="inp" type="time" value="${esc(S.schedule.wake || '06:00')}">`)}
      </div>
      ${qualityChips(0, 'sl-pick')}
      <div class="btn-row">${btn('Save', 'sl-save', { cls: 'primary grow' })}${link}</div>
    </div>`;
  }
  let out = '';
  if (night && !compact) {
    const m = nightMins(night);
    const short = goalH() * 60 - m;
    out += `<p class="sl-last">${icon('moon', 16)} Last night <b class="vt">${hm(m)}</b>${night.q ? ` · ${QUALITY[night.q]}` : ''}
      <span class="muted small">${short > 20 ? `· ${hm(short)} under your ${goalH()}h goal` : '· goal hit'}</span></p>`;
  }
  if (night && !night.q) out += `<p class="muted small">How did last night feel?</p>${qualityChips(0, 'sl-q')}`;
  if (evening && !bedAt) {
    out += `<div class="btn-row">${btn('Going to bed', 'sl-bed', { cls: 'primary grow', ico: 'moon' })}</div>
      <p class="muted small">For ${goalH()}h before your ${fmtTime(S.schedule.wake || '06:00')} wake-up, lights out by ${fmtTime(idealBedtime())}.</p>`;
  }
  if (!out) return '';
  return `<div class="sleep-card">${out}${link ? `<div class="btn-row">${link}</div>` : ''}</div>`;
}

function qualityChips(cur, act) {
  return `<div class="chips sl-q">${[1, 2, 3, 4, 5].map((q) => `<button class="btn chip ${cur === q ? 'on' : ''}" data-act="${act}" data-v="${q}">${QUALITY[q]}</button>`).join('')}</div>`;
}

// ================= Sleep screen =================
export function renderSleep() {
  const st = sleepStats(7);
  const last = nightOf();
  const ideal = idealBedtime();
  const inBed = bedToWake();
  const want = goalH() * 60 + FALL_ASLEEP;
  const rows = Object.keys(S.sleep.log).sort().reverse().slice(0, 21).map((k) => {
    const n = S.sleep.log[k];
    return `<div class="row static">
      <button class="row-main link-row" data-act="sl-edit" data-k="${k}"><span class="row-name">${esc(prettyDay(k))}</span>
        <span class="row-sub">${fmtTime(n.bed)} - ${fmtTime(n.wake)}${n.q ? ` · ${QUALITY[n.q]}` : ''}</span></button>
      <span class="row-num">${hm(nightMins(n))}</span>
      <button class="btn sq" data-act="sl-del" data-k="${k}" aria-label="Delete">${icon('close', 8)}</button>
    </div>`;
  }).join('');
  const remRows = SLEEP_REMS.map((id) => S.reminders.find((r) => r.id === id)).filter(Boolean).map((r) => {
    const p = placeReminder(r, new Date().getDay());
    return `<label class="row static check check-row">
      <input type="checkbox" data-change="rem-toggle" data-id="${r.id}" ${r.on ? 'checked' : ''}>
      <span class="row-main"><span class="row-name">${esc(r.label)}</span><span class="row-sub">${fmtTime(p ? p.time : remTime(r))}${p && p.moved ? ` (${esc(p.moved)})` : ''}</span></span>
    </label>`;
  }).join('');
  const N = S.notify;
  const pushOn = N.method === 'ntfy' && N.topic;
  const bedOK = Math.abs(toMin(S.schedule.sleep) - toMin(ideal)) <= 10 || inBed >= want - 10;

  return win('Sleep', `
    ${sleepCard({ compact: true })}
    <div class="stat-grid">
      <div class="stat sunken"><span>Last night</span><b class="vt">${last ? hm(nightMins(last)) : '-'}</b></div>
      <div class="stat sunken"><span>7-day avg</span><b class="vt">${st.avg != null ? hm(st.avg) : '-'}</b></div>
      <div class="stat sunken"><span>Sleep debt (7d)</span><b class="vt ${st.debt > 300 ? 'bad' : ''}">${st.nights.length ? hm(st.debt) : '-'}</b></div>
      <div class="stat sunken"><span>Bedtime steady</span><b class="vt">${st.spread != null ? `±${Math.round(st.spread)}m` : '-'}</b></div>
    </div>
    ${group('Last 14 nights', `${chart()}<p class="muted small">Line = your ${goalH()}h goal.${st.usualBed ? ` Usual bedtime ${fmtTime(st.usualBed)}.` : ''}</p>`)}
    ${group('Your bedtime', `
      ${field('Sleep goal', select('goal', [[8, '8 hours'], [8.5, '8.5 hours'], [9, '9 hours - teen athletes'], [9.5, '9.5 hours'], [10, '10 hours']], goalH(), { data: 'data-change="sl-goal"' }))}
      <p>You wake at <b>${fmtTime(S.schedule.wake)}</b> and go to bed at <b>${fmtTime(S.schedule.sleep)}</b>: ${hm(inBed)} in bed.</p>
      ${bedOK ? `<p class="ok-line">${icon('check', 16)} That fits your ${goalH()}h goal.</p>`
        : `<p>For ${goalH()}h of sleep, be in bed by <b>${fmtTime(ideal)}</b> (about ${FALL_ASLEEP} min to fall asleep).</p>
           <div class="btn-row">${btn(`Use ${fmtTime(ideal)} bedtime`, 'sl-use-bed', { cls: 'primary' })}</div>`}
      <p class="muted small">Bedtime and wake-up also set when reminders can go off (change them in Reminders).</p>`)}
    ${group('Reminders', `${remRows}
      <p class="muted small">${pushOn ? `${icon('check', 12)} Phone alerts are on.` : 'Turn on phone alerts in Reminders to get these as notifications.'}</p>
      <div class="btn-row">${btn('Reminders', 'nav', { ico: 'bell', data: 'data-to="#/reminders"' })}</div>`)}
    ${group('History', `${rows || '<p class="empty">No nights logged yet.</p>'}<div class="btn-row">${btn('+ Log a night', 'sl-add')}</div>`)}
    ${group('Why it matters', `<ul class="tips">
      <li>Growth hormone peaks in deep sleep: that's when muscle gets built.</li>
      <li>Teens need 8-10 hours. Under 7 slows strength gains and raises injury risk.</li>
      <li>Same wake-up time every day (weekends too) makes falling asleep easier.</li>
      <li>No caffeine within 6 hours of bed. Cool, dark room. Phone away from the bed.</li>
    </ul>`)}
  `, { ico: 'moon' });
}

// Bars for the last 14 nights against the goal line
function chart() {
  const W = 300; const Hh = 120; const top = 8; const base = 100; const max = 12 * 60;
  const y = (m) => base - (Math.min(m, max) / max) * (base - top);
  const n = 14; const bw = W / n;
  const goal = goalH() * 60;
  let bars = '';
  for (let i = 0; i < n; i++) {
    const k = addDays(dayKey(), -(n - 1 - i));
    const night = S.sleep.log[k];
    const m = night ? nightMins(night) : 0;
    const x = i * bw + bw * 0.18;
    if (m) bars += `<rect class="sl-bar ${m >= goal - 20 ? 'ok' : m < goal - 120 ? 'low' : ''}" x="${x.toFixed(1)}" y="${y(m).toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${(base - y(m)).toFixed(1)}"/>`;
    else bars += `<rect class="sl-none" x="${x.toFixed(1)}" y="${base - 2}" width="${(bw * 0.64).toFixed(1)}" height="2"/>`;
    bars += `<text class="sl-day" x="${(i * bw + bw / 2).toFixed(1)}" y="${base + 13}" text-anchor="middle">${DOW1[parseDay(k).getDay()]}</text>`;
  }
  const gy = y(goal).toFixed(1);
  const grid = [6, 9, 12].map((hh) => `<line class="sl-grid" x1="0" x2="${W}" y1="${y(hh * 60).toFixed(1)}" y2="${y(hh * 60).toFixed(1)}"/><text class="sl-ax" x="2" y="${(y(hh * 60) - 2).toFixed(1)}">${hh}h</text>`).join('');
  return `<svg class="sl-chart" viewBox="0 0 ${W} ${Hh}" width="100%" role="img" aria-label="Hours slept, last 14 nights">${grid}${bars}<line class="sl-goal" x1="0" x2="${W}" y1="${gy}" y2="${gy}"/></svg>`;
}

// ================= Log / edit a night =================
function openNight(key) {
  const n = S.sleep.log[key] || {};
  const k = key || dayKey();
  openModal(() => win(key ? 'Edit Night' : 'Log a Night', `
    <form id="sl-f" onsubmit="return false">
      ${field('Morning you woke up', `<input class="inp" type="date" name="day" value="${k}" max="${dayKey()}">`)}
      <div class="grid2">
        ${field('Went to bed', `<input class="inp" type="time" name="bed" value="${esc(n.bed || S.schedule.sleep || '22:30')}">`)}
        ${field('Woke up', `<input class="inp" type="time" name="wake" value="${esc(n.wake || S.schedule.wake || '06:00')}">`)}
      </div>
      ${field('How was it?', select('q', [[0, '-'], ...[1, 2, 3, 4, 5].map((q) => [q, QUALITY[q]])], n.q || 0))}
      <div class="btn-row">${btn('Save', 'sl-f-save', { cls: 'primary grow', type: 'submit', data: `data-old="${key || ''}"` })}${btn('Cancel', 'modal-close')}</div>
    </form>`, { cls: 'dialog', close: 'modal-close', ico: 'moon' }));
}

function resync() {
  if (S.notify.method === 'ntfy') { S.notify.lastSync = 0; syncPush({ force: true }).catch(() => {}); }
}

on({
  'sl-bed': () => {
    S.sleep.bedAt = Date.now(); save(true); buzz(HAPTIC.press);
    const m = toMin(S.schedule.wake || '06:00') - (new Date().getHours() * 60 + new Date().getMinutes());
    const left = m <= 0 ? m + 1440 : m;
    toast(`Good night. ${hm(Math.max(0, left - FALL_ASLEEP))} of sleep before your alarm`, 'check');
    rerender();
  },
  'sl-unbed': () => { S.sleep.bedAt = 0; save(); rerender(); },
  'sl-up': () => {
    const bed = hhmm(new Date(S.sleep.bedAt));
    logNight(dayKey(), bed, hhmm(new Date()));
    S.sleep.bedAt = 0; save(true); buzz(HAPTIC.success);
    toast(`Slept ${hm(nightMins(nightOf()))}`, 'check');
    rerender();
  },
  // morning form: pick quality (no re-render, so typed times stay), then save
  'sl-pick': (el) => {
    el.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === el));
  },
  'sl-save': (el) => {
    const card = el.closest('.sleep-card');
    const bed = card.querySelector('#sl-bed').value;
    const wake = card.querySelector('#sl-wake').value;
    if (!bed || !wake) { toast('Enter both times', 'warn'); return; }
    const on = card.querySelector('.sl-q .chip.on');
    logNight(dayKey(), bed, wake, on ? Number(on.dataset.v) : 0);
    S.sleep.bedAt = 0; save(true); buzz(HAPTIC.success);
    toast(`Slept ${hm(nightMins(nightOf()))}`, 'check');
    rerender();
  },
  'sl-q': (el) => {
    const n = nightOf(); if (!n) return;
    n.q = Number(el.dataset.v); save(); rerender();
  },
  'sl-goal': (el) => { S.sleep.goal = Number(el.value) || 9; save(); rerender(); },
  'sl-use-bed': () => {
    S.schedule.sleep = idealBedtime(); save(true); resync();
    toast(`Bedtime set to ${fmtTime(S.schedule.sleep)}`, 'check'); rerender();
  },
  'sl-add': () => openNight(null),
  'sl-edit': (el) => openNight(el.dataset.k),
  'sl-f-save': (el) => {
    const v = formData(document.getElementById('sl-f'));
    if (!v.day || !v.bed || !v.wake) { toast('Fill in the day and both times', 'warn'); return; }
    if (v.day > dayKey()) { toast('That morning hasn\'t happened yet', 'warn'); return; }
    if (el.dataset.old && el.dataset.old !== v.day) delete S.sleep.log[el.dataset.old];
    logNight(v.day, v.bed, v.wake, Number(v.q) || 0);
    if (v.day === dayKey()) S.sleep.bedAt = 0;
    save(true); closeModal(); rerender();
  },
  'sl-del': async (el) => {
    if (!(await confirmBox(`Delete the night ending ${esc(prettyDay(el.dataset.k))}?`))) return;
    delete S.sleep.log[el.dataset.k]; save(); rerender();
  },
});
