// Reminder scheduling around school / work, calendar export, and phone push via ntfy.
// Two layers: busy blocks repeat every week (school Mon-Fri 8:35-3:25, work shifts...), and
// dated exceptions change a specific day (no school, early dismissal, out of town).
import { S, save, peekDay } from './store.js';
import { toMin, fromMin, fmtTime, dayKey, parseDay, pad2, uid, isAndroid } from './util.js';

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const KIND_TAG = { weigh: 'alarm_clock', meal: 'fork_and_knife', check: 'palm_tree', gym: 'muscle', read: 'books', sleep: 'zzz', custom: 'bell' };

// The clock time a reminder is set for. Sleep reminders follow your bedtime or wake-up time (rel + off minutes).
export function remTime(r) {
  if (r.rel === 'bed' || r.rel === 'wake') {
    const base = toMin(r.rel === 'bed' ? S.schedule.sleep || '22:30' : S.schedule.wake || '06:00');
    return fromMin((((base + (Number(r.off) || 0)) % 1440) + 1440) % 1440);
  }
  return r.time;
}

export const DATE_KINDS = {
  off: 'No school',
  early: 'Early dismissal',
  away: 'Out of town',
};
// While away: no school or work, and the scale / gym / after-school fuel reminders pause. Meal logging keeps going.
const PAUSED_WHEN_AWAY = new Set(['weigh', 'gym']);
const pausedAway = (rem) => PAUSED_WHEN_AWAY.has(rem.kind) || rem.id === 'fuel';

export function blockKind(b) {
  if (b.kind) return b.kind;
  if (b.id === 'school' || /school|class/i.test(b.label || '')) return 'school';
  if (b.id === 'work' || /work|shift|job/i.test(b.label || '')) return 'work';
  return 'other';
}

// The dated exception that applies to a day, if any (out of town beats no school beats early dismissal)
export function dateRule(key) {
  const hits = (S.schedule.dates || []).filter((d) => key >= d.from && key <= (d.to || d.from));
  return hits.find((d) => d.kind === 'away') || hits.find((d) => d.kind === 'off') || hits.find((d) => d.kind === 'early') || null;
}

function blocksFor(dow, rule) {
  let blocks = S.schedule.busy.filter((b) => b.days.includes(dow) && b.start && b.end);
  if (rule && rule.kind === 'away') blocks = [];
  else if (rule && rule.kind === 'off') blocks = blocks.filter((b) => blockKind(b) !== 'school');
  else if (rule && rule.kind === 'early') {
    const isSchool = (b) => blockKind(b) === 'school';
    if (Array.isArray(rule.school) && rule.school.length && blocks.some(isSchool)) {
      // early-release bell schedule given in full (e.g. a shorter day with an earlier lunch)
      blocks = [...blocks.filter((b) => !isSchool(b)), ...rule.school.map((x) => ({ label: 'School', kind: 'school', days: [dow], start: x.start, end: x.end }))];
    } else if (rule.end) {
      blocks = blocks
        .filter((b) => !(isSchool(b) && toMin(b.start) >= toMin(rule.end)))
        .map((b) => (isSchool(b) && toMin(rule.end) < toMin(b.end) ? { ...b, end: rule.end } : b));
    }
  }
  return blocks;
}

// Merge busy blocks into sorted [start, end, label] minute ranges
function mergeRanges(blocks) {
  const ranges = blocks
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

// A normal week (no exceptions) - used for the calendar file
export function busyFor(dow) { return mergeRanges(blocksFor(dow, null)); }
// A specific date, with holidays / early dismissal / trips applied
export function busyOn(key) { return mergeRanges(blocksFor(parseDay(key).getDay(), dateRule(key))); }

function place(rem, dow, ranges, rule) {
  if (!rem.on || !rem.days.includes(dow)) return null;
  if (rule && rule.kind === 'away' && pausedAway(rem)) return null;
  const wake = toMin(S.schedule.wake || '06:00');
  const sleep = toMin(S.schedule.sleep || '22:30');
  let t = toMin(remTime(rem));
  let moved = '';
  if (t < wake) { t = wake + 5; moved = 'after wake-up'; }
  if (t > sleep) { t = sleep - 15; moved = 'before bed'; }
  // Re-check after each move in case blocks are back-to-back
  for (let guard = 0; guard < 6; guard++) {
    const block = ranges.find(([s, e]) => t >= s && t < e);
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

// Where a reminder lands in a normal week / on a specific date
export function placeReminder(rem, dow) { return place(rem, dow, busyFor(dow), null); }
export function placeOn(rem, key) { return place(rem, parseDay(key).getDay(), busyOn(key), dateRule(key)); }

// Reminders landing within 15 min of each other are sent as one notification
function mergePlan(items) {
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
function planWith(placer) {
  const items = [];
  for (const r of S.reminders) {
    const p = placer(r);
    if (p) items.push({ ids: [r.id], kinds: [r.kind], labels: [r.label], msgs: [r.msg], time: p.time, moved: p.moved });
  }
  return mergePlan(items);
}
export function dayPlan(dow) { return planWith((r) => placeReminder(r, dow)); }
export function planFor(key) { return planWith((r) => placeOn(r, key)); }

// ---------- Importing a schedule file ----------
// { type: 'macros-schedule', busy?: [...blocks], dates?: [...ranges], reminders?: [...changes], wake?, sleep? }
// School blocks in the file replace your school blocks; work/other blocks you made stay.
// Reminder entries update the matching reminder by id (time, days, label, message, on/off).
export function importSchedule(data) {
  if (!data || data.type !== 'macros-schedule') throw new Error('Not a schedule file');
  const okTime = (t) => /^\d{2}:\d{2}$/.test(t || '');
  const okDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
  const sch = S.schedule;
  let blocks = 0;
  let dates = 0;
  let reminders = 0;
  if (Array.isArray(data.busy) && data.busy.length) {
    const incoming = data.busy
      .filter((b) => okTime(b.start) && okTime(b.end) && Array.isArray(b.days))
      .map((b) => ({ id: b.id || 'b' + uid(), label: String(b.label || 'Busy'), kind: b.kind || blockKind(b), days: b.days.map(Number).filter((n) => n >= 0 && n <= 6), start: b.start, end: b.end }));
    const kinds = new Set(incoming.map((b) => b.kind));
    sch.busy = [...sch.busy.filter((b) => !kinds.has(blockKind(b)) && !incoming.some((n) => n.id === b.id)), ...incoming];
    blocks = incoming.length;
  }
  if (Array.isArray(data.dates)) {
    sch.dates = sch.dates || [];
    for (const d of data.dates) {
      if (!okDay(d.from) || !DATE_KINDS[d.kind]) continue;
      const item = { id: d.id || 'd' + uid(), label: String(d.label || DATE_KINDS[d.kind]), kind: d.kind, from: d.from, to: okDay(d.to) ? d.to : d.from };
      if (d.kind === 'early') {
        item.end = okTime(d.end) ? d.end : '13:25';
        const sch2 = Array.isArray(d.school) ? d.school.filter((x) => okTime(x.start) && okTime(x.end) && toMin(x.end) > toMin(x.start)) : [];
        if (sch2.length) item.school = sch2.map((x) => ({ start: x.start, end: x.end }));
      }
      const i = sch.dates.findIndex((x) => x.id === item.id);
      if (i >= 0) sch.dates[i] = item; else sch.dates.push(item);
      dates++;
    }
    sch.dates.sort((a, b) => (a.from < b.from ? -1 : 1));
  }
  if (Array.isArray(data.reminders)) {
    for (const c of data.reminders) {
      const r = S.reminders.find((x) => x.id === c.id);
      if (!r) continue;
      if (okTime(c.time)) r.time = c.time;
      if (Array.isArray(c.days) && c.days.length) r.days = c.days.map(Number).filter((n) => n >= 0 && n <= 6);
      if (typeof c.label === 'string' && c.label.trim()) r.label = c.label.trim();
      if (typeof c.msg === 'string' && c.msg.trim()) r.msg = c.msg.trim();
      if (typeof c.on === 'boolean') r.on = c.on;
      reminders++;
    }
  }
  if (okTime(data.wake)) sch.wake = data.wake;
  if (okTime(data.sleep)) sch.sleep = data.sleep;
  save(true);
  return { blocks, dates, reminders };
}

// ---------- In-app: what's due right now ----------
export function dueNow() {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const key = dayKey(now);
  const d = peekDay(key);
  const out = [];
  for (const r of S.reminders) {
    const p = placeOn(r, key);
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
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Macros//Reminders//EN', 'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH', 'X-WR-CALNAME:Macros Reminders',
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
        `UID:macros-${r.id}-${time.replace(':', '')}-${dows.join('')}@macros.app`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${icsDate(start, time)}`,
        'DURATION:PT5M',
        `RRULE:FREQ=WEEKLY;BYDAY=${dows.map((d) => BYDAY[d]).join(',')}`,
        `SUMMARY:${icsEsc('🌴 ' + r.label)}`,
        `DESCRIPTION:${icsEsc(r.msg + '\nOpen Macros from your home screen.')}`,
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
  return 'macros-' + uid() + Math.random().toString(36).slice(2, 8);
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
  await postNtfy('Macros test', 'Notifications are working. Go eat.', { tags: 'palm_tree' });
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
    for (const it of planFor(dayKey(day))) {
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
