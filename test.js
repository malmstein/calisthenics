import assert from 'node:assert/strict';
import * as L from './logic.js';

const s = L.defaults().settings;

// Spec example: test 8 → 3×5, 3×6, 3×7, 2×7 (easy), 3×8, 3×9
assert.deepEqual(
  [2, 3, 4, 5, 6, 7].map(w => L.target(s, 8, w)),
  [{ sets: 3, reps: 5 }, { sets: 3, reps: 6 }, { sets: 3, reps: 7 },
   { sets: 2, reps: 7 }, { sets: 3, reps: 8 }, { sets: 3, reps: 9 }]
);
assert.equal(L.target(s, 0, 2).reps, 1);

// Block derivation: test → 18 training sessions (A/B/C) → retest
const st = L.defaults();
assert.equal(L.nextSession(st).kind, 'test');
st.sessions.push({ kind: 'test', sets: [{ ex: 'pull', v: st.exercises.pull.cur, test: true, reps: 8 }] });
assert.deepEqual(L.nextSession(st), { kind: 'train', label: 'A', week: 2, block: 1 });
for (let i = 0; i < 4; i++) st.sessions.push({ kind: 'train', sets: [] });
assert.deepEqual(L.nextSession(st), { kind: 'train', label: 'B', week: 3, block: 1 });
for (let i = 0; i < 14; i++) st.sessions.push({ kind: 'train', sets: [] });
assert.equal(L.nextSession(st).kind, 'retest');

// Session build: pull-up has a test → targets; dip has none → test set
const sess = L.buildSession({ ...st, sessions: st.sessions.slice(0, 1) });
const pull = sess.items.find(i => i.ex === 'pull');
const dip = sess.items.find(i => i.ex === 'dip');
assert.deepEqual(pull.sets, [5, 5, 5]);
assert.equal(dip.kind, 'test');
assert.equal(sess.items.at(-1).ex, 'core');

// Level-up suggestion at retest
st.exercises.pull.cur = st.exercises.pull.ladder[1].id;
const ups = L.levelUps(st, [{ ex: 'pull', v: st.exercises.pull.cur, test: true, reps: 12 }]);
assert.deepEqual(ups.map(u => u.ex), ['pull']);
assert.equal(ups[0].to.id, st.exercises.pull.ladder[2].id);

console.log('ok');
