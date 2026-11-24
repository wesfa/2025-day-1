// GRIDLOCK - an original 8x8 block-puzzle game drawn in the Macros pixel style.
// Drag pieces from the tray onto the grid; full rows and columns clear. Three pieces per round;
// the game ends when none of the pieces left in the tray fit. Progress is saved in the app data.
import { S, save } from './store.js';
import { win, btn, on, msgBox, confirmBox, beep, unlockAudio } from './ui.js';
import { icon } from './icons.js';
import { fmt, buzz } from './util.js';

const N = 8;

// ---------- pieces (weight, rows) ----------
const RAW = [
  [3, ['#']],
  [4, ['##']], [4, ['#', '#']],
  [4, ['###']], [4, ['#', '#', '#']],
  [3, ['####']], [3, ['#', '#', '#', '#']],
  [2, ['#####']], [2, ['#', '#', '#', '#', '#']],
  [4, ['##', '##']],
  [1.5, ['###', '###', '###']],
  [2, ['###', '###']], [2, ['##', '##', '##']],
  [3, ['##', '#.']], [3, ['##', '.#']], [3, ['#.', '##']], [3, ['.#', '##']],
  [2, ['#..', '###']], [2, ['..#', '###']], [2, ['###', '#..']], [2, ['###', '..#']],
  [2, ['##', '#.', '#.']], [2, ['##', '.#', '.#']], [2, ['#.', '#.', '##']], [2, ['.#', '.#', '##']],
  [2, ['###', '.#.']], [2, ['.#.', '###']], [2, ['#.', '##', '#.']], [2, ['.#', '##', '.#']],
  [2, ['##.', '.##']], [2, ['.##', '##.']], [2, ['#.', '##', '.#']], [2, ['.#', '##', '#.']],
  [1, ['###', '#..', '#..']], [1, ['###', '..#', '..#']], [1, ['#..', '#..', '###']], [1, ['..#', '..#', '###']],
];
export const SHAPES = RAW.map(([w, rows]) => {
  const cells = [];
  rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') cells.push([r, c]); }));
  return { w, cells, h: rows.length, wd: rows[0].length };
});
const TOTAL_W = SHAPES.reduce((a, s) => a + s.w, 0);

// Island-scheme block colors: [base, light edge, dark edge]
const COLORS = [
  ['#2f7fe8', '#8cc2ff', '#16408a'], // ocean
  ['#22bfe0', '#9eeeff', '#0d6a85'], // lagoon
  ['#3cb043', '#9be59f', '#1b6020'], // palm
  ['#f0c22e', '#fff0a6', '#9a7409'], // sand
  ['#f2784b', '#ffc2a8', '#9a3a14'], // sunset
  ['#e2445c', '#ff9fae', '#86152a'], // coral
  ['#9b59d0', '#d6b2f3', '#552780'], // dusk
];
const LINE_PTS = [0, 20, 50, 90, 140, 200, 270];
const WORDS = ['', '', 'Nice!', 'Great!', 'Awesome!', 'Unreal!', 'Legendary!'];

// ---------- pure game logic (exported for tests) ----------
export function fresh(best = 0) {
  return { board: Array(N * N).fill(0), tray: [], score: 0, best, combo: 0, miss: 0, over: false, games: 0 };
}
export function canPlaceAt(board, sh, r, c) {
  for (const [dr, dc] of sh.cells) {
    const rr = r + dr, cc = c + dc;
    if (rr < 0 || cc < 0 || rr >= N || cc >= N || board[rr * N + cc]) return false;
  }
  return true;
}
export function fitsAnywhere(board, sh) {
  for (let r = 0; r <= N - sh.h; r++) for (let c = 0; c <= N - sh.wd; c++) if (canPlaceAt(board, sh, r, c)) return true;
  return false;
}
function pick() {
  let x = Math.random() * TOTAL_W;
  let s = 0;
  while (x >= SHAPES[s].w) { x -= SHAPES[s].w; s++; }
  return { s, c: Math.floor(Math.random() * COLORS.length) };
}
export function deal(g) {
  // Re-roll a few times so at least one piece fits; a hopeless board still ends the game.
  for (let tries = 0; tries < 40; tries++) {
    const t = [pick(), pick(), pick()];
    if (t.some((p) => fitsAnywhere(g.board, SHAPES[p.s]))) { g.tray = t; return; }
  }
  g.tray = [pick(), pick(), pick()];
}
// Which rows / columns would be full if `sh` went at (r, c)
function wouldClear(board, sh, r, c) {
  const b = board.slice();
  for (const [dr, dc] of sh.cells) b[(r + dr) * N + c + dc] = 1;
  const rows = [], cols = [];
  for (let i = 0; i < N; i++) {
    let rf = true, cf = true;
    for (let j = 0; j < N; j++) { if (!b[i * N + j]) rf = false; if (!b[j * N + i]) cf = false; }
    if (rf) rows.push(i);
    if (cf) cols.push(i);
  }
  return { rows, cols };
}
export function place(g, slot, r, c) {
  const p = g.tray[slot];
  const sh = SHAPES[p.s];
  if (!canPlaceAt(g.board, sh, r, c)) return null;
  const { rows, cols } = wouldClear(g.board, sh, r, c);
  for (const [dr, dc] of sh.cells) g.board[(r + dr) * N + c + dc] = p.c + 1;
  g.tray[slot] = null;
  const cleared = new Map();
  for (const rr of rows) for (let j = 0; j < N; j++) cleared.set(rr * N + j, g.board[rr * N + j]);
  for (const cc of cols) for (let j = 0; j < N; j++) cleared.set(j * N + cc, g.board[j * N + cc]);
  const lines = rows.length + cols.length;
  let clearPts = 0;
  let perfect = false;
  if (lines) {
    g.combo += 1;
    g.miss = 0;
    clearPts = LINE_PTS[Math.min(lines, LINE_PTS.length - 1)] * g.combo;
    for (const idx of cleared.keys()) g.board[idx] = 0;
    if (g.board.every((v) => !v)) { perfect = true; clearPts += 300; }
  } else {
    g.miss += 1;
    if (g.miss >= 3) g.combo = 0; // a full round without clearing ends the combo
  }
  const gained = sh.cells.length + clearPts;
  g.score += gained;
  const newBest = g.score > g.best;
  if (newBest) g.best = g.score;
  if (g.tray.every((t) => !t)) deal(g);
  g.over = !g.tray.some((t) => t && fitsAnywhere(g.board, SHAPES[t.s]));
  return { lines, rows, cols, cleared, clearPts, gained, perfect, combo: g.combo, newBest };
}

// ---------- state ----------
function G() {
  if (!S.game || !Array.isArray(S.game.board) || S.game.board.length !== N * N) S.game = fresh((S.game && S.game.best) || 0);
  if (!S.game.tray || !S.game.tray.length) deal(S.game);
  return S.game;
}

// ---------- screen ----------
export function renderGame() {
  const g = G();
  return win('GRIDLOCK', `
    <div class="gl-head">
      <div class="gl-stat sunken"><span>Score</span><b class="vt" id="gl-score">${fmt(g.score)}</b></div>
      <div class="gl-combo" id="gl-combo">${g.combo > 1 ? `Combo x${g.combo}` : ''}</div>
      <div class="gl-stat sunken right"><span>${icon('trophy', 12)} Best</span><b class="vt" id="gl-best">${fmt(g.best)}</b></div>
    </div>
    <div class="gl-wrap sunken"><canvas id="gl-canvas" aria-label="Gridlock board. Drag pieces from the tray onto the grid."></canvas></div>
    <p class="muted small gl-help">Drag a piece onto the grid. Fill a whole row or column to clear it. Keep clearing for combos.</p>
    <div class="btn-row">${btn('New game', 'gl-new', { ico: 'blocks' })}${btn(S.settings.sound ? 'Sound on' : 'Sound off', 'gl-sound')}</div>
  `, { ico: 'blocks', cls: 'game-win' });
}

let cv = null;
let ctx = null;
let L = null;
let raf = 0;
const fx = { drag: null, flashes: [], parts: [], pops: [], shake: 0 };

export function mountGame() {
  cv = document.getElementById('gl-canvas');
  if (!cv) return;
  ctx = cv.getContext('2d');
  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerup', onUp);
  cv.addEventListener('pointercancel', onCancel);
  fx.drag = null;
  layout();
  draw();
  const g = G();
  if (g.over) setTimeout(gameOver, 300);
}
window.addEventListener('resize', () => { if (cv && cv.isConnected) { layout(); draw(); } });

function layout() {
  const avail = cv.parentElement.clientWidth - 8;
  const W = Math.max(240, Math.min(avail, 440));
  const cell = Math.floor((W - 8) / N);
  const bw = cell * N;
  const trayH = Math.round(cell * 3.3);
  const H = 4 + bw + 10 + trayH;
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  cv.style.width = W + 'px';
  cv.style.height = H + 'px';
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  L = { W, H, cell, bw, bx: Math.floor((W - bw) / 2), by: 4, ty: 4 + bw + 10, trayH, slotW: W / 3, ts: 0.5 };
}

// ---------- drawing ----------
function block(x, y, s, ci, alpha = 1) {
  const [base, light, dark] = COLORS[((ci % COLORS.length) + COLORS.length) % COLORS.length] || COLORS[0];
  const e = Math.max(2, Math.round(s * 0.13));
  x = Math.round(x); y = Math.round(y); s = Math.round(s);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = dark; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = light; ctx.fillRect(x, y, s - e, s - e);
  ctx.fillStyle = base; ctx.fillRect(x + e, y + e, s - 2 * e, s - 2 * e);
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(x + e, y + e, e, e);
  ctx.globalAlpha = 1;
}

function boardCell(r, c) { return [L.bx + c * L.cell, L.by + r * L.cell]; }

function dragTarget() {
  const d = fx.drag;
  if (!d) return null;
  const g = G();
  const p = g.tray[d.slot];
  if (!p) return null;
  const sh = SHAPES[p.s];
  const pw = sh.wd * L.cell;
  const ph = sh.h * L.cell;
  const lift = d.touch ? L.cell * 1.7 : L.cell * 0.4;
  const tlx = d.x - pw / 2;
  const tly = d.y - lift - ph;
  const c = Math.round((tlx - L.bx) / L.cell);
  const r = Math.round((tly - L.by) / L.cell);
  const ok = canPlaceAt(g.board, sh, r, c);
  return { sh, p, r, c, ok, tlx, tly, lines: ok ? wouldClear(g.board, sh, r, c) : null };
}

function draw() {
  if (!ctx || !L) return;
  const g = G();
  const now = performance.now();
  ctx.save();
  if (fx.shake > now) ctx.translate(Math.round((Math.random() - 0.5) * 4), Math.round((Math.random() - 0.5) * 4));
  // background + board well
  ctx.fillStyle = '#c0c0c0'; ctx.fillRect(-4, -4, L.W + 8, L.H + 8);
  ctx.fillStyle = '#0b1f45'; ctx.fillRect(L.bx - 2, L.by - 2, L.bw + 4, L.bw + 4);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const [x, y] = boardCell(r, c);
    const v = g.board[r * N + c];
    if (v) block(x, y, L.cell, v - 1);
    else {
      ctx.fillStyle = (r + c) % 2 ? '#142d60' : '#16325f';
      ctx.fillRect(x + 1, y + 1, L.cell - 2, L.cell - 2);
      ctx.fillStyle = '#0e2550'; ctx.fillRect(x + 1, y + L.cell - 3, L.cell - 2, 2);
    }
  }
  // ghost + lines that would clear
  const t = dragTarget();
  if (t && t.ok) {
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    for (const rr of t.lines.rows) ctx.fillRect(L.bx, L.by + rr * L.cell, L.bw, L.cell);
    for (const cc of t.lines.cols) ctx.fillRect(L.bx + cc * L.cell, L.by, L.cell, L.bw);
    for (const [dr, dc] of t.sh.cells) { const [x, y] = boardCell(t.r + dr, t.c + dc); block(x, y, L.cell, t.p.c, 0.45); }
  }
  // clear flashes
  fx.flashes = fx.flashes.filter((f) => now - f.t0 < 320);
  for (const f of fx.flashes) {
    const k = (now - f.t0) / 320;
    for (const [idx, v] of f.cells) {
      const r = Math.floor(idx / N), c = idx % N;
      const [x, y] = boardCell(r, c);
      const inset = Math.round(L.cell * 0.5 * k);
      if (v) block(x + inset / 2, y + inset / 2, L.cell - inset, v - 1, 1 - k);
      ctx.fillStyle = `rgba(255,255,255,${0.85 * (1 - k)})`;
      ctx.fillRect(x + inset / 2, y + inset / 2, L.cell - inset, L.cell - inset);
    }
  }
  // tray
  ctx.fillStyle = '#b4b4b4'; ctx.fillRect(0, L.ty - 4, L.W, L.trayH + 4);
  ctx.fillStyle = '#808080'; ctx.fillRect(0, L.ty - 4, L.W, 2);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, L.ty - 2, L.W, 2);
  g.tray.forEach((p, i) => {
    if (!p || (fx.drag && fx.drag.slot === i)) return;
    const sh = SHAPES[p.s];
    // as big as fits in its third of the tray (up to 65% of board size)
    const s = Math.floor(Math.min(L.cell * 0.65, (L.slotW * 0.88) / sh.wd, (L.trayH * 0.86) / sh.h));
    const ox = i * L.slotW + (L.slotW - sh.wd * s) / 2;
    const oy = L.ty + (L.trayH - sh.h * s) / 2;
    const fits = fitsAnywhere(g.board, sh);
    for (const [dr, dc] of sh.cells) block(ox + dc * s, oy + dr * s, s, p.c, fits ? 1 : 0.3);
  });
  // particles
  fx.parts = fx.parts.filter((pt) => now - pt.t0 < pt.life);
  for (const pt of fx.parts) {
    const k = (now - pt.t0) / 1000;
    const x = pt.x + pt.vx * k;
    const y = pt.y + pt.vy * k + 600 * k * k;
    ctx.globalAlpha = 1 - (now - pt.t0) / pt.life;
    ctx.fillStyle = pt.col; ctx.fillRect(Math.round(x), Math.round(y), pt.s, pt.s);
  }
  ctx.globalAlpha = 1;
  // dragged piece
  if (t) for (const [dr, dc] of t.sh.cells) block(t.tlx + dc * L.cell, t.tly + dr * L.cell, L.cell, t.p.c, 0.95);
  // pop-up text
  fx.pops = fx.pops.filter((p) => now - p.t0 < 900);
  for (const p of fx.pops) {
    const k = (now - p.t0) / 900;
    ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    ctx.font = `${p.size}px VT323, monospace`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = '#000';
    const y = p.y - 40 * k;
    ctx.strokeText(p.text, p.x, y); ctx.fillStyle = p.col; ctx.fillText(p.text, p.x, y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function animating() {
  const now = performance.now();
  return fx.drag || fx.flashes.length || fx.parts.length || fx.pops.length || fx.shake > now;
}
function loop() {
  draw();
  raf = animating() && cv && cv.isConnected ? requestAnimationFrame(loop) : 0;
}
function kick() { if (!raf) raf = requestAnimationFrame(loop); }

// ---------- input ----------
function pos(e) {
  const r = cv.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
function onDown(e) {
  unlockAudio();
  const g = G();
  if (g.over) return;
  const { x, y } = pos(e);
  if (y < L.ty - 6) return;
  const slot = Math.min(2, Math.floor(x / L.slotW));
  if (!g.tray[slot]) return;
  fx.drag = { slot, x, y, touch: e.pointerType !== 'mouse' };
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  e.preventDefault();
  buzz(8);
  kick();
}
function onMove(e) {
  if (!fx.drag) return;
  const { x, y } = pos(e);
  fx.drag.x = x; fx.drag.y = y;
  e.preventDefault();
  kick();
}
function onCancel() { fx.drag = null; kick(); }
function onUp(e) {
  if (!fx.drag) return;
  const t = dragTarget();
  const slot = fx.drag.slot;
  fx.drag = null;
  if (t && t.ok) commit(slot, t.r, t.c);
  else kick();
  e.preventDefault();
}

function commit(slot, r, c) {
  const g = G();
  const placed = SHAPES[g.tray[slot].s];
  const res = place(g, slot, r, c);
  if (!res) { kick(); return; }
  const now = performance.now();
  if (res.lines) {
    fx.flashes.push({ t0: now, cells: [...res.cleared.entries()] });
    for (const [idx, v] of res.cleared) {
      const [x, y] = boardCell(Math.floor(idx / N), idx % N);
      const col = COLORS[(v || 1) - 1][0];
      for (let k = 0; k < 2; k++) {
        fx.parts.push({ t0: now, life: 520 + Math.random() * 300, x: x + L.cell / 2, y: y + L.cell / 2, vx: (Math.random() - 0.5) * 320, vy: -120 - Math.random() * 220, s: Math.max(3, Math.round(L.cell / 6)), col });
      }
    }
    const cx = L.bx + (c + placed.wd / 2) * L.cell;
    const cy = L.by + r * L.cell;
    const midX = Math.min(L.W - 60, Math.max(60, cx));
    fx.pops.push({ t0: now, text: `+${res.gained}`, x: midX, y: Math.max(30, cy), size: Math.round(L.cell * 0.9), col: '#fff3a0' });
    const word = res.perfect ? 'Board clear!' : WORDS[Math.min(res.lines, WORDS.length - 1)];
    if (word) fx.pops.push({ t0: now + 60, text: word, x: L.W / 2, y: L.by + L.bw / 2, size: Math.round(L.cell * 1.15), col: '#8cf0ff' });
    if (res.combo > 1) fx.pops.push({ t0: now + 120, text: `Combo x${res.combo}`, x: L.W / 2, y: L.by + L.bw / 2 + L.cell, size: Math.round(L.cell * 0.85), col: '#ffb070' });
    if (res.lines >= 3 || res.perfect) fx.shake = now + 220;
    if (S.settings.sound) beep(res.lines > 1 ? [660, 880, 990, 1320] : [660, 990], 0.07);
    buzz(res.lines > 1 ? [20, 30, 40] : 25);
  } else {
    if (S.settings.sound) beep([330], 0.04);
    buzz(10);
  }
  const sEl = document.getElementById('gl-score'); if (sEl) sEl.textContent = fmt(g.score);
  const bEl = document.getElementById('gl-best'); if (bEl) bEl.textContent = fmt(g.best);
  const cEl = document.getElementById('gl-combo'); if (cEl) cEl.textContent = g.combo > 1 ? `Combo x${g.combo}` : '';
  save();
  kick();
  if (g.over) setTimeout(gameOver, 900);
}

let overShown = false;
async function gameOver() {
  const g = G();
  if (!g.over || overShown || !cv || !cv.isConnected) return;
  overShown = true;
  if (S.settings.sound) beep([523, 440, 349, 262], 0.12);
  const best = g.score >= g.best && g.score > 0;
  await msgBox({
    title: 'Game Over', ico: 'blocks',
    text: `<p>No room left for any piece.</p><p>Score <b>${fmt(g.score)}</b>${best ? ' - <b>new best!</b>' : ` · Best <b>${fmt(g.best)}</b>`}</p>`,
    buttons: [['Play again', true]],
  });
  overShown = false;
  newGame();
}

function newGame() {
  const old = G();
  S.game = fresh(old.best);
  S.game.games = (old.games || 0) + 1;
  deal(S.game);
  save();
  fx.flashes = []; fx.parts = []; fx.pops = [];
  const sEl = document.getElementById('gl-score'); if (sEl) sEl.textContent = '0';
  const cEl = document.getElementById('gl-combo'); if (cEl) cEl.textContent = '';
  kick();
}

on({
  'gl-new': async () => {
    const g = G();
    if (g.score > 0 && !g.over && !(await confirmBox('Start a new game? This one will end.', 'New game', 'New game'))) return;
    newGame();
  },
  'gl-sound': (el) => {
    S.settings.sound = !S.settings.sound;
    save();
    el.textContent = S.settings.sound ? 'Sound on' : 'Sound off';
  },
});
