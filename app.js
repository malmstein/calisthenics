import * as L from './logic.js';

const KEY = 'calisthenics.v1', DRAFT_KEY = 'calisthenics.draft';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const read = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const write = (k, v) => {
  try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); }
  catch (e) { alert('Saving failed: ' + e.message); }
};

let state = read(KEY) || L.defaults();
let draft = read(DRAFT_KEY); // { next, items, done: { 'i.j': reps } }
let tab = 'today';
let timer = null;

const save = () => write(KEY, state);
const saveDraft = () => write(DRAFT_KEY, draft);
// A draft with nothing logged is rebuilt on next render, so settings changes apply.
const dropUntouchedDraft = () => { if (draft && !Object.keys(draft.done).length) { draft = null; saveDraft(); } };

const exName = key => state.exercises[key]?.name ?? state.timed[key];
const vName = (key, id) => L.variation(state.exercises[key], id)?.name ?? '(deleted variation)';
const fmtSets = sets => sets.length && sets.every(r => r === sets[0]) ? `${sets.length} × ${sets[0]}` : sets.join(' / ');

// ---------- Today ----------

function today() {
  const fresh = L.buildSession(state);
  if (!draft || JSON.stringify(draft.next) !== JSON.stringify(fresh.next) || !Object.keys(draft.done).length) {
    draft = { ...fresh, done: {} };
    saveDraft();
  }
  const { next, items, done } = draft;
  const easy = next.kind === 'train' && next.week === state.settings.easyWeek;
  const title = next.kind === 'train' ? `Session ${next.label}` : next.kind === 'test' ? 'Test day' : 'Retest day';
  const sub = `Block ${next.block} · Week ${next.week} of ${state.settings.weeks}${easy ? ' · easy week' : ''}`;
  const intro = next.kind === 'train'
    ? 'Stop each set with 1–2 reps left in the tank.'
    : 'One max set per exercise, clean reps only. Rest ~3 min between. Burpees: max in 2 minutes.';

  return `<h1>${title}</h1><div class="sub">${sub}</div><p class="muted">${intro}</p>` +
    items.map((it, i) => {
      const isTime = it.kind === 'time';
      const head = isTime ? exName(it.ex) : vName(it.ex, it.v);
      const detail = isTime ? `${it.sets.length} holds, seconds · beat ${it.sets[0]}s`
        : it.kind === 'test' ? `Test: max reps${it.ex === 'burpee' ? ' in 2 min' : ''}`
        : `${exName(it.ex)} · ${fmtSets(it.sets)}`;
      return `<div class="card"><h3>${esc(head)}</h3><div class="sub">${esc(detail)}</div>` +
        it.sets.map((t, j) => {
          const k = `${i}.${j}`, d = done[k];
          return `<div class="set${d != null ? ' done' : ''}">
            <label>${it.kind === 'test' ? 'Max' : `Set ${j + 1}`}</label>
            <input type="number" inputmode="numeric" min="0" id="in-${i}-${j}" value="${d ?? t ?? ''}" placeholder="reps">
            <span class="muted">${isTime ? 's' : 'reps'}</span>
            <button data-act="log" data-i="${i}" data-j="${j}" aria-label="Log set">✓</button></div>`;
        }).join('') + '</div>';
    }).join('') +
    `<button class="primary" data-act="finish">Finish session</button>`;
}

function startTimer() {
  clearInterval(timer);
  const el = $('#timer'), end = Date.now() + state.settings.restSec * 1000;
  el.hidden = false;
  const tick = () => {
    const s = Math.ceil((end - Date.now()) / 1000);
    if (s > 0) { el.textContent = `Rest ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} · tap to skip`; return; }
    el.textContent = 'Rest done, next set';
    navigator.vibrate?.(300);
    clearInterval(timer);
  };
  tick();
  timer = setInterval(tick, 250);
}
const stopTimer = () => { clearInterval(timer); $('#timer').hidden = true; };

function logSet({ i, j }, btn) {
  const input = $(`#in-${i}-${j}`);
  const reps = parseInt(input.value, 10);
  if (!(reps >= 0)) { input.focus(); return; }
  draft.done[`${i}.${j}`] = reps;
  saveDraft();
  btn.closest('.set').classList.add('done');
  startTimer();
}

function finish() {
  const sets = [];
  let total = 0;
  draft.items.forEach((it, i) => it.sets.forEach((t, j) => {
    total++;
    const reps = draft.done[`${i}.${j}`];
    if (reps != null) sets.push({ ex: it.ex, v: it.v, test: it.kind === 'test', target: t, reps });
  }));
  if (!sets.length) return alert('Log at least one set first (tap ✓).');
  if (sets.length < total && !confirm(`${total - sets.length} set(s) not logged. Finish anyway?`)) return;

  const { next } = draft;
  state.sessions.push({ date: new Date().toLocaleDateString('sv'), kind: next.kind, label: next.label, sets });
  if (next.kind !== 'train')
    for (const u of L.levelUps(state, sets))
      if (confirm(`${u.from.name}: ${u.reps} reps (level-up at ${u.from.levelUp}).\nMove up to ${u.to.name}? It gets tested next session.`))
        state.exercises[u.ex].cur = u.to.id;
  save();
  draft = null;
  saveDraft();
  stopTimer();
  tab = 'progress';
  render();
  scrollTo(0, 0);
}

// ---------- Progress ----------

function progress() {
  const cards = L.MAIN.map(key => {
    const ex = state.exercises[key];
    const ci = L.vIndex(ex, ex.cur), max = L.testMax(state, key), best = L.goalBest(state, key);
    const pct = Math.min(100, Math.round(100 * best / ex.goal));
    return `<div class="card"><div class="row"><h3>${esc(ex.name)}</h3><span class="muted">${best} / ${ex.goal}${ex.unit ? ' ' + esc(ex.unit) : ''}</span></div>
      <div class="sub">Now: ${esc(vName(key, ex.cur))} (${ci + 1}/${ex.ladder.length}) · last test ${max ?? 'none'}</div>
      <div class="bar"><i style="width:${pct}%"></i></div></div>`;
  }).join('');

  const tests = state.sessions.filter(s => s.kind !== 'train');
  const testTable = tests.length ? `<table><tr><th>Date</th>${L.MAIN.map(k => `<th>${esc(state.exercises[k].name)}</th>`).join('')}</tr>` +
    tests.map(s => `<tr><td>${s.date}</td>${L.MAIN.map(k => {
      const x = s.sets.find(x => x.ex === k);
      return `<td title="${x ? esc(vName(k, x.v)) : ''}">${x ? x.reps : '—'}</td>`;
    }).join('')}</tr>`).join('') + '</table><p class="muted">Tap-and-hold a number to see its variation.</p>'
    : '<p class="muted">No tests yet.</p>';

  const recent = state.sessions.slice(-10).reverse().map(s => {
    const by = {};
    for (const x of s.sets) (by[x.ex] ??= []).push(x.reps);
    return `<div class="card"><div class="row"><strong>${esc(s.label)}</strong><span class="muted">${s.date}</span></div>
      <div class="sub">${Object.entries(by).map(([k, r]) => `${esc(exName(k))} ${r.join('/')}`).join(' · ')}</div></div>`;
  }).join('');

  return `<h1>Progress</h1><div class="sub">Bars: best on the goal variation vs year-one target.</div>${cards}
    <h2>Tests</h2>${testTable}
    <h2>Recent sessions</h2>${recent || '<p class="muted">Nothing logged yet.</p>'}
    ${state.sessions.length ? '<button data-act="undo">Undo last session</button>' : ''}`;
}

// ---------- Settings ----------

const SETTINGS = [
  ['pct', 'Training sets, % of test max', 100],
  ['step', 'Reps added per set each week', 1],
  ['sets', 'Sets per exercise', 1],
  ['easyWeek', 'Easy week number', 1],
  ['weeks', 'Weeks per block (incl. test and retest)', 1],
  ['restSec', 'Rest timer, seconds', 1],
];

function settings() {
  const nums = SETTINGS.map(([k, label, mul]) =>
    `<div class="field"><span>${label}</span><input type="number" inputmode="decimal" data-f="setting" data-k="${k}" data-mul="${mul}" value="${Math.round(state.settings[k] * mul)}"></div>`).join('');

  const ladders = L.MAIN.map(key => {
    const ex = state.exercises[key];
    return `<div class="card"><h3>${esc(ex.name)}</h3>
      <div class="field"><span>Year-one target (goal variation)</span><input type="number" data-f="goalReps" data-k="${key}" value="${ex.goal}"></div>
      <p class="muted">Easiest first. Left dot = current variation.</p>` +
      ex.ladder.map((v, i) => `<div class="lad">
        <input type="radio" name="cur-${key}" data-f="cur" data-k="${key}" data-i="${i}" ${v.id === ex.cur ? 'checked' : ''} aria-label="Current">
        <input type="text" data-f="name" data-k="${key}" data-i="${i}" value="${esc(v.name)}">
        <div class="ctl">
        <label class="muted">Level-up <input type="number" data-f="levelUp" data-k="${key}" data-i="${i}" value="${v.levelUp}"></label>
        <label class="muted"><input type="radio" name="goal-${key}" data-f="goal" data-k="${key}" data-i="${i}" ${v.id === ex.goalId ? 'checked' : ''}> Goal</label>
        <span class="btns"><button data-act="move" data-k="${key}" data-i="${i}" data-d="-1" aria-label="Move up">↑</button><button data-act="move" data-k="${key}" data-i="${i}" data-d="1" aria-label="Move down">↓</button><button data-act="del" data-k="${key}" data-i="${i}" aria-label="Delete">✕</button></span>
      </div></div>`).join('') +
      `<button data-act="add" data-k="${key}" style="margin-top:10px">+ Add variation</button></div>`;
  }).join('');

  const timed = L.TIMED.map(k =>
    `<div class="field"><span>${k === 'core' ? 'Core exercise' : 'Carry exercise'}</span><input type="text" style="width:60%" data-f="timed" data-k="${k}" value="${esc(state.timed[k])}"></div>`).join('');

  return `<h1>Settings</h1><h2>Program</h2><div class="card">${nums}</div>
    <h2>Variations</h2><p class="muted">Changing “Now” makes that exercise test at its next session.</p>${ladders}
    <h2>Timed exercises</h2><div class="card">${timed}</div>
    <h2>Backup</h2><div class="card"><p class="muted">Data lives only on this phone. Export now and then.</p>
      <button data-act="export">Export</button>
      <label><button data-act="pick">Import</button><input type="file" id="import" accept="application/json" hidden></label>
      <button data-act="reset">Reset all</button></div>`;
}

function onField(t) {
  const { f, k } = t.dataset, i = +t.dataset.i;
  const ex = state.exercises[k];
  const num = () => { const n = parseFloat(t.value); return Number.isFinite(n) && n > 0 ? n : null; };
  if (f === 'setting') { const n = num(); if (n != null) state.settings[k] = k === 'pct' ? n / 100 : Math.round(n); }
  if (f === 'goalReps') { const n = num(); if (n != null) ex.goal = Math.round(n); }
  if (f === 'levelUp') { const n = num(); if (n != null) ex.ladder[i].levelUp = Math.round(n); }
  if (f === 'name') ex.ladder[i].name = t.value.trim() || ex.ladder[i].name;
  if (f === 'cur') ex.cur = ex.ladder[i].id;
  if (f === 'goal') ex.goalId = ex.ladder[i].id;
  if (f === 'timed') state.timed[k] = t.value.trim() || state.timed[k];
  save();
  dropUntouchedDraft();
  render();
}

function moveVar({ k, i, d }) {
  const lad = state.exercises[k].ladder, a = +i, b = a + +d;
  if (b < 0 || b >= lad.length) return;
  [lad[a], lad[b]] = [lad[b], lad[a]];
  save(); dropUntouchedDraft(); render();
}

function delVar({ k, i }) {
  const ex = state.exercises[k], v = ex.ladder[+i];
  if (ex.ladder.length === 1) return alert('Keep at least one variation.');
  if (!confirm(`Delete “${v.name}”? Logged sets on it stay but show as deleted.`)) return;
  ex.ladder.splice(+i, 1);
  const fallback = ex.ladder[Math.min(+i, ex.ladder.length - 1)].id;
  if (ex.cur === v.id) ex.cur = fallback;
  if (ex.goalId === v.id) ex.goalId = fallback;
  save(); dropUntouchedDraft(); render();
}

function addVar({ k }) {
  const name = prompt('Variation name (added at the hardest end; reorder with ↑):');
  if (!name?.trim()) return;
  state.exercises[k].ladder.push({ id: `${k}-${Date.now().toString(36)}`, name: name.trim(), levelUp: 12 });
  save(); render();
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob), download: `calisthenics-${new Date().toLocaleDateString('sv')}.json`,
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function importData(file) {
  if (!file) return;
  file.text().then(txt => {
    const s = JSON.parse(txt);
    if (!s?.exercises || !Array.isArray(s.sessions) || !s.settings) throw new Error('Not a backup from this app.');
    if (!confirm(`Replace current data with backup (${s.sessions.length} sessions)?`)) return;
    state = s; save(); draft = null; saveDraft(); render();
  }).catch(e => alert('Import failed: ' + e.message));
}

// ---------- Wiring ----------

const actions = {
  tab: d => { tab = d.tab; render(); scrollTo(0, 0); },
  log: logSet,
  finish,
  skip: stopTimer,
  undo: () => {
    const last = state.sessions.at(-1);
    if (!confirm(`Remove ${last.label} from ${last.date}?`)) return;
    state.sessions.pop(); save(); draft = null; saveDraft(); render();
  },
  move: moveVar,
  del: delVar,
  add: addVar,
  export: exportData,
  pick: () => $('#import').click(),
  reset: () => {
    if (!confirm('Delete ALL sessions and settings on this phone? Export first if unsure.')) return;
    state = L.defaults(); save(); draft = null; saveDraft(); render();
  },
};

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (b) actions[b.dataset.act](b.dataset, b);
});
document.addEventListener('change', e => {
  if (e.target.id === 'import') return importData(e.target.files[0]);
  if (e.target.dataset.f) onField(e.target);
});

function render() {
  $('#app').innerHTML = { today, progress, settings }[tab]();
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
}

render();
navigator.storage?.persist?.();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
