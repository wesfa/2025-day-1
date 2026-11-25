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
  { min: 0, color: '#3f4b7c', label: 'none' },
  { min: 0.5, color: '#f3e08c', label: '1-2' },
  { min: 3, color: '#ffc14d', label: '3-5' },
  { min: 6, color: '#ff9a3c', label: '6-9' },
  { min: 10, color: '#ff6a3c', label: '10-14' },
  { min: 15, color: '#ff3b6b', label: '15+' },
];
// light skin, outline and seams like an anatomy chart; muscles coloured by heat
const SKIN = '#d5d9e4';
const LINE = '#d5d9e4';
const SHORTS = '#2b3047';
export const heatOf = (sets) => HEAT.reduce((lvl, h, i) => (sets >= h.min ? i : lvl), 0);


function colorFor(ch, vol) {
  const up = ch.toUpperCase();
  if (up === 'H' || up === 'X') return SKIN;
  if (up === 'P') return SHORTS;
  const m = LETTER[up];
  return m ? HEAT[heatOf(vol[m] || 0)].color : SKIN;
}

// Outline pixels, seam letters (lowercase) and places where two different muscles meet are drawn light
function isLine(at, x, y) {
  const ch = at(x, y);
  if (ch !== ch.toUpperCase()) return true;
  if ([at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].includes('.')) return true;
  const other = (n) => n !== '.' && n.toUpperCase() !== ch && !'HXP'.includes(n.toUpperCase());
  return other(at(x + 1, y)) || other(at(x, y + 1));
}

// One body as SVG: runs of same-coloured pixels become one rect
export function bodySvg(view, vol, scale = 3) {
  const rows = view === 'back' ? BODY_BACK : BODY_FRONT;
  const at = (x, y) => (y >= 0 && y < BODY_H && x >= 0 && x < BODY_W ? rows[y][x] : '.');
  const colorAt = (x, y) => {
    const up = at(x, y).toUpperCase();
    if (up === 'H' || up === 'X') return SKIN;
    if (up === 'P') return SHORTS;
    return isLine(at, x, y) ? LINE : colorFor(at(x, y), vol);
  };
  let rects = '';
  for (let y = 0; y < BODY_H; y++) {
    let x = 0;
    while (x < BODY_W) {
      if (at(x, y) === '.') { x++; continue; }
      const fill = colorAt(x, y);
      let run = 1;
      while (x + run < BODY_W && at(x + run, y) !== '.' && colorAt(x + run, y) === fill) run++;
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
