// Live sky for the City scheme: paints the wallpaper for the time of day (dawn, day, dusk, night) and the
// weather where you live. The four times of day are the same city painted four ways (art/city/*-<phase>.png);
// two copies of each layer cross-fade, the sun arcs from sunrise to sunset and sets behind the skyline, and
// the moon - drawn as a thin ring of light that follows the real moon phase - comes out at night.
//
// Sunrise / sunset come from the weather service when there is a location, otherwise from a solar formula
// (with the location guessed from the phone's time zone if none is set). Weather comes from Open-Meteo
// (free, no account): only the location rounded to about 10 km is sent, never anything from the app.
import { S, save } from './store.js';

const ART = 'art/city/';
const PHASES = ['dawn', 'day', 'golden', 'dusk', 'night'];
// [element class, image name]: each painted five ways (art/city/<image>-<phase>.png)
const LAYERS = [['sky', 'sky'], ['pyramid', 'pyramid'], ['far', 'far'], ['haze2', 'haze'], ['mid', 'mid'], ['haze', 'haze'],
  ['near', 'near'], ['side', 'side'], ['water', 'water'], ['ref-a', 'ref-a'], ['ref-b', 'ref-b'], ['dock', 'dock'],
  // animation overlays (tools/city_anim.py): extra water frames, windows switching on/off, sign flicker, beacons
  ['ref-c', 'ref-c'], ['ref-d', 'ref-d'],
  ['mid-wa', 'mid-wa'], ['mid-wb', 'mid-wb'],
  ['near-wa', 'near-wa'], ['near-wb', 'near-wb'], ['near-wc', 'near-wc'], ['near-nx', 'near-nx'], ['near-kx', 'near-kx'],
  ['side-wa', 'side-wa'], ['side-wb', 'side-wb'], ['side-nx', 'side-nx'], ['side-kx', 'side-kx']];
const WX_KEY = 'macros:weather';
const PREVIEW_KEY = 'macros:sky-preview';
const MIN = 60000;
const HOUR = 3600000;

export const TIME_PREVIEWS = [['', 'Live'], ['dawn', 'Sunrise'], ['day', 'Day'], ['golden', 'Golden hour'], ['dusk', 'Sunset'], ['night', 'Night']];
export const WEATHER_PREVIEWS = [['', 'Live'], ['clear', 'Clear'], ['partly', 'Some clouds'], ['overcast', 'Overcast'], ['fog', 'Fog'], ['rain', 'Rain'], ['snow', 'Snow'], ['storm', 'Thunderstorm']];
export const WEATHER_LABEL = { clear: 'Clear', partly: 'Partly cloudy', overcast: 'Cloudy', fog: 'Fog', drizzle: 'Drizzle', rain: 'Rain', snow: 'Snow', storm: 'Thunderstorm' };
const PHASE_LABEL = { dawn: 'Sunrise', day: 'Day', golden: 'Golden hour', dusk: 'Sunset', night: 'Night' };

const round1 = (n) => Math.round(n * 10) / 10;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  sget(k) { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (e) { return null; } },
  sset(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
};

export function skySettings() {
  if (!S.settings.sky) S.settings.sky = { weather: true };
  return S.settings.sky;
}

// ---------------------------------------------------------------- sun + moon maths
// Sunrise equation (NOAA-style, about a minute of accuracy). lon is east-positive.
export function sunTimes(day, lat, lon) {
  const rad = Math.PI / 180;
  const noon = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12).getTime();
  const n = Math.round(noon / 86400000 + 2440587.5 - 2451545.0 + 0.0008);
  const Js = n - lon / 360;
  const M = (357.5291 + 0.98560028 * Js) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const L = (M + C + 180 + 102.9372) % 360;
  const Jt = 2451545.0 + Js + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad);
  const dec = Math.asin(Math.sin(L * rad) * Math.sin(23.4397 * rad));
  const cosW = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * Math.sin(dec)) / (Math.cos(lat * rad) * Math.cos(dec));
  const toMs = (J) => (J - 2440587.5) * 86400000;
  if (cosW > 1) return { rise: toMs(Jt) - 1, set: toMs(Jt) + 1 };          // polar night: a moment of "day"
  if (cosW < -1) return { rise: toMs(Jt) - 12 * HOUR, set: toMs(Jt) + 12 * HOUR }; // midnight sun
  const w = Math.acos(cosW) / rad;
  return { rise: toMs(Jt - w / 360), set: toMs(Jt + w / 360) };
}

// Where to compute from: the saved location, or a guess from the time zone (38 N, longitude from the UTC offset)
function place() {
  const loc = S.settings.loc;
  if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lon)) return { lat: loc.lat, lon: loc.lon, guessed: false };
  return { lat: 38, lon: -new Date().getTimezoneOffset() / 4, guessed: true };
}

// Sunrise / sunset for the day containing `now`: from the weather data if it covers that day, otherwise computed
export function sunFor(now) {
  const d = new Date(now);
  const wx = readWx();
  if (wx && wx.days && isSameLoc(wx)) {
    const hit = wx.days.find((x) => new Date(x.rise).toDateString() === d.toDateString());
    if (hit) return { rise: hit.rise, set: hit.set, src: 'weather' };
  }
  const p = place();
  return { ...sunTimes(d, p.lat, p.lon), src: p.guessed ? 'guess' : 'calc' };
}

// Moon: age in the 29.53-day cycle from a known new moon; returns sprite 1-4 (crescent..full), mirrored when waning
export function moonPhase(now) {
  const age = (((now - Date.UTC(2000, 0, 6, 18, 14)) / 86400000) % 29.530588853 + 29.530588853) % 29.530588853 / 29.530588853;
  const lit = (1 - Math.cos(2 * Math.PI * age)) / 2;
  const sprite = lit < 0.375 ? 1 : lit < 0.625 ? 2 : lit < 0.875 ? 3 : 4;
  return { age, lit, sprite, waning: age > 0.5 };
}

// Which two paintings to show and how far along the fade is.
export function phaseMix(now, rise, set) {
  const k = [
    [rise - 50 * MIN, 'night'], [rise - 15 * MIN, 'dawn'], [rise + 20 * MIN, 'dawn'], [rise + 75 * MIN, 'day'],
    [set - 100 * MIN, 'day'], [set - 55 * MIN, 'golden'], [set - 22 * MIN, 'golden'], [set + 2 * MIN, 'dusk'],
    [set + 25 * MIN, 'dusk'], [set + 70 * MIN, 'night'],
  ];
  if (now < k[0][0] || now >= k[k.length - 1][0]) return { a: 'night', b: 'night', t: 0 };
  for (let i = 0; i < k.length - 1; i++) {
    if (now < k[i + 1][0]) {
      const [t0, a] = k[i]; const [t1, b] = k[i + 1];
      return a === b ? { a, b, t: 0 } : { a, b, t: clamp((now - t0) / (t1 - t0), 0, 1) };
    }
  }
  return { a: 'night', b: 'night', t: 0 };
}

// ---------------------------------------------------------------- weather
function readWx() { return store.get(WX_KEY); }
function isSameLoc(wx) { const l = S.settings.loc; return l && wx.lat === l.lat && wx.lon === l.lon; }

export function wxKind(code) {
  if (code == null || code <= 1) return 'clear';
  if (code === 2) return 'partly';
  if (code === 3) return 'overcast';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'clear';
}

// The weather right now: the forecast hour we're in (good for a few hours offline), else the last reading
export function currentWeather(now = Date.now()) {
  const wx = readWx();
  if (!wx || !isSameLoc(wx) || skySettings().weather === false) return null;
  const hour = (wx.hourly || []).find((h) => now >= h.t && now < h.t + HOUR);
  if (hour && now - wx.at < 12 * HOUR) return { kind: wxKind(hour.code), cloud: hour.cloud, temp: wx.temp, at: wx.at, code: hour.code };
  if (wx.current && now - wx.at < 3 * HOUR) return { kind: wxKind(wx.current.code), cloud: wx.current.cloud, temp: wx.temp, at: wx.at, code: wx.current.code };
  return null;
}

let fetching = null;
export function refreshWeather(force = false) {
  const loc = S.settings.loc;
  if (!loc || skySettings().weather === false) return Promise.resolve(false);
  const wx = readWx();
  if (!force && wx && isSameLoc(wx) && Date.now() - wx.at < 30 * MIN) return Promise.resolve(false);
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve(false);
  if (fetching) return fetching;
  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${loc.lat}&longitude=${loc.lon}`
    + '&current=temperature_2m,weather_code,cloud_cover&hourly=weather_code,cloud_cover&daily=sunrise,sunset'
    + '&timezone=auto&forecast_days=2&temperature_unit=fahrenheit';
  fetching = fetch(url)
    .then((r) => { if (!r.ok) throw new Error('weather ' + r.status); return r.json(); })
    .then((j) => {
      const off = (j.utc_offset_seconds || 0) * 1000;
      // the service gives local times like "2026-11-25T07:01"; turn them into real instants
      const t = (s) => { const [d, hm = '00:00'] = String(s).split('T'); const [Y, M, D] = d.split('-').map(Number); const [h, mi] = hm.split(':').map(Number); return Date.UTC(Y, M - 1, D, h, mi) - off; };
      const days = (j.daily && j.daily.time || []).map((d, i) => ({ rise: t(j.daily.sunrise[i]), set: t(j.daily.sunset[i]) }));
      const hourly = (j.hourly && j.hourly.time || []).map((h, i) => ({ t: t(h), code: j.hourly.weather_code[i], cloud: j.hourly.cloud_cover[i] }));
      const cur = j.current || {};
      store.set(WX_KEY, { at: Date.now(), lat: loc.lat, lon: loc.lon, temp: cur.temperature_2m, current: { code: cur.weather_code, cloud: cur.cloud_cover }, hourly, days });
      applySky();
      return true;
    })
    .catch((e) => { console.warn('weather failed', e); return false; })
    .finally(() => { fetching = null; });
  return fetching;
}

export function setLocation(lat, lon, name, src) {
  S.settings.loc = { lat: round1(lat), lon: round1(lon), name: name || '', src };
  save(true);
  applySky();
  return refreshWeather(true);
}

export function forgetLocation() {
  S.settings.loc = null;
  save(true);
  try { localStorage.removeItem(WX_KEY); } catch (e) { /* ignore */ }
  applySky();
}

export function useMyLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Location is not available on this device.')); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocation(pos.coords.latitude, pos.coords.longitude, '', 'gps').then(() => resolve(S.settings.loc)); },
      (err) => reject(new Error(err && err.code === 1 ? 'Location permission was turned down. You can search for your town instead.' : 'Could not get your location. Try again or search for your town.')),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 6 * HOUR },
    );
  });
}

export async function searchPlaces(q) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`);
  if (!r.ok) throw new Error('search ' + r.status);
  const j = await r.json();
  return (j.results || []).map((p) => ({ name: [p.name, p.admin1, p.country_code].filter(Boolean).join(', '), lat: p.latitude, lon: p.longitude }));
}

// ---------------------------------------------------------------- preview (this session only)
export function getPreview() { return store.sget(PREVIEW_KEY) || { time: '', weather: '' }; }
export function setPreview(p) { store.sset(PREVIEW_KEY, { ...getPreview(), ...p }); applySky(); }

// ---------------------------------------------------------------- what to draw
export function skyState(nowReal = Date.now()) {
  const pv = getPreview();
  let now = nowReal;
  let sun = sunFor(nowReal);
  if (pv.time) {
    const span = sun.set - sun.rise;
    now = { dawn: sun.rise + 2 * MIN, day: sun.rise + span * 0.36, golden: sun.set - 38 * MIN, dusk: sun.set + 12 * MIN, night: sun.set + 4 * HOUR }[pv.time] || nowReal;
  }
  // after sunset, the moon's night runs to tomorrow's sunrise; before sunrise, from yesterday's sunset
  const mix = phaseMix(now, sun.rise, sun.set);
  const w = { dawn: 0, day: 0, golden: 0, dusk: 0, night: 0 };
  w[mix.a] += 1 - mix.t; w[mix.b] += mix.t;
  const f = (now - sun.rise) / (sun.set - sun.rise);
  const nightStart = now >= sun.set ? sun.set : sun.set - 24 * HOUR;
  const nightEnd = now >= sun.set ? sun.rise + 24 * HOUR : sun.rise;
  const g = (now - nightStart) / (nightEnd - nightStart);
  const real = currentWeather(nowReal);
  const kind = pv.weather || (real ? real.kind : 'clear');
  const cloud = pv.weather ? { clear: 5, partly: 45, overcast: 100, fog: 80, rain: 100, snow: 100, storm: 100 }[kind] : real ? real.cloud : 0;
  return { now, mix, w, f, g, sun, moon: moonPhase(now), kind, cloud: cloud ?? 0, temp: real ? real.temp : null, real, preview: !!(pv.time || pv.weather) };
}

export function skyLabel(st = skyState()) {
  return PHASE_LABEL[st.mix.t < 0.5 ? st.mix.a : st.mix.b];
}

// ---------------------------------------------------------------- the scene
let built = false;
let active = false;
let timer = null;

function build() {
  const scene = document.getElementById('scene');
  if (!scene || built) return;
  const pair = (l) => `<i class="cl cl-${l} pa"></i><i class="cl cl-${l} pb"></i>`;
  // an overlay sits exactly on its layer (same size and position), so it gets that layer's class too
  const over = (base, ...names) => names.map((n) => `<i class="cl cl-${base} ov cl-${base}-${n} pa"></i><i class="cl cl-${base} ov cl-${base}-${n} pb"></i>`).join('');
  const html = `
    <div id="city" aria-hidden="true">
      ${pair('sky')}
      <i class="cx cx-stars a"></i><i class="cx cx-stars b"></i><i class="cx cx-stars c"></i><i class="cx cx-embers"></i>
      <i class="cx cx-sunlow"></i><i class="cx cx-sunday"></i><i class="cx cx-moon"></i>
      <i class="cx cx-dim"></i><i class="cx cx-deck"></i>
      <i class="cx cx-cloud k1"></i><i class="cx cx-cloud k2"></i><i class="cx cx-cloud k3"></i>
      <i class="cx cx-line l1"></i><i class="cx cx-line l2"></i><i class="cx cx-pod"></i>
      <i class="cx cx-beam b1"></i><i class="cx cx-beam b2"></i><i class="cx cx-beam b3"></i>
      ${pair('pyramid')}${pair('far')}${pair('haze2')}<i class="cx cx-cloud k4"></i>${pair('mid')}${over('mid', 'wa', 'wb')}${pair('haze')}
      <i class="cx cx-holo"></i><i class="cx cx-cloud k5"></i><i class="cx cx-cloud k6"></i>
      ${pair('near')}${over('near', 'wa', 'wb', 'wc', 'nx', 'kx')}
      <div class="cx-bb" id="city-bb" aria-hidden="true"></div>
      ${pair('side')}${over('side', 'wa', 'wb', 'nx', 'kx')}<i class="cx cx-fog"></i>
      ${pair('water')}${pair('ref-a')}${pair('ref-b')}${pair('ref-c')}${pair('ref-d')}<i class="cx cx-bbref"></i>
      <i class="cx cx-birds"><b class="f0"></b><b class="f1"></b><b class="f2"></b><b class="f3"></b></i>
      ${pair('dock')}
      <i class="cx cx-gloom"></i>
      <i class="cx cx-rain far"></i><i class="cx cx-rain near"></i><i class="cx cx-snow far"></i><i class="cx cx-snow near"></i>
      <i class="cx cx-flash"></i>
    </div>`;
  scene.insertAdjacentHTML('beforeend', html);
  built = true;
}

const lerp = (a, b, t) => a + (b - a) * t;
// Clouds are drawn white-grey and tinted per time of day: [sepia, hue-rotate deg, saturate, brightness]
const CLOUD_TINT = { dawn: [0.55, -32, 1.7, 0.92], day: [0, 0, 1, 1], golden: [0.6, -12, 1.6, 1.0], dusk: [0.9, 0, 1.45, 0.72], night: [0.15, 190, 0.7, 0.3] };
const DIM = { dawn: [90, 70, 95], day: [150, 160, 175], golden: [150, 120, 110], dusk: [70, 45, 32], night: [14, 16, 24] };
const TOP = { dawn: '#1f1c3a', day: '#3a73c4', golden: '#36558f', dusk: '#1c1410', night: '#07080f' };
const DEEP = { dawn: '#21162c', day: '#2b598c', golden: '#4c445c', dusk: '#0e0805', night: '#06070d' };
const FILL = { sky: TOP, water: DEEP };

export function applySky() {
  if (!active || !built) return;
  const st = skyState();
  const city = document.getElementById('city');
  const { a, b, t } = st.mix;
  for (const [l, img] of LAYERS) {
    const ea = city.querySelector(`.cl-${l}.pa`);
    const eb = city.querySelector(`.cl-${l}.pb`);
    for (const [el, p] of [[ea, a], [eb, b]]) {
      if (el.dataset.p === p) continue;
      el.style.backgroundImage = `url('${ART}${img}-${p}.png')`;
      if (FILL[l]) el.style.backgroundColor = FILL[l][p];
      el.dataset.p = p;
    }
  }
  const s = city.style;
  s.setProperty('--mix', a === b ? 0 : t.toFixed(3));
  const W = st.w;
  const wet = ['rain', 'drizzle', 'storm', 'snow'].includes(st.kind);
  const overcast = wet || st.kind === 'overcast' ? 1 : st.kind === 'fog' ? 0.6 : 0;
  const clear = 1 - Math.max(overcast, clamp(st.cloud / 100, 0, 1) * 0.8);
  // sun: arcs from sunrise (left) to sunset (right); the banded low sun takes over near the horizon
  const f = st.f;
  const lowness = Math.min(f, 1 - f);
  const dayish = smooth(0.05, 0.16, lowness);
  s.setProperty('--sx', clamp(f, -0.1, 1.1).toFixed(4));
  // a flattened arc: climbs fast after sunrise, stays high (above the greeting) most of the day, drops near sunset
  const arc = (x) => { const v = Math.sin(Math.PI * clamp(x, -0.15, 1.15)); return Math.sign(v) * Math.abs(v) ** 0.4; };
  s.setProperty('--sy', arc(f).toFixed(4));
  const sunVis = f > -0.08 && f < 1.08 ? 1 : 0;
  s.setProperty('--sun-low', (sunVis * (1 - dayish) * (1 - overcast * 0.85)).toFixed(3));
  s.setProperty('--sun-day', (sunVis * dayish * (1 - overcast * 0.9)).toFixed(3));
  // moon: same arc through the night
  const g = st.g;
  const mv = g > -0.05 && g < 1.05 && st.moon.lit > 0.04 ? 1 : 0;
  s.setProperty('--mx', clamp(g, -0.1, 1.1).toFixed(4));
  s.setProperty('--my', arc(g).toFixed(4));
  s.setProperty('--moon', (mv * (W.night + W.dawn * 0.4 + W.dusk * 0.4) * (1 - overcast * 0.9)).toFixed(3));
  const moonEl = city.querySelector('.cx-moon');
  moonEl.style.backgroundImage = `url('${ART}ring-${st.moon.sprite}.png')`;
  moonEl.classList.toggle('waning', st.moon.waning);
  s.setProperty('--moon-filter', `saturate(${(1 - 0.7 * W.night).toFixed(2)}) brightness(${(1 + 0.35 * W.night).toFixed(2)})`);
  s.setProperty('--holo', (W.dusk + W.night + W.dawn * 0.75 + (W.day + W.golden) * 0.18).toFixed(3));
  s.setProperty('--stars', ((W.night + W.dawn * 0.25) * clear).toFixed(3));
  s.setProperty('--embers', ((W.dusk + W.golden * 0.3) * (wet ? 0 : 1)).toFixed(3));
  s.setProperty('--beams', (W.dusk * 0.9 + W.night + W.dawn * 0.35 + W.golden * 0.2).toFixed(3));
  s.setProperty('--birds', ((W.day + W.golden) * (wet || st.kind === 'fog' ? 0 : 1)).toFixed(3));
  // clouds: how many of the six puffs show, plus a solid deck and a grey veil when it's overcast
  const puffs = overcast >= 1 ? 6 : Math.round(clamp(st.cloud / 100, 0, 1) * 6);
  city.querySelectorAll('.cx-cloud').forEach((el, i) => { el.style.opacity = i < puffs ? 1 : 0; });
  s.setProperty('--deck', overcast.toFixed(2));
  const tint = CLOUD_TINT[a].map((v, i) => lerp(v, CLOUD_TINT[b][i], a === b ? 0 : t));
  const gloom = wet ? (st.kind === 'storm' ? 0.85 : 0.7) : st.kind === 'overcast' ? 0.45 : 0;
  s.setProperty('--cloud-filter', `sepia(${tint[0].toFixed(2)}) hue-rotate(${tint[1].toFixed(0)}deg) saturate(${tint[2].toFixed(2)}) brightness(${(tint[3] * (1 - gloom * 0.3)).toFixed(2)})`);
  const dim = DIM[a].map((v, i) => Math.round(lerp(v, DIM[b][i], a === b ? 0 : t)));
  s.setProperty('--dim', `rgba(${dim.join(',')},${(overcast * 0.6).toFixed(2)})`);
  s.setProperty('--gloom', (gloom * 0.35).toFixed(2));
  s.setProperty('--fog', st.kind === 'fog' ? 1 : wet ? 0.25 : 0);
  s.setProperty('--rain', st.kind === 'rain' || st.kind === 'storm' ? 1 : st.kind === 'drizzle' ? 0.5 : 0);
  s.setProperty('--snow', st.kind === 'snow' ? 1 : 0);
  city.classList.toggle('storm', st.kind === 'storm');
  city.dataset.kind = st.kind;
  // let the rest of the UI know (panel tint, status-bar colour)
  const dom = t < 0.5 ? a : b;
  document.documentElement.dataset.sky = dom;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', TOP[dom]);
}

function tick() { applySky(); refreshWeather(false); }

export function setSkyActive(on) {
  if (on === active) { if (on) applySky(); return; }
  active = on;
  if (on) {
    build();
    tick();
    timer = setInterval(tick, MIN);
  } else {
    clearInterval(timer); timer = null;
    delete document.documentElement.dataset.sky;
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (!document.hidden && active) tick(); });
}

export { PHASES, LAYERS };
