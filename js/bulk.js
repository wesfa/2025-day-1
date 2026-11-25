// Bulk quality: is the weight you're gaining muscle or mostly fat? Five signals, each scored and combined:
//   gain rate (% of bodyweight per week), waist growth per pound gained, strength trend, protein days, training days.
// While cutting it flips to "cut quality" (losing at a sane rate, waist down, strength holding).
// Body measurements live here too (waist every 2 weeks is enough; chest / arms / thighs / neck are optional).
import { S, save, weightEntries, avgWeight, currentWeight, totals, targets, doneWorkouts } from './store.js';
import { weeklyRate } from './calc.js';
import { exerciseRanks } from './strength.js';
import { dayKey, addDays, daysBetween, prettyDay, esc, r1, r0, num, buzz, HAPTIC } from './util.js';
import { group, btn, field, on, rerender, toast, confirmBox, numInput } from './ui.js';
import { icon } from './icons.js';

export const PARTS = [['waist', 'Waist'], ['chest', 'Chest'], ['arm', 'Arm'], ['thigh', 'Thigh'], ['neck', 'Neck']];

export const measureEntries = () => Object.entries(S.measure || {}).sort((a, b) => (a[0] < b[0] ? -1 : 1));

// Body fat estimate (US Navy tape method, men): needs waist, neck and height
export function navyBodyFat(waist, neck, heightIn) {
  if (!(waist > neck && neck > 0 && heightIn > 0)) return null;
  const bf = 86.01 * Math.log10(waist - neck) - 70.041 * Math.log10(heightIn) + 36.76;
  return bf > 2 && bf < 60 ? bf : null;
}

function rateOver(days) {
  const today = dayKey();
  const recent = weightEntries().filter(([k]) => k >= addDays(today, -(days - 1))).map(([k, v]) => [daysBetween(today, k), v]);
  return weeklyRate(recent);
}

const lvl = (score) => (score >= 80 ? 'good' : score >= 55 ? 'ok' : 'bad');

export function bulkQuality() {
  const p = S.profile;
  const cut = p.goalWeight < p.startWeight - 1;
  const bw = currentWeight();
  const factors = [];

  // 1) rate of change (last 4 weeks)
  const rate = rateOver(28);
  if (rate != null) {
    const pct = (rate / bw) * 100;
    let score; let msg; let fix = '';
    if (!cut) {
      if (pct < 0.1) { score = 45; msg = `Barely gaining (${r1(rate)} lb/week)`; fix = 'Add ~250 kcal a day - a shake or an extra snack.'; }
      else if (pct < 0.15) { score = 75; msg = `Gaining slowly (${r1(rate)} lb/week)`; fix = 'A little more food (+150 kcal/day) speeds it up.'; }
      else if (pct <= 0.7) { score = 100; msg = `Gaining ${r1(rate)} lb/week - a lean-bulk pace`; }
      else if (pct <= 1.0) { score = 60; msg = `Gaining fast (${r1(rate)} lb/week)`; fix = 'Faster than muscle can be built - drop ~200 kcal a day.'; }
      else { score = 30; msg = `Gaining very fast (${r1(rate)} lb/week)`; fix = 'Most of this is fat and water - drop ~350 kcal a day.'; }
    } else {
      const loss = -pct;
      if (loss < 0.2) { score = 50; msg = `Barely losing (${r1(rate)} lb/week)`; fix = 'Trim ~250 kcal a day, mostly from snacks and drinks.'; }
      else if (loss <= 1.0) { score = 100; msg = `Losing ${r1(-rate)} lb/week - a steady pace`; }
      else { score = 45; msg = `Losing fast (${r1(-rate)} lb/week)`; fix = 'Too fast keeps strength from holding - eat ~250 kcal more.'; }
    }
    factors.push({ key: 'rate', label: 'Pace', score, msg, fix, w: 30 });
  }

  // 2) waist vs weight (measurements at least 10 days apart, last 10 weeks)
  const ms = measureEntries().filter(([k, v]) => v && num(v.waist) > 0 && k >= addDays(dayKey(), -70));
  if (ms.length >= 2 && daysBetween(ms[0][0], ms[ms.length - 1][0]) >= 10) {
    const [k0, m0] = ms[0]; const [k1, m1] = ms[ms.length - 1];
    const dWaist = num(m1.waist) - num(m0.waist);
    const dW = (avgWeight(k1, 7) || bw) - (avgWeight(k0, 7) || bw);
    let score; let msg; let fix = '';
    if (!cut) {
      if (dW <= 0.5) { score = dWaist > 0.5 ? 40 : 70; msg = `Waist ${dWaist >= 0 ? '+' : ''}${r1(dWaist)} in, weight about flat`; if (dWaist > 0.5) fix = 'Waist growing without gaining weight - tighten up snacks.'; }
      else {
        const per = Math.max(0, dWaist - 0.25) / dW;   // a tape is only good to about 1/4 inch
        if (per <= 0.1) { score = 100; msg = `Waist ${dWaist >= 0 ? '+' : ''}${r1(dWaist)} in for +${r1(dW)} lb - mostly muscle`; }
        else if (per <= 0.2) { score = 75; msg = `Waist +${r1(dWaist)} in for +${r1(dW)} lb - OK`; }
        else if (per <= 0.3) { score = 50; msg = `Waist +${r1(dWaist)} in for +${r1(dW)} lb - some fat`; fix = 'Trim ~150 kcal and keep protein high.'; }
        else { score = 25; msg = `Waist +${r1(dWaist)} in for +${r1(dW)} lb - mostly fat`; fix = 'Pull calories down ~300 a day until the waist settles.'; }
      }
    } else if (dWaist <= -0.25) { score = 100; msg = `Waist ${r1(dWaist)} in - losing fat`; }
    else if (dWaist <= 0.25) { score = 65; msg = 'Waist about the same'; fix = 'If weight is dropping but the waist isn\'t, check protein and lifting.'; }
    else { score = 35; msg = `Waist +${r1(dWaist)} in while cutting`; fix = 'Re-check your logging - something isn\'t adding up.'; }
    factors.push({ key: 'waist', label: 'Waist', score, msg, fix, w: 25 });
  }

  // 3) strength trend: estimated max on each lift, first vs latest session in the last 6 weeks
  const from = addDays(dayKey(), -42);
  const changes = [];
  for (const x of exerciseRanks()) {
    const h = x.history.filter((s) => s.key >= from);
    if (h.length < 2 || daysBetween(h[0].key, h[h.length - 1].key) < 10) continue;
    const a = h[0].m; const b = Math.max(...h.slice(-2).map((s) => s.m));
    if (a > 0) changes.push((b - a) / a);
  }
  if (changes.length) {
    const avg = (changes.reduce((s, c) => s + c, 0) / changes.length) * 100;
    let score; let msg; let fix = '';
    if (avg >= 3) { score = 100; msg = `Lifts up ${r0(avg)}% on average - building muscle`; }
    else if (avg >= 0) { score = 70; msg = `Lifts up ${r1(avg)}% - slow`; fix = 'Push sets to RPE 8-9 and get 9 hours of sleep.'; }
    else { score = cut ? 55 : 35; msg = `Lifts down ${r1(-avg)}%`; fix = cut ? 'Some drop is normal on a cut - keep the heavy sets.' : 'Strength should climb on a bulk - check sleep and recovery.'; }
    factors.push({ key: 'strength', label: 'Strength', score, msg, fix, w: 20 });
  }

  // 4) protein days (last 14 logged days)
  const logged = [];
  for (let i = 0; i < 14; i++) {
    const k = addDays(dayKey(), -i);
    if ((S.days[k] && S.days[k].food || []).length) logged.push(k);
  }
  if (logged.length >= 3) {
    const hit = logged.filter((k) => totals(k).p >= targets(k).p * 0.9).length;
    const score = Math.round((hit / logged.length) * 100);
    factors.push({ key: 'protein', label: 'Protein', score, msg: `Hit protein ${hit} of ${logged.length} logged days`, fix: score < 80 ? 'Add a shake or a second protein at lunch.' : '', w: 15 });
  }

  // 5) training (last 3 weeks vs your lift days)
  const plan = Math.max(1, (S.settings.liftDays || []).length) * 3;
  const did = doneWorkouts().filter((w) => (w.date || '') >= addDays(dayKey(), -20)).length;
  if (S.workouts.length) {
    const score = Math.min(100, Math.round((did / plan) * 100));
    factors.push({ key: 'train', label: 'Training', score, msg: `${did} of ${plan} planned workouts in 3 weeks`, fix: score < 70 ? 'A surplus only turns into muscle if you lift - don\'t skip days.' : '', w: 10 });
  }

  if (!factors.length) return { cut, factors, score: null };
  const wsum = factors.reduce((a, f) => a + f.w, 0);
  const score = Math.round(factors.reduce((a, f) => a + f.score * f.w, 0) / wsum);
  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : 'D';
  const label = cut
    ? { A: 'Clean cut', B: 'Solid cut', C: 'Needs a tweak', D: 'Off track' }[grade]
    : { A: 'Lean bulk', B: 'Solid bulk', C: 'Needs a tweak', D: 'Off track' }[grade];
  const worst = [...factors].filter((f) => f.fix).sort((a, b) => a.score - b.score)[0];
  return { cut, factors, score, grade, label, advice: worst ? worst.fix : 'Keep doing exactly this.' };
}

// ================= Weight-screen groups =================
export function bulkGroup() {
  const q = bulkQuality();
  const title = q.cut ? 'Cut quality' : 'Bulk quality';
  if (q.score == null) {
    return group(title, '<p class="muted small">Log a few weigh-ins, workouts and your waist (below) and this grades whether you\'re gaining muscle or mostly fat.</p>');
  }
  return group(title, `
    <div class="bq-head">
      <span class="bq-grade g-${q.grade}">${q.grade}</span>
      <span><b>${esc(q.label)}</b><br><span class="muted small">${q.score}/100</span></span>
    </div>
    <ul class="bq-list">${q.factors.map((f) => `<li class="bq-${lvl(f.score)}"><span class="bq-dot"></span><b>${esc(f.label)}</b> ${esc(f.msg)}</li>`).join('')}</ul>
    <p class="bq-advice">${icon('up', 10)} ${esc(q.advice)}</p>
    ${q.factors.some((f) => f.key === 'waist') ? '' : '<p class="muted small">Add your waist below (now and again in 2 weeks) to see if the gain is muscle or fat.</p>'}
  `);
}

export function measureGroup() {
  const list = measureEntries();
  const last = list.length ? list[list.length - 1] : null;
  const today = S.measure && S.measure[dayKey()];
  const due = !last || daysBetween(last[0], dayKey()) >= 14;
  const bf = last ? navyBodyFat(num(last[1].waist), num(last[1].neck), S.profile.heightIn) : null;
  const rows = [...list].reverse().slice(0, 6).map(([k, v], i, arr) => {
    const prev = arr[i + 1] && arr[i + 1][1];
    const d = prev && num(prev.waist) && num(v.waist) ? num(v.waist) - num(prev.waist) : null;
    const extra = PARTS.slice(1).filter(([p]) => num(v[p])).map(([p, l]) => `${l} ${r1(num(v[p]))}`).join(' · ');
    return `<div class="row static"><span class="row-main"><span class="row-name">${esc(prettyDay(k))}</span>${extra ? `<span class="row-sub">${esc(extra)}</span>` : ''}</span>
      ${d != null ? `<span class="delta ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '+' : ''}${r1(d)}</span>` : ''}
      <span class="row-num">${num(v.waist) ? r1(num(v.waist)) + '<small> in</small>' : '-'}</span>
      <button class="btn sq" data-act="ms-del" data-k="${k}" aria-label="Delete">${icon('close', 8)}</button></div>`;
  }).join('');
  return group('Measurements', `
    ${due ? '<p class="alert soft">Measure your waist today - every 2 weeks is enough.</p>' : ''}
    <form id="ms-f" class="ms-grid" onsubmit="return false">
      ${PARTS.map(([p, l]) => field(`${l}${p === 'waist' ? '' : ' <span class="muted">(optional)</span>'}`, numInput(p, today ? today[p] ?? '' : '', { step: 0.25, placeholder: last && num(last[1][p]) ? r1(num(last[1][p])) : 'in' }))).join('')}
      <div class="btn-row">${btn(today ? 'Update' : 'Save', 'ms-save', { cls: 'primary grow', type: 'submit' })}</div>
    </form>
    <p class="muted small">Tape snug, not tight. Waist at the belly button, relaxed, first thing in the morning. Arm and thigh at the biggest point.</p>
    ${bf != null && S.profile.sex !== 'f' ? `<p>Estimated body fat: <b class="vt">${r1(bf)}%</b> <span class="muted small">(tape method from waist, neck and height - rough)</span></p>` : ''}
    ${rows}
  `);
}

on({
  'ms-save': () => {
    const f = document.getElementById('ms-f');
    const v = {};
    for (const [p] of PARTS) { const x = parseFloat(f.elements[p].value); if (x > 5 && x < 90) v[p] = Math.round(x * 4) / 4; }
    if (!v.waist) { toast('Enter your waist (inches)', 'warn'); return; }
    S.measure = S.measure || {};
    S.measure[dayKey()] = v;
    save(true); buzz(HAPTIC.success); toast('Measurements saved', 'check'); rerender();
  },
  'ms-del': async (el) => {
    if (!(await confirmBox(`Delete measurements from ${esc(prettyDay(el.dataset.k))}?`))) return;
    delete S.measure[el.dataset.k]; save(); rerender();
  },
});
