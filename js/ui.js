// Win9x-style UI building blocks + modal stack + action registry.
import { icon } from './icons.js';
import { esc, clamp, r0 } from './util.js';

// ---------- Action registry (event delegation) ----------
// Any element with data-act="name" calls actions[name](el, event) on click.
// Inputs/selects with data-change="name" call actions[name](el, event) on change.
export const actions = {};
export function on(map) { Object.assign(actions, map); }

let rerenderFn = () => {};
let navFn = (hash) => { location.hash = hash; };
export function setNavigate(fn) { navFn = fn; }
// Navigate without the async hashchange closing dialogs opened right after
export function go(hash) { navFn(hash); }
export function setRerender(fn) { rerenderFn = fn; }
export function rerender() { rerenderFn(); }

// ---------- Building blocks ----------
export function win(title, body, { ico = '', cls = '', close = '', id = '' } = {}) {
  return `
  <section class="win ${cls}" ${id ? `id="${id}"` : ''}>
    <header class="titlebar">
      ${ico ? `<span class="tb-ico">${icon(ico, 16)}</span>` : ''}
      <span class="tb-title">${title}</span>
      <span class="tb-btns">
        ${close ? `<button class="tb-btn" data-act="${close}" aria-label="Close">${icon('close', 8)}</button>` : `<span class="tb-btn deco">${icon('min', 8)}</span><span class="tb-btn deco">${icon('max', 8)}</span>`}
      </span>
    </header>
    <div class="win-body">${body}</div>
  </section>`;
}

export function group(label, body, { cls = '', right = '' } = {}) {
  return `<section class="group ${cls} ${right ? 'has-right' : ''}"><div class="group-title">${label}</div>${right ? `<div class="group-right">${right}</div>` : ''}${body}</section>`;
}

// Segmented Win95 progress bar
// cap: going past max is a problem (turns red). Off for goals where more is fine (fiber, potassium).
export function bar(value, max, { cls = '', label = '', cap = true } = {}) {
  value = Number.isFinite(value) ? value : 0;
  const pct = max > 0 ? clamp((value / max) * 100, 0, 100) : 0;
  const over = cap && max > 0 && value > max * 1.05;
  return `<div class="progress ${cls} ${over ? 'over' : ''}" role="progressbar" aria-valuenow="${r0(value)}" aria-valuemax="${r0(max)}" ${label ? `aria-label="${esc(label)}"` : ''}><div class="fill" style="width:${pct}%"></div></div>`;
}

export function btn(label, act, { cls = '', data = '', ico = '', type = 'button', disabled = false } = {}) {
  return `<button type="${type}" class="btn ${cls}" data-act="${act}" ${data} ${disabled ? 'disabled' : ''}>${ico ? icon(ico, 16) : ''}${ico && label ? '<span>' + label + '</span>' : label}</button>`;
}

export function field(label, inner, { hint = '' } = {}) {
  return `<label class="field"><span class="field-label">${label}</span>${inner}${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
}

export function numInput(name, value, { step = 'any', min = '', max = '', placeholder = '', cls = '', data = '' } = {}) {
  return `<input class="inp ${cls}" type="number" inputmode="decimal" step="${step}" ${min !== '' ? `min="${min}"` : ''} ${max !== '' ? `max="${max}"` : ''} name="${name}" value="${value ?? ''}" placeholder="${placeholder}" ${data}>`;
}

export function select(name, options, value, { data = '' } = {}) {
  return `<select class="inp" name="${name}" ${data}>${options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
}

export function dayPicker(name, days) {
  const L = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return `<div class="daypick">${L.map((l, i) => `<label class="daybox"><input type="checkbox" name="${name}" value="${i}" ${days.includes(i) ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`;
}

export function formData(root) {
  const out = {};
  root.querySelectorAll('input, select, textarea').forEach((el) => {
    if (!el.name) return;
    if (el.type === 'checkbox') {
      if (el.value && el.value !== 'on') {
        out[el.name] = out[el.name] || [];
        if (el.checked) out[el.name].push(el.value);
      } else out[el.name] = el.checked;
    } else if (el.type === 'radio') {
      if (el.checked) out[el.name] = el.value;
    } else out[el.name] = el.value;
  });
  return out;
}

// ---------- Modals ----------
const stack = [];
const root = () => document.getElementById('modals');

export function openModal(render, opts = {}) {
  stack.push({ render, opts });
  drawModals();
  return stack.length;
}
export function closeModal() {
  const m = stack.pop();
  if (m && m.opts.onClose) m.opts.onClose();
  drawModals();
}
export function closeAllModals() {
  while (stack.length) stack.pop();
  drawModals();
}
export function modalOpen() { return stack.length > 0; }

export function drawModals() {
  const el = root();
  if (!el) return;
  if (!stack.length) { el.innerHTML = ''; document.body.classList.remove('has-modal'); return; }
  document.body.classList.add('has-modal');
  // Keep scroll position of the top modal body across re-renders
  const prevBody = el.querySelector('.modal-wrap:last-child .win-body');
  const prevScroll = prevBody ? prevBody.scrollTop : 0;
  const prevCount = el.children.length;
  el.innerHTML = stack.map((m, i) => `<div class="modal-wrap ${m.opts.full ? 'full' : ''}" style="z-index:${100 + i}" data-modal="${i}"><div class="modal-back" ${m.opts.sticky ? '' : 'data-act="modal-close"'}></div>${m.render()}</div>`).join('');
  if (prevCount === stack.length) {
    const body = el.querySelector('.modal-wrap:last-child .win-body');
    if (body) body.scrollTop = prevScroll;
  } else {
    const auto = el.querySelector('.modal-wrap:last-child [autofocus]');
    if (auto && !('ontouchstart' in window)) setTimeout(() => auto.focus(), 30);
  }
}

on({ 'modal-close': () => closeModal() });

// Win95 message box. Returns a promise of the clicked button value.
export function msgBox({ title = 'Macros', text = '', ico = 'warn', buttons = [['OK', true]] }) {
  return new Promise((resolve) => {
    const id = 'mb' + Math.random().toString(36).slice(2, 7);
    on({
      // resolve BEFORE closing: closing fires onClose, which would resolve(false) first
      [id]: (el) => { resolve(el.dataset.v === 'true' ? true : el.dataset.v === 'false' ? false : el.dataset.v); closeModal(); },
    });
    openModal(() => win(esc(title), `
      <div class="msgbox"><div class="msgbox-ico">${icon(ico, 32)}</div><div class="msgbox-text">${text}</div></div>
      <div class="btn-row center">${buttons.map(([l, v]) => `<button class="btn" data-act="${id}" data-v="${v}">${l}</button>`).join('')}</div>`,
    { cls: 'dialog', close: 'modal-close' }), { sticky: true, onClose: () => resolve(false) });
  });
}
export const confirmBox = (text, title = 'Confirm', yes = 'Yes', ico = 'warn') =>
  msgBox({ title, text, ico, buttons: [[yes, true], ['Cancel', false]] });

export function promptBox({ title = 'Macros', label = '', value = '', type = 'text', placeholder = '' }) {
  return new Promise((resolve) => {
    const id = 'pb' + Math.random().toString(36).slice(2, 7);
    on({
      [id]: (el) => {
        const v = el.dataset.v === 'ok' ? document.getElementById(id + '-in').value : null;
        resolve(v); closeModal();
      },
    });
    openModal(() => win(esc(title), `
      <form onsubmit="return false">
        ${field(label, `<input id="${id}-in" class="inp" type="${type}" ${type === 'number' ? 'inputmode="decimal" step="any"' : ''} value="${esc(value)}" placeholder="${esc(placeholder)}" autofocus>`)}
        <div class="btn-row center"><button type="submit" class="btn" data-act="${id}" data-v="ok">OK</button><button type="button" class="btn" data-act="${id}" data-v="cancel">Cancel</button></div>
      </form>`, { cls: 'dialog', close: 'modal-close' }), { sticky: true, onClose: () => resolve(null) });
  });
}

// ---------- Toast (balloon tip) ----------
let toastTimer;
export function toast(text, ico = 'check') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.innerHTML = `${icon(ico, 16)}<span>${text}</span>`;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ---------- Sound ----------
let ctx;
export function beep(freqs = [880, 660, 880], dur = 0.12) {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    let t = ctx.currentTime;
    for (const f of freqs) {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'square'; o.frequency.value = f;
      g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + dur);
      t += dur + 0.03;
    }
  } catch (e) { /* no audio */ }
}
// iOS needs audio unlocked from a user gesture
export function unlockAudio() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) { /* ignore */ }
}
