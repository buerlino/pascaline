# Night report 2026-10-18

Pipeline runs 3 to 25, eight Opus passes. Final gates (pass 7, phase-1 40c4bea; pass 8 reran typecheck, vitest and e2e on 08655e8): typecheck 0 errors, vitest 931/931, e2e 1018 passed and 1 skipped, golden gate passed (units p95 3.5 ms), oracle.py 0 problems. Nothing was pushed.

## Merged into phase-1
- A6 130c12f (the gate command), G16 1bfd594 (unit core), G17 a4496d5 (temperature units), G17f1 17fdfad.
- G18 5b7e0d8 (unit uncertainty), G18f1 76e3eb6, G25 d9b177a (what a unit result shows), G25f1 211f0db, G13 d08e955 (libqalculate data and 13 CODATA overrides).
- G22 2da4017 (why a mark), G22f1 7556623, G23 e1d24b9 (escalating digits), G23f1 b5a2dfb, R51 f970848 (number spacing).
- R39 0f5ca8e (odd roots of negatives), R52 7c8c2c7 (parser messages in i18n), G14 7635cfc (marks), G14f1 9930ad6.
- G26 eb5eef2 (constant uncertainty), S4 40c4bea (connector research), S9 027b4c8 (results-mode research), R50a 08655e8 (three palettes mockup).

## Unmerged
Nothing. G22f1 failed its first run (e2e under host load 12 on 16 cores) and was merged review-only after pass 5 (7556623).

## Opus passes (NOTES)
- Pass 1: found `A6f1` (the gate's golden trigger misses `app/src/units/`, `find/`, `tools/find-index/`; same gap in `scripts/pipeline.sh:237`). Decided: °C/°F alone give K, dBm/dBW give W, a lone dB, bel or Np is refused (G17f1).
- Pass 2: R28 writes ± as `pasupm(value,sigma)`; ± inside sin, cos and tan is correct. G15: G25 made rpm a cycle unit, so `60 rpm → rad/s` is now refused.
- Pass 3: G13's 13 CODATA overrides stay (all match NIST 2022). R28 must put the sign inside `pasupm`: `−pasupm(20,0.5)·°C` is refused.
- Pass 4: a Playwright run on the default port reused a stale dev server from the main checkout (pid 4016472, branch p1/sandra-padlayout); the owner may stop it. Opus passes must export their own `PW_PORT`. The Find key-timing test in `src/find/queries.test.ts` fails under load.
- Pass 5: three timing failures in one night (G23's 50 ms test, the Find timing test, G22f1's e2e). A check that fails under load should be rerun once before it counts as a fix round. After G23 a row with no confirmed digit has no tap target (R36 or R12b).
- Pass 6: `irem(x,3)` returning `x` is older than G14. `x<0.5` is shown as `(1/2)>x`, and `x==0.5` is marked ≈ unchecked where `x==0.5+y` is marked = (R36 or a later marks package).
- Pass 7: a stored name that holds a constant's value (`h:=G*2`) has no `uncDigits` (R40); the row is still marked ≈. Importing a library waits for A4a point 2's replay fix (about 530 ms for 200 programs on the Tab One).
- Pass 8: for R50b, the mockup draws ⚠ on an error row, but in the app ⚠ marks unconfirmed digits (the owner should judge `--warn` on a ⚠ number row). In the High contrast light theme, ≈ (6.61:1) and error text (5.78:1) on `--pick` fall below that palette's 7:1 bar; `style.test.ts` should check that pair.

## What the owner must do (decisions.md "Needs the user")
1. S4: the scope of a library file (recommendation: definitions only).
2. S9: the yes for results mode on the View key (S2's Menu numbers and R53 wait for it).
3. G15: keep the `rpm → rad/s` refusal and give it its own message pointing to tr/min (recommended).
4. R50a: pick a palette, or a mix, on the phone; R50b writes it into `style.css`.
5. Merge S5 (the unit pad's arrangement); the rest of the unit chain waits for it.
6. Stop the stale dev server from the main checkout (pid 4016472).

## Queue left for the next night
- Steps 22, 23, 25, 26, 28 and 29 wait, directly or through the chain, for S5; they stay in the queue.
- Day packages: A6f1 (golden trigger for the unit view in `gate.ts` and `pipeline.sh`).
- New small annabell packages: rerun a check that fails under load once before it counts as a fix round (`scripts/pipeline.sh`); a load-proof Find key-timing test.
