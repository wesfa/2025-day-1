// Ranks & Muscles screen: your rank on every lift (scaled to your bodyweight, height and age), progress
// graphs, and the muscles you've hit lately.
import { S, getEx, currentWeight, allExercises } from './store.js';
import { TIERS, exerciseRanks, overallRank, boundaries, rankOf, scoreOf, muscleVolume, isRanked, metaFor, nextTarget } from './strength.js';
import { bodySvg, radarSvg, HEAT, heatOf } from './bodymap.js';
import { MUSCLES, EQUIPMENT } from './exlib.js';
import { esc, r0, fmt, prettyDay, parseDay } from './util.js';
import { win, group, btn, on, openModal, drawModals, rerender } from './ui.js';

const TAB_KEY = 'macros:ranks-tab';
const RANGE_KEY = 'macros:muscle-days';
const sget = (k, d) => { try { return sessionStorage.getItem(k) || d; } catch (e) { return d; } };
const sset = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } };

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mixc = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');

// Pixel shield in the tier colour. Chevrons show the division (III = 1, II = 2, I = 3); Champion gets a star.
export function badge(rank, size = 28) {
  const W = 15; const H = 17; const cx = 7;
  const col = TIERS[rank.tier].color;
  const dark = mixc(col, '#000000', 0.55); const light = mixc(col, '#ffffff', 0.45);
  const hw = (y) => (y < 10 ? 7 : Math.max(0, 7 - Math.round((y - 9) * 1.05)));
  let r = '';
  for (let y = 0; y < H; y++) {
    const w = hw(y);
    for (let x = cx - w; x <= cx + w; x++) {
      const edge = y === 0 || Math.abs(x - cx) === w || (y + 1 < H && Math.abs(x - cx) > hw(y + 1));
      const fill = edge ? dark : x < cx ? light : col;
      r += `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`;
    }
  }
  const pix = (x, y) => { r += `<rect x="${x}" y="${y}" width="1" height="1" fill="${dark}"/>`; };
  if (rank.tier === 6) {
    [[7, 4], [6, 5], [7, 5], [8, 5], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [6, 8], [7, 8], [8, 8], [5, 9], [6, 9], [8, 9], [9, 9]].forEach(([x, y]) => pix(x, y));
  } else {
    const n = ['III', 'II', 'I'].indexOf(rank.div) + 1;
    for (let i = 0; i < n; i++) {
      const y0 = 4 + i * 3;
      pix(7, y0); pix(6, y0 + 1); pix(8, y0 + 1); pix(5, y0 + 2); pix(9, y0 + 2);
    }
  }
  return `<svg class="rk-badge" viewBox="0 0 ${W} ${H}" width="${size}" height="${Math.round(size * H / W)}" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`;
}

const fmtW = (w) => (Math.round(w * 2) / 2).toString();
const setTxt = (exId, s) => (getEx(exId).type === 'body' ? (Number(s.w) > 0 ? `+${s.w} x ${s.r}` : `${s.r} reps`) : `${s.w} x ${s.r}`);
const maxTxt = (exId, m) => (getEx(exId).type === 'body' ? `${r0(m)} reps` : `${fmt(m)} lb${metaFor(exId) && metaFor(exId).db ? ' (each)' : ''}`);
const heightTxt = (inch) => `${Math.floor(inch / 12)}'${inch % 12}"`;

// ================= screen =================
export function renderRanks() {
  const tab = sget(TAB_KEY, 'ranks');
  const tabs = `<div class="rk-tabs">${[['ranks', 'Ranks'], ['muscles', 'Muscles']].map(([k, l]) => `<button class="btn ${k === tab ? 'on' : ''}" data-act="rk-tab" data-t="${k}">${l}</button>`).join('')}</div>`;
  return win('Ranks & Muscles', tabs + (tab === 'muscles' ? musclesView() : ranksView()), { ico: 'trophy', cls: 'ranks-win' });
}

function ranksView() {
  const list = exerciseRanks();
  const all = overallRank(list);
  const p = S.profile;
  const bw = currentWeight();
  const who = `${r0(bw)} lb · ${heightTxt(p.heightIn)} · age ${p.age}`;
  if (!list.length) {
    return `<p>Log a workout and every lift gets a rank - <b>Iron</b> to <b>Champion</b> - based on your estimated max compared with standards for your bodyweight, height and age.</p>
      <p class="muted small">Harder lifts have lower standards, so 35 lb lateral raises rank much higher than 35 lb curls. Different weights and reps still compare fairly through the estimated max.</p>
      ${ladder()}${unrankedGroup(list)}`;
  }
  return `
    <div class="rk-overall panel">
      ${badge(all.rank, 54)}
      <div class="rk-ov-text"><span class="muted small">Overall rank</span><b class="rk-name" style="color:${all.rank.color}">${esc(all.rank.name)}</b>
        <span class="muted small">Average of your best ${all.count} lift${all.count > 1 ? 's' : ''} · scaled to ${esc(who)}</span></div>
    </div>
    ${ladder(all.rank.tier)}
    ${group('Your lifts', list.map((x) => rankRow(x)).join(''))}
    ${unrankedGroup(list)}
    <p class="muted small">Rank = your best set's estimated 1-rep max (or reps for bodyweight moves) against standards for this exercise, adjusted to you. Each workout uses the bodyweight you'd logged by then.</p>`;
}

function ladder(cur = -1) {
  return `<div class="rk-ladder">${TIERS.map((t, i) => `<span class="${i === cur ? 'on' : ''}" style="--tc:${t.color}">${t.name}</span>`).join('')}</div>`;
}

function rankRow(x) {
  const ex = getEx(x.exId);
  const rk = x.rank;
  return `<button class="row rk-row" data-act="rk-open" data-id="${esc(x.exId)}">
    ${badge(rk, 30)}
    <span class="row-main">
      <span class="row-name">${esc(ex.name)}</span>
      <span class="row-sub">Best ${esc(setTxt(x.exId, x.best))}${ex.type === 'body' ? '' : ` · max ~${esc(maxTxt(x.exId, x.best.m))}`}</span>
      <span class="rk-bar"><i style="width:${Math.round(rk.divFrac * 100)}%;background:${rk.color}"></i></span>
      ${x.next ? `<span class="row-sub">${rk.tier === 6 ? esc(x.next.label) : `Next <b style="color:${x.next.rank.color}">${esc(x.next.rank.name)}</b>: ${esc(x.next.label)}`}</span>` : ''}
    </span>
    <span class="rk-tag" style="color:${rk.color}">${esc(rk.name)}</span>
  </button>`;
}

// Lifts in your program you haven't logged yet, with what Gold would take
function unrankedGroup(list) {
  const have = new Set(list.map((x) => x.exId));
  const ids = [...new Set(S.templates.flatMap((t) => t.items.map((i) => i.ex)))].filter((id) => isRanked(id) && !have.has(id)).slice(0, 8);
  if (!ids.length) return '';
  const bw = currentWeight();
  return group('Not ranked yet', ids.map((id) => {
    const b = boundaries(id, bw);
    const body = getEx(id).type === 'body';
    const gold = body ? `${Math.ceil(b[3])} reps` : `~${fmtW(b[3] / (1 + 5 / 30))} x 5`;
    return `<div class="row static"><span class="row-main"><span class="row-name">${esc(getEx(id).name)}</span><span class="row-sub">Gold for you: ${esc(gold)}${!body && metaFor(id).db ? ' (each dumbbell)' : ''}</span></span></div>`;
  }).join(''));
}

// ================= exercise detail =================
let det = { id: null, mode: 'rank' };
export function openRankDetail(id) { det = { id, mode: 'rank' }; openModal(renderDetail, {}); }

function renderDetail() {
  const id = det.id;
  const ex = getEx(id);
  const x = exerciseRanks().find((r) => r.exId === id);
  const bw = currentWeight();
  const b = boundaries(id, bw);
  const body = ex.type === 'body';
  const each = !body && metaFor(id) && metaFor(id).db ? ' each' : '';
  const head = x ? `<div class="rk-overall">${badge(x.rank, 54)}<div class="rk-ov-text">
      <b class="rk-name" style="color:${x.rank.color}">${esc(x.rank.name)}</b>
      <span class="small">Best ${esc(setTxt(id, x.best))} on ${esc(prettyDay(x.best.key, { short: true }))}</span>
      <span class="muted small">Est. max ~${esc(maxTxt(id, x.best.m))}${x.next && x.rank.tier < 6 ? ` · next ${esc(x.next.rank.name)}: ${esc(x.next.label)}` : ''}</span></div></div>` : '<p>Not ranked yet - log a set of this to get your rank.</p>';
  const chart = x && x.history.length ? `
    <div class="rk-tabs small-tabs">${btn('Rank', 'rk-mode', { cls: det.mode === 'rank' ? 'on' : '', data: 'data-m="rank"' })}${btn(body ? 'Best reps' : 'Est. max', 'rk-mode', { cls: det.mode === 'max' ? 'on' : '', data: 'data-m="max"' })}</div>
    <div class="rk-chart panel">${chartSvg(x.history, det.mode, id)}</div>` : '';
  const standards = b ? group(`Standards for you (${r0(bw)} lb)`, `<div class="rk-std">${TIERS.map((t, i) => {
    if (i === 0) return '';
    const v = b[i];
    const ex5 = body ? `${Math.ceil(v)} reps` : `max ${fmt(v)} lb${each} · ~${fmtW(v / (1 + 5 / 30))} x 5`;
    const on = x && x.rank.tier === i;
    return `<div class="rk-std-row ${on ? 'on' : ''}"><span style="color:${t.color}">${t.name}</span><span>${esc(ex5)}</span></div>`;
  }).join('')}</div>`) : '';
  const hist = x ? group('Recent', x.history.slice(-8).reverse().map((h) => {
    const rk = rankOf(h.score);
    return `<div class="hist-line"><span>${esc(prettyDay(h.key, { short: true }))}</span><span>${esc(setTxt(id, h))} <b style="color:${rk.color}">${esc(rk.name)}</b></span></div>`;
  }).join('')) : '';
  return win(esc(ex.name), `${head}${chart}${standards}${hist}<div class="btn-row">${btn('Close', 'modal-close', { cls: 'grow' })}</div>`, { cls: 'dialog', close: 'modal-close', ico: 'trophy' });
}

// Pixel line chart: rank (with tier bands) or estimated max over time
function chartSvg(hist, mode, id) {
  const W = 300; const H = 150; const L = 46; const B = 18; const T = 8; const Rm = 6;
  const pts = hist.map((h) => ({ t: parseDay(h.key).getTime(), v: mode === 'rank' ? h.score : h.m }));
  const t0 = pts[0].t; const t1 = Math.max(pts[pts.length - 1].t, t0 + 86400000);
  let lo; let hi;
  if (mode === 'rank') {
    lo = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.v)) - 0.2));
    hi = Math.min(7, Math.ceil(Math.max(...pts.map((p) => p.v)) + 0.2));
    if (hi - lo < 2) hi = Math.min(7, lo + 2);
  } else {
    const vs = pts.map((p) => p.v);
    lo = Math.min(...vs) * 0.92; hi = Math.max(...vs) * 1.06;
    if (hi - lo < 10) { lo -= 5; hi += 5; }
  }
  const X = (t) => L + ((t - t0) / (t1 - t0)) * (W - L - Rm);
  const Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  let g = '';
  if (mode === 'rank') {
    for (let k = Math.floor(lo); k < Math.ceil(hi); k++) {
      const y1 = Y(Math.min(hi, k + 1)); const y2 = Y(Math.max(lo, k));
      g += `<rect x="${L}" y="${y1}" width="${W - L - Rm}" height="${y2 - y1}" fill="${TIERS[Math.min(6, k)].color}" opacity="0.14"/>`;
      g += `<text x="${L - 3}" y="${(y1 + y2) / 2 + 3}" class="ch-lbl" text-anchor="end" fill="${TIERS[Math.min(6, k)].color}">${TIERS[Math.min(6, k)].name}</text>`;
    }
  } else {
    for (const v of [lo, (lo + hi) / 2, hi]) g += `<text x="${L - 3}" y="${Y(v) + 3}" class="ch-lbl" text-anchor="end">${r0(v)}</text><line x1="${L}" x2="${W - Rm}" y1="${Y(v)}" y2="${Y(v)}" class="ch-grid"/>`;
  }
  const line = pts.map((p) => `${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ');
  const dots = pts.map((p) => {
    const c = mode === 'rank' ? TIERS[Math.min(6, Math.floor(p.v))].color : 'var(--accent)';
    return `<rect x="${(X(p.t) - 2.5).toFixed(1)}" y="${(Y(p.v) - 2.5).toFixed(1)}" width="5" height="5" fill="${c}"/>`;
  }).join('');
  const d0 = prettyDay(hist[0].key, { short: true }); const d1 = prettyDay(hist[hist.length - 1].key, { short: true });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" class="rk-chart-svg" shape-rendering="crispEdges">${g}
    <polyline points="${line}" class="ch-line"/>${dots}
    <text x="${L}" y="${H - 4}" class="ch-lbl">${esc(d0)}</text><text x="${W - Rm}" y="${H - 4}" class="ch-lbl" text-anchor="end">${esc(d1)}</text></svg>
    ${pts.length < 2 ? '<p class="muted small">Log this lift again to see the line.</p>' : ''}`;
}

// ================= muscles =================
function musclesView() {
  const days = Number(sget(RANGE_KEY, '7')) || 7;
  const mv = muscleVolume(days);
  const vol = mv.vol;
  const sorted = Object.entries(vol).sort((a, b) => b[1] - a[1]);
  const top = Math.max(1, ...Object.values(vol));
  return `
    <div class="rk-tabs small-tabs">${[7, 14, 30].map((d) => btn(`Last ${d} days`, 'mu-range', { cls: d === days ? 'on' : '', data: `data-d="${d}"` })).join('')}</div>
    ${group('Muscle heatmap', `
      <div class="mu-bodies">
        <figure>${bodySvg('front', vol)}<figcaption>Front</figcaption></figure>
        <figure>${bodySvg('back', vol)}<figcaption>Back</figcaption></figure>
      </div>
      <div class="mu-legend">${HEAT.map((h) => `<span><i style="background:${h.color}"></i>${h.label}</span>`).join('')}<span class="muted">sets</span></div>
      <p class="muted small">${mv.sets ? `${mv.sets} sets checked off. Main muscles count a full set, helpers half.` : 'No sets checked off in this time yet.'}</p>`)}
    ${group('Body regions worked', `<div class="mu-radar">${radarSvg(mv.regions)}</div>`)}
    ${group('Sets per muscle', sorted.map(([k, v]) => `
      <div class="mu-row ${v ? '' : 'zero'}"><span>${esc(MUSCLES[k].name)}</span>
        <span class="mu-bar"><i style="width:${Math.round((v / top) * 100)}%;background:${HEAT[heatOf(v)].color}"></i></span>
        <b class="vt">${Math.round(v * 10) / 10}</b></div>`).join(''))}`;
}

on({
  'rk-tab': (el) => { sset(TAB_KEY, el.dataset.t); rerender(); window.scrollTo(0, 0); },
  'mu-range': (el) => { sset(RANGE_KEY, el.dataset.d); rerender(); },
  'rk-open': (el) => openRankDetail(el.dataset.id),
  'rk-mode': (el) => { det.mode = el.dataset.m; drawModals(); },
});

// For the exercise picker / workout: a small badge + name for an exercise you've ranked
export function rankFor(id, list) {
  const x = (list || exerciseRanks()).find((r) => r.exId === id);
  return x || null;
}
export { allExercises, EQUIPMENT, scoreOf, nextTarget };
