// Pixel muscle map (front + back) coloured by how many sets each muscle got, and the
// "body regions worked" hexagon. Both are plain SVG so they stay crisp and pixel-y.
import { BODY_FRONT, BODY_BACK, BODY_W, BODY_H } from './body-grid.js';
import { MUSCLES, REGIONS } from './exlib.js';

const LETTER = {
  C: 'chest', S: 'delts', R: 'reardelts', T: 'traps', N: 'neck', B: 'biceps', I: 'triceps', F: 'forearms',
  A: 'abs', O: 'obliques', W: 'lats', U: 'upperback', E: 'lowerback', G: 'glutes', Q: 'quads', M: 'hams',
  D: 'adductors', L: 'calves',
};
// sets per week -> heat level
export const HEAT = [
  { min: 0, color: '#7c8299', label: 'none' },
  { min: 0.5, color: '#f3e08c', label: '1-2' },
  { min: 3, color: '#ffc14d', label: '3-5' },
  { min: 6, color: '#ff9a3c', label: '6-9' },
  { min: 10, color: '#ff6a3c', label: '10-14' },
  { min: 15, color: '#ff3b6b', label: '15+' },
];
const SKIN = '#5b6076';
const SHORTS = '#363b52';
export const heatOf = (sets) => HEAT.reduce((lvl, h, i) => (sets >= h.min ? i : lvl), 0);

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const shade = (c, k) => '#' + hex(c).map((v) => Math.round(v * k).toString(16).padStart(2, '0')).join('');

function colorFor(ch, vol) {
  const up = ch.toUpperCase();
  if (up === 'H' || up === 'X') return SKIN;
  if (up === 'P') return SHORTS;
  const m = LETTER[up];
  return m ? HEAT[heatOf(vol[m] || 0)].color : SKIN;
}

// One body as SVG: runs of same-coloured pixels become one rect. Seams between muscles and the outline
// are drawn a shade darker so the shapes read.
export function bodySvg(view, vol, scale = 3) {
  const rows = view === 'back' ? BODY_BACK : BODY_FRONT;
  const at = (x, y) => (y >= 0 && y < BODY_H && x >= 0 && x < BODY_W ? rows[y][x] : '.');
  let rects = '';
  for (let y = 0; y < BODY_H; y++) {
    let x = 0;
    while (x < BODY_W) {
      const ch = at(x, y);
      if (ch === '.') { x++; continue; }
      const col = (xx) => {
        const c = at(xx, y);
        let fill = colorFor(c, vol);
        const edge = at(xx, y - 1) === '.' || at(xx, y + 1) === '.' || at(xx - 1, y) === '.' || at(xx + 1, y) === '.';
        const seam = at(xx + 1, y) !== c && at(xx + 1, y) !== '.' || at(xx, y + 1) !== c && at(xx, y + 1) !== '.';
        if (edge) fill = shade(fill, 0.7); else if (seam) fill = shade(fill, 0.78);
        return fill;
      };
      const fill = col(x);
      let run = 1;
      while (x + run < BODY_W && at(x + run, y) !== '.' && col(x + run) === fill) run++;
      rects += `<rect x="${x}" y="${y}" width="${run}" height="1" fill="${fill}"/>`;
      x += run;
    }
  }
  const label = view === 'back' ? 'Back' : 'Front';
  return `<svg class="body-svg" viewBox="0 0 ${BODY_W} ${BODY_H}" width="${BODY_W * scale}" height="${BODY_H * scale}" shape-rendering="crispEdges" role="img" aria-label="${label} muscle map">${rects}</svg>`;
}

// Hexagon chart: Back, Chest, Core, Arms, Shoulders, Legs (clockwise from top-left)
export function radarSvg(regions, size = 260) {
  const order = ['Back', 'Chest', 'Core', 'Arms', 'Shoulders', 'Legs'];
  const angles = [-120, -60, 0, 60, 120, 180].map((d) => (d * Math.PI) / 180);
  const VW = size + 70;  // extra width so the side labels fit
  const c = size / 2;
  const cx = VW / 2;
  const R = size * 0.34;
  const max = Math.max(12, ...order.map((k) => regions[k] || 0));
  const pt = (a, r) => `${(cx + Math.cos(a) * r).toFixed(1)},${(c + Math.sin(a) * r).toFixed(1)}`;
  let rings = '';
  for (let i = 1; i <= 5; i++) {
    rings += `<polygon points="${angles.map((a) => pt(a, (R * i) / 5)).join(' ')}" class="rd-ring${i === 5 ? ' out' : ''}"/>`;
  }
  const spokes = angles.map((a) => `<line x1="${cx}" y1="${c}" x2="${pt(a, R).split(',')[0]}" y2="${pt(a, R).split(',')[1]}" class="rd-spoke"/>`).join('');
  const shape = `<polygon points="${order.map((k, i) => pt(angles[i], R * Math.min(1, (regions[k] || 0) / max))).join(' ')}" class="rd-shape"/>`;
  const labels = order.map((k, i) => {
    const [x, y] = pt(angles[i], R + 26).split(',').map(Number);
    return `<text x="${x}" y="${y}" class="rd-label" text-anchor="middle" dominant-baseline="middle">${k}<tspan x="${x}" dy="14" class="rd-val">${Math.round((regions[k] || 0) * 10) / 10} sets</tspan></text>`;
  }).join('');
  return `<svg class="radar-svg" viewBox="0 0 ${VW} ${size}" width="100%" style="max-width:${VW + 20}px" role="img" aria-label="Body regions worked">${rings}${spokes}${shape}${labels}</svg>`;
}

export { MUSCLES, REGIONS };
