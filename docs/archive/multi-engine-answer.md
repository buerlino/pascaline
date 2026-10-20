<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Answer to the multi-engine risk report: what holds, what we accept, how we harden

**Status (2026-10-20): decided.** Section 0 is P18 (docs/04 6.1). H1 → G67; H2 → G73, G74 (P20; before R59, not R4a); H3 → G75 (P19); H4 → G76; H5 → S17; H6 → A21 (P22); H7 → rules sections 9 and 10, A22 and S18, with a per-file line baseline instead of a hard 800-line cap (the owner's change).

*2026-10-19, late evening, by Claude (Opus, the owner's session). Read and probe only: no code changed. Base `phase-1` `fab0ae7` (after G46 and Opus pass 31; the code is that of the G46 merge `2bee0fc`). This note answers [multi-engine-risk.md](multi-engine-risk.md): Part I, the outside report, and Part II, our first reply, which was written on `b1de57e`, 401 commits earlier. Every number below was measured or probed today on `fab0ae7` (section 7). H1–H7 are labels for this note only, not package ids; the ids and their place in the brief are the owner's. Sources besides the code: [bug-patterns.md](../research/bug-patterns.md) and [r16-verification.md](r16-verification.md) (both untracked), [docs/04](../04-architecture.md), [decisions.md](../decisions.md).*

## 0. The answer on one page

The report argues about running several engines. That part is answered: Pascaline runs one (Part II). But the report's real warning is about what kills such projects:
- seams where two pieces read the same input differently;
- global modes;
- a heavy native toolchain;
- upstream code we can't change;
- a maintenance load that grows faster than the people who carry it.

All five are present here, just not where the report looked.

| Report's point | Verdict | Where it shows here |
|---|---|---|
| The routing problem (4.2) | defend | no router; the view and the token kind decide |
| Crash isolation (4.3, 5.2) | defend | built, with a safe start and a memory cap |
| Thread safety (3.3) | defend | the wasm has no threads |
| Dependency hell (3.1), JS side | defend | 4 runtime packages |
| A tightly coupled monolith (6) | defend, mostly | the UI reaches maths through one port; the engine host runs in Node |
| An IR instead of text (5.3) | **accept** | inside our engine layer, Giac text *is* the IR: 14 hand-written bracket readers in 8 files |
| Global state (3.3) | **accept** | a Giac flag set by an input stays set; the host's mode cache trusts it (N1) |
| Upstream drift (3.2) | **accept, inverted** | a frozen pin whose bugs are unreported and worked around in TypeScript. Complex `tanh` is a one-line Giac bug with 282 net lines of our code around it |
| Toolchain (3.1), native side | **accept** | the slowest build step (libqalculate, 7.5–8 min) yields 29 kB of numbers |
| Abandonment (6) | **accept** | our layer over Giac and the docs grow faster than features |

**Part II's verdict needs one correction.** Part II says "one engine decides every number shown". On the evidence, one engine *evaluates* and a second engine of our own *decides*. That second engine is:
- about 2,950 lines in `numeric.ts`, `host.ts` and `homeEval.ts` (plus `converge.ts`, `solve*.ts` and `format.ts`);
- working on Giac's printed text;
- with 11 of our own definitions loaded into Giac.

Principle 3 justifies that layer, because Giac does not mark its own precision. But that layer is where the bugs come from now:
- 48 of the 86 non-merge commits on `phase-1` that touch `app/src/engine` are fixes, and 14 are features;
- it is where the repo grows fastest: the three files had 1,577 lines on 10-15 and 2,948 on 10-19.

The report's remedies for engines fit this layer:
- one reader of the input;
- no hidden modes;
- fixes at the cause;
- a known cost for changing Giac.

**Recommendation.**
- H1 now, before R4a puts Giac's state commands one tap away.
- H3 now, before G56, which would add more glue for the same `tanh` bug.
- H2 before R59 and R4a widen the inputs.
- H4 and H5 before the packages that need them.
- H6 needs a decision.
- H7 goes in the process lane.

Section 5 lists what each one removes.

## 1. Where the report does not apply (defend)

1. **No router.** Part II section 2 still holds on `fab0ae7`:
   - the view picks the path;
   - units are chips in unit slots;
   - input the parser can't read is an error, never a guess.

   Since Part II, route R (S14; R64 and G46, merged today) removed the one place where a mode changed what the same text meant to Giac. Giac now runs in radians in every mode, and our parser writes the degree factor into the text. G46's diff to `homeEval.ts` and `numeric.ts` is +34 −92 lines: taking a global out by construction deleted code. This is the report's "explicit modes", one step further: the mode lives in the text, not in the engine.
2. **Crash isolation is built.**
   - Giac runs in a Web Worker. Cancel or a crash means terminate, start a new worker and replay the definitions (`workerEngine.ts`).
   - A start that keeps failing skips the stored state: `MAX_FAILED_STARTS = 2` (`workerEngine.ts:45`).
   - Memory is capped at 1 GB (`engine/giac/build-wasm.sh:188`).
   - Patch 0002 makes Giac's interrupt fire in milliseconds.
3. **No threads.** `HAVE_LIBPTHREAD` is off in Giac's `config.h` (`engine/giac/patches/README.md`).
4. **Few dependencies, all pinned.**
   - Runtime npm packages: `@capacitor/android`, `@capacitor/core`, `jsxgraph`, `mathlive`. There are 10 dev packages.
   - The native code comes from SHA-256-checked tarballs, and the release build is byte-reproducible in a pinned container (P2).
5. **Not a monolith.**
   - The views reach maths only through the `Calc` port (`app/src/calc/engine.ts`). The only other engine imports in UI code are the number formatter (`format.ts`) and types.
   - The engine host is synchronous and UI-free, and it runs in Node. That is how the golden gate and every probe in this note run it.
6. **Tests with a source for every expected value.** `tests/golden/`: home 301, precision 231, units 136 and parser 588 cases, plus solve and function. All are checked by the mpmath oracle where one applies.

## 2. What Part II got wrong, or is now out of date

1. **Section 5, "data, not text", is wrong at the main crossing.**
   - The parser builds a tree, but the engine takes a string: `home(input: string, …)` (`app/src/engine/types.ts:184`).
   - The host then reads that string again with its own regexes:
     - `functionsIn` and `namesIn` (`numeric.ts:242`, `:250`);
     - `maskBound` (`host.ts:166`);
     - `simpleAssignment` and `STATEFUL` (`homeEval.ts:381`, `:372`).
   - It also uses 14 bracket and top-level splitters in 8 files:
     - `degrees.ts:23`;
     - `library.ts:55`, `:118`;
     - `numeric.ts:155`, `:173`;
     - `homeEval.ts:442`;
     - `host.ts:147`, `:201`, `:211`, `:911`;
     - `render/home.ts:46`;
     - `input/angles.ts:32`, `:61`;
     - `units/build.ts:268`.

     G46 added the newest one today (`app/src/engine/degrees.ts`).
   - Giac's printed text also comes back in as input: a chip's `full` value, the definitions log, library files, and `restoreLiterals` (`homeEval.ts:321`).

   bug-patterns.md names two causes here: "glue that works on text" and "one rule written twice". They sit under its families 1, 2, 8 and 9, which hold 54 of its 224 rows.
2. **Section 4 is out of date.** Route R removed the angle global (section 1). The leak that remains is general:
   - the host caches the mode by a key and applies it again only when the key changes (`useMode`, `host.ts:891`);
   - so a Giac flag that an input changes stays changed until the user changes a setting.

   N1 is the case found so far (bug-patterns.md section 4, probed on `0bd9631`; not probed again for this note): `approx_mode:=1` typed in CAS is logged and replayed at every start, and Home loses its `=` marks.
3. **Section 6 accepts the libqalculate build as "still paid in full"** and does not ask whether it is needed. Section 3.4 asks.
4. **Section 7 lists what one engine costs, but misses the largest cost:** our own layer (section 0).
5. **Section 9's proposals mostly have a home already.**
   - Proposal 1 is backlog "Needs the user" item 8: the email to Parisse.
   - Proposal 3 is G63 (r16, proposed).
   - Proposal 4 is N1 (bug-patterns.md, no id yet) plus G62 (r16, sequences).
   - Proposal 2 is folded into H6.

## 3. What we accept, with the evidence

### 3.1 Text is the interchange format inside our layer (report 5.3)
The evidence is in section 2, item 1. Each text helper reads the forms its author thought of and misses the next one. G49 needed four follow-ups in one night, each "one more way to write a definition" (S13's package text).

A new IR across the worker boundary would not fix this. Library files, the definitions log, chips and Giac's own output never had a tree, so a reader of Giac text is needed anyway. What removes the drift is **one** reader, checked against Giac's own parser at test time (H2).

Results lose facts at text boundaries, and they also lose them at type boundaries. The port copies `HomeResult` into `HomeOutcome` one field at a time (`app/src/calc/engine.ts:46`), and today it drops `why`, `uncDigits` and `tieRisk`. No view reads them yet, so nothing wrong is shown. But R36 (why the mark) and R40 (muted digits past a constant's σ) need the first two, and the next field added to `HomeResult` will be dropped the same way (H4).

### 3.2 Global modes outlive the call (report 3.3)
Probes on `fab0ae7` (section 7):
- `cas_setup()` returns Giac's mode in one 12-field list, and that list shows the changes from `approx_mode:=1`, `Digits:=20` and `epsilon:=1e-9`. One Giac call per Enter can therefore check that nothing an input did is left behind.
- `VARS()` after `beam:=3`, `approx_mode:=1`, `f(x):=x^2` and `epsilon:=1e-10` returns `[all_trig_sol, beam, f, pasdeg]`, without `approx_mode` and `epsilon`. Giac itself separates the user's names from its flags.

Today the guards are deny-lists, such as the library's `STATE_WORDS` (`library.ts:22`, "A guard, not a proof"). S13 already asks whether `VARS()` should replace the text rules for stored names; its start gate (G48) is met and it has not run. These probes add one fact to S13's question: `VARS()` also keeps Giac's flags out of the log. Probed so far: `approx_mode` and `epsilon`.

### 3.3 Upstream drift, inverted (report 3.2)
Our risk is not that Giac changes under us: Giac 2.1.0 is pinned. The risk is that we freeze its bugs and build around them.

The clearest case is complex `tanh`:
- In Giac's source, the MPFR complex branch of `tanh` returns `(g+1)/(g-1)` with `g = exp(2z)` (`giac-2.1.0/src/usual.cc:2673`). That is coth.
- The probe at 30 digits gives `tanh(1+i)` = 0.868014142896 − 0.217621561854i. Giac's own double path at 12 digits gives 1.08392332734 + 0.27175258532i, and mpmath agrees with the double path.
- The fix in Giac is one line: `(g-1)/(g+1)`.
- What we did instead:
  - G50 and G50f1 added 282 net lines to `numeric.ts`;
  - our own `pastanh` (`numeric.ts:71`);
  - a text rewrite of every `tanh(` call (`complexSafe`, `:88`);
  - `forValue` (`:94`);
  - `complexReads` (`:295`): a stored name or function whose text calls `tanh` would still hit Giac's bug, so each one is read through a copy, at one Giac call per name and up to 40 names.
- The chain is still growing. G56, queued for the night, extends the copies to the CAS view, and its probe case is `tanh` inside a stored function.

The same holds for the rest of the backlog's "Upstream reports" list:
- the two patches;
- about a dozen wrong Giac values or behaviours: `normald_icdf`, `UTPN`, `romberg`, `BesselJ`, `median`, `round(-2.5)`, `sign` at `Digits`, principal values, `tanh`, `asin`, `acos`, `atan`, `acosh`.

None is marked as sent. Each workaround adds to the cost of the next Giac upgrade, because each must be checked again, and today no list says which are still needed (H3, H5).

### 3.4 The native toolchain: the slowest step builds data (report 3.1)
`build.sh` step 1c builds libqalculate in the release container. That build takes 7.5–8 min (docs/04 7.1). For scale, a clean Giac build takes about 5 min (CLAUDE.md; a different build, so the comparison is rough). It also brings two more tarballs (libxml2 and libqalculate) and their builds into every F-Droid build. Nothing of it ships (P15).

What the build is for: the Find index takes `si`, `dim`, `value` and `unc` from it, for 546 items (441 units, 71 constants, 34 prefixes). That is 29 kB as JSON. The names and titles come from qalc's XML, which the generator reads with its own XML reader, with no build. Of those numbers, 16 are already overridden because qalc's data is wrong: hp, mmHg, inHg and 13 CODATA 2022 values (`find/units.yaml`, G13).

So we compile a C++ library for eight minutes to compute a table we already audit (G13). A side finding: `fdroid/README.md:9` still says nothing of qalc goes into the APK "until the Units app (milestone 5)". Since P15 it never does.

### 3.5 The maintenance load (report 6, "abandonment")
Measured on `phase-1`, `master..fab0ae7`:

- **Pace and kind of work.** 658 commits in six days. Of the 522 that are not merges:
  - 213 are `docs` and 48 are `report`;
  - 117 are `fix` and 50 are `feat`;
  - 2 are `refactor`.

  A fix chain fixes one form at a time: G49 had four follow-ups, G38 two, G50 one. Nothing then joins the copies.
- **Size.** Production code in `app/src` is 21,765 lines (0.99 MB). Tracked docs are 1.44 MB:
  - archive 0.50 MB;
  - research 0.30 MB;
  - top-level 0.29 MB;
  - shifts 0.20 MB;
  - mockups 0.17 MB.
- **The docs diet works as a cap, but the caps are nearly full a day later.**
  - brief: 26.7 of 28 kB;
  - backlog: 18.8 of 20 kB (12.4 kB right after the diet on 10-18);
  - decisions: 35.5 of 40 kB.

  `docs/research/` has no cap: 19 tracked notes and 299 kB. Five of them are check reports, not research (99 kB). Four more appeared today, untracked: bug-patterns 55 kB, r16 31 kB, bug-hunt 26 kB, and the risk report 31 kB. This answer adds to it, so H7 applies to this note too.
- **Open work.** There are 53 package files.
- **Largest source files.**
  - `numeric.ts`: 1,217 lines (611 on 10-18);
  - `parse.ts`: 1,212;
  - `host.ts`: 986;
  - `App.svelte`: 893;
  - `homeEval.ts`: 745.

None of this is fatal today. The tests and gates are strong, and the boundaries hold (section 1). But the trend is the report's "drown in edge-case bug reports", with a different cause: helpers that fix one form at a time and never merge, and notes that never retire.

## 4. The hardening packages

Ranked by importance (silent wrong answers, then robustness, then build, then process), then by dependencies. Each is one concern of a day or less. When adding them to the brief, put them in the existing lanes.

### H1. Giac's flags: checked at every call, never logged (gorge, ≤ 1 d, starts now, before R4a)
- **Why:** N1 and N2 (3.2). This is bug-patterns.md's first lead and Part II's proposal 4, as one package.
- **Change:**
  - After every user input, the host reads `cas_setup()` (one call) and compares it with the mode it set.
  - On a difference, it restores the mode, clears the mode-cache key, and the result line says the setting was not kept, in words from the i18n table.
  - The definitions log never stores a Giac flag name.
  - Find marks or hides `cas_setup`, `restart`, `purge` and `assume` (tier 1 today, bug-patterns.md).
- **Tests first:** N1's sequences as golden sequence cases: CAS `approx_mode:=1`, then CAS `1/3`, Home `1/4`, a relaunch, and `approx_mode:=0`.
- **To verify in the package:**
  - flags outside `cas_setup()`: `HAngle`, the parser mode `xcas_mode`, `increasing_power`, `all_trig_sol` (once assigned, `VARS()` lists it like a user name), the timeout and the power limit;
  - the cost: +1 call per Enter against `tests/golden/calls-baseline.yaml` (G52). Raising the baseline is one line with this package's reason.
- **Removes:** the N1 class of bugs; `STATE_WORDS` stays only as a message.
- **With S13:** run S13 now (its gate is met). If it recommends `VARS()`, the log's allow-list comes from there, not from a new regex.

### H2. One reader of Giac text (gorge, two packages of ≤ 1 d; after H1, before R59 and R4a)
- **H2a, the reader.** `app/src/engine/giacText.ts`, one tokenizer that knows:
  - strings and comments;
  - numbers with exponents (`2e5` is not a name);
  - identifiers and brackets;
  - `matching`, `topLevelArgs`, `splitTop`, `namesIn`, `functionsIn`;
  - bound variables, from one table of the commands that bind (today's `maskBound`).

  It needs no imports, so the engine, the parser and the units code can all use it.
- **Its test is a property test against Giac.** Inputs:
  - every input of `home.yaml`, `precision.yaml`, `parser.yaml` (the Giac side) and `units.yaml`;
  - every text Giac prints for those inputs.

  For each one, the names and calls our reader finds must equal Giac's own parse: a `sommet`/`feuille` walk of `quote(…)`, and `lname` where it applies. That is the repo's rule "another engine checks at test time", applied to our own reader.
- **H2b, the move.** The callers of the 14 splitters and the regex readers move to it, and the copies are deleted.
  - Gate: the golden gate unchanged, and `calls-baseline.yaml` unchanged.
  - Rule from then on: new code that reads Giac text imports `giacText.ts`. Review checks for a new bracket loop.
- **Why not send the tree to the worker instead:** most text that reaches Giac never had a tree (3.1). If H2a's property test shows a gap the reader can't close, carrying facts from the tree can come later, for the parser path only.

### H3. Giac's wrong values fixed in Giac's source (gorge, then annabell for the release build; ≤ 1 d; starts now)
- **Patch `0003-complex-tanh-mpfr.patch`:** `usual.cc:2673`, change `(g+1)/(g-1)` to `(g-1)/(g+1)`. Its row goes in `engine/giac/patches/README.md`.
- **Tests first:** `tanh(i)`, `tanh(1+i)` and `tanh` of a stored complex at 12, 30 and 50 digits, against the oracle.
- **Then:** `pastanh` leaves `COMPLEX_DEFINITIONS`.
- **Check in the same package whether `asin`, `acos`, `atan` and `acosh` can be fixed the same way.** Giac has no MPFR path for them on complex arguments, so the patch size is to verify. If all five go into the patch, then `complexSafe`, `forValue`, `complexReads` and their callers go too. That is about 100 lines in `numeric.ts`, and every stored-name copy, which also reduces Giac calls.
- **The rule, for CLAUDE.md and CONTRIBUTING.md (the owner's OK):**
  - a wrong value whose cause is local in Giac's source gets a patch, a canary (H5) and an upstream report;
  - a TypeScript workaround needs a written reason in its package report;
  - this applies CLAUDE.md's "fix Giac bugs upstream; keep local patches minimal": a one-line patch is minimal, and 282 lines of glue are not.
- **Why now, and before G56:** G46 is merged, so `complexReads` no longer has DEG branches. G56 (queued) adds another copy path for a `tanh` inside a stored function in CAS. With the patch, G56's own probe case is right without it. If the patch covers all five functions, drop G56; if it covers only `tanh`, narrow G56 to the inverse functions.

### H4. The port carries every fact (ron or gorge, ≤ 0.5 d, before R36 and R40)
- **Change:** in `EngineCalc.home`, `cas` and the other methods (`app/src/calc/engine.ts:46`), replace the field-by-field copy. The new mapping must give every key of `HomeResult` (and `CasResult`) one of two outcomes, checked by the compiler:
  - it is copied;
  - or it is listed as dropped on purpose, with a reason (the timings).
- **Test:** one test that a new field added to the engine's result type reaches the view or fails to compile.
- **Removes:** the carrier pattern of bug-patterns family 1 at this boundary.

### H5. A register of our workarounds, with canaries (sandra or gorge, ≤ 0.5 d, any time before the email to Parisse)
- **Change:** one table in `engine/giac/patches/README.md`, "Workarounds in our code". Each row is one rewrite or definition that exists because of a Giac behaviour:
  - `COMPLEX_DEFINITIONS`, `pasmod`, `pasmedian`, `paspercentile`, `restoreLiterals`;
  - G38's decisions at a higher precision, G39's refusals, G42's tie rule, and the others.

  Each row gives the Giac behaviour, a probe, the backlog's upstream line, and a **canary**: a test in `tests/engine/` that asserts the behaviour is still there.
- **Gain:**
  - a Giac upgrade prints which workarounds it makes dead, so its cost is known before it starts (the report's 3.2, for a pinned engine);
  - the email to Parisse can be written from the table.
- **Removes:** guesswork at the next pin; Part II's proposal 1 becomes a list, not a memory.

### H6. libqalculate out of the build (decision first; then annabell and gorge, ≤ 1 d)
- **Change:**
  - Check in `find/factors.yaml`: id, `si`, `dim`, `value` and `unc` for the 546 items, about 30–40 kB as YAML. Each row names its source: an exact definition, CODATA 2022, or "libqalculate 5.13.1". The 16 overrides become plain rows with their source.
  - The generator reads the numbers from the file. It keeps reading names and titles from the qalc tarball's XML, which needs no build.
  - A dev-only tool, `tools/find-index/refresh-factors.mjs` (it runs when a developer chooses, like `oracle.py`), builds qalc, recomputes the numbers and prints the diff. A change needs a `units.yaml` case or the owner's OK. This is Part II's proposal 2, run when it matters.
  - `build.sh` loses step 1c, and the F-Droid recipe loses the libxml2 and libqalculate builds.
- **Gain:**
  - 7.5–8 min less in every release and F-Droid build;
  - one wasm fewer to keep reproducible;
  - a simpler recipe.

  `engine/qalc/build-wasm.sh` stays, for the refresh tool.
- **Cost:** the numbers become ours to keep. In practice they already are: G13 audits them against CODATA and the exact definitions, and we keep 16 overrides.
- **Licence and F-Droid:**
  - qalc's data is GPL-2.0-or-later, which is fine in a GPL-3.0-or-later repo. `THIRD_PARTY.md` keeps its row, as "data only".
  - The file is text, and once we audit it, it is the form anyone would edit to change it. That makes it source, not a prebuilt binary.
- **What it changes:** docs/04 7.1 and the build half of P15. docs/04 7.1 rejected "values from the oracle venv" as a second source of truth. This proposal has a single source of truth: the checked-in file.
- **Would change if:** F-Droid's reviewers object to checked-in derived data (to ask), or the unit view needs a qalc feature at runtime (none is planned).

### H7. Budgets for code and research, and a consolidation rule (A lane for the check, ≤ 0.5 d; sandra for the notes, ≤ 0.5 d)
- **A line budget per source file** in `tools/docs-check.mjs`, or a sibling size check that the pipeline already runs. Proposal: 800 lines.
  - Over it today: `numeric.ts`, `parse.ts`, `host.ts` and `App.svelte`.
  - A file over budget fails the check, unless the package splits it or the owner raises its budget with a reason. That is the `calls-baseline` rule, applied to size.
  - Split along seams the code already names:
    - `numeric.ts` by its three checks (symbolic, re-evaluated, float fallback), plus the complex part (whatever H3 leaves);
    - in `host.ts`, the text readers go to H2's module, and the facts code (`inherited`, `fnFacts`, `storeFacts`, `bodyFacts`, `readFacts`, `callFacts`) to its own file.
- **A consolidation rule for the brief:** when a fix chain reaches its second follow-up, the next package in that family removes the shared cause instead of adding another fix. bug-patterns.md's families say where the cause is.
- **Research notes with an end:**
  - Each note's first line states whether it is open or decided, and names the decision and the package ids.
  - A decided note moves to `docs/archive/` within a week; its history stays in git.
  - The five check reports (`night-shift-check-2026-10-18`, `-2026-10-19`, `check-2026-10-19`, and both `deep-check-2026-10-19-*`) move to `docs/shifts/` or the archive.
  - docs-check gets a budget for live research notes. Proposal: 150 kB.
  - This note and the risk report follow the same rule: once H1–H7 are packages or refused, both move to the archive.

Not new, and still endorsed:
- G63 (the Plot evaluator against Giac; Part II's proposal 3);
- G62 (sequences);
- C3 (CI), which stays the owner's call. Its value grows with the first outside contributor.

## 5. Order, and what it removes

| Step | Starts when | What goes away |
|---|---|---|
| H1 (+ S13) | now; before R4a | the N1 class: Giac flags that stick and replay; deny-lists as the defence |
| H3 | now, before G56 | `pastanh` and G56's `tanh` case; with the inverse functions too, `complexSafe`, `forValue`, `complexReads` (≈ 100 lines and their Giac calls) and G56 |
| H4 | before R36 and R40 | silent drops at the port |
| H2a, H2b | after H1; before R59 and R4a | 14 splitters and the regex readers, down to one module |
| H5 | any time; before the Parisse email | guesswork at the next Giac pin |
| H6 | after the owner's decision | build step 1c, libxml2, a wasm build, 7.5–8 min per release and F-Droid build |
| H7 | the process lane | unbounded files and notes; fix chains with no end |

**What would change this answer:**
- the `cas_setup()` read costs more than the Enter budget on the Tab One;
- H2a's property test shows a Giac form that no reader of ours can match;
- Parisse takes the patches upstream (then H3's patch drops at the next pin, and H5's canaries say which workarounds go with it);
- F-Droid refuses checked-in derived data (H6).

## 6. Needs the owner
0. **Hold G56 (night queue step 37) until H3 has run.** It is time-sensitive, because the night queue may reach G56 first. I recommend yes: G56 adds a third layer of glue for the bug that H3's one-line patch fixes.
1. **H6: take libqalculate out of the build.** This changes docs/04 7.1 and the build half of P15. I recommend yes: it is the slowest build step, and its output is a table we already audit.
2. **H3's rule in CLAUDE.md and CONTRIBUTING.md:** a patch at the cause, and a written reason for any workaround in TypeScript. I recommend yes.
3. **H7's budgets:** 800 lines per source file and 150 kB of live research notes. I recommend yes; the numbers are a starting point, and changing one is a one-line edit.
4. **Ids for H1–H7,** agreed with the other sessions. H1 is the package bug-patterns.md recommends for N1. S13 can run now.
5. **Where the two notes live.** The risk report is untracked in the main checkout, on `p1/sandra-padlayout`, which is 401 commits behind `phase-1`. I copied it unchanged next to this note in the `phase-1` worktree, so the links work. Both are uncommitted; the main checkout's copy can go once you commit these.

## 7. Probes run for this note (on `fab0ae7`, engine `engine/giac/_out/gsl`)
- `MODE=raw node tools/probes/engine.ts 'cas_setup()' 'approx_mode:=1' 'Digits:=20' 'epsilon:=1e-9' 'cas_setup()'` gives `[0,0,0,1,0,[1e-12,1e-15],12,…]`, then `[1,0,0,1,0,[1e-09,1e-15],20,…]`.
- `MODE=raw … 'VARS()' 'beam:=3' 'approx_mode:=1' 'f(x):=x^2' 'epsilon:=1e-10' 'all_trig_sol:=1' 'VARS()'` gives `[pasdeg]`, then `[all_trig_sol,beam,f,pasdeg]`.
- `MODE=raw … 'approx_mode' 'epsilon' 'complex_mode' 'Digits' 'angle_radian' 'all_trig_sol' 'HAngle' 'foo'` gives `0`, `1e-12`, `'complex_mode'`, `12`, `1`, `all_trig_sol`, `-2` and `foo`. So "evaluates to itself" is not a safe test for a user name; `VARS()` is better.
- `MODE=raw … 'Digits:=30' 'evalf(tanh(1+i))'` gives `0.868014142895924948635849208916-0.217621561854402681365134243605*i`; the same at `Digits:=12` gives `1.08392332734+0.27175258532*i`. mpmath `tanh(1+1j)` gives `1.0839233273386946+0.2717525853195118j`.
- `lname(sum(x^2,x,1,10)*B)` gives `[B]`, but `lname(quote(f(x):=x*B+2))` gives `[x,B,f]`. Giac's `lname` does not mark bound variables in quoted text, so H2a walks the tree instead.
- Counts: `git log --no-merges master..fab0ae7` by subject prefix; `git rev-list` by date for the file sizes; `node tools/docs-check.mjs` for the budgets; the Find index fields from `app/src/find/_gen/find-index.json` (generated 2026-10-19 17:20).
