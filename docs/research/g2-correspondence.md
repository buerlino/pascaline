<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Engine defaults, not G2 copies: the audit (S12)

sandra, 2026-10-19, on `phase-1` at `8745db1`. The rule (owner, 2026-10-19; decisions.md "Engine defaults, not G2 copies"): the default is what the engine does as built (Giac, GSL, MathLive). A special case stays only for one of two reasons:
- **P3:** the engine's result is a silent wrong number (principle 3);
- **P2:** the G2's flow saves keystrokes (principle 2).

A match with the G2 alone justifies nothing. Between two equal readings, the one with less code wins.

**How it was checked.** Engine results come from the dev engine (`GIAC_OUT=<main>/engine/giac/_out/gsl`):
- `MODE=raw node tools/probes/engine.ts '<input>'` for Giac alone;
- the same without `MODE` for Home, and `MODE=cas` for the CAS view;
- `node tools/probes/parse.ts '<latex>'` for our parser.

Values not printed by a probe come from the oracle or are `derived`. MathLive's own behaviour is quoted from the regression findings (F10–F23, backlog archive). It was not re-run here, since that needs Playwright. Line numbers are on `8745db1`.

**Result.** Most rows are kept:
- 36 rows kept: by P3, by P2, or because they are the engine's own result;
- 1 row widened (20, item 40; R68);
- 1 row decided and built (8, R58b; R67);
- 2 rows S14 decides (9, 10);
- 4 rows dropped, each with a package: 2a → R66 (R39's power form in Home; Function and Solve keep it, rows 2b, 2c), 4 → G45 (the half-even option), 5 and 6 → G42 rewritten (its G2-waiting parts).

R58b gets its build package (R67), and item 40 gets its own (R68).

## 1. Item 43 first: `7 mod −3`

| | Value | Code | Clause |
|---|---|---|---|
| Giac `irem` (the engine's own) | `irem(7,-3)` = 1, `irem(-7,3)` = 2, `irem(-7,-3)` = 2: Euclidean, never negative | none | — |
| The G2 | −2: the sign follows the divisor (floored; device, item 43) | — | — |
| Ours, `pasmod` | 1 (integers go to `irem`) | `homeEval.ts:133–135`, 3 lines of Giac; names `emit.ts:72`, `emit.ts:151` | P3, see below |

**Decision: keep `pasmod` as built (Euclidean).** No code changes.

**Why `pasmod` exists at all:** each of its other branches has a P3 reason. Without them:
- `irem(x,3)` is `x`, marked `=` (golden `g14f1-bmod-x-3`).
- `irem(15/2,2)` is an error: typed decimals are exact rationals, so `7.5 mod 2` falls to the float path and shows `≈ 1.5` for an exact 3/2 (G14).
- Giac's float `irem` switches convention. `irem(7.5,-2)` = −0.5 and `irem(-7.5,-2)` = −1.5 are floored, while `irem(7,-3)` = 1 is Euclidean. One function would show two sign rules, with only a `≈` to tell them apart.

**The floored option would match the G2.** It would be one Giac line, `a-b*floor(a/b)`, so as small as today. But it departs from the engine's integer `irem`, saves no press, and no wrong number backs it. Under the rule a match alone does not count.

**The device case.** G45 adds the record: `7 mod (−3)` = 1, `derived`, `g2: 43`, with the note "the G2 gives −2, the sign of the divisor; ours is Giac's irem".

## 2. The table

Layers: **E** engine helper, **P** parser or emitter, **N** entry (template or controller), **D** display, **T** test.

| # | Special case | Engine's own (probe) | Ours | Code (file:line, ≈ lines, layer) | Clause | Verdict |
|---|---|---|---|---|---|---|
| 1 | `mod`, Find's Remainder (item 43) | §1 | Euclidean | `homeEval.ts:133`, 3, E; `emit.ts:72,151`, 2, P | P3 (§1) | keep; record in G45 |
| 2a | Real odd root of a power in **Home**, R39 (P5 (b), items 4, 11) | `(-8)^(1/3)` = `(1/2+i*sqrt(3)/2)*8^(1/3)` = 1+1.73205080757·i (oracle, `cx-cbrt-neg8`) | −2 | the option at `session.svelte.ts:484`, 1, P | none. Not P3: the principal root is right and visibly complex. Not P2: ⁿ√ 3 ▶ (−) 8 is 5 presses, `( )` (−) 8 ▶ xʸ 1 ÷ 3 is 8, so the template is shorter | **drop → R66** (Home only) |
| 2b | The same in **Function** (frozen app) | the plot compiles through `emit-js.ts:40–47`; without the branch `x^{\frac{1}{3}}` is `Math.pow(x,1/3)`, NaN for every x < 0 (`derived`: IEEE `pow` of a negative base and a non-integer exponent) | the real root, both halves drawn | `emit-js.ts:40–47`, ≈ 8, P; option at `function/compile.ts:31` | P3: without it the left half of the curve disappears with no message, and Root, Intersection and Area see no curve there | keep |
| 2c | The same in **Solve** (frozen app) | `x^(1/3)=-2` has no root under the principal branch | x = −8 | option at `solve/app.svelte.ts:48`, 1, P | P3 by consistency: Solve and Function read one expression; a plot crossing −2 at x = −8 beside "no root found" for the same expression is a contradiction the user cannot resolve. Kept with 2b; both apps are frozen (decisions "Function and Solve frozen") | keep |
| 3 | ∛ and ⁿ√ templates with an odd index → `surd` (L6) | no engine reading for a radical sign | ∛(−27) = −3 (`derived`) | `emit.ts:258–262`, 3, P | the template must read as something; `surd` and `^(1/n)` cost the same, and the odd radical of a negative real is its real root (`derived`) | keep |
| 4 | Ties at the digits setting (item 8) | Giac's own printing is binary MPFR, not a decimal tie rule | half away from zero; a `half-even` option kept "for G2 item 8" that no caller sets | `format.ts:20, 37, 116–123, 146–227, 361`, ≈ 15 lines of threading, D; tests `format.test.ts:63–71, 162, 171`, T | half away stays (one rule is needed and either costs the same); the option has no clause and is a dead setting (docs/03 rule 11) | **drop the option → G45** |
| 5 | `round(-2.5)`, G42's round part (item 66) | `round(-2.5)` = −2, `round(2.5)` = 3, `round(-2.25,1)` = −2.2: half up | not built: G42 would follow the G2 | `packages/G42.md` | none: half up is a stated convention, and the display's own rule is row 4 | **drop from G42** (rewritten) |
| 6 | Quartiles, G42 (item 67) | `quartile1([1..6])` = 2.0 | not built | `packages/G42.md` | none: one of the standard conventions | **drop from G42** |
| 7 | Median of an even list, G42 (item 67) | `median([1,2,3,4])` = 2.0 | 2.5 (G42, merged 2da6710) | `homeEval.ts` `pasmedian` | P3: the median of 1, 2, 3, 4 is 2.5 by definition (`derived`) | keep in G42 |
| 8 | Alpha letter e and i as names, R58b (item 62) | Giac reads `e` as `exp(1)` and `i` as √−1: `e:=3` is refused, `solve(e^2=4,e)` gives `linsolve(exp(2)-4,exp(1))`, and `sum(i^2,i,1,3)` is an error ("i=sqrt(-1)") | letter e is `exp(1)`, letter i is √−1 | `emit.ts:78` (`e: "exp(1)"`), `emit.ts:247` (`a0 === "e"`), `emit-js.ts:15`, P | P3: CAS `2e` drew a variable and gave 5.43656365692, and `solve(e^2=4,e)` is a non-answer; P2: Σ with index i works | decided (R58b); build → **R67**, stand-ins `e_`, `i_` (§3) |
| 9 | Degrees through `u*pi/180/pasdeg` (R64f1; was `(pi/180)^angle_radian()`) | Giac's DEG flag | the ° factor | `emit.ts:316–319`, 3, P | S14 decides | S14 |
| 10 | `pasexp`, `expIgnoresAngle`, `showExp` (F29, item 54) | DEG `exp(i*90)` = i, `exp(i*pi)` = −1 | exp ignores the mode | `homeEval.ts:146–149, 218–235`, ≈ 20, E; `host.ts:446, 512` | S14 decides (P3: one mode cannot read both ways) | S14 |
| 11 | `AUDITED_FUNCTIONS` | every float would be trusted alike | ⚠ for unaudited floats | `numeric.ts:47`, 8, E | P3: `normald_icdf(10^-10)` wrong in its 7th digit with both routines agreeing (M4-5) | keep |
| 12 | `==` and `≠` by value, R18f1 | `x==2` and `sin(1)^2+cos(1)^2==1` both false, looking exact | true when the difference is exactly 0 | `emit.ts:102–113`, ≈ 12, P; `homeEval.ts:178` | P3 | keep |
| 13 | XOR as `(a or b) and not(a and b)` | Giac's xor gives 0 when a side is symbolic | stays an expression | `emit.ts:347–352`, 5, P | P3: `(x>0) xor (x<1)` is true at x = 2 | keep |
| 14 | `&` refused (item 41) | `1&2` = 3, `3&5` = 8: Giac's `&` is addition | "refused" message | `parse.ts:528, 950`, ≈ 3, P | P3: read as AND (every engineering language), 1 AND 2 is 0, not 3 | keep; item 41 changes no code |
| 15 | → is Giac's `->` (item 42) | `x->x^2` = `(x)->x^2` | the same | `emit.ts:355–359`, P | the engine's own | keep; item 42 changes no code |
| 16 | EQ cell → the value test (item 32) | Giac has no EQ | `EQ(a,b)` is `a == b` (row 12) | `parse.ts:224–228`, 2, P | G2 layout cell; the reading is row 12's | keep |
| 17 | Greek stand-ins `beta_`, `gamma_`, `Gamma_`, `epsilon_`, `Phi_`, `Psi_` | `epsilon` is 1e-12, `Gamma` cannot be stored, `Psi:=3` is refused | stand-ins, drawn as the letter | `parse.ts:196–203`, 8, P; `tidy.ts:136–145`, 8, D | P3: `epsilon` would compute 1e-12 | keep |
| 18 | `regrouped`: x·x shown x² (item 31) | `autosimplify()` = `'regroup'`, but the C-API top level leaves `x*x` | merged factors | `homeEval.ts:385–391`, 7, E; calls `homeEval.ts:540`, `host.ts:566` | the engine's own setting (`autosimplify()` reads `regroup`); the wrapper only applies it | keep |
| 19 | e^x as `exp(x)`, not `exp(1)^x` | equal readings | `exp(x)` | `emit.ts:247`, 1, P | equal readings, and `exp(…)` is what Giac prints and what `pasexp` (row 10) reads; the `"e"` half goes with R67 | keep |
| 20 | ᴇ gets a leading 1 on an empty line only (item 40) | MathLive types a bare mark; the parser refuses a bare ᴇ (`parse.ts:840`) | `1ᴇ` on an empty line | `controller.ts:349–354`, 6, N | P2: the G2 adds the 1 after an operator too, which saves the 1 in `2 × ᴇ 3` (4 presses, not 5) and ends the refusal there | **widen → R68** |
| 21 | 10ˣ after a digit → ×10ˣ (F22, R27a, item 48) | MathLive glues the digits: `5 10ˣ 2` = 510² = 260100 | 5×10² = 500 | `controller.ts:356–361`, 6, N | P3: the glued 510² reads as one number; P2: no × to press (the G2's ALOG also needs none) | keep |
| 22 | DMS takes the number before it (R27a) | MathLive's `#@` | 5, DMS, 2 ▶ 3 is 5°2′3″ | the template `#@\degree…` (Tmpl); `controller.ts:47–49, 364`, ≈ 4, N | P3: without it the typed 5 joins the degrees (52°) with no edge | keep |
| 23 | The mixed-number cell takes the number before it (item 36) | MathLive's `#@` (no code of ours) | 2, cell = 2 □/□ | template string, 0 lines | P3: the G2's reading `2(+□/□)` is a product | keep |
| 24 | ⌫ and Del keep a template whole (items 44, 46, 49, 51) | MathLive: `log log ⌫⌫⌫⌫` sticks at `log )` (F10); ⌫ after `)` removes it alone and no key types it back (F15); ⌫ in the log's base deletes the whole log (F21) | one step per press, no lost box | `entry/delete.ts:63–80` and the template rules, ≈ 500 in all, N | P2: each MathLive dead end costs a retype of the template (`log₁₆(` is 6 presses); the G2 differs on 44 and 46 (it leaves `SIN23)` and `SIN(23`) | keep |
| 25 | ⌫ at a denominator's start joins the parts (item 47) | MathLive's join (F18) | 5/23 → 5‸23 | `delete.ts:452–470`, ≈ 18, N | P2: one ⌫, the line stays editable; its `\pi x` gap keeps a control word from taking a letter (`\pix`) | keep (to verify: ron, in the next `delete.ts` package, whether MathLive's own join puts the cursor between the parts; if so the function shrinks to the gap rule) |
| 26 | The cursor never stops inside a name or before its bracket (item 50) | MathLive stops there | no stop | `stops.ts:49–58`, ≈ 10, N; parser refusal of `sin 7(2)` | P2: no dead stop per crossing; P3: a 7 typed there joins the name. The G2 stops there and gives a syntax error | keep |
| 27 | ▶ goes to the next empty box (R10, R43; item 57) | MathLive's ▶ stops on every mark (∂, d, the evaluate-at bar) | next empty box; R43 stops at the end of a box that holds a template | `stops.ts:83–104`, ≈ 20, N; `controller.ts:336` | P2: one ▶ per box. Item 57's answer matches R43 as built: ÷ ÷ 1 ▶ 2 ▶ ends at the end of the outer numerator | keep; R43 point 2 can close |
| 28 | CAS: Alpha types lower case (R58, item 45) | layer data | lower case in CAS | `Keypad.svelte:31, 124`, N | P2: a CAS `t` is 1 press, not 3 | keep |
| 29 | Store ▶ on an empty line starts `Ans ▶` (item 58) | — | not built yet: `ANS_FIRST` (`ans.ts:6–13`) has no Store key, so Shift + ᴇ types `▶` alone; R15c2 adds it (decisions "R15c Store") | `ans.ts:6–13`, +1 line, N | P2: one key fewer | keep (R15c2 builds it) |
| 30 | + − × ÷ on an empty line start with Ans | — | `Ans+` | `ans.ts:6–13` (the keys), `App.svelte:560–561` (the empty-line test), ≈ 10, N | P2: the Ans key saved | keep |
| 31 | A space between two numbers is an error (R29, R51; item 59) | our parser read a product: `2 3` = 6, `1\,000` = 0 | "put × between two numbers" | `parse.ts:677`, 1, P | P3: `1 000` = 0 with nothing on the line; the G2 gives 6, and the owner kept the error | keep |
| 32 | A second decimal point is an error (item 55) | `2.5.3` was 2.5·0.3 = 0.75 | error | `parse.ts:162`, 1, P | P3; the G2 agrees | keep |
| 33 | A digit next to a result chip is an error (F25; item 56) | 0.5 chip, then 3, gave 1.5 with no × on the line | error | `parse.ts:551–553`, 3, P | P3 | keep; item 56 changes no code |
| 34 | One-line ÷ binds like × (R30; items 6, 53) | Giac's text precedence: `6/2*(1+2)` = 9 | 9, and `1/2x` is (1/2)·x | `parse.ts:446–450`, P | the engine's own precedence | keep |
| 35 | FIX falls back to SCI (G31; item 60) | — | 4.7ᴇ-6 in Fixed 4 is 4.7000ᴇ-6 | `format.ts:175–178`, 3, D | P3: `0.0000` would hide a nonzero value | keep |
| 36 | Home and CAS share one Giac context (item 52) | one context | one context, and CAS names the stored values it used (G20) | `host.ts:2` (one Giac instance), `host.ts:430` `home()` and `host.ts:496` `cas()` on it; G20's list `host.ts:480–497`, ≈ 20, E | the engine's own, and less code; G20 is the P3 part | keep; item 52 changes no code |
| 37 | Function app: NaN at a pole (items 19, 22) | `subst(1/x,x=0)` and `subst(1/x^2,x=0)` both give the unsigned `infinity` | `NaN` | `function/app.svelte.ts:94`, 1, D | P3: an unsigned ∞ in a real table reads as +∞, and Giac never hands us a signed one here | keep (frozen app) |
| 38 | Function app: trace step 0.1 (item 24) | — | `niceStep(span/200)` = 0.1 for [−10, 10] | `function/app.svelte.ts:369–373` | no special case: the general rule gives 0.1 | keep |
| 39 | Our functions `sigfig`, `par`, `eseries` | Giac has none of them | defined on first use | `homeEval.ts:136–155`, E | not a departure: features (EN3, EN7) | keep |
| 40 | Units helpers `pasu*`, `pasdim`, `pasupm` | Giac's own units are not used (P3 decision 1) | our unit view on Giac (P15) | `dims.ts:18–27` (`pasdim*`), `evaluate.ts:30–43` (`pasuq`, `pasua`, `pasup`, `pasul`, `pasun`), `build.ts:138–140` (`pasupm`), ≈ 40, E | not a G2 copy: P15, P3 (dimension checks) | keep |
| 41 | Solve's messages (items 13, 14, 20) | — | "no root found" | `solve/app.svelte.ts:5` | P3: the G2's "Zero" with 1.46ᴇ499 for `1/x=0` is a silent wrong root | keep |
| 42 | Complex `sqrt(-4)`, `asin(2)` (items 9, 10) | 2·i, 1.5708−1.3170·i | the same | none | the engine's own (the G2 errs) | keep |

**Rows of docs/06 section 2** that are layout, with no engine result involved (Cancel, Mode on Shift + Apps, the omitted Setup, Chars, Program, Eval, Notes and User, `(−)`, Shift + x = y, DMS in Tmpl, our own look): these are P11's backbone or rule 4, and the rule does not touch them. Rows 14, 15, 21, 22, 23, 28 and 31 above are the docs/06 rows with an engine side. The & and → rows are rewritten there with their new reasons.

## 3. R58b: the form with less code

There are two forms:
- **(a) Stand-ins:** the typed letters e and i become the names `e_` and `i_`, as the Greek ones do. This takes about 5 lines: two entries where `parse.ts:196` maps names, and one rule in `render/tidy.ts`, since Giac draws `e_` as `\mathrm{e\_}` (probe `latex(e_*2)`). It also removes 3 lines: `emit.ts:78` `e: "exp(1)"`, `emit.ts:247` `|| a0 === "e"`, and `emit-js.ts:15` `e: "Math.E"`.
- **(b) The constant drawn upright:** the letter keeps Giac's meaning, and the entry draws it upright. That needs a case in the letter layer and in `hwkeys.ts` for e and i in CAS. Even then there is no variable named e or i: `sum(i^2,i,1,3)` stays an error and `solve(e^2=4,e)` a non-answer.

**(a) wins on both counts:** it is less code, and it keeps the decided rule (an Alpha letter is a name).

The keys are safe. eˣ inserts `\exponentialE^{#0}` and Shift + 2 inserts `\imaginaryI` (`spec/keyboard.yaml:178, 296`). A drawn result's `\mathrm{e}` and `\mathrm{i}` parse as the constants (`parse.ts:929–930`).

**Risk for R67 to test first:** Giac's `latex()` writes a complex result with a plain `i` (`latex(2+3*i)` is `2+3*i`). Any path that puts a result's LaTeX back on the line, rather than a chip, would turn that `i` into the variable. R67 starts with that test.

## 4. The open G2 items

Under the rule, can an answer change our code? For each item below, no.
- **41:** `&` stays refused (row 14).
- **42:** → stays Giac's `->` (row 15). Store has its own key.
- **52:** one context is the engine's own (row 36).
- **56:** the chip-and-digit error is P3 (row 33).
- **63:** S14 picks one reading of a complex argument in DEG by P3 (one input, one value). Of two readings that are equally right, the cheaper one wins.
- **64:** `cosh(90·i)` = 0, marked exact, is wrong by F29's rule. P3 decides.
- **65:** a CAS that is always in radians, or a setting, is S14's choice by P3 and code size. A G2 setting alone justifies no setting.
- **66:** Giac's `round` stays (row 5).
- **67:** the median by P3 and the quartiles by Giac (rows 6, 7).
- **68:** the unit view's angle rules are P3 (decisions "Angles in the unit view").

Each of these items gets "no code depends on the answer" in its `why` (`g2.yaml`), and the checklist is regenerated.

S14's own line in decisions.md has "would change if … G2 items 63–65 need Giac's own DEG behaviour". Under the rule, only P3 or P2 can bring that about.

## 5. The packages

| Id | What | Agent | Rests on |
|---|---|---|---|
| G45 (merged cfa6127) | One tie rule; the G2's differing Home answers (items 8, 43) as `derived` cases | gorge, Opus | rows 1, 4 |
| R66 (merged 44d30b6) | The power form keeps Giac's principal root in Home (Function and Solve keep R39) | ron, Opus | rows 2a–2c |
| R67 (merged 2388fca) | Letters e and i are names: stand-ins `e_`, `i_` (R58b) | ron, Opus | row 8 |
| [R68](../shifts/packages/R68.md) | ᴇ gets its leading 1 after an operator too (item 40) | ron, Opus | row 20 |
| G42 (merged 2da6710) | rewritten: median (and percentile) only; Giac's round and quartiles stay | gorge | rows 5–7 |

## 6. Top risks

1. **R66 changes a result the owner chose on 2026-10-14:** `(−8)^(1/3)` in Home becomes 1+1.73205080757·i. The ⁿ√ template keeps −2. Function and Solve keep the real root (rows 2b, 2c), so the same power reads differently in Home and in the frozen apps; that is named in R66's docs step. If the owner misses the power form, the rule's "would change if" (muscle memory, docs/03 rule 8) is the way back.
2. **R67 can reach old data.** It needs the result-LaTeX test (§3). Old CAS history lines whose letter e meant Euler's number read as the variable after the change.
3. **MathLive behaviour is quoted, not re-run** (rows 24–27). The verify note in row 25 is the one open check.
