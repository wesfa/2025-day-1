// Food diary + add-food flows.
import { S, save, day, peekDay, totals, mealTotals, getFood, addEntry, recentFoods, targets, MEALS } from './store.js';

const MICROS = [['fib', 'Fiber', 'g'], ['na', 'Sodium', 'mg'], ['pot', 'Potassium', 'mg']];
const known = (v) => typeof v === 'number' && Number.isFinite(v);
const optNum = (v) => (v === '' || v == null || !Number.isFinite(parseFloat(v)) ? null : parseFloat(v));

// Fiber / sodium / potassium: a small strip under protein / carbs / fat (they matter, just less).
// Fiber and potassium are goals (going past is fine); sodium is a max. One short note only when needed.
export function microStrip(t, tg) {
  const cell = ([m, l, u]) => `<div class="mi">
      <span class="mi-l">${m === 'na' ? 'Sodium (max)' : l}</span>
      ${bar(t[m], tg[m], { cls: 'mini m-' + m, cap: m === 'na', label: l })}
      <span class="mi-v">${u === 'g' ? r0(t[m]) : fmt(t[m])}/${fmt(tg[m])}${u}</span>
    </div>`;
  const notes = [];
  if (t.na > tg.na) notes.push(`Sodium ${fmt(t.na - tg.na)}mg over the limit`);
  if (t.unknown) notes.push(`${t.unknown} item${t.unknown > 1 ? 's' : ''} missing fiber/sodium/potassium info`);
  return `<div class="micro-strip">${MICROS.map(cell).join('')}</div>${notes.length ? `<p class="micro-note">${notes.join(' · ')}</p>` : ''}`;
}
import { FOODS, FOOD_CATEGORIES } from './foods.js';
import { dayKey, addDays, prettyDay, esc, r0, r1, num, fmt, uid, buzz } from './util.js';
import { win, group, bar, btn, field, numInput, select, on, openModal, closeModal, closeAllModals, rerender, drawModals, toast, confirmBox, promptBox, formData } from './ui.js';
import { icon } from './icons.js';
import { openAI } from './ai.js';

export const view = { date: dayKey() };

export function mealForNow() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  if (h < 10.5) return 'Breakfast';
  if (h < 14) return 'Lunch';
  if (h >= 17 && h < 21) return 'Dinner';
  return 'Snacks';
}

const macroLine = (o, q = 1) => `<span class="mac">P ${r0(o.p * q)} · C ${r0(o.c * q)} · F ${r0(o.f * q)}</span>`;

// ================= Diary screen =================
export function renderFood() {
  const k = view.date;
  const t = totals(k);
  const tg = targets(k);
  const yesterday = addDays(k, -1);
  const d = peekDay(k);

  const meals = MEALS.map((meal) => {
    const items = d.food.filter((e) => e.meal === meal);
    const mt = mealTotals(k, meal);
    const yItems = peekDay(yesterday).food.filter((e) => e.meal === meal);
    const rows = items.map((e) => `
      <button class="row" data-act="edit-entry" data-id="${e.id}">
        <span class="row-main"><span class="row-name">${esc(e.name)}</span>
        <span class="row-sub">${e.serving === 'entry' ? '' : `${r1(e.qty)} × ${esc(e.serving)} · `}${macroLine(e, e.qty)}</span></span>
        <span class="row-num">${fmt(e.cal * e.qty)}</span>
      </button>`).join('');
    return group(`${meal}`, `
      ${rows || '<p class="empty">Nothing logged yet.</p>'}
      <div class="btn-row">
        ${btn('Add food', 'open-add', { data: `data-meal="${meal}"`, cls: 'primary' })}
        ${!items.length && yItems.length ? btn('Copy yesterday', 'copy-meal', { data: `data-meal="${meal}"` }) : ''}
        ${items.length ? btn('Save as meal', 'save-meal', { data: `data-meal="${meal}"` }) : ''}
      </div>`, { right: `<b class="vt">${fmt(mt.cal)}</b> kcal` });
  }).join('');

  const left = tg.cal - t.cal;
  return win(`Food Diary - ${esc(prettyDay(k))}`, `
    <div class="datenav">
      <button class="btn sq" data-act="diary-day" data-d="-1" aria-label="Previous day">${icon('left', 10)}</button>
      <button class="btn grow" data-act="diary-today">${esc(prettyDay(k))}</button>
      <button class="btn sq" data-act="diary-day" data-d="1" aria-label="Next day">${icon('right', 10)}</button>
    </div>
    ${tg.dayType ? `<div class="day-type"><span class="tag dt-${tg.dayType}">${tg.dayType === 'train' ? 'Training day' : 'Rest day'}</span><span class="muted small">goal ${fmt(tg.cal)} kcal</span></div>` : ''}
    <div class="panel sunken summary">
      <div class="sum-row"><span>Eaten <b class="vt">${fmt(t.cal)}</b></span><span>Goal <b class="vt">${fmt(tg.cal)}</b></span><span>${left >= 0 ? 'Left' : 'Over'} <b class="vt ${left < 0 ? 'bad' : ''}">${fmt(Math.abs(left))}</b></span></div>
      ${bar(t.cal, tg.cal)}
      <div class="mac-grid">
        ${['p', 'c', 'f'].map((m) => `<div><span class="mac-l">${{ p: 'Protein', c: 'Carbs', f: 'Fat' }[m]}</span>${bar(t[m], tg[m], { cls: 'thin m-' + m })}<span class="mac-v">${r0(t[m])}/${tg[m]}g</span></div>`).join('')}
      </div>
      ${microStrip(t, tg)}
    </div>
    ${meals}
    <div class="btn-row">${btn('AI photo log', 'ai-open', { ico: 'camera', data: `data-meal="${mealForNow()}" data-date="${k}"` })}${btn('Quick add calories', 'quick-add', { data: `data-meal="${mealForNow()}"` })}${btn('My foods', 'my-foods')}</div>
  `, { ico: 'burger' });
}

on({
  'diary-day': (el) => { view.date = addDays(view.date, Number(el.dataset.d)); rerender(); },
  'diary-today': () => { view.date = dayKey(); rerender(); },
  'open-add': (el) => openAddFood(el.dataset.meal, view.date),
  'copy-meal': (el) => {
    const meal = el.dataset.meal;
    const src = peekDay(addDays(view.date, -1)).food.filter((e) => e.meal === meal);
    const d = day(view.date);
    for (const e of src) d.food.push({ ...e, id: uid(), t: Date.now() });
    save(); toast(`Copied ${src.length} item${src.length > 1 ? 's' : ''} to ${meal}`); rerender();
  },
  'save-meal': async (el) => {
    const meal = el.dataset.meal;
    const items = peekDay(view.date).food.filter((e) => e.meal === meal);
    const name = await promptBox({ title: 'Save meal', label: 'Name this meal (e.g. "Usual breakfast")', value: `My ${meal.toLowerCase()}` });
    if (!name) return;
    S.savedMeals.push({ id: uid(), name: name.trim(), items: items.map(({ fid, name: n, serving, cal, p, c, f, fib, na, pot, qty }) => ({ fid, name: n, serving, cal, p, c, f, fib, na, pot, qty })) });
    save(); toast('Meal saved - find it under "Meals" when adding food'); rerender();
  },
  'edit-entry': (el) => {
    const e = peekDay(view.date).food.find((x) => x.id === el.dataset.id);
    if (e) openFoodDetail({ id: e.fid, name: e.name, serving: e.serving, cal: e.cal, p: e.p, c: e.c, f: e.f, fib: e.fib, na: e.na, pot: e.pot, g: (getFood(e.fid) || {}).g }, { date: view.date, meal: e.meal, entry: e });
  },
  'quick-add': (el) => openQuickAdd(el.dataset.meal || mealForNow(), view.date),
  'my-foods': () => { af.tab = 'mine'; openAddFood(mealForNow(), view.date); },
});

// ================= Add food (search) =================
const af = { meal: 'Breakfast', date: dayKey(), tab: 'recent', q: '', cat: '', online: null };
const onlineMap = {};

export function openAddFood(meal, date) {
  af.meal = meal || mealForNow();
  af.date = date || dayKey();
  af.q = '';
  af.online = null;
  if (!af.tab || (af.tab === 'recent' && !S.recent.length)) af.tab = S.recent.length ? 'recent' : 'all';
  openModal(renderAddFood, { full: true });
}

const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function searchLocal(q) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  // each word must match the START of a word ("egg" finds "Scrambled eggs", not "Veggies")
  const res = words.map((w) => new RegExp('(^|[^a-z0-9])' + reEsc(w)));
  const pool = [...S.customFoods, ...Object.values(S.foodCache), ...FOODS];
  const seen = new Set();
  const out = [];
  for (const f of pool) {
    if (seen.has(f.id)) continue;
    const name = (f.name + ' ' + (f.cat || '')).toLowerCase().replace(/'/g, '');
    if (res.every((r) => r.test(name))) { out.push(f); seen.add(f.id); }
    if (out.length >= 80) break;
  }
  // rank: starts-with first, then recents
  const rec = new Set(S.recent);
  return out.sort((a, b) => {
    const as = a.name.toLowerCase().startsWith(words[0] || '') ? 0 : 1;
    const bs = b.name.toLowerCase().startsWith(words[0] || '') ? 0 : 1;
    return as - bs || (rec.has(b.id) ? 1 : 0) - (rec.has(a.id) ? 1 : 0);
  });
}

function foodRow(f) {
  const fav = S.favs.includes(f.id);
  return `<button class="row" data-act="pick-food" data-fid="${esc(f.id)}">
    <span class="row-main"><span class="row-name">${fav ? icon('star', 12) + ' ' : ''}${esc(f.name)}</span>
    <span class="row-sub">${esc(f.serving)} · ${macroLine(f)}</span></span>
    <span class="row-num">${fmt(f.cal)}</span></button>`;
}

function renderAddFood() {
  const tabs = [['recent', 'Recent'], ['favs', 'Favorites'], ['meals', 'Meals'], ['mine', 'My Foods'], ['all', 'All']];
  let list = '';
  if (af.q.trim()) {
    const res = searchLocal(af.q.trim());
    list = (res.length ? res.map(foodRow).join('') : '<p class="empty">No matches in your foods.</p>') + renderOnline();
  } else if (af.tab === 'recent') {
    const r = recentFoods();
    list = r.length ? r.map(foodRow).join('') : '<p class="empty">Foods you log show up here so re-logging is one tap.</p>';
  } else if (af.tab === 'favs') {
    const f = S.favs.map(getFood).filter(Boolean);
    list = f.length ? f.map(foodRow).join('') : '<p class="empty">Tap the star on any food to make it a favorite.</p>';
  } else if (af.tab === 'meals') {
    list = S.savedMeals.length ? S.savedMeals.map((m) => {
      const t = m.items.reduce((a, e) => ({ cal: a.cal + e.cal * e.qty, p: a.p + e.p * e.qty }), { cal: 0, p: 0 });
      return `<div class="row static"><span class="row-main"><span class="row-name">${esc(m.name)}</span><span class="row-sub">${m.items.length} items · P ${r0(t.p)}g</span></span><span class="row-num">${fmt(t.cal)}</span>
        <span class="row-btns">${btn('Add', 'add-saved-meal', { data: `data-id="${m.id}"`, cls: 'primary' })}${btn('', 'del-saved-meal', { data: `data-id="${m.id}"`, ico: 'close', cls: 'sq' })}</span></div>`;
    }).join('') : '<p class="empty">Log a meal, then tap "Save as meal" in the diary to reuse it with one tap.</p>';
  } else if (af.tab === 'mine') {
    list = (S.customFoods.length ? S.customFoods.map(foodRow).join('') : '<p class="empty">Foods you create show up here.</p>');
  } else {
    const cats = FOOD_CATEGORIES.map((c) => [c, c]);
    const cat = af.cat || 'Protein';
    list = `<div class="field-inline">${select('cat', cats, cat, { data: 'data-change="af-cat"' })}</div>` + FOODS.filter((f) => f.cat === cat).map(foodRow).join('');
  }

  return win(`Add Food - ${esc(af.meal)}`, `
    <div class="search-row">
      <input id="af-q" class="inp grow" type="search" placeholder="Search foods..." value="${esc(af.q)}" data-input="af-q" autocomplete="off" enterkeyhint="search">
    </div>
    <div class="btn-row tight">
      ${btn('AI photo', 'af-ai', { ico: 'camera', cls: 'primary' })}
      ${btn('Barcode', 'scan-barcode', { ico: 'phone' })}
      ${btn('Quick add', 'quick-add-af')}
      ${btn('Create food', 'create-food')}
    </div>
    ${af.q.trim() ? '' : `<div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button class="tab ${af.tab === k ? 'on' : ''}" data-act="af-tab" data-tab="${k}">${l}</button>`).join('')}</div>`}
    <div class="tab-body list" id="af-list">${list}</div>
    <div class="select-meal">Adding to: ${select('meal', MEALS.map((m) => [m, m]), af.meal, { data: 'data-change="af-meal"' })} <span class="muted">${esc(prettyDay(af.date))}</span></div>
  `, { ico: 'burger', cls: 'full-win', close: 'modal-close' });
}

function renderOnline() {
  const o = af.online;
  if (!o || o.q !== af.q.trim()) {
    return `<div class="online-box">${btn(`Search online for "${esc(af.q.trim())}"`, 'search-online', { cls: 'primary wide' })}<p class="hint">Searches the Open Food Facts database (millions of packaged foods).</p></div>`;
  }
  if (o.loading) return `<div class="online-box"><p class="loading">${icon('hourglass', 16)} Searching online...</p></div>`;
  if (o.error) return `<div class="online-box"><p class="empty">${esc(o.error)}</p>${btn('Try again', 'search-online')}</div>`;
  return `<div class="online-box"><div class="sub-head">Online results</div>${o.results.length ? o.results.map(foodRow).join('') : '<p class="empty">Nothing found online. Try fewer words, or Create food.</p>'}</div>`;
}

let qTimer;
on({
  'af-q': (el) => {
    af.q = el.value;
    clearTimeout(qTimer);
    qTimer = setTimeout(() => {
      const pos = el.selectionStart;
      drawModals();
      const inp = document.getElementById('af-q');
      if (inp) { inp.focus(); try { inp.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } }
    }, 120);
  },
  'af-tab': (el) => { af.tab = el.dataset.tab; drawModals(); },
  'af-cat': (el) => { af.cat = el.value; drawModals(); },
  'af-meal': (el) => { af.meal = el.value; drawModals(); },
  'pick-food': (el) => {
    const f = getFood(el.dataset.fid) || onlineMap[el.dataset.fid];
    if (f) openFoodDetail(f, { date: af.date, meal: af.meal });
  },
  'quick-add-af': () => openQuickAdd(af.meal, af.date),
  'af-ai': () => openAI(af.meal, af.date),
  'create-food': () => openCreateFood({ name: af.q.trim() }),
  'search-online': () => searchOnline(af.q.trim()),
  'scan-barcode': () => openScanner(),
  'add-saved-meal': (el) => {
    const m = S.savedMeals.find((x) => x.id === el.dataset.id);
    if (!m) return;
    const d = day(af.date);
    for (const it of m.items) d.food.push({ ...it, id: uid(), meal: af.meal, t: Date.now() });
    save(); buzz(); toast(`Added "${esc(m.name)}" to ${af.meal}`);
    closeAllModals(); rerender();
  },
  'del-saved-meal': async (el) => {
    const m = S.savedMeals.find((x) => x.id === el.dataset.id);
    if (!m || !(await confirmBox(`Delete saved meal "${esc(m.name)}"?`))) return;
    S.savedMeals = S.savedMeals.filter((x) => x !== m); save(); drawModals();
  },
});

// ================= Food detail =================
const fd = { food: null, qty: 1, meal: 'Breakfast', date: dayKey(), entry: null, unit: 'srv' };

export function openFoodDetail(food, { date, meal, entry } = {}) {
  fd.food = food;
  fd.qty = entry ? entry.qty : 1;
  fd.meal = meal || mealForNow();
  fd.date = date || dayKey();
  fd.entry = entry || null;
  fd.unit = 'srv';
  openModal(renderFoodDetail);
}

function renderFoodDetail() {
  const f = fd.food;
  const q = fd.qty;
  const fav = S.favs.includes(f.id);
  const canGram = f.g > 0;
  const tg = targets(fd.date);
  const t = totals(fd.date);
  const qtyVal = fd.unit === 'g' ? r0(q * f.g) : r1(q);
  return win(esc(f.name), `
    <div class="fd-head">
      <div><div class="fd-serv">1 serving = ${esc(f.serving)}</div>${f.cat ? `<div class="muted">${esc(f.cat)}</div>` : ''}</div>
      ${f.id ? `<button class="btn sq" data-act="fd-fav" aria-label="Favorite">${icon(fav ? 'star' : 'starOff', 20)}</button>` : ''}
    </div>
    <div class="qty-row">
      <button class="btn sq big" data-act="fd-step" data-d="-1">-</button>
      <input id="fd-qty" class="inp qty" type="number" inputmode="decimal" step="any" value="${qtyVal}" data-input="fd-qty">
      <button class="btn sq big" data-act="fd-step" data-d="1">+</button>
      ${canGram ? `<button class="btn" data-act="fd-unit">${fd.unit === 'g' ? 'grams' : 'servings'}</button>` : '<span class="unit">servings</span>'}
    </div>
    <div class="chips">${[0.5, 1, 1.5, 2, 3].map((v) => `<button class="btn chip ${q === v ? 'on' : ''}" data-act="fd-set" data-v="${v}">${v === 0.5 ? '1/2' : v === 1.5 ? '1 1/2' : v}</button>`).join('')}</div>
    <div class="panel sunken fd-macros" id="fd-macros">${fdMacros()}</div>
    <p class="muted small">After this: ${fmt(t.cal + (fd.entry ? 0 : f.cal * q))} / ${fmt(tg.cal)} kcal · protein ${r0(t.p + (fd.entry ? 0 : f.p * q))} / ${tg.p}g</p>
    ${field('Meal', select('meal', MEALS.map((m) => [m, m]), fd.meal, { data: 'data-change="fd-meal"' }))}
    <div class="btn-row">
      ${btn(fd.entry ? 'Save' : `Add to ${fd.meal}`, 'fd-add', { cls: 'primary grow' })}
      ${fd.entry ? btn('Delete', 'fd-del', { cls: 'danger' }) : ''}
      ${btn('Cancel', 'modal-close')}
    </div>
  `, { cls: 'dialog', close: 'modal-close', ico: 'burger' });
}

function fdMacros() {
  const f = fd.food; const q = fd.qty;
  return `<div class="big-cal"><b class="vt">${fmt(f.cal * q)}</b> kcal</div>
    <div class="mac3"><span>Protein<b class="vt">${r1(f.p * q)}g</b></span><span>Carbs<b class="vt">${r1(f.c * q)}g</b></span><span>Fat<b class="vt">${r1(f.f * q)}g</b></span></div>
    <div class="mac3 micro3">${MICROS.map(([m, l, u]) => `<span>${l}<b class="vt">${known(f[m]) ? (u === 'g' ? r1(f[m] * q) : fmt(f[m] * q)) + u : '-'}</b></span>`).join('')}</div>`;
}

on({
  'fd-qty': (el) => {
    const v = num(el.value, 0);
    fd.qty = fd.unit === 'g' ? v / fd.food.g : v;
    const box = document.getElementById('fd-macros');
    if (box) box.innerHTML = fdMacros();
  },
  'fd-step': (el) => {
    const d = Number(el.dataset.d);
    if (fd.unit === 'g') fd.qty = Math.max(0, (r0(fd.qty * fd.food.g) + d * 10) / fd.food.g);
    else fd.qty = Math.max(0.25, Math.round((fd.qty + d * 0.5) * 4) / 4);
    drawModals();
  },
  'fd-set': (el) => { fd.qty = Number(el.dataset.v); drawModals(); },
  'fd-unit': () => { fd.unit = fd.unit === 'g' ? 'srv' : 'g'; drawModals(); },
  'fd-meal': (el) => { fd.meal = el.value; drawModals(); },
  'fd-fav': () => {
    const id = fd.food.id;
    if (S.favs.includes(id)) S.favs = S.favs.filter((x) => x !== id);
    else {
      S.favs.unshift(id);
      if (!getFood(id)) S.foodCache[id] = { ...fd.food };
    }
    save(); drawModals();
  },
  'fd-add': () => {
    const qtyEl = document.getElementById('fd-qty');
    if (qtyEl) { const v = num(qtyEl.value, 0); fd.qty = fd.unit === 'g' ? v / fd.food.g : v; }
    if (!(fd.qty > 0)) { toast('Enter an amount', 'warn'); return; }
    if (fd.entry) {
      const d = day(fd.date);
      const e = d.food.find((x) => x.id === fd.entry.id);
      if (e) { e.qty = fd.qty; e.meal = fd.meal; }
      save(); toast('Saved');
    } else {
      addEntry(fd.date, fd.food, fd.qty, fd.meal);
      buzz();
      toast(`Added ${esc(fd.food.name)} (${fmt(fd.food.cal * fd.qty)} kcal)`);
    }
    closeAllModals(); rerender();
  },
  'fd-del': async () => {
    if (!(await confirmBox(`Delete ${esc(fd.food.name)}?`))) return;
    const d = day(fd.date);
    d.food = d.food.filter((x) => x.id !== fd.entry.id);
    save(); closeAllModals(); rerender();
  },
});

// ================= Quick add / Create food =================
export function openQuickAdd(meal, date) {
  const id = 'qa';
  openModal(() => win('Quick Add', `
    <form id="${id}" onsubmit="return false">
      <p class="muted small">Know the numbers from a label or menu? Punch them in.</p>
      ${field('Name (optional)', `<input class="inp" name="name" placeholder="e.g. Team dinner">`)}
      <div class="grid2">
        ${field('Calories', numInput('cal', '', { placeholder: '0' }))}
        ${field('Protein g', numInput('p', '', { placeholder: '0' }))}
        ${field('Carbs g', numInput('c', '', { placeholder: '0' }))}
        ${field('Fat g', numInput('f', '', { placeholder: '0' }))}
        ${field('Fiber g', numInput('fib', '', { placeholder: 'optional' }))}
        ${field('Sodium mg', numInput('na', '', { placeholder: 'optional' }))}
        ${field('Potassium mg', numInput('pot', '', { placeholder: 'optional' }))}
      </div>
      ${field('Meal', select('meal', MEALS.map((m) => [m, m]), meal))}
      <div class="btn-row">${btn('Add', 'qa-save', { cls: 'primary grow', type: 'submit', data: `data-date="${date}"` })}${btn('Cancel', 'modal-close')}</div>
    </form>`, { cls: 'dialog', close: 'modal-close' }));
}

export function openCreateFood(pre = {}, after) {
  openModal(() => win('Create Food', `
    <form id="cf" onsubmit="return false">
      ${field('Food name', `<input class="inp" name="name" value="${esc(pre.name || '')}" placeholder="e.g. Mom's lasagna">`)}
      ${field('Serving size', `<input class="inp" name="serving" value="${esc(pre.serving || '1 serving')}" placeholder="e.g. 1 cup, 1 bar">`)}
      <div class="grid2">
        ${field('Calories', numInput('cal', pre.cal ?? ''))}
        ${field('Protein g', numInput('p', pre.p ?? ''))}
        ${field('Carbs g', numInput('c', pre.c ?? ''))}
        ${field('Fat g', numInput('f', pre.f ?? ''))}
        ${field('Fiber g', numInput('fib', pre.fib ?? '', { placeholder: 'optional' }))}
        ${field('Sodium mg', numInput('na', pre.na ?? '', { placeholder: 'optional' }))}
        ${field('Potassium mg', numInput('pot', pre.pot ?? '', { placeholder: 'optional' }))}
      </div>
      <div class="btn-row">${btn('Save food', 'cf-save', { cls: 'primary grow', type: 'submit' })}${btn('Cancel', 'modal-close')}</div>
    </form>`, { cls: 'dialog', close: 'modal-close' }));
  cfAfter = after || null;
}
let cfAfter = null;

on({
  'qa-save': (el) => {
    const v = formData(document.getElementById('qa'));
    const cal = num(v.cal); const p = num(v.p); const c = num(v.c); const f = num(v.f);
    const kcal = cal || p * 4 + c * 4 + f * 9;
    if (!kcal) { toast('Enter calories or macros', 'warn'); return; }
    addEntry(el.dataset.date || dayKey(), { id: '', name: v.name.trim() || 'Quick add', serving: 'entry', cal: kcal, p, c, f, fib: optNum(v.fib), na: optNum(v.na), pot: optNum(v.pot) }, 1, v.meal);
    buzz(); toast(`Added ${fmt(kcal)} kcal`); closeAllModals(); rerender();
  },
  'cf-save': () => {
    const v = formData(document.getElementById('cf'));
    if (!v.name.trim()) { toast('Give it a name', 'warn'); return; }
    const p = num(v.p); const c = num(v.c); const f = num(v.f);
    const food = { id: 'c:' + uid(), name: v.name.trim(), serving: v.serving.trim() || '1 serving', cal: num(v.cal) || r0(p * 4 + c * 4 + f * 9), p, c, f, fib: optNum(v.fib), na: optNum(v.na), pot: optNum(v.pot), cat: 'My Foods' };
    S.customFoods.unshift(food);
    save(); closeModal();
    if (cfAfter) { cfAfter(food); return; }
    openFoodDetail(food, { date: af.date, meal: af.meal });
  },
});

// ================= Open Food Facts =================
const OFF_FIELDS = 'code,product_name,generic_name,brands,nutriments,serving_size,serving_quantity';

function offToFood(p) {
  if (!p) return null;
  const n = p.nutriments || {};
  const name = [p.product_name || p.generic_name, (p.brands || '').split(',')[0]].filter((x) => x && x.trim()).join(' - ').trim();
  if (!name) return null;
  const sq = parseFloat(p.serving_quantity);
  const per100 = {
    cal: n['energy-kcal_100g'] ?? (n.energy_100g != null ? n.energy_100g / 4.184 : null),
    p: n.proteins_100g || 0, c: n.carbohydrates_100g || 0, f: n.fat_100g || 0,
  };
  const id = 'o:' + (p.code || uid());
  // per-serving value if the label has it, else scaled from per-100 g; null when unknown
  const micro = (key, scale, mult) => {
    const s = n[`${key}_serving`];
    const h = n[`${key}_100g`];
    const v = s != null && s !== '' ? Number(s) : h != null && h !== '' ? Number(h) * scale : null;
    return v == null || !Number.isFinite(v) ? null : Math.round(v * mult * 10) / 10;
  };
  if (n['energy-kcal_serving'] != null && sq > 0) {
    const sc = sq / 100;
    return { id, name, serving: p.serving_size || `${sq} g`, cal: r0(n['energy-kcal_serving']), p: r1(n.proteins_serving || 0), c: r1(n.carbohydrates_serving || 0), f: r1(n.fat_serving || 0),
      fib: micro('fiber', sc, 1), na: micro('sodium', sc, 1000), pot: micro('potassium', sc, 1000), g: sq, cat: 'Online' };
  }
  if (per100.cal == null) return null;
  const k = sq > 0 ? sq / 100 : 1;
  const per = (key, mult) => { const h = n[`${key}_100g`]; return h == null || h === '' || !Number.isFinite(Number(h)) ? null : Math.round(Number(h) * k * mult * 10) / 10; };
  return { id, name, serving: sq > 0 ? (p.serving_size || `${sq} g`) : '100 g', cal: r0(per100.cal * k), p: r1(per100.p * k), c: r1(per100.c * k), f: r1(per100.f * k),
    fib: per('fiber', 1), na: per('sodium', 1000), pot: per('potassium', 1000), g: sq > 0 ? sq : 100, cat: 'Online' };
}

async function fetchJSON(url, ms = 15000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally { clearTimeout(t); }
}

async function searchOnline(q) {
  if (!q) return;
  af.online = { q, loading: true, results: [] };
  drawModals();
  if (!navigator.onLine) { af.online = { q, error: 'You\'re offline. Try again with signal, or use Quick add.' }; drawModals(); return; }
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=30&sort_by=unique_scans_n&fields=${OFF_FIELDS}`;
    const data = await fetchJSON(url);
    const results = (data.products || []).map(offToFood).filter(Boolean);
    results.forEach((f) => { onlineMap[f.id] = f; });
    af.online = { q, results };
  } catch (e) {
    af.online = { q, error: 'Online search is busy or unreachable right now. Try again in a minute, or use Quick add.' };
  }
  drawModals();
}

export async function lookupBarcode(code) {
  code = String(code).replace(/\D/g, '');
  if (!code) return;
  const known = getFood('o:' + code);
  if (known) { openFoodDetail(known, { date: af.date, meal: af.meal }); return; }
  toast('Looking up barcode...', 'hourglass');
  try {
    const data = await fetchJSON(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${OFF_FIELDS}`);
    const food = data && data.status === 1 ? offToFood({ ...data.product, code }) : null;
    if (food) { onlineMap[food.id] = food; openFoodDetail(food, { date: af.date, meal: af.meal }); return; }
    toast('Not found - add it yourself', 'warn');
    openCreateFood({ name: '' }, (f) => {
      // remember the barcode so next scan finds it instantly
      const copy = { ...f, id: 'o:' + code };
      S.customFoods = S.customFoods.map((x) => (x.id === f.id ? copy : x));
      save();
      openFoodDetail(copy, { date: af.date, meal: af.meal });
    });
  } catch (e) {
    toast('Lookup failed - check your connection', 'warn');
  }
}

// ================= Barcode scanner =================
let scanStop = null;
// Bundled locally (not a CDN) so no third-party script ever runs inside the app
const SCAN_LIB = 'js/vendor/html5-qrcode.min.js';

function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

function openScanner() {
  openModal(() => win('Scan Barcode', `
    <div id="scan-view" class="scan-view sunken"><video id="scan-video" playsinline muted></video><div class="scan-line"></div></div>
    <p class="muted small" id="scan-msg">Point the camera at the barcode.</p>
    <form onsubmit="return false" class="search-row">
      <input id="bc-in" class="inp grow" type="text" inputmode="numeric" placeholder="...or type the barcode number">
      ${btn('Go', 'bc-go', { type: 'submit' })}
    </form>
    <div class="btn-row">${btn('Close', 'scan-close')}</div>
  `, { cls: 'dialog', close: 'scan-close', ico: 'phone' }), { sticky: true, onClose: stopScan });
  setTimeout(startScan, 50);
}

function stopScan() {
  if (scanStop) { try { scanStop(); } catch (e) { /* ignore */ } scanStop = null; }
}

async function startScan() {
  const msg = (t) => { const m = document.getElementById('scan-msg'); if (m) m.textContent = t; };
  const done = (code) => { stopScan(); closeModal(); buzz([30, 40, 30]); lookupBarcode(code); };
  try {
    if ('BarcodeDetector' in window) {
      const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const v = document.getElementById('scan-video');
      if (!v) { stream.getTracks().forEach((t) => t.stop()); return; }
      v.srcObject = stream; await v.play();
      let live = true;
      scanStop = () => { live = false; stream.getTracks().forEach((t) => t.stop()); };
      const tick = async () => {
        if (!live) return;
        try {
          const codes = await det.detect(v);
          if (codes.length) { done(codes[0].rawValue); return; }
        } catch (e) { /* keep trying */ }
        setTimeout(tick, 200);
      };
      tick();
      return;
    }
    msg('Loading scanner...');
    await loadScript(SCAN_LIB);
    const lib = window.Html5Qrcode ? window : window.__Html5QrcodeLibrary__;
    const view = document.getElementById('scan-view');
    if (!view) return;
    view.innerHTML = '<div id="scan-reader"></div>';
    const F = lib.Html5QrcodeSupportedFormats;
    const reader = new lib.Html5Qrcode('scan-reader', { formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E], verbose: false });
    await reader.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 260, height: 120 } }, (text) => done(text), () => {});
    scanStop = () => { reader.stop().catch(() => {}); };
    msg('Point the camera at the barcode.');
  } catch (e) {
    msg('Camera not available here - type the barcode number instead.');
  }
}

on({
  'scan-close': () => { stopScan(); closeModal(); },
  'bc-go': () => { const v = document.getElementById('bc-in').value; stopScan(); closeModal(); lookupBarcode(v); },
});
