<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# The core list (P23)

**What it is.** `core.yaml` is the definition of "the core holds" (decisions.md "P23", owner, 2026-10-21): about fifty everyday tasks on Home, CAS, the matrix templates, Solve and Function, each as the keys a user presses and what the screen must show. While the core freeze lasts, no new feature is built; the work is this list, the bugs it finds and the bridge (docs/shifts/brief.md section 0).

**The freeze ends** when every active case passes in the desktop e2e suite and on the night's device (the Tab One or the Fairphone 6, the same one both nights; owner, 2026-10-22), on two nights in a row, and the owner's morning check ([MORNING.md](MORNING.md)) finds nothing on both mornings. The night's device step logs its count (`CORE DEVICE` lines in `.coord/log.md`).

## Rules
- **Expected values** are `derived` or `oracle` (mpmath 1.3.0 in `tests/golden/.venv`), as in a golden case; never from memory of another calculator, never from what the app shows today. The shown text follows docs/04 2.4 and 2.6: 12 digits, `E` for large and small numbers, `=` exact, `≈` rounded with every digit right. A CAS result built from exact names carries no mark (docs/04 2.9, G51): those cases say `mark: none`.
- **`known: <bug>`** marks a case that fails today for an open bug line of `docs/backlog.md`. The harness expects it to fail; when it passes, the harness fails until the `known:` goes (a ratchet, like `tests/golden/viewsweep-known.yaml`). A new failure without `known:` fails the check.
- **`needs: <package>`** marks a case that cannot be keyed today: a command by name (`solve`, `det`) waits for Find (R4a), because letters typed with Alpha multiply (`det` is d·e·t, parser.yaml `implicit-multiplication-03`). The harness skips it and prints why. Its keys are a placeholder: Find does not change how typed letters read, so the package named rewrites them as its own route (R4a's Done when).
- **The list changes with the owner.** A case is added when the owner asks, or as the regression case of a bug the list missed; a case leaves only with the owner's word. Keys are ids of `spec/keyboard.yaml` and the status-line controls of `app/test/helpers.ts` (`@cas`, `@mode`, …).
- **`hand: true`** puts a case on the morning list. MORNING.md lists exactly those ids (R74 checks it).

## How it runs
- **Desktop:** `app/test/core.spec.ts` (R74) replays every case in Playwright on the real engine, one fresh page per case, in parallel; a reporter prints `CORE <passed>/<active> (known <n>, needs <n>)` once at the end. It is part of `npm run test:e2e`, so every pipeline run checks it.
- **Device:** the same cases through the night's device's WebView (A32): a test build with WebView debugging, Playwright attached over adb, the same replay code. At night the pipeline's device step runs it after each Opus pass (A33; docs/shifts/rules.md section 6).
- **By hand:** MORNING.md, the owner, about ten minutes on the night's device, on the APK the night checked (owner, 2026-10-24).

## State on 2026-10-21 (`73ea5b5`, desktop, sandra's replay)
56 cases: 53 active, 3 need R4a. 48 pass; c41 and c42 fail on F68 (x⁻¹ or xʸ after a matrix lands in an empty box; c42 then shows `= [[1.4],[-0.8]]`, the elementwise "inverse" of a column, F69). c52–c56 were added with the owner on 2026-10-21 (sandra's probe on `e0d03ed`): c52 fails on F65, c53 on F55, c56 on F72; c54 and c55 pass. The replay was a throwaway probe of the same shape as R74's spec (its results are in the shift report `docs/shifts/2026-10-21-sandra-freeze-report.md`).
