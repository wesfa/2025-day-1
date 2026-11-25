// App state: one JSON blob in localStorage, mirrored to IndexedDB (see vault.js). Everything stays on the phone.
import { dayKey, addDays, uid, parseDay } from './util.js';
import { mirror } from './vault.js';
import { DEFAULT_TEMPLATES, EX_BY_ID } from './program.js';
import { FOOD_BY_ID } from './foods.js';
import { calcTargets, microTargets, SODIUM_TRAINING_EXTRA } from './calc.js';

// The app was renamed from Trenches to Macros; the storage key stays so existing data carries over.
const KEY = 'trenches:v1';
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

const LIFT_DAYS = [1, 2, 4, 5];
const REM_TEXT = {
  fuel: 'Snack time: carbs + protein (sandwich, shake, fruit). Lifting today? This is your fuel. Log it.',
  gym: 'Gym right after school, or plan for 6-7 PM. Open today\'s workout.',
  dinner: 'Log dinner (and anything after the gym). Check your protein.',
};

export const DEFAULT_REMINDERS = () => [
  { id: 'weigh', kind: 'weigh', label: 'Weigh-in', msg: 'Step on the scale (after the bathroom, before eating) and log it.', time: '06:30', days: [...ALL_DAYS], on: true, prefer: 'before' },
  { id: 'bfast', kind: 'meal', label: 'Log breakfast', msg: 'Big breakfast = big day. Log it in Macros.', time: '07:00', days: [...ALL_DAYS], on: true, prefer: 'before' },
  { id: 'lunch', kind: 'meal', label: 'Log lunch', msg: 'Log what you ate for lunch.', time: '12:30', days: [...ALL_DAYS], on: true, prefer: 'after' },
  { id: 'fuel', kind: 'meal', label: 'After-school fuel', msg: REM_TEXT.fuel, time: '15:15', days: [1, 2, 3, 4, 5], on: true, prefer: 'after' },
  // Lands with after-school fuel (one notification); its days follow the lift days in Control Panel
  { id: 'gym', kind: 'gym', label: 'Lift day', msg: REM_TEXT.gym, time: '15:15', days: [...LIFT_DAYS], on: true, prefer: 'after' },
  { id: 'dinner', kind: 'meal', label: 'Log dinner', msg: REM_TEXT.dinner, time: '20:00', days: [...ALL_DAYS], on: true, prefer: 'after' },
  { id: 'night', kind: 'check', label: 'Night check-in', msg: 'How close are you to your macros? Finish protein before bed.', time: '21:00', days: [...ALL_DAYS], on: true, prefer: 'before' },
  { id: 'read', kind: 'read', label: 'Reading time', msg: 'Grab your book - 20-30 minutes of reading before bed. Phone down.', time: '21:45', days: [...ALL_DAYS], on: true, prefer: 'before' },
];

function defaults() {
  return {
    v: 1,
    setupDone: false,
    created: Date.now(),
    profile: {
      name: '', position: 'DE/DT', sex: 'm', age: 17, heightIn: 74,
      startWeight: 230, goalWeight: 245, rate: 0.5, phase: 'off', startDate: dayKey(),
    },
    targets: { auto: true, cal: 3600, p: 230, c: 430, f: 100 },
    days: {},
    customFoods: [],
    foodCache: {},
    favs: [],
    recent: [],
    savedMeals: [],
    weights: {},
    templates: JSON.parse(JSON.stringify(DEFAULT_TEMPLATES)),
    customEx: [],
    workouts: [],
    activeId: null,
    schedule: {
      wake: '06:00', sleep: '22:30',
      busy: [
        { id: 'school', label: 'School', kind: 'school', days: [1, 2, 3, 4, 5], start: '07:45', end: '15:00' },
      ],
      dates: [], // dated exceptions: { id, label, kind: 'off' | 'early' | 'away', from, to, end? }
    },
    reminders: DEFAULT_REMINDERS(),
    notify: { method: 'none', topic: '', windowH: 48, sent: {}, lastSync: 0, until: 0 },
    settings: { theme: 'dusk', themeV: 4, readAdded: true, remV: 2, dayTargets: true, liftDays: [...LIFT_DAYS], sound: true, lastBackup: 0, restAuto: true, haptics: true, sky: { weather: true }, loc: null },
  };
}

// The saved data exactly as it was when the app opened (before any upgrade steps); used for restore points.
export let rawAtLoad = null;
export let S = load();

function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) { /* storage blocked */ }
  rawAtLoad = raw;
  if (raw) {
    try {
      return migrate(JSON.parse(raw));
    } catch (e) {
      // Never let a read problem turn into data loss: park the raw data under another key
      // (it is also still in the IndexedDB mirror) and start the app without overwriting it.
      console.warn('load failed', e);
      try { localStorage.setItem(`${KEY}:unreadable:${Date.now()}`, raw); } catch (e2) { /* ignore */ }
      rawAtLoad = null;
    }
  }
  return defaults();
}

// Run saved data from any older version through the same upgrade steps (for backups / restore points)
export function normalize(data) {
  return migrate(typeof data === 'string' ? JSON.parse(data) : JSON.parse(JSON.stringify(data)));
}

function migrate(s) {
  const d = defaults();
  // v1.2: Island became the default scheme. Move anyone still on the old default over once;
  // a scheme picked on purpose (anything else) is left alone.
  if (s.settings && !s.settings.themeV) {
    if (!s.settings.theme || s.settings.theme === 'classic') s.settings.theme = 'island';
    s.settings.themeV = 2;
  }
  // v1.5: Meadow became the default. Anyone still on the previous default (Island) moves over once.
  if (s.settings && s.settings.themeV < 3) {
    if (!s.settings.theme || s.settings.theme === 'island') s.settings.theme = 'meadow';
    s.settings.themeV = 3;
  }
  // v1.9: Dusk City became the default. Anyone still on the previous default (Meadow) moves over once.
  if (s.settings && s.settings.themeV < 4) {
    if (!s.settings.theme || s.settings.theme === 'meadow') s.settings.theme = 'dusk';
    s.settings.themeV = 4;
  }
  // v1.3.1: add the nightly reading reminder once (if it's later deleted, it stays deleted)
  if (s.settings && Array.isArray(s.reminders) && !s.settings.readAdded) {
    if (!s.reminders.some((r) => r.id === 'read')) {
      const read = d.reminders.find((r) => r.id === 'read');
      const night = s.reminders.findIndex((r) => r.id === 'night');
      s.reminders.splice(night >= 0 ? night + 1 : s.reminders.length, 0, read);
    }
    s.settings.readAdded = true;
  }
  // v1.8: no practice - gym is right after school or 6-7 PM. Update reminders still on their old defaults
  // (anything already changed by hand is left alone).
  if (s.settings && Array.isArray(s.reminders) && !(s.settings.remV >= 2)) {
    const rem = (id) => s.reminders.find((r) => r.id === id);
    const fuel = rem('fuel');
    if (fuel && fuel.label === 'Pre-practice fuel') {
      fuel.label = 'After-school fuel';
      if (fuel.msg === 'Eat carbs + protein before practice/lift and log it.') fuel.msg = REM_TEXT.fuel;
    }
    const gym = rem('gym');
    if (gym && !gym.on && gym.time === '16:00' && gym.label === 'Gym time') {
      Object.assign(gym, { on: true, time: '15:15', label: 'Lift day', msg: REM_TEXT.gym, days: [...(s.settings.liftDays || LIFT_DAYS)] });
      // list it right under after-school fuel, since they go off together
      const at = s.reminders.indexOf(fuel);
      if (at >= 0) { s.reminders.splice(s.reminders.indexOf(gym), 1); s.reminders.splice(s.reminders.indexOf(fuel) + 1, 0, gym); }
    }
    const dinner = rem('dinner');
    if (dinner && dinner.time === '19:00') {
      dinner.time = '20:00';
      if (dinner.msg === 'Log dinner and check your protein.') dinner.msg = REM_TEXT.dinner;
    }
    s.settings.remV = 2;
  }
  // Fill in any keys added in newer versions without touching user data
  for (const k of Object.keys(d)) if (s[k] === undefined) s[k] = d[k];
  for (const k of Object.keys(d.profile)) if (s.profile[k] === undefined) s.profile[k] = d.profile[k];
  for (const k of Object.keys(d.settings)) if (s.settings[k] === undefined) s.settings[k] = d.settings[k];
  for (const k of Object.keys(d.notify)) if (s.notify[k] === undefined) s.notify[k] = d.notify[k];
  if (!s.schedule) s.schedule = d.schedule;
  if (!Array.isArray(s.schedule.dates)) s.schedule.dates = [];
  // v1.3: renamed to Macros - update the app name inside saved reminder text
  for (const r of s.reminders || []) if (typeof r.msg === 'string') r.msg = r.msg.replace(/\bTrenches\b/g, 'Macros');
  return s;
}

let saveTimer = null;
// The mirror is switched on after startup has checked it for anything newer (see app.js)
let mirrorOn = false;
export function enableMirror() { mirrorOn = true; }
export function save(now = false) {
  clearTimeout(saveTimer);
  const doSave = () => {
    S.savedAt = Date.now();
    const json = JSON.stringify(S);
    try {
      localStorage.setItem(KEY, json);
    } catch (e) {
      console.error('save failed', e);
      alert('Could not save - storage may be full. Export a backup from Settings.');
    }
    if (mirrorOn) mirror(json);
  };
  if (now) doSave(); else saveTimer = setTimeout(doSave, 150);
}
window.addEventListener('pagehide', () => save(true));
document.addEventListener('visibilitychange', () => { if (document.hidden) save(true); });

export function replaceState(next) {
  S = migrate(next);
  save(true);
}
export function resetState() {
  S = defaults();
  save(true);
}

// Add anything from `from` (a backup or restore point) that's missing here. Never removes or
// overwrites what's already on the phone - except on a fresh, not-yet-set-up phone, where the
// profile and settings come across too.
export function mergeInto(into, from) {
  const n = { food: 0, weights: 0, workouts: 0, other: 0 };
  if (!from || typeof from !== 'object') return n;
  const copy = (x) => JSON.parse(JSON.stringify(x));
  if (!into.setupDone && from.setupDone) {
    for (const k of ['profile', 'targets', 'schedule', 'reminders', 'notify', 'settings', 'templates']) if (from[k]) into[k] = copy(from[k]);
    into.setupDone = true;
    n.other++;
  }
  for (const [k, d] of Object.entries(from.days || {})) {
    const cur = into.days[k] || (into.days[k] = { food: [] });
    const have = new Set(cur.food.map((e) => e.id));
    for (const e of d.food || []) if (!have.has(e.id)) { cur.food.push(copy(e)); n.food++; }
  }
  for (const [k, v] of Object.entries(from.weights || {})) if (into.weights[k] == null) { into.weights[k] = v; n.weights++; }
  const addById = (name, counter = 'other', keep = () => true) => {
    into[name] = into[name] || [];
    const have = new Set(into[name].map((x) => x.id));
    for (const x of from[name] || []) if (keep(x) && !have.has(x.id)) { into[name].push(copy(x)); n[counter]++; }
  };
  addById('workouts', 'workouts', (w) => !!w.end);
  addById('customFoods'); addById('savedMeals'); addById('customEx'); addById('templates');
  if (from.schedule && into.schedule) {
    into.schedule.dates = into.schedule.dates || [];
    const have = new Set(into.schedule.dates.map((d) => d.id));
    for (const d of from.schedule.dates || []) if (!have.has(d.id)) { into.schedule.dates.push(copy(d)); n.other++; }
  }
  for (const [k, v] of Object.entries(from.foodCache || {})) if (!into.foodCache[k]) into.foodCache[k] = v;
  into.favs = [...new Set([...(into.favs || []), ...(from.favs || [])])];
  into.recent = [...new Set([...(into.recent || []), ...(from.recent || [])])].slice(0, 60);
  return n;
}

export function summarize(s) {
  const days = Object.entries((s && s.days) || {}).filter(([, d]) => (d.food || []).length);
  return {
    food: days.reduce((a, [, d]) => a + d.food.length, 0),
    lastFoodDay: days.map(([k]) => k).sort().pop() || null,
    weights: Object.keys((s && s.weights) || {}).length,
    workouts: ((s && s.workouts) || []).filter((w) => w.end).length,
  };
}

// ---------- Food ----------
export function day(key = dayKey()) {
  if (!S.days[key]) S.days[key] = { food: [] };
  return S.days[key];
}
export function peekDay(key) {
  return S.days[key] || { food: [] };
}
export const hasMicros = (o) => o && [o.fib, o.na, o.pot].every((v) => typeof v === 'number' && Number.isFinite(v));
export function totals(key = dayKey()) {
  const t = { cal: 0, p: 0, c: 0, f: 0, fib: 0, na: 0, pot: 0, unknown: 0 };
  for (const e of peekDay(key).food) {
    t.cal += e.cal * e.qty; t.p += e.p * e.qty; t.c += e.c * e.qty; t.f += e.f * e.qty;
    // older entries, quick adds and custom foods may not have fiber/sodium/potassium
    let missing = false;
    for (const m of ['fib', 'na', 'pot']) {
      const v = e[m];
      if (typeof v === 'number' && Number.isFinite(v)) t[m] += v * e.qty; else missing = true;
    }
    if (missing) t.unknown++;
  }
  return t;
}
export function mealTotals(key, meal) {
  const t = { cal: 0, p: 0, c: 0, f: 0 };
  for (const e of peekDay(key).food) {
    if (e.meal !== meal) continue;
    t.cal += e.cal * e.qty; t.p += e.p * e.qty; t.c += e.c * e.qty; t.f += e.f * e.qty;
  }
  return t;
}

export function getFood(fid) {
  return FOOD_BY_ID[fid] || S.customFoods.find((f) => f.id === fid) || S.foodCache[fid] || null;
}

export function addEntry(key, food, qty, meal) {
  const d = day(key);
  const micro = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  d.food.push({
    id: uid(), fid: food.id, name: food.name, serving: food.serving,
    cal: food.cal, p: food.p, c: food.c, f: food.f,
    fib: micro(food.fib), na: micro(food.na), pot: micro(food.pot),
    qty, meal, t: Date.now(),
  });
  if (food.id) {
    if (!FOOD_BY_ID[food.id] && !S.customFoods.some((f) => f.id === food.id)) S.foodCache[food.id] = { ...food };
    S.recent = [food.id, ...S.recent.filter((x) => x !== food.id)].slice(0, 60);
  }
  save();
}

export function recentFoods() {
  return S.recent.map(getFood).filter(Boolean);
}

// ---------- Weight ----------
export function weightEntries() {
  return Object.entries(S.weights).sort((a, b) => (a[0] < b[0] ? -1 : 1));
}
export function latestWeight() {
  const e = weightEntries();
  return e.length ? e[e.length - 1][1] : null;
}
// Average of entries in the last 7 days (smooths water-weight noise)
export function avgWeight(key = dayKey(), daysBack = 7) {
  const from = addDays(key, -(daysBack - 1));
  const vals = weightEntries().filter(([k]) => k >= from && k <= key).map(([, v]) => v);
  if (!vals.length) return latestWeight();
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
export function currentWeight() {
  return avgWeight() || S.profile.startWeight;
}

// ---------- Targets ----------
// Training day or rest day? A finished (or in-progress) workout always makes it a training day;
// otherwise a choice made on Today wins, otherwise the planned lift days decide.
export function dayType(key = dayKey()) {
  if (S.workouts.some((w) => w.date === key)) return 'train';
  const d = S.days[key];
  if (d && (d.dayType === 'train' || d.dayType === 'rest')) return d.dayType;
  return (S.settings.liftDays || []).includes(parseDay(key).getDay()) ? 'train' : 'rest';
}

// Calorie/macro targets for a day. The weekly total is the same as eating the average every day;
// with training/rest days on, training days get more (mostly carbs) and rest days get less.
export const DAY_SWING = 0.15; // gap between a training day and a rest day, as a share of the average
export function daySplit(avgCal) {
  const T = (S.settings.liftDays || []).length;
  if (!S.settings.dayTargets || T <= 0 || T >= 7) return null;
  const swing = avgCal * DAY_SWING;
  const r5 = (n) => Math.round(n / 5) * 5;
  return { up: r5((swing * (7 - T)) / 7), down: r5((swing * T) / 7), days: T };
}
export function targets(key = dayKey()) {
  const base = S.targets.auto
    ? { ...calcTargets(S.profile, currentWeight()), auto: true }
    : { ...calcTargets(S.profile, currentWeight()), ...S.targets, auto: false };
  const trainingDay = dayType(key) === 'train';
  const micro = microTargets(S.profile, trainingDay);
  if (!S.targets.auto) {
    if (S.targets.fib > 0) micro.fib = S.targets.fib;
    if (S.targets.pot > 0) micro.pot = S.targets.pot;
    if (S.targets.na > 0) micro.na = S.targets.na + (trainingDay ? SODIUM_TRAINING_EXTRA : 0);
  }
  const out = { ...base, ...micro, naExtra: trainingDay ? SODIUM_TRAINING_EXTRA : 0, avgCal: base.cal, avgC: base.c, dayType: null, dayDelta: 0 };
  const split = daySplit(base.cal);
  if (!split) return out;
  const type = dayType(key);
  const delta = type === 'train' ? split.up : -split.down;
  out.cal = base.cal + delta;
  out.c = Math.max(0, base.c + Math.round(delta / 4 / 5) * 5); // the difference is all carbs
  out.dayType = type;
  out.dayDelta = delta;
  return out;
}

// ---------- Exercises / workouts ----------
export function getEx(id) {
  return EX_BY_ID[id] || S.customEx.find((e) => e.id === id) || { id, name: id, cat: 'Other', type: 'weight', rest: 90, cues: [], why: '' };
}
export function allExercises() {
  return [...Object.values(EX_BY_ID), ...S.customEx];
}
export function activeWorkout() {
  return S.activeId ? S.workouts.find((w) => w.id === S.activeId) || null : null;
}
export function doneWorkouts() {
  return S.workouts.filter((w) => w.end).sort((a, b) => b.start - a.start);
}
// Last completed sets for an exercise (excluding a given workout)
export function lastSetsFor(exId, excludeId) {
  for (const w of doneWorkouts()) {
    if (w.id === excludeId) continue;
    const e = w.ex.find((x) => x.ex === exId);
    if (e && e.sets.some((s) => s.done)) return { date: w.date, sets: e.sets.filter((s) => s.done) };
  }
  return null;
}
export function nextTemplate() {
  const last = doneWorkouts().find((w) => w.tid && S.templates.some((t) => t.id === w.tid));
  const main = S.templates.filter((t) => !/^bonus/i.test(t.name));
  const list = main.length ? main : S.templates;
  if (!list.length) return null;
  if (!last) return list[0];
  const i = list.findIndex((t) => t.id === last.tid);
  return list[(i + 1) % list.length] || list[0];
}
export function workoutOn(key) {
  return S.workouts.filter((w) => w.date === key && w.end);
}

// ---------- Streak ----------
// Consecutive days (ending today or yesterday) with food logged
export function streak() {
  let k = dayKey();
  if (!peekDay(k).food.length) k = addDays(k, -1);
  let n = 0;
  while (peekDay(k).food.length) { n++; k = addDays(k, -1); if (n > 999) break; }
  return n;
}

export function daysSinceStart() {
  const s = parseDay(S.profile.startDate || dayKey());
  return Math.max(0, Math.round((parseDay(dayKey()) - s) / 86400000));
}
