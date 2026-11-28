// Auto weight & reps. After each set you rate how hard it was (RPE), and the coach picks the next set's weight and
// reps so every set lands about 2 reps short of failure (RPE 8): the sweet spot for building muscle without
// grinding yourself down. Between workouts it adds reps, then weight (double progression), faster when you had
// reps left last time, and a little lighter after a short night's sleep.
//
// RPE: 10 = nothing left, 9 = 1 rep left, 8 = 2 left, 7 = 3 left, 6 = 4 or more left (counted as 5).
// A set at RPE 7 or easier means go heavier: the next set goes up a weight whenever the reps still land in the range.
// Estimated max with RPE = weight x (1 + (reps + reps left) / 30)   (Epley, counting the reps you had left)
import { S, getEx, lastSetsFor, currentWeight } from './store.js';
import { EX_META } from './exlib.js';
import { num } from './util.js';
import { shortNight } from './sleep.js';

export const RPE_LEFT = { 6: '4+ reps left', 7: '3 reps left', 8: '2 reps left', 9: '1 rep left', 10: 'nothing left' };
const UNRATED = 8.5;          // a set you didn't rate counts as about 1-2 reps left
const SKIP_CATS = new Set(['D-Line Drills', 'Conditioning', 'Cardio', 'Mobility']);
const firstNum = (s) => { const m = String(s || '').match(/\d+(\.\d+)?/); return m ? Number(m[0]) : 0; };
// Push-ups and bench dips get harder with more reps (or a deficit / feet up), not with added weight
const repsOnly = (ex) => ex.type === 'body' && /push-up|bench dip/i.test(ex.name);

export const coachOn = () => S.settings.coach !== false;
export const goalMode = () => (S.settings.trainGoal === 'strength' ? 'strength' : 'muscle');

export function coachable(ex) {
  if (!ex || !(ex.type === 'weight' || ex.type === 'body')) return false;
  if (SKIP_CATS.has(ex.cat)) return false;
  const meta = EX_META[ex.id];
  return !(meta && (meta.cardio || meta.stretch || meta.warm));
}

// Rep range for an exercise in a workout entry. Muscle gain: heavy barbell compounds 6-10, other compounds 8-12,
// single-muscle moves 10-15, abs 10-20, bodyweight 5-12. Strength mode (and explosive Power lifts) use the program's reps.
export function repRange(ex, e) {
  const prog = firstNum(e && e.tr);
  const power = ex.cat === 'Power';
  if ((goalMode() === 'strength' || power) && prog) return [prog, prog];
  const meta = EX_META[ex.id];
  const m = meta ? meta.m : ex.muscle ? [ex.muscle] : [];
  const s = meta ? meta.s : [];
  const core = m.some((x) => x === 'abs' || x === 'obliques');
  if (ex.type === 'body') return core ? [10, 20] : repsOnly(ex) ? [8, 25] : [5, 12];
  if (core) return [10, 20];
  if (meta && meta.eq === 'barbell' && m.length + s.length >= 3) return [6, 10];
  if (m.length <= 1 && s.length <= 1) return [10, 15];
  return [8, 12];
}
export const targetRpe = (ex) => (ex.cat === 'Power' ? 7 : 8);   // power: stay fast and crisp

function plannedSets(ex, e) {
  const t = Number(e.ts) || firstNum(String(e.target || '').split('x')[0]) || 3;
  if (goalMode() === 'strength' || ex.cat === 'Power') return t;
  return Math.max(2, Math.min(4, t));   // 2-4 hard sets per exercise is plenty for growth
}

// RPE 6 means "4 or more left" - people usually have more in the tank than they think, so call it 5
const left = (rpe) => { const v = num(rpe) || UNRATED; return v <= 6 ? 5 : 10 - v; };
const isEasy = (rpe) => num(rpe) > 0 && num(rpe) <= 7;   // 3+ reps left: time to go heavier
// Estimated max of a set (for bodyweight moves: of bodyweight + added weight)
export function setMax(set, isBody, bw) {
  const r = num(set.r);
  if (r <= 0) return 0;
  const load = (isBody ? bw : 0) + num(set.w);
  if (load <= 0) return 0;
  return load * (1 + Math.min(r + left(set.rpe), 30) / 30);
}
const repsAt = (max, load, rir) => 30 * (max / load - 1) - rir;
const loadFor = (max, reps, rir) => max / (1 + (reps + rir) / 30);

function stepFor(ex, w) {
  const meta = EX_META[ex.id];
  if ((meta ? meta.eq : ex.eq) === 'dumbbell') return w < 10 ? 2.5 : 5;   // dumbbell racks go up by 5 lb
  return w < 30 ? 2.5 : 5;
}
const roundTo = (w, st) => Math.round(w / st) * st;
const floorTo = (w, st) => Math.floor(w / st + 1e-9) * st;
const clampR = (r, lo, hi) => Math.max(lo, Math.min(hi, r));

// Weight x reps for a set, from an estimated max and the weight you've been using.
// easy = the set it's based on had 3+ reps left: go up a weight whenever the reps still land in the range.
// Returns { w, r, held } - held is the heavier weight it skipped because the reps would drop under the range.
function pick(ex, max, ref, lo, hi, rir, isBody, bw, easy) {
  if (isBody) {
    const added = num(ref);
    if (ex.cat === 'Power') return { w: added ? String(added) : '', r: hi };   // jumps: crisp reps, never add weight
    let r = Math.round(repsAt(max, bw + added, rir));
    if (r > hi + 2 && goalMode() === 'muscle' && !repsOnly(ex)) {
      // too easy at bodyweight: add weight to land mid-range
      const mid = Math.round((lo + hi) / 2);
      const add = Math.max(5, roundTo(loadFor(max, mid, rir) - bw, 5));
      return { w: String(add), r: clampR(Math.round(repsAt(max, bw + add, rir)), lo, hi) };
    }
    return { w: added ? String(added) : '', r: Math.max(1, r) };
  }
  let w = num(ref);
  if (!(w > 0)) {
    const mid = Math.round((lo + hi) / 2);
    w = Math.max(stepFor(ex, 1), floorTo(loadFor(max, mid, rir), stepFor(ex, loadFor(max, mid, rir))));
  }
  let r = Math.round(repsAt(max, w, rir));
  if (r > hi) {
    // more than the top of the range: go up so reps land in the middle
    const mid = Math.round((lo + hi) / 2);
    const st = stepFor(ex, w);
    let nw = roundTo(loadFor(max, mid, rir), st);
    if (nw <= w) nw = w + st;
    w = nw; r = Math.round(repsAt(max, w, rir));
  } else if (r < lo) {
    const st = stepFor(ex, w);
    let nw = floorTo(loadFor(max, lo + (hi > lo ? 1 : 0), rir), st);
    if (nw >= w) nw = w - st;
    w = Math.max(st, nw); r = Math.round(repsAt(max, w, rir));
  } else if (easy && w > 0) {
    const st = stepFor(ex, w);
    const r2 = Math.round(repsAt(max, w + st, rir));
    if (r2 >= lo) { w += st; r = r2; } else return { w: String(w), r: clampR(r, lo, hi), held: w + st };
  }
  return { w: String(w), r: clampR(r, lo, hi) };
}

// Everything the workout screen shows for exercise i of workout w:
// { lo, hi, sets, rpe, next: { w, r, why } | null, advice, first }
export function coach(w, i) {
  if (!coachOn() || !w || !w.ex[i]) return null;
  const e = w.ex[i];
  const ex = getEx(e.ex);
  if (!coachable(ex)) return null;
  const [lo, hi] = repRange(ex, e);
  const rpeT = targetRpe(ex);
  const rir = 10 - rpeT;
  const sets = plannedSets(ex, e);
  const isBody = ex.type === 'body';
  const bw = currentWeight();
  const out = { lo, hi, sets, rpe: rpeT, next: null, advice: '', first: false };
  const done = e.sets.filter((s) => s.done && num(s.r) > 0);

  if (done.length) {
    const s = done[done.length - 1];
    const easy = isEasy(s.rpe);
    const max = setMax(s, isBody, bw) * (easy ? 1 : 0.98);   // each hard set leaves you a little more tired
    const nx = pick(ex, max, s.w, lo, hi, rir, isBody, bw, easy);
    const dw = num(nx.w) - num(s.w);
    const rpe = num(s.rpe);
    const rated = rpe ? `RPE ${rpe}` : 'Last set';
    const aim = rpe ? `${rated} (aim ${rpeT})` : rated;
    let why = '';
    if (dw < 0) why = `${aim}: down ${-dw} lb`;
    else if (dw > 0) why = `${aim}: up ${dw} lb`;
    else if (nx.held) why = `${rated} was easy: more reps (${nx.held} would drop you under ${lo})`;
    else if (nx.r < num(s.r)) why = rpe >= 9.5 ? `${rated} was all-out: ${nx.r} reps keeps 2 in the tank` : isBody ? 'A rep or so drops as you tire' : 'Same weight: a rep or so drops as you tire';
    else if (nx.r > num(s.r)) why = rpe && rpe <= 7 ? `${rated} felt easy: go for ${nx.r}` : 'You had more in you: one more rep';
    if (ex.cat === 'Power' && isBody) why = 'Every rep explosive - stop if they slow down';
    out.next = { w: nx.w, r: nx.r, why };
    if (num(s.rpe) >= 10 && num(s.r) < lo) out.advice = 'That was a grind under your rep range - the next set is lighter.';
    else if (done.length >= sets) {
      const easy = num(s.rpe) && num(s.rpe) <= 7 && done.length < sets + 2;
      out.advice = easy
        ? `Felt easy (RPE ${s.rpe}) - one more set at ${fmtSet(nx, isBody)}.`
        : `${done.length} hard sets done - that's enough for growth. Next exercise.`;
      out.enough = !easy;
    } else out.setNo = done.length + 1;
    return out;
  }

  const last = lastSetsFor(e.ex, w.id);
  const lastDone = last ? last.sets.filter((s) => num(s.r) > 0) : [];
  if (!lastDone.length) {
    out.first = true;
    out.advice = isBody ? `First time: do ${lo}-${hi} reps, then rate it.` : `First time: pick a weight you could do about ${hi} times, then rate the set and I'll take it from there.`;
    return out;
  }
  // best set last time, then progress: more when you had reps left, none after a grind
  let best = null;
  for (const s of lastDone) { const m = setMax(s, isBody, bw); if (!best || m > best.m) best = { m, s }; }
  const rpes = lastDone.map((s) => num(s.rpe)).filter(Boolean);
  const hardest = rpes.length ? Math.max(...rpes) : 0;
  let gain = hardest ? (hardest <= 8.5 ? 1.02 : hardest < 10 ? 1.01 : 1.0) : 1.01;
  const short = shortNight();
  if (short) gain *= 0.97;
  const nx = pick(ex, best.m * gain, best.s.w, lo, hi, rir, isBody, bw, isEasy(hardest));
  const dw = num(nx.w) - num(best.s.w);
  const lastTxt = `${fmtSet(best.s, isBody)}${num(best.s.rpe) ? ` @${best.s.rpe}` : ''}`;
  let why;
  if (dw > 0) why = `Last time ${lastTxt}: up ${dw} lb`;
  else if (dw < 0) why = nx.r > num(best.s.r) ? `Last time ${lastTxt}: lighter, ${lo}-${hi} reps` : `Last time ${lastTxt}: a bit lighter today`;
  else if (nx.r > num(best.s.r)) why = `Last time ${lastTxt}: +${nx.r - num(best.s.r)} rep${nx.r - num(best.s.r) > 1 ? 's' : ''}${nx.held ? ` (${nx.held} is too big a jump yet)` : ''}`;
  else why = `Last time ${lastTxt} - same again`;
  if (short) why += ' · short sleep, 3% easier';
  if (ex.cat === 'Power' && isBody) why = 'Every rep explosive - stop if they slow down';
  out.next = { w: nx.w, r: nx.r, why };
  out.setNo = 1;
  return out;
}

export function fmtSet(s, isBody) {
  const w = num(s.w);
  if (isBody) return w ? `+${w} x ${s.r}` : `${s.r} reps`;
  return `${s.w} x ${s.r}`;
}
export const rangeText = (c) => (c.lo === c.hi ? `${c.lo}` : `${c.lo}-${c.hi}`);
