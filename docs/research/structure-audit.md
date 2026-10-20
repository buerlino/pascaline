<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Structure audit: which changes remove whole families of bugs

**Status (2026-10-20): open.** Done by the owner the same day: G67 widened in its package; G69, R69, G66, G72, G73, G74 and G76 held in the night queue. The owner decides the rest of the five proposals (section 2): the G65 → G72 → G73/G74 line, a facts type for G76, and the queue order of section 3; decisions.md "Needs the user", "Structure audit".

*sandra, 2026-10-20, read and probe only, on `phase-1` `d6f6093` (worktree `p1/sandra-structure`; the night shift ran from run #135 meanwhile, untouched). Every number comes from a probe in `tools/probes/` or a `git` command named beside it. Labels used here (no ids): **audit-P1 … audit-P5** for the proposals, **text-1 … text-10** for the text readers' confirmed misses (`tools/probes/text-misses.ts`), **audit-…** for the other new findings. Bug rows are bug-patterns.md's ids. The appendix, [structure-audit-inventory.md](../archive/structure-audit-inventory.md), lists all 413 text matches one per line; it is a snapshot, so it lives in the archive.*

## 0. The verdict

The code is sounder than 224 bug rows suggest, but the unsound part is concentrated and still growing. About half the rows (121 of 224, section 1.1) come from things no restructuring removes. These are Giac's doubles and branch cuts, Giac's conventions, the entry grammar, the unit rules, cost and the pipeline, and the oracle and sequence generators (G61–G64) are the right cure for them. The other half (103 rows) trace to the five causes. Each cause sits in a few places:
- the engine's text glue (413 places that read Giac text or LaTeX with patterns, among them five rules for "what is a store" that disagree);
- the facts a result carries, which travel in a dozen hand-copied shapes;
- one cache that trusts Giac's settings between calls;
- a few rules written twice.

Every engine package adds to the glue: in ten days, merges added 238 pattern lines to `app/src/engine` and removed 26, and only one package (G45) removed more than it added. That is the "glue around glue" the owner feared, and it is real. The fixes that worked were the ones whose package text named the cause: route R for the angle (G46), one map for our names (G54). **The first change I would make is audit-P1: make Giac's settings one context that the host checks at every call, which is G67 widened and moved up.** It takes half a day, it must land before Find (R4a) and library import (R59) make those settings reachable, and today it hides a wrong value: `angle_radian:=0` followed by `sin(1)` shows `≈ 0.0174524064373`, "38 digits confirmed", in RAD (the right value is 0.841470984808). The change that turns the code's direction is audit-P2, the next one. In it Giac's own parse tree and state answer "which names does this read, does it store", and they replace the store lists that each package extends by one regex. G65 already starts it, and G72 should be rewritten as part of it, not added as more regexes.

## 1. What the code and the history show

### 1.1 The cost of each cause
Method: I read every row of bug-patterns.md (the 224 outside family 16). A row that says "see family n" is counted once, where its cause is. This split is my reading; the row ids let anyone recount. I add a sixth label, **carrier**: a value leaves its line by a path that has no field for one of its facts. bug-patterns.md files these rows under cause 1 or 2, but neither hidden state nor text reading makes them happen.

| Cause | Rows | The rows | Where it lives (places to change) |
|---|---|---|---|
| 1. Hidden global state | 16 | family 2: R10, F29, chk 1–4, D4–D7, D12, N1; family 1: R16 hazard, F28; families 14–15: chk 11, A18 | Giac's flags: the mode cache `host.ts:896` (`useMode`, 3 callers), `casSetupCommands` `host.ts:103`, `homeSetupCommands` `homeEval.ts:259`, 38 `Digits:=` writes in 7 files (`grep -rn 'Digits:='`), `STATE_WORDS` `library.ts:23`, flag names stored in the log (`defsAfter` `host.ts:397`). Ours: `host.ts:278` chip facts, the session's chip table and counter. **6 places** for Giac's flags; 12 of the 16 rows were closed by route R (G46), which took the angle out of Giac's state. |
| 2. Glue that works on text | 25 | family 1: D3, G49f3, G49f4, n19 2.2 (×3); family 3: G38f1; family 5: m2 and D10 (`0.-000`), m3 (`x×x`, `1*i`), F36, r16-F7; family 6: n19 2.1 (`shortDigits`); family 9: all 11 | **413 sites** (1.3), 256 of them in `app/src/engine` |
| 3. One rule written twice | 16 | family 8: all 11; family 1: G50f1, n19 2.7 (G56); family 2: D8; family 6: R66 note; family 12: chk 17 | about 20 rule pairs (appendix, "Duplicates"): 7 bracket matchers with 4 rule sets, 5 store-verb lists, 3 angle-command lists, the chip rule in the session and the golden runner |
| Carrier (mine) | 9 | §2.3 #8, M4-7, F37, M4-10, G22/G22f1, D1, D2, G49f1, n19 2.7 (G51) | 12 shapes that carry facts (1.4), converted by hand at 8 places |
| 4. Asynchronous edges | 21 | family 11 except F41, m3 `toSorted`, F32, F8 (device or platform) | R8's queue rule; lazy chunks, lifecycle, MathLive's 60 ms timer |
| 5. MathLive's editing model | 16 | family 10: all 13; family 7: F17, F18, F23 | `entry/` (delete.ts 593 lines, boxes.ts 574, controller.ts 509) |
| None of the five | 121 | families 3 (8 rows), 4, 5 (8 conventions), 6 (6 rows), 7 (22 rows), 12 (16 rows), 13, 14, 15 (except chk 11, A18) | Giac's numerics, the entry grammar, unit rules, cost, tests, tools |

Of the 16 open bug lines on `d6f6093` (backlog F44–F59), 7 come from the five causes and the carrier label: F52 (cause 1), F53 (carrier), F54, F57 and F58 (cause 2), F55 and F56 (cause 3). The other 9 are maths edges (F44–F51, F59). This audit adds two lines that users can reach today (section 8).

### 1.2 Hot spots
`python3 -I tools/probes/churn.py d6f6093 12`: churn is lines added + removed over every non-merge commit; "cited fix commits" are the commits that bug-patterns.md names as fixes.

| File | Lines | Churn | Commits | `fix…` commits | Cited fix commits (lines) | Jobs |
|---|---|---|---|---|---|---|
| `App.svelte` | 659 | 2057 | 50 | 13 | 12 (232) | several (shell, routing, keys); frozen by P17 |
| `entry/delete.ts` | 593 | 1975 | 15 | 15 | 16 (1994) | one: ⌫ and Del per atom kind. 13 commits on 10-15, 2 after: the grids settled it |
| `engine/numeric.ts` | 1312 | 1648 | 28 | 18 | 9 (906) | **six**: complex workaround (72–372), text readers (156–260, 381–450), asked precision (194–240), the agreement check (456–980), G38's decisions (996–1312), store detection (1097–1145). 20 commits on 10-19 alone |
| `input/parse.ts` | 1219 | 1493 | 27 | 11 | 9 (145) | one: LaTeX to a tree |
| `engine/host.ts` | 991 | 1492 | 47 | 28 | **25 (694)** | **five**: Giac loading, text readers (126–245), name facts (452–590), the definitions log (309–440), view dispatch and modes (594–900) |
| `engine/homeEval.ts` | 771 | 1489 | 50 | **30** | 20 (580) | **four**: our Giac definitions (143–260), decimal rewrite (268–360), store detection by text (373–445), the Home evaluation and result building (458–771) |
| `state/session.svelte.ts` | 776 | 1102 | 38 | 11 | 8 (216) | three: history, chips (the chip rule at 533–544 and 557–583), settings |
| `entry/controller.ts` | 509 | 807 | 29 | 17 | 18 (368) | one: keys into MathLive |
| `keyboard/Keypad.svelte` | 495 | 795 | 18 | 2 | 3 (54) | one |
| `apps/function/app.svelte.ts` | 569 | 723 | 12 | 0 | 2 (45) | one |

**The centre:** `host.ts`, `homeEval.ts` and `numeric.ts` together carry 54 cited fixes and 76 `fix…` commits. Each does four to six jobs, and they had 63 commits on 2026-10-19. `parse.ts` is **not** a centre: it does one job, with 9 cited fixes of 145 lines, against 25 fixes of 694 lines in `host.ts`. The MathLive pair (`delete.ts`, `controller.ts`) was the centre until 2026-10-15 and has been quiet since. The splits already queued (G60 → `complex.ts`, G71 → `decisions.ts`, G74 → `giacText.ts`), with audit-P2 deleting the store detection, leave `numeric.ts` one job, the agreement check. G65 moves `host.ts`'s name facts to `facts.ts`. With audit-P2 and audit-P4, `homeEval.ts` keeps two jobs (our definitions and the Home evaluation), which is fine.

### 1.3 The text readers
Three read-only helpers listed every site in `app/src` that reads Giac text or LaTeX with a pattern, a string test or a hand-written scan. That is 413 sites, one line each, in [the appendix](../archive/structure-audit-inventory.md); the counts are its last table.

| Kind | Sites | What they decide | The cure that fits |
|---|---|---|---|
| SHAPE | 95 | is it an error, a list, a float, `undef`, a pair | one helper each; for some, Giac's `type()` |
| NAMES | 69 | which names and calls a text holds | **Giac's own parse** (`lname(quote(…))`, R15), or our parser's tree |
| NUMBER | 57 | a printed number | stays; one number reader (`decimalFromString`) |
| STATE | 52 | does this store, run once, define | **Giac's own parse** (audit-P2) |
| REWRITE | 39 | text we change before Giac sees it | **one door** (audit-P4) |
| BRACKET | 36 | a closing bracket, a top-level comma | one reader (G73) |
| LATEX-EDIT | 34 | edits of the entry line | stays (MathLive's model, cause 5) |
| OTHER | 31 | | |

By source: 177 read Giac's printed output, 139 read Giac input text, 46 read LaTeX.

**The duplicates** (appendix, "Duplicates"):
- 7 bracket matchers with 4 rule sets, and 17 more hand-written walkers outside the engine.
- 5 top-level comma splitters.
- Five rules for "this input stores", which disagree: `homeEval.ts:373`, `numeric.ts:1097`, `library.ts:23`, `library.ts:116` and `numeric.ts:1230`. `a+=1` is a store to the library and not to Home (text-5).
- 5 lexers for a decimal literal.
- 3 angle-command lists: `input/angles.ts:16–27`, `units/evaluate.ts:17/89` and `input/emit-js.ts:23–24`.
- 6 `isError` copies.
- Not one string skip handles Giac's `\"` escape (text-9).

**Confirmed misses** (`GIAC_OUT=<dir> node tools/probes/text-misses.ts`; oracle `tests/golden/.venv`, mpmath):

| Label | Input | Shown | Right | Cause in the text |
|---|---|---|---|---|
| text-1 | `approx(sin(10^30),2*10)` (**the keys reach it**: Shift + key inserts `approx(…)`) | `≈ −0.685710242506`, 39 digits confirmed | −0.0901169019121 | `withAskedPrecision` (`numeric.ts:198`) raises only a literal n |
| text-2 | `floor((2^-(1/2)+3^-(1/2))^2-5/6-2*6^-(1/2)+1)` | `= 0` | 1 | `rationalOnly`'s exponent pattern (`numeric.ts:1053`); the keyboard emits `2^(-1/2)`, which gives 1 |
| text-3 | `evalf((tanh)(1+i))` | `≈ 0.868014142896−0.217621561854i` (that is coth) | 1.08392332734+0.27175258532i | `complexSafe` and `functionsIn` match only `name(` |
| text-4 | CAS `seq(k^2,k=1..3)` | `(k^2)$(k=(3/10^1))` | `[1,4,9]` | `DECIMAL` (`homeEval.ts:270`) reads `1..3` as 1. and .3 |
| text-5 | `a:=1`, `a+=1` | 2, not logged | logged | `STATEFUL` (`homeEval.ts:373`) |
| text-6 | Home `"1.123456789012345678"` (a string) | `"1.12345678901"`, ⚠ | the string as typed | `floatsAtDigits` (`numeric.ts:120`) and `hasFloat` (`:106`) read inside strings |
| text-7 | Solve `subst(t^2,t=x)-2` | no root | 1.41421356237 | `HAS_EQ` (`solve.ts:109`, `solve1.ts:97`) |
| text-8 | library body `approx_mode(1)` | accepted | refused | `STATE_WORDS` (`library.ts:23`) |
| text-9 | library body `s:="a\"b:=1"` | refused "assigns b" | accepted | the string skip |
| text-10 | `B:=evalf(sqrt(2),5)`, `int(B^2,B,0,1)` | `≈` | `=` | `inherited` reads a bound name (F54) |

Only text-1 is reachable from the keys today; it is a new open line (section 8). The others wait for a door that brings Giac text: Find's inserts (R4a), library import (R59), restore (R38b), or the CAS line once it takes Giac text.

### 1.4 Facts travel in a dozen shapes
A result's facts are exactness, confirmed digits, warn, why, inexact input and σ digits. They live in these types, each a hand-picked subset:
- `HomeResult` (`homeEval.ts:82`) and `HomeOutcome` (`calc/port.ts:37`);
- `CasResult` (`types.ts:36`);
- `PrecisionFacts` (`format.ts`) and `NameFacts` (`defs.ts:13`);
- `ChipEntry` (`chipFacts.ts:16`) and `Chip` (`input/chips.ts:8`);
- `ConstEntry` (`constUnc.ts:14`);
- `ShownNumber` (`calc/shown.ts:9`) and `Cell` (`apps/function/engineApi.ts`);
- the clipboard item (`clipboard/text.ts:25`);
- `KnownValue` (`types.ts:94`), which has **no** facts at all: that is F53.

They are converted by hand at `calc/engine.ts:46` and `:52`, `session.svelte.ts:149`, `:469–472` and `:533–583`, `goldenRun.ts:140–153`, `chipFacts.ts:61` and `host.ts:579–582`. `GIAC_OUT=<dir> node tools/probes/carriers.ts` shows the port dropping `why` on every ⚠ result (`BesselJ(1,2)`: `why={"once":true}`; `romberg(…)`: `why={"unaudited":["romberg"]}`), so R36's why-line cannot work through it. `goldenRun.ts:140–153` still rebuilds the session's chip rule (`session.svelte.ts:533–544`) with its own `cut` expression. G49f2 fixed one difference between the two and left both copies in place.

### 1.5 Glue added per package
`node tools/probes/glue-growth.mjs --since 2026-10-06 --rev d6f6093` reads each merge's diff (`app/src`, tests excluded):
- 244 merges, 164 of them touching `app/src`.
- Pattern lines: +649 −140 in all of `app/src`, **+238 −26 in `app/src/engine`**. 36 packages added engine pattern lines; one removed more than it added (G45).
- Entries in the name lists that steer the engine by name (`STATEFUL`, `DECISION_FUNCTIONS`, `AUDITED_FUNCTIONS`, `COMPLEX_DEFINITIONS`, `STATE_WORDS`, `ANGLE_IN` …): +322.
- Our `pas…` helper names: +86 lines.
- 25 fix packages (ids ending in f1, f2 …) added 68 pattern lines.

## 2. The hypotheses, tested, and five proposals

### 2.1 Hypothesis: one typed value that carries its facts closes family 1
**Partly true.** A Home result already **is** a typed value with its facts (`HomeResult`: `exactRational`, `reliableDigits`, `warn`, `why`, `uncDigits`, `full`). Family 1 is not "text with facts rebuilt"; it has two mechanisms:
- **carrier rows (9 of 21):** a path with no field for a fact (1.4);
- **name rows (8 of 21):** which stored names an input read, found from its text.

A shared `Facts` type closes the first mechanism (audit-P5). Only names from Giac's state close the second (G65, audit-P2).

### 2.2 Hypothesis: one explicit settings context per call closes family 2
**True, and G67 is nearly all of it.** `GIAC_OUT=<dir> node tools/probes/giac-globals.ts` types 21 flag inputs in CAS on a fresh engine, then reruns 9 Home and 10 CAS inputs, in the same session and after a relaunch:

| Flag typed in CAS | Same session | After relaunch | Log entry |
|---|---|---|---|
| `approx_mode:=1`, or `cas_setup(1,…)` | 12 results change (Home loses `=`; CAS `1/3` = 0.333333333333, `factor` with floats) | the same (approx_mode) / none (cas_setup) | `approx_mode:=(1)` / nothing |
| `integer_format(16)` | Home `1/4`, `2^70`, `0.1+0.2` lose `=`; CAS `1/3` = `0x1/3`, `255` = `0xFF` | none | nothing |
| `complex_mode:=1` | CAS `sqrt(x^2)` = x, `int(1/x,x)` = ln(x) | none | `complex_mode:=('complex_mode')`, which does nothing on replay |
| `increasing_power:=1` | CAS `factor(x^4-1)` = `(-1+x)*(1+x)*(1+x^2)` | none | a no-op entry |
| `assume(x>0)` | CAS `solve(x^2=2,x)` = `[sqrt(2)]` | the same | `assume(x>0)` (intended) |
| `Digits:=5`, `epsilon:=0.01`, `angle_radian:=0` | none **in this order** (Home first, then CAS) | none | `Digits:=(14)`, `epsilon:=(evalf((1/10^6),15))`, `angle_radian:=(0)`: the log stores Giac's print, not what was typed |

The order matters. The host sets the mode only when the cache key changes (`host.ts:896–900`). An input in the same view right after the flag therefore runs with the user's flag (`engine.ts` one-liners, section 8):
- CAS `angle_radian:=0`, then CAS `evalf(sin(1))` = 0.0174524064373;
- Home `angle_radian:=0`, then Home `sin(1)` = `≈ 0.0174524064373` with 38 digits confirmed, and `asin(1)` = `= 90`;
- oracle: sin 1 = 0.841470984808; 0.0174524064373 is sin 1°.

**Reach today: none.** The parser refuses a name with `_` (`node tools/probes/parse.ts '\operatorname{angle\_radian}'`: "unsupported name"). Every one of these becomes reachable once Giac text comes in through another door.

G67 reads `cas_setup()` after every user input and restores it. That covers the fields of that list, among them `approx_mode`, `complex_mode`, `angle_radian`, `Digits` and `epsilon` (multi-engine-answer.md 3.2). It misses `integer_format`, which sits outside the list. Its step 4 finds the other flags by probing; they should come from Giac's own list of context fields (to verify: gorge reads `global.cc` in the pinned tarball in G67). → **audit-P1.**

### 2.3 Hypothesis: one parse tree that emits both Giac input and the plot evaluator closes "parser vs plot"
**Already true.** `compileDefinition` (`apps/function/compile.ts:27`) parses once and serialises the same tree twice: `mathJsonToGiac` and `jsonToJs`. `GIAC_OUT=<dir> node tools/probes/twin-emitters.ts` runs the 595 `parser.yaml` cases that both emitters accept (520 case-and-angle pairs, 7 x each) and compares the plot's value with Home's:
- **516 agree.**
- **The DMS template loses its seconds in the plot:** `30°15′36″` is drawn as 30.25°, against the engine's 30.26°. `emit-js.ts:40` writes `Add` with two terms, and the DMS node has three (new open line, section 8).
- `√x·√x` at x < 0 is NaN in the plot and −2.7 in the engine. Giac is right; the plot leaves a hole (r16 2.3's kind).

What is missing is not a tree. It is (a) shared tables (three angle lists, 1.3) and (b) this check in the gate, which G63 plans. → **audit-P3.**

### 2.4 Hypothesis: one reader of Giac text (G73, G74) cures cause 2
**Only for half of it.** A reader unifies the lexing: strings with `\"`, numbers against `1..3`, identifiers with `_`, brackets. That fixes text-4, text-9 and the bracket duplicates. It cannot fix the meaning misses, where the text is read right and the question is wrong:
- `a+=1` and `c=<c+1` are stores (text-5);
- a function passed as a value, `map([1],inc)` or `(tanh)(1+i)` (text-3);
- a bound variable (text-10);
- a store nested in an expression (R15's six forms).

Each meaning miss so far became one more alternative in one of the five store lists. G72 as written adds nine more. Giac answers these questions itself, without running anything:

```
GIAC_OUT=<dir> MODE=raw node tools/probes/engine.ts 'pasheads(e):={ local r,k; if (type(e)==DOM_LIST) { r:=[]; for k in e do r:=concat(r,pasheads(k)); od; return r; } if (type(e)!=DOM_SYMBOLIC and type(e)!=DOM_FUNC) return []; r:=[string(sommet(e))]; for k in [op(e)] do r:=concat(r,pasheads(k)); od; return r; }' 'pasheads(quote(cnt+=1))' 'pasheads(quote(F=>pE))' 'pasheads(quote([a,b]:=[1,2]))' 'pasheads(quote(concat("a:=1",b)))' 'bump(x):={ increment(cnt); return x; }' 'pasheads(bump)' 'cnt'
```

What that run shows:
- `cnt++`, `increment(cnt)` and `cnt+=1` all parse to the head `increment`;
- `=>`, `[a,b]:=` and `(a,b):=` parse to `sto`;
- a `:=` inside a string is not a node;
- a stored program's body is walked (`bump` gives `increment`);
- `cnt` stays free, because `quote` runs nothing.

The cost:
- the walker written in Giac's language takes 0.5 ms per call on the desktop (`time(seq(…,k,1,100))` = 0.051 s), too dear for every Enter (mean Enter 1.43 ms, R15);
- `lname(quote(…))` takes 0.01 ms.

So: names per Enter from `lname` (G65, as decided); a definition's stores from the walk, once, when it is defined or imported, kept on its log entry; the typed line's stores from our parser's tree, which already has an `Assign` node. → **audit-P2**, and G73 narrows to lexing Giac's output and the leftovers (**audit-P4**).

### 2.5 Found in the code: the rewrites have no single door
`toExactLiterals` runs at 20 call sites in 8 files (`grep -rn 'toExactLiterals('`). `complexSafe`, `withAskedPrecision` and `renameOurCalls` each run where their author remembered them. G54's `ourNames.ts` is the one place where the pattern is solved: one map serves the parser and the library (`library.ts:267` `rewriteAngles(renameOurCalls(text))`). text-1, text-3 and text-4 are rewrites that missed a form, and family 8's G14f1, `bc78534`, G54, chk 16, G50f1 and n19 2.5 are paths that skipped a rewrite. → **audit-P4.**

### 2.6 The five proposals, ranked
Ranked by wrong or unmarked results, open or latent, removed per day of work. A drawing-only row counts half. "Past" counts the closed rows the change would have prevented. Costs are wall-clock guesses at the package sizes of brief section 0c.

| Rank | Proposal | Cause | Open + latent rows removed | Past rows | Days | Removed per day |
|---|---|---|---|---|---|---|
| 1 | audit-P1: Giac's settings, one context checked at every call | 1 | 5 (F52 with its library form text-8, the `angle_radian` hole in CAS and in Home, `integer_format`, the junk log entries) | 12 (route R's, closed another way) | 0.5 | 10 |
| 2 | audit-P2: names and stores from a tree, not from text | 2 (meaning) | 10 (F54, F57, F58, R15's six forms, text-5) | 11 | 1.5 | 7 |
| 3 | audit-P3: the two emitters share their tables and a gate check | 3 | 2 at half weight (`audit-dms-plot`, `√x·√x`) + 1 to verify (`withAngles` misses sec, csc, cot) | 3 (D8, R66 note, r16 2.3) | 0.25 | 6 |
| 4 | audit-P4: one door for Giac text (G73/G74 narrowed, plus `prepare`) | 2 (lexing, rewrites) | 5 (text-1, text-2, text-3, text-4, text-9) | 7 | 1 | 5 |
| 5 | audit-P5: one `Facts` type; the engine makes the chip | carrier, 3 | 3 (F53, F55, the dropped why and σ) | 9 | 2 | 1.5 |

Rank 5 removes the fewest open bugs, but it changes the most queue: G68, G76, R69, G81 and R61 each add a field to a carrier today (section 3).

#### audit-P1. Giac's settings, one context checked at every call (cause 1)
- **Evidence:** 2.2.
- **Change:** G67 as written, plus three changes:
  1. after every call that ran user text (Home, CAS, a library body, a restore), the host checks the whole context, `cas_setup()` and `integer_format`, and clears the mode cache key whenever it restored something;
  2. the list of flags comes from Giac's context fields in `global.cc`, with a canary that fails when a new one appears;
  3. the log stores no flag entry: `complex_mode:=('complex_mode')`, `Digits:=(14)` and `epsilon:=(evalf((1/10^6),15))` today are entries that mean something other than what was typed.
- **Closes:** F52, N2 and the four latent rows of 2.2.
- **Deletes:** the deny-list role of `STATE_WORDS` (it stays as a message, as H1 said).
- **Cost:** G67's 1.5 h + about 2 h. **Risk:** one more Giac call per Enter; G67 already asks for it and G65 shares it.
- **Lands:** golden sequence cases first (2.2's rows, failing on phase-1), then the host change. Gate: golden, vitest, e2e, and `calls-baseline.yaml` raised once with the reason.
- **Queue:** G67 moves from step 72 to right after G58 (section 3).

#### audit-P2. Names and stores from a tree, not from text (cause 2, meaning)
- **Evidence:** 1.3 (121 NAMES and STATE sites; five store lists), 2.4 (Giac's parse), R15 (VARS and `lname`; cost +1 call).
- **Change, in three steps:**
  1. **G65 as decided**, with G69 folded in. G69 rewrites the same `inherited()` (`host.ts:452`); the bound-variable mask is applied to the read call's names (`lname` does not know `sum`'s bound x, multi-engine-answer.md section 7).
  2. **G72 rewritten:** a definition's "does it store" and "which names does it call" come from the Giac walk at define, import and replay time, kept on its log entry beside G65's state table. `definitionStores`, `callsStateful` and `decidingStored` read that, not the printed body.
  3. **The typed line:** our parser hands the host, beside the Giac text, what its tree knows (stores, the target, a function definition, the names read). `isStateful`, `simpleAssignment`, `definedBy`, `storeTargets` and `arrowFunction` then read a field, not the text. This touches the parser's output, not its grammar, but it is still an exception to P17 for the owner. Without it, step 3 falls back to `sommet(quote(…))` for the top-level store (to verify: gorge, 0.01 ms like `lname`).
- **Closes:** open F54, F57, F58, text-5 and R15's six forms. Prevents the class that produced D3, G49f3, G49f4, n19 2.2 ×3, G38f1, G33f2/f3 and `33f7f54`.
- **Deletes:** the five store lists, the text name finders that R15 lists for replacement (`host.ts:229–245`, `:511–590`; `homeEval.ts:373–445`) and `definitionStores` (`numeric.ts:1097–1145`). That is about 250 lines (to verify by line count in G65's report); G72 adds none.
- **Cost:** G65 2 h + G72 rewritten 4 h + the parser fields 4 h. **Risk:** the walk's cost on a 200-function library at import (to measure, with A12's bench); a program form the walk does not reach (the property test of G73 finds it).
- **Lands:** each step behind its own golden sequence cases (R15's forms, text-5, F57's library file), the golden gate unchanged otherwise, and `calls-baseline.yaml` at G67's level.
- **Queue:** G65 earlier, G69 folded into it, G72 rewritten, G66 held (section 3).

#### audit-P3. The two emitters share their tables and a gate check (cause 3)
- **Evidence:** 2.3.
- **Change:**
  - `emit-js.ts` writes an n-ary `Add`;
  - `emit-js.ts` and `units/evaluate.ts` import the angle tables from `input/angles.ts`;
  - `tools/probes/twin-emitters.ts` becomes G63's first stage.
- **Closes:** `audit-dms-plot`; `units/evaluate.ts:89` `withAngles`, which rewrites only sin, cos and tan, so sec, csc and cot keep `pasdeg` (inventory C; the unit view's result for `sec(30°)` is to verify by gorge with `tools/probes/unit-result.ts`).
- **Deletes:** two angle lists.
- **Cost:** 2 h. **Risk:** none found.
- **Lands:** a unit test for the three-term DMS node and the twin-emitters run (tmpl-dms-01 differs on phase-1, not on the branch); vitest and e2e unchanged otherwise.
- **Queue:** a FIX line, or the first step of G63.

#### audit-P4. One door for Giac text (cause 2, lexing and rewrites)
- **Evidence:** 1.3 (7 bracket matchers, 5 decimal lexers, no `\"`), 2.5, text-1 to text-4 and text-9.
- **Change:** G73 builds the lexer and its property test as planned, but after G65 and audit-P2 step 2, so it covers only what is left. It adds `prepare(text, origin)`, the rewrites in one fixed order: our call names, exact decimals with ranges kept, asked precision for any n (text-1), our complex definitions for any form of call (text-3), and the angle factor for text that did not pass our parser. G74 moves every path to it (Home, CAS, Solve, analysis, the unit view, library import and its test lines, restore, Find inserts). One test runs G55's corpus through every path and compares.
- **Closes:** text-1 to text-4 and text-9; G56 (the CAS path through `complexSafe`) becomes a row of that test.
- **Deletes:** the duplicate matchers, splitters and lexers (appendix, "Duplicates" 1, 2, 6, 13, 14), and the 20 scattered `toExactLiterals` calls.
- **Cost:** G73/G74 as planned (6 h) + 2 h. **Risk:** a rewrite order that changes a golden value; the move must change none (G74's rule).
- **Lands:** G73 with its property test and no caller; then G74 one path per commit, each behind the golden gate, `calls-baseline.yaml` and the every-path test; text-1 to text-4 and text-9 as golden or unit cases first.
- **Queue:** G73 and G74 after G65 and G72; G56 likely dropped.

#### audit-P5. One Facts type; the engine makes the chip (carrier, cause 3)
- **Evidence:** 1.4.
- **Change:**
  - one `Facts` type in `engine/types.ts` (exactness, confirmed digits, warn, why, inexact input, σ digits, and later G80's basis);
  - `HomeResult` and `CasResult` gain `facts` and `chip: { value, facts }`, made once in the engine;
  - the port passes `facts` whole, checked by the compiler (G76's own test);
  - `session.svelte.ts` and `goldenRun.ts` take `r.chip` and drop their two rules;
  - `KnownValue` and the clipboard item carry `Facts`.
- **Closes:** F53, F55, and the `why`/`uncDigits` drop before R36 and R40 need them. Prevents §2.3 #8, F37, M4-10, G22, D1, D2, G49f1, G49f2 and G51.
- **Deletes:**
  - `session.svelte.ts:533–544` and `:557–583` (the chip rule);
  - `goldenRun.ts:140–153`;
  - the field lists at `calc/engine.ts:46` and `:52`;
  - `copyMark`'s own rule (R69);
  - `shown.ts` `factsOf`.
- **Lands:** step 1 the type and the port (a compile-time check, G76's test); step 2 `KnownValue` (G68's cases); step 3 the chip from the engine and Copy's mark (R69's cases, G49's golden sequence cases unchanged). Each behind vitest, e2e and the golden gate.
- **Cost:** 2 days in three packages. **Risk:** `session.svelte.ts` is UI state. The change keeps its behaviour, and e2e plus the golden sequence cases guard it.
- **Queue:** G76 widened is step one, then G68 and R69 become its steps two and three; G81 and R61 come after it.

### 2.7 Causes 4 and 5: no structural cure worth its cost
- **MathLive (cause 5):** the only structural cure is our own editing model. That is a rewrite against principle 1 (reuse first), and the measured trend says it isn't needed. `delete.ts` took 13 commits on 2026-10-15 and 2 after, once the ⌫, Del, cursor and tap grids existed. Family 10 has 12 rows fixed and 1 open. Keep the rule "a new template gets rows in every grid in the same commit", and keep the upstream reports (MathLive #3122–#3124, M4).
- **Async edges (cause 4):** 21 fixed and 4 open, each fixed at its edge by R8's queue rule. The open ones need a device (K1, F41). Keep the "every lazy chunk × every key kind" grid of bug-patterns.md family 11.

## 3. The queue, rows 62–89

"Cause" means the package removes a mechanism; "symptom" means it fixes the instance. A symptom package is kept when its bug is reachable today and no cause fix comes sooner.

| Step | Package | Cause or symptom | Keep, change, drop | New order |
|---|---|---|---|---|
| 62 | G58 Home never hangs | cause (a size bound on every JS step) | keep | 1 |
| 63 | G59 exact path checked against evalf | cause for the `re()`/`im()` split; Giac maths | keep; add text-1 as a third case (same precision path, `numeric.ts:198`; reachable) | 3 |
| 64 | G78 refused with a reason | cause (a rule for every non-number) | keep | 4 |
| 65 | G68 Solve's knowns | symptom of the carrier gap | change: `KnownValue` carries `Facts` (audit-P5 step 2) | 11 |
| 66 | G69 bound variable | symptom of names from text | change: fold into G65 (both rewrite `inherited`) | 5 |
| 67 | G70 Area refuses where Home does | symptom of one rule twice | keep; the fix calls `converge.ts`, the one rule | 13 |
| 68 | R69 Copy session's mark | symptom, and the one-rule fix | change: audit-P5 step 3 | 12 |
| 69 | G75 tanh patch | cause (P19) | keep | 14 |
| 70 | G60 no double inside MPFR | Giac maths | keep | 15 |
| 71 | G56 CAS through a user function | symptom of no single door | change: a row of audit-P4's every-path test; drop if `COMPLEX_DEFINITIONS` is empty after G60 (as written) | with G74 |
| 72 | G67 Giac's flags | **cause** | **change and move up: audit-P1** | **2** |
| 73 | G71 tier-1 decisions | Giac maths; its census makes the lists generated, not hand-grown | keep, before R4a | 16 |
| 74 | G65 names from Giac's state | **cause** | keep; take G69 | **5** |
| 75 | G66 store counter (patch) | covers G65's blind spot | **hold**: audit-P2 step 2 knows a program's stores from its tree; drop if G65's report and step 2 leave no blind spot. A counter is a feature patch, not a fix (P19) | — |
| 75a | G82 step budget (patch) | cause (results that depend on the device's speed) | keep; takes the next patch number if G66 drops | 17 |
| 76 | G72 every store form | symptom (nine more regex alternatives) | **change: audit-P2 step 2, a tree walk** | 6 |
| 77 | G73 one reader | half a cause | change: after G72, the leftovers only, plus `prepare` (audit-P4) | 7 |
| 78 | G74 the readers move | cause, once G73 is narrowed | change: every path through `prepare`; G55's corpus through every path | 8 |
| 78a | G83 functions on first use | cost | keep; its name finder (`need(text)`) uses `lname` or G73's reader, not a new pattern; a missed name gives `2+g(2)` silently | 18 |
| 79 | G76 the port carries every fact | half a cause | **change: audit-P5 step 1, one `Facts` type** | 10 |
| 79a | G80 constants' basis | data | keep | 19 |
| 79b | G81 σ through the basis | adds a field to chips | keep, after audit-P5 | 20 |
| 80 | S17 workaround register | cause (P19) | keep | 21 |
| 81 | G77 re-pin | — | keep | 22 |
| 82 | S18 notes | — | keep; this note's decided part follows it | 23 |
| 83 | G61 oracle sweep | the generator for families 3–6 | keep | 9 |
| 84 | G62 sequences | the check that audit-P2 and audit-P5 hold | keep; after audit-P5 | 24 |
| 85 | G63 one value in every view | the check for cause 3; audit-P3 is its first stage | keep | 25 |
| 86 | G64 CAS checked back | generator | keep | 26 |
| 87 | S16 hardening pass | — | keep | 27 |
| 88 | R60 unit alternatives | feature | keep | 28 |
| 89 | R61 chip from a unit result | a new carrier | keep, after audit-P5 (it uses `Facts`) | 29 |

**Why this order:**
- G58 first: a hang hides every other answer, and the sweeps need it.
- audit-P1 next: it is cheap and must precede R4a.
- G59 and G78 next: they fix wrong values users reach today.
- Then the text line, in its dependency order: G65 (with G69), G72 as a tree, G73 and G74 narrowed.
- G61 early, so the remaining maths packages are judged by a sweep, not by single cases.
- Then the carrier line (audit-P5 with G68 and R69), then the rest as before.
- audit-P3 is a FIX line, any time.

## 4. Does the process breed spaghetti?

**Partly, and the cause is the package text, not the package size.** From 1.5:
- **Glue grows by default.** 36 engine packages added pattern lines; one removed more than it added. Fix packages added 68 pattern lines, most of them one more alternative for one more form:
  - G49 → f1, f3, f4, then G48: four follow-ups in one night, each "one more way to write a definition";
  - G38f1: 3 commits, 70 list entries, 24 pattern lines;
  - G44 → f1, f2, f2f1;
  - G14 → f1.
- **Size is not the obstacle.** The structural fixes that landed were package-sized too: G46 (route R: 139 net engine lines, 15 pattern lines added and 8 removed, and a whole family closed), G54 (one name map) and G53 (cost). Each came from research whose text named the cause: S14 for G46, the night check of 2026-10-19 for G54 and G53. I found no worker package that turned structural beyond its package text (a guess from the package texts and `glue-growth.mjs`; I did not read every report).
- **What pushes workers to patch:** a package's "Done when" is "the new case passes, the gate is unchanged". The smallest diff that does that is one more regex alternative, and the audit then checks the diff against the package, not the cause. P20 (2026-10-20) now says "new code adds no bracket loop or name regex"; only review enforces it, and G72's package text still asks for nine regex alternatives.

**Three changes, no new process:**
1. A package text says "cause" or "symptom". A symptom package in a family with an open cause proposal says why the cause fix does not come first.
2. The Opus pass runs `node tools/probes/glue-growth.mjs --since <last pass>` and lists every package that added engine pattern lines over Giac text after P20, each with its reason or a FIX line.
3. A structural package's "Done when" names the code it deletes, as G74 already does ("net lines removed").

## 5. What is fine (leave it alone)
- **The parser and its tree** (`input/parse.ts`, `emit.ts`): one job; 9 cited fixes of 145 lines in ten days, against 694 lines in `host.ts`; 595 round-trip cases; the two emitters agree on 516 of 520 pairs from one tree (2.3). Its grammar rows (family 7) are decisions the neighbour grids pin.
- **Route R** (the angle in our text, docs/04 2.12): it closed 12 family-2 rows by removing a global, the model for audit-P1. `angle_radian:=0` bites only through the mode cache, which audit-P1 closes.
- **The definitions log stores the typed text, not Giac's print.** Giac prints `g(x):=(pZ:=x)+1` as `(x)->pZ:=x+1`, losing the bracket, yet the log keeps `g(x):=(pZ:=x)+1` and a relaunch gives the same `g(2)` = 3, `pZ` = 2 (`tools/probes/text-misses.ts log-1`). Keep it so.
- **The mark and the agreement check** (docs/04 2.4): the rules are sound. Their failures were Giac doubles that both precisions shared (family 4), which only the oracle sweep finds.
- **`format.ts`**: pure and unit-tested; G58 adds the missing size bound.
- **The MathLive layer** (`entry/`): settled since 2026-10-15 (2.7).
- **The worker boundary and the `MathEngine` interface**: cancellable; no bug row traces to them.
- **`ourNames.ts`** (G54): one map for the parser and the text paths, the pattern audit-P4 extends.
- **Splitting the big files by job**: already in G60, G71, G65 and G74; no extra package needed.

## 6. What I did not prove
- **The rows-per-cause split (1.1)** is my reading, row by row.
- **The rates in 2.6** rest on guessed costs.
- **audit-P2 step 3's fallback** (`sommet(quote(…))` and `lvar` per Enter) is (to verify): gorge, cost with `engine-calls.ts` in G72.
- **The walk's cost on a 200-function library** is (to verify): gorge with A12's bench.
- **`global.cc`'s full list of context fields** is (to verify): gorge in G67.
- **The unit view's `sec(30°)`** is (to verify): gorge, `tools/probes/unit-result.ts`.
- **Inventory C's claims marked (inferred)** are in the appendix; one, `entry/kept.ts:26` (a damaged chip store falls back to its drawn LaTeX, and `2\frac{1}{3}` would read as 2/3), needs a damaged store and is (to verify): ron, with a unit test of `keptLine`.

## 7. Proposed packages (brief format, not in the brief; the owner decides)

G67 as amended by audit-P1 is its package file now ([packages/G67.md](../shifts/packages/G67.md); owner, 2026-10-20, commit `16405c4`).

### gorge, G72 as amended by audit-P2 step 2: a definition's stores from Giac's tree, branch `p1/gorge-m4-statewords`
**Lane:** night-safe (Opus worker, Opus audit). **Starts when:** G65 is merged (G69 folded into it); before R59. Replaces G72's package text; G66 waits for its report.
**Read:** this note 2.4 and audit-P2; G72's package (its F57 test stays); R15; `app/src/engine/numeric.ts` (`definitionStores` near 1097, `callsStateful` near 1112, `decidingStored` near 1127); `app/src/engine/library.ts` (`STATE_WORDS`, `assigns`, `storedNames`); G65's state table in `host.ts`; `app/src/engine/defs.ts` (`DefEntry`).
- **Probe on `d6f6093`:** the `pasheads` call of 2.4. `cnt++`, `increment(cnt)` and `cnt+=1` all parse to `increment`, and a stored program's body is walked. `tools/probes/text-misses.ts text-5 text-9`.
1. **Tests first,** each failing on phase-1:
   - F57's library file is refused;
   - a stored function whose body uses `increment`, `+=`, `=<`, `DelVar` or `[a,b]:=` runs once per Enter and is logged;
   - text-9 is accepted (a `\"` inside a string is no store).
2. **The walk:** one definition of ours (in `ENGINE_DEFINITIONS`, loaded on first use) returns the heads of a quoted text or a stored program. At define, import and replay time the host stores on the entry whether the body stores and which user functions it calls. `definitionStores`, `callsStateful`, `decidingStored` and the library's store checks read that record. Their patterns, and the store lists they replace, are deleted.
3. **Measure:** the walk's cost per definition, and the replay of A12's 200-program library before and after, in Node (in the report). If the replay rises past G83's bound, list it under "Needs the user".
**Done when:**
- The cases pass on the branch and fail on phase-1; the golden gate passes with no expected value changed; `calls-baseline.yaml` unchanged per Enter (the walk runs at definition only).
- The report gives the pattern lines removed against added (`node tools/probes/glue-growth.mjs --since <branch base>`), and says whether a store is left that the tree does not show (G66's question).

## 8. New findings, and how to rerun
- **Open, reachable today** (written to backlog "Open bugs"):
  - **audit-approx (text-1):** `approx(sin(10^30), 2×10)` = `≈ −0.685710242506` with 39 digits confirmed; the right value is −0.0901169019121. Rerun: `GIAC_OUT=<dir> node tools/probes/text-misses.ts text-1`. It overlaps G59 and audit-P4.
  - **audit-dms-plot:** the Function app draws `x+30°15′36″` without the 36″ (`emit-js.ts:40`); trace and Num values are right. Rerun: `GIAC_OUT=<dir> node tools/probes/twin-emitters.ts`. It overlaps G63 and audit-P3.
- **Latent** (no key reaches them; a door for Giac text will): 2.2's flag rows; text-2 to text-9 except text-1. text-10 is F54, already open.
- **The probes added**, each with a README row:
  - `giac-globals.ts`, `twin-emitters.ts`, `carriers.ts` and `text-misses.ts` (need `GIAC_OUT`);
  - `glue-growth.mjs` and `churn.py` (git only).
- **The one-liners cited:**
  - `GIAC_OUT=<dir> MODE=cas node tools/probes/engine.ts 'angle_radian:=0' 'evalf(sin(1))'`;
  - `GIAC_OUT=<dir> node tools/probes/engine.ts 'angle_radian:=0' 'sin(1)' 'asin(1)'`;
  - `node tools/probes/parse.ts '\operatorname{approx}\left(\sin\left(10^{30}\right),2\times10\right)'`;
  - the `pasheads` call of 2.4.
- **Oracle:** `tests/golden/.venv/bin/python -I -c "import mpmath as m; m.mp.dps=30; print(m.sin(m.mpf(10)**30), m.sin(1), m.tanh(1+1j))"`.
