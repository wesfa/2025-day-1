// Small shared helpers: dates, formatting, escaping, files.

export const pad2 = (n) => String(n).padStart(2, '0');

// Local-date key "YYYY-MM-DD" (never UTC, so late-night logs land on the right day)
export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
export function parseDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(key, n) {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}
export function daysBetween(a, b) {
  return Math.round((parseDay(b) - parseDay(a)) / 86400000);
}
export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DOW1 = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function prettyDay(key, { short = false } = {}) {
  const today = dayKey();
  if (key === today) return 'Today';
  if (key === addDays(today, -1)) return 'Yesterday';
  if (key === addDays(today, 1)) return 'Tomorrow';
  const d = parseDay(key);
  return short ? `${MON[d.getMonth()]} ${d.getDate()}` : `${DOW[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`;
}
export function shortDate(key) {
  const d = parseDay(key);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
export function longDate(d) {
  return `${DOW[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`;
}

// "HH:MM" <-> minutes since midnight
export const toMin = (hhmm) => {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
export const fromMin = (min) => {
  min = Math.max(0, Math.min(1439, Math.round(min)));
  return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
};
export function fmtTime(hhmm) {
  const m = toMin(hhmm);
  let h = Math.floor(m / 60);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${pad2(m % 60)} ${ap}`;
}
export function clockNow() {
  const d = new Date();
  return fmtTime(`${d.getHours()}:${d.getMinutes()}`);
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const r0 = (n) => Math.round(n || 0);
export const r1 = (n) => Math.round((n || 0) * 10) / 10;
export const num = (v, fallback = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};
export const fmt = (n) => r0(n).toLocaleString('en-US');
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function fmtDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${pad2(m)}:${pad2(sec)}` : `${m}:${pad2(sec)}`;
}

// Save/share a file. Uses the share sheet on phones when possible, else a download.
export async function saveFile(name, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  try {
    const file = new File([blob], name, { type });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
      await navigator.share({ files: [file], title: name });
      return true;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return false;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}

export const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isAndroid = () => /Android/i.test(navigator.userAgent);
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// ---------- Haptics ----------
// Android and most browsers: the Vibration API. iPhone Safari has no vibrate(), but on iOS 18+ flipping a native
// switch control plays the system "tick", so we keep one hidden switch and click its label. Older iPhones stay quiet.
export const HAPTIC = { tap: 8, press: 14, success: [14, 80, 22], warn: [24, 60, 24, 60, 24] };
let hapticsOn = true;
let hapticCount = 0;
let iosSwitch = null;
export function setHaptics(on) { hapticsOn = on !== false; }
export const hapticsUsed = () => hapticCount;

function iosTick() {
  if (!iosSwitch) {
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;left:0;bottom:0;width:1px;height:1px;opacity:0;overflow:hidden;pointer-events:none;';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.appendChild(input);
    // keep these synthetic clicks away from the app's own tap handling
    for (const ev of ['click', 'change', 'input']) label.addEventListener(ev, (e) => e.stopPropagation());
    document.body.appendChild(label);
    iosSwitch = label;
  }
  iosSwitch.click();
}

// buzz(ms) or buzz([on, off, on, ...]). On iPhone each "on" part becomes one tick (up to three).
export function buzz(pattern = HAPTIC.press) {
  if (!hapticsOn) return;
  hapticCount++;
  try {
    if (typeof navigator.vibrate === 'function') { navigator.vibrate(pattern); return; }
    if (!isIOS()) return;
    const p = Array.isArray(pattern) ? pattern : [pattern];
    iosTick();  // the first tick right away, while the tap still counts as a user action
    let t = 0;
    for (let i = 2; i < p.length && i <= 4; i += 2) {
      t += Math.max(90, (p[i - 2] || 0) + (p[i - 1] || 0));
      setTimeout(iosTick, t);
    }
  } catch (e) { /* haptics are a nice-to-have */ }
}
