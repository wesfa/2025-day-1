// Grocery list: what to buy, grouped by aisle. Add items by hand, from the foods you eat most ("my staples"),
// or from any food's detail screen. Check things off in the store; share the list as text.
import { S, save, getFood } from './store.js';
import { dayKey, addDays, esc, uid, buzz, HAPTIC } from './util.js';
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
export function renderGrocery() {
  const items = S.grocery || [];
  const todo = items.filter((g) => !g.done);
  const got = items.filter((g) => g.done);
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
    <form class="search-row" onsubmit="return false">
      <input id="gr-new" class="inp grow" placeholder="Add an item (e.g. eggs)" autocomplete="off" enterkeyhint="done">
      ${btn('Add', 'gr-add', { cls: 'primary', type: 'submit' })}
    </form>
    <div class="btn-row">${btn('Add my staples', 'gr-staples', { ico: 'star' })}${items.length ? btn('Share list', 'gr-share', { ico: 'phone' }) : ''}</div>
    ${todo.length ? `<div class="list">${byAisle}</div>` : `<p class="empty">${got.length ? 'Everything\'s in the cart.' : 'Your list is empty. <b>Add my staples</b> fills it from the foods you eat most.'}</p>`}
    ${got.length ? group(`In the cart (${got.length})`, `${got.map(row).join('')}<div class="btn-row">${btn('Clear the cart', 'gr-clear')}</div>`) : ''}
    <p class="muted small">Tip: on any food's detail screen, the cart button adds it here.</p>
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
  const todo = S.grocery.filter((g) => !g.done);
  const parts = AISLES.map((a) => {
    const list = todo.filter((g) => (g.aisle || 'Other') === a);
    return list.length ? `${a}\n${list.map((g) => `- ${g.name}${g.qty ? ` (${g.qty})` : ''}`).join('\n')}` : '';
  }).filter(Boolean);
  return `Grocery list\n\n${parts.join('\n\n')}`;
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
    try { await navigator.clipboard.writeText(text); toast('List copied - paste it anywhere', 'check'); } catch (e) { toast('Could not copy on this phone', 'warn'); }
  },
});
