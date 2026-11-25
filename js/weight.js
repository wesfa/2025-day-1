// Weight: daily weigh-in, trend, projection, pixel chart.
import { S, save, weightEntries, latestWeight, avgWeight, targets } from './store.js';
import { weeklyRate } from './calc.js';
import { dayKey, addDays, prettyDay, shortDate, esc, r1, num, daysBetween, parseDay, buzz, HAPTIC } from './util.js';
import { win, group, bar, btn, field, on, rerender, toast, confirmBox } from './ui.js';
import { icon } from './icons.js';
import { bulkGroup, measureGroup } from './bulk.js';

const wv = { range: 30, date: dayKey() };

export function logWeight(key, lb) {
  lb = num(lb, 0);
  if (!(lb > 50 && lb < 600)) { toast('Enter a real weight (lb)', 'warn'); return false; }
  S.weights[key] = Math.round(lb * 10) / 10;
  save(true);
  buzz(HAPTIC.success);
  if (navigator.clearAppBadge && key === dayKey()) navigator.clearAppBadge().catch(() => {});
  return true;
}

export function weightStats() {
  const entries = weightEntries();
  const p = S.profile;
  const start = p.startWeight;
  const goal = p.goalWeight;
  const now = avgWeight() || start;
  const today = dayKey();
  const recent = entries.filter(([k]) => k >= addDays(today, -20)).map(([k, v]) => [daysBetween(today, k), v]);
  const rate = weeklyRate(recent);
  const toGo = goal - now;
  const dir = Math.sign(goal - start) || 1;
  const progress = start === goal ? 1 : (now - start) / (goal - start);
  let eta = null;
  if (rate && Math.sign(rate) === Math.sign(toGo) && Math.abs(toGo) > 0.5) {
    const weeks = toGo / rate;
    if (weeks < 200) { const d = parseDay(today); d.setDate(d.getDate() + Math.round(weeks * 7)); eta = d; }
  }
  return { entries, start, goal, now, rate, toGo, dir, progress, eta, latest: latestWeight() };
}

export function renderWeight() {
  const st = weightStats();
  const k = wv.date;
  const logged = S.weights[k];
  const plan = (S.profile.rate || 0.5) * (st.dir);
  const recent = [...st.entries].reverse().slice(0, 14);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  let paceMsg = 'Log at least 3 weigh-ins to see your trend.';
  if (st.rate != null) {
    const r = st.rate;
    const onPace = st.dir > 0 ? r >= plan * 0.6 : r <= plan * 0.6;
    const tg = targets();
    paceMsg = `Trend: <b>${r > 0 ? '+' : ''}${r1(r)} lb/week</b> (plan ${plan > 0 ? '+' : ''}${r1(plan)}). `;
    if (Math.abs(st.toGo) <= 1) paceMsg += 'You\'re at your goal - eat at maintenance.';
    else if (onPace) paceMsg += 'Right on track. Keep doing what you\'re doing.';
    else if (st.dir > 0) paceMsg += `Gaining slow - add ~250 kcal/day (your average is ${tg.avgCal}).`;
    else paceMsg += `Losing slow - trim ~250 kcal/day, mostly from snacks/drinks.`;
  }

  return win('Weight Tracker', `
    ${group(k === dayKey() ? 'Today\'s weigh-in' : `Weigh-in for ${esc(prettyDay(k))}`, `
      <form class="weigh-form" onsubmit="return false">
        <input id="w-in" class="inp big-num" type="number" inputmode="decimal" step="0.1" placeholder="${st.latest ?? S.profile.startWeight}" value="${logged ?? ''}">
        <span class="unit">lb</span>
        ${btn(logged != null ? 'Update' : 'Save', 'w-save', { cls: 'primary', type: 'submit' })}
      </form>
      <div class="datenav small-nav">
        <button class="btn sq" data-act="w-day" data-d="-1" aria-label="Previous day">${icon('left', 10)}</button>
        <span class="grow center">${esc(prettyDay(k))}</span>
        <button class="btn sq" data-act="w-day" data-d="1" ${k >= dayKey() ? 'disabled' : ''} aria-label="Next day">${icon('right', 10)}</button>
      </div>
      <p class="muted small">Same time daily: right after you wake up + bathroom, before food or water.</p>`)}

    <div class="stat-grid">
      <div class="stat sunken"><span>Start</span><b class="vt">${r1(st.start)}</b></div>
      <div class="stat sunken"><span>Now (7d avg)</span><b class="vt">${r1(st.now)}</b></div>
      <div class="stat sunken"><span>Goal</span><b class="vt">${r1(st.goal)}</b></div>
      <div class="stat sunken"><span>To go</span><b class="vt">${st.toGo > 0 ? '+' : ''}${r1(st.toGo)}</b></div>
    </div>
    <div class="goal-bar">${bar(Math.max(0, st.progress) * 100, 100)}<span class="muted small">${Math.round(Math.max(0, Math.min(1, st.progress)) * 100)}% of the way</span></div>
    <p class="pace">${paceMsg}${st.eta ? ` At this pace you hit ${r1(st.goal)} around <b>${months[st.eta.getMonth()]} ${st.eta.getDate()}</b>.` : ''}</p>

    ${bulkGroup()}

    ${group('Chart', `
      <div class="chips">${[[14, '2W'], [30, '1M'], [90, '3M'], [365, '1Y'], [9999, 'All']].map(([d, l]) => `<button class="btn chip ${wv.range === d ? 'on' : ''}" data-act="w-range" data-r="${d}">${l}</button>`).join('')}</div>
      <div class="chart-wrap sunken"><canvas id="w-chart" aria-label="Weight chart"></canvas><div class="chart-lbl" id="w-lbl"></div></div>
      <div class="legend"><span><i class="lg-dot"></i>weigh-in</span><span><i class="lg-line"></i>7-day avg</span><span><i class="lg-goal"></i>goal</span></div>`)}

    ${measureGroup()}

    ${group('Recent', recent.length ? recent.map(([kk, v], i) => {
      const prev = recent[i + 1];
      const d = prev ? v - prev[1] : 0;
      return `<div class="row static"><span class="row-main"><span class="row-name">${esc(prettyDay(kk))}</span></span><span class="delta ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${prev ? (d > 0 ? '+' : '') + r1(d) : ''}</span><span class="row-num">${r1(v)}</span><button class="btn sq" data-act="w-del" data-k="${kk}" aria-label="Delete">${icon('close', 8)}</button></div>`;
    }).join('') : '<p class="empty">No weigh-ins yet.</p>')}
  `, { ico: 'scale' });
}

on({
  'w-save': () => {
    const v = document.getElementById('w-in').value;
    if (logWeight(wv.date, v)) { toast(`Logged ${r1(num(v))} lb`, 'scale'); rerender(); }
  },
  'w-day': (el) => { const n = addDays(wv.date, Number(el.dataset.d)); if (n <= dayKey()) { wv.date = n; rerender(); } },
  'w-range': (el) => { wv.range = Number(el.dataset.r); rerender(); },
  'w-del': async (el) => {
    if (!(await confirmBox(`Delete weigh-in for ${esc(prettyDay(el.dataset.k))}?`))) return;
    delete S.weights[el.dataset.k]; save(); rerender();
  },
});

export function resetWeightView() { wv.date = dayKey(); }

// ---------- Pixel chart ----------
export function drawWeightChart() {
  const cv = document.getElementById('w-chart');
  if (!cv) return;
  const lbl = document.getElementById('w-lbl');
  const css = getComputedStyle(document.documentElement);
  const C = {
    bg: css.getPropertyValue('--field').trim() || '#fff',
    grid: css.getPropertyValue('--grid').trim() || '#d8d8d8',
    dot: css.getPropertyValue('--accent').trim() || '#000080',
    line: css.getPropertyValue('--good').trim() || '#008000',
    goal: '#d40000',
  };
  const PX = 3; // css px per chart pixel
  const wCss = cv.parentElement.clientWidth - 8;
  const W = Math.max(60, Math.floor(wCss / PX));
  const H = 60;
  cv.width = W; cv.height = H;
  cv.style.width = W * PX + 'px'; cv.style.height = H * PX + 'px';
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.fillStyle = C.bg; g.fillRect(0, 0, W, H);

  const today = dayKey();
  const all = weightEntries();
  const from = wv.range >= 9999 ? (all[0] ? all[0][0] : today) : addDays(today, -wv.range + 1);
  const pts = all.filter(([k]) => k >= from);
  const goal = S.profile.goalWeight;
  if (!pts.length) {
    if (lbl) lbl.innerHTML = '<span class="chart-empty">Log weigh-ins to draw your chart</span>';
    return;
  }
  const span = Math.max(1, daysBetween(from, today));
  let lo = Math.min(...pts.map((p) => p[1]), goal);
  let hi = Math.max(...pts.map((p) => p[1]), goal);
  if (hi - lo < 4) { const m = (hi + lo) / 2; lo = m - 2; hi = m + 2; }
  const padV = (hi - lo) * 0.1; lo -= padV; hi += padV;
  const X = (k) => Math.round(2 + (daysBetween(from, k) / span) * (W - 5));
  const Y = (v) => Math.round(H - 3 - ((v - lo) / (hi - lo)) * (H - 6));
  const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
  const line = (x0, y0, x1, y1, c, dash = 0) => {
    const dx = Math.abs(x1 - x0); const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1; const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy; let n = 0;
    for (;;) {
      if (!dash || (n++ % (dash * 2)) < dash) px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };
  // grid
  for (let i = 1; i < 4; i++) line(0, Math.round((H / 4) * i), W - 1, Math.round((H / 4) * i), C.grid, 1);
  // goal
  line(0, Y(goal), W - 1, Y(goal), C.goal, 2);
  // 7-day average line
  let prev = null;
  for (const [k] of pts) {
    const back = addDays(k, -6);
    const win7 = all.filter(([kk]) => kk >= back && kk <= k).map((p) => p[1]);
    const a = win7.reduce((s, v) => s + v, 0) / win7.length;
    const cur = [X(k), Y(a)];
    if (prev) line(prev[0], prev[1], cur[0], cur[1], C.line);
    prev = cur;
  }
  // dots (2x2 squares)
  for (const [k, v] of pts) {
    const x = X(k); const y = Y(v);
    g.fillStyle = C.dot; g.fillRect(x - 1, y - 1, 2, 2);
  }
  if (lbl) {
    lbl.innerHTML = `<span class="cl-hi">${r1(hi)}</span><span class="cl-lo">${r1(lo)}</span><span class="cl-from">${shortDate(from)}</span><span class="cl-to">${shortDate(today)}</span>`;
  }
}
