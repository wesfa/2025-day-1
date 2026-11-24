// Nutrition + training math.
import { r0 } from './util.js';

const round5 = (n) => Math.round(n / 5) * 5;

export const PHASES = {
  off: { label: 'Off-season (lifting 4-5x/wk)', factor: 1.6 },
  summer: { label: 'Summer (lifting + speed/conditioning)', factor: 1.7 },
  pre: { label: 'Pre-season / camp (2-a-days)', factor: 1.85 },
  in: { label: 'In-season (practice + games)', factor: 1.75 },
};

// Calorie + macro targets for a football defensive lineman.
// - Calories: Mifflin-St Jeor BMR x activity, +/- 500 kcal per lb/week of change
// - Protein: ~1 g per lb (goal weight if cutting, current weight if gaining)
// - Fat: 25% of calories; Carbs: everything else (football runs on carbs)
export function calcTargets(profile, currentWeight) {
  const w = currentWeight || profile.startWeight || 220;
  const goal = profile.goalWeight || w;
  const kg = w * 0.453592;
  const cm = (profile.heightIn || 72) * 2.54;
  const age = profile.age || 17;
  const bmr = 10 * kg + 6.25 * cm - 5 * age + (profile.sex === 'f' ? -161 : 5);
  const factor = (PHASES[profile.phase] || PHASES.off).factor;
  const maintenance = bmr * factor;

  const diff = goal - w;
  const dir = Math.abs(diff) < 1 ? 0 : Math.sign(diff);
  let rate = Math.abs(profile.rate || 0.5);
  // Teen athletes: keep cuts gentle so strength and growth don't suffer.
  if (dir < 0 && age < 18) rate = Math.min(rate, 1);
  const delta = dir * rate * 500;
  const cal = round5(maintenance + delta);

  const proteinBase = dir < 0 ? goal : w;
  const p = round5(proteinBase * 1.0);
  const f = round5((cal * 0.25) / 9);
  const c = Math.max(0, round5((cal - p * 4 - f * 9) / 4));
  const water = Math.round((Math.max(96, w * 0.6) + 16) / 8) * 8;

  return { cal, p, c, f, water, bmr: r0(bmr), maintenance: r0(maintenance), delta: r0(delta), dir };
}

// Estimated 1-rep max (Epley). Only meaningful for reps <= 12.
export function e1rm(w, r) {
  w = Number(w) || 0; r = Number(r) || 0;
  if (!w || !r || r > 12) return 0;
  return r === 1 ? w : w * (1 + r / 30);
}

// Linear regression slope of weight entries -> lb per week
export function weeklyRate(entries) {
  // entries: [[dayIndex, lb], ...]
  if (entries.length < 3) return null;
  const n = entries.length;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (const [x, y] of entries) { sx += x; sy += y; sxy += x * y; sxx += x * x; }
  const den = n * sxx - sx * sx;
  if (!den) return null;
  return ((n * sxy - sx * sy) / den) * 7;
}

// Plates per side for a target barbell weight
export const PLATES = [45, 35, 25, 10, 5, 2.5];
export function platesFor(total, bar = 45) {
  let side = (total - bar) / 2;
  const out = [];
  if (side <= 0) return { plates: out, leftover: 0 };
  for (const p of PLATES) {
    while (side >= p - 1e-9) { out.push(p); side -= p; }
  }
  return { plates: out, leftover: Math.round(side * 2 * 100) / 100 };
}
