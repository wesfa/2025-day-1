// Fast food mode: pick where you're eating and the app builds the order that best fits what you have left today -
// protein first, calories near your meal budget, fat and sodium kept in check - and logs it in one tap.
// Menu numbers are approximate published nutrition (restaurants change recipes); fiber/potassium are estimates.
import { S, save, totals, targets, addEntry, MEALS } from './store.js';
import { dayKey, esc, r0, fmt, buzz, HAPTIC } from './util.js';
import { win, btn, select, on, openModal, closeAllModals, drawModals, toast, rerender } from './ui.js';
import { openFoodDetail, mealForNow } from './food.js';

// [name, serving, kcal, protein, carbs, fat, fiber, sodium, potassium, kind, breakfast-only?]
// kind: main (up to 2), small (up to 3 - tacos, small burgers), side (up to 2), drink (1), sauce (menu only)
const MENUS = {
  'Chick-fil-A': [
    ['Chicken Sandwich', '1 sandwich', 420, 29, 41, 18, 1, 1460, 400, 'main'],
    ['Spicy Chicken Sandwich', '1 sandwich', 450, 28, 45, 19, 3, 1620, 420, 'main'],
    ['Grilled Chicken Sandwich', '1 sandwich', 390, 28, 44, 12, 4, 765, 500, 'main'],
    ['Chick-n-Strips', '3 count', 310, 29, 16, 14, 1, 1000, 350, 'main'],
    ['Nuggets', '8 count', 250, 27, 11, 11, 0, 1210, 300, 'main'],
    ['Nuggets', '12 count', 380, 40, 16, 17, 0, 1820, 450, 'main'],
    ['Grilled Nuggets', '8 count', 130, 25, 1, 3, 0, 440, 330, 'small'],
    ['Grilled Nuggets', '12 count', 200, 38, 2, 4.5, 0, 660, 500, 'main'],
    ['Cool Wrap', '1 wrap', 350, 42, 29, 13, 15, 960, 600, 'main'],
    ['Egg White Grill', '1 sandwich', 300, 27, 29, 8, 1, 990, 350, 'main', 'b'],
    ['Chicken Biscuit', '1 biscuit', 460, 19, 45, 23, 2, 1510, 250, 'main', 'b'],
    ['Waffle Fries', 'medium', 420, 5, 45, 24, 5, 240, 650, 'side'],
    ['Mac & Cheese', 'medium', 450, 20, 29, 29, 1, 1200, 300, 'side'],
    ['Fruit Cup', 'medium', 70, 1, 17, 0, 2, 0, 200, 'side'],
    ['Greek Yogurt Parfait', '1 parfait', 270, 13, 36, 9, 1, 85, 250, 'side'],
    ['Chocolate Milk', '1 jug', 200, 9, 28, 5, 0, 220, 430, 'drink'],
    ['Chick-fil-A Sauce', '1 packet', 140, 0, 6, 13, 0, 170, 0, 'sauce'],
  ],
  "McDonald's": [
    ['Big Mac', '1 burger', 590, 25, 46, 34, 3, 1050, 400, 'main'],
    ['Quarter Pounder w/ Cheese', '1 burger', 520, 30, 42, 26, 2, 1140, 480, 'main'],
    ['Double Quarter Pounder w/ Cheese', '1 burger', 740, 48, 43, 42, 2, 1360, 680, 'main'],
    ['McDouble', '1 burger', 400, 22, 33, 20, 2, 920, 350, 'main'],
    ['Cheeseburger', '1 burger', 300, 15, 32, 13, 2, 720, 230, 'small'],
    ['McChicken', '1 sandwich', 400, 14, 39, 21, 2, 560, 250, 'main'],
    ['McCrispy', '1 sandwich', 470, 26, 46, 20, 2, 1140, 400, 'main'],
    ['McNuggets', '10 piece', 410, 23, 25, 24, 0, 840, 380, 'main'],
    ['McNuggets', '20 piece', 830, 46, 51, 49, 0, 1680, 760, 'main'],
    ['Egg McMuffin', '1 sandwich', 310, 17, 30, 13, 2, 770, 230, 'main', 'b'],
    ['Sausage McMuffin w/ Egg', '1 sandwich', 480, 21, 30, 31, 2, 830, 280, 'main', 'b'],
    ['Fries', 'medium', 320, 5, 43, 15, 4, 260, 600, 'side'],
    ['Fries', 'large', 480, 7, 65, 23, 6, 400, 900, 'side'],
    ['Apple Slices', '1 bag', 15, 0, 4, 0, 1, 0, 70, 'side'],
    ['1% Milk', '1 jug', 100, 8, 12, 2.5, 0, 125, 370, 'drink'],
  ],
  Chipotle: [
    ['Chicken Bowl (rice, black beans, fajita veg, salsa)', '1 bowl', 570, 45, 72, 13, 10, 1300, 1000, 'main'],
    ['Double Chicken Bowl (rice, beans, salsa, cheese)', '1 bowl', 835, 82, 67, 28, 9, 1900, 1300, 'main'],
    ['Steak Bowl (rice, black beans, fajita veg, salsa)', '1 bowl', 535, 34, 72, 12, 10, 1450, 1000, 'main'],
    ['Chicken Burrito (rice, beans, cheese, salsa)', '1 burrito', 975, 58, 117, 30, 13, 2210, 1100, 'main'],
    ['Chicken Salad (beans, fajita veg, salsa)', '1 salad', 360, 41, 32, 9, 11, 1100, 900, 'main'],
    ['Chips', '1 bag', 540, 7, 73, 25, 7, 390, 300, 'side'],
    ['Guacamole', '1 side', 230, 2, 8, 22, 6, 370, 450, 'side'],
  ],
  'Taco Bell': [
    ['Crunchy Taco', '1 taco', 170, 8, 13, 9, 3, 310, 170, 'small'],
    ['Soft Taco', '1 taco', 180, 9, 18, 9, 2, 500, 170, 'small'],
    ['Chicken Soft Taco', '1 taco', 160, 12, 15, 5, 1, 450, 160, 'small'],
    ['Chicken Quesadilla', '1 quesadilla', 510, 27, 37, 26, 3, 1250, 350, 'main'],
    ['Chicken Power Bowl', '1 bowl', 460, 26, 46, 19, 7, 1200, 650, 'main'],
    ['Burrito Supreme', '1 burrito', 390, 16, 51, 14, 7, 1110, 450, 'main'],
    ['Bean Burrito', '1 burrito', 350, 13, 54, 9, 9, 1000, 450, 'main'],
    ['Crunchwrap Supreme', '1 wrap', 530, 16, 71, 21, 6, 1200, 400, 'main'],
    ['Cheesy Gordita Crunch', '1 item', 500, 20, 41, 28, 4, 860, 300, 'main'],
    ['Nachos BellGrande', '1 order', 740, 16, 82, 38, 12, 1050, 600, 'main'],
  ],
  "Wendy's": [
    ["Dave's Single", '1 burger', 590, 29, 39, 37, 2, 1250, 500, 'main'],
    ["Dave's Double", '1 burger', 860, 49, 40, 55, 2, 1580, 750, 'main'],
    ['Jr. Cheeseburger', '1 burger', 290, 15, 26, 14, 1, 670, 230, 'small'],
    ['Grilled Chicken Sandwich', '1 sandwich', 370, 34, 36, 10, 3, 830, 520, 'main'],
    ['Spicy Chicken Sandwich', '1 sandwich', 490, 28, 50, 20, 3, 1150, 450, 'main'],
    ['Chicken Nuggets', '10 piece', 450, 23, 27, 29, 0, 950, 400, 'main'],
    ['Chili', 'large', 330, 25, 31, 11, 8, 1290, 900, 'main'],
    ['Plain Baked Potato', '1 potato', 270, 7, 61, 0, 7, 40, 1300, 'side'],
    ['Fries', 'medium', 350, 5, 46, 16, 5, 330, 700, 'side'],
    ['Chocolate Frosty', 'small', 350, 9, 56, 9, 0, 220, 500, 'side'],
  ],
  Subway: [
    ['Oven-Roasted Turkey', '6 inch', 280, 18, 46, 4, 3, 800, 400, 'main'],
    ['Oven-Roasted Turkey', 'footlong', 560, 36, 92, 8, 6, 1600, 800, 'main'],
    ['Rotisserie-Style Chicken', '6 inch', 330, 27, 42, 6, 3, 640, 450, 'main'],
    ['Rotisserie-Style Chicken', 'footlong', 660, 54, 84, 12, 6, 1280, 900, 'main'],
    ['Steak & Cheese', '6 inch', 360, 25, 42, 10, 3, 1050, 450, 'main'],
    ['Steak & Cheese', 'footlong', 720, 50, 84, 20, 6, 2100, 900, 'main'],
    ['Rotisserie Chicken Protein Bowl', '1 bowl', 230, 33, 8, 7, 3, 640, 600, 'main'],
    ['Cookie', '1 cookie', 210, 2, 30, 10, 1, 150, 80, 'side'],
  ],
  'Panda Express': [
    ['Grilled Teriyaki Chicken', '1 entree', 300, 36, 8, 13, 0, 530, 400, 'main'],
    ['Orange Chicken', '1 entree', 490, 25, 51, 23, 1, 820, 200, 'main'],
    ['Kung Pao Chicken', '1 entree', 290, 16, 14, 19, 2, 970, 300, 'main'],
    ['Black Pepper Angus Steak', '1 entree', 180, 19, 10, 7, 1, 750, 350, 'main'],
    ['Broccoli Beef', '1 entree', 150, 9, 13, 7, 2, 520, 400, 'main'],
    ['String Bean Chicken Breast', '1 entree', 210, 12, 13, 12, 4, 590, 300, 'main'],
    ['Honey Walnut Shrimp', '1 entree', 360, 13, 35, 23, 2, 440, 150, 'main'],
    ['White Steamed Rice', '1 side', 380, 7, 87, 0, 0, 0, 60, 'side'],
    ['Fried Rice', '1 side', 520, 11, 85, 16, 1, 850, 160, 'side'],
    ['Chow Mein', '1 side', 510, 13, 80, 20, 6, 980, 200, 'side'],
    ['Super Greens', '1 side', 90, 6, 10, 3, 5, 260, 500, 'side'],
  ],
  'Burger King': [
    ['Whopper', '1 burger', 670, 31, 51, 40, 2, 980, 500, 'main'],
    ['Whopper Jr.', '1 burger', 330, 14, 27, 19, 1, 490, 260, 'small'],
    ['Double Cheeseburger', '1 burger', 400, 24, 26, 22, 1, 860, 300, 'main'],
    ['Royal Crispy Chicken', '1 sandwich', 600, 30, 49, 32, 2, 1440, 450, 'main'],
    ['Chicken Nuggets', '8 piece', 380, 18, 24, 24, 1, 750, 300, 'main'],
    ['Fries', 'medium', 370, 5, 53, 15, 4, 570, 640, 'side'],
  ],
  Popeyes: [
    ['Classic Chicken Sandwich', '1 sandwich', 700, 28, 50, 42, 2, 1440, 450, 'main'],
    ['Classic Tenders', '3 piece', 440, 36, 26, 21, 1, 1610, 450, 'main'],
    ['Classic Tenders', '5 piece', 730, 60, 43, 35, 2, 2690, 750, 'main'],
    ['Chicken Breast (classic)', '1 piece', 380, 35, 16, 20, 1, 1230, 400, 'main'],
    ['Red Beans & Rice', 'regular', 250, 8, 30, 11, 6, 680, 300, 'side'],
    ['Cajun Fries', 'regular', 260, 4, 33, 13, 3, 690, 500, 'side'],
    ['Mashed Potatoes w/ Gravy', 'regular', 110, 2, 18, 4, 1, 530, 300, 'side'],
    ['Green Beans', 'regular', 55, 2, 7, 2, 3, 640, 150, 'side'],
    ['Biscuit', '1 biscuit', 210, 3, 26, 10, 1, 470, 80, 'side'],
  ],
  "Raising Cane's": [
    ['Chicken Fingers', '3 fingers', 390, 39, 21, 18, 0, 870, 600, 'main'],
    ['Chicken Fingers', '4 fingers', 520, 52, 28, 24, 0, 1160, 800, 'main'],
    ['Chicken Fingers', '6 fingers', 780, 78, 42, 36, 0, 1740, 1200, 'main'],
    ['Crinkle-Cut Fries', 'regular', 390, 6, 50, 19, 5, 300, 900, 'side'],
    ['Texas Toast', '1 slice', 150, 4, 22, 5, 1, 290, 60, 'side'],
    ['Coleslaw', '1 side', 160, 1, 13, 11, 2, 230, 120, 'side'],
    ["Cane's Sauce", '1 cup', 190, 0, 6, 19, 0, 290, 0, 'sauce'],
  ],
};
export const CHAINS = Object.keys(MENUS);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// Every chain's menu as foods, so food search finds them too ("spicy chicken sandwich", "cane's")
let allMenu = null;
export function allMenuFoods() {
  if (!allMenu) allMenu = CHAINS.flatMap(menuOf);
  return allMenu;
}
export const menuFood = (id) => allMenuFoods().find((f) => f.id === id) || null;

export function menuOf(chain) {
  return (MENUS[chain] || []).map(([name, serving, cal, p, c, f, fib, na, pot, kind, b]) => ({
    id: `ff:${slug(chain)}-${slug(name)}-${slug(serving)}`, name: `${chain} ${name}`, short: name, serving,
    cal, p, c, f, fib, na, pot, kind, cat: 'Fast Food', ...(b ? { bfast: true } : {}),
  }));
}

const LIMIT = { main: 2, small: 3, side: 2, drink: 1 };
const MAX_LINES = 4;   // a real order: a couple of mains, a side, maybe a drink

// How well a meal fits: protein shortfall hurts most, then calories over budget, extra fat, carbs off target, salt
function fitScore(m, ideal, budget) {
  const errP = Math.max(0, ideal.p - m.p) * 4 * 1.6 + Math.max(0, m.p - ideal.p) * 4 * 0.15;
  const errC = Math.abs(m.c - ideal.c) * 4 * 0.6;
  const errF = Math.max(0, m.f - ideal.f) * 9 + Math.max(0, ideal.f - m.f) * 9 * 0.25;
  const errCal = Math.max(0, m.cal - budget) * 2.5 + Math.max(0, budget * 0.85 - m.cal) * 0.8;
  const errNa = Math.max(0, m.na - 2300) * 0.08;
  const errItems = Math.max(0, (m.lines || 0) - 2) * 30;   // fewer things to order is better
  return -(errP + errC + errF + errCal + errNa + errItems);
}

// The best few orders at a chain for a calorie budget and what's left of today's macros
export function bestOrders(chain, budget, left, n = 3, hour = new Date().getHours() + new Date().getMinutes() / 60) {
  // breakfast-only items are off the menu after 10:30
  const menu = menuOf(chain).filter((x) => x.kind !== 'sauce' && !(x.bfast && hour >= 10.5));
  const k = left.cal > 0 ? Math.min(1, budget / left.cal) : 1;
  const ideal = {
    p: Math.max(left.p * k, (budget * 0.25) / 4),
    c: Math.max(0, left.c * k),
    f: Math.max(0, left.f * k),
  };
  const results = [];
  const pick = [];
  const used = { main: 0, small: 0, side: 0, drink: 0 };
  const tot = { cal: 0, p: 0, c: 0, f: 0, na: 0 };
  function walk(idx) {
    if (idx === menu.length) {
      if (!used.main && !used.small) return;
      results.push({ items: pick.map((x) => ({ ...x })), ...tot, score: fitScore({ ...tot, lines: pick.length }, ideal, budget) });
      return;
    }
    walk(idx + 1);   // skip this item
    if (pick.length >= MAX_LINES) return;
    const it = menu[idx];
    const max = Math.min(it.kind === 'main' ? 2 : it.kind === 'small' ? 3 : 1, LIMIT[it.kind] - used[it.kind]);
    for (let q = 1; q <= max; q++) {
      if (tot.cal + it.cal * q > budget * 1.08) break;
      used[it.kind] += q;
      for (const key of ['cal', 'p', 'c', 'f', 'na']) tot[key] += it[key] * q;
      pick.push({ food: it, qty: q });
      walk(idx + 1);
      pick.pop();
      for (const key of ['cal', 'p', 'c', 'f', 'na']) tot[key] -= it[key] * q;
      used[it.kind] -= q;
    }
  }
  walk(0);
  results.sort((a, b) => b.score - a.score);
  // keep the options different: each one needs a different main item
  const out = [];
  const mains = new Set();
  for (const r of results) {
    const main = [...r.items].sort((a, b) => b.food.cal * b.qty - a.food.cal * a.qty)[0].food.id;
    if (mains.has(main)) continue;
    mains.add(main);
    out.push(r);
    if (out.length >= n) break;
  }
  return { orders: out, ideal };
}

// ================= Screen (a full-height window) =================
const ff = { chain: null, budget: 0, meal: '' };

function leftToday() {
  const t = totals(dayKey());
  const tg = targets(dayKey());
  return { cal: tg.cal - t.cal, p: Math.max(0, tg.p - t.p), c: Math.max(0, tg.c - t.c), f: Math.max(0, tg.f - t.f), tg };
}
function budgetOptions(left) {
  const day = left.tg.cal;
  const auto = Math.max(300, Math.min(left.cal > 0 ? left.cal : 600, Math.round((day * 0.4) / 50) * 50));
  const opts = [...new Set([500, 800, 1100, 1400].filter((v) => v < left.cal + 200))];
  return { auto, opts };
}

export function openFastFood(meal) {
  ff.chain = S.settings.ffChain && MENUS[S.settings.ffChain] ? S.settings.ffChain : CHAINS[0];
  ff.budget = 0;
  ff.meal = meal || mealForNow();
  openModal(renderFF, { full: true });
}

const itemLine = (x) => `${x.qty > 1 ? `${x.qty} x ` : ''}${esc(x.food.short)}${/^1 /.test(x.food.serving) ? '' : ` <span class="muted">(${esc(x.food.serving)})</span>`}`;

function renderFF() {
  const left = leftToday();
  const { auto, opts } = budgetOptions(left);
  const budget = ff.budget || auto;
  const { orders } = bestOrders(ff.chain, budget, left);
  const menu = menuOf(ff.chain);
  const cards = orders.map((o, n) => `
    <div class="ff-order panel ${n === 0 ? 'best' : ''}">
      <div class="ff-head">${n === 0 ? '<span class="tag">Best fit</span>' : `<span class="muted small">Option ${n + 1}</span>`}<b class="vt">${fmt(o.cal)}</b><span class="muted small">kcal</span></div>
      <ul class="ff-items">${o.items.map((x) => `<li>${itemLine(x)}</li>`).join('')}</ul>
      <div class="ff-mac"><span class="c-p">P ${r0(o.p)}g</span> · <span class="c-c">C ${r0(o.c)}g</span> · <span class="c-f">F ${r0(o.f)}g</span> · <span class="c-na">Na ${fmt(o.na)}mg</span></div>
      ${btn(`Log it to ${ff.meal}`, 'ff-log', { cls: n === 0 ? 'primary wide' : 'wide', data: `data-n="${n}"`, ico: 'check' })}
    </div>`).join('');
  return win('Fast Food Mode', `
    <p class="muted small">Pick where you are. The app builds the order that best fits what you have left today.</p>
    <div class="chips ff-chains">${CHAINS.map((c) => `<button class="btn chip ${c === ff.chain ? 'on' : ''}" data-act="ff-chain" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <div class="panel sunken ff-left">
      ${left.cal > 0 ? `Left today: <b class="vt">${fmt(left.cal)}</b> kcal · <span class="c-p">${r0(left.p)}g P</span> · <span class="c-c">${r0(left.c)}g C</span> · <span class="c-f">${r0(left.f)}g F</span>`
        : `You're at your calories for today (${fmt(-left.cal)} over) - these are the lightest high-protein picks.`}
    </div>
    <div class="ff-budget">
      <span class="muted small">This meal:</span>
      <div class="chips">${[auto, ...opts.filter((v) => Math.abs(v - auto) >= 100)].sort((a, b) => a - b).map((v) => `<button class="btn chip ${v === budget ? 'on' : ''}" data-act="ff-budget" data-v="${v}">${fmt(v)}</button>`).join('')}</div>
      ${select('meal', MEALS.map((m) => [m, m]), ff.meal, { data: 'data-change="ff-meal"' })}
    </div>
    ${cards || '<p class="empty">Nothing here fits that budget.</p>'}
    <details class="ff-menu"><summary>Full ${esc(ff.chain)} menu</summary>
      <div class="list">${menu.map((x) => `<button class="row" data-act="ff-item" data-id="${esc(x.id)}"><span class="row-main"><span class="row-name">${esc(x.short)}</span><span class="row-sub">${esc(x.serving)} · <span class="c-p">P ${r0(x.p)}</span> · <span class="c-c">C ${r0(x.c)}</span> · <span class="c-f">F ${r0(x.f)}</span></span></span><span class="row-num">${fmt(x.cal)}</span></button>`).join('')}</div>
    </details>
    <p class="muted small">Approximate published nutrition - recipes change. Sauces and drinks add up fast; water or diet soda keeps the numbers right.</p>
    <div class="btn-row">${btn('Close', 'modal-close', { cls: 'grow' })}</div>
  `, { cls: 'full-win', close: 'modal-close', ico: 'burger' });
}

on({
  'ff-open': (el) => openFastFood(el.dataset.meal),
  'ff-chain': (el) => { ff.chain = el.dataset.c; S.settings.ffChain = ff.chain; save(); drawModals(); },
  'ff-budget': (el) => { ff.budget = Number(el.dataset.v); drawModals(); },
  'ff-meal': (el) => { ff.meal = el.value; drawModals(); },
  'ff-item': (el) => {
    const f = menuOf(ff.chain).find((x) => x.id === el.dataset.id);
    if (f) openFoodDetail(f, { date: dayKey(), meal: ff.meal });
  },
  'ff-log': (el) => {
    const left = leftToday();
    const budget = ff.budget || budgetOptions(left).auto;
    const o = bestOrders(ff.chain, budget, left).orders[Number(el.dataset.n)];
    if (!o) return;
    for (const x of o.items) {
      const { kind, short, bfast, ...food } = x.food;
      addEntry(dayKey(), food, x.qty, ff.meal);
    }
    buzz(HAPTIC.success);
    closeAllModals();
    toast(`Logged ${fmt(o.cal)} kcal, ${r0(o.p)}g protein to ${ff.meal}`, 'burger');
    rerender();
  },
});

