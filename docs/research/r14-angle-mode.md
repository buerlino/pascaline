<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# R14: the angle mode: Giac always in radians, the degrees in our parser (S14 spike)

sandra, 2026-10-19, package S14, branch `p1/sandra-radspike` from `phase-1` `83474da`, engine `engine/giac/_out/gsl` (dev build). From [deep-check-2026-10-19-angle-marks.md](../archive/shifts/deep-check-2026-10-19-angle-marks.md) (D4–D8, D12, Part 2 point 2) and [check-2026-10-19.md](../archive/shifts/check-2026-10-19.md) (findings 1–4). Everything here reruns with `tools/probes/angle-matrix.ts` (its README row); right values come from `tools/probes/angle-matrix-oracle.py` (mpmath, `oracle`) or from the definitions (`derived`).

## 1. Answer

**Route R works.** Giac with `angle_radian:=1` in every mode, and our text carrying the degrees where the user typed an angle (`sin(pasdeg*(u))`, `(asin(u)/pasdeg)`, `(arg(z)/pasdeg)`; `pasdeg` = π/180 in DEG and 1 in RAD), gives the right value on all 52 rows of the matrix. Today's code gets 18 right (§2). Under the same rewrite, 533 of the 536 golden inputs give the same result as today. The other 3 show a display leak that R64 closes (§3). Two costs are real:
- The CAS view in DEG needs a display rule. A Giac pass of 0.1–0.6 ms (§4) gives the text a correct DEG engine would print.
- In DEG, the desktop Home p95 on home.yaml's inputs goes from 2.4 to 3.7 ms. RAD does not change (§8).

Route P would need a separate Giac patch for each of nine paths, and each patch would have its own migration (§9).

## 2. The matrix (52 rows)

`node tools/probes/angle-matrix.ts`. Route a is today's code: the engine host as the app calls it, with Giac's flag following the mode and pasexp. Route b is the prototype: the same host with the angle setting fixed at RAD, `pasdeg` set when the mode changes, and `rewriteAngles` applied to the text our parser emits. Home results are checked at the shown digits (a part that is exactly 0 must show as 0). A CAS result is checked by the value the same engine reads from it afterwards, for example F(1)−F(0) for an antiderivative.

| Group | Rows | Today: right / wrong / error | Route R |
|---|---|---|---|
| D4 cosh, sinh of imaginaries; Solve `cosh(i·x)=1/2` in DEG | 5 | 1 / 4 / 0 (`cosh(90i)` = **= 0**, Solve x = 60) | 5 right |
| D5 complex trig in DEG (the `re`/`im` split) | 4 | 0 / 4 / 0 | 4 right (the reading z° = zπ/180, as Giac's own evalf) |
| D6 inverse trig with a complex result in DEG | 3 | 0 / 3 / 0 (real part 9.09E-13; `asin(2)` at 20 digits 89.999999999999) | 3 right (real part 0, 90 exactly) |
| D7 calculus in DEG: antiderivatives, desolve, laplace, ilaplace, definite integrals, limit, series; and 3 that are right today | 12 | 3 / 7 / 2 (limit and series: "works only in radian mode") | 12 right |
| D8 the plot against Root | 2 | 1 / 1 / 0 (curve −0.801 at 180) | 2 right (JS `Math.sin(pasdeg*x)`) |
| D12 complex power of a negative number | 3 | 0 / 3 / 0 | 3 right |
| Findings 1–4: stored values, Ans and `\res` text, exp stored or built by Giac, functions defined in RAD or by a library | 10 | 0 / 10 / 0 | 10 right |
| Controls (functions called in both modes, sin, asin, arg, polar entry, the ° template, e^(iπ)) | 9 | 9 / 0 / 0 | 9 right |
| Unit view (`sin(30)`, `sin(30°)`, `asin(1/2)·2 m` in both modes) | 4 | 4 / 0 / 0 | 4 right |
| **Total** | **52** | **18 / 32 / 2** | **52 / 0 / 0** |

Route R also improves marks it does not need to fix: `arg(1+i)` in DEG becomes `= 45` (it was `≈ 45`), and `acos(2)` loses its 9.09E-13. One row shows how a value can be right in storage and wrong on screen: `H:=cosh(90i)` in DEG showed `= 0` but stored `cosh(90*i)`, which reads right in RAD.

Why route R is right on these paths: every path inside Giac (exp, hyperbolics, the `re`/`im` split, inverse trig in MPFR, integration tables, desolve, laplace, limit, series, complex powers) now sees radians, the only mode each was written for. The degree is a factor in the text, so it travels as π/180 through every rewrite Giac makes. A stored value is evaluated at store time into angle-free text (`180*atan(3/4)/pi`), and a Giac text that reaches the engine as a chip (`emit.ts:215`, the "Chip" case, not rewritten) means the same thing in both modes.

## 3. The golden inputs under the rewrite

`--golden` ran 536 cases: home 176, precision 104, bench 55, solve 54, function 28, units 119. Each ran today and with the rewrite, in its own mode, and only 3 changed: `prec-eq-closed-open`, `prec-eq-cas-closed-open` and `prec-ne-closed-open`. In all three the `==` test is left open, and the text kept for display shows the factor: `cos(1*pi/7)` instead of `cos(pi/7)`. The cause is that `equalityTest` builds the kept text from the emitted sides (`emit.ts:104`), and Giac substitutes pasdeg's value into it. In DEG the text would read `cos(pi/180*pi/7)`. R64 fixes it by building the kept text from the sides without the factor. No home, CAS bench, solve, function or unit result changed. The DEG cases among them are home's 20, precision's 1 and units' 4 (d36, d37, d39, g14; the deep check counted 5, but the fifth match is the file's comment line 11). No CAS golden case runs in DEG, so the deep check's "every CAS golden case in DEG changes its text" has nothing to act on yet. G46 adds the matrix rows as cases.

## 4. (a) The CAS view in DEG: what it shows

Route R's CAS result is radian text that is right in every mode. In DEG, though, the user reads `atan(x)` as a function of degrees. `--display` shows three options:

| Input (DEG) | 1 as printed | 2 rewritten back (recommended) | 3 degrees marked with ° |
|---|---|---|---|
| `diff(sin(x),x)` | `pi/180*cos(pi/180*x)` | `pi/180*cos(x)` | `pi/180*cos(x°)` |
| `∫ 1/(1+x²) dx` | `atan(x)` (**read as degrees: off by 180/π**) | `pi/180*atan(x)` (Giac orders it `1/180*pi*atan(x)`) | as 2 |
| `∫ sin(x)² dx` | `1/2*x-90/(2*pi)*sin(pi*x/90)` | `1/2*x-90/(2*pi)*sin(2*x)` | `…*sin((2*x)°)` |
| `desolve(y''+y=0,y)` | `c_0*cos(x)+c_1*sin(x)` (**not a solution read in degrees**) | `c_0*cos(180*x/pi)+c_1*sin(180*x/pi)` | `c_0*cos((180*x/pi)°)+…` |
| `atan(3/4)` | `atan(3/4)/(pi/180)` | `atan(3/4)` | `atan(3/4)` |
| `laplace(sin(t),t,s)`, `solve(sin(x)=1/2,x)`, `(-32)^(1/5)` | `180*pi/(pi^2+32400*s^2)`, `[30,150]`, `((sqrt(5)+1)/4+…)*32^(1/5)` | the same | the same |

**Recommendation: option 2.** It prints what a correct DEG engine would print, in the mode the user is in:
- Where Giac is right in DEG today, option 2 prints the same text (`pi/180*cos(x)`).
- Where Giac is wrong today, option 2 prints the right text (`pi/180*atan(x)`, the solution of the ODE).
- Text copied and pasted in the same mode keeps its meaning, as on the G2.

Option 1 shows `atan(x)` in DEG, which the user reads in degrees: a silent wrong reading (principle 3). Option 3 is correct, but it adds a mark nobody types and makes the arguments longer (`(180*x/pi)°`).

How it works (`backInDegrees` in the probe): Giac evaluates the result text with `sin(u)` → `pasdsin(normal(180/pi*(u)))` and `asin(u)` → `(pi/180*pasdasin(u))`, the inert names are renamed back, and the whole text goes through `normal` only when an inverse occurred. It costs 0.1–0.6 ms per result after the first (3.9 ms cold), in DEG only. The LaTeX comes from `latex()` of the same expression with the same renaming, as `showExp` does for pasexp today. The CAS Ans and `\res` chips keep the radian text (`pcasans`), which is mode-free. The display rule changes only what is drawn and copied.

## 5. (b) The user's functions and library files

A typed function keeps `pasdeg` in its body: `f(x):=sin(x)` becomes `(x)->sin(pasdeg*x)`, which Giac does not evaluate at definition time. The function therefore follows the mode at call time: row `fn-deg-call-rad` gives `f(pi/6)` = 0.5 in RAD for an `f` defined in DEG. Giac does the same today, and the deep check (Part 2 point 2) says the G2 does too. Its preview in Vars must not show `pasdeg`: the display drops the factor, as `showExp` drops pasexp.

S4's file format holds Giac definitions as written (`library.ts:2`, [r10-connector.md](r10-connector.md)). Today an import runs `cas(d.text, defaultCasSettings)` in RAD (`library.ts:291`), and the body reads the mode at call time. **Rule for route R:**
- Export writes the body without the factor (the text the user typed).
- Import applies the same factor rewrite as the parser's emitter. R64 needs a Giac-text version of that rewrite anyway, for the migration in §7.
- A library's `sin(x)` therefore follows the mode at call time, exactly as a typed one does, and a file round-trips.
- `// test:` lines (`library.ts:303`, raw `eval`) run with the rewrite and `pasdeg:=1`, so a test does not depend on the user's mode.

`pasdeg` joins the reserved names: `library.ts:198` refuses `pasc_…` and our definitions, and must also refuse `pasdeg`. A user's `pasdeg:=5` turns `sin(pasdeg*(x))` into `sin(5*x)` (probe, raw mode).

## 6. (c) The unit view

`pasua` (`units/evaluate.ts:37`) reads `angle_radian` to turn an angle-dimension argument into degrees. Under route R it becomes: an angle (rad dimension) is taken in radians, a bare number is multiplied by pasdeg (the probe's `PASUA_R`). Only the inverses get the factor in the job text, because `withAngles` already wraps sin, cos and tan. The probe also showed:
- All 119 unit cases are unchanged, the 4 DEG ones included.
- `asin(1/2)·2 m` is 60 m in DEG and 1.0471975512 m in RAD, as today.

The sibling pass asked whether an inverse should return a bare number in the mode's unit. It does in Home, and G15's default says the unit view follows Home. Route R keeps that rule without new code, so nothing is decided here.

## 7. (d) The stored logs: what a migration can and cannot do

The log does not record the mode a value was stored in (`DefEntry`, `defs.ts:23–40`). G34 adds that. For a log without the mode, G46's `DATA_VERSION` step can do the following:

| Entry | Migration | Exact? |
|---|---|---|
| `fn`, and `other` (replayed as typed) | `pasexp(` → `exp(`, then the factor rewrite. Bodies follow the mode at call time today, and still do after it | yes: the F29 behaviour every path should have had (F4 is fixed) |
| `var` whose text has no angle function and no exp | none | yes |
| `var` with an angle function or an exp, numeric preview | the text read both ways (factor π/180, or none); keep the reading whose value matches the stored 12-digit `preview` | yes when the readings differ; when they agree, either is right |
| `var` with free names (symbolic, `early`) | the factor rewrite with `pasdeg`: it follows the mode at use time, as today | yes |
| `var` whose preview matches neither reading | kept and listed in G46's report | no |
| a `var` from a value stored while G34 records the mode | the factor rewrite with `pi/180` frozen in DEG, `1` in RAD | yes |

The probe does not run this migration. G46 builds it with tests, among them the matrix's F1 and F2 sequences written as v2 logs.

## 8. (e) Enter time

`--bench` ran under the host-cpu lock on the desktop: 176 home.yaml inputs, each the median of 7 warm runs. `pasdeg` is set only on a mode change, as G46 would set it.

| Mode | Inputs | Median today / R | p95 today / R |
|---|---|---|---|
| RAD | all 176 | 0.30 / 0.29 ms | 2.28 / 2.34 ms |
| RAD | 31 with an angle function | 0.30 / 0.30 ms | 1.69 / 1.71 ms |
| DEG | all 176 | 0.25 / 0.26 ms | 2.41 / **3.71** ms |
| DEG | 31 with an angle function | 0.30 / 0.38 ms | 2.39 / **3.64** ms |

The DEG p95 comes from `sin(0.1)^2+cos(0.1)^2`: 1.40 → 3.71 ms, because the exact path now simplifies `sin(pi/1800)` terms. `asin(0.5)` and `atan(1)` go from 0.1 to 0.75 ms (`(pi/6)/(pi/180)` → 30). RAD is within 3 %. These are engine times. Home's Enter p95 on the Tab One is 138–160 ms (A4a), most of it outside Giac. G46's "Enter p95 within 5 %" holds for RAD only; for DEG it needs annabell's device measurement.

## 9. Route P, for comparison

Route P is G21b grown: a Giac patch per path, each with an upstream report and a migration.
1. exp of imaginaries.
2. cosh and sinh of imaginaries (D4).
3. The `re`/`im` split of complex trig (D5).
4. Inverse trig through MPFR in DEG (D6).
5. The antiderivative tables' factor for atan and asin (D7).
6. desolve, laplace and ilaplace in DEG (D7).
7. limit and series refusing DEG (D7).
8. Complex powers of negative numbers (D12).
9. Stored text: G34 freezes to decimals, and loses the exact form.

The plot is R64a on both routes. A path not yet found stays wrong until someone finds it, and every Giac update has to be re-checked against all nine. Route R fixes these by construction, needs no Giac patch, and drops pasexp, `expIgnoresAngle` and `showExp`.

## 10. What the prototype skipped (for R64 and G46)

- **Names the rewrite covers** (to verify by R64: every Giac command in the Find index that takes or returns an angle). The prototype rewrites sin, cos, tan, sec, csc, cot, their inverses and `arg`. Candidates beyond these: `atan2` if the index has it, `polar` and `rectangular` conversions, `rotation`, the DMS functions (R43; they return degrees as numbers, so probably none).
- **The kept text of an open `==` test** (§3).
- **The Vars preview and the library export** drop the factor (§5).
- **`pasdeg` is reserved** (§5). It is set through `giac.eval` by the host, not through the log, so `uses` never lists it (`host.ts` `usesOf` reads only the log).
- **The CAS display rule** (§4) lives engine-side in `casRunRaw`. No renderer change is needed, so no ron package follows.
- **The G2's items 63–65 do not change the route.** Item 63: route R's reading z° = zπ/180 is the only one in which one input has one value in Home and CAS. Item 64: F29's rule (no angle in a hyperbolic). Item 65: a separate CAS angle setting would be a UI choice on top of route R, not a reason against it (S12, "Engine defaults, not G2 copies").

## 11. Risks

1. **A path where Giac builds its own trig text in RAD that the display rule misreads.** Option 2 rewrites every trig of the result, so `cos(x)` from desolve is shown as `cos(180*x/pi)`. That is correct, but it surprises. G46's golden cases cover desolve, laplace and series.
2. **The migration's preview match** needs the 12-digit preview of a value stored at more than 12 digits. A preview is at most 200 characters (`PREVIEW_MAX`), so a long exact value may not have one. Such entries are listed, not guessed.
3. **DEG engine time** (+1.3 ms desktop p95). Correctness wins over speed (rules-core), but annabell measures it on the Tab One after G46.
