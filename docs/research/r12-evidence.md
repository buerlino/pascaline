<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# R12: the evidence behind docs/04 (sandra)

**Status (2026-10-21): reference.** The evidence behind docs/04 (the regression list, the module table, the latency numbers); docs/04 cites it by section, rerun the probe before relying on a row.

*Moved out of [docs/04](../04-architecture.md) by the docs/04 diet (S10, 2026-10-19), so that docs/04 holds the rules, the decisions and the budgets, and this file the probe results and the regression record they rest on. The section numbers of docs/04 stay the address: "docs/04 2.3 #17" is row 17 of section 1 here, "docs/04 4.1" is section 2. Code moves: before relying on a row, rerun the probe it names ([tools/probes/](../../tools/probes/README.md)); how a key press and a number flow through the code is in [r6-pipelines.md](r6-pipelines.md).*

## 1. Paths that showed a wrong or unmarked value (docs/04 2.3)

Each became a regression case before its fix (CLAUDE.md); #7 was Python's `calc.eval`, removed with the app. Values marked `oracle` come from mpmath at 40 digits: `tests/golden/.venv/bin/python -I -c "import mpmath as m; m.mp.dps=40; …"` with `sqrt(2)*erfinv(2p-1)` for `normald_icdf`, `quad(exp(-x^2),[0,1])` for `romberg`, `erfc(10/sqrt(2))/2` for `UTPN(10)`, `besselj`, `airyai`. All are fixed (#2's value polish by G44). #11–#16 came from the deep-dive review (2026-10-14), #17–#18 from the architecture check and #19 from the Opus pass (2026-10-15).

| # | Input and path | Shown before the fix | Correct value | Fix |
|---|---|---|---|---|
| 1 | Home, keys `0` `x` Alpha-F Alpha-F: `0*x*F*F` | `0`, exact | 255 (`derived`) | R2: `0x`/`0b`/`0o` with letters is an error; a literal in EN6 |
| 2 | Home `normald_icdf(10^-10)`, 12 digits | `-6.36134035799`, no mark | −6.36134090240… (`oracle`): wrong from the 8th digit; Giac's two evaluations agree on 9 digits | mark: `⚠`, unaudited (`715e1e8`); then G44: Newton from Giac's value on our MPFR normal CDF (erf series, erfc continued fraction), checked at P and P + 20: `≈ -6.3613409024`, all 12 digits (and 30 at 30 digits); `prec-2-normald_icdf-value` on. Closed. |
| 3 | Home `UTPN(10)` at 30 digits | wrong from the 17th digit | 7.619853024160526065973…E-24 (`oracle`) | agreement check at P, P+20, P+40 (`715e1e8`) |
| 4 | Home `romberg(exp(-x^2),x,0,1)` at 30 digits | wrong from the 17th digit | 0.746824132812427025399467436132 (`oracle`) | `⚠` until romberg is audited (2.4 rule 3, M4-1) |
| 5 | Home `BesselJ(1,2)` at 15–30 digits | the input as text (no MPFR path) | 0.576724807757 (`oracle`) | a ≤ 14-digit fallback with `⚠` |
| 6 | CAS `1-0.9-0.1`; `evalf(sin(10^22))`; `1e16+1-1e16` | `1.7763568394E-15`; `-0.54764225985`; `0.0` | 0; −0.852200849767… (`oracle`); 1 | marks in CAS and exact decimals (P9) |
| 8 | Home `1/3`, tap the result, `×3` | `0.999999999999` | 1 | result chips carry the full value (R2) |
| 9 | Home `1/3` and `1/4` | alike | — | the mark |
| 10 | Units `1 hp → W` (qalc data) | 745.699987158 W, flagged exact | 745.69987158227… W (`derived`) | our exact factor in the Find index (G13; golden u10) |
| 11 | Home `2.5.3` | `0.75` | an error | R29 |
| 12 | Home, tap 0.5, type `3` | `1.5`, no × shown | an error naming the fix | R29 |
| 13 | One-line `1/2x`; `6÷2(1+2)` | 1/(2x); 1 | (1/2)·x; 9 (G2 item 6) | R30 |
| 14 | Hardware keyboard `1e-3` | `≈ -0.281718171541` | 0.001 | R31 |
| 15 | CAS after Home `3 ▶ x`: `int(x^2,x)` | `9*x`, no sign of the stored x | the answer, saying x was used | G20, R32 |
| 16 | DEG `exp(i*90)` | `= i` | −0.448073616129+0.893996663601·i (`derived`) | G21 (F29); an exp Giac builds itself: decisions.md G21 |
| 17 | `evalf(x+sin(10^22))` | `x-0.54764225985`, no mark | x − 0.852200849767… (`oracle`) | `⚠` on a non-number with a float (G27) |
| 18 | Home `2^10000`, tap, `×1` | `= 1.99506311688E3010` | `≈` (the chip was cut) | R44 |
| 19 | `cos(π/7)−cos(2π/7)+cos(3π/7) == 1/2` | `= 0` | true (`derived`) | stays as typed (R18f3) |
| 20 | `int(1/x,x,-1,1)`, `int(tan(x),x,0,pi)`, `sum(cos(k),k,1,inf)`, `sum(exp(i*k),k,0,inf)`, `limit(sin(x),x,inf)` (deep check E2, E9) | `= 0`, `= 0`, `= −0.5`, `≈ 0.5+0.915243860856i`, `bounded_function(2)` | does not converge / no limit (`derived`) | refused with "The integral does not converge", "The series does not converge", "No limit"; Giac's own `undef` the same (G39) |
| 21 | `int(abs(x-sin(10^50)),x,-1,1)`, DEG `int(1/(1+x^2),x,0,1)` (deep check E6, D7) | the list `[…, 1.35506364264]`, `[8100/pi, 0.785398163397]` | 1 + sin(10^50)² = 1.62358264688, π/4 (`oracle`) | one value, `⚠` with no digit confirmed, why "the exact and numeric answers differ"; CAS shows Giac's two answers with `⚠` (G39) |

## 2. Units on Giac (docs/04 4.1; G15's probe, 2026-10-15)

`tools/probes/units-giac.mjs` turns each unit token into its exact SI factor from the Find index times one symbol per base dimension (`pasdimL` … `pasdimB`; the angle `pasdimA` is one of them), and Giac's `normal()` computes exactly. Against qalc 5.13.1 and mpmath (the rows G13, G17 and G25 changed since show what the evaluator gives now):

| Input | Giac | qalc |
|---|---|---|
| `72 km/h → m/s`; `1 in → mm`; `1/3 m → cm` | 20; 127/5; 100/3 | the same |
| `1 lbf → N`; `4.7 kΩ × 2.2 nF`; `√2 m` | 8896443230521/2000000000000; 517/50000000 s; √2 m | the same |
| `20 °C → K`; `100 °F → °C`; `20 °C → °F` | 5863/20; 340/9; 68 | the same |
| `90° → rad`; `60 rpm → rad/s`; `sin(30°)` | π/2; refused: T⁻¹ vs T⁻¹·angle (rpm counts revolutions, G25); 1/2 | π/2; 2π; 1/2 |
| `(12.34 ± 0.05) m × (3.2 ± 0.1) m` | 4936/125 ± √387089/500 m² (first order) | the same σ; prints ±1.3 |
| `1 m + 1 s`; `1 m → s` | "Units don't match: L vs T" | `1 m + 1 s`; `1 m` (no error) |
| `20 °C + 5 °C`; `20 °C × 2` | refused (absolute temperature) | 25 °C; 40 °C |
| `ln(2 m)`; `sin(2 m)` | refused | left unevaluated |
| `1 rpm → Hz`; `1 rad/s → Hz` | 1/60 (rev is a count of cycles, G25); refused: T⁻¹·angle vs T⁻¹ | 0.1047 Hz·rad; 1 Hz·rad |
| `1 hp → W`; `1 mmHg → Pa` | 745.69987158227… W (golden u10); 133.322387415 Pa: our exact factors (G13) | 745.699987158 W; 133.322368421 Pa (both wrong) |
| `1 Np → dB`; `1 W → dBm` | 20/ln 10 = 8.68588963807 dB; 30 dBm (G17, golden l01, l02) | 8.68588963807 dB; 30 dBm |

The 26 spike cases, tasks t02, t04, t10 and these rows agree with qalc, except where qalc is wrong (oracle). Every unit in S1's 50 and on the draft pad has the same SI factor in both; qalc's SI form drops rad. On the desktop an evaluation takes median 0.5 ms and p95 1.5–3.2 ms, in one Giac call. A half power (nV/√Hz) takes 8 ms.

G15 counted 36 index units without an exact factor (34 on 2026-10-18 after G7, generator log, [check-2026-10-19.md](../archive/shifts/check-2026-10-19.md) finding 17). G13 gave hp and mmHg ours, and G17 handles the 4 logarithmic units by rule; the rest (nat, trit and Hart; the 15 °C and the mean calorie; 24 Planck, atomic and natural units and the solar mass, which are values with an uncertainty) are refused with a message naming the unit (`nofactor`).

## 3. Digits up to 30: the cost (docs/04 2.5)

On the desktop (123 `home.yaml` inputs, `tools/probes/digits-cost.ts`): digits 12 p95 2.74 ms, digits 30 p95 3.63 ms, no case changed path. On the Tab One (A4a, 2026-10-16): 147–149 ms at 30 digits, 149–152 at 20, 138–160 at 12, so docs/04 2.5's gate holds; the cost is not driven by digits (decisions.md "A4a" point 1).

## 4. The entry line as read on 2026-10-15 (docs/04 5.5)

The key path step by step is [r6](r6-pipelines.md) section 1; the MathLive prompt probe behind the unit view's slots (docs/04 4.3) is r6 section 7, "Prompts in a read-only field". Read 2026-10-15, R43 and R45 merged since:
- **What a box is:** one model, `entry/boxes.ts` (`boxTemplate()`, `startsBox()`, `endsBox()`), read by `delete.ts`, `stops.ts` and `nextBox`; `isStop()` keeps its own regexes for names and marks. The term before the cursor is still scanned in five places (`selectENumber`, `selectCompound`, `selectChip`, `afterDigit`, `afterNumber`), and the parser has its own side of where a number ends (R29).
- **Tests:** the ⌫ grid (`app/test/bksp-grid.spec.ts`) and the cursor grid (`app/test/cursor-grid.spec.ts`) read every template from `spec/keyboard.yaml`, so a new key joins them by itself.
- **The unit view's field** (docs/04 4.3): read-only with prompts; `insert()` outside a prompt changes it, and the hardware-key handler is attached to the entry field only.


## 5. Every module against the goal (docs/04 1.2; state 2026-10-18)


| Module | Faster | More trustworthy | Open against the goal | Cost |
|---|---|---|---|---|
| Keyboard (`spec/keyboard.yaml`, `keyboard/`) | the reference's logical layout; the trackpad (K1) and flicks (R9) | — | Vars and Math do nothing until Find (R4a, R4b) | in the start chunk (8.3) |
| Entry, MathLive (`entry/`) | textbook entry; results as chips (R2); ⌫ keeps templates whole; the cursor stops only at boxes; one key path for every key (5.5) | errors name the fix (R29–R31, R51) | — | the MathLive chunk after the keypad; `entry/` modules lazy |
| Parser (`input/parse.ts`, `emit.ts`) | one rule per key | rejects what our keys cannot produce | — | its own lazy chunk (M4-3) |
| Engine client and Giac worker (`engine/workerEngine.ts`, `host.ts`) | engine in a worker, warm | Cancel and a crash restart the worker and replay the definitions; definitions survive a relaunch (G3); a safe start without them after two failed starts (G19); a 1 GB memory cap (G24) | the `defs` replay over its Tab One bar (G29 cut it, A12 re-measures) | Giac 9.75 MB wasm |
| Home evaluation (`engine/homeEval.ts`) | p95 well under the bar on the desktop | exact-first; marks and the agreement check (2.4) | — (G44 polished `normald_icdf`, 2.3 #2) | — |
| Formatter (`engine/format.ts`) | re-formats without the engine | BigInt, one rounding | `tieRisk` has no reader (2.4 rule 4) | in the start chunk |
| History and settings (`state/`) | history and the half-typed line survive a relaunch and a kill (R34) | digits ≤ 30, every stored value stamped (`DATA_VERSION`) | — | — |
| Function and Solve apps | Plot 56 fps on the Tab One | every number from the engine; every root substituted back, ⚠ on failure | frozen for features (P11) | lazy chunks |
| CAS view (`host.ts` `cas()`) | — | exact results; typed decimals exact (P9); floats marked; the stored values a result used are listed (G20, R32) | — | — |
| Unit view (`units/`) | — | exact factors and dimension checks on Giac (P15) | the entry is not built (R24b–R24d) | a lazy chunk (8.3) |
| PWA and Capacitor shell | offline; wasm stored uncompressed | no trackers, no INTERNET permission (C5) | — | the build is precached (8.3) |
| Build (`build.sh`, P2 container) | — | reproducible engine; the size test runs in `npm run build`; `npm run gate` (A6) | no CI (C3) | — |

## 6. The Find index when it was first built (docs/04 3.1; G4, 2026-10-15)

1,850 items, 325.7 kB raw, 67.1 kB gzip, from Giac's `doc/aide_cas` (1,780 entries, English lines only), libqalculate 5.13.1's units, constants and prefixes, and our files `find/aliases.yaml`, `find/functions.yaml` and `find/units.yaml`. `app/src/find/rank.ts` passed the query test 100/100 first; the desktop prototype ranked at p95 1.04–1.23 ms per key. On 2026-10-18 (after G7): 327,092 B raw, 67,913 B gzip, 439 units, 34 without `si` ([check-2026-10-19.md](../archive/shifts/check-2026-10-19.md)).
