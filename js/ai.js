// AI food logging: snap a photo and/or describe a meal, and Claude estimates the macros.
// Calls the Claude API straight from the phone with the user's own API key.
// The key is stored separately from app data, so it never ends up in backup files.
import { S, save, addEntry, MEALS } from './store.js';
import { dayKey, esc, r0, num, uid, fmt, prettyDay, buzz } from './util.js';
import { win, group, btn, field, select, on, openModal, closeAllModals, rerender, drawModals, toast, confirmBox } from './ui.js';
import { icon } from './icons.js';

const KEY_STORE = 'trenches:anthropic-key';

// [model id, label, input $/1M tokens, output $/1M tokens, server-side refusal fallback available]
export const AI_MODELS = [
  ['claude-opus-5-5', 'Claude Opus 5.5 - most accurate (~3 cents/photo)', 4, 20, true],
  ['claude-sonnet-5-5', 'Claude Sonnet 5.5 - balanced (~1.5 cents/photo)', 2, 10, true],
  ['claude-haiku-5-5', 'Claude Haiku 5.5 - cheapest (under 0.2 cents/photo)', 0.1, 0.5, false],
];
const DEFAULT_MODEL = 'claude-opus-5-5';

export function getKey() {
  try { return localStorage.getItem(KEY_STORE) || ''; } catch (e) { return ''; }
}
export function setKey(k) {
  try {
    if (k) localStorage.setItem(KEY_STORE, k.trim()); else localStorage.removeItem(KEY_STORE);
  } catch (e) { /* storage blocked */ }
}
export function aiModel() {
  const m = S.settings.aiModel;
  return AI_MODELS.some((x) => x[0] === m) ? m : DEFAULT_MODEL;
}
function monthKey() { return dayKey().slice(0, 7); }
export function aiSpend() {
  const s = S.settings.aiSpend;
  return s && s.month === monthKey() ? s : { month: monthKey(), usd: 0, count: 0 };
}

// ---------- The request ----------
const SYSTEM = `You estimate nutrition for a food log used by a high school football defensive lineman. The user sends a photo of food, a description, or both.

List each distinct food or drink as its own item with a short name, the portion you estimated (household units like oz, cups, slices, pieces), and calories, protein, carbs, and fat in grams for that portion.

- When the description and the photo disagree, trust the description. The user knows what they ate, the brand, and how much.
- Judge portions from visual cues such as plate size (dinner plates are about 10-11 inches), utensils, hands, and packaging.
- For chain restaurants and packaged foods, use the published nutrition for that item and size.
- Include cooking oil, butter, sauces, and dressings that you can see or that are standard for the dish.
- If something is ambiguous, pick the most likely option and say what you assumed in notes, so the user can correct it.
- If neither the photo nor the description contains food, return no items and say so in notes.

Round calories to the nearest 5 and grams to whole numbers. Keep notes to one or two short sentences.`;

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          portion: { type: 'string' },
          calories: { type: 'number' },
          protein_g: { type: 'number' },
          carbs_g: { type: 'number' },
          fat_g: { type: 'number' },
        },
        required: ['name', 'portion', 'calories', 'protein_g', 'carbs_g', 'fat_g'],
        additionalProperties: false,
      },
    },
    notes: { type: 'string' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['items', 'notes', 'confidence'],
  additionalProperties: false,
};

let sdkPromise = null;
function loadSdk() {
  // Loaded only when the AI feature is used (about 90 KB gzipped)
  if (!sdkPromise) sdkPromise = import('./vendor/anthropic-sdk.js').catch((e) => { sdkPromise = null; throw e; });
  return sdkPromise;
}

async function analyze({ b64, desc }) {
  const { Anthropic, betaJSONSchemaOutputFormat } = await loadSdk();
  const client = new Anthropic({ apiKey: getKey(), dangerouslyAllowBrowser: true, maxRetries: 2, timeout: 90 * 1000 });
  const model = aiModel();
  const info = AI_MODELS.find((m) => m[0] === model);
  const content = [];
  if (b64) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } });
  content.push({
    type: 'text',
    text: [
      b64 ? 'Photo attached.' : 'No photo - estimate from the description.',
      desc ? `Description from the user: ${desc}` : 'No description - estimate from the photo.',
    ].join('\n'),
  });
  const params = {
    model,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { effort: 'low', format: betaJSONSchemaOutputFormat(SCHEMA) },
    messages: [{ role: 'user', content }],
  };
  // If the model declines (rare), the API re-runs the request on a fallback model.
  if (info && info[4]) Object.assign(params, { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });

  try {
    const msg = await client.beta.messages.parse(params);
    const used = AI_MODELS.find((m) => m[0] === msg.model) || info;
    const u = msg.usage || {};
    const cost = used ? ((u.input_tokens || 0) * used[2] + (u.output_tokens || 0) * used[3]) / 1e6 : 0;
    if (msg.stop_reason === 'refusal') return { error: 'Claude couldn\'t analyze that one. Try a different photo or just describe the food.', cost };
    if (msg.stop_reason === 'max_tokens' || !msg.parsed_output) return { error: 'The answer got cut off. Tap Analyze again.', cost };
    return { result: msg.parsed_output, cost };
  } catch (e) {
    const A = Anthropic;
    if (e instanceof A.AuthenticationError) return { error: 'Your API key was rejected. Check it in Control Panel > AI Food Scanner.', badKey: true };
    if (e instanceof A.PermissionDeniedError) return { error: 'This API key isn\'t allowed to use that model. Try another model in Control Panel.' };
    if (e instanceof A.RateLimitError) return { error: 'Too many requests right now. Wait a minute and try again.' };
    if (e instanceof A.BadRequestError) return { error: `The API said: ${e.message}. If it mentions credit balance, add credits in the Claude Console.` };
    if (e instanceof A.APIConnectionError) return { error: 'Couldn\'t reach Claude - check your signal and try again.' };
    if (e instanceof A.APIError) return { error: `Claude API error (${e.status || 'unknown'}). Try again in a moment.` };
    throw e;
  }
}

// Shrink the photo before upload: faster on cell data and fewer tokens (cheaper)
function prepImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 1092;
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const dataUrl = c.toDataURL('image/jpeg', 0.82);
      resolve({ dataUrl, b64: dataUrl.slice(dataUrl.indexOf(',') + 1) });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image')); };
    img.src = url;
  });
}

// ---------- UI ----------
const ai = { meal: 'Lunch', date: dayKey(), photo: null, desc: '', status: 'idle', items: [], notes: '', confidence: '', error: '', cost: 0 };

export function openAI(meal, date) {
  Object.assign(ai, { meal: meal || 'Lunch', date: date || dayKey(), photo: null, desc: '', status: 'idle', items: [], notes: '', confidence: '', error: '', cost: 0 });
  openModal(renderAI, { full: true });
}

function keySetup(inSettings = false) {
  return `
    <ol class="steps">
      <li>Go to <b>platform.claude.com</b> (the Claude Console) and sign in or make an account.</li>
      <li>Add a few dollars of credit under <b>Billing</b>. $5 covers hundreds of photos.</li>
      <li>Open <b>API keys</b>, tap <b>Create key</b>, and copy it.</li>
      <li>Paste it below.</li>
    </ol>
    <form onsubmit="return false" class="search-row">
      <input id="ai-key" class="inp grow" type="password" autocomplete="off" placeholder="sk-ant-..." value="">
      ${btn('Save key', inSettings ? 'ai-key-save-settings' : 'ai-key-save', { cls: 'primary', type: 'submit' })}
    </form>
    <p class="muted small">The API is billed separately from a Claude app subscription. Set a monthly spend limit in the Console so it can never surprise you. Your key stays on this phone and isn't included in backups.</p>`;
}

function renderAI() {
  const meals = MEALS.map((m) => [m, m]);
  if (!getKey()) {
    return win('AI Food Scanner', `
      <p>Snap a photo of your food (and/or describe it) and Claude estimates the calories and macros for you.</p>
      ${group('One-time setup: API key', keySetup())}
      <div class="btn-row">${btn('Close', 'modal-close', { cls: 'grow' })}</div>
    `, { cls: 'full-win', close: 'modal-close', ico: 'camera' });
  }

  const busy = ai.status === 'loading';
  const photo = ai.photo
    ? `<div class="ai-photo sunken ${ai.status === 'idle' ? '' : 'thumb'}"><img src="${ai.photo.dataUrl}" alt="Your food"></div>
       <div class="btn-row tight">
         <label class="btn">${icon('camera', 16)}<span>Retake</span><input type="file" accept="image/*" hidden data-change="ai-file"></label>
         ${btn('Remove photo', 'ai-photo-del')}
       </div>`
    : `<label class="btn ai-snap">${icon('camera', 32)}<span>Take or choose a photo</span><input type="file" accept="image/*" hidden data-change="ai-file"></label>`;

  let out = '';
  if (busy) {
    out = `<div class="ai-busy">${icon('hourglass', 16)} Claude is looking at your food...</div><div class="progress marquee"><div class="fill"></div></div>`;
  } else if (ai.status === 'error') {
    out = `<div class="alert">${icon('warn', 16)} ${esc(ai.error)}</div>`;
  } else if (ai.status === 'done') {
    const on = ai.items.filter((x) => x.on);
    const t = on.reduce((a, x) => ({ cal: a.cal + num(x.cal), p: a.p + num(x.p), c: a.c + num(x.c), f: a.f + num(x.f) }), { cal: 0, p: 0, c: 0, f: 0 });
    out = group(`Claude's estimate <span class="tag conf-${esc(ai.confidence)}">${esc(ai.confidence || '?')} confidence</span>`, `
      ${ai.items.length ? `<div class="ai-items">
        ${ai.items.map((x, i) => `
          <div class="ai-row ${x.on ? '' : 'off'}">
            <label class="check inline"><input type="checkbox" data-change="ai-on" data-i="${i}" ${x.on ? 'checked' : ''}><span class="sr">Include</span></label>
            <div class="ai-body">
              <input class="inp ai-name" value="${esc(x.name)}" data-change="ai-item" data-i="${i}" data-k="name" aria-label="Food name">
              <small class="muted">${esc(x.portion)}</small>
              <div class="ai-nums">${[['cal', 'kcal'], ['p', 'Protein'], ['c', 'Carbs'], ['f', 'Fat']].map(([k, l]) => `<label><span>${l}</span><input class="inp" type="number" inputmode="decimal" value="${r0(x[k])}" data-change="ai-item" data-i="${i}" data-k="${k}"></label>`).join('')}</div>
            </div>
          </div>`).join('')}
      </div>
      <div class="ai-total"><b>Total</b><span><b class="vt">${fmt(t.cal)}</b> kcal</span><span>P ${r0(t.p)}g · C ${r0(t.c)}g · F ${r0(t.f)}g</span></div>` : '<p class="empty">No food found.</p>'}
      ${ai.notes ? `<p class="why">${esc(ai.notes)}</p>` : ''}
      <p class="muted small">Numbers look off? Fix them above, or add details to the description and tap Analyze again. This one cost about ${ai.cost < 0.01 ? 'less than 1 cent' : `${(ai.cost * 100).toFixed(1)} cents`}.</p>
      ${on.length ? `<div class="btn-row">${btn(`Add ${on.length} item${on.length > 1 ? 's' : ''} to ${esc(ai.meal)}`, 'ai-add', { cls: 'primary grow', ico: 'check' })}</div>` : ''}`);
  }

  return win('AI Food Scanner', `
    ${photo}
    ${field('Describe it (optional, but helps a lot)', `<textarea id="ai-desc" class="inp" rows="2" data-input="ai-desc" placeholder="e.g. 2 chicken thighs, big scoop of rice, 16oz chocolate milk">${esc(ai.desc)}</textarea>`)}
    <div class="select-meal">Meal: ${select('meal', meals, ai.meal, { data: 'data-change="ai-meal"' })} <span class="muted">${esc(prettyDay(ai.date))}</span></div>
    <div class="btn-row">${btn(busy ? 'Analyzing...' : ai.status === 'done' ? 'Analyze again' : 'Analyze', 'ai-run', { cls: 'primary grow', disabled: busy, ico: 'camera' })}</div>
    <div id="ai-out">${out}</div>
    <p class="muted small">Photos and descriptions are sent to Claude (Anthropic) to estimate nutrition. Estimates can be off, especially on portions - glance over them.</p>
  `, { cls: 'full-win', close: 'modal-close', ico: 'camera' });
}

function keyFromInput() {
  const el = document.getElementById('ai-key');
  const k = el ? el.value.trim() : '';
  if (!/^sk-ant-/.test(k)) { toast('That doesn\'t look like a Claude API key (starts with sk-ant-)', 'warn'); return null; }
  return k;
}

on({
  'ai-open': (el) => openAI(el.dataset.meal, el.dataset.date),
  'ai-key-save': () => { const k = keyFromInput(); if (!k) return; setKey(k); toast('Key saved', 'check'); drawModals(); },
  'ai-key-save-settings': () => { const k = keyFromInput(); if (!k) return; setKey(k); toast('Key saved', 'check'); rerender(); },
  'ai-key-remove': async () => {
    if (!(await confirmBox('Remove your Claude API key from this phone?'))) return;
    setKey(''); rerender();
  },
  'ai-model': (el) => { S.settings.aiModel = el.value; save(); },
  'ai-file': async (el) => {
    const f = el.files && el.files[0];
    if (!f) return;
    try {
      ai.photo = await prepImage(f);
      if (ai.status !== 'loading') ai.status = 'idle';
    } catch (e) { toast('Couldn\'t open that photo', 'warn'); }
    drawModals();
  },
  'ai-photo-del': () => { ai.photo = null; drawModals(); },
  'ai-desc': (el) => { ai.desc = el.value; },
  'ai-meal': (el) => { ai.meal = el.value; },
  'ai-run': async () => {
    const d = document.getElementById('ai-desc');
    if (d) ai.desc = d.value;
    if (!ai.photo && !ai.desc.trim()) { toast('Add a photo or describe the food', 'warn'); return; }
    if (!navigator.onLine) { toast('You\'re offline - AI needs signal', 'warn'); return; }
    ai.status = 'loading'; ai.error = '';
    drawModals();
    let r;
    try {
      r = await analyze({ b64: ai.photo && ai.photo.b64, desc: ai.desc.trim() });
    } catch (e) {
      r = { error: 'Something went wrong talking to Claude. Try again.' };
    }
    if (r.cost) {
      const s = aiSpend();
      S.settings.aiSpend = { month: s.month, usd: s.usd + r.cost, count: s.count + 1 };
      save();
    }
    if (r.error) {
      Object.assign(ai, { status: 'error', error: r.error });
    } else {
      const res = r.result;
      Object.assign(ai, {
        status: 'done', cost: r.cost || 0, notes: res.notes || '', confidence: res.confidence || '',
        items: (res.items || []).map((x) => ({ on: true, name: x.name, portion: x.portion, cal: x.calories, p: x.protein_g, c: x.carbs_g, f: x.fat_g })),
      });
      buzz(20);
    }
    drawModals();
    const res = document.getElementById('ai-out');
    if (res) res.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  'ai-on': (el) => { ai.items[el.dataset.i].on = el.checked; drawModals(); },
  'ai-item': (el) => {
    const x = ai.items[el.dataset.i];
    x[el.dataset.k] = el.dataset.k === 'name' ? el.value : num(el.value, 0);
    drawModals();
  },
  'ai-add': () => {
    const on = ai.items.filter((x) => x.on);
    for (const x of on) {
      // give AI items an id so they show up in Recent for one-tap re-logging
      const food = { id: 'ai:' + uid(), name: x.name, serving: x.portion || '1 serving', cal: r0(x.cal), p: r0(x.p), c: r0(x.c), f: r0(x.f), cat: 'AI estimate' };
      addEntry(ai.date, food, 1, ai.meal);
    }
    toast(`Added ${on.length} item${on.length > 1 ? 's' : ''} to ${esc(ai.meal)}`, 'check');
    closeAllModals(); rerender();
  },
});

// Control Panel section
export function aiSettingsGroup() {
  const has = !!getKey();
  const s = aiSpend();
  return group('AI Food Scanner', has
    ? `<p class="ok-line">${icon('check', 16)} API key saved on this phone</p>
       ${field('Model', select('aiModel', AI_MODELS.map((m) => [m[0], m[1]]), aiModel(), { data: 'data-change="ai-model"' }))}
       <p class="muted small">This month: ${s.count} scan${s.count === 1 ? '' : 's'}, about $${s.usd.toFixed(2)}.</p>
       <div class="btn-row">${btn('Open scanner', 'ai-open', { ico: 'camera' })}${btn('Remove key', 'ai-key-remove', { cls: 'danger' })}</div>`
    : `<p>Take a photo of your food and Claude estimates the macros. Needs your own Claude API key (pay-as-you-go, a few cents per photo).</p>${keySetup(true)}`);
}
