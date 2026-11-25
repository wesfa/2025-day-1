// First-run "Setup Wizard" in classic installer style.
import { S, save, mergeInto, normalize } from './store.js';
import { calcTargets, PHASES } from './calc.js';
import { dayKey, esc, num } from './util.js';
import { field, numInput, select, dayPicker, on, formData, toast, msgBox } from './ui.js';
import { applyTheme } from './settings.js';
import { icon } from './icons.js';

let step = 0;
const STEPS = 5;

const heightOpts = () => {
  const out = [];
  for (let i = 60; i <= 84; i++) out.push([i, `${Math.floor(i / 12)}' ${i % 12}"`]);
  return out;
};

function page() {
  const p = S.profile;
  const school = S.schedule.busy.find((b) => b.id === 'school') || { days: [1, 2, 3, 4, 5], start: '07:45', end: '15:00' };
  const work = S.schedule.busy.find((b) => b.id === 'work');
  switch (step) {
    case 0: return `
      <h2>Welcome to MACROS Setup</h2>
      <p>This wizard sets up your personal nutrition + training app.</p>
      <ul class="feat">
        <li>${icon('burger', 16)} Log food fast and hit your macros</li>
        <li>${icon('dumbbell', 16)} DE / DT lifting program with sets, reps and weight</li>
        <li>${icon('scale', 16)} Daily weigh-in and goal-weight tracking</li>
        <li>${icon('bell', 16)} Reminders that skip school and work</li>
      </ul>
      <p>Click <b>Next</b> to continue.</p>
      <div class="wz-restore">
        <p class="muted small">Moving from another copy of Macros (like a new home-screen icon)? Restore your backup file to bring back everything and skip setup.</p>
        <button class="btn" data-act="wz-restore">${icon('floppy', 16)}<span>Restore from a backup</span></button>
        <input type="file" id="wz-file" accept=".json,application/json,text/plain" hidden data-change="wz-file">
      </div>`;
    case 1: return `
      <h2>About you</h2>
      <form id="wz" onsubmit="return false">
        ${field('First name', `<input class="inp" name="name" value="${esc(p.name)}" placeholder="What should we call you?">`)}
        <div class="grid2">
          ${field('Position', select('position', [['DE', 'DE'], ['DT', 'DT'], ['DE/DT', 'DE / DT'], ['NT', 'Nose tackle']], p.position))}
          ${field('Age', numInput('age', p.age, { step: 1 }))}
          ${field('Height', select('heightIn', heightOpts(), p.heightIn))}
          ${field('Sex', select('sex', [['m', 'Male'], ['f', 'Female']], p.sex))}
        </div>
      </form>`;
    case 2: return `
      <h2>Your weight goal</h2>
      <form id="wz" onsubmit="return false">
        <div class="grid2">
          ${field('Weight right now (lb)', numInput('startWeight', p.startWeight))}
          ${field('Goal weight (lb)', numInput('goalWeight', p.goalWeight))}
        </div>
        ${field('How fast?', select('rate', [[0.25, '0.25 lb/week - slow & lean'], [0.5, '0.5 lb/week - recommended'], [0.75, '0.75 lb/week'], [1, '1 lb/week - aggressive']], p.rate))}
        ${field('Where are you in the year?', select('phase', Object.entries(PHASES).map(([k, v]) => [k, v.label]), p.phase))}
        <p class="muted small">Typical: DEs 240-275 lb, DTs 280-320 lb at the college level. Gaining? Lean mass comes slow - 0.5 lb/week is the sweet spot.</p>
      </form>`;
    case 3: return `
      <h2>Your week</h2>
      <p class="muted small">Reminders will never go off while you're in these blocks. You can add more (practice, other shifts) later in Reminders.</p>
      <form id="wz" onsubmit="return false">
        <section class="group"><div class="group-title"><label class="check inline"><input type="checkbox" name="hasSchool" ${S.schedule.busy.some((b) => b.id === 'school') ? 'checked' : ''}><span>School</span></label></div>
          ${dayPicker('schoolDays', school.days)}
          <div class="grid2">${field('Starts', `<input class="inp" type="time" name="schoolStart" value="${school.start}">`)}${field('Ends', `<input class="inp" type="time" name="schoolEnd" value="${school.end}">`)}</div>
        </section>
        <section class="group"><div class="group-title"><label class="check inline"><input type="checkbox" name="hasWork" ${work ? 'checked' : ''}><span>Work</span></label></div>
          ${dayPicker('workDays', work ? work.days : [6])}
          <div class="grid2">${field('Starts', `<input class="inp" type="time" name="workStart" value="${work ? work.start : '10:00'}">`)}${field('Ends', `<input class="inp" type="time" name="workEnd" value="${work ? work.end : '16:00'}">`)}</div>
        </section>
        <div class="grid2">
          ${field('Wake up', `<input class="inp" type="time" name="wake" value="${S.schedule.wake}">`)}
          ${field('Bedtime', `<input class="inp" type="time" name="sleep" value="${S.schedule.sleep}">`)}
        </div>
      </form>`;
    default: {
      const t = calcTargets(p, p.startWeight);
      return `
      <h2>You're all set${p.name ? ', ' + esc(p.name) : ''}!</h2>
      <p>Your daily targets:</p>
      <div class="target-grid">
        <div class="stat sunken"><span>Calories</span><b class="vt">${t.cal}</b></div>
        <div class="stat sunken"><span>Protein</span><b class="vt">${t.p}g</b></div>
        <div class="stat sunken"><span>Carbs</span><b class="vt">${t.c}g</b></div>
        <div class="stat sunken"><span>Fat</span><b class="vt">${t.f}g</b></div>
      </div>
      <p class="muted small">${t.dir > 0 ? 'Gaining' : t.dir < 0 ? 'Cutting' : 'Holding'}: maintenance ~${t.maintenance} kcal ${t.delta >= 0 ? '+' : '-'} ${Math.abs(t.delta)}. These adjust automatically as your weight changes. Change anything later in Control Panel.</p>
      <p>Next: add Macros to your home screen and turn on reminders.</p>`;
    }
  }
}

export function renderWizard() {
  return `
  <div class="wizard-wrap">
    <section class="win wizard">
      <header class="titlebar"><span class="tb-ico">${icon(S.settings.theme === 'island' ? 'palm' : 'sun', 16)}</span><span class="tb-title">MACROS Setup</span></header>
      <div class="wiz-body">
        <div class="wiz-side" aria-hidden="true"><div class="wiz-brand">MACROS<small>98</small></div></div>
        <div class="wiz-main">${page()}</div>
      </div>
      <div class="wiz-foot">
        <span class="muted small">Step ${step + 1} of ${STEPS}</span>
        <span class="btn-row">
          <button class="btn" data-act="wz-back" ${step === 0 ? 'disabled' : ''}>&lt; Back</button>
          <button class="btn primary" data-act="wz-next">${step === STEPS - 1 ? 'Finish' : 'Next &gt;'}</button>
        </span>
      </div>
    </section>
  </div>`;
}

let onDone = () => {};
export function setWizardDone(fn) { onDone = fn; }

function collect() {
  const f = document.getElementById('wz');
  if (!f) return true;
  const v = formData(f);
  const p = S.profile;
  if (step === 1) {
    Object.assign(p, { name: v.name.trim(), position: v.position, age: num(v.age, 17), heightIn: num(v.heightIn, 72), sex: v.sex });
  } else if (step === 2) {
    const sw = num(v.startWeight, 0); const gw = num(v.goalWeight, 0);
    if (!(sw > 80 && sw < 500) || !(gw > 80 && gw < 500)) { toast('Enter your weights in pounds', 'warn'); return false; }
    Object.assign(p, { startWeight: sw, goalWeight: gw, rate: num(v.rate, 0.5), phase: v.phase, startDate: dayKey() });
  } else if (step === 3) {
    const busy = S.schedule.busy.filter((b) => b.id !== 'school' && b.id !== 'work');
    if (v.hasSchool && v.schoolDays.length) busy.unshift({ id: 'school', label: 'School', kind: 'school', days: v.schoolDays.map(Number), start: v.schoolStart, end: v.schoolEnd });
    if (v.hasWork && v.workDays.length) busy.push({ id: 'work', label: 'Work', kind: 'work', days: v.workDays.map(Number), start: v.workStart, end: v.workEnd });
    S.schedule.busy = busy;
    S.schedule.wake = v.wake || '06:00';
    S.schedule.sleep = v.sleep || '22:30';
  }
  save();
  return true;
}

on({
  'wz-next': () => {
    if (!collect()) return;
    if (step < STEPS - 1) { step++; onDone(false); return; }
    // log the starting weight as the first weigh-in
    if (S.weights[dayKey()] == null) S.weights[dayKey()] = S.profile.startWeight;
    S.setupDone = true;
    save(true);
    onDone(true);
  },
  'wz-back': () => { collect(); if (step > 0) step--; onDone(false); },
  'wz-restore': () => document.getElementById('wz-file').click(),
  // A fresh copy hasn't been set up yet, so merging brings over the profile, schedule, reminders and
  // settings as well as the food log, weigh-ins and workouts.
  'wz-file': async (el) => {
    const file = el.files && el.files[0];
    if (!file) return;
    el.value = '';
    let n;
    try {
      const data = JSON.parse(await file.text());
      if (!data || !data.profile || !data.days) throw new Error('not a backup');
      n = mergeInto(S, normalize(data));
      if (!S.setupDone) throw new Error('backup was never set up');
    } catch (e) {
      msgBox({ title: 'Restore failed', text: "That file isn't a Macros backup. On the old copy, use Control Panel > Backup > Export backup." });
      return;
    }
    save(true);
    applyTheme();
    step = 0;
    onDone('restored');
    setTimeout(() => msgBox({
      title: 'Backup restored', ico: 'check',
      text: `<p>Welcome back${S.profile.name ? ', ' + esc(S.profile.name) : ''}. Restored ${n.food} food entries, ${n.weights} weigh-ins and ${n.workouts} workouts, plus your profile, schedule, reminders and settings.</p>`,
    }), 300);
  },
});


