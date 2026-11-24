// Reminder scheduling around school / work, calendar export, and phone push via ntfy.
import { S, save, peekDay } from './store.js';
import { toMin, fromMin, fmtTime, dayKey, pad2, uid, isAndroid } from './util.js';

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const KIND_TAG = { weigh: 'alarm_clock', meal: 'fork_and_knife', check: 'palm_tree', gym: 'muscle', custom: 'bell' };

// Merge busy blocks for a weekday into sorted [start, end] minute ranges
export function busyFor(dow) {
  const ranges = S.schedule.busy
    .filter((b) => b.days.includes(dow) && b.start && b.end)
    .map((b) => [toMin(b.start), toMin(b.end), b.label])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const r of ranges) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1]) { last[1] = Math.max(last[1], r[1]); last[2] += ' + ' + r[2]; } else out.push([...r]);
  }
  return out;
}

// Where a reminder actually lands on a given weekday (or null if it can't fit / is off)
export function placeReminder(rem, dow) {
  if (!rem.on || !rem.days.includes(dow)) return null;
  const wake = toMin(S.schedule.wake || '06:00');
  const sleep = toMin(S.schedule.sleep || '22:30');
  let t = toMin(rem.time);
  let moved = '';
  if (t < wake) { t = wake + 5; moved = 'after wake-up'; }
  if (t > sleep) { t = sleep - 15; moved = 'before bed'; }
  // Re-check after each move in case blocks are back-to-back
  for (let guard = 0; guard < 6; guard++) {
    const block = busyFor(dow).find(([s, e]) => t >= s && t < e);
    if (!block) break;
    const [s, e, label] = block;
    const after = e + 5;
    const before = s - 10;
    const canAfter = after <= sleep;
    const canBefore = before >= wake;
    if ((rem.prefer === 'before' && canBefore) || !canAfter) {
      if (!canBefore) return null;
      t = before; moved = `before ${label}`;
    } else {
      t = after; moved = `after ${label}`;
    }
  }
  return { time: fromMin(t), moved };
}

// All reminder occurrences for a weekday, merging ones that land within 15 min of each other
export function dayPlan(dow) {
  const items = [];
  for (const r of S.reminders) {
    const p = placeReminder(r, dow);
    if (p) items.push({ ids: [r.id], kinds: [r.kind], labels: [r.label], msgs: [r.msg], time: p.time, moved: p.moved });
  }
  items.sort((a, b) => toMin(a.time) - toMin(b.time));
  const merged = [];
  for (const it of items) {
    const last = merged[merged.length - 1];
    if (last && toMin(it.time) - toMin(last.time) <= 15) {
      last.ids.push(...it.ids); last.kinds.push(...it.kinds); last.labels.push(...it.labels); last.msgs.push(...it.msgs);
    } else merged.push(it);
  }
  return merged;
}

// ---------- In-app: what's due right now ----------
export function dueNow() {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const key = dayKey(now);
  const d = peekDay(key);
  const out = [];
  for (const r of S.reminders) {
    const p = placeReminder(r, now.getDay());
    if (!p || toMin(p.time) > mins) continue;
    if (r.kind === 'weigh' && S.weights[key] == null) out.push(r);
    if (r.id === 'bfast' && !d.food.some((e) => e.meal === 'Breakfast')) out.push(r);
    if (r.id === 'lunch' && !d.food.some((e) => e.meal === 'Lunch')) out.push(r);
    if (r.id === 'dinner' && !d.food.some((e) => e.meal === 'Dinner')) out.push(r);
  }
  return out;
}

// ---------- Calendar (.ics) ----------
function icsEsc(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}
function icsDate(d, hhmm) {
  const [h, m] = hhmm.split(':');
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}T${pad2(h)}${pad2(m)}00`;
}
// RFC 5545: lines longer than 75 octets get folded (CRLF + space)
function fold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = '';
  for (const ch of line) {
    if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ''; }
    cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}
export function buildICS() {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Trenches//Reminders//EN', 'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH', 'X-WR-CALNAME:Trenches Reminders',
  ];
  for (const r of S.reminders) {
    if (!r.on) continue;
    // group weekdays that share the same final time
    const byTime = {};
    for (let dow = 0; dow < 7; dow++) {
      const p = placeReminder(r, dow);
      if (p) (byTime[p.time] = byTime[p.time] || []).push(dow);
    }
    for (const [time, dows] of Object.entries(byTime)) {
      // first upcoming date that matches
      const start = new Date();
      start.setDate(start.getDate() + 1);
      while (!dows.includes(start.getDay())) start.setDate(start.getDate() + 1);
      lines.push(
        'BEGIN:VEVENT',
        `UID:trenches-${r.id}-${time.replace(':', '')}-${dows.join('')}@trenches.app`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${icsDate(start, time)}`,
        'DURATION:PT5M',
        `RRULE:FREQ=WEEKLY;BYDAY=${dows.map((d) => BYDAY[d]).join(',')}`,
        `SUMMARY:${icsEsc('🌴 ' + r.label)}`,
        `DESCRIPTION:${icsEsc(r.msg + '\nOpen Trenches from your home screen.')}`,
        'TRANSP:TRANSPARENT',
        'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(r.label)}`, 'TRIGGER:PT0M', 'END:VALARM',
        'END:VEVENT',
      );
    }
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

// ---------- Phone push via ntfy.sh ----------
// ntfy lets us schedule a push up to 3 days ahead with a plain HTTPS POST, no server of our own.
// Each time the app opens we top up the queue for the next `windowH` hours.
export function newTopic() {
  return 'trenches-' + uid() + Math.random().toString(36).slice(2, 8);
}

function ntfyUrl(params) {
  return `https://ntfy.sh/${encodeURIComponent(S.notify.topic)}?` + new URLSearchParams(params).toString();
}
function appUrl() {
  return location.origin + location.pathname.replace(/index\.html$/, '');
}

async function postNtfy(title, message, extra = {}) {
  const params = { title, ...extra };
  // Android can open the installed app from the link. On iPhone a link would open Safari
  // (separate storage from the home-screen app), so we leave it off there.
  if (isAndroid()) params.click = appUrl();
  const res = await fetch(ntfyUrl(params), { method: 'POST', body: message });
  if (!res.ok) throw new Error('ntfy ' + res.status);
  return res;
}

export async function sendTest() {
  if (!S.notify.topic) throw new Error('No topic');
  await postNtfy('Trenches test', 'Notifications are working. Go eat.', { tags: 'palm_tree' });
}

export async function syncPush({ force = false } = {}) {
  const N = S.notify;
  if (N.method !== 'ntfy' || !N.topic || !navigator.onLine) return { queued: 0 };
  const now = Date.now();
  if (!force && now - (N.lastSync || 0) < 10 * 60 * 1000) return { queued: 0 };
  const horizon = now + Math.min(70, N.windowH || 48) * 3600 * 1000;
  // forget entries already in the past
  for (const k of Object.keys(N.sent)) if (Number(k.split('|')[0]) < now) delete N.sent[k];

  let queued = 0;
  let latest = N.until || 0;
  const start = new Date(); start.setHours(0, 0, 0, 0);
  for (let i = 0; i < 4; i++) {
    const day = new Date(start); day.setDate(start.getDate() + i);
    for (const it of dayPlan(day.getDay())) {
      const at = new Date(day); const m = toMin(it.time);
      at.setHours(Math.floor(m / 60), m % 60, 0, 0);
      const ts = at.getTime();
      if (ts < now + 60000 || ts > horizon) continue;
      const key = `${ts}|${it.ids.join('+')}`;
      if (N.sent[key]) continue;
      const title = it.labels.join(' + ');
      const msg = it.msgs.join('\n');
      try {
        await postNtfy(title, msg, { at: String(Math.floor(ts / 1000)), tags: KIND_TAG[it.kinds[0]] || 'palm_tree' });
        N.sent[key] = 1; queued++;
        latest = Math.max(latest, ts);
      } catch (e) {
        console.warn('ntfy failed', e);
        save();
        throw e;
      }
      if (queued >= 40) break;
    }
  }
  N.lastSync = now;
  N.until = latest;
  save();
  return { queued, until: latest };
}

export function untilText() {
  const u = S.notify.until;
  if (!u || u < Date.now()) return 'nothing queued yet';
  const d = new Date(u);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `queued through ${days[d.getDay()]} ${fmtTime(`${d.getHours()}:${d.getMinutes()}`)}`;
}
