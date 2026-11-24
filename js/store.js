// App state: one JSON blob in localStorage. Everything stays on the phone.
import { dayKey, addDays, uid, parseDay } from './util.js';
import { DEFAULT_TEMPLATES, EX_BY_ID } from './program.js';
import { FOOD_BY_ID } from './foods.js';
import { calcTargets } from './calc.js';

const KEY = 'trenches:v1';
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

export const DEFAULT_REMINDERS = () => [
  { id: 'weigh', kind: 'weigh', label: 'Weigh-in', msg: 'Step on the scale (after the bathroom, before eating) and log it.', time: '06:30', days: [...ALL_DAYS], on: true, prefer: 'before' },
  { id: 'bfast', kind: 'meal', label: 'Log breakfast', msg: 'Big breakfast = big day. Log it in Trenches.', time: '07:00', days: [...ALL_DAYS], on: true, prefer: 'before' },
  { id: 'lunch', kind: 'meal', label: 'Log lunch', msg: 'Log what you ate for lunch.', time: '12:30', days: [...ALL_DAYS], on: true, prefer: 'after' },
  { id: 'fuel', kind: 'meal', label: 'Pre-practice fuel', msg: 'Eat carbs + protein before practice/lift and log it.', time: '15:15', days: [1, 2, 3, 4, 5], on: true, prefer: 'after' },
  { id: 'dinner', kind: 'meal', label: 'Log dinner', msg: 'Log dinner and check your protein.', time: '19:00', days: [...ALL_DAYS], on: true, prefer: 'after' },
  { id: 'night', kind: 'check', label: 'Night check-in', msg: 'How close are you to your macros? Finish protein before bed.', time: '21:00', days: [...ALL_DAYS], on: true, prefer: 'before' },
  { id: 'gym', kind: 'gym', label: 'Gym time', msg: 'Time to train. Open today\'s workout.', time: '16:00', days: [1, 2, 4, 5], on: false, prefer: 'after' },
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
    targets: { auto: true, cal: 3600, p: 230, c: 430, f: 100, water: 160 },
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
        { id: 'school', label: 'School', days: [1, 2, 3, 4, 5], start: '07:45', end: '15:00' },
      ],
    },
    reminders: DEFAULT_REMINDERS(),
    notify: { method: 'none', topic: '', windowH: 48, sent: {}, lastSync: 0, until: 0 },
    settings: { theme: 'classic', sound: true, lastBackup: 0, restAuto: true },
  };
}

export let S = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) {
    console.warn('load failed', e);
  }
  return defaults();
}

function migrate(s) {
  const d = defaults();
  // Fill in any keys added in newer versions without touching user data.
  for (const k of Object.keys(d)) if (s[k] === undefined) s[k] = d[k];
  for (const k of Object.keys(d.profile)) if (s.profile[k] === undefined) s.profile[k] = d.profile[k];
  for (const k of Object.keys(d.settings)) if (s.settings[k] === undefined) s.settings[k] = d.settings[k];
  for (const k of Object.keys(d.notify)) if (s.notify[k] === undefined) s.notify[k] = d.notify[k];
  return s;
}

let saveTimer = null;
export function save(now = false) {
  clearTimeout(saveTimer);
  const doSave = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(S));
    } catch (e) {
      console.error('save failed', e);
      alert('Could not save - storage may be full. Export a backup from Settings.');
    }
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

// ---------- Food ----------
export function day(key = dayKey()) {
  if (!S.days[key]) S.days[key] = { food: [], water: 0 };
  return S.days[key];
}
export function peekDay(key) {
  return S.days[key] || { food: [], water: 0 };
}
export function totals(key = dayKey()) {
  const t = { cal: 0, p: 0, c: 0, f: 0 };
  for (const e of peekDay(key).food) {
    t.cal += e.cal * e.qty; t.p += e.p * e.qty; t.c += e.c * e.qty; t.f += e.f * e.qty;
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
  d.food.push({
    id: uid(), fid: food.id, name: food.name, serving: food.serving,
    cal: food.cal, p: food.p, c: food.c, f: food.f, qty, meal, t: Date.now(),
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
export function targets() {
  if (S.targets.auto) {
    const t = calcTargets(S.profile, currentWeight());
    return { ...t, auto: true };
  }
  return { ...calcTargets(S.profile, currentWeight()), ...S.targets };
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
