<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# A deeper pass on the check of 2026-10-19: the angle mode in every path, and marks that do not travel

**Status (2026-10-20): decided;** every finding is merged, in a package, or dropped (rules section 10: check reports go to the archive).

Written 2026-10-18 evening by Claude (Opus, the owner's session; read and probe only) on `phase-1` `cb1c74c` in `.claude/worktrees/phase-1`, with the engine `engine/giac/_out/gsl-memcap`. It builds on [check-2026-10-19.md](check-2026-10-19.md) (sofia; its findings are numbered 1–17 there; the ones here are D1–D12). A second pass written at the same time by another session covers units and uncertainty, format, restore and library, Giac's exact answers that are wrong in radians too, solver conditioning and the pipeline; its note is the sibling of this one. The split was agreed by message, and so were the ids (here: S14, G46, G49, G50, R64, R65).

**Method.** Each finding was run on the real engine through `EngineHost`, as the app calls it: Home and CAS through `host.home` and `host.cas`, Solve through `host.solve`, and the Function app through `host.analyze` and `compileDefinition`. Sequences of lines went through a scratch probe that builds Ans and the `\res` chips exactly as `session.svelte.ts:514–519` does (the same `full` and `fullExact` rule) and parses keyboard LaTeX with our parser. The key sequences were not run in the app itself. A complex-argument sweep compared 16 audited functions × 12 arguments × both modes × Digits 12, 40 and 60 (1152 evaluations) against mpmath at 80 digits. Right values come from mpmath (`oracle`) or are derived. The probes are throwaway, but each finding names its input, so `tools/probes/engine.ts` (with `ANGLE=deg`) reruns any single line. S14 turns the angle cases into a probe in the repo.

## Verdict

sofia's five findings are the visible part of two larger holes:
- **Giac's angle mode is global state, and at least eight independent Giac paths read it, each its own way.** sofia found three of them (exp, stored values, functions defined in RAD). Here are six more: hyperbolic functions of imaginary numbers, the real and imaginary parts of complex trig, inverse trig with complex results, complex powers of negative numbers, symbolic calculus, and the Function app's plot. Some of these give `=` on a wrong value. Patching path by path (G21's text rewrite, G21b's Giac patch, G34's frozen decimals) cannot close this. **Recommendation:** a one-day spike, S14, on running Giac always in radians and keeping the degree mode in our parser, before G21b is built.
- **Marks travel only through stored float variables (M4-7).** Ans, a tapped result and Store of an exact-looking value carry at most an `exact` flag, and that flag lasts one step. A ⚠ result reused through Ans becomes a confident wrong number, and an inexact value becomes `=` after two Enter presses. G49 and R65 fix it.

Nothing here argues against pushing `phase-1`: every finding is older than night 3.

## Part 1: findings

### High: silent wrong numbers

**D1. The ⚠ is lost through Ans and chips** (**verified**, engine plus the session's chip rule). At 12 digits, `romberg(exp(-x^2),x,0,1)` shows `⚠ 0.74682413281` (11 digits confirmed, unaudited). Then `Ans−0.7468241328124` shows `≈ −4E-13`; the right value is 2.70253994674E-14 (oracle), so the sign and the size are wrong, and the `≈` claims the digit is confirmed. The same value through a stored `B` gives `⚠ 3E-14` (M4-7 works there). At 30 digits the chip carries 30 digits (11 confirmed), and the result is `≈ 2.7041600115591871E-14`, wrong from the 4th digit. That is exactly the bug G3 fixed for variables (`precision.yaml` prec-M4-7-cancel-30), back through Ans. The causes:
- The chip value is `full = r.exact` when an exact text exists (`session.svelte.ts:514`). For a float on the exact path that text is Giac's printed float, digits beyond the confirmed ones included.
- The chip carries only `exact` (`chips.ts:7–14`).
- `EngineHost.inherited` (`host.ts:377`) takes facts only from the defs log, never from a chip.

**D2. Inexact becomes `=` in two steps** (**verified**, same probe). `normald_icdf(0.025)` shows `⚠ −1.95996398454` (unaudited), `Ans·1000` shows `≈ −1959.96398454`, and `Ans÷1000` shows **`= −1.95996398454`**. The same with romberg: `⚠ 0.74682413281`, `Ans·1` gives `≈ 0.746824132812` (the 12th digit is not confirmed), and `Ans·1` again gives **`= 0.746824132812`**. Cause: `session.svelte.ts:518` sets `fullExact` from the engine's facts and ignores `inexactInput`. The second line's result is an exact rational of the chip's digits, so its own chip is "exact".

**D3. Store ▶ turns an inexact constant into an exact value** (**verified**, a `\const{G}` chip with CODATA's σ). `A:=G·2` shows `≈ 1.33486E-10`. Then `A÷2` shows **`= 6.6743E-11`** and `A·10¹¹` shows **`= 13.3486`**. CAS `B:=G` used in Home as `B·3` shows `= 2.00229E-10`. docs/04 2.4: a result from a constant with an uncertainty is never `=`. Cause: `host.ts:351` keeps facts only when the stored text prints a float, and a constant chip is an exact rational literal (`chip-giac.ts`). (Point raised by the sibling pass.)

**D4. DEG: hyperbolic functions of an imaginary number read the angle mode** (**verified**). *(2026-10-19, raw Giac: the mechanism holds, `re(cosh(90*i))` = 0 in DEG while `evalf(cosh(90*i))` is right; since G46 Giac runs in radians and Home DEG `cosh(90i)` = `≈ −0.448073616129` in both modes.)*
- Home `cosh(90i)` gives **`= 0`** and `sinh(90i)` gives **`= i`**, both marked exact. Right: −0.448073616129 and 0.893996663601·i (oracle).
- `cosh(1+i)` gives `≈ 1.54284561616+0.0205100888771i` (39 digits "confirmed"). Right: 0.833730025131+0.988897705763i.
- `H:=cosh(90i)` stored in DEG reads −0.448073616129 in RAD. The value changes between modes, as in sofia's finding 1.
- **Solve in DEG:** `cosh(i·x)=1/2` gives `x = 60`, "exact root (checked by CAS)". Right: 1.0471975512; RAD gives it, and so does `exp(ix)+exp(−ix)=1` in DEG. The substitution check reads cosh in the same wrong way, so it confirms the root.

Mechanism: Giac rewrites `cosh(i·b)` as `cos(b)` and `re(cosh(a+bi))` as `cosh(a)·cos(b)`, and then reads that cos in degrees. A hyperbolic function has no angle in it. F29's rule for exp holds here too, and G21's rewrite covers exp only.

**D5. DEG: one complex input, two values in two views** (**verified**). Home `cos(30+i)` shows `≈ 1.33634702984−0.587600596822i`, `tan(45+i)` shows `≈ 0.265802228834+0.964027580076i`, `abs(sin(1+i))` shows `≈ 1.17533077558`, and `cos(i)` shows `≈ 1.54308063482`, each with 39 digits "confirmed". Giac's own `evalf` (the CAS view's `evalf`, and Giac at any Digits) gives cos((30+i)°) = 0.866157310345−0.0087270893148i, tan((45+i)°) = 0.999391074313+0.0348924144079i and |sin((1+i)°)| = 0.0246826830407 (oracle agrees). Mechanism: Home reads a number as `re(x)` and `im(x)` (`numeric.ts:358–359`), and Giac's symbolic `re(sin(a+bi))` is `cosh(b)·sin(a)`, which converts a to radians but not b. Which reading of "sin of a complex number in degrees" is right is a G2 question (new item 63). Two different values for one input are wrong either way.

**D6. DEG: inverse trig with a complex result is converted in double** (**verified**). Home `acos(2)` shows `≈ 9.09494701773E-13+75.4561292902i`; right: 75.4561292902·i with real part 0 (oracle). `acos(1.5)` shows the same 9.09E-13. At 20 digits, `asin(2)` shows `≈ 89.999999999999−75.456129290216i`; right: 90−75.4561292902169i. Giac returns the identical double at Digits 40 and 60 (9.094947017729282E-13 is 2⁻⁴⁰), so the agreement check (docs/04 2.4 rule 2) confirms 39 digits. The sweep shows the same for every complex argument of sin, cos, tan, asin, acos and atan in DEG: 13–15 right digits at any Digits, all marked `≈`.

**D7. DEG: symbolic calculus is wrong outside the cases Giac was written for** (**verified**). Right in DEG: `diff(sin(x),x)` = π/180·cos(x), `int(sin(x),x,0,90)` = 180/π, `solve(sin(x)=1/2,x)` = [30,150], and the Solve app's Newton and Brent (`sin(x)=1/2` gives 30; a 2×2 system checks out). Wrong, with no mark:
- CAS `int(1/(1+x^2),x)` gives `180/pi*atan(x)` and `int(1/sqrt(1-x^2),x)` gives `180*asin(x)/pi`. The factor is upside down: in DEG `diff(atan(x),x)` = 180/π/(1+x²), so the antiderivative is π/180·atan(x).
- `desolve(y''+y=0)` gives `c_0*cos(x)+c_1*sin(x)`, which read in degrees is not a solution. `ilaplace(1/(s^2+1),s,t)` gives `sin(t)`, and `laplace(sin(t),t,s)` gives `1/(s^2+1)`.
- Definite integrals: Home `∫₀¹ 1/(1+x²) dx` shows the list `[8100/pi, 0.785398163397]` (right: π/4 = 0.785398163397), and `∫₀⁹⁰ x·sin x dx` shows `[180/pi, 3282.80635001]` (right: 3282.80635001). These are Giac's own "exact and numeric disagree" pairs. The sibling pass owns that pair, which also occurs in RAD.
- `limit((1+1/n)^n,n,inf)` and `series(exp(x),x,0,3)` are refused ("works only in radian mode") although they hold no angle.

**D8. Function app in DEG: the curve is drawn in radians, the numbers are in degrees** (**verified**). The plot is compiled to JS once (`apps/function/compile.ts:38` → `emit-js.ts:10`, `Math.sin`) with no angle input. Root, Extremum, Slope, Area and the Num table run Giac in the mode (`host.analyze`, `host.table`). For `sin(x)` in DEG the drawn curve is −0.801 at x = 180 and crosses zero at π, but Root near 3 reports x = 0 and Extremum near 1.5 reports x = 90. The numbers are right for DEG and the drawing is not. On the G2 the Function app plots in the angle mode.

**D12. DEG: a complex power of a negative number reads the angle mode** (**verified** through the keyboard; found by the sibling pass's RAD/DEG invariant probe). Home DEG `(−8)^0.2` shows `≈ 1.5156254288+0.0166213589593i` (right: 1.22624046096+0.89091584445i), and `(−1)^0.1` shows `≈ 0.999984967771+0.00548308608166i` (right: 0.951056516295+0.309016994375i). CAS DEG `(−32)^(1/5)` prints `(cos(1/5*pi)+i*sin(1/5*pi))*32^(1/5)`, a radian text that DEG reads in degrees, and its `evalf` is 1.99987974307+0.0219320146346i (right: 1.61803398875+1.17557050458i). Giac builds the trig itself, as for exp. Home's `\frac{1}{5}` with an odd denominator goes to `surd` (−2, P5 (b)) and is safe; a decimal exponent and the CAS view are not.

### Medium

**D9. tanh of a complex number is wrong in Giac, in both modes** (**verified**). `evalf(tanh(i))` gives −0.642092615934·i, which is coth(i); right: 1.55740772465·i. At Digits 12, `evalf(tanh(i/2))` gives −1.83048772171·i. `evalf(tanh(1+i),40)` gives 0.868014142896−0.217621561854i; right: 1.08392332734+0.27175258532i. The sweep has complex tanh wrong at all 12 arguments at Digits 40 and 60. Home shows `tanh(i)` as a bare `⚠ −2.78523697142E-31−0.642092615934i`: flagged, but no digit is right. `tanh(1+i)` and `tanh(1/2+i/3)` are right in Home (the `re`/`im` path takes another formula). `tanh` is on the audited list (`numeric.ts:50`), which was audited for real arguments. Report upstream.

**D10. Complex inverse trig has no MPFR path in RAD either** (**verified**). `acos(1+i)` at Digits 40 gives 2.2370357592874… (14 digits) for every complex argument tried. `asin(i)` and `asin(2i)` print a real part `0.-000…` that the formatter cannot read, so Home falls back to a double and shows `⚠`. Home at 30 digits shows `acos(1+i)` as `≈ 0.90455689430238−1.06127506190503565203301891621i`: the real part has only Giac's 14 digits under a `≈` that claims 38. No wrong digit is shown, but by docs/04 2.4 the mark should be `⚠ 14`. *(Rechecked 2026-10-20 on `da7a59c`: the `0.-000…` print does not reproduce on raw Giac at Digits 40, and Home at 30 digits shows `asin(i)` = `≈ 0.88137358701954302523260932498i` and `acos(1+i)` right to 30 digits, as mpmath: G50.)*

**D11. The audited list is a list of names, not of domains and modes** (**verified**, `numeric.ts:47–53`). A function on it gets `≈` when two precisions agree, and for D5, D6 and D9 two precisions agree on wrong digits. That is the risk docs/04 2.4 names ("two of Giac's routines can agree on wrong digits"), met through complex arguments and the DEG paths, which the tier-0 audit never covered.

### Checked and right
Typed `e^…` always reaches Giac as `exp(…)` (parser: `e^{90i}`, `\mathrm{e}^{90i}`), so pasexp catches it. `2^(90i)`, `i^i`, `ln(−1)`, `sqrt(i)`, `(−8)^(1/3)` and `10^i` are the same in both modes. In DEG: `arg(i)` = 90, `int(sin(x)^2,x,0,180)` = 90, `sum(sin(k),k,1,3)` = 0.104687859383 and `solve(tan(x)=1)` = 45. The unit view's angle rule (units.yaml d26, d36–d39, g14) passes.

## Part 2: the architecture

1. **Root cause of sofia's findings 1–4 and D4–D8, D12: Giac's `angle_radian` is one global flag read at evaluation time by many independent code paths, and they disagree.** Plain trig follows it. The exact simplifications of exp, cosh and sinh of imaginaries follow it where they should not. The symbolic `re`/`im` split follows it for half the argument. Inverse trig converts in double. The antiderivative tables invert the factor. desolve and laplace ignore it, and limit and series refuse it. A stored or exported text is read again under whatever the flag is later. Our fixes so far each close one path from the outside: G21 rewrites typed `exp`, G21b would patch Giac's exp, and G34 freezes stored text. Each further path would need its own patch, its own upstream report and its own migration.

2. **The alternative: Giac always runs in radians, and the degree mode lives where the user typed an angle.** The parser multiplies the argument of each angle function the user types (sin, cos, tan, sec, csc, cot, the polar entry) by an engine value `pasdeg`, and divides the result of each inverse (asin, acos, atan, arg, atan2) by it. The host sets `pasdeg` to π/180 in DEG and 1 in RAD. R10 already does this for the ° template with `(pi/180)^angle_radian()` (`emit.ts:289`). What would follow:
   - Every Giac path sees radians, so D4–D7 and D12 disappear. exp needs neither pasexp nor a Giac patch: G21, `showExp` and G21b go, with a migration of stored `pasexp(`.
   - A stored value is evaluated at store time into angle-free exact text (`TH:=180*atan(3/4)/pi`). sofia's finding 1 disappears, and the exact form is kept, where G34 falls back to a decimal.
   - A stored function keeps `pasdeg` in its body, so it follows the mode at call time, as on the G2.
   - A library file in plain Giac text is in radians, and S4's format says so once.
   - The JS plot multiplies by the same factor, so D8 disappears.

   Costs and unknowns, which S14 measures:
   - The CAS view in DEG prints Giac's radian text (`diff(sin(x))` → `pi/180*cos(pi*x/180)`), so it needs a display rule.
   - Complex arguments get the analytic reading z° = zπ/180, which must agree with the G2 (item 63).
   - Every CAS golden case run in DEG changes its text.
   - The defs log does not record the mode a value was stored in, so values stored in DEG before the switch cannot be migrated exactly. G34 should start recording it.

   **Recommendation:** S14 first; G21b waits for its answer; G34 goes ahead, because it is the commonest path and its sequence tests are reused either way.

3. **The precision chain has three carriers, and only one carries the facts.** A stored float variable carries `reliableDigits`, `warn` and the perturbation check (M4-7). Ans and a chip carry `exact`, for one step. A stored exact-rational value carries nothing. docs/04 2.8 says "its exactness travels". It should say "its facts travel": exact, confirmed digits, warn, and later σ (G26), through every carrier and for as many steps as the value is reused (D1–D3). G49 (engine) and R65 (session).

4. **The audit is by name and must become by domain and mode** (D11). G50 adds the complex arguments to the audit and to `precision.yaml`. The DEG column goes away if S14's route is taken; otherwise it is G50's too.

5. **The substitution check cannot catch a mode-consistent misreading** (D4's Solve case). It substitutes in the same Giac with the same flag. Under S14's route the problem goes away; otherwise a second substitution in RAD with the factor would catch it.

6. **DEG is thin in the gates.** 26 of 1124 golden cases run in DEG (home 20, precision 1, units 5; none in solve, function or CAS bench), and none switches the mode between two lines (sofia's Part 2 point 1). S14's matrix and G34's sequence form are the start.

7. **One more root cause, from the sibling pass (theirs to package):** Home's exact path runs Giac at Digits = the display digits (`host.ts` `useHomeMode`), and Giac makes its sign, abs, floor and comparison decisions at that precision. `abs(sin(10^50))` gives a negative value under `≈`. It interacts with D6: both are a precision chosen inside Giac that our agreement check cannot see.

## Part 3: packages and decisions

| Order | ID | One line | Agent, model | Lane | Starts when |
|---|---|---|---|---|---|
| 1 | **S14** | Spike: Giac always in radians, the degree mode in our parser (D4–D8, D12, findings 1–4) | sandra, Opus | night, first after S10 | A14 |
| 2 | **G49** | Marks travel through Ans, chips and Store: the engine side (D1, D3) | gorge, **Opus** | night, after G34 | A15 |
| 3 | **R65** | Marks travel through Ans and chips: the session side; `fullExact` never ignores an inexact input (D1, D2) | ron, **Opus** | night (no UI change) | G49 |
| 4 | **G50** | Complex arguments of the audited functions: tanh, inverse trig without MPFR, the cases in `precision.yaml` (D9–D11) | gorge, **Opus** | night | A15 |
| 5 | **R64** | The angle mode in our parser: the plot follows it; with S14's route, every angle function carries `pasdeg` | ron, **Opus** | night (parser and plot code) | S14, and the owner's yes to its route |
| 6 | **G46** | Giac always in radians; pasexp goes, with a migration (replaces G21b) | gorge, **Opus** | night | R64, on S14's route |

The combined night order (pascaline-91, 2026-10-19): S10, S14, G34, G35, G49, R65, G36, G50, then S6 and S8. S10 comes first because G34 and G49 add docs/04 2.8 text; S14 comes early so its route is known in the morning.

Changes to the check's packages: **G21b** starts only if S14 recommends patching Giac rather than switching it to radians (its scope then grows by D4–D7). **G34** goes ahead and also records the angle mode in each stored entry.

**For the owner** (decisions.md "Needs the user"): *"S14 before G21b"*. I recommend running the spike before building a Giac patch for exp, because a patch per path does not reach the other seven paths found here. Three G2 questions (items 63–65): sin of a complex number in DEG, cosh of an imaginary number in DEG, and whether the CAS view has its own angle setting.
