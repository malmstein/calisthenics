// Pure training logic. No DOM, no storage — shared by app.js and test.js.

export const MAIN = ['pull', 'dip', 'push', 'squat', 'burpee'];
export const TIMED = ['core', 'carry'];
export const PLAN = {
  A: ['pull', 'dip', 'squat', 'core'],
  B: ['push', 'pull', 'burpee', 'carry'],
  C: ['dip', 'push', 'squat', 'core'],
};

const ladder = (key, names, goalIdx) => {
  const items = names.map((name, i) => ({ id: `${key}-${i}`, name, levelUp: 12 }));
  return { ladder: items, cur: items[0].id, goalId: items[goalIdx].id };
};

export const defaults = () => ({
  settings: { pct: 0.6, step: 1, sets: 3, easyWeek: 5, weeks: 8, restSec: 90 },
  exercises: {
    pull: { name: 'Pull-up', goal: 10, ...ladder('pull', ['Heavy band pull-up', 'Light band pull-up', 'Negative pull-up', 'Pull-up'], 3) },
    dip: { name: 'Dip', goal: 15, ...ladder('dip', ['Bench dip', 'Band dip', 'Bar dip'], 2) },
    push: { name: 'Push-up', goal: 25, ...ladder('push', ['Incline push-up', 'Knee push-up', 'Push-up'], 2) },
    squat: { name: 'Squat', goal: 60, ...ladder('squat', ['Box squat', 'Air squat'], 1) },
    burpee: { name: 'Burpee', goal: 30, unit: 'in 2 min', ...ladder('burpee', ['Step-back burpee', 'Burpee'], 1) },
  },
  timed: { core: 'Hollow hold', carry: 'Farmer carry' },
  sessions: [],
});

export const variation = (ex, id) => ex.ladder.find(v => v.id === id);
export const vIndex = (ex, id) => ex.ladder.findIndex(v => v.id === id);

function lastTestIdx(sessions) {
  for (let i = sessions.length - 1; i >= 0; i--) if (sessions[i].kind !== 'train') return i;
  return -1;
}

export function nextSession({ settings, sessions }) {
  const t = lastTestIdx(sessions);
  if (t < 0) return { kind: 'test', label: 'Test', week: 1, block: 1 };
  const block = sessions.filter(s => s.kind !== 'train').length;
  const n = sessions.length - 1 - t; // everything after a test is training
  if (n >= 3 * (settings.weeks - 2)) return { kind: 'retest', label: 'Retest', week: settings.weeks, block };
  return { kind: 'train', label: 'ABC'[n % 3], week: 2 + Math.floor(n / 3), block };
}

// Rep target for training week w (2..weeks-1) from a test max.
export function target({ pct, step, sets, easyWeek }, max, w) {
  const base = Math.max(1, Math.round(pct * max));
  if (w === easyWeek) return { sets: Math.max(1, sets - 1), reps: base + Math.max(0, w - 3) * step };
  return { sets, reps: base + (w - 2 - (w > easyWeek ? 1 : 0)) * step };
}

// Latest test result on the exercise's current variation, or null.
export function testMax({ exercises, sessions }, key) {
  const cur = exercises[key].cur;
  for (let i = sessions.length - 1; i >= 0; i--)
    for (const s of sessions[i].sets) if (s.ex === key && s.test && s.v === cur) return s.reps;
  return null;
}

export function lastTimed({ sessions }, key) {
  for (let i = sessions.length - 1; i >= 0; i--) {
    const secs = sessions[i].sets.filter(s => s.ex === key).map(s => s.reps);
    if (secs.length) return Math.max(...secs);
  }
  return null;
}

// Best reps on the goal variation or harder — what counts toward the year-one target.
export function goalBest({ exercises, sessions }, key) {
  const ex = exercises[key];
  const gi = vIndex(ex, ex.goalId);
  let best = 0;
  for (const s of sessions) for (const x of s.sets)
    if (x.ex === key && vIndex(ex, x.v) >= gi) best = Math.max(best, x.reps);
  return best;
}

// 0..1, how far along the ladder toward the year-one target. Lowest trains first.
export function progressScore(state, key) {
  const ex = state.exercises[key];
  const ci = vIndex(ex, ex.cur), gi = vIndex(ex, ex.goalId);
  const m = testMax(state, key) ?? 0;
  const of = ci >= gi ? ex.goal : variation(ex, ex.cur).levelUp;
  return (Math.min(ci, gi) + Math.min(1, m / of)) / (gi + 1);
}

export function buildSession(state) {
  const next = nextSession(state);
  if (next.kind !== 'train')
    return { next, items: MAIN.map(ex => ({ ex, kind: 'test', v: state.exercises[ex].cur, sets: [null] })) };
  const items = PLAN[next.label].map(ex => {
    if (TIMED.includes(ex)) return { ex, kind: 'time', sets: Array(state.settings.sets).fill(lastTimed(state, ex) ?? 30) };
    const v = state.exercises[ex].cur;
    const max = testMax(state, ex);
    if (max === null) return { ex, kind: 'test', v, sets: [null] };
    const t = target(state.settings, max, next.week);
    return { ex, kind: 'reps', v, sets: Array(t.sets).fill(t.reps) };
  });
  const score = it => (it.kind === 'time' ? 2 : progressScore(state, it.ex));
  items.sort((a, b) => score(a) - score(b));
  return { next, items };
}

// Exercises whose test reached the current variation's level-up number.
export function levelUps({ exercises }, sets) {
  return sets.flatMap(s => {
    const ex = exercises[s.ex];
    if (!s.test || !ex || s.v !== ex.cur) return [];
    const i = vIndex(ex, ex.cur);
    const to = ex.ladder[i + 1];
    return to && s.reps >= ex.ladder[i].levelUp ? [{ ex: s.ex, reps: s.reps, from: ex.ladder[i], to }] : [];
  });
}
