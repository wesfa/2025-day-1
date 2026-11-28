// Gym: program, workout logger, history, exercise library, plate calculator.
import { S, save, getEx, allExercises, activeWorkout, doneWorkouts, lastSetsFor, nextTemplate } from './store.js';
import { EX_CATS, SET_LABELS, DEFAULT_TEMPLATES } from './program.js';
import { e1rm, platesFor } from './calc.js';
import { dayKey, prettyDay, esc, r0, num, fmt, uid, fmtDuration, fmtLength, nwPairs, buzz, HAPTIC } from './util.js';
import { win, group, btn, field, select, on, actions, openModal, closeModal, closeAllModals, rerender, drawModals, toast, confirmBox, msgBox, beep, unlockAudio, formData, go } from './ui.js';
import { icon } from './icons.js';
import { MUSCLES, EQUIPMENT, EX_META } from './exlib.js';
import { exerciseRanks, isRanked } from './strength.js';
import { badge, openRankDetail } from './ranks.js';
import { coach, RPE_LEFT, rangeText, fmtSet } from './coach.js';

// After a set is checked off, a one-tap "how hard was that?" row opens under it
let rpeAsk = null;   // { i, j }
// How many sets this exercise is meant to get (the coach's plan, else the program's)
function plannedSets(w, i) {
  const e = w.ex[i];
  const co = coach(w, i);
  if (co) return co.sets;
  return Number(e.ts) || Number(String(e.target || '').split('x')[0]) || 0;
}
// After a set is checked off, the next row appears by itself (its grey numbers come from the coach once you rate it)
function addNextRow(w, i) {
  const e = w.ex[i];
  if (e.sets.some((s) => !s.done)) return;
  const done = e.sets.filter((s) => s.done).length;
  const co = coach(w, i);
  const more = co ? (co.next && !co.enough && (done < co.sets || /one more set/.test(co.advice))) : done < plannedSets(w, i);
  if (!more) return;
  const last = e.sets[e.sets.length - 1] || { w: '', r: '' };
  e.sets.push(co ? { w: '', r: '', done: false } : { w: last.w, r: last.r, done: false });
}

const firstNum = (s) => { const m = String(s || '').match(/\d+(\.\d+)?/); return m ? Number(m[0]) : ''; };

// ================= Gym home =================
export function renderGym() {
  const act = activeWorkout();
  const next = nextTemplate();
  const hist = doneWorkouts().slice(0, 8);
  const todayDone = doneWorkouts().filter((w) => w.date === dayKey());

  const top = act
    ? group('Workout in progress', `<p><b>${esc(act.name)}</b> - started ${fmtLength(Date.now() - act.start)} ago</p>${btn('Resume workout', 'go-workout', { cls: 'primary wide' })}`)
    : group('Next up', `
        ${todayDone.length ? `<p class="ok-line">${icon('check', 16)} Already trained today: ${esc(todayDone.map((w) => w.name).join(', '))}</p>` : ''}
        ${next ? `<p class="next-name">${esc(next.name)}</p><p class="muted small">${next.items.map((i) => esc(getEx(i.ex).name)).join(' · ')}</p>
        ${btn('Start workout', 'start-tpl', { cls: 'primary wide', data: `data-id="${next.id}"`, ico: 'dumbbell' })}` : '<p>No program days yet.</p>'}`);

  const prog = S.templates.map((t) => `
    <div class="row static">
      <span class="row-main"><span class="row-name">${esc(t.name)}</span><span class="row-sub">${t.items.length} exercises</span></span>
      <span class="row-btns">${btn('Start', 'start-tpl', { data: `data-id="${t.id}"`, disabled: !!act })}${btn('Edit', 'edit-tpl', { data: `data-id="${t.id}"` })}</span>
    </div>`).join('');

  const histRows = hist.length ? hist.map((w) => `
    <button class="row" data-act="view-workout" data-id="${w.id}">
      <span class="row-main"><span class="row-name">${esc(w.name)}</span><span class="row-sub">${esc(prettyDay(w.date))} · ${fmtLength(w.end - w.start)} · ${w.ex.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0)} sets</span></span>
      <span class="row-num">${fmt(volume(w))}<small> lb</small></span>
    </button>`).join('') : '<p class="empty">Finished workouts show up here.</p>';

  return win('Gym - D-Line Program', `
    ${top}
    ${group('My program (DE / DT)', prog + `<div class="btn-row">${btn('+ New day', 'new-tpl')}${btn('Empty workout', 'start-empty', { disabled: !!act })}</div>`)}
    ${group('Tools', `<div class="btn-grid">
      ${btn('Exercises', 'ex-library', { ico: 'book' })}
      ${btn('Plates', 'plate-calc', { ico: 'plate' })}
      ${btn('PRs', 'show-prs', { ico: 'trophy' })}
      ${btn('Rest timer', 'rest-start', { ico: 'hourglass', data: 'data-s="90"' })}
    </div>`)}
    ${group('History', histRows)}
  `, { ico: 'dumbbell' });
}

function volume(w) {
  let v = 0;
  for (const e of w.ex) {
    const t = getEx(e.ex).type;
    if (t !== 'weight') continue;
    for (const s of e.sets) if (s.done) v += num(s.w) * num(s.r);
  }
  return v;
}

function makeExEntry(exId, sets = 3, reps = '') {
  return { ex: exId, target: reps ? `${sets} x ${reps}` : '', sets: Array.from({ length: sets }, () => ({ w: '', r: '', done: false })), tr: reps };
}

function startWorkout(tpl) {
  if (activeWorkout()) { go('#/workout'); return; }
  const w = {
    id: uid(), date: dayKey(), start: Date.now(), end: null,
    tid: tpl ? tpl.id : null, name: tpl ? tpl.name : 'Workout',
    ex: tpl ? tpl.items.map((i) => ({ ...makeExEntry(i.ex, 1, i.reps), target: i.reps ? `${i.sets} x ${i.reps}` : '', ts: i.sets })) : [], notes: '',
  };
  S.workouts.push(w);
  S.activeId = w.id;
  save(true);
  unlockAudio();
  go('#/workout');
}

on({
  'go-workout': () => go('#/workout'),
  'start-tpl': (el) => startWorkout(S.templates.find((t) => t.id === el.dataset.id)),
  'start-empty': () => startWorkout(null),
  'view-workout': (el) => openWorkoutDetail(el.dataset.id),
  'ex-library': () => openExPicker(null),
  'plate-calc': (el) => openPlates(num(el.dataset.w) || 225),
  'show-prs': () => openPRs(),
  'edit-tpl': (el) => openTplEditor(el.dataset.id),
  'new-tpl': () => {
    const t = { id: 't' + uid(), name: `Day ${S.templates.length + 1} - Custom`, items: [] };
    S.templates.push(t); save(); openTplEditor(t.id);
  },
});

// ================= Workout logger =================
export function renderWorkout() {
  const w = activeWorkout();
  if (!w) {
    return win('Workout', `<p>No workout running.</p>${btn('Go to Gym', 'nav', { data: 'data-to="#/gym"', cls: 'primary' })}`, { ico: 'dumbbell' });
  }
  const ranks = Object.fromEntries(exerciseRanks(w.id).map((x) => [x.exId, x]));
  const blocks = w.ex.map((e, i) => {
    const ex = getEx(e.ex);
    const rk = ranks[e.ex];
    let [l1, l2] = SET_LABELS[ex.type] || SET_LABELS.weight;
    if (ex.type === 'weight' && EX_META[e.ex] && EX_META[e.ex].db) l1 = 'lb each';   // weight of ONE dumbbell
    const noLoad = ex.type === 'body' && ex.cat === 'Power';   // jumps: no added weight
    if (noLoad) l1 = '';
    const last = lastSetsFor(e.ex, w.id);
    const co = coach(w, i);
    const sug = co ? null : overload(ex, e, last);
    const lastDone = e.sets.reduce((a, s, j) => (s.done ? j : a), -1);
    const rating = co && rpeAsk && rpeAsk.i === i && rpeAsk.j === lastDone && !e.sets[lastDone].rpe;
    const ghost = co && co.next && !co.enough && !rating ? co.next : null;
    // SET | PREV (same set last time) | weight | reps | RPE | done. Fields start empty - you type what you did,
    // or tap the check to take the coach's grey suggestion.
    const rows = e.sets.map((s, j) => {
      const ls = last ? last.sets[j] : null;
      const prev = ls ? (num(ls.w) ? `${ls.w} x ${ls.r}` : `${ls.r}`) : '-';
      const ph = !s.done && ghost ? ghost : null;
      const asking = rpeAsk && rpeAsk.i === i && rpeAsk.j === j && s.done;
      return `<div class="set-swipe" data-i="${i}" data-j="${j}">
        <button class="set-trash" data-act="set-del" data-i="${i}" data-j="${j}" aria-label="Delete set ${j + 1}">${icon('trash', 20)}</button>
        <div class="set ${s.done ? 'done' : ''}">
          <span class="set-n">${j + 1}</span>
          <span class="set-prev">${esc(prev)}</span>
          <input class="inp ${noLoad ? 'no-load' : ''}" type="number" inputmode="decimal" step="any" value="${esc(s.w)}" ${ph && ph.w !== '' ? `placeholder="${esc(ph.w)}"` : ''} data-change="set-val" data-i="${i}" data-j="${j}" data-k="w" aria-label="${l1 || 'added weight'}" ${noLoad ? 'tabindex="-1" aria-hidden="true"' : ''}>
          <input class="inp" type="number" inputmode="numeric" step="any" value="${esc(s.r)}" ${ph ? `placeholder="${esc(ph.r)}"` : ''} data-change="set-val" data-i="${i}" data-j="${j}" data-k="r" aria-label="${l2}">
          ${s.done ? `<button class="rpe-cell ${s.rpe ? 'on' : ''}" data-act="rpe-ask" data-i="${i}" data-j="${j}" aria-label="How hard (RPE)">${s.rpe ? esc(s.rpe) : '?'}</button>` : '<span class="rpe-cell off"></span>'}
          <button class="chk ${s.done ? 'on' : ''}" data-act="set-done" data-i="${i}" data-j="${j}" aria-label="${s.done ? 'Done - tap to undo' : 'Mark done'}">${icon('check', 16)}</button>
        </div>
      </div>${asking ? rpePicker(i, j, s.rpe) : ''}`;
    }).join('');
    const coachLine = co ? `<div class="coach-tip coach ${co.next && !co.enough && !rating ? 'up' : ''}">
        <div class="co-top"><b>Aim ${co.sets} x ${rangeText(co)}</b> <span class="muted">@ RPE ${co.rpe} (${co.rpe === 7 ? '3' : '2'} in the tank)</span></div>
        ${rating ? `<div>Rate set ${lastDone + 1} below to get your next target.</div>`
          : `${co.next && !co.enough ? `<div>Do: <b class="vt">${esc(fmtSet(co.next, ex.type === 'body'))}</b></div>${co.next.why ? `<div class="co-why muted">${esc(co.next.why)}</div>` : ''}` : ''}
        ${co.advice ? `<div class="muted">${esc(co.advice)}</div>` : ''}`}
      </div>` : '';
    return `<section class="group ex-block">
      <div class="ex-head"><button class="ex-name" data-act="ex-info" data-id="${e.ex}">${esc(ex.name)}</button>
        ${co && (co.setNo || rating) ? `<span class="ex-setno">set ${rating ? lastDone + 1 : co.setNo}/${co.sets}</span>` : ''}
        <button class="ex-more" data-act="ex-menu" data-i="${i}" aria-label="More for ${esc(ex.name)}">&middot;&middot;&middot;</button></div>
      ${(e.target && !co) || !(last || co) ? `<div class="ex-meta">${e.target && !co ? `<span class="tag">Goal ${esc(e.target)}</span>` : ''}${last || co ? '' : '<span class="muted small">First time - start light, own the form</span>'}</div>` : ''}
      ${rk ? `<button class="wo-rank" data-act="rk-open" data-id="${esc(e.ex)}">${badge(rk.rank, 20)}<b style="color:${rk.rank.color}">${esc(rk.rank.name)}</b>${rk.next && rk.rank.tier < 6 ? `<span class="muted">· rank up at ${nwPairs(rk.next.label)}</span>` : ''}</button>` : ''}
      ${coachLine}
      ${sug ? `<div class="coach-tip ${sug.up ? 'up' : ''}">${sug.up ? icon('up', 10) : ''} ${esc(sug.msg)}</div>` : ''}
      <div class="set set-head"><span class="set-n">Set</span><span>Prev</span><span>${l1}</span><span>${l2}</span><span>RPE</span><span></span></div>
      ${rows}
      <button class="btn wide add-set" data-act="set-add" data-i="${i}">+ Add set</button>
    </section>`;
  }).join('');

  const doneSets = w.ex.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
  const allSets = w.ex.reduce((a, e, i) => a + Math.max(e.sets.length, plannedSets(w, i)), 0);
  return win(esc(w.name), `
    <div class="wo-head panel sunken">
      <span>${icon('hourglass', 16)} <b class="vt" id="wo-clock">${fmtDuration(Date.now() - w.start)}</b></span>
      <span>Sets <b class="vt">${doneSets}/${allSets}</b></span>
      <span>Vol <b class="vt">${fmt(volume(w))}</b></span>
    </div>
    ${blocks || '<p class="empty">Add an exercise to get started.</p>'}
    <div class="btn-row">${btn('+ Add exercise', 'wo-add-ex', { cls: 'wide' })}</div>
    ${field('Notes', `<textarea class="inp" rows="2" data-change="wo-notes" placeholder="How did it feel? Anything hurt?">${esc(w.notes)}</textarea>`)}
    <div class="btn-row">${btn('Finish workout', 'wo-finish', { cls: 'primary grow', ico: 'check' })}${btn('Discard', 'wo-discard', { cls: 'danger' })}</div>
  `, { ico: 'dumbbell', cls: 'workout' });
}

on({
  'set-val': (el) => {
    const w = activeWorkout(); if (!w) return;
    const s = w.ex[el.dataset.i].sets[el.dataset.j];
    s[el.dataset.k] = el.value;
    save();
  },
  'set-done': (el) => {
    const w = activeWorkout(); if (!w) return;
    const i = Number(el.dataset.i); const j = Number(el.dataset.j);
    const e = w.ex[i]; const s = e.sets[j];
    // read whatever is typed right now (the change event may not have fired yet)
    const [inW, inR] = el.closest('.set').querySelectorAll('input');
    s.w = inW.value; s.r = inR.value;
    if (!s.done) {
      // empty fields + a coach suggestion: checking it off means "did what you said"
      if (s.r === '' && inR.placeholder) { s.r = inR.placeholder; if (s.w === '' && inW.placeholder) s.w = inW.placeholder; }
      if (s.r === '') { toast('Enter your reps first', 'warn'); inR.focus(); return; }
      s.done = true;
      buzz(HAPTIC.press);
      rpeAsk = coach(w, i) ? { i, j } : null;
      addNextRow(w, i);
      if (S.settings.restAuto) startRest(getEx(e.ex).rest || 90);
    } else {
      s.done = false;
      if (rpeAsk && rpeAsk.i === i && rpeAsk.j === j) rpeAsk = null;
    }
    save(); rerender();
  },
  // A new set copies the last set's numbers, ready to check off. With auto weight & reps on, a set added after a
  // finished one gets the coach's numbers instead (adjusted for how hard the last set was).
  'set-add': (el) => {
    const w = activeWorkout(); const i = Number(el.dataset.i); const e = w.ex[i];
    const rowInputs = document.querySelectorAll(`[data-change="set-val"][data-i="${i}"]`);
    rowInputs.forEach((inp) => { e.sets[inp.dataset.j][inp.dataset.k] = inp.value; });
    const last = e.sets[e.sets.length - 1] || { w: '', r: '' };
    const co = last.done ? coach(w, i) : null;
    if (co && co.next) {
      e.sets.push({ w: co.next.w, r: String(co.next.r), done: false });
      if (co.next.w !== last.w || String(co.next.r) !== String(last.r)) toast(`Next set: ${fmtSet(co.next, getEx(e.ex).type === 'body')}${co.next.why ? ` - ${co.next.why}` : ''}`, 'dumbbell');
    } else e.sets.push({ w: last.w, r: last.r, done: false });
    rpeAsk = null;
    save(); rerender();
  },
  'rpe-ask': (el) => { rpeAsk = { i: Number(el.dataset.i), j: Number(el.dataset.j) }; rerender(); },
  'rpe-set': (el) => {
    const w = activeWorkout(); if (!w) return;
    const s = w.ex[el.dataset.i] && w.ex[el.dataset.i].sets[el.dataset.j];
    if (!s) return;
    s.rpe = Number(el.dataset.v);
    rpeAsk = null;
    addNextRow(w, Number(el.dataset.i));   // an easy last set can earn one more
    save(); rerender();
  },
  'rpe-skip': () => { rpeAsk = null; rerender(); },
  'set-del': (el) => deleteSet(Number(el.dataset.i), Number(el.dataset.j)),
  'ex-menu': async (el) => {
    const w = activeWorkout(); const i = Number(el.dataset.i); const e = w.ex[i];
    const ex = getEx(e.ex);
    const pick = await msgBox({
      title: ex.name, ico: 'dumbbell', text: '<p>Swipe a set left to delete it.</p>',
      buttons: [...(ex.type === 'weight' ? [['Plate calculator', 'plates']] : []), ...(i > 0 ? [['Move up', 'up']] : []), ['Remove exercise', 'remove'], ['Cancel', false]],
    });
    if (pick === 'plates') actions['plate-calc-ex'](el);
    else if (pick === 'up') { [w.ex[i - 1], w.ex[i]] = [w.ex[i], w.ex[i - 1]]; save(); rerender(); }
    else if (pick === 'remove') {
      if (!(await confirmBox(`Remove ${esc(ex.name)} from this workout?`))) return;
      w.ex.splice(i, 1); save(); rerender();
    }
  },
  'plate-calc-ex': (el) => {
    const w = activeWorkout(); const e = w.ex[el.dataset.i];
    const s = [...e.sets].reverse().find((x) => num(x.w));
    const ls = lastSetsFor(e.ex, w.id);
    openPlates(s ? num(s.w) : ls ? num(ls.sets[0].w) || 135 : 135);
  },
  'wo-add-ex': () => openExPicker((id) => {
    const w = activeWorkout(); w.ex.push(makeExEntry(id, 1, '')); save(); closeAllModals(); rerender();
  }),
  'wo-notes': (el) => { const w = activeWorkout(); if (w) { w.notes = el.value; save(); } },
  'wo-discard': async () => {
    if (!(await confirmBox('Throw away this workout? Nothing will be saved.', 'Discard workout', 'Discard'))) return;
    S.workouts = S.workouts.filter((x) => x.id !== S.activeId);
    S.activeId = null; rpeAsk = null; save(true); stopRest(); go('#/gym');
  },
  'wo-finish': async () => {
    const w = activeWorkout(); if (!w) return;
    // capture any typed-but-not-blurred values
    document.querySelectorAll('[data-change="set-val"]').forEach((inp) => { w.ex[inp.dataset.i].sets[inp.dataset.j][inp.dataset.k] = inp.value; });
    const doneSets = w.ex.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
    if (!doneSets) {
      if (await confirmBox('No sets are checked off. Discard this workout?', 'Finish', 'Discard')) {
        S.workouts = S.workouts.filter((x) => x.id !== w.id); S.activeId = null; save(true); go('#/gym');
      }
      return;
    }
    const prs = findPRs(w);
    const before = Object.fromEntries(exerciseRanks(w.id).map((x) => [x.exId, x.score]));
    w.end = Date.now();
    // drop unchecked sets so history stays clean
    w.ex.forEach((e) => { e.sets = e.sets.filter((s) => s.done); });
    w.ex = w.ex.filter((e) => e.sets.length);
    S.activeId = null; rpeAsk = null;
    save(true); stopRest();
    // rank-ups: a lift that moved up a division (or more) because of this workout
    const step = (sc) => (sc >= 6 ? 18 : Math.floor(sc * 3));
    const ups = exerciseRanks().filter((x) => w.ex.some((e) => e.ex === x.exId) && step(x.score) > step(before[x.exId] ?? -1));
    buzz(prs.length || ups.length ? [14, 70, 14, 70, 30] : HAPTIC.success);  // a little celebration for a new PR or rank
    go('#/gym');
    if (prs.length) beep([523, 659, 784, 1047], 0.13);
    await msgBox({
      title: 'Workout complete',
      ico: prs.length ? 'trophy' : 'check',
      text: `<p><b>${esc(w.name)}</b></p>
        <p>Time ${fmtDuration(w.end - w.start)} · ${doneSets} sets · ${fmt(volume(w))} lb moved</p>
        ${ups.length ? `<p class="pr-line"><b>RANK UP!</b></p><ul class="rank-ups">${ups.map((x) => `<li>${badge(x.rank, 18)} ${esc(getEx(x.exId).name)}: <b style="color:${x.rank.color}">${esc(x.rank.name)}</b></li>`).join('')}</ul>` : ''}
        ${prs.length ? `<p class="pr-line"><b>NEW PRs!</b></p><ul class="pr-list">${prs.map((p) => `<li>${esc(p.name)}: ${p.w} x ${p.r} (est. max ${r0(p.e)} lb)</li>`).join('')}</ul>` : ups.length ? '' : '<p>Logged. Recover: protein + carbs within the next hour.</p>'}`,
    });
  },
});

// "How hard was that?" - one tap under the set you just finished
function rpePicker(i, j, cur) {
  return `<div class="rpe-pick" role="group" aria-label="How hard was set ${j + 1}?">
    <span class="rpe-q">How hard was that set? (RPE)</span>
    ${[6, 7, 8, 9, 10].map((v) => `<button class="btn chip ${Number(cur) === v ? 'on' : ''}" data-act="rpe-set" data-i="${i}" data-j="${j}" data-v="${v}"><b>${v}</b><small>${v === 10 ? 'max' : v === 6 ? '4+ left' : `${10 - v} left`}</small></button>`).join('')}
    <button class="btn chip rpe-skip" data-act="rpe-skip" aria-label="Skip">${icon('close', 8)}</button>
  </div>`;
}

function deleteSet(i, j) {
  const w = activeWorkout(); if (!w || !w.ex[i] || !w.ex[i].sets[j]) return;
  rpeAsk = null;
  w.ex[i].sets.splice(j, 1);
  buzz(HAPTIC.press);
  save(); rerender();
}

// ---------- swipe a set row left to delete it ----------
// A short swipe reveals the red delete button; a long one (past ~45% of the row) deletes right away.
const OPEN_AT = 84;
let sw = null;
function closeSwipes(except) {
  document.querySelectorAll('.set-swipe.open').forEach((w) => {
    if (w === except) return;
    w.classList.remove('open'); const r = w.querySelector('.set'); if (r) r.style.transform = '';
  });
}
document.addEventListener('pointerdown', (e) => {
  const row = e.target.closest && e.target.closest('.set-swipe > .set');
  const trash = e.target.closest && e.target.closest('.set-trash');
  closeSwipes(row ? row.parentElement : trash ? trash.parentElement : null);
  if (!row || e.button > 0 || row.classList.contains('set-head')) return;
  sw = { row, wrap: row.parentElement, x0: e.clientX, y0: e.clientY, dx: 0, base: row.parentElement.classList.contains('open') ? -OPEN_AT : 0, on: false, id: e.pointerId };
});
document.addEventListener('pointermove', (e) => {
  if (!sw || e.pointerId !== sw.id) return;
  const dx = e.clientX - sw.x0; const dy = e.clientY - sw.y0;
  if (!sw.on) {
    if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { sw = null; return; }  // it's a scroll
    if (Math.abs(dx) < 10 || (dx > 0 && !sw.base)) return;
    sw.on = true;
    sw.wrap.classList.add('swiping');
    if (document.activeElement && sw.row.contains(document.activeElement)) document.activeElement.blur();
  }
  sw.dx = Math.min(0, sw.base + dx);
  sw.row.style.transform = `translateX(${sw.dx}px)`;
});
function endSwipe(e) {
  if (!sw || (e && e.pointerId !== sw.id)) return;
  const { row, wrap, dx, on } = sw;
  sw = null;
  if (!on) return;
  wrap.classList.remove('swiping');
  if (document.activeElement && row.contains(document.activeElement)) document.activeElement.blur();
  if (dx < -row.offsetWidth * 0.45) {
    row.style.transform = 'translateX(-110%)';
    setTimeout(() => deleteSet(Number(wrap.dataset.i), Number(wrap.dataset.j)), 160);
  } else if (dx < -48) {
    row.style.transform = `translateX(${-OPEN_AT}px)`; wrap.classList.add('open');
  } else {
    row.style.transform = ''; wrap.classList.remove('open');
  }
}
document.addEventListener('pointerup', endSwipe);
document.addEventListener('pointercancel', endSwipe);

// Progressive overload: hit every rep last time -> go up. Missed reps -> repeat the weight.
const BIG_LOWER = new Set(['back-squat', 'front-squat', 'trap-dl', 'rdl', 'hip-thrust', 'sled-push']);
function overload(ex, e, last) {
  if (ex.type !== 'weight' || !last || !last.sets.length) return null;
  const target = firstNum(e.tr);
  const top = Math.max(...last.sets.map((s) => num(s.w)));
  if (!target || !top) return null;
  const topSets = last.sets.filter((s) => num(s.w) === top);
  const hitAll = topSets.every((s) => num(s.r) >= target) && last.sets.length >= Math.min(3, e.sets.length);
  if (hitAll) {
    const inc = BIG_LOWER.has(ex.id) ? 10 : 5;
    return { up: true, w: top + inc, msg: `You hit ${top} x ${target} last time - try ${top + inc} today` };
  }
  return { up: false, w: top, msg: `Missed some reps at ${top} - stay there and own it` };
}

// Best estimated 1RM per exercise in all finished workouts before `w`
function bestBefore(exId, w) {
  let best = 0;
  for (const o of S.workouts) {
    if (!o.end || o.id === w.id || o.start >= w.start) continue;
    for (const e of o.ex) if (e.ex === exId) for (const s of e.sets) if (s.done) best = Math.max(best, e1rm(s.w, s.r));
  }
  return best;
}
function findPRs(w) {
  const out = [];
  for (const e of w.ex) {
    if (getEx(e.ex).type !== 'weight') continue;
    let top = null;
    for (const s of e.sets) if (s.done) { const v = e1rm(s.w, s.r); if (v && (!top || v > top.e)) top = { e: v, w: num(s.w), r: num(s.r) }; }
    if (!top) continue;
    const prev = bestBefore(e.ex, w);
    if (prev && top.e > prev + 0.5) out.push({ name: getEx(e.ex).name, ...top });
  }
  return out;
}

// ================= Rest timer (floats above the taskbar) =================
let rest = { end: 0, total: 0, timer: null };
export function startRest(sec) {
  unlockAudio();
  rest.total = sec; rest.end = Date.now() + sec * 1000;
  clearInterval(rest.timer);
  rest.timer = setInterval(tickRest, 250);
  tickRest();
}
// Away from the workout screen the bar would cover other pages, so the countdown moves onto the Gym tab instead
const gymTabLabel = () => document.querySelector('.task[data-to="#/workout"] span, .task[data-to="#/gym"] span');
function stopRest() {
  clearInterval(rest.timer); rest.end = 0;
  const el = document.getElementById('restbar'); if (el) el.classList.remove('show');
  document.body.classList.remove('resting');
  const t = gymTabLabel(); if (t) { t.textContent = 'Gym'; t.parentElement.classList.remove('rest-count'); }
}
function tickRest() {
  const el = document.getElementById('restbar');
  if (!el) return;
  const left = rest.end - Date.now();
  if (left <= 0) {
    stopRest();
    if (S.settings.sound) beep();
    buzz([200, 100, 200]);
    toast('Rest over - next set!', 'dumbbell');
    return;
  }
  const tab = gymTabLabel();
  if (!/^#\/workout/.test(location.hash)) {
    el.classList.remove('show');
    document.body.classList.remove('resting');
    if (tab) { tab.textContent = fmtDuration(left + 999); tab.parentElement.classList.add('rest-count'); }
    return;
  }
  if (tab) { tab.textContent = 'Gym'; tab.parentElement.classList.remove('rest-count'); }
  el.classList.add('show');
  document.body.classList.add('resting');
  const pct = 100 - (left / (rest.total * 1000)) * 100;
  el.innerHTML = `<span class="rest-ico">${icon('hourglass', 16)}</span><span class="rest-lbl">REST</span><b class="vt rest-time">${fmtDuration(left + 999)}</b>
    <div class="progress thin rest-bar"><div class="fill" style="width:${pct}%"></div></div>
    <button class="btn sq" data-act="rest-add" data-s="-15">-15</button><button class="btn sq" data-act="rest-add" data-s="15">+15</button><button class="btn" data-act="rest-skip">Skip</button>`;
}
on({
  'rest-start': (el) => startRest(Number(el.dataset.s) || 90),
  'rest-add': (el) => { rest.end += Number(el.dataset.s) * 1000; rest.total = Math.max(rest.total, (rest.end - Date.now()) / 1000); tickRest(); },
  'rest-skip': () => stopRest(),
});

// ================= Exercise picker / library =================
const xp = { q: '', cat: '', mus: '', onPick: null };
export function openExPicker(onPick) {
  xp.q = ''; xp.cat = ''; xp.onPick = onPick;
  openModal(renderExPicker, { full: true });
}
// Search matches every word in any order, so "overhead db triceps extension" finds "Dumbbell Overhead Tricep
// Extension": DB/BB mean dumbbell/barbell and a plural 's' is ignored.
const searchText = (name) => {
  const n = name.toLowerCase();
  const flat = /bench press/.test(n) && !/incline|decline/.test(n) ? ' flat' : '';
  return `${n} ${n.replace(/dumbbell/g, 'db').replace(/barbell/g, 'bb')} ${n.replace(/\bdb\b/g, 'dumbbell').replace(/\bbb\b/g, 'barbell')}${flat}`;
};
const queryWords = (q) => q.toLowerCase().split(/[\s,]+/).filter(Boolean).map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w));
function xpList() {
  const words = queryWords(xp.q);
  const musclesOf = (e) => (EX_META[e.id] ? EX_META[e.id].m : e.muscle ? [e.muscle] : []);
  const matches = (e) => { const t = searchText(e.name); return words.every((w) => t.includes(w)); };
  const list = allExercises().filter((e) => (!xp.cat || e.cat === xp.cat) && (!xp.mus || musclesOf(e).includes(xp.mus)) && (!words.length || matches(e)));
  const ranks = Object.fromEntries(exerciseRanks().map((x) => [x.exId, x]));
  const sub = (e) => {
    const m = musclesOf(e).map((k) => MUSCLES[k] && MUSCLES[k].name).filter(Boolean).slice(0, 2).join(', ');
    const eq = EX_META[e.id] && EQUIPMENT[EX_META[e.id].eq];
    return [m, eq].filter(Boolean).join(' · ') || e.cat;
  };
  const cats = [...EX_CATS, 'Custom'];
  const byCat = cats.map((c) => {
    const items = list.filter((e) => (e.cat || 'Custom') === c);
    if (!items.length) return '';
    return `<div class="sub-head">${esc(c)}</div>` + items.map((e) => `
      <div class="row static">
        <button class="row-main link-row" data-act="${xp.onPick ? 'xp-pick' : 'ex-info'}" data-id="${e.id}"><span class="row-name">${esc(e.name)}</span><span class="row-sub">${esc(sub(e))}</span></button>
        ${ranks[e.id] ? `<span class="xp-rank" title="${esc(ranks[e.id].rank.name)}">${badge(ranks[e.id].rank, 22)}</span>` : ''}
        <span class="row-btns">${xp.onPick ? btn('Add', 'xp-pick', { data: `data-id="${e.id}"`, cls: 'primary' }) : ''}${btn('?', 'ex-info', { data: `data-id="${e.id}"`, cls: 'sq' })}</span>
      </div>`).join('');
  }).join('');
  return byCat || '<p class="empty">No exercises match.</p>';
}
function renderExPicker() {
  const cats = [...EX_CATS, 'Custom'];
  return win(xp.onPick ? 'Add Exercise' : 'Exercise Library', `
    <div class="search-row"><input id="xp-q" class="inp grow" type="search" placeholder="Search exercises..." value="${esc(xp.q)}" data-input="xp-q" autocomplete="off"></div>
    <div class="grid2">
      ${select('cat', [['', 'All types'], ...cats.map((c) => [c, c])], xp.cat, { data: 'data-change="xp-cat"' })}
      ${select('mus', [['', 'All muscles'], ...Object.entries(MUSCLES).map(([k, m]) => [k, m.name])], xp.mus || '', { data: 'data-change="xp-mus"' })}
    </div>
    <div class="list" id="xp-list">${xpList()}</div>
    <div class="btn-row">${btn('+ Create exercise', 'xp-create')}</div>
  `, { cls: 'full-win', close: 'modal-close', ico: 'book' });
}
// Typing only refreshes the list - the search box is never redrawn, so fast typing can't drop letters
let xpTimer;
function refreshXp() {
  const l = document.getElementById('xp-list');
  if (l) l.innerHTML = xpList(); else drawModals();
}
on({
  'xp-q': (el) => {
    xp.q = el.value; clearTimeout(xpTimer);
    xpTimer = setTimeout(refreshXp, 60);
  },
  'xp-cat': (el) => { xp.cat = el.value; refreshXp(); },
  'xp-mus': (el) => { xp.mus = el.value; refreshXp(); },
  'xp-pick': (el) => xp.onPick && xp.onPick(el.dataset.id),
  'xp-create': () => openModal(() => win('Create Exercise', `
    <form id="xc" onsubmit="return false">
      ${field('Name', '<input class="inp" name="name" placeholder="e.g. Sumo Deadlift">')}
      ${field('Category', select('cat', [...EX_CATS, 'Custom'].map((c) => [c, c]), 'Custom'))}
      ${field('What you log', select('type', [['weight', 'Weight x reps'], ['body', 'Bodyweight reps (+ optional weight)'], ['time', 'Time (seconds)'], ['dist', 'Distance (yards)']], 'weight'))}
      ${field('Main muscle (for the muscle map)', select('muscle', [['', 'None'], ...Object.entries(MUSCLES).map(([k, m]) => [k, m.name])], ''))}
      ${field('Rest timer (sec)', '<input class="inp" name="rest" type="number" inputmode="numeric" value="90">')}
      ${field('Coaching cues (one per line)', '<textarea class="inp" name="cues" rows="3"></textarea>')}
      <div class="btn-row">${btn('Save', 'xc-save', { cls: 'primary grow', type: 'submit' })}${btn('Cancel', 'modal-close')}</div>
    </form>`, { cls: 'dialog', close: 'modal-close' })),
  'xc-save': () => {
    const v = formData(document.getElementById('xc'));
    if (!v.name.trim()) { toast('Name it', 'warn'); return; }
    S.customEx.push({ id: 'x' + uid(), name: v.name.trim(), cat: v.cat, type: v.type, rest: num(v.rest, 90), cues: v.cues.split('\n').map((s) => s.trim()).filter(Boolean), why: '', ...(v.muscle ? { muscle: v.muscle } : {}) });
    save(); closeModal(); drawModals();
  },
  'ex-info': (el) => openExInfo(el.dataset.id),
});

const setTxt = (s) => `${num(s.w) ? `${s.w}x${s.r}` : s.r}${s.rpe ? `@${s.rpe}` : ''}`;

function exHistory(exId) {
  const out = [];
  for (const w of doneWorkouts()) {
    const e = w.ex.find((x) => x.ex === exId);
    if (e) out.push({ date: w.date, sets: e.sets.filter((s) => s.done) });
  }
  return out;
}

function openExInfo(id) {
  const ex = getEx(id);
  const hist = exHistory(id);
  let best = null;
  for (const h of hist) for (const s of h.sets) { const v = e1rm(s.w, s.r); if (v && (!best || v > best.e)) best = { e: v, w: s.w, r: s.r, date: h.date }; }
  const meta = EX_META[id];
  const mus = meta ? `<p class="small"><b>Works:</b> ${esc(meta.m.map((k) => MUSCLES[k].name).join(', '))}${meta.s.length ? ` <span class="muted">· helps: ${esc(meta.s.map((k) => MUSCLES[k].name).join(', '))}</span>` : ''}</p>` : '';
  const rk = exerciseRanks().find((x) => x.exId === id);
  openModal(() => win(esc(ex.name), `
    ${mus}
    ${rk ? `<button class="row rk-row" data-act="rk-open" data-id="${esc(id)}">${badge(rk.rank, 26)}<span class="row-main"><span class="row-name" style="color:${rk.rank.color}">${esc(rk.rank.name)}</span><span class="row-sub">Tap for your rank graph and standards</span></span></button>` : isRanked(id) ? '<p class="muted small">Ranked lift - log a set to get your rank.</p>' : ''}
    ${ex.why ? `<p class="why">${esc(ex.why)}</p>` : ''}
    ${ex.cues && ex.cues.length ? group('Coaching cues', `<ol class="cues">${ex.cues.map((c) => `<li>${esc(c)}</li>`).join('')}</ol>`) : ''}
    ${best ? group('Personal best', `<p>${icon('trophy', 16)} <b>${best.w} x ${best.r}</b> on ${esc(prettyDay(best.date))}</p><p>Estimated 1-rep max: <b class="vt">${r0(best.e)}</b> lb</p>`) : ''}
    ${group('History', hist.length ? hist.slice(0, 8).map((h) => `<div class="hist-line"><span>${esc(prettyDay(h.date, { short: true }))}</span><span>${h.sets.map(setTxt).join(', ')}</span></div>`).join('') : '<p class="empty">No history yet.</p>')}
    <div class="btn-row">${btn('Close', 'modal-close', { cls: 'grow' })}</div>
  `, { cls: 'dialog', close: 'modal-close', ico: 'book' }));
}

// ================= PRs =================
function openPRs() {
  const best = {};
  for (const w of doneWorkouts()) for (const e of w.ex) {
    if (getEx(e.ex).type !== 'weight') continue;
    for (const s of e.sets) {
      const v = e1rm(s.w, s.r);
      if (v && (!best[e.ex] || v > best[e.ex].e)) best[e.ex] = { e: v, w: s.w, r: s.r, date: w.date };
    }
  }
  const rows = Object.entries(best).sort((a, b) => b[1].e - a[1].e).map(([id, b]) => `
    <div class="row static"><span class="row-main"><span class="row-name">${esc(getEx(id).name)}</span><span class="row-sub">${b.w} x ${b.r} · ${esc(prettyDay(b.date, { short: true }))}</span></span><span class="row-num">${r0(b.e)}<small> max</small></span></div>`).join('');
  openModal(() => win('Personal Records', `
    <p class="muted small">Estimated 1-rep max from your best set (Epley formula). Big 3 for linemen: squat, bench, clean.</p>
    <div class="list">${rows || '<p class="empty">Finish some workouts to see PRs.</p>'}</div>
    <div class="btn-row">${btn('Close', 'modal-close', { cls: 'grow' })}</div>`, { cls: 'dialog', close: 'modal-close', ico: 'trophy' }));
}

// ================= Workout detail (history) =================
function openWorkoutDetail(id) {
  const w = S.workouts.find((x) => x.id === id);
  if (!w) return;
  openModal(() => win(esc(w.name), `
    <p class="muted">${esc(prettyDay(w.date))} · ${fmtLength(w.end - w.start)} · ${fmt(volume(w))} lb</p>
    ${w.ex.map((e) => `<div class="hist-line"><span>${esc(getEx(e.ex).name)}</span><span>${e.sets.map(setTxt).join(', ')}</span></div>`).join('')}
    ${w.notes ? `<p class="why">"${esc(w.notes)}"</p>` : ''}
    <div class="btn-row">${btn('Delete', 'wd-del', { cls: 'danger', data: `data-id="${w.id}"` })}${btn('Close', 'modal-close', { cls: 'grow' })}</div>
  `, { cls: 'dialog', close: 'modal-close', ico: 'dumbbell' }));
}
on({
  'wd-del': async (el) => {
    if (!(await confirmBox('Delete this workout from history?'))) return;
    S.workouts = S.workouts.filter((w) => w.id !== el.dataset.id); save(); closeAllModals(); rerender();
  },
});

// ================= Template editor =================
let te = null;
function openTplEditor(id) {
  const t = S.templates.find((x) => x.id === id);
  if (!t) return;
  te = JSON.parse(JSON.stringify(t));
  openModal(renderTplEditor, { full: true });
}
function renderTplEditor() {
  return win('Edit Program Day', `
    ${field('Name', `<input class="inp" id="te-name" value="${esc(te.name)}" data-change="te-name">`)}
    <div class="te-list">
      ${te.items.map((it, i) => `
        <div class="te-row">
          <span class="te-name">${esc(getEx(it.ex).name)}</span>
          <input class="inp te-sets" type="number" inputmode="numeric" value="${it.sets}" data-change="te-val" data-i="${i}" data-k="sets" aria-label="Sets">
          <span>x</span>
          <input class="inp te-reps" type="text" value="${esc(it.reps)}" data-change="te-val" data-i="${i}" data-k="reps" aria-label="Reps">
          <button class="btn sq" data-act="te-up" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">${icon('up', 10)}</button>
          <button class="btn sq" data-act="te-del" data-i="${i}" aria-label="Remove">${icon('close', 8)}</button>
        </div>`).join('') || '<p class="empty">No exercises yet.</p>'}
    </div>
    <div class="btn-row">${btn('+ Add exercise', 'te-add', { cls: 'wide' })}</div>
    <div class="btn-row">${btn('Save', 'te-save', { cls: 'primary grow' })}${btn('Delete day', 'te-remove', { cls: 'danger' })}${btn('Cancel', 'modal-close')}</div>
  `, { cls: 'full-win', close: 'modal-close', ico: 'dumbbell' });
}
on({
  'te-name': (el) => { te.name = el.value; },
  'te-val': (el) => { const it = te.items[el.dataset.i]; it[el.dataset.k] = el.dataset.k === 'sets' ? Math.max(1, Math.min(20, num(el.value, 3))) : el.value; },
  'te-up': (el) => { const i = Number(el.dataset.i); if (i > 0) [te.items[i - 1], te.items[i]] = [te.items[i], te.items[i - 1]]; drawModals(); },
  'te-del': (el) => { te.items.splice(Number(el.dataset.i), 1); drawModals(); },
  'te-add': () => openExPicker((id) => { te.items.push({ ex: id, sets: 3, reps: '8' }); closeModal(); drawModals(); }),
  'te-save': () => {
    const n = document.getElementById('te-name'); if (n) te.name = n.value.trim() || te.name;
    S.templates = S.templates.map((t) => (t.id === te.id ? te : t));
    save(); closeModal(); rerender(); toast('Program saved');
  },
  'te-remove': async () => {
    if (!(await confirmBox(`Delete "${esc(te.name)}" from your program?`))) return;
    S.templates = S.templates.filter((t) => t.id !== te.id); save(); closeAllModals(); rerender();
  },
});

export function resetProgram() {
  S.templates = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
  save();
}

// ================= Plate calculator =================
const pc = { w: 225, bar: 45 };
const PLATE_CLS = { 45: 'p45', 35: 'p35', 25: 'p25', 10: 'p10', 5: 'p5', 2.5: 'p2' };
function openPlates(w) {
  pc.w = w || pc.w;
  openModal(renderPlates);
}
function renderPlates() {
  const { plates, leftover } = platesFor(pc.w, pc.bar);
  const vis = plates.map((p) => `<span class="pl ${PLATE_CLS[p]}" title="${p}">${p}</span>`).join('');
  return win('Plate Calculator', `
    <div class="grid2">
      ${field('Total weight (lb)', `<input class="inp" type="number" inputmode="decimal" value="${pc.w}" data-change="pc-w">`)}
      ${field('Bar', select('bar', [['45', 'Barbell 45'], ['35', 'Light bar 35'], ['55', 'Trap bar 55'], ['60', 'Trap bar 60'], ['25', 'EZ bar 25']], pc.bar, { data: 'data-change="pc-bar"' }))}
    </div>
    <div class="chips">${[135, 185, 225, 275, 315, 365, 405].map((v) => `<button class="btn chip ${pc.w === v ? 'on' : ''}" data-act="pc-set" data-v="${v}">${v}</button>`).join('')}</div>
    <div class="bar-vis sunken"><span class="sleeve"></span>${vis || '<span class="muted">just the bar</span>'}</div>
    <p class="big-cal">Each side: <b class="vt">${plates.length ? plates.join(' + ') : '0'}</b></p>
    ${leftover ? `<p class="muted small">Can't make exactly ${pc.w} - ${leftover} lb left over.</p>` : ''}
    <div class="btn-row">${btn('Close', 'modal-close', { cls: 'grow' })}</div>
  `, { cls: 'dialog', close: 'modal-close', ico: 'plate' });
}
on({
  'pc-w': (el) => { pc.w = num(el.value, pc.w); drawModals(); },
  'pc-bar': (el) => { pc.bar = num(el.value, 45); drawModals(); },
  'pc-set': (el) => { pc.w = Number(el.dataset.v); drawModals(); },
});

// Clock tick for the workout screen
export function tickWorkoutClock() {
  const el = document.getElementById('wo-clock');
  const w = activeWorkout();
  if (el && w) el.textContent = fmtDuration(Date.now() - w.start);
}
