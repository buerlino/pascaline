<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# S14: the angle-mode spike (sandra, 2026-10-19)

Package S14, pipeline run 55, branch `p1/sandra-radspike` from `phase-1` `83474da`. The evidence is in [research/r14-angle-mode.md](../../research/r14-angle-mode.md) (R14), and the probe is `tools/probes/angle-matrix.ts`.

## Recommendation: route R
Run Giac in radians in every mode, and keep the degree mode in our text (`pasdeg`). R64 and then G46 build it, with the changes to their texts below, and G21b is dropped. In DEG the CAS view shows the result as the mode reads it (option 2): `diff(sin(x),x)` → `pi/180*cos(x)`, `∫1/(1+x²)` → `pi/180*atan(x)`, `desolve(y''+y=0)` → `c_0*cos(180*x/pi)+c_1*sin(180*x/pi)`. The owner's yes is the OPEN entry "S14" in decisions.md.

## Verified (probe runs on the dev engine, desktop)
- **Matrix, 52 rows** (D4–D8, D12, findings 1–4, sequences across modes, controls, units). Today: 18 right, 32 wrong, 2 errors. Route R's prototype: 52 right (R14 §2).
- **Golden inputs, 536** (home, precision, bench, solve, function, units), today against the rewrite: 3 changed. All three are the kept text of an open `==` test (`prec-eq-closed-open`, `prec-eq-cas-closed-open`, `prec-ne-closed-open`), which shows the factor, `cos(1*pi/7)`. The cause is `emit.ts:104`, and R64 fixes it (R14 §3).
- **Display:** three options with examples. Option 2 costs 0.1–0.6 ms per DEG CAS result (R14 §4).
- **Enter time** (host-cpu lock, median of 7 for each of 176 inputs). RAD p95 2.28 → 2.34 ms. DEG p95 2.41 → 3.71 ms, set by `sin(0.1)^2+cos(0.1)^2` (R14 §8).
- **The unit view:** the 119 cases are unchanged with the new `pasua`, and `asin(1/2)·2 m` stays 60 m in DEG, 1.0471975512 m in RAD (R14 §6).
- **Docs fixed:** the deep check counts 5 unit cases in DEG, but there are 4. The fifth match is the comment on line 11 of `units.yaml`. The number is corrected in R14; the deep check itself was left as written, since it is a record.

## Changed files
`tools/probes/angle-matrix.ts`, `tools/probes/angle-matrix-oracle.py`, `tools/probes/README.md` (a row), `docs/research/r14-angle-mode.md`, `docs/decisions.md` (the OPEN entry), `docs/backlog.md` (S14 ticked, line 1 and the deep-check line), and this report. Nothing under `app/`.

## Still to verify
- **Angle commands beyond the trig set:** R64 lists every command in the Find index that takes or returns an angle (`atan2`, `polar`, `rotation`, …) and runs each through the rewrite.
- **The migration by preview** (R14 §7): G46 tests it on v2 logs made from the matrix's F1 and F2 sequences.
- **The DEG Enter p95 on the Tab One:** annabell measures it after G46.

## Top risks
1. A Giac command that builds an angle the rewrite never sees. Mitigation: R64's audit, and G46's golden cases from the matrix.
2. The display rule rewrites every trig of a result, so desolve's `cos(x)` shows as `cos(180*x/pi)`. That is correct but surprising.
3. A DEG value stored before G34 whose preview matches neither reading. It is listed, not guessed.

## Text for shared files (the next Opus pass, or the owner)

**docs/04, a new section 2.12** (after 2.11):

> ### 2.12 Decision: the angle mode (S14, route R)
> Giac runs with `angle_radian:=1` in every view and mode, and the degree mode lives in the text our parser emits:
> - each angle function the user types takes its argument times `pasdeg` (`sin(pasdeg*(u))`);
> - each inverse, and `arg`, returns its result over it (`asin(u)/pasdeg`);
> - the polar entry's angle carries it, and the ° template is `u*pi/180`;
> - the host sets `pasdeg` to π/180 in DEG and 1 in RAD when the mode changes, and `pasdeg` is a reserved name.
>
> Every Giac path (exp, the hyperbolics, complex trig, inverse trig, integration, desolve, laplace, limit, series, complex powers) therefore sees radians. A stored value is angle-free text. A typed or library function keeps `pasdeg` in its body, so it follows the mode at call time. A chip carries Giac's radian text, which means the same thing in both modes. The plot multiplies by the same factor (R64a). In DEG the CAS view shows its result as the mode reads it: Giac evaluates the text with each `trig(u)` taken as trig of u·180/π and each inverse as π/180 times the inverse, so `diff(sin(x),x)` shows `pi/180*cos(x)`. Ans and chips keep the radian text. Previews, Vars and the library export drop the factor, and a library import puts it in. Evidence: `research/r14-angle-mode.md` (as a link from docs/04).

**docs/README.md**, in the research-notes line, after r13: `[research/r14-angle-mode.md](research/r14-angle-mode.md) (the angle mode: Giac in radians)`.

**R64.md**, point 1, add after "…use the same emitter.":
> The open `==` test keeps the sides without the factor (`emit.ts:104`; the three `prec-e*-closed-open` cases). The rewrite is also exported as a function on Giac text (S14's `rewriteAngles`), for the library import and G46's migration. `pasdeg` is a reserved name: the parser refuses it as a user name, and `library.ts:198` refuses it too. Audit: every command in the Find index that takes or returns an angle is either rewritten or listed with the reason it needs nothing.

**R64.md**, "Done when", replace "(only the parser stage's formula texts change, listed in the report)" with "(only the parser stage's formula texts change, listed in the report; S14's `--golden` shows no other change)".

**G46.md**:
- Point 2, replace "The CAS view's DEG display as S14's report decides (if it needs a renderer change, the report names the ron package that follows)." with:
  > In DEG the CAS view shows its result rewritten into degrees (S14's option 2, `backInDegrees`), engine-side in `casRunRaw` for the text and the LaTeX; `pcasans`, Ans and chips keep the radian text; no ron package follows. `pasua` takes an angle in radians and a bare number times pasdeg (S14's `PASUA_R`). The Vars preview drops the factor. The library export writes bodies without it, the import puts it in, and `// test:` lines run with `pasdeg:=1`.
- Point 3, replace "older entries without a recorded mode are kept and listed in the report" with "older entries follow R14 section 7: functions and kept inputs get the factor; a value with an angle function is read both ways and keeps the reading that matches its preview; one that matches neither is kept and listed".
- "Done when", replace "Enter p95 of the bench stage within 5 % of before" with "Enter p95 of the bench stage within 5 % of before in RAD; in DEG reported (S14: +1.3 ms on the desktop) and measured on the Tab One by annabell".

**decisions.md**, when the owner says yes: the S14 entry moves to "Decided proposals", and G21b's entry gets "superseded by route R (S14)".
