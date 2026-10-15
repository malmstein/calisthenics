# Calisthenics training app — design

Personal, offline, phone-first training log. Sources: Marcus/Markus Frison's
"start calisthenics from zero" video (principles, exercises, year-one targets)
and the BuiltSimple "The Why" guide (8-week block, test/retest, 1–2 reps in
reserve). Neither source gives a per-session formula; the one below is ours.

## Platform

Static PWA: `index.html`, `app.js`, `logic.js`, `manifest.json`, `sw.js`, icons.
Vanilla JS modules, no build step, no server. State in `localStorage`
(`navigator.storage.persist()` requested), JSON export/import as backup.
Service worker serves cached files first, refreshes in background.

## Exercises

Main (tested, rep targets): pull-up, dip, push-up, squat, burpee.
Year-one targets on the goal variation: 10 pull-ups, 15 dips, 25 push-ups,
60 air squats, 30 burpees in 2 minutes.

Timed (no target, logged in seconds, last result shown): core, carry.

Each main exercise has an editable ladder of variations, easiest first.
Each variation has a level-up number (default 12). One variation is marked
goal. One is current. Defaults:

- Pull-up: heavy band, light band, negatives, **pull-up**
- Dip: bench dip, band dip, **bar dip**
- Push-up: incline, knee, **push-up**
- Squat: box squat, **air squat**
- Burpee: step-back burpee, **burpee**

## Block (default 8 weeks)

Week number derives from session count, not the calendar, so missed days
don't break the block.

- Week 1: test session. Max reps on current variation for each main
  exercise (burpees: max in 2 minutes).
- Weeks 2–7: training, 3 sessions per week rotating A, B, C.
  - A: pull-up, dip, squat, core
  - B: push-up, pull-up, burpee, carry
  - C: dip, push-up, squat, core
  - Main exercises ordered furthest-from-target first; timed last.
- Week 8: retest. Its results are the next block's week-1 test.
  For each exercise whose retest max ≥ current variation's level-up number,
  the app offers to move up a variation (that exercise then tests next session).

## Targets

`base = max(1, round(pct × testMax))`. Each non-easy training week adds
`step` reps per set. Easy week: `sets − 1` sets at the previous week's reps.

Defaults: pct 0.6, step 1, sets 3, easy week 5, rest 90 s. All editable.
Example, test 8: 3×5, 3×6, 3×7, 2×7, 3×8, 3×9.

Test max = latest test result on the exercise's current variation. If none
(variation changed), that exercise shows a single max-reps test set in its
next session, then targets follow from it.

## Screens

- Today: next session, per-set target prefilled, ✓ logs set and starts rest
  timer, Finish saves. Draft survives app restarts.
- Progress: per exercise current variation, latest test, best on goal
  variation vs year-one target; test history; recent sessions; undo last.
- Settings: numbers above, ladder editor (rename, level-up, goal, current,
  reorder, add, delete), timed names, export/import/reset.

## Testing

`node test.js` checks the target formula and week/rotation derivation.
Manual check in the browser at phone width.
