// Weekly report: are you actually doing the things that move the scale?
import { S, totals, targets, peekDay, doneWorkouts, weightEntries } from './store.js';
import { dayKey, addDays, parseDay, DOW1, r0, r1, fmt, esc } from './util.js';
import { win, group, btn, on, openModal } from './ui.js';
import { icon } from './icons.js';
import { paceStatus } from './weight.js';

export function weekStats(endKey = dayKey()) {
  const tg = targets();
  tg.cal = tg.avgCal; tg.c = tg.avgC; // compare the week against the average day
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const k = addDays(endKey, -i);
    const t = totals(k);
    const logged = peekDay(k).food.length > 0;
    days.push({ k, dow: parseDay(k).getDay(), ...t, logged, weighed: S.weights[k] != null });
  }
  const logged = days.filter((d) => d.logged);
  const n = logged.length || 1;
  // compare against each day's own goal (training days eat more), averaged - the same number the grocery review uses
  if (logged.length) {
    tg.cal = Math.round(logged.reduce((a, d) => a + targets(d.k).cal, 0) / logged.length);
    tg.p = Math.round(logged.reduce((a, d) => a + targets(d.k).p, 0) / logged.length);
  }
  const avgCal = logged.reduce((a, d) => a + d.cal, 0) / n;
  const avgP = logged.reduce((a, d) => a + d.p, 0) / n;
  const proteinHits = logged.filter((d) => d.p >= targets(d.k).p * 0.9).length;
  const calHits = logged.filter((d) => { const t = targets(d.k).cal; return Math.abs(d.cal - t) <= t * 0.1; }).length;
  const from = addDays(endKey, -6);
  const lifts = doneWorkouts().filter((w) => w.date >= from && w.date <= endKey).length;
  const avgIn = (a, b) => {
    const v = weightEntries().filter(([k]) => k >= a && k <= b).map((e) => e[1]);
    return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null;
  };
  const wNow = avgIn(from, endKey);
  const wPrev = avgIn(addDays(endKey, -13), addDays(endKey, -7));
  const weighIns = days.filter((d) => d.weighed).length;
  return { tg, days, loggedDays: logged.length, avgCal, avgP, proteinHits, calHits, lifts, wNow, wPrev, weighIns };
}

function verdict(w) {
  const tips = [];
  const dir = w.tg.dir;
  if (w.loggedDays < 5) tips.push('Log every day - you can\'t fix what you don\'t track. Use Recent + Saved Meals to make it 10 seconds.');
  if (w.proteinHits < Math.min(5, w.loggedDays)) tips.push(`Protein is the #1 lever. Add a shake or Greek yogurt to hit ${w.tg.p}g.`);
  // the scale has the final say: under your calorie goal is fine if you're still gaining on pace
  const pc = paceStatus();
  const pace = pc ? `${pc.rate > 0 ? '+' : ''}${r1(pc.rate)} lb/week (plan ${pc.plan > 0 ? '+' : ''}${r1(pc.plan)})` : '';
  if (dir > 0 && pc && pc.status === 'fast') tips.push(`You're gaining ${pace}, faster than planned. Don't add food - trim ~250 kcal a day, sweets and drinks first.`);
  else if (dir > 0 && w.avgCal < w.tg.cal * 0.9 && w.loggedDays) {
    if (pc && pc.status === 'ok') tips.push(`You're under your calorie goal (${fmt(w.avgCal)} vs ${fmt(w.tg.cal)}), but the scale is right on pace at ${pace}. No change needed.`);
    else tips.push(`You're averaging ${fmt(w.avgCal)} kcal vs your average goal (${fmt(w.tg.cal)}) and the scale is slow. Add a 4th meal: PB&J + whole milk is ~540 kcal.`);
  }
  if (dir < 0 && w.avgCal > w.tg.cal * 1.1 && w.loggedDays) tips.push('Running over on calories. Swap soda/sweet tea for water and keep protein high.');
  if (w.lifts < 3) tips.push('Aim for 3-4 lifts a week. Linemen are built in the weight room.');
  if (w.weighIns < 5) tips.push('Weigh in daily - the 7-day average is what matters, and it needs data.');
  if (!tips.length) tips.push('Great week. Keep stacking these - consistency wins.');
  return tips;
}

export function openWeekly() {
  const w = weekStats(addDays(dayKey(), -1));   // the last 7 full days - today isn't over yet
  const max = Math.max(w.tg.cal * 1.2, ...w.days.map((d) => d.cal));
  const change = w.wNow != null && w.wPrev != null ? w.wNow - w.wPrev : null;
  const bars = w.days.map((d) => {
    const h = Math.round((d.cal / max) * 100);
    const pOk = d.p >= targets(d.k).p * 0.9;
    return `<div class="wk-col ${d.k === dayKey() ? 'today' : ''}">
      <div class="wk-bar">${d.cal > 0 ? `<div class="wk-fill ${d.cal > w.tg.cal * 1.1 ? 'over' : ''}" style="height:${h}%"></div>` : ''}<div class="wk-goal" style="bottom:${(w.tg.cal / max) * 100}%"></div></div>
      <div class="wk-d">${DOW1[d.dow]}</div>
      <div class="wk-p ${pOk ? 'ok' : ''}">${d.logged ? (pOk ? icon('check', 12) : r0(d.p)) : '-'}</div>
    </div>`;
  }).join('');
  openModal(() => win('Weekly Report', `
    <p class="muted small">The last 7 full days (through yesterday). Bars = calories, line = your average goal of ${fmt(w.tg.cal)}. Under each day: protein (check = hit it).</p>
    <div class="wk-chart sunken">${bars}</div>
    <div class="stat-grid">
      <div class="stat sunken"><span>Avg calories</span><b class="vt">${fmt(w.avgCal)}</b></div>
      <div class="stat sunken"><span>Avg protein</span><b class="vt">${r0(w.avgP)}g</b></div>
      <div class="stat sunken"><span>Protein days</span><b class="vt">${w.proteinHits}/7</b></div>
      <div class="stat sunken"><span>Lifts</span><b class="vt">${w.lifts}</b></div>
      <div class="stat sunken"><span>Days logged</span><b class="vt">${w.loggedDays}/7</b></div>
      <div class="stat sunken"><span>Weight vs last wk</span><b class="vt">${change == null ? '-' : `${change > 0 ? '+' : ''}${r1(change)}<small> lb</small>`}</b></div>
    </div>
    ${group('Coach', `<ul class="coach">${verdict(w).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`)}
    <div class="btn-row">${btn('Close', 'modal-close', { cls: 'grow' })}</div>
  `, { cls: 'dialog', close: 'modal-close', ico: 'trophy' }));
}

on({ 'weekly': () => openWeekly() });
