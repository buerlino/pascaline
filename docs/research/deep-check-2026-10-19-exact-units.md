<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# A deeper pass on the check of 2026-10-19: Giac's exact answers, the unit view and the tests across settings

Written 2026-10-18, late evening, by Claude (Opus, the owner's session; read and probe only) on `phase-1` `cb1c74c` in `.claude/worktrees/phase-1`, with the engine `engine/giac/_out/gsl`. It builds on [check-2026-10-19.md](check-2026-10-19.md) (sofia; findings 1–17) and is the sibling of [deep-check-2026-10-19-angle-marks.md](deep-check-2026-10-19-angle-marks.md) (D1–D12: the angle mode in every path, marks through Ans and chips). The split was agreed by message: that note owns the angle paths and the marks, this one owns Giac's exact answers in either mode, the unit view and uncertainty, format, restore and library, solver conditioning and the pipeline. Findings here are E1–E12; ids G38–G44 and S11, with R60–R63 kept for S11's packages; G37 (decided by the owner from sofia's finding 12) got its package file here too.

**Method.** Every finding was run on the real engine through `EngineHost`: Home and CAS through `host.home` and `host.cas` (`tools/probes/engine.ts`, `MODE=raw` for plain Giac), the Solve app through `host.solve`, and the unit view through `buildJob` and `host.units` with the Find index's factors, as the golden gate's units stage does (`app/scripts/unit-case.ts` syntax: `{m}`, `pasupm(v,σ)`). Sequences (store, relaunch, recall) went through a scratch probe that replays the defs log into a fresh engine with `host.restore`. A metamorphic probe ran every `home.yaml` and `precision.yaml` input with no settings in RAD and DEG, and at 12 and 30 digits. Right values come from mpmath at 30–200 digits (`oracle`) or are derived. Nothing reaches the unit view from the keys before R24c, so E3–E5 are wrong numbers nobody can see yet.

## Verdict

The marks of docs/04 2.4 check the **value of the text Giac returns**. They do not check **how Giac got there**, and three kinds of answer slip through:
- **A decision Giac made at too few digits.** Home's exact path runs Giac at `Digits` = the display digits (`host.ts` `useHomeMode`), and Giac decides signs, comparisons, `floor` and `abs` at that precision. The text it returns is then exact (`= 1`) or a correct-looking irrational (`abs(…)` → `sin(10^50)`, negative). **G38.**
- **A number for something that does not exist.** Giac returns a principal value for a divergent integral and an Abel sum for a divergent series, as exact numbers. **G39.**
- **A unit or σ rule that holds on one side only.** The unit view guards the angle going into sin and the rpm → rad/s conversion, but not the angle coming out of asin, not ω·r, and not a σ at a stationary point. **G40** (after the owner's word) and **G41**.

And one process gap: every test is one input in one setting. A test that asks "is the answer the same in RAD and DEG, at 12 and 30 digits, before and after a store" needs no expected value and found two DEG bugs in 169 inputs at its first run. **G43.**

## Part 1: findings

### High: silent wrong numbers

**E1. The exact path decides at the display digits** (**verified**, Home RAD at 12 digits; CAS the same, `casSetupCommands` sets `Digits:=` the setting too). Oracle: sin(10^50) = −0.78967249342931008271.

| Input | Shown | Right |
|---|---|---|
| `sign(sin(10^50))` | `= 1` | −1 |
| `sin(10^50)>0` | `true` | false |
| `abs(sin(10^50))`, `sqrt(sin(10^50)^2)` | `≈ −0.789672493429` | 0.789672493429 |
| `max(sin(10^50),0)` | `≈ −0.789672493429` | 0 |
| `floor(sin(10^50)*10^12)`, `round(…)` | `= 609741545567` | −789672493430, −789672493429 |
| `piecewise(sin(10^50)>0,1,2)` | `= 1` | 2 |
| `floor(exp(pi*sqrt(163))*10^20)` | `≈ 2.62537412641E37`, copy text `…99999998448107520` | `…99999999925007259` (wrong from digit 28) |

`sin(10^50)` alone is right (the agreement check runs at P = 40). At 30 digits the same inputs are still wrong. With `MODE=raw` and `Digits:=40` all of them are right, but `floor(sin(10^60)*10^12)` is still wrong at 40 (933879932404) and right at 60 (830389765219, oracle). So a fixed higher `Digits` is not enough: the decision needs two precisions, as the value does. Not affected: the everyday cases Giac simplifies exactly (`floor(log10(1000))` = 3, `floor(ln(8)/ln(2))` = 3, `floor(cos(π/7)−cos(2π/7)+cos(3π/7)+1/2)` = 1) and decimal near-ties (`sign(sqrt(2)-1.4142135623730951)` = −1). The trigger is a value whose double is badly wrong: trig of a large argument, or a cancellation past 15 digits.

**E2. A divergent integral or series comes back as a number** (**verified**; Home and CAS).

| Input | Shown | Right |
|---|---|---|
| `int(1/x,x,-1,1)`, `int(1/(x-1),x,0,2)` | `= 0` | does not converge (0 is the principal value) |
| `int(tan(x),x,0,pi)` | `= 0` | does not converge |
| `sum(cos(k),k,1,inf)` | `= -0.5` | does not converge (−1/2 is the Abel sum) |
| `sum(sin(k),k,1,inf)` | `≈ 0.915243860856` | does not converge |
| `sum(exp(i*k),k,0,inf)` | `≈ 0.5+0.915243860856i` | does not converge |

Giac itself says `undef` for `int(1/(x-2)^3,x,0,3)` and `sum((-1)^k,k,0,inf)`, so the same kind of input gives a refusal or a number depending on the route. Giac's own tools tell them apart cheaply: `int(abs(1/x),x,-1,1)` and `int(abs(tan(x)),x,0,pi)` give `+infinity`; `limit(sin(k),k,inf)` gives `bounded_function(2)`, `limit(cos(k),k,inf)` `bounded_function(4)`, `limit(exp(i*k),k,inf)` `undef`, while a convergent term gives 0. Right in the same run: `sum(cos(k)/k,k,1,inf)` = −ln(2 sin ½) = 0.0420195058254, `sum(sin(k)/k,…)` = (π−1)/2, `int(1/x^2,x,-1,1)` = +∞.

**E3. The unit view's asin, acos and atan return a bare number in the mode's unit** (**verified**). G15 made sin, cos and tan take an angle (`pasua` in `app/src/units/evaluate.ts`) and left the inverses alone. In DEG, `asin(1/2)·1 rad` gives `= 30 rad` (right: π/6 rad) and `asin(1/2)·2 m` gives `= 60 m` (RAD: 1.0471975512 m). `asin(1/2) → °` is refused in both modes ("1 vs angle").

**E4. rpm times a radius gives a speed without the 2π, and ω times a radius is refused** (**verified**). `3000 rpm × 0.1 m → m/s` gives `= 5 m/s`; the peripheral speed is 2π·0.1·3000/60 = 31.4159265359 m/s (derived). The textbook formula `10 rad/s × 0.5 m → m/s` is refused ("L·T⁻¹·angle vs L·T⁻¹"), as is work from torque, `90° × 1 N·m → J` (right: π/2 J). The cause is the design itself (docs/04 4.3, G25, G32): rad is a dimension and rev is a count, so the trap form passes and the right form fails. With rev as a count, rpm × length is right for a feed (3000 rpm × 0.1 mm per turn = 300 mm/min), so a plain refusal would break that case. The owner decided it on 2026-10-19: decisions.md "Angles in the unit view".

**E5. σ at a stationary point is 0** (**verified**; G18 is first order only). `cos(0 ± 0.1)` → `1 ± 0`; `sin(90° ± 1°)` → `1 ± 0`; `(0 ± 0.1 m)²` → `0 ± 0` (and the unit is lost, G35's case). With the GUM's second-order term (GUM 5.1.2, note; uncorrelated inputs) σ is 0.00707106781187, 0.000215397043199 and 0.0141421356237 m² (derived; a Monte Carlo of cos X, X ~ N(0, 0.1²), gives 0.0070358300299, so the second-order term is the GUM's own approximation, not the exact spread). `sqrt(0.01 ± 0.1 m²)` gives σ = 0.5 m on a value of 0.1 m: the input's interval reaches below 0, where the square root has no real value. In DEG, `sin(30 ± 1)` is right (σ = cos 30°·π/180 = 0.015; Giac's `diff` applies the factor), and so is `acos(0.5 ± 0.01)` (0.66°).

### Medium

**E6. Giac's [exact, numeric] pair is shown as a list** (**verified** in RAD: `int(abs(x-sin(10^50)),x,-1,1)` shows `[(…)/2-(…)/2, 1.35506364264]`; the DEG cases are the sibling note's D7). When Giac's own check of an antiderivative fails it returns both answers; Home draws a two-element list with the weakest mark.

**E7. Statistics and rounding** (**verified**). `median([1,2,3,4])` shows `⚠ 2` (right: 2.5, derived): flagged, but wrong in the first digit (listed for upstream in backlog, with no local fix). `round(-2.5)` = −2 and `round(-2.25,1)` = −2.2 (Giac rounds half up), while our display rounds half away from zero (−2.25 in FIX 1 shows −2.3): two roundings of one number on one screen. `percentile([1,2,3,4],50)` comes back unevaluated, drawn as text. `quartile1([1,2,3,4,5,6])` = 2 is one of several conventions (G2 item 67). Giac's `stddevp` is the sample deviation and `stddev` the population one; `home.yaml` already pins both, Find's titles must say it (R4a's text).

**E8. Unit refusals show internal text** (**verified**). `floor(1.5 m)` → "Not a number: floor(3*pasdimL/2)"; `1 m/(0 s)` → "Not a number: infinity"; `irem(7 m, 2 m)` → "Units don't match: L vs L²"; `m^(2 ± 0.1)` → "The unit view could not evaluate this no uncertainty: [2]"; `30° × 2 m` is shown as `60 1°·m`. All are refusals or display slips, not wrong numbers. G35's message pass takes the first four, G40 the last.

**E9. Unevaluated Giac words reach the screen.** `limit(sin(x),x,inf)` shows `bounded_function(2)`; `percentile(…)` shows itself. G39 gives the first a message ("no limit").

**E10. No test changes a setting** (**verified**, sofia Part 2 point 1, now measured). A metamorphic probe (no expected values) ran 169 angle-free golden inputs in RAD and DEG: 2 differ, `(-32)^(1/5)` and `(-8)^0.2` (the sibling's D12, wrong in DEG). It ran 160 confirmed inputs at 12 and 30 digits: 0 differ. The same probe with E1's inputs at Digits P and P + 20 shows every E1 row.

### Low

**E11. normald_icdf(10^-10)** now shows `⚠ 7 −6.36134` (right: −6.3613409024040562047): honest, 7 digits. docs/04 2.3 #2's value polish (substitute back into normald_cdf at P digits) would give all 12. G44 builds it for the inverse distribution functions. Done by G44.

**E12. Pipeline.** Night 3's report asks for the e2e timing rerun to compare its failures with Playwright's "N failed" summary; A15 had the size check but not this. Added to A15 as point 6.

### Checked and right (verified)
The Num table's x values are exact decimals (`app/src/apps/decimal.ts`), never 0.30000000000000004. The Solve app on `(x-1)^10=0`, `(x-1)^2=0`, `(x-1)^3*(x-2)=0`, `x^2=1e-30`, `(x-1)^10=1e-40` (1.0001), and the polynomial path on `(x-1)^10`: exact roots checked by CAS, or two polishes agree; `1/(x-1)=0` and `exp(-1/x^2)=0` refused. A float stored at 30 digits keeps 40 digits in the defs log and the same digits after a relaunch. Constants carry their CODATA ± in the unit view (d42). Discontinuous antiderivatives are handled: ∫₀^{2π} 1/(2+cos x) = 2π/√3, ∫₀^{2π} 1/(1+sin²x) = √2·π, ∫₀^{10} |sin x| = 7 + cos 10, ∫₀^{2.5} x⌊x⌋ = 15/4, ∫₀⁴ 1/(1+tan²x) = 2.24733956166 (oracle 2.24733956166). Geometric series with |r| ≥ 1 give infinity. `max(1 m, 50 cm)` = 1 m; ln, exp, log10, atan and a power π of a quantity are refused; (8 m³)^(1/3) = 2 m.

## Part 2: the architecture

1. **`Digits` is global state the exact path reads, like the angle mode.** The sibling note shows the angle mode reaching eight paths; `Digits` reaches every numeric decision inside an exact evaluation. The agreement check (2.4 rule 2) re-evaluates the returned text at P and P + 20, so it confirms a wrong text. **Rule (default, this pass):** the exact path runs at `Digits` = P, and a result that rests on a decision (the decision functions, and int, sum, limit and solve, which decide signs inside) is computed again at P + 20 and must give the same text, else once more at P + 40, else `⚠`. The display is our formatter's in any case, so `Digits` changes no text on screen.
2. **Giac returns three shapes the marks do not model:** a convention value where mathematics has none (principal value, Abel sum), a pair [exact, numeric], and unevaluated text. The marks assume a value is exact or a float with digits. **Rule:** a number for something that does not exist is refused, by the cheapest necessary check Giac offers (the term's limit for a series, ∫|f| for an integral with a singular point inside); a pair is never drawn as a list.
3. **The unit view's angle model is half-built.** It guards the input side (sin, cos, tan take an angle; rpm → rad/s is refused) but not the output side (asin gives a bare number) nor the formulas engineers type most (v = ω·r, W = τ·θ). One rule closes both, below; it is the owner's call because it changes G25 and G32's answers.
4. **First-order σ is exact where it applies and silent where it does not.** G18 differentiates exactly, so a linear or smooth case is right to every digit, and a stationary point gives 0. The GUM's second-order term fixes the value there, and its size is also the test of whether first order held, which is what the `⚠` should say.
5. **Invariants test what single points cannot.** The same answer in RAD and DEG for an angle-free input, at 12 and 30 digits, before and after a store, and after copy and paste (P5): none needs an expected value, and each would have caught a finding of the three notes before a user did. They belong in the golden gate, with a list of known failures linked to their packages, so the gate turns red only on a new one.
6. **With S14.** If S14's route R keeps Giac in radians, the unit view's `pasua` and G40's inverse wrappers follow `pasdeg` (the sibling's S14 lists `app/src/units/evaluate.ts`). G38's `Digits` rule and G39's checks hold on either route.

## Part 3: packages and decisions

| Order | ID | One line | Agent, model | Lane | Starts when |
|---|---|---|---|---|---|
| 1 | **G38** | The exact path decides at the value precision (E1) | gorge, **Opus** | night | A15 |
| 2 | **G39** | A divergent sum or integral is refused; Giac's pair is never a list (E2, E6, E9) | gorge, **Opus** | night | A15 |
| 3 | **G42** | median, round and the quartiles as the G2 and our display do (E7) | gorge, Sonnet | night | A15; round after G2 item 66 |
| 4 | **G41** | σ beyond first order at a stationary point (E5) | gorge, **Opus** | night | A15; before R24c |
| 5 | **G40** | Angles in the unit view: inverses give an angle, ω·r and rpm (E3, E4, E8's °) | gorge, **Opus** | night | A15; before R24c (decided 2026-10-19) |
| 6 | **G43** | The golden gate checks invariants across settings (E10) | gorge, Sonnet | night | A15 (its store part after G34) |
| 7 | **G44** | Inverse distribution functions polished by substituting back (E11) | gorge, **Opus** | night | A15 |
| 8 | **S11** | The unit result view as packages (backlog m5 item 4) | sandra, Opus | night | A14; R60–R63 for its packages |
| — | **G37** | °C and °F inside a compound unit are an interval (decided; sofia's finding 12) | gorge, **Opus** | night | G35; before R24c |

Changes to other packages: **G35** gets `1 m + 1 s − 1 s` and E8's four messages; **A15** gets point 6 (E12). G2 items 66–68 ask the reference first (round, the quartiles, rpm and ω·r).

**Decided by the owner (2026-10-19):** *"Angles in the unit view"*, as recommended: an angle is a quantity both ways (asin, acos and atan give an angle, shown in the mode's unit), an end slot may drop one rad when no cycle unit (rpm, rev, Hz) is on either side, with a visible note, and rpm or rev times a length gets a note naming 2π·r·n. G2 item 68 asks what the G2's units do with both formulas. The owner also said yes to the sibling note's "S14 before G21b". Defaults set here (decisions.md): E1's rule, E2's refusal, E5's second-order rule with `⚠` when the second-order part is more than 10 % of σ².
