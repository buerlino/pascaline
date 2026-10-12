<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Decision log

Phase 0 decisions (D1–D9, P1, P2 and the user's answers of 2026-10-11) are in [spike/DECISIONS.md](../spike/DECISIONS.md). This file is the log from Phase 1 on.

## Needs the user

- Open items for the user: see [backlog.md](backlog.md), "Needs the user".
- **2026-10-12 P8: Roadmap for the precision-engineering goal (the engineer core). DECIDED by Henri at the user's request ("decide based on the goal"), from two reviews and the user's rules; confirmed by the user (2026-10-12), no veto.** Full text: [03-feature-analysis.md](03-feature-analysis.md); tasks: backlog "Engineer core".
  - **Rules (user, 2026-10-12):** no content split by discipline, everything findable by anyone; a unit must beat typing `E-10`; units stay separate from normal calculation unless they make it easier; fewer features done well beat G2 parity.
  - **Order:** milestone 4 "Find and trust" (task benchmark first, Find, honest precision, copy/share/export), 5 "Units", 6 "Structure" (matrices and lists, number bases, everyday functions). Each milestone runs as three parallel tracks (ron UI, gorge engine/data, annabell Capacitor/devices) and is done when its benchmark tasks pass within budget. The MVP release is not scheduled (user: not a priority). Statistics, spreadsheet, signals, extra plot types and the parity apps are deferred.
  - **Keys:** Math opens Find (one search over functions, constants, units, variables); Vars opens Find on variables; Shift+Tmpl opens the Units app (the reference's units position, G2 item 30); Tmpl lists templates (with EN5); the Home/CAS Menu holds view actions (copy, share, clear).
  - **Units:** a separate Units app on libqalculate; Home, CAS, Solve and lists stay unit-free; constants go into them as numbers. Conversions must stay exact where the SI factors are (`72 km/h → m/s` = 20, to verify with qalc's "try exact" mode). SI prefixes in display; prefix entry chips only if the benchmark shows a gain. **Amends P3 decisions 2 (pickers → Find) and 6 (units in scalar Home expressions → Units app only).**
  - **Dropped:** the categorised formula library; the user's own functions are found through Find.
  - **Why:** speed comes from keystrokes per task, not latency (92 ms p95 already); finding a function or unit is where the keystrokes go today (Vars/Math/Tmpl and the Home Menu do nothing). Keeping units in their own app keeps Home as fast as it is, removes the Giac/qalc split and costs about 9 days instead of 11–12.
  - **Alternatives:** units everywhere through a units layer in our own parser, Giac computing on exact SI values (reaches Solve and variables; set aside for v1 by rule 3 and cost); Giac's own units (turn exact values into floats, print `m^-1.0`, smaller database: rejected); units first (the earlier proposal: Find first, because units need its picker).
  - **Would change if:** the benchmark or the user's hand timing shows units or Find losing to typing; after the Units app is in use, Home users ask for `5 km + 300 m` directly (then: the qalc worker serves Home behind a setting).
- **2026-10-12 P9: Typed decimals in the CAS view become exact, as in Home. ACCEPTED by the user (2026-10-12).** Proposed by sandra (docs/04 section 2.9). Today the CAS view reads `0.9` as a binary float, and nothing marks the results: CAS `1-0.9-0.1` gives `1.7763568394E-15` (correct: 0), `evalf(sin(10^22))` gives `-0.54764225985` (correct: −0.852200849767…, mpmath; Home gets it right), `1e16+1-1e16` gives `0.0` (correct: 1). Probes in docs/04 Appendix A.
  **Recommendation: yes.** The CAS view runs typed decimals through the same `toExactLiterals` as Home before evaluation; `approx()` (Shift + Enter) still gives decimals, now formatted by our formatter and marked `≈` (docs/04 2.4).
  - **Why:** principle 3 (no silent wrong answers). The `≈` mark alone cannot help here: it would show `≈ 1.7763568394E-15` for a result that is exactly 0.
  - **Cost:** about half a day (gorge) plus golden cases. Visible change: `1.5x` shows as `3/2·x`, where the reference CAS keeps `1.5·x`; `solve(x^2=2.0,x)` gives `±√2` instead of `±1.41421356237`.
  - **Alternatives:** keep floats and only mark them (wrong digits stay, marked); floats at 30 digits (`1-0.9-0.1` is still not 0: 2.96E-31 at 30 digits, probe).
  - **Would change if:** the owner prefers the reference's CAS behaviour for decimals; then CAS results with floats are marked `≈` and the user is pointed to Home for decimal arithmetic.
- **2026-10-12 P10: Giac's English help lines in Find (EN1). ACCEPTED by the user (2026-10-12).** Proposed by sandra. Find's preview shows each function's syntax, one line and an example from Giac's `doc/aide_cas`. R5 reads the English lines as GPL-3.0-or-later (Giac's README), with an inconsistency in the README that only B. Parisse can resolve.
  **Recommendation:** build with the English lines now (only English, never the French lines; generated at build time, nothing committed), and add the confirmation question to the planned email to Parisse (backlog "Needs the user" 5) before any public release. Cost: none now. Alternative: our own one-line descriptions only (about 2 days of writing for the curated set; the other ~1,500 commands would show no help).
- **2026-10-12 P6: Python compatibility with the reference (G5, G2 items 27 and 28). PROPOSED, needs the user.** The reference reaches the calculator through `hpprime.eval(text)`: numbers come back as floats even when whole, lists as lists of floats, symbolic CAS results (`eval('CAS("...")')`) as text, and errors as text, never raised. Its drawing disappears when the script ends (the shell repaints), so scripts end with a wait loop. Ours: `calc.cas` always returns text, `calc.eval` keeps exact integers as `int`, both raise `ValueError`; `hpprime.eval` is a thin alias of `calc.cas`; the canvas keeps the drawing.
  **Recommendation: match the reference in the compatibility module only, keep `calc` and the canvas as they are.**
  1. `hpprime.eval` behaves like the reference's: Home evaluation with floats for every number (lists of floats, nested lists for a matrix, text for anything else); `CAS("...")` inside the text goes to the CAS, numeric results as floats, symbolic ones as text; an error comes back as text (`"Error: ..."`, with Giac's wording, not the reference's). This module exists to run scripts written for the reference, and those scripts test the result's type or compare against error text.
  2. `calc.cas` and `calc.eval` stay as built: `calc` is our own API for new scripts, where raising lets the editor point at the failing line and `try`/`except` works as in any Python; ints for exact integers keep `range(calc.eval("2^10"))` and indexing working. Changing it would also break the 22 Python golden cases for no gain.
  3. The drawing stays on screen after the script ends. On the reference that it disappears is a side effect of the shell repaint, not a feature; a reference script with a wait loop still works here (Cancel stops it), and a script without one shows its drawing instead of a blank screen. Like the reference, a run doesn't clear the screen at start (already ours).
  Cost of 1: about half a day (compat module, 6–8 golden cases from item 28 with `source: virtual-calc`).
- **2026-10-12 P7: Keypad gestures: a trackpad, flicks for the shift and letter layers, a compact keypad. DECIDED by the user (2026-10-12), except the Shift/Alpha merge (open, see 4).** Tasks K1–K5 in `docs/backlog.md`.
  **Revised 2026-10-12 evening (user, on Henri's recommendation): the whole keypad is the 2D cursor; flicks are dropped.** This replaces points 2, 3 and 4 and the "why a separate block" reason in point 1.
  - **Hold, then drag, anywhere on the keypad** (about 350 ms still) turns the keypad into the trackpad: the keys dim, a drag moves the cursor in 2D through the formula with the K1 stepping (12 px per step, one haptic tick per step), lifting the finger ends it. Same steps as the arrow keys, so Plot, Num and the Symb lists work the same way. Why: moving around inside a formula is where entry time goes, and a keypad-sized surface is faster and more precise than the arrow block; it's the familiar phone-keyboard cursor drag.
  - **Shift and Alpha stay as they are** (taps one-shot, L3 double-tap locks). No flicks, no lock flicks, no merge (points 2–4 dropped; the K2 classifier sits unmerged on `p1/ron-eve-gestures@96fcf50`).
  - **Cost:** a key can only fire when the finger lifts, not on touch (it can't know yet whether a hold follows), as on every phone keyboard. ⌫ is the exception: holding it keeps auto-repeat, not the cursor. Check the feel on a device.
  - **Arrow keys stay for now** (K1 trackpad over them, merged `e900263`). The user's goal is to remove them later to free the cells for other functions; that comes later.
  - Points 1 (as the stepping engine) and 5 (compact keypad, K4) stand.
  1. **Trackpad in place of the arrow keys (decided).** The four arrow keys become one trackpad over the same 2×3 cells of the upper cluster. A drag moves in two dimensions, like the cursor drag on a phone's space bar: about one step per 12 px, a haptic tick per step. In the entry line, left/right moves through the text and up/down moves between numerator, denominator and exponent. In Plot the same drags trace the curve (left/right) and switch functions (up/down); in Num they scroll. A short tap on an edge still makes one step, so it also works as the round pad. **Why a separate block, not the whole keypad as a trackpad:** every key now has its own flick, so a whole-pad trackpad would need "hold, then drag", which adds a wait and moves the cursor by accident during fast typing.
  2. **Flicks on every key, up and down only (decided).** Flick up = the key's shift function, flick down = its letter (capital, as Alpha gives now). **Legends: the shift legend at the top left, the letter at the bottom left** of the key (user, 2026-10-12: not centred; today the shift legend sits top right and the letter top left). While sliding, a bubble above the key shows what will fire, with a haptic tick at the threshold; sliding back to the middle cancels. No left/right flicks: they have no natural meaning and diagonal slides would misfire. Cost: a key fires when the finger lifts, not on touch (the direction is only known then), as on every phone keyboard. The pad needs `touch-action: none` so the page doesn't scroll during a flick.
  3. **Keep the Shift and Alpha keys where they are, and give them lock flicks (decided).** A tap stays a one-shot, as on the reference (muscle memory, and the layout stays the reference's: one layout only). New: flick down on Alpha locks capitals, flick up on Alpha locks lowercase, flick up on Shift locks shift. This replaces double tapping as the fast way to stay in a mode, and follows the same rule as every key (up = shift side, down = letter side). The double-tap locks (L3) keep working.
  4. **Merging Shift and Alpha into one key (OPEN, discussed 2026-10-12).** The user's idea: flicks make one-shot Alpha almost unnecessary, so the left column could gain a key. A merged mode key at Shift's position would do: tap = shift for the next key; flick up = shift lock; flick down = letter lock (capitals); tap while letters are locked = switch between capitals and lowercase. Alpha's cell above it becomes free. **Recommendation: not yet.** (a) Nobody has used the flicks yet; decide after a few days of real use on the phone. (b) There's no function waiting for the freed cell yet; candidates are the P3 Units menu (the reference puts it on Shift + a key, `g2.yaml` item 30) and the STD → SCI → ENG format key (feature requests). (c) Merging later is a small change (`spec/keyboard.yaml` and tests); taking a key away after people have learned the layout is the expensive direction. The cost of merging: someone coming from the reference who presses "Alpha, then a key" hits the new key instead.
  5. **Hiding the keypad: the View key only (decided).** The empty cell where the reference has View (row 1, column 4 of our upper cluster) toggles between the full keypad and a compact one: the upper cluster only (app keys, trackpad, Menu, Esc, Cancel). Never automatic (user, 2026-10-12; the proposal was compact by default in Plot). Enter is not in the compact pad, so ending a Signed area also gets a Menu item.
  Estimate: about 1.5–2 days. Tests first: Playwright drags and flicks need synthetic touch moves (CDP `Input.dispatchTouchEvent`), since `locator.tap` only taps.

## Decided proposals (2026-10-11)

- ~~**2026-10-11 Merges into `phase-1` are blocked in the coordinator session.**~~ **Resolved:** in the milestone 2 part 2 shift Henri merged and committed on `phase-1` without problems. The permission classifier denied `git merge --no-ff` into `phase-1` (and last shift's commits). Verified worker commits are listed in the shift report with the exact merge commands. **Recommendation:** allow Henri to run `git merge --no-ff p1/*-m2` and `git commit -s` on `phase-1` (never push), so verified work lands during the shift.
- **2026-10-11 P3: ACCEPTED by the user (2026-10-11).** libqalculate as a further engine for units, constants and uncertainty (spike first).** The user asked why we didn't fork Qalculate!. Forking the app wouldn't help: it's a desktop GTK/Qt program with a weaker CAS than Giac, and it has no textbook entry or calculator keyboard. Its core library is a different matter. libqalculate (GPL-2.0-or-later, so GPL-3 compatible; C++ on GMP/MPFR, which we already build) has what Giac lacks for engineers: a large unit database with conversions, physical constants, and interval/uncertainty arithmetic. Units are our open parser gap 03. **Recommendation:** a 1-day spike that builds libqalculate to wasm, measures size and lazy start-up on the Tab One, and runs `12 m/s to km/h`-style cases. If it passes, it goes behind `MathEngine` as worker 3, loaded only when units are used. Giac stays the core.
- **2026-10-11 P4: ACCEPTED by the user (2026-10-11), incl. the Alpha case flip.** Follow the reference's logical key layout (from the Virtual Calculator mapping).** The mapping (`spec/mapping/vc-2026-10-11/keys.yaml`, 47 keys, merged on `phase-1` 632dab4) shows that our grid (9 rows × 5, our own prototype) puts many functions on different keys and layers from the reference. CLAUDE.md asks for the same *logical* layout (which function sits on which key and shift layer); the visual design stays ours. Function-to-key assignments learned by watching the simulator are allowed by the clean-room rules.
  **Recommendation: yes. ron rebuilds `spec/keyboard.yaml` on the reference's key grid in one pass, with our own look, `source: virtual-calc` per key and a Playwright test per moved function.** In detail:
  1. **Grid:** adopt the reference's rows and columns for rows 4–10 (the maths keys) and its app/navigation keys (Apps, Symb, Plot, Num, View, Menu, Esc, CAS, Help). Phone width: 6 columns where the reference has 6.
  2. **Keys we add:** `+/−` (negation; Shift = |x|), `EEX` (exponent mark ᴇ; Shift = store ▶), one `( )` key that inserts a matched pair, separate `x^y` (Shift = ⁿ√) and `x²` (Shift = √).
  3. **Moves:** π = Shift+3, i = Shift+2, eˣ = Shift+LN, 10ˣ = Shift+LOG, x⁻¹ = Shift+÷, `=` = Shift+".", `approx()` = Shift+Enter, ASIN/ACOS/ATAN on Shift of SIN/COS/TAN (already so).
  4. **Alpha case:** Alpha gives capitals, Shift+Alpha lowercase (the reverse of ours today), letters in the reference's key order. Alpha lock (L3) keeps working the same way.
  5. **Up on an empty entry line** selects the last history row (as on the reference; fits L5 "results are insertable").
  6. **Kept as ours** (no clean match): our app/settings key, our Menu behaviour, Cancel = On (not yet observed while busy, SPOT-CHECK), the Python key layer.
  7. **a b/c stays as built (L2).** The mapping's "cycles decimal/fraction/mixed" was the user's own User-mode script (user, 2026-10-11), not the stock key; G2 item 29 asks for the stock behaviour.
  *Would change if:* the phone-width grid gets too small to tap (measure on the S8+ and Tab One), in which case we keep the reference's assignments but fold rarely used keys into a second page.
- **2026-10-11 User requests (accepted by the user, 2026-10-11), design defaults by Henri:**
  1. **Format key on the On slot** (r10c1; we have no power key). On an empty line it cycles how the *last result* is shown, through the modes ticked in Settings (default: Standard → Scientific → Engineering; also offered: Fixed, fraction, mixed number, and for complex results polar `r∡θ` ↔ `a+b·i`). It changes that result's display only; the Settings format stays the default for new results. Formatting goes through the engine (12-digit rule), never JS. *Alternative:* cycle the global setting (rejected: one result is what you want to read differently).
  2. **Polar entry:** Shift+× = ∡ (as on the reference, r8c5), `r∡θ` in the current angle mode. Part of the P4 pass.
  3. **Key vibration:** a setting (default off), with strength and duration set separately (defaults 50 % and 15 ms when switched on). Android: a small Capacitor plugin of our own calling `VibrationEffect.createOneShot(ms, amplitude)` (no new dependency; `@capacitor/haptics` has no amplitude control); devices without amplitude control get duration only. PWA: `navigator.vibrate(ms)`, duration only. Fired on key-down, so it adds no latency.
  4. **Touch in the entry line:** tapping places the cursor (MathLive does this natively); a Playwright test proves it. The `( )` key inserts the pair with the cursor inside.
  5. **Format details (user, 2026-10-11 evening):** Scientific and Engineering use E notation as on the reference (`1.5E-9`, `15E-10` in Engineering, `15E10`); the number of decimals for Fixed is a Settings field (default 4, our choice). Built on `p1/ron-fmt`.
- **2026-10-11 P5: behaviour differences in Home and Solve (from the mapping). DECIDED, see below.** The reference: (a) gives an error for `sqrt(-4)` and `asin(2)` in default settings, where we give complex results; (b) gives the real root −2 for `(-8)^(1/3)`, where we give the principal complex root; (c) seems to round ties half-to-even at 12 digits (marked unsure); (d) in Solve returns the guess with "Extremum found" or a huge finite value with "Zero" where we say "no root found". **Recommendation:** follow (b) by default (the real odd root is what an engineer expects; the L6 parser already has the setting) and (a) only as a "real mode" setting, default complex (engineers work with phasors); keep ours for (c) until a real-G2 check, and keep our clearer Solve messages in (d).
  **DECIDED by the user (2026-10-11 evening):** (a) keep ours: roots and inverse functions of out-of-range values give the complex answer (`sqrt(-4)` = 2·i); no real mode for now. (b) keep ours: `(-8)^(1/3)` gives the principal complex root (1+1.73205080757·i), not −2; the ∛/ⁿ√ key template keeps the real odd root (∛-8 = −2, L6), which is a different operation. (c) keep ours until a real-G2 check. (d) keep our Solve wording. No code change.
- **2026-10-11 P3 integration plan (`docs/p3-units-plan.md`, gorge). DECIDED by the user (2026-10-11 evening): all eight defaults accepted.** (1) libqalculate is the only units database, Giac units are not used; (2) Units and Constants are pickers in the Menu key's menu, no key relabelling (the reference's key for units goes on the G2 checklist); (3) the `hp` typo gets a one-number local patch, and the user sends the upstream report; (4) interval arithmetic and exact mode in qalc off; (5) no idle preload, load on first unit use; (6) units only in scalar expressions in v1, with a clear message for mixed unit/CAS input; (7) qalc's CODATA constants replace the "physical constants menu" backlog item; (8) scheduled after the MVP basics, before Statistics (L1 is done). Not built yet; the user picks the start. **Amended 2026-10-12 by P8:** (2) and (6) changed (Find instead of pickers; units only in their own Units app); the start is milestone 5.

## Defaults (Phase 1)

Each entry: the choice, why, the alternatives, and what would change it.

### 2026-10-12 Architecture for the engineer core (sandra; full text and evidence in docs/04-architecture.md)
- **Choice:** the defaults docs/04 settles within P8 and the three principles, each with its evidence there: (1) a mark on every Home and CAS number (`=` exact, `≈` rounded with every digit confirmed, `⚠ n` fewer digits than asked), computed from engine facts by our formatter, and a two-precision agreement check for every non-rational value (2.4); (2) digits up to 30 with work precision `max(30, digits+10)` (2.5); (3) results reused as chips carrying the full value, Ans on Shift + `+`, an operator on an empty line inserts Ans (the reference's behaviour, P4) (2.8); (4) copy gives the full value; Shift + View = Copy and Shift + Menu = Paste (the reference's positions) (2.6, 5.1); (5) Python `calc.eval` through Home's exact-first path (2.10); (6) Find: a static index generated at build time, our own ranking on the main thread, tier 0 = audited functions (section 3); (7) constants, units, prefixes and results as atomic MathLive macros, never free text to qalc (3.6, 4.3); (8) the Units app parses with our parser, and an adapter rejects mismatched sums and absolute-temperature arithmetic that qalc accepts silently (4.3); (9) the remaining key cells (5.1), including Shift + Math = Memory, Shift + 5/8/4 for EN5, Shift + `−` = Base for EN6, Help = context help in milestone 6; (10) user definitions persisted and replayed at start (6.2); (11) the qalc build joins `build.sh` in milestone 4 because the index takes its values from it (7.1); (12) an automated size test and the other gates of 7.3.
- **Why:** each closes a measured gap: the silent-wrong list in docs/04 2.3 (`0xFF` typed with the keys gives 0; Home `normald_icdf(10^-10)` is wrong from the 8th digit and unmarked; at 30 digits `UTPN(10)` and `romberg` show wrong digits from the 17th; Python `calc.eval("1-0.9-0.1")` = 1.78E-15), the reuse gap (tapping a result inserts its rounded digits; no key reaches Ans), and the qalc probes (try-exact is exact for SI factors; qalc misreads `degC`, `BTU`, `mu0` and accepts `1 m + 1 s`).
- **Alternatives:** in docs/04, one line each per decision.
- **Would change if:** the Tab One measurements of docs/04 Appendix C miss their budgets (digits capped at 20; Find ranking incremental or in a worker), or the owner vetoes a key assignment or the empty-line Ans.
- **Also settled:** the LaTeX parser (`app/src/input/`) is ron's, as in `.claude/agents/ron.md`, 03 section 8 and the git history; `docs/shifts/rules.md` said gorge and was corrected. gorge keeps `tests/golden/`; ron adds the `parser.yaml` row with each rule.

### 2026-10-11 Home and CAS share one Giac context, each with its own Ans
- **Choice:** one engine context, so user variables are shared between Home and CAS. Each view keeps its own `Ans` (Giac variables `pasans` for Home, `pcasans` for CAS).
- **Why:** one worker (D2 starts it at launch), no second copy of the 9.8 MB engine in memory. Variables defined in CAS are usable in Home without copying.
- **Alternatives:** two contexts (double the memory and start-up time), or one shared `Ans` (Home decimals would leak into exact CAS work).
- **Would change if:** the reference shows that Home and CAS keep separate variables (not asked yet; a candidate for the next Virtual Calculator session).

### 2026-10-11 CAS time budget
- **Choice:** CAS has a 10 s soft budget (`CAS_SOFT_BUDGET_MS`), after which the UI makes Cancel prominent. Giac's own `timeout 600` is only a safety net. No automatic fallback in CAS (D3).
- **Why:** exact results can take a while, and the user decides when to stop. Home keeps its 300 ms exact → floats guard.
- **Would change if:** Tab One timings show common CAS inputs near 10 s.

### 2026-10-11 Cancel replays definitions only
- **Choice:** after Cancel (worker restart, D3), only the user's definitions are replayed, in the form that ran. `Ans` is not replayed, and inputs that use random numbers get new values.
- **Why:** replay must be fast and must not re-run the cancelled job. Definitions are what the user would lose.
- **Would change if:** users miss `Ans` after Cancel. It could then be stored as a value.

### 2026-10-11 Home number formats (differs from the reference, G2 item 15; backlog G9)
- **Choice:** `digits` means significant digits in every mode. STD drops trailing zeros and is plain for 1E-4 ≤ |x| < 10^digits, otherwise scientific. SCI: `1.235E4`. ENG: `12.35E3` (exponent a multiple of 3). Rounding is half-up from an exact BigInt value; half-even is implemented but switched off until G2 item 8.
- **Why:** it's our own formatter (D5), and it matches the observed `1÷3` → `0.333333333333`.
- **Would change if:** G9 decides to match the reference's formats (item 15 differs: six formats, digits as decimal places, thousands separator), or the real G2 confirms half to even (item 8).

### 2026-10-11 P2 condition met: releases use the container toolchain
- **Result:** the engine built with Debian's Emscripten 3.1.69 (`debian:trixie@sha256:913f6706…`, `emscripten=3.1.69+dfsg-3`, script `engine/giac/build-wasm-release.sh`) passes interrupt 16/16, Home 123/123 and Solve 23/23 with output identical to the emsdk build. On the Tab One (Android 15, WebView 131.0.6778.260, release builds of the spike app, 7 cold starts and 5 benchmark runs each), cold launch → engine ready p50 is 896 ms (emsdk) vs 917 ms (container), +2.3%. First result is 1001 vs 1016 ms (+1.5%). Benchmark first-call p95 over 55 cases is 76.7 vs 72.6 ms. Cancel → ready is 322 vs 306 ms.
- **Choice:** P2's bar (within +10%) is met, so every release builds the engine in the container. emsdk stays for development.

### 2026-10-11 Mixed numbers in textbook entry (assumed, G2 item 29)
- **Choice:** one press of a/b inserts the same plain stacked fraction as ÷. Pressing a/b twice after a whole number makes a mixed number `2\tfrac12`, which the parser reads as `(2+1/2)` (L2, 2026-10-11). A digit directly before a plain stacked fraction still parses as `2*1/2`.
- **Why:** P1 only accepts what our keyboard produces. A separate mixed-number template keeps the parser unambiguous once it exists.
- **Would change if:** the real G2 confirms the Virtual Calculator's answer to item 29 (a/b cycles the last result's form and does nothing while typing a number; backlog G6).

### 2026-10-11 Golden gate
- **Choice:** `(cd app && npm run golden)` is the gate for every engine build that ships (interrupt, Home, Solve, benchmark, parser). It replaces the separate spike runners. The G2 checklist is generated from `tests/golden/g2.yaml` (`oracle.py --g2`), so edit the YAML, not the .md.

### 2026-10-11 Entry and history behaviour (updated 2026-10-12)
- **Cancel:** while a job runs, it stops the job and keeps the history (the entry is marked cancelled). When idle, it closes a list or clears the entry line. Enter while a job runs is ignored.
- **Esc** clears the entry line or closes a list; **Shift + Esc (Clear)** wipes the current view's history (the reference's keys, P4).
- **History:** Home and CAS keep separate histories over one shared variable context. Tapping a result inserts it (see "Results are insertable"). History, settings and the current view are stored in IndexedDB.
- **Shift and alpha** are one-shot; alpha gives capitals and shift + alpha lower case (P4). Alpha twice locks it (see "Alpha lock").
- **One-line mode** shows fractions, roots and exponents linearly (see "One-line entry mode").
- **Sto▶** is Shift + EEX (P4; `spec/keyboard.yaml`, the key at r7c1).
- **Why:** each is the fastest path for keyboard use (principle 2) and matches what a calculator user expects. Cancel is ours (P4 item 6); the rest follows the reference's keys.

### 2026-10-11 How the Tab One "Enter → drawn result" number is measured
- **Choice:** the 55 benchmark inputs are Giac text (matrices, `factor`, …), and most have no key sequence. In measurement builds (`?bench=1`) they go through `Session.submit(latex, giacOverride)`: the real engine, LaTeX tidy-up and MathLive rendering, skipping only our parser. Parser speed is measured separately in desktop tests.
- **Would change if:** we want a keyboard-only benchmark. That needs a separate set of inputs that can be typed.

### 2026-10-11 Default angle mode: radians (as on the reference, G2 item 4)
- **Choice:** new installs start in radians. The setting is stored and can be changed in the settings panel.
- **Why:** Giac's default, and the safe choice for the engineering and maths work this calculator is for. The Virtual Calculator's default settings are radians too (G2 item 4 was answered in "default settings (radians, Standard)").
- **Would change if:** a factory-reset real G2 shows degrees.

### 2026-10-11 Bit-reproducible release engine
- **Finding:** clang 19 at `-Oz` gave different object files from run to run under address-space randomisation (ASLR), so two container builds produced different `giac.wasm` files. Their output was still identical: 0 differences in 476 golden outputs.
- **Choice:** `engine/giac/build-wasm-release.sh` runs the engine build under `setarch -R` (ASLR off) inside the container. That needs `--security-opt seccomp=unconfined` for rootless podman, so the container can call `personality()`. It still only mounts scratch copies. Two builds in one checkout and one from a fresh clone all give `giac.wasm` SHA-256 `ab5ca4eb…3003a`.
- **Why:** F-Droid's reproducible builds need the same bytes on every build (principle 1).
- **Would change if:** a clang or Emscripten update makes `-Oz` deterministic, or F-Droid's build server can't turn off ASLR (then we look for the compiler pass that depends on addresses).

### 2026-10-11 Residual check thresholds for Solve and Plot analysis
- **Choice:** a root is accepted silently when its relative residual, evaluated at 30 digits, is ≤ 1e-15. 1-D roots above that are shown with ⚠. For systems, a residual < 1e-6 is shown with ⚠, and anything worse is reported as no solution (Giac's `hybrids` returns the guess unchanged when it fails, so the check is the only guard).
- **Why:** docs/02 section 4 requires substituting every root back. 1e-15 is far above 30-digit noise and far below anything a 12-digit display would show as wrong.
- **Alternatives:** an absolute threshold (fails for large-scale equations), or showing every residual (clutter).
- **Would change if:** golden or user cases show false ⚠ on well-conditioned roots, or the user reverses P5(d) (the reference shows no ⚠; items 12–14, 20).

### 2026-10-12 Powers after a compound term (L8)
- **Choice:** x², xʸ and x⁻¹ (the keys whose template starts with `#@^`) wrap the term before the cursor in brackets when it is a fraction, a root, a power or a mixed number: `1 a/b 2 ▶ x²` → `\left(\frac12\right)^2`, `2 xʸ 3 ▶ x²` → `(2³)²`. After a number, a name, a bracket or a function call the plain `^` stays (`1+3 x²` → `1+3²`, `sin(2) x²` → `sin(2)²`). With the cursor still inside a numerator or denominator the key raises the last term there (`1 ÷ x x²` → `1/x²`); ▶ leaves the part first. Inside a mixed number it raises the whole number.
- **Why:** user, 2026-10-12 (whole fraction after ▶; inside part while inside, so `1/x²` stays easy to type). A bare `^` after a fraction or root gave an empty base or read ambiguously, and after a power MathLive merged the new exponent into the old one (`2^{32}`).
- **Would change if:** the Virtual Calculator shows another behaviour for Textbook `1 ÷ 2` then x² (not a G2 item yet).

### 2026-10-12 G2 answers (Virtual Calculator 2.4.2 rev 15751, items 19–22, 24–31)
- **Source:** `tests/golden/g2.yaml`; golden cases re-tagged: `function/extremum-flat`, `function/area-pole`, `python/py-gfx-03` now `virtual-calc`, `solve/poly-quartic-complex` order confirmed.
- **Matches our defaults:** polynomial root order via `proot` (item 21), flat point reported for X³ (item 22a), no area across a pole (22b, shown as `NaN`), the five graphics signatures (26), equal factors merged in CAS (31), 2-equation Solve result (20).
- **Differs (follow-ups G1–G8 in docs/backlog.md):** Num step 0.1 and trace step 0.1 (24), `NaN` at a pole in Num (19), Intersection asks for the second function (25), "Cannot find solution" wording (20), Python canvas lifetime and `eval` return types (27, 28), Home treats lowercase undefined names as a syntax error (31).
- **Open:** item 29 contradicts the user's earlier finding that a b/c cycling was their own script. The decision "a b/c stays as built (L2)" in P4 stands until the real G2 is checked. Item 24's trace step was measured only at the default window.
- **Caveat:** the reference is rev 15751, the user's G2 is rev 15515. The user accepted 15751 as the reference (2026-10-11).

### 2026-10-11 Polynomial root order (G2 item 21, confirmed 2026-10-12)
- **Choice:** real roots in ascending order, then complex roots by real part, then imaginary part. `proot` results are polished with Newton at 30 digits.

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

### 2026-10-11 Function app defaults (G2 items 19, 23–25; updated 2026-10-12)
- **Choice:** default Plot window x ∈ [-10, 10], y at the same scale as x, centred on 0 (ours; the reference uses -15.9..15.9 by -10.9..10.9, item 23); canvas renderer with "hybrid" sampling (D7, fastest on desktop: 59.3 fps at CPU ×4). Trace step = a 1-2-5 step near window width / 200: **0.1 at the default window, as on the reference** (item 24). Num starts at X = 0 with **step 0.1** (item 24), 12 rows per screen, one engine call per screen; a pole or undefined value shows **`NaN`** (item 19, as the reference's Num and Signed area). **Intersection asks** for the second function: a list "Intersection of F1(x) and" with the other functions that are on, then the x-axis (item 25; the x-axis choice runs Root). The Symb slots are written with `X`; the parser maps `X` to Giac's `x`.
- **Why:** the reference's Num and trace defaults and its Intersection list (Virtual Calculator, 2026-10-12). A square, centred window shows the shape of most engineering functions at once; short trace values are easier to read and type back; one engine call per screen keeps Num fast.
- **Open (assumed):** item 24 measured the trace step only at the default window. 0.1 is about one pixel of the reference's 320-px screen over 31.8 units, which suggests a per-pixel step, but that was not measured; other widths keep our 1-2-5 rule until a Virtual Calculator session zooms and traces.
- **Would change if:** the reference's trace step at another window width differs from the 1-2-5 rule, or Tab One measurements show the canvas renderer is slower there.

### 2026-10-11 Solve app variables and results (G2 items 12–14, 20 answered; differences kept, P5(d))
- **Choice:** the Solve app keeps names as typed (`x` and `X` are different unknowns; the Function app maps `X` to `x`). New unknowns start at 0. With one equation, Solve finds the selected unknown and holds the others fixed; with N equations it finds N unknowns, the selected one first. A failed solve or a failed residual check shows ⚠ with the engine's info line. A polynomial with exactly one real root also writes that root into the value.
- **Why:** engineers expect case-sensitive names, as in the CAS. Starting at 0 is predictable.
- **Alternatives:** fold case (would clash with CAS variables), or start from the last value used anywhere.
- **Would change if:** the user reverses P5(d) (the reference returns the guess with "Extremum found" or a huge value with "Zero"; we keep "no root found" with ⚠). Subscripted names (`x_1`) are solvable (L1, `a3ddd52`): Giac reads `x_1` as a plain variable (checked 2026-10-11: `type(x_1)` → identifier); only `<number>_<unit>` is a unit.


### 2026-10-11 Minimum WebView: modern Chrome WebView, with an "update" notice below it
- **Choice:** minSdk stays 24 (Android 7). Below that, we also require a minimum WebView version, the highest floor among our Vite build target, the Emscripten builds (Giac, MicroPython) and MathLive : **Chrome 95** (Giac is built with `-fwasm-exceptions`; Vite es2022 needs about 94, module workers 80). MathLive 0.111.1 uses `:has()` and `@container` (Chrome 105), which most likely only affects styling (not verified). An inline ES5 check in `app/index.html` feature-detects what we need. On an older WebView it shows one line asking the user to update Android System WebView / Chrome, instead of a blank page.
- **Why:** the Galaxy S8+ (Android 9) still has its factory WebView, Chrome 72 (2019). Our bundle stops at the first `?.`, and the wasm builds need newer features anyway. On Android 7–9 the WebView is Chrome and updates from the app store (Chrome 138 is the last for Android 8/9), so real users on these devices run a modern WebView. Transpiling down to Chrome 72 would cost bundle size and start-up time on every device (principle 2), and the wasm feature gap would remain.
- **Alternatives:** a legacy build (`@vitejs/plugin-legacy`, wasm built without exceptions or bulk memory): two builds to test, slower everywhere. Raising minSdk instead: wouldn't help, because the WebView version is what matters.
- **Would change if:** testers report Android 7–9 devices that can't update their WebView (e.g. no app store) in meaningful numbers.

### 2026-10-11 Alpha lock (updated 2026-10-12 for the P4 case flip)
- **Choice:** alpha twice locks capitals; shift, alpha, alpha locks lower case; alpha again unlocks (L3; `app/src/state/session.svelte.ts`). The gesture is ours.
- **Why:** this is the usual calculator gesture, and it needs no extra key.
- **Alternatives:** a long press on alpha (slower; harder to discover on touch).
- **Would change if:** the Virtual Calculator mapping or the G2 shows another gesture.

### 2026-10-11 One-line entry mode: exponents are linear too
- **Choice:** in the one-line entry setting, xʸ, x² and a typed `^` insert a literal caret (`\char"5E`); the exponent is the next signed factor, as in plain text input (L4). Textbook mode is unchanged.
- **Why:** one-line mode is for people who want to type `2^3` literally; a raised box would break that.
- **Would change if:** testers find the "next signed factor" rule surprising (e.g. they expect `2^3+1` to raise `3+1`).

### 2026-10-11 Results are insertable
- **Choice:** tapping a result in the Home or CAS history inserts it at the cursor, bracketed if it is a sum (L5).
- **Why:** reusing a result is the most common engineer workflow; brackets keep precedence right.
- **Would change if:** the G2 inserts the entry instead of the result, or never brackets.

### 2026-10-11 `calc.cas` is synchronous (amends D6; no SharedArrayBuffer needed)
- **Choice:** Python calls `calc.cas("…")` like a normal function, with no `await` and no preprocessor. A 40-line MicroPython user C module of our own (`python/modules/host`, built with `USER_C_MODULES`; the upstream tree is unpatched) suspends the wasm stack with Asyncify, which the upstream webassembly port already uses, until the main thread answers. MicroPython is now linked at `-O2` (upstream links at `-O0`): wasm 1.12 → 0.63 MB, a 10⁶-step loop 1.3 → 0.61 s in Chromium.
- **Why:** D6 assumed that a synchronous bridge needs SharedArrayBuffer (so COOP/COEP headers) and chose async plus a preprocessor. Asyncify gives a synchronous call without either. The async route also turned out to be broken upstream: `runPython`/`runPythonAsync` abort at the first garbage collection in a loop that allocates. Synchronous calls are what engineers expect, and they also work inside functions and comprehensions.
- **Alternatives:** async plus a preprocessor (broken upstream, and it can't reach calls inside functions); SharedArrayBuffer with COOP/COEP (headers the Capacitor shell would have to serve, plus a second mechanism).
- **Limit:** recursion deeper than about 50–100 frames overflows the JS stack, as in the stock upstream build. It is reported as `RecursionError`, and the worker is replaced, so shell variables are lost.
- **Would change if:** the release build (Debian Emscripten 3.1.69) rejects `EM_ASYNC_JS`/`-O2`, or the Tab One misses the milestone 3 bars (`calc.cas` p95 < 50 ms, shell ready < 0.5 s). Checked 2026-10-11: the release build works (`python/_out/release`) and the Tab One passes (25 ms, 165 ms; backlog D1).

### 2026-10-11 Python runtime defaults
- **Choice:** Python heap 4 MB, Python stack 8K words. The shell echoes the repr of a single expression, like a REPL, and runs blocks of several statements without echo. stdout/stderr are flushed at a newline (at most every 16 ms), at 8 KiB, and before each `calc` call. Tracebacks hide our own frames; scripts without a name are `<script>`. A failed `calc` call raises `ValueError` with Giac's message. The worker starts only when the Python app first needs it.
- **Why:** these are small, predictable defaults that fit the Tab One. Echo and tracebacks behave as in desktop Python, which engineers know.
- **Would change if:** real scripts hit the heap limit, or the G2 Python shell behaves differently (assumed).

### 2026-10-11 Python app views and storage (key positions assumed)
- **Choice:** Symb = Editor (CodeMirror 6), Plot = Graphics (the 320×240 canvas, scaled 4:3, pixel-exact lines and circles without anti-aliasing), Num = Shell. Scripts live in IndexedDB (`app.python`), at most 50 scripts of 64 kB each; the shell transcript is capped at 64 kB. The Python key layer is a separate `python:` block in `spec/keyboard.yaml` (xʸ → `**`, shift 7/8/9 → `:` `"` `'`, shift 0 → 4-space indent, shift , → `=`, shift Enter → `==`). Every position in it is assumed. Cancel keeps the canvas and the editor and shell text. A run that draws switches to Graphics. Text sizes are 10/14/18 px (assumed).
- **Why:** these map the three-view framework onto definition, picture and table-like output. The limits keep IndexedDB and memory small on the Tab One. Pixel-exact drawing matches a 320×240 calculator screen.
- **Would change if:** the Virtual Calculator mapping or the G2 puts the Python keys or views elsewhere, or users hit the limits.

### 2026-10-11 Parser: odd roots, lists, decimal comma, one-letter functions (L6)
- **Choice:** a root with an odd whole-number index is the real root (∛(-8) = -2 in Home and in plots; the CAS view leaves `-8^(1/3)` unsimplified, as Giac does with `8^(1/3)`). The reference gives -2 for `(-8)^(1/3)` typed as a power (G2 items 4 and 11, Virtual Calculator; its root key wasn't tried); our power form stays complex (P5(b)), so only the root template matches it, and the option `realOddRoots: false` restores the principal complex root. `{…}` is a list. A `decimalComma` input option reads `3,5` as 3.5 and then separates arguments with `;`. After `p(x):=…`, `p` is a function for the rest of the session (f, g and h always are).
- **Why:** engineers expect ∛(-8) = -2. Lists and user functions are things our keyboard can produce, and the decimal comma is common in Europe.
- **Left open:** `x^y^z` (our keyboard can't produce it) and units (a separate feature); the reasons are in `parser.yaml`.
- **Would change if:** the G2 shows how the decimal-comma setting separates arguments.

### 2026-10-11 Graphics modules (G2 items 26–28 answered; P6 open)
- **Choice:** `draw` is our own module. The compatibility module, under the name existing scripts import, covers pixon, line, rect, fillrect, circle, fillcircle, textout and eval on screen G0 only. Its names and argument orders were taken from public descriptions and match the reference (G2 item 26, backlog G5). Our implementation files have our own names (`app/src/python/graphics.ts`). MicroPython reports a missing indented block as `SyntaxError` (CPython says `IndentationError`). We keep that.
- **Why:** existing calculator scripts should run where possible; our own module stays free of compatibility constraints.
- **Would change if:** the user accepts P6 (`hpprime.eval` types and error text as on the reference).

### 2026-10-11 Our MicroPython variant
- **Choice:** `python/build-micropython.sh` builds `python/variant/pascaline`: upstream's standard variant plus `-O2`, a 128 KiB Asyncify buffer, and the Ctrl-C JS hook turned off (it breaks scripts in worker threads, and Cancel terminates the worker instead). The upstream source stays unmodified. One MicroPython per JS realm (one per worker).
- **Would change if:** an upstream release adds a supported way to pause for host calls.

### 2026-10-12 Hold-and-drag cursor and ⌫ repeat timings (K2; assumed, to judge by feel)
Hold 350 ms with at most 10 px of movement turns the keypad into the trackpad (12 px per step, as K1); keys fire on release; a slide before 350 ms stays a tap; a second finger ends cursor mode. ⌫ had no auto-repeat, so K2 added one: fires on touch, repeats after 400 ms, then every 60 ms, in the layer of the first press (held Shift+⌫ keeps deleting forward). Why: ron's defaults, nothing measured. Alternatives: other hold times or slop. Would change on the user's verdict after trying it on a device (backlog "Needs the user" 3).
