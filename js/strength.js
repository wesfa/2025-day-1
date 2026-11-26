// Ranks and muscle volume.
//
// Rank = how strong a set is for YOU on THAT exercise. Each set becomes an estimated 1-rep max (or, for
// bodyweight moves, reps with added weight counted as extra reps) and is compared with the exercise's
// standard (exlib.js), scaled to your body:
//   - bodyweight: standards are written for a 180 lb lifter; strength grows slower than weight, so they
//     scale with (bodyweight / 180) ^ 0.67 (heavier lifters need more total weight, but less per pound)
//   - height: longer levers make the same weight harder, so taller lifters get slightly lower bars
//   - age and sex: teens and masters lifters, and women, get proportionally lower bars
// Tiers: Iron, Bronze, Silver, Gold, Platinum, Diamond, Champion - each (except Champion) split III / II / I.
// Each workout uses the bodyweight you logged closest before it, so gaining weight doesn't fake progress.
import { S, doneWorkouts, activeWorkout, getEx, weightEntries, currentWeight } from './store.js';
import { EX_META, MUSCLES, REGIONS } from './exlib.js';
import { dayKey, parseDay, addDays } from './util.js';

export const TIERS = [
  { name: 'Iron', color: '#8f8f96' }, { name: 'Bronze', color: '#cd7f3e' }, { name: 'Silver', color: '#c4ced8' },
  { name: 'Gold', color: '#ffc94a' }, { name: 'Platinum', color: '#4fe0c8' }, { name: 'Diamond', color: '#7fb2ff' },
  { name: 'Champion', color: '#ff6fd6' },
];
const DIVS = ['III', 'II', 'I'];
const UPPER = new Set(['chest', 'delts', 'reardelts', 'traps', 'neck', 'lats', 'upperback', 'biceps', 'triceps', 'forearms']);

export const metaFor = (id) => EX_META[id] || null;
export const isRanked = (id) => !!(EX_META[id] && EX_META[id].std);
const byReps = (id) => getEx(id).type === 'body';

// Estimated 1-rep max (Epley), allowing higher reps than the PR tracker so isolation work counts too
export function est1rm(w, r) {
  w = Number(w) || 0; r = Math.round(Number(r) || 0);
  if (w <= 0 || r <= 0) return 0;
  return r === 1 ? w : w * (1 + Math.min(r, 30) / 30);
}

function ageFactor(age) {
  age = Number(age) || 18;
  if (age < 13) return 0.65;
  if (age < 18) return [0.72, 0.78, 0.84, 0.9, 0.95][age - 13];
  if (age <= 35) return 1;
  return Math.max(0.6, 1 - (age - 35) * 0.008);
}
const heightFactor = (inches) => Math.min(1.08, Math.max(0.9, Math.sqrt(70 / (Number(inches) || 70))));

// How much each standard is scaled for this person at this bodyweight
export function personalFactor(exId, bw, profile = S.profile) {
  const meta = metaFor(exId);
  const upper = meta ? (meta.m[0] && UPPER.has(meta.m[0])) : true;
  const sex = profile.sex === 'f' ? (upper ? 0.55 : 0.7) : 1;
  const k = ageFactor(profile.age) * heightFactor(profile.heightIn) * sex;
  if (byReps(exId)) return k; // rep standards don't grow with bodyweight
  const ref = 180 * Math.pow(Math.max(80, bw) / 180, 0.67);
  return ref * k;
}

// Boundaries in the exercise's own units (lb of 1RM - per dumbbell where that applies - or reps)
export function boundaries(exId, bw, profile) {
  const meta = metaFor(exId);
  if (!meta || !meta.std) return null;
  const f = personalFactor(exId, bw, profile);
  const b = meta.std.map((v) => v * f);
  return [0, ...b, b[4] * 1.25];  // Iron starts at 0; Champion at 125% of Diamond
}

// What a single set is worth in those units
export function measure(exId, set, bw) {
  const r = Number(set.r) || 0;
  if (byReps(exId)) {
    // added weight: turn (bodyweight + added) x reps into the bodyweight-only reps with the same estimated max
    const added = Number(set.w) || 0;
    if (added <= 0 || r <= 0) return r;
    const body = Math.max(80, bw);
    return 30 * ((body + added) * (1 + Math.min(r, 30) / 30) / body - 1);
  }
  return est1rm(set.w, r);
}

export function scoreOf(m, b) {
  if (!b || m <= 0) return 0;
  for (let t = 0; t < 6; t++) {
    if (m < b[t + 1]) return t + (m - b[t]) / (b[t + 1] - b[t]);
  }
  return 6;
}

export function rankOf(score) {
  const t = Math.min(6, Math.floor(score));
  const frac = t === 6 ? 1 : score - t;
  const div = t === 6 ? '' : DIVS[Math.min(2, Math.floor(frac * 3))];
  return { tier: t, div, name: `${TIERS[t].name}${div ? ' ' + div : ''}`, color: TIERS[t].color, frac, divFrac: t === 6 ? 1 : (frac * 3) % 1 };
}

// Bodyweight on a date: the latest weigh-in on or before it, else the earliest one, else the profile
export function bwOn(key) {
  const e = weightEntries();
  if (!e.length) return S.profile.startWeight || currentWeight();
  let w = e[0][1];
  for (const [k, v] of e) { if (k <= key) w = v; else break; }
  return w;
}

const roundUp = (w, step) => Math.ceil(w / step - 1e-9) * step;

// The next division up: what the best set needs to become
export function nextTarget(exId, best, bw) {
  const b = boundaries(exId, bw);
  if (!b || !best) return null;
  const score = scoreOf(best.m, b);
  const rk = rankOf(score);
  if (rk.tier === 6) return { label: 'Top rank - keep it there', rank: rk };
  const stepFrac = (Math.floor(rk.frac * 3) + 1) / 3;
  const target = stepFrac >= 1 ? b[rk.tier + 1] : b[rk.tier] + (b[rk.tier + 1] - b[rk.tier]) * stepFrac;
  const nextRk = rankOf(rk.tier + stepFrac + 1e-6);
  const w = Number(best.w) || 0; const r = Number(best.r) || 0;
  const opts = [];
  if (byReps(exId)) {
    const body = Math.max(80, bw);
    const reps = w > 0 ? Math.ceil(30 * (body * (1 + target / 30) / (body + w) - 1)) : Math.ceil(target);
    opts.push(w > 0 ? `+${w} x ${Math.max(r + 1, reps)}` : `${Math.max(r + 1, reps)} reps`);
  } else {
    const meta = metaFor(exId);
    const step = (meta && meta.db) || w < 60 ? 2.5 : 5;
    if (r >= 1) opts.push(`${roundUp(target / (r === 1 ? 1 : 1 + Math.min(r, 30) / 30), step)} x ${r}`);
    if (w > 0) {
      const reps = Math.ceil((target / w - 1) * 30);
      if (reps > r && reps <= 20) opts.push(`${w} x ${reps}`);
    }
  }
  return { label: opts.join(' or '), rank: nextRk, target };
}

// Every finished workout (plus the one in progress) as [{ key, sets: [{ exId, w, r }] }]
function sessions(excludeId) {
  const out = doneWorkouts().filter((w) => w.id !== excludeId).map((w) => ({ key: w.date || dayKey(new Date(w.start)), start: w.start, ex: w.ex }));
  const act = activeWorkout();
  if (act && act.id !== excludeId) out.push({ key: act.date || dayKey(), start: act.start, ex: act.ex, live: true });
  return out.sort((a, b) => a.start - b.start);
}

// Rank info for every ranked exercise you've logged
export function exerciseRanks(excludeId) {
  const by = {};
  for (const s of sessions(excludeId)) {
    const bw = bwOn(s.key);
    for (const e of s.ex) {
      if (!isRanked(e.ex)) continue;
      const b = boundaries(e.ex, bw);
      let dayBest = null;
      for (const set of e.sets) {
        if (!set.done || !(Number(set.r) > 0)) continue;
        const m = measure(e.ex, set, bw);
        const score = scoreOf(m, b);
        if (!dayBest || score > dayBest.score) dayBest = { score, m, w: set.w, r: set.r, key: s.key, bw };
      }
      if (!dayBest) continue;
      const x = by[e.ex] || (by[e.ex] = { exId: e.ex, history: [], best: null });
      x.history.push(dayBest);
      if (!x.best || dayBest.score > x.best.score) x.best = dayBest;
    }
  }
  const bwNow = currentWeight();
  return Object.values(by).map((x) => {
    // rank today = your best set, re-scored at today's bodyweight
    const b = boundaries(x.exId, bwNow);
    const score = scoreOf(x.best.m, b);
    return { ...x, score, rank: rankOf(score), next: nextTarget(x.exId, x.best, bwNow), last: x.history[x.history.length - 1] };
  }).sort((a, b) => b.score - a.score);
}

// Overall: the average of your best six ranked exercises
export function overallRank(list = exerciseRanks()) {
  const top = list.slice(0, 6);
  if (!top.length) return null;
  const score = top.reduce((a, x) => a + x.score, 0) / top.length;
  return { score, rank: rankOf(score), count: top.length };
}

// ---------- muscle volume ----------
// Each checked-off set counts 1 for its primary muscles and 1/2 for secondary ones (cardio counts half,
// stretching not at all).
export function muscleVolume(days = 7, endKey = dayKey()) {
  const from = addDays(endKey, -(days - 1));
  const vol = Object.fromEntries(Object.keys(MUSCLES).map((k) => [k, 0]));
  let sets = 0;
  for (const s of sessions()) {
    if (s.key < from || s.key > endKey) continue;
    for (const e of s.ex) {
      const meta = metaFor(e.ex) || customMeta(e.ex);
      if (!meta || meta.stretch) continue;
      const k = meta.cardio || meta.warm ? 0.5 : 1;
      const n = e.sets.filter((x) => x.done).length;
      if (!n) continue;
      sets += n;
      for (const m of meta.m) if (vol[m] != null) vol[m] += n * k;
      for (const m of meta.s) if (vol[m] != null) vol[m] += n * k * 0.5;
    }
  }
  const regions = Object.fromEntries(REGIONS.map((r) => [r, 0]));
  for (const [k, v] of Object.entries(vol)) regions[MUSCLES[k].region] += v;
  return { vol, regions, sets, from, to: endKey };
}

function customMeta(id) {
  const c = (S.customEx || []).find((x) => x.id === id);
  return c && c.muscle ? { m: [c.muscle], s: [], std: null } : null;
}

export { parseDay };
