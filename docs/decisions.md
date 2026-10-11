<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Decision log

Phase 0 decisions (D1–D9, P1, P2 and the user's answers of 2026-10-11) are in [spike/DECISIONS.md](../spike/DECISIONS.md). This file is the log from Phase 1 on.

## Needs the user

- ~~**2026-10-11 Merges into `phase-1` are blocked in the coordinator session.**~~ **Resolved:** in the milestone 2 part 2 shift Henri merged and committed on `phase-1` without problems. The permission classifier denied `git merge --no-ff` into `phase-1` (and last shift's commits). Verified worker commits are listed in the shift report with the exact merge commands. **Recommendation:** allow Henri to run `git merge --no-ff p1/*-m2` and `git commit -s` on `phase-1` (never push), so verified work lands during the shift.
- Open items for the user: see [backlog.md](backlog.md), "Needs the user".

## Defaults (Phase 1)

Each entry: the choice, why, the alternatives, and what would change it.

### 2026-10-11 Home and CAS share one Giac context, each with its own Ans
- **Choice:** one engine context, so user variables are shared between Home and CAS. Each view keeps its own `Ans` (Giac variables `pasans` for Home, `pcasans` for CAS).
- **Why:** one worker (D2 starts it at launch), no second copy of the 9.8 MB engine in memory. Variables defined in CAS are usable in Home without copying.
- **Alternatives:** two contexts (double the memory and start-up time), or one shared `Ans` (Home decimals would leak into exact CAS work).
- **Would change if:** the G2 shows that Home and CAS keep separate variables (add to the G2 checklist).

### 2026-10-11 CAS time budget
- **Choice:** CAS has a 10 s soft budget (`CAS_SOFT_BUDGET_MS`), after which the UI makes Cancel prominent. Giac's own `timeout 600` is only a safety net. No automatic fallback in CAS (D3).
- **Why:** exact results can take a while, and the user decides when to stop. Home keeps its 300 ms exact → floats guard.
- **Would change if:** Tab One timings show common CAS inputs near 10 s.

### 2026-10-11 Cancel replays definitions only
- **Choice:** after Cancel (worker restart, D3), only the user's definitions are replayed, in the form that ran. `Ans` is not replayed, and inputs that use random numbers get new values.
- **Why:** replay must be fast and must not re-run the cancelled job. Definitions are what the user would lose.
- **Would change if:** users miss `Ans` after Cancel. It could then be stored as a value.

### 2026-10-11 Home number formats (assumed, G2 item 15)
- **Choice:** `digits` means significant digits in every mode. STD drops trailing zeros and is plain for 1E-4 ≤ |x| < 10^digits, otherwise scientific. SCI: `1.235E4`. ENG: `12.35E3` (exponent a multiple of 3). Rounding is half-up from an exact BigInt value; half-even is implemented but switched off until G2 item 8.
- **Why:** it's our own formatter (D5), and it matches the observed `1÷3` → `0.333333333333`. The rest waits for the G2.
- **Would change if:** the G2 answers to items 8 and 15 differ.

### 2026-10-11 P2 condition met: releases use the container toolchain
- **Result:** the engine built with Debian's Emscripten 3.1.69 (`debian:trixie@sha256:913f6706…`, `emscripten=3.1.69+dfsg-3`, script `engine/giac/build-wasm-release.sh`) passes interrupt 16/16, Home 123/123 and Solve 23/23 with output identical to the emsdk build. On the Tab One (Android 15, WebView 131.0.6778.260, release builds of the spike app, 7 cold starts and 5 benchmark runs each), cold launch → engine ready p50 is 896 ms (emsdk) vs 917 ms (container), +2.3%. First result is 1001 vs 1016 ms (+1.5%). Benchmark first-call p95 over 55 cases is 76.7 vs 72.6 ms. Cancel → ready is 322 vs 306 ms.
- **Choice:** P2's bar (within +10%) is met, so every release builds the engine in the container. emsdk stays for development.

### 2026-10-11 Mixed numbers in textbook entry (assumed, G2 item 17)
- **Choice (for now):** the a/b key inserts the same plain stacked fraction as ÷. A digit directly before a stacked fraction parses as `2*1/2`. A mixed-number form of a/b (2½ → `(2+1/2)`) is planned but not built yet.
- **Why:** P1 only accepts what our keyboard produces. A separate mixed-number template keeps the parser unambiguous once it exists.
- **Would change if:** the G2 shows how a/b mixed numbers are entered and read (item 17).

### 2026-10-11 Golden gate
- **Choice:** `(cd app && npm run golden)` is the gate for every engine build that ships (interrupt, Home, Solve, benchmark, parser). It replaces the separate spike runners. The G2 checklist is generated from `tests/golden/g2.yaml` (`oracle.py --g2`), so edit the YAML, not the .md.

### 2026-10-11 Entry and history behaviour (assumed until the G2 checks)
- **Cancel:** while a job runs, it stops the job and keeps the history (the entry is marked cancelled). When idle, it clears the entry line. Enter while a job runs is ignored.
- **Clear (shift + ⌫):** clears the entry line; on an empty line it clears the current view's history.
- **History:** Home and CAS keep separate histories over one shared variable context. Tapping an entry's input puts it back on the entry line. History isn't stored yet; settings and the current view are (IndexedDB).
- **Shift and alpha** are one-shot; shift + alpha types capitals. Alpha lock comes later.
- **One-line mode** shows fractions and roots linearly (`1\div3`); exponents stay raised for now.
- **Why:** each is the fastest path for keyboard use (principle 2), matches what a calculator user expects, and can be changed once the G2 is checked.
- **Sto▶** goes on a shift layer of an existing key (all 40 cells are taken), position `assumed`.

### 2026-10-11 How the Tab One "Enter → drawn result" number is measured
- **Choice:** the 55 benchmark inputs are Giac text (matrices, `factor`, …), and most have no key sequence. In measurement builds (`?bench=1`) they go through `Session.submit(latex, giacOverride)`: the real engine, LaTeX tidy-up and MathLive rendering, skipping only our parser. Parser speed is measured separately in desktop tests.
- **Would change if:** we want a keyboard-only benchmark. That needs a separate set of inputs that can be typed.

### 2026-10-11 Default angle mode: radians (assumed)
- **Choice:** new installs start in radians. The setting is stored and can be changed in the settings panel.
- **Why:** Giac's default, and the safe choice for the engineering and maths work this calculator is for. The reference calculator's factory default isn't observed yet.
- **Would change if:** the G2 shows another factory default (add to the G2 checklist).

### 2026-10-11 Bit-reproducible release engine
- **Finding:** clang 19 at `-Oz` gave different object files from run to run under address-space randomisation (ASLR), so two container builds produced different `giac.wasm` files. Their output was still identical: 0 differences in 476 golden outputs.
- **Choice:** `engine/giac/build-wasm-release.sh` runs the engine build under `setarch -R` (ASLR off) inside the container. That needs `--security-opt seccomp=unconfined` for rootless podman, so the container can call `personality()`. It still only mounts scratch copies. Two builds in one checkout and one from a fresh clone all give `giac.wasm` SHA-256 `ab5ca4eb…3003a`.
- **Why:** F-Droid's reproducible builds need the same bytes on every build (principle 1).
- **Would change if:** a clang or Emscripten update makes `-Oz` deterministic, or F-Droid's build server can't turn off ASLR (then we look for the compiler pass that depends on addresses).

### 2026-10-11 Residual check thresholds for Solve and Plot analysis
- **Choice:** a root is accepted silently when its relative residual, evaluated at 30 digits, is ≤ 1e-15. 1-D roots above that are shown with ⚠. For systems, a residual < 1e-6 is shown with ⚠, and anything worse is reported as no solution (Giac's `hybrids` returns the guess unchanged when it fails, so the check is the only guard).
- **Why:** docs/02 section 4 requires substituting every root back. 1e-15 is far above 30-digit noise and far below anything a 12-digit display would show as wrong.
- **Alternatives:** an absolute threshold (fails for large-scale equations), or showing every residual (clutter).
- **Would change if:** golden or user cases show false ⚠ on well-conditioned roots, or the G2 (items 12–14, 20) shows a different policy.

### 2026-10-11 Polynomial root order (assumed, G2 item 21)
- **Choice:** real roots in ascending order, then complex roots by real part, then imaginary part. `proot` results are polished with Newton at 30 digits.
- **Would change if:** G2 item 21 shows another order.

### 2026-10-11 Solve and analysis time limit
- **Choice:** a 30 s hard Giac timeout per solve or analysis call. Cancel is the user's own limit.
- **Why:** a runaway `fsolve` must never hang the worker. Normal solves take well under 300 ms (milestone 2 bar).

### 2026-10-11 Signed area in Plot analysis
- **Choice:** Romberg at 30 digits, then the exact `int` (0.5 s budget), then `gaussquad` with ⚠, always cross-checked against `gaussquad`. A pole inside the interval gives "no area" (G2 item 22).
- **Why:** Romberg is fast on smooth functions but doesn't converge at kinks; the exact integral covers those.

### 2026-10-11 Plot root search stays inside the visible window
- **Choice:** root, extremum and intersection from the Plot menu search only the visible x-range, starting at the trace position.
- **Why:** what the user sees is what they asked about; a root far off-screen would be confusing. Sign changes at poles are not roots (residual check).
- **Would change if:** the G2 shows the reference searching beyond the window.

### 2026-10-11 Function app defaults (assumed, G2 items 23–25)
- **Choice:** default Plot window x ∈ [-10, 10], y at the same scale as x, centred on 0; canvas renderer with "hybrid" sampling (D7, fastest on desktop: 59.3 fps at CPU ×4). Trace step = a 1-2-5 step near window width / 100, so trace x-values stay short decimals. Num starts at X = 0 with step 1, 12 rows per screen, one engine call per screen. Intersection uses the traced function and the next function that is on. The Symb slots are written with `X`; the parser maps `X` to Giac's `x`.
- **Why:** a square, centred window shows the shape of most engineering functions at once; short trace values are easier to read and type back; one engine call per screen keeps Num fast.
- **Alternatives:** the reference's own window and trace step (unknown until the G2 checks), a free-form trace step, a chooser for the second function of an intersection (an extra key press every time).
- **Would change if:** the G2 checks (items 23–25) show other defaults, or Tab One measurements show the canvas renderer is slower there.

### 2026-10-11 Solve app variables and results (assumed, G2 items 12–14, 20)
- **Choice:** the Solve app keeps names as typed (`x` and `X` are different unknowns; the Function app maps `X` to `x`). New unknowns start at 0. With one equation, Solve finds the selected unknown and holds the others fixed; with N equations it finds N unknowns, the selected one first. A failed solve or a failed residual check shows ⚠ with the engine's info line. A polynomial with exactly one real root also writes that root into the value.
- **Why:** engineers expect case-sensitive names, as in the CAS. Starting at 0 is predictable.
- **Alternatives:** fold case (would clash with CAS variables), or start from the last value used anywhere.
- **Would change if:** the G2 (items 12–14, 20) shows a different behaviour. Known gap: subscripted names (`x_1`) aren't solvable yet, because our own name check (`IDENT` in `solve.ts`, `analysis.ts`) rejects the underscore. Giac itself reads `x_1` as a plain variable (checked 2026-10-11: `type(x_1)` → identifier); only `<number>_<unit>` is a unit.

