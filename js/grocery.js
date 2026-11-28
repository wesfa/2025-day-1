// Grocery list: what to buy, grouped by aisle. Add items by hand, from the foods you eat most ("my staples"),
// or from any food's detail screen. Check things off in the store; share the list as text.
import { S, save, getFood } from './store.js';
import { dayKey, addDays, daysBetween, prettyDay, esc, uid, r0, r1, fmt, buzz, HAPTIC } from './util.js';
import { buildList, weekReview, descFor, CAT_BY_ID, SECTIONS, STORES, NEED_LABEL } from './smartlist.js';
import { win, group, btn, field, select, on, rerender, toast, confirmBox, openModal, closeModal, formData } from './ui.js';
import { icon } from './icons.js';

export const AISLES = ['Produce', 'Meat & Fish', 'Dairy & Eggs', 'Bread & Grains', 'Pantry', 'Frozen', 'Snacks & Drinks', 'Supplements', 'Other'];
const CAT_AISLE = {
  Protein: 'Meat & Fish', 'Shakes & Bars': 'Supplements', Dairy: 'Dairy & Eggs', Carbs: 'Bread & Grains', Fruit: 'Produce',
  Veggies: 'Produce', 'Fats & Sauces': 'Pantry', Meals: 'Frozen', Snacks: 'Snacks & Drinks', Drinks: 'Snacks & Drinks',
};
// Name keywords win over the food's category (eggs are in "Protein" but live in the dairy aisle)
const KEYWORDS = [
  [/\begg|milk|yogurt|cheese|butter\b|cottage|cream/i, 'Dairy & Eggs'],
  [/protein powder|whey|creatine|gainer|protein bar|protein shake|electrolyte/i, 'Supplements'],
  [/chicken|beef|turkey|steak|pork|salmon|tuna|shrimp|fish|bacon|sausage|\bham\b|jerky|meat stick|hot dog/i, 'Meat & Fish'],
  [/apple|banana|berr|orange|grape|potato|broccoli|spinach|lettuce|carrot|onion|pepper|avocado|tomato|fruit|veg|salad|melon|pineapple/i, 'Produce'],
  [/frozen|pizza|ice cream|waffle|burrito\b|nuggets/i, 'Frozen'],
  [/bread|bagel|rice\b|pasta|oat|tortilla|cereal|granola|bun\b|wrap|cracker|pancake/i, 'Bread & Grains'],
  [/chips|soda|drink|juice|cookie|snack|gatorade|candy|chocolate|pretzel|popcorn|gummy/i, 'Snacks & Drinks'],
  [/peanut|almond|nut\b|nuts|oil|sauce|honey|jam|jelly|salt|spice|beans|ketchup|mayo|syrup|salsa|dressing|tuna can/i, 'Pantry'],
];
export function guessAisle(name, cat) {
  for (const [re, a] of KEYWORDS) if (re.test(name)) return a;
  return CAT_AISLE[cat] || 'Other';
}
// "Chicken breast, grilled" -> "Chicken breast"
export const groceryName = (name) => {
  const n = String(name).replace(/,\s*(grilled|cooked|baked|roasted|scrambled|fried|raw|boiled|steamed|canned in water|drained)\b.*$/i, '').trim();
  return /^eggs?, large$/i.test(n) ? 'Eggs' : n;
};

export function addGrocery(name, { qty = '', aisle, cat } = {}) {
  const n = String(name || '').trim();
  if (!n) return null;
  const have = S.grocery.find((g) => g.name.toLowerCase() === n.toLowerCase() && !g.done);
  if (have) { if (qty && !have.qty) have.qty = qty; save(); return have; }
  const it = { id: 'g' + uid(), name: n, qty, aisle: aisle || guessAisle(n, cat), done: false };
  S.grocery.push(it);
  save();
  return it;
}
export function addFoodToGrocery(food) {
  const it = addGrocery(groceryName(food.name), { cat: food.cat });
  if (it) { buzz(HAPTIC.press); toast(`${it.name} added to your grocery list`, 'cart'); }
}

// The foods you log most often in the last 14 days (home food only: no fast food or quick adds)
export function staples(days = 14) {
  const by = {};
  const end = dayKey();
  for (let i = 0; i < days; i++) {
    const k = addDays(end, -i);
    const d = S.days[k];
    if (!d) continue;
    const seen = new Set();
    for (const e of d.food || []) {
      if (!e.fid || String(e.fid).startsWith('ff:')) continue;
      const f = getFood(e.fid);
      if (!f || f.cat === 'Fast Food') continue;
      const name = groceryName(f.name);
      const x = by[name] || (by[name] = { name, cat: f.cat, serving: f.serving, servings: 0, days: 0 });
      x.servings += Number(e.qty) || 1;
      if (!seen.has(name)) { x.days++; seen.add(name); }
    }
  }
  return Object.values(by).sort((a, b) => b.days - a.days || b.servings - a.servings).slice(0, 18);
}
const perWeek = (x, days = 14) => Math.max(1, Math.round((x.servings * 7) / days));

// ================= Screen =================
// Top: what your last 7 days looked like. Then this week's smart list (tap to copy, check off in the store).
// Bottom: your own extras (typed in, from "my staples", or the cart button on a food).
const pct = (a, b) => (b > 0 ? a / b : 0);
function reviewRows(rv) {
  const a = rv.avg; const g = rv.goal;
  const lvl = (good, ok) => (good ? 'good' : ok ? 'ok' : 'bad');
  // calories are judged with the scale: under the goal is fine while the weight is on pace
  let calLvl = lvl(Math.abs(pct(a.cal, g.cal) - 1) <= 0.1, Math.abs(pct(a.cal, g.cal) - 1) <= 0.2);
  let calNote = '';
  if (rv.pace && a.cal < g.cal * 0.9) {
    if (rv.pace.status === 'ok' || rv.pace.status === 'goal') { calLvl = 'good'; calNote = ' · weight on pace'; }
    else if (rv.pace.status === 'fast') { calLvl = 'ok'; calNote = ' · still gaining fast'; }
  }
  const rows = [
    ['Protein', `${r0(a.p)} / ${r0(g.p)} g a day`, lvl(pct(a.p, g.p) >= 0.9, pct(a.p, g.p) >= 0.75)],
    ['Calories', `${fmt(a.cal)} / ${fmt(g.cal)} a day${calNote}`, calLvl],
    ['Sodium', `${fmt(a.na)} mg a day (avg max ${fmt(g.na)})`, lvl(a.na <= g.na, a.na <= g.na * 1.25)],
    ['Fiber', `${r0(a.fib)} / ${r0(g.fib)} g a day`, lvl(pct(a.fib, g.fib) >= 0.8, pct(a.fib, g.fib) >= 0.6)],
    ['Potassium', `${fmt(a.pot)} / ${fmt(g.pot)} mg a day`, lvl(pct(a.pot, g.pot) >= 0.8, pct(a.pot, g.pot) >= 0.6)],
    ['Fruit & veg', `${r1(rv.produce)} servings a day (aim for 4+)`, lvl(rv.produce >= 4, rv.produce >= 2)],
    ['Fast food & snacks', `${r0(rv.junkShare * 100)}% of calories`, lvl(rv.junkShare <= 0.15, rv.junkShare <= 0.3)],
  ];
  return `<ul class="bq-list">${rows.map(([l, v, c]) => `<li class="bq-${c}"><span class="bq-dot"></span><b>${l}</b> ${esc(v)}</li>`).join('')}</ul>`;
}

async function copyItem(id) {
  const it = CAT_BY_ID[id]; if (!it) return;
  const x = currentPlan().items.find((y) => y.id === it.id);
  const text = `${descFor(it, storeOf())}${x ? ` - ${x.qty}` : ''}`;
  if (await copyText(text)) { buzz(HAPTIC.press); toast(`Copied: ${it.name}`, 'check'); } else toast('Could not copy on this phone', 'warn');
}
// Press and hold an item for half a second to copy its name
let holdT = null; let held = null; let holdXY = null;
document.addEventListener('pointerdown', (e) => {
  const m = e.target.closest && e.target.closest('.sg-main');
  if (!m) return;
  holdXY = [e.clientX, e.clientY]; held = null; clearTimeout(holdT);
  holdT = setTimeout(() => { held = m.dataset.id; copyItem(held); }, 500);
});
['pointerup', 'pointercancel'].forEach((ev) => document.addEventListener(ev, () => clearTimeout(holdT)));
document.addEventListener('pointermove', (e) => { if (holdXY && Math.hypot(e.clientX - holdXY[0], e.clientY - holdXY[1]) > 10) clearTimeout(holdT); });
document.addEventListener('contextmenu', (e) => { if (e.target.closest && e.target.closest('.sg-main')) e.preventDefault(); });

function currentPlan() {
  let plan = S.grocerySmart;
  if (!plan || !Array.isArray(plan.items) || !plan.items.length || !plan.built || daysBetween(plan.built, dayKey()) >= 7) {
    plan = S.grocerySmart = buildList();
    save();
  }
  plan.got = plan.got || {};
  return plan;
}
const storeOf = () => (STORES.some(([k]) => k === S.settings.groceryStore) ? S.settings.groceryStore : 'wegmans');
const storeName = (k) => (STORES.find(([x]) => x === k) || STORES[0])[1];

export function renderGrocery() {
  const store = storeOf();
  const plan = currentPlan();
  const rv = weekReview();
  const items = S.grocery || [];
  const todo = items.filter((g) => !g.done);
  const got = items.filter((g) => g.done);

  const sgRow = (x) => {
    const it = CAT_BY_ID[x.id]; if (!it) return '';
    const done = !!plan.got[x.id];
    return `<div class="row static sg-row ${done ? 'done' : ''}">
      <label class="check inline"><input type="checkbox" data-change="sg-got" data-id="${x.id}" ${done ? 'checked' : ''}><span class="sr">In the cart</span></label>
      <button class="row-main link-row sg-main" data-act="sg-tap" data-id="${x.id}" aria-label="${done ? 'Uncheck' : 'Check off'} ${esc(descFor(it, store))}">
        <span class="row-name">${esc(descFor(it, store))}</span>
        <span class="row-sub"><b class="sg-qty">${esc(x.qty)}</b>${x.why ? ` · ${esc(x.why)}` : ''}</span>
      </button>
      <button class="btn sq sg-x" data-act="sg-hide" data-id="${x.id}" aria-label="Take off the list">${icon('close', 8)}</button>
    </div>`;
  };
  const smart = SECTIONS.map((sec) => {
    const list = plan.items.filter((x) => CAT_BY_ID[x.id] && CAT_BY_ID[x.id].sec === sec);
    return list.length ? `<div class="sub-head">${esc(sec)}</div>${list.map(sgRow).join('')}` : '';
  }).join('');
  const left = plan.items.filter((x) => !plan.got[x.id]).length;

  const row = (g) => `
    <div class="row static gr-row ${g.done ? 'done' : ''}">
      <label class="check inline"><input type="checkbox" data-change="gr-toggle" data-id="${g.id}" ${g.done ? 'checked' : ''}><span class="sr">Got it</span></label>
      <button class="row-main link-row" data-act="gr-edit" data-id="${g.id}"><span class="row-name">${esc(g.name)}</span>${g.qty ? `<span class="row-sub">${esc(g.qty)}</span>` : ''}</button>
      <button class="btn sq" data-act="gr-del" data-id="${g.id}" aria-label="Remove ${esc(g.name)}">${icon('close', 8)}</button>
    </div>`;
  const byAisle = AISLES.map((a) => {
    const list = todo.filter((g) => (g.aisle || 'Other') === a);
    return list.length ? `<div class="sub-head">${esc(a)}</div>${list.map(row).join('')}` : '';
  }).join('');

  return win('Grocery List', `
    <div class="sg-stores"><span class="muted small">Shopping at</span>
      <div class="chips">${STORES.map(([k, l], i) => `<button class="btn chip ${k === store ? 'on' : ''}" data-act="sg-store" data-s="${k}">${k === 'any' ? l : `${i + 1}. ${l}`}</button>`).join('')}</div>
    </div>
    ${group('Your last 7 days', rv.days < 3
      ? '<p class="muted small">Log food for a few days and this list adapts to what you\'re missing. For now it\'s a balanced list for a lifting athlete.</p>'
      : `<p class="muted small">The last 7 full days, through yesterday.</p>${reviewRows(rv)}${plan.focus && plan.focus.length ? `<p class="bq-advice">${icon('up', 10)} This week's list leans on ${esc(plan.focus.map((k) => NEED_LABEL[k]).join(', '))}.</p>` : '<p class="ok-line">' + icon('check', 16) + ' Eating well - this is a balanced restock.</p>'}`)}
    ${group(`This week's list${left ? ` (${left} to get)` : ''}`, `
      <p class="muted small">Tap an item to check it off. Press and hold one to copy its name.</p>
      <div class="list">${smart}</div>
      <div class="btn-row">${btn('Copy list', 'sg-copy-all', { cls: 'primary grow' })}${btn('Share', 'gr-share')}${btn('Rebuild', 'sg-rebuild')}</div>
      <p class="muted small">Built ${esc(prettyDay(plan.built))} from your log. Rebuild after a few more days of logging.</p>`)}
    ${group('My extras', `
      <form class="search-row" onsubmit="return false">
        <input id="gr-new" class="inp grow" placeholder="Add anything else" autocomplete="off" enterkeyhint="done">
        ${btn('Add', 'gr-add', { cls: 'primary', type: 'submit' })}
      </form>
      ${todo.length ? `<div class="list">${byAisle}</div>` : '<p class="empty">Nothing extra yet. The cart button on any food adds it here.</p>'}
      ${got.length ? `<div class="sub-head">In the cart (${got.length})</div>${got.map(row).join('')}<div class="btn-row">${btn('Clear the cart', 'gr-clear')}</div>` : ''}
      <div class="btn-row">${btn('Add my staples', 'gr-staples', { ico: 'star' })}</div>`)}
  `, { ico: 'cart' });
}

// Pick staples to add
const st = { picked: null, list: [] };
function openStaples() {
  st.list = staples();
  st.picked = new Set(st.list.filter((x) => !S.grocery.some((g) => !g.done && g.name.toLowerCase() === x.name.toLowerCase())).map((x) => x.name));
  openModal(() => win('My Staples', `
    <p class="muted small">What you logged most in the last 2 weeks. Untick what you already have.</p>
    ${st.list.length ? `<div class="list">${st.list.map((x, i) => `
      <label class="row static check check-row">
        <input type="checkbox" data-change="gr-pick" data-i="${i}" ${st.picked.has(x.name) ? 'checked' : ''}>
        <span class="row-main"><span class="row-name">${esc(x.name)}</span><span class="row-sub">~${perWeek(x)} serving${perWeek(x) > 1 ? 's' : ''}/week · ${esc(x.serving)}</span></span>
      </label>`).join('')}</div>` : '<p class="empty">Log some food first - your staples show up here.</p>'}
    <div class="btn-row">${st.list.length ? btn('Add to list', 'gr-staples-add', { cls: 'primary grow' }) : ''}${btn('Cancel', 'modal-close')}</div>
  `, { cls: 'dialog', close: 'modal-close', ico: 'star' }));
}

function openItem(g) {
  openModal(() => win('Edit Item', `
    <form id="gr-f" onsubmit="return false">
      ${field('Item', `<input class="inp" name="name" value="${esc(g.name)}">`)}
      ${field('How much', `<input class="inp" name="qty" value="${esc(g.qty || '')}" placeholder="e.g. 2 lb, 1 dozen">`)}
      ${field('Aisle', select('aisle', AISLES.map((a) => [a, a]), g.aisle || 'Other'))}
      <div class="btn-row">${btn('Save', 'gr-f-save', { cls: 'primary grow', type: 'submit', data: `data-id="${g.id}"` })}${btn('Cancel', 'modal-close')}</div>
    </form>`, { cls: 'dialog', close: 'modal-close', ico: 'cart' }));
}

function listText() {
  const store = storeOf();
  const plan = currentPlan();
  const parts = [];
  for (const sec of SECTIONS) {
    const list = plan.items.filter((x) => CAT_BY_ID[x.id] && CAT_BY_ID[x.id].sec === sec && !plan.got[x.id]);
    if (list.length) parts.push(`${sec.toUpperCase()}\n${list.map((x) => `- ${descFor(CAT_BY_ID[x.id], store)} - ${x.qty}`).join('\n')}`);
  }
  const extras = S.grocery.filter((g) => !g.done);
  if (extras.length) parts.push(`EXTRAS\n${extras.map((g) => `- ${g.name}${g.qty ? ` (${g.qty})` : ''}`).join('\n')}`);
  const where = store === 'any' ? '' : ` - ${storeName(store)}`;
  return `Grocery list${where}\n\n${parts.join('\n\n')}`;
}

// Copy text: the Clipboard API, with the old select-and-copy trick as a fallback
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch (e) { return false; }
}

on({
  'gr-add': () => {
    const inp = document.getElementById('gr-new');
    const v = inp ? inp.value.trim() : '';
    if (!v) { toast('Type an item first', 'warn'); return; }
    addGrocery(v); buzz(HAPTIC.tap); rerender();
    const again = document.getElementById('gr-new'); if (again) again.focus();
  },
  'gr-toggle': (el) => {
    const g = S.grocery.find((x) => x.id === el.dataset.id); if (!g) return;
    g.done = el.checked; buzz(HAPTIC.tap); save(); rerender();
  },
  'gr-del': (el) => { S.grocery = S.grocery.filter((x) => x.id !== el.dataset.id); save(); rerender(); },
  'gr-edit': (el) => { const g = S.grocery.find((x) => x.id === el.dataset.id); if (g) openItem(g); },
  'gr-f-save': (el) => {
    const g = S.grocery.find((x) => x.id === el.dataset.id); if (!g) return;
    const v = formData(document.getElementById('gr-f'));
    if (!v.name.trim()) { toast('Name it', 'warn'); return; }
    Object.assign(g, { name: v.name.trim(), qty: v.qty.trim(), aisle: v.aisle });
    save(); closeModal(); rerender();
  },
  'gr-clear': async () => {
    if (!(await confirmBox('Clear everything in the cart?', 'Clear cart', 'Clear'))) return;
    S.grocery = S.grocery.filter((g) => !g.done); save(); rerender();
  },
  'gr-staples': () => openStaples(),
  'gr-pick': (el) => { const x = st.list[Number(el.dataset.i)]; if (!x) return; if (el.checked) st.picked.add(x.name); else st.picked.delete(x.name); },
  'gr-staples-add': () => {
    let n = 0;
    for (const x of st.list) if (st.picked.has(x.name)) { addGrocery(x.name, { qty: `~${perWeek(x)} serving${perWeek(x) > 1 ? 's' : ''}/week (${x.serving})`, cat: x.cat }); n++; }
    closeModal(); rerender();
    if (n) toast(`Added ${n} item${n > 1 ? 's' : ''}`, 'cart');
  },
  'gr-share': async () => {
    const text = listText();
    try {
      if (navigator.share) { await navigator.share({ title: 'Grocery list', text }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    if (await copyText(text)) toast('List copied - paste it anywhere', 'check'); else toast('Could not copy on this phone', 'warn');
  },
  'sg-store': (el) => { S.settings.groceryStore = el.dataset.s; save(); rerender(); },
  'sg-got': (el) => { const plan = currentPlan(); plan.got[el.dataset.id] = el.checked; buzz(HAPTIC.tap); save(); rerender(); },
  'sg-hide': (el) => { const plan = currentPlan(); plan.items = plan.items.filter((x) => x.id !== el.dataset.id); save(); rerender(); },
  'sg-rebuild': () => { S.grocerySmart = buildList(); save(); buzz(HAPTIC.press); toast('Rebuilt from your last 7 days', 'cart'); rerender(); },
  'sg-copy': (el) => copyItem(el.dataset.id),
  // a tap checks the item off (a press-and-hold copies it instead - see below)
  'sg-tap': (el) => {
    const id = el.dataset.id;
    if (held === id) { held = null; return; }
    const plan = currentPlan(); plan.got[id] = !plan.got[id];
    buzz(HAPTIC.tap); save(); rerender();
  },
  'sg-copy-all': async () => {
    if (await copyText(listText())) { buzz(HAPTIC.press); toast('List copied - paste it in Notes or a text', 'check'); } else toast('Could not copy on this phone', 'warn');
  },
});
