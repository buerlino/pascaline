<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Consolidation of the 2026-10-19 research into the docs (sandra, 2026-10-20)

**Base: `da7a59c6531374d482b8fb142943c030b4944d68`** (the newest night report, `docs/shifts/2026-10-20-night-report.md`). The worktree's HEAD `36c94d3` adds only `docs/research/pending-updates-2026-10-19.md`, so the code is the base's. Every finding below was rerun on it with the engine `engine/giac/_out/gsl` (build of 2026-10-19 11:43), the build the reports used.

**Inputs:** `docs/research/pending-updates-2026-10-19.md`, [r16-verification.md](../research/r16-verification.md), [bug-patterns.md](../research/bug-patterns.md), [bug-hunt-2026-10-19.md](../research/bug-hunt-2026-10-19.md), [multi-engine-risk.md](../research/multi-engine-risk.md), [multi-engine-answer.md](../research/multi-engine-answer.md), the night report and `git log fab0ae7..da7a59c`.

**How I reran:** the scratch directory `tools/probes/_out/2026-10-19/` does not exist (the reports' scripts lived in their sessions' scratchpads). I rebuilt them from the reports' rerun sections: bug-hunt section 7's `seq.ts` unchanged (one `EngineHost`, Home and CAS sharing Giac), a host-API script for N3, N5, N6, N9, N10 and N2 following the same section's recipes, `tools/probes/engine.ts` (`MODE=raw` for raw Giac), `tools/probes/parse.ts` for the Giac text the keys produce, and `tools/probes/unit-result.ts`. Hangs ran under `timeout 20`. Oracle values come from mpmath 1.3.0 in `tests/golden/.venv` at 40–300 digits. Since route R (G46), DEG rows must go through the parser's text (`acos(2)/pasdeg`): raw `acos(2)` in DEG is now the radian value by design. My scripts were not added to the repo; G61 and G62 rebuild them.

## (a) Master findings

New bugs take backlog ids F44–F59 (F43 was the last; checked in `docs/`, `docs/shifts/packages/`, `.coord/log.md`, `.tasks/` and `git grep` on all branches). r16's F1–F9 collided with feedback ids and are only aliases now. The "home" column names where the fact now lives. "Today" means a key sequence reaches it on `phase-1`.

### From r16 (oracle sweep) and the bug hunt

| Id | Aliases | Status on the base, and how checked | Home |
|---|---|---|---|
| F44 | r16-F1(a) | **open.** RAD `exp(1.5e8)`, `sqrt(exp(2e8))`, `3+exp(1.5e8)/asin(3)`, `acos(factorial(5)^(2.5+factorial(5)))` killed at 20 s (12 and 30 digits); `exp(10^7)` 2.3 s, `factorial(10^6)` 3.9 s. Raw `evalf(exp(1.5e8))` answers `infinity` in 0.3 s, so the time is ours (`confirmedDigits`, `fromScaled`: `format.ts:470`, `:459`). | backlog F44 |
| — | r16-F1(b) | **fixed by G46 (`2bee0fc`).** DEG `acos(10^400)/pasdeg` (the parser's text) = `≈ 52811.0775273i` in 0.1 s; mpmath 52811.07752734627463i. | — |
| F45 | r16-F2; upstream draft G4 | **open.** `sqrt(sqrt(asin(12)))` = `≈ -1.31937971748-0.37637063348*i` at 12 and 30 digits; mpmath 1.3193797174835927289…−0.3763706334802930673…i. | backlog F45; upstream line |
| F46 | r16-F3; draft G3 | **changed (worse).** 12 digits as before (`≈ 1.06987032752-0.000907172853153*i`). At 30 digits it is now `≈` with 38 digits "confirmed" (r16: `⚠ 13`). mpmath 1.0696631688083177879…−0.0210723980675765491…i. | backlog F46 |
| F47 | r16-F4, F5, F6; draft G9 | **open.** F4: `log10(asinh(asin(exp(1))))` at 30 = `≈ 0.230738949730667108…`, mpmath 0.2307389497306726832…; plain `asinh(asin(exp(1)))` is already wrong from the 14th digit under `≈`. F5: all five rows `⚠ 14`, e.g. `-0.18062566019941`, mpmath −0.18062566019942709… (13 right). F6: `⚠ 13 4.708077403366E-15+0.873434670974*i`, mpmath real part 0. | backlog F47 |
| F48 | N7; draft G8 | **open, exact.** `round(sin(10^50),5)` = `≈ 0.59587` (Home and CAS); `trunc(sin(10^50)*10^12,0)` = `= 595872309788`; 30 digits: `round(2/3,20)` = `≈ 0.6666666666666666667`, `round(10^17+1/3,2)` = `≈ 100000000000000000`. Raw Giac at Digits 60 the same. mpmath: sin(10^50) = −0.789672493429. | backlog F48 |
| F49 | N8 | **open, exact.** `trunc(sin(10^70)*10^12)` = `= 387557674394`, `Heaviside(sin(10^70))` = `= 1`; `floor` and `sign` right. mpmath: trunc −148099131371. | backlog F49 |
| F50 | r16-F7; draft G6 (`acos(pi)`) | **open; one row changed form.** `asin(acos(pi*pi))`, `exp(cosh(asin(pi)))`, `(asin(pi)^exp(10))*2.5`, `sinh((6.02e3)^3)` show Giac's text; `sqrt(asinh(asin(3.7)))` is now an error row (`float-timeout`, error `engine`, display `undef`). mpmath: 1.8121125676227577i; −0.3388825210379914−0.4329303521893950i; 1.3123416499512430−0.3283862753320118i. | backlog F50 |
| F51 | r16-F8 | **open.** `sqrt(5)/asinh(10)/(sin(factorial(5))*(3/0))`, `exp(ln(0*2))`, `1/(1/0)`, `exp(ln(0))` = `= 0`, in RAD and DEG. Needs your decision (c4). | backlog F51 |
| — | r16-F9 | **fixed by G46.** Through the parser's text in DEG: −2.24084737193, 0.0082238934497, 4.68085476074 (real), 0.0859540600796i, all equal to mpmath at 12 and 30 digits. | — |
| F52 | N1, N2; multi-engine Part II proposal 4; H1 | **open; N2 now verified.** CAS `approx_mode:=1` logs `approx_mode:=(1)`; then CAS `1/3` = `≈ 0.333333333333`, Home `1/4`, `0.1+0.2`, `2^70` lose `=`; CAS `approx_mode:=0` logs `:=(1)` again; Home `approx_mode:=0` logs `:=(1)` with ⚠ facts; `cas_setup(1,…)` the same, unlogged. N2: a library *body* assigning `approx_mode` is refused, but a top-level `approx_mode:=1` line imports and Home `1/4` then has `exactRational: false`; `STATE_WORDS` (`library.ts:23`) lacks `approx_mode`, `epsilon`, `complex_variables`. | backlog F52 |
| F53 | N3 | **open, exact.** `host.solve` with x = the display `1.41421356237`: y = `1.99999999999`, 29 digits; with `result.full`: `2`. Second case 3.56237 against 3.56237309505. App side: `apps/solve/app.svelte.ts:276`, `:279`, `:312`. | backlog F53 |
| F54 | N4 | **changed.** G44 made `normald_icdf` audited, so N4's stored x is now `≈` and `sum(x^2,x,1,10)` shows `≈ 385` (still wrong: `= 385`). With an unaudited stored x (`x:=BesselJ(1,2)`): `sum` = `⚠ 385` and `int(x^2,x,0,1)` = `⚠ 0.333333333333`, both "inherited: x", as N4 reported; `diff(x^3,x)` keeps ⚠, which is right. `inherited()` at `host.ts:452`. | backlog F54 |
| F55 | N5 | **open, exact.** Session text: `sqrt(2) ⚠ 39 …`, `pi ⚠ 39 …`, `ln(2) ⚠ 38 …`, screen `≈`; `1/3` right. `copyMark` at `clipboard/text.ts:118`. | backlog F55 |
| F56 | N6 | **open, exact.** Area of `ln(x)` [0,1], `x*ln(x)` [0,2], `(1-cos(x))/x^2` [−1,1]: "the integral does not converge (undef)"; Home −1, 0.38629436112, 0.972770752471. `analysis.ts:161`. | backlog F56 |
| F57 | N9 | **open, exact.** The N9 file imports; `bump(1)`, `bump(sin(1))`, `bump(floor(sqrt(2)))` leave cnt 2, 4, 6, no defs. | backlog F57 |
| F58 | N10 | **open, exact.** Log after `x:=y:=3`, `purge(x)`, `purge(y)`: one "other" entry `x:=y:=3`; a fresh host after `restore(log)` gives x = 3, y = 3. `defs.ts:73`. | backlog F58 |
| F59 | new (this recheck) | **open.** A decision over a value with no MPFR path is an engine error: Home `round(BesselJ(1,2)*10^12)`, `floor(BesselJ(1,2)*10^12)`, `round(BesselJ(1,2))`, `sign(BesselJ(1,2)-0.5)`, `max(BesselJ(1,2),0.1)`, `BesselJ(1,2)>0.5` give `GIAC_ERROR … Bad Argument Value` (path `float-error`). `BesselJ(1,2)*10^12` alone is `⚠ 576724807757`; `round` of a `romberg` or `normald_icdf` value works. Likely G38's second decision at P + 20, where BesselJ has no value (r6 section 5); cause not traced (to verify). Reach: after R4a (`BesselJ`, `Airy_Ai` tier 1; `floor` tier 0). | backlog F59 |

### bug-patterns.md rows marked open (rows not above)

| Row | Status on the base, and how checked | Home |
|---|---|---|
| fam. 1, n19 2.2 (G48): `[q1,q2]:=`, `q5,q6:=`, `F=>pE`, `sto(F,pS)` | **changed:** each is now `⚠` without a count (`decided: true`), so the mark no longer lies; the stored value is Giac's guess 899450126402 (mpmath at 300 digits: −372376123662). `pA:=F` is refused `undecided` (G57), so the `unapply` row has nothing to carry. | decisions.md "2026-10-19 G57" (yours) |
| fam. 1, G51: CAS name with facts, no float | **fixed by G51 (`25b65e3`):** after `F=>pE`, CAS `pE`, `pE+1`, `pg(0)` show `⚠`, "inherited". | — |
| fam. 1 and 4, n19 2.7 (G56) | **open:** CAS `evalf(g(i))` = `⚠` (0 digits) `0.9*i`, why names `g`; Home `g(i)` = `≈ 3.11481544931*i` (right). | brief G56, held until H3 |
| fam. 2, chk 3, chk 4, D4, D5, D6, D7, D12 | **fixed by G46:** `integrate(exp(i*x),x,0,90)` and `gr(90)` give the same value in RAD and DEG; DEG `cosh(90*i)` = `≈ -0.448073616129` in both modes; DEG `cos(pasdeg*(30+i))` Home = CAS = mpmath to 30 digits; DEG `acos(2)/pasdeg` = `≈ 75.4561292902i`, no real part; CAS DEG `int(1/(1+x^2),x)` = `1/180*pi*atan(x)` (docs/04 2.12's reading); DEG `(-8)^0.2` = the RAD value (R66). | — |
| fam. 2 and 9, chk 7 (`pasexp` in exports) | **fixed by G46:** `pasexp` appears only in `engine/angleMigration.ts`. | — |
| fam. 9, r14 §5 (`pasdeg:=5`) | **fixed where reachable:** keys cannot spell it (`parse.ts` gives `p*a*s*d*e_*g`), a library refuses it ("one of Pascaline's own names"). Raw engine text still accepts it, which no user path sends. | — |
| fam. 9, r14 §3 (`==` text with the factor) | **fixed by R64:** `precision.yaml:163` pins the text without `pasdeg`; the engine path refuses the tie as `undecided` in both modes. | — |
| fam. 3, n19 2.8 | **fixed by G57:** `undecided`. | — |
| fam. 4, §2.3 #2 value | **fixed by G44:** `normald_icdf(10^-10)` = `≈ -6.36134090240405620469537582827` at 30; mpmath −6.3613409024040562046953758283. | — |
| fam. 5 and 8, n19 2.5 (G54) | **fixed by G54:** a library `md(l):=median(l)` imports as `pasmedian`, `md([1,2,3,4])` = 2.5; `irem` as `pasmod`. | — |
| fam. 8, chk 16 (library test lines) | **fixed by G54:** `// test: median([1,2,3,4]) == 2.5` passes, `== 2` fails. | — |
| fam. 5, E7 `round(-2.5)` | **decided (G45):** `= -2`, Giac's half up, one tie rule. | decisions.md |
| fam. 5, E7 `stddev`/`stddevp` names | open by package; not probed. | R4a's Find titles |
| fam. 6, G47 | **fixed by G47, G47f1 (`f41aa12`):** `round(12.345,2)` = `≈ 12.35`, `trunc(2.567,2)` = `⚠ 2.56`. | — |
| fam. 6, `tieRisk` unread | **still dead:** set at `homeEval.ts:500`, copied by nobody (`calc/engine.ts:46`). | docs/04 2.4 item 4 |
| fam. 6, plot `x/x` hole | by design (r16 2.3). | — |
| fam. 7, R67, R68, R56b | merged (`2388fca`, `52ee875`, `0773b64`); not reprobed, covered by the pass 42 gates. R57 open. | brief |
| fam. 9, E8 `30° × 2 m` | **fixed by G40:** `tools/probes/unit-result.ts '30*{deg}*2*{m}'` = `= 60 °·m`. | — |
| fam. 10, F39; fam. 11, F41, K1 ×2 | open; not reproducible from a probe. | backlog |
| fam. 11, undo during a running job (R16) | (to verify): needs the app; not run. | — |
| fam. 12, chk 12, E3, E4, E5 | merged as G37, G40, G41 with their golden cases; E3–E5 not reprobed. chk 17 (34 units Find lists and the unit view refuses) open, not reprobed. | R4a, R24d |
| fam. 13 | A12, G33, A16 (DEG Enter p95 150.4 ms), R12c, R41, CSS size: open, unchanged. | backlog, decisions.md |
| fam. 14 | G57's "promote mark-only rows": (to verify; G57's merge message does not say). G61, G63, A19: proposed below. A15's tests, the command-not-found failure: open in the backlog. | backlog, (b) |
| fam. 15 | C4, A18 open; fix chains: decision c9. | backlog, (c) |

### multi-engine-answer.md section 7, rerun on the base
- `cas_setup()` before and after `approx_mode:=1`, `Digits:=20`, `epsilon:=1e-9`: `[0,0,0,1,0,[1e-12,1e-15],12,…]`, then `[1,0,0,1,0,[1e-09,1e-15],20,…]`. **Same.**
- `VARS()` before and after the five assignments: `[pasdeg]`, then `[all_trig_sol,beam,f,pasdeg]`. **Same.**
- The flags evaluated alone: `0`, `1e-12`, `'complex_mode'`, `12`, `1`, `all_trig_sol`, `-2`, `foo`. **Same.**
- `evalf(tanh(1+i))` at Digits 30: `0.868014142895924948…-0.217621561854402681…*i`; at 12: `1.08392332734+0.27175258532*i`; mpmath 1.08392332733869454…+0.27175258531951172…i. The cause line is `giac-2.1.0/src/usual.cc:2673`, `return (g+1)/(g-1);`. **Same.**
- `lname(sum(x^2,x,1,10)*B)` = `[B]`, `lname(quote(f(x):=x*B+2))` = `[x,B,f]`. **Same.**
- **Counts, updated:** `master..da7a59c` has 645 non-merge commits (259 docs, 144 fix, 100 test, 64 report, 59 feat, 3 refactor); the 100 that touch `app/src/engine` are 56 fix, 22 test, 16 feat, 3 perf. Lines: `numeric.ts` 1,312, `host.ts` 991, `homeEval.ts` 771 (3,074; the answer had 2,948 on `fab0ae7`), `parse.ts` 1,219, `App.svelte` 893. The port (`calc/engine.ts:46`) still drops `why`, `uncDigits` and `tieRisk`. The Find index has 546 qalc-derived items (441 units, 71 constants, 34 prefixes), 29.2 kB as JSON. Nine of the 14 text splitters were seen at or next to their cited lines (`host.ts:201` `matching`, `:211` `splitTop`, `numeric.ts:155`, `:173`, `homeEval.ts:442`, `degrees.ts:23`, `render/home.ts:46`, `library.ts:55`, `host.ts:147`); the other five moved (to verify before H2b).
- Not rerun: the qalc release build time (7.5–8 min, docs/04 7.1, a container build).

## (b) Package hand-off list (proposals, not in the brief)

Ids are proposals, free on 2026-10-20 everywhere I could look. **Tests first for every bug:** each fix package starts with the failing cases named here, failing on `da7a59c` (CLAUDE.md: every bug fixed gets a regression test first), with oracle values from `tests/golden/.venv`. Suggested order by importance, then dependencies: silent wrong numbers and freezes first, the hardening tools after them, then structure.

| # | Proposed id | What | Fixes | Source (merged duplicates) | Agent, lane | After | Tests first |
|---|---|---|---|---|---|---|---|
| 1 | **G58** | Home never hangs: `confirmedDigits` and `fromScaled` on (m, e) without expanding 10^e; a deadline for Home's JS steps that falls back or refuses | F44 | r16 G58 (its DEG case is fixed: dropped) | gorge, Opus, night | now | `exp(1.5ᴇ8)`, `√(e^(2ᴇ8))`, `factorial(10^6)` within budget |
| 2 | **G67** | Giac's flags: the host reads `cas_setup()` after each user input and restores it, the log never stores a flag name, the library guard lists every flag, Find marks `cas_setup`, `restart`, `purge`, `assume` | F52 | N1, N2, Part II proposal 4, H1; with S13/G65 (`VARS()` keeps flags out, probe above) | gorge, Opus, night | before R4a | N1's sequences as golden sequence cases; a library top-level `approx_mode:=1` refused |
| 3 | **G75** | Patch `usual.cc:2673` `(g+1)/(g-1)` → `(g-1)/(g+1)`; `pastanh` leaves `COMPLEX_DEFINITIONS`; measure whether `asin`, `acos`, `atan`, `acosh`, `asinh` can be patched as simply | complex tanh (G50's cause); G56's case | H3; E3 (Parisse takes the line); G56 held for it (brief step 37) | gorge, Opus, night; annabell for the release build | now | `tanh(i)`, `tanh(1+i)`, a stored complex `tanh` at 12, 30, 50 digits |
| 4 | **G59** | The exact path checked against Giac's plain `evalf`; a complex value read by `evalf` first and split after; after your word (c4), a value through ±infinity refused | F45, F46, F51 | r16 G59 (no F9 row left) | gorge, Opus, night | G58 (same files) | F45, F46 at 12 and 30 digits; F51's four inputs |
| 5 | **G71** | The tier-1 functions that decide or drop to a double: `trunc`, `Heaviside` join the decision functions; two-argument `round` leaves the audited list now; a census of tier-1 decision functions on `sin(10^70)`; a decision over a no-MPFR value decided at the double, with ⚠ | F48, F49, F59 | N7, N8 (bug hunt bundled N1 here; N1 went to G67); `pasround` vs a patch: c2 | gorge, Opus, night | before R4a | N7, N8 rows; F59's six inputs |
| 6 | **G68** | Solve's knowns carry every confirmed digit and their facts; `solve.ts` caps by them | F53 | N3 | gorge, Sonnet, night | now | `y=x²` → 2; 3.56237309505 |
| 7 | **G69** | `inherited()` takes names from the masked text (Home's variant keeps `diff`) | F54 | N4 | gorge, Sonnet, night | now | with an unaudited stored x (N4's `normald_icdf` is audited now): `sum` `= 385`, `int` `≈`, `diff` keeps ⚠ |
| 8 | **G70** | Function Area: on `undef`, the exact `int()` and Home's refusals, then Gauss with ⚠ | F56 | N6 | gorge, Sonnet, night | now | the four rows of N6 |
| 9 | **R69** | Copy session writes the screen's mark (`markOf`) | F55 | N5 | ron, Sonnet, night | now | engine-made √2, π, ln 2 give `≈` |
| 10 | **G72** | `definitionStores`, `isStateful`, `STATE_WORDS` know `++`, `--`, `+=`, `-=`, `increment`, `decrement`, `DelVar` | F57 | N9 (G54 merged without it); H2 would subsume the regexes later | gorge, Sonnet, night | before R59 | N9's file refused; a stored increment runs once per Enter |
| 11 | — (into **G65**) | A purge drops "other" entries that set the purged name, or `VARS()` makes "other" go | F58 | N10 | gorge (G65's agent) | G65 | N10's relaunch sequence, as a seventh form in G65's tests (needs your OK to amend G65) |
| 12 | **G60** | Doubles inside MPFR results: whatever G75 cannot patch joins `COMPLEX_DEFINITIONS` or leaves the audited list; a double's count from a perturbation, not `shortDigits` | F47 | r16 G60 vs H3: c2 | gorge, Opus, night | G75 | F4–F6 at 30 digits |
| 13 | **G61** | The oracle sweep as a gate stage (fixed seed, ≈ 2,000 inputs, < 60 s) and a nightly run; host in a worker thread with a deadline; adaptive oracle precision | (finds) | r16 G61 | gorge, Sonnet, night | G58 | — |
| 14 | **G62** | Sequences and state (carrier × fact, bound variables, Solve roots as knowns) | (finds F53, F54-like) | r16 G62; Part II proposal 4's test half | gorge, Sonnet, night | G61 | — |
| 15 | **G63** | One value in Home, CAS `evalf`, Num, Plot, Solve, Area and Slope | (finds F56-like) | r16 G63; Part II proposal 3; bug hunt 5's suspect (Slope and Area claim every digit) | gorge, Sonnet, night | G61 | — |
| 16 | **G64** | CAS answers checked back on Giac's `check/`, G55's corpus, generated inputs | — | r16 G64 | gorge, Sonnet, night | G55 (merged) | — |
| 17 | **A19** | Giac's `check/` suite as an engine-gate stage, emsdk and release builds | — | r16 A19 | annabell, Sonnet, night | — | — |
| 18 | **S16** | The hardening pass: 13–17 at volume, triage into fix packages | — | r16 S16 | sofia, Opus, the night's pass | 13–17 | — |
| 19 | **A20** | Golden Home and precision stages in the WebView on the Tab One | — | r16 A20 | annabell, Sonnet, day (tablet) | — | — |
| 20 | **G76** | The port carries every fact, compiler-checked | (drops `why`, `uncDigits`) | H4 | gorge, Sonnet | before R36, R40 | a new `HomeResult` field fails to compile until mapped |
| 21 | **G73**, **G74** | One reader of Giac text (`giacText.ts`), property-tested against Giac's own parse; then the callers move | (families 1, 2, 8, 9) | H2a, H2b | gorge, Opus | G67; before R59, R4a | the property test |
| 22 | **S17** | A register of our Giac workarounds in `engine/giac/patches/README.md`, each with a canary test | — | H5; Part II proposal 1; the backlog's upstream line | sandra or gorge | before the forum posts | the canaries |
| 23 | **G77** | A versioned Giac pin: Parisse's `giac_2.1.0-1.tar.gz` (SHA-256 `cdec2989…`, from its `.dsc`), our mirror as fallback | — | pending C3; E2 | gorge, Opus; annabell for the release build | G75 (its patch must apply) | golden gate, `compare-engines.ts` against today's build, the interrupt test |
| 24 | **A21** | libqalculate out of the build: `find/factors.yaml` checked in, a dev-only refresh tool | — | H6; Part II proposal 2 | annabell and gorge | your yes (c6) | the index unchanged byte for byte |
| 25 | **A22**, **S18** | A line budget per source file in docs-check; the research-note lifecycle | — | H7 | annabell; sandra | your yes (c7, c8) | — |

**Conflicts:**
- **G60 against G75 (H3), and N7's `pasround`:** r16 and the bug hunt fix in TypeScript, H3 at the cause in Giac's source. Decision c2.
- **Patch number 0003:** G66's package says "engine patch 0003" (a store counter), and the upstream drafts' status block promises the tanh fix to Parisse "as patch 0003". Decision c3.
- **Cost per Enter:** G67 (+1 Giac call), S13/G65 (+1), G59 (+1 `evalf`), against A16's DEG p95 of 150.4 ms (bar 150) and G53's open 1.35×. Each measures against `calls-baseline.yaml`. Whether one call can read `cas_setup()` and `VARS()` together: to verify in G67.
- **libqalculate's fixes (pending F):** no package. The overrides for `unit:hp`, `unit:mmHg` and `unit:inHg` go when we pin a release after 5.13.1: their checks then fail by design (`tools/find-index/generate.mjs:563`). The 10 constants of #1045 go only if a new release stores values equal to CODATA's at 40 digits (`:646`). Recorded in `find/units.yaml`'s notes and the backlog's upstream line.

**Proposed reviewer checklist for brief §8a** (rules are yours; from bug-patterns.md's "question to ask of new code", the families with the most rows first). The audit asks of a diff, for each family it touches:
1. A value that leaves the line (store, Ans, chip, function body, log, copy, export): does it keep its mark, digits, σ and angle? (family 1)
2. Global state: does the text mean the same under every setting and after a relaunch, and is every Giac flag the input could set restored? (2)
3. A sign, floor, comparison or branch: does it rest on a float, and is the function on the decision list? (3)
4. Two evaluations: can both precisions take the same wrong path or reuse the same double? (4)
5. What does the code do when Giac returns no number, two, an error or text? (5)
6. Our numeric code at a huge exponent, a tie, zero confirmed digits: is every loop and BigInt bounded? (6)
7. Entry: a product, grouping or sign the drawing does not show; a new template in the ⌫, Del, ▶ and tap grids? (7, 10)
8. A rule written twice (app and test runner, index and evaluator, parser and Giac text): where is the other copy, and does a test compare them? (8)
9. Can a user see, type, export or overwrite one of our names? (9)
10. Which generator would have found the bug this package fixes, and was it extended? (14)

## (c) Decisions for you

1. **Keep G56 on hold until G75 (H3) has run** (multi-engine-answer 6.0; brief step 37 already says "after H3 (owner hold)"). **Recommend: yes.** The patch fixes G56's own probe case in Giac; G56 would add a third layer of glue for a one-line bug.
2. **Patch at the cause or work around in TypeScript (G75/H3 against G60 and N7's `pasround`).** **Recommend: G75 first, for `tanh` now; it measures whether the inverse functions can be patched as simply; G60 and G71 then cover only what a patch cannot, each with a written reason.** Reasons: `tanh` is one line in `usual.cc:2673` and Parisse offered to take it (E3); 282 net lines of glue exist around it (multi-engine-answer 3.3). The inverse functions and two-argument `round` have no MPFR path at all, so their patch is not one line (to verify in G75); until then the silent lie goes cheaply: two-argument `round` off the audited list (G71). If Parisse ships the fix, the patch lasts only until the next pin (G77), and S17's canaries say which glue dies with it.
3. **Who gets patch number 0003.** **Recommend: the tanh fix (G75); G66's text becomes "the next free patch number".** It is already promised to Parisse as 0003 in the drafts, and G66 waits on S13 and G65 anyway.
4. **F51, a number through a division by zero:** refuse, or keep Giac's extended reals. **Recommend: refuse** (`1/(1/0)` = `= 0` is a number for something that does not exist, which docs/04 2.4 already refuses for principal values), and add the G2 question "what Home shows for 1/(1/0)" to `g2.yaml`.
5. **F50, an overflow and a lost answer:** **recommend a refusal with the reason ("overflow", or "no value found") instead of Giac's text,** and a G2 question for what the G2 shows on an overflow.
6. **H6 (A21), libqalculate out of the build.** **Recommend: yes.** Its 7.5–8 min build (docs/04 7.1) yields 546 rows, 29.2 kB, that G13 already audits and 16 of which we override; upstream fixes reach us only through a re-pin anyway (pending F). Ask F-Droid about checked-in derived data first.
7. **H7's budgets.** **Recommend: the research cap (150 kB of live notes) and the note lifecycle now; the 800-line file budget as a reported warning until G73/G74 split the files.** Four files are over 800 today (`numeric.ts` 1,312, `parse.ts` 1,219, `host.ts` 991, `App.svelte` 893), so a hard fail would block every package that touches them.
8. **H3's rule for CLAUDE.md and CONTRIBUTING.md** (your files): "a wrong value whose cause is local in Giac's source gets a patch, a canary and an upstream report; a TypeScript workaround needs a written reason in its package report". **Recommend: yes,** as the reading of CLAUDE.md's "fix Giac bugs upstream; keep local patches minimal".
9. **H7's consolidation rule for fix chains** (brief §0c): at a family's second follow-up, the next package removes the shared cause. **Recommend: yes.** G49 needed four follow-ups, G38 two, G50 one.
10. **The reviewer checklist** in (b) for brief §8a. **Recommend: adopt it as written;** it adds no step, only questions the audit already has the diff for.
11. **Ids.** **Recommend: accept (b)'s ids** (G58–G64, A19, A20, S16 keep r16's; H1 → G67, H2 → G73/G74, H3 → G75, H4 → G76, H5 → S17, H6 → A21, H7 → A22/S18, the pin → G77, the bug-hunt fixes → G68–G72, R69).
12. **G77, the versioned Giac pin (pending C3).** **Recommend: yes, after G75.** The upstream fallback can no longer match our pin (re-published 2026-10-15, `46d57345…`), so only our mirror works today; Parisse says the numbered archives never change. The new snapshot differs in 46 files under `src/`, near patch 0002, so it needs the golden gate, `compare-engines.ts` and the interrupt test.
13. **The reply to Parisse** (`../outreach/email-parisse-2.md`, v1, unsent; E3, E4). **Recommend: send it after decisions 2 and 3,** so it promises the right patch and number; switch to English as he offered.
14. **KhiCAS for Linux (E5).** **Recommend: no reading for reuse until a need is named, and then a per-file licence and provenance check first** (KhiCAS and Giac GPL code is fine; no NumWorks Epsilon parts; no HP firmware, fonts, skins or text).
15. **Keyboard layouts (E6).** **Recommend: Pascaline keeps one layout** (P11: the G2's layout is the backbone and keys never move); ask him whether he meant KhiCAS, and offer `spec/keyboard.yaml` (GPL).
16. **Commit the five research notes** (pending C1). **Recommend: yes, now, as dated evidence records** with their new status lines; they move to the archive with your H7 answer. The risk report's copy in the main checkout (untracked on `p1/sandra-padlayout`) can then go (multi-engine-answer 6.5).
17. **G58's priority against the day path.** **Recommend: put G58, G67 and G75 at the front of the next night,** before any engine feature: two are freezes or silent mode changes reachable today or at R4a, and G75 unblocks G56.

## (d) Dropped, and why

- **r16-F1(b) and r16-F9:** fixed by G46; no ids, no cases beyond G46's. G58's DEG `acos(10^400)` case and G59's "F9 rows G46 leaves" are gone with them.
- **The bug hunt's bundle "N7, N8 and N1 in one package":** N1 went to G67 with N2 and H1, where the cause (Giac's flags) is.
- **Multi-engine Part I and Part II's verdict text:** no doc change. Part II's "one engine decides" is corrected by the answer, and its correction is docs/04 6.1's proposed decision; nothing else of Part II is current.
- **The answer's docs sizes (brief 26.7 kB, backlog 18.8 kB, decisions 35.5 kB):** a snapshot, not a fact to keep.
- **The answer's "send the tree to the worker" alternative and r16's mutation testing (Stryker):** not proposed now; both notes say "later, if needed".
- **Removing the three withdrawn #1045 overrides** (`m_n`, `neutron_compton_wavelength`, `d_220`, pending A3's question): kept. qalc computes them by formula and matches CODATA only to the published digits; the generator compares at 40 digits (`generate.mjs:285`, `:646`), and removing the `override` alone fails the build (`:653`). Their notes now say so.
- **Pending A4's "the full report waits for his answer" and B's "waiting for Parisse's answer":** stale after his reply (E3); applied with the answered wording.
- **The fixed rows of bug-patterns.md:** they stay in the note as evidence; nothing moved.
- **The bug hunt's suspects (section 5):** Slope and Area digits go into G63's scope; `∫₋₁¹ 1/x² dx` = `+infinity` goes with decision c4; the tier-1 decision census is in G71.

## (e) The pending-updates edits applied (step 1; one commit on their own)

The diff of this group alone is saved at `/tmp/claude-1000/-home-nordmu-Documents-source99-pascaline/826f45f3-fc95-4fed-99e6-7e5f6bdcb88f/scratchpad/step1-pending-updates.patch` (taken before step 4 touched the same files; stage it with `git apply --cached` on a clean index).
- **A1** backlog "Needs the user" item 8 (now 9 after step 4's new item 1): the email part removed, as written.
- **A2** backlog "Upstream reports": heading and three bullets replaced, as written. Step 4 then added Parisse's planned route (E3) and the bug ids F45–F48 to the Giac bullet.
- **A3** `find/units.yaml`: the header points to "Upstream reports"; `hp` → `libqalculate#1043, fixed after 5.13.1`, `mmHg`, `inHg` → `#1044, fixed after 5.13.1`, ten constants → `#1045`; `m_n`, `neutron_compton_wavelength`, `d_220` explain that they are not data errors (see (d)). No "to report upstream" left; the YAML parses with 16 overrides.
- **A4** `engine/giac/patches/README.md`: 0001 and 0002 statuses, worded for Parisse's answer (links to our commits); the "Last checked" line. I reran the dry run on the pinned tarball (`1d9536e0…`: both patches apply); the other two tarballs are not on this machine, so their dry runs are the 2026-10-19 session's (to verify).
- **A5** `fdroid/README.md:9`: "Nothing of qalc's code goes into the APK; its data ships in the Find index (P15)."
- **A6** `docs/decisions.md` P10, as written. To fit the 40 kB budget I shortened the A16 entry's sentence on DEG `limit` and `series`, which G46 made stale (rechecked: DEG `limit(sin(pasdeg*x)/x,x,0)` = `≈ 0.0174532925199`, `series(exp(x),x,0,4)` answers).
- **A7** `THIRD_PARTY.md`, as written. **A8** `docs/research/giac-help-licence.md` points 2 and 4, with the quote checked against `../outreach/email-parisse-reply-2026-10-19.md:18`. **A9** `docs/04-architecture.md:212`, as written.
- **B** `bug-patterns.md` lines 287, 296, 349, 350, 365 (the last with Parisse's route instead of "waiting"); r16's "For Giac upstream" names drafts G4, G3, G9; `deep-check-2026-10-19-angle-marks.md` D10 and D4 get dated recheck notes (D10's `0.-000…` does not reproduce raw or through Home; D4's raw mechanism holds: `re(cosh(90*i))` = 0 with `angle_radian:=0`). bug-patterns and r16 are untracked, so B travels with them.

**`pending-updates-2026-10-19.md` can be deleted once group (e) is committed:** A and B are applied, C1–C3 and E1–E6 are decisions in (c) or package G77, F is in the backlog and `find/units.yaml`. It is tracked (`36c94d3`), so it goes with `git rm`.
