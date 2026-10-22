<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Hindsight: what we would do differently, and what to do now

**Status (2026-10-22): open.** Decided: hind-1, the bridge (G85 GO; its moves G98–G105, S23); hind-3 is G88. Open for the owner: the hind-4 and hind-5 rule lines (decisions.md "Needs the user"); hind-2 rides on audit-P5 (G76 → G86 → R69).

*sandra, 2026-10-20, read and probe only, on `phase-1` `d6f6093`, after [the structure audit](structure-audit.md) the same day. The owner asked: with hindsight, what could we have done differently, and what would I suggest now? Evidence is file:line, a probe in `tools/probes/` or a count with its command. Labels, no ids: **hind-1** is the bridge (its three calls **bridge-1 … bridge-3**), **hind-2 … hind-5** the smaller suggestions.*

## 0. The answer

**With hindsight, the one decision I would change is the bridge to Giac.** In Phase 0 we connected to Giac through one C function, `caseval(text) → text` (`engine/giac/wasm/api.cc:30–33`, 62 lines in all). Everything since then talks to Giac by building strings and reading strings back:
- the 413 text matches of the audit;
- the five store lists that disagree;
- the `pasans:=` round trips;
- re()/im() split as text;
- the mode cache that trusts the settings.

Giac has every answer we keep re-deriving as typed data on its C++ side: the value's type, the numerator and denominator, the MPFR digits, the parse tree, every setting. Giac even ships the hook that hands its evaluator's context to code beside it (`caseval("caseval contextptr")`, `gen.cc:16851` onward). A few hundred lines of C++ in **our own** `api.cc` (no Giac patch) could return that as JSON.

**What I suggest now:** a one-day spike of that bridge **before** G72, G73 and G74 run (section 2). If it holds, those three packages shrink to "call the bridge", and the structure audit's audit-P1, -P2 and -P4 become simpler and more complete. If it fails, nothing is lost: the audit's plan stands as written.

The other four suggestions (section 3) are smaller and stand on their own:
- move the result-to-chip rule out of Svelte state;
- a ratchet that stops new text matches;
- golden cases through the keys;
- a deletion budget in the process.

## 1. What hindsight shows

### 1.1 The text bridge costs calls, code and bugs
`GIAC_OUT=<dir> STORED=1 node tools/probes/call-trace.ts` traces every Giac call of seven everyday Home inputs (`1/3`, `sqrt(2)`, `sin(1)+1/7`, a list, `x^2+1`, `floor(10*pi)`, `a*b+1`):

| Calls | Of them |
|---|---|
| 82 | 18 compute a value (`evalf(re(pasans),40)` …) |
| | 20 set up (`Digits:=40`, `Digits:=12`, our definitions) |
| | 17 store a value under our name so the next text call can reach it (`pasans:=(…)`) |
| | 25 ask about form: `re(pasans)` and `im(pasans)` as text, a bare name to see whether it is defined |
| | 2 other |

`SHOW=1` lists them. For `sqrt(2)` the 11 calls are: `sqrt`, `Digits:=40`, `pasans:=(sqrt(2))`, `Digits:=12`, `re(pasans)`, `im(pasans)`, `pasans`, then `evalf` of the real and imaginary parts at 40 and at 60. The gate's baseline says the same at scale: 3,063 calls for 257 Home inputs, about 12 per Enter (`tests/golden/calls-baseline.yaml`).

**The code cost** is the audit's 1.3: 256 of the 413 text matches are in `app/src/engine`, among them 71 SHAPE, 45 NAMES, 45 STATE, 24 BRACKET and 22 NUMBER (inventories A and B).

**The bug cost:**
- the audit's cause 2: 25 rows, plus open F54, F57 and F58;
- text-1 to text-10;
- family 5's print forms (`0.-000`, `x×x`, `1*i`).

### 1.2 Why it went this way
- **The spike only proved it ran.** `caseval` was the quickest path to a running CAS in wasm, and the spike needed nothing more.
- **The IR question came up once, on 2026-10-19** (multi-engine-answer.md 3.1, now P20). It was weighed as **our parser's** tree crossing the worker boundary. It was set aside because library files, the log, chips and Giac's output never had a tree of ours.
- **That reasoning is right about our tree and misses Giac's.** Giac parses every one of those texts itself, and it does so without running anything: `quote(…)` with a head walk shows `cnt+=1`, `cnt++` and `increment(cnt)` as one node (structure-audit.md 2.4).
- **The walk was dear only because it was written in Giac's language.** It costs 0.5 ms per call that way, against 0.01 ms for the native `lname`. In C++ it would be a native walk (to verify, section 2).

### 1.3 Domain rules live in Svelte state, so the gate tests a copy
- 2,920 lines sit in 13 `.svelte.ts` files that declare 54 runes in all (`grep -c '\$state\|\$derived\|\$effect'`): most of it is plain logic.
- The golden gate runs under plain `node` (`app/package.json:15`), which cannot import a rune file. So the rule "turn an engine result into a history item and a chip" exists twice: in `state/session.svelte.ts:533–544` and `:557–583`, and as a copy in `goldenRun.ts:140–153`, whose own comment says it "follows the session's rule". G49f2 was that copy drifting.
- F53 is the same shape. The Solve app's rune file sends the 12-digit display as a known (`apps/solve/app.svelte.ts:276`, `:312`), and no Node-run gate runs that code.

### 1.4 The gate mostly bypasses the keys
- 529 of the 579 Home and precision golden cases enter as Giac text. Only 23 of 305 in `home.yaml` and 27 of 274 in `precision.yaml` carry `latex:` (`grep -c 'latex:' tests/golden/*.yaml`).
- `parser.yaml`'s 595 cases check the text the parser emits, not the value and mark the user sees.
- So the path users take (keys → LaTeX → parser → engine → mark) is checked end to end by about 50 golden cases and the e2e suite, which takes 4.4–7 min a round.

### 1.5 The process adds, it does not consolidate
- **1,044 non-merge commits:** 451 `docs`, 73 `report`, 177 `fix`, 158 `feat`, 136 `test`, **6 `refactor`** (`git log --no-merges --format=%s d6f6093 | sed -E 's/^([a-z]+).*/\1/' | sort | uniq -c`). More fix commits than feature commits.
- **25 of the 164 merges that touch `app/src` are fix packages (`…f1`, `…f2`).** In `app/src/engine`, merges added 238 pattern lines and removed 26 (audit 1.5).
- **P17's refactor freeze** ("no refactor before milestone 4a is done") protected the parser and `App.svelte`, as meant. It also held the engine's cleanup back until P20 made an exception on 2026-10-20.
- **The docs are about 2.0 MB against about 1.06 MB of app source** (`du -sb docs`). The budgets sit at their edge: backlog 20.0 of 20 kB, brief 27.4 of 28, docs/04 69.9 of 70, decisions 38.8 of 40 (`node tools/docs-check.mjs`).
- **The cost of the budgets:** every package that adds a line must also trim one. This audit did so too: the backlog had to lose a line to take two bug lines.

### 1.6 What hindsight says was right
- **Every expected value has a `source:`** (oracle, derived, device). That is why the audit could test its claims instead of trusting them.
- **The engine sits in a worker behind one cancellable interface.** No bug row traces to the boundary.
- **Route R, decided by a research package,** removed a hidden global and closed 12 rows. It is the model for every proposal here.
- **Probes kept in the repo.** Each finding here reruns with one command.
- **MathLive kept as it is**, with no fork and no patch file (`app/patches` does not exist). Our layer around it has been quiet since the grids landed on 2026-10-15 (audit 2.7).
- **Typed code:** 2 `any` and 12 casts in `app/src` (`grep -rnE ':\s*any\b|as any\b'`; `as never|as unknown as`).

## 2. hind-1: a structured bridge, as a spike first

### 2.1 What the bridge is
It is three new exported C functions in `engine/giac/wasm/api.cc`, beside `giac_eval`, working on the context that `caseval` uses (`caseval("caseval contextptr")` returns it):
- **bridge-1, the context as data:** `giac_ctx_get()` returns every setting as JSON (`angle_radian`, `approx_mode`, `complex_mode`, `complex_variables`, `integer_format`, `scientific_format`, `decimal_digits`, `epsilon`, `increasing_power`, `all_trig_sol`, `xcas_mode`; the accessors are `global.h:873–1042`). `giac_ctx_set(json)` sets them. This is audit-P1's "one context" with nothing to parse, and it cannot miss a field the way a list of probed names can (`integer_format` today).
- **bridge-2, the parse as data:** `giac_parse(text)` builds Giac's tree without evaluating (`gen(text, ctx)`) and returns, as JSON:
  - the heads that occur (`sto`, `increment`, `purge`, `DelVar`, `floor`, `tanh` …);
  - the names read, the store targets and the names a command binds;
  - whether a float literal occurs.

  Strings are leaves, so a `:=` inside a string is never a store. This answers what the NAMES and STATE readers guess today, for typed input, library files, the log and chips alike.
- **bridge-3, the value as data:** `giac_value(text, precisions)` evaluates once and returns:
  - the kind (integer, rational, float, complex, list, matrix, symbolic, string, error);
  - the exact text Giac prints (for display, copy and the chip);
  - a rational's numerator and denominator;
  - the real and imaginary parts as decimals at each precision asked;
  - a list's elements.

  This folds the 11 calls of 1.1 into one or two, and replaces the SHAPE and most NUMBER readers.

It is **not a Giac patch**: `api.cc` is our file, compiled with Giac. It changes no Giac behaviour, and P19's register is not touched. It is also **not a rewrite**: today's `giac_eval` stays, and each caller moves when its gate passes.

### 2.2 What it would remove
| Today | With the bridge |
|---|---|
| G67's `cas_setup()` read and compare; flags found by probing | bridge-1: set every field before user text, read them after; no list to keep |
| G65's `lname(quote(…))` call; G72's nine regex alternatives; the five store lists | bridge-2's heads and names |
| G73's lexer and property test; G74's move of 14 splitters | only for what is left (the parser's own LaTeX, Giac's latex for display) |
| `pasans:=`, `re()`, `im()`, the bare-name checks: about 40 of 82 calls in 1.1 | bridge-3, one call |
| `hasFloat`, `shapeOf`, `splitList`, `rationalValue`, the `0.-000` and `1*i` print fixes | fields of bridge-3 |

The engine's 256 text matches would drop by roughly the SHAPE, NAMES, STATE and BRACKET rows: about 185 of them (an estimate from the inventory's kinds; to verify by the spike's line count).

### 2.3 The spike (brief format; not in the brief, the owner decides)

#### gorge, the structured bridge spike, branch `p1/gorge-bridge-spike`
**Lane:** day (an engine build, about 5 min, under the host-cpu lock), Opus. **Starts when:** before G72, G73 and G74 start; G67 as amended by audit-P1 may run before or after (it uses `cas_setup()` and can switch to bridge-1 later). Nothing merges into `app/src` except the probe; the decision comes from its report.
**Read:**
- this note 2.1;
- the structure audit 1.3 and 2.4;
- `engine/giac/wasm/api.cc` and `build-wasm.sh` (the exports near line 184);
- in the pinned tarball: `gen.cc` (`caseval` near line 16851, its interrupt handling), `dispatch.h` (the type tags), `global.h` (the settings accessors);
- `app/src/engine/nodeGiac.ts` (how the exports are wrapped);
- `tools/probes/call-trace.ts` and `tools/probes/text-misses.ts`.

1. **Tests first:** `tools/probes/bridge.ts` (tracked, README row) runs every `home.yaml` and `precision.yaml` input and every text-1 … text-10 input both ways. It fails on phase-1, which has no bridge:
   - today's host;
   - bridge-2 and bridge-3, compared with today's readers: names, stores, kind, exact text, digits at P and P + 20.
2. **The C++:**
   - bridge-1 to bridge-3 in `api.cc`;
   - interrupts and the sub-second timeout handled as `caseval` handles them (patch 0002);
   - a result over 2 kB returns its kind and a cut text, as the chip rule does;
   - the exports added in `build-wasm.sh`;
   - `tests/engine/interrupt-test.mjs` passes.
3. **Measure**, desktop, Node:
   - the cost of each bridge call against the call chain it replaces (`call-trace.ts`);
   - the walk on a 200-function library (A12's bench);
   - the wasm size before and after;
   - the release container build (`build-wasm-release.sh`) still reproducible, or what breaks.

**Done when:** the report gives, for each of bridge-1 to bridge-3:
- the mismatches against today's readers, each one a bug of ours or of the bridge;
- the cost;
- the readers it would delete, with their line count;
- go or no-go against these bars:
  - no golden value changes;
  - a Home Enter makes at most half today's calls;
  - the 200-function walk stays under G83's 50 ms;
  - the release build stays reproducible.

**Would change if:** the interrupt cannot be handled outside `caseval` without a Giac patch (then bridge-3 waits, bridge-1 and bridge-2 go ahead); or Giac's C++ types change at the next pin in a way the canaries (S17) cannot catch.

### 2.4 Risks
- **The C++ ties us to Giac's C++ types.** Those types have been stable for a long time (to verify, gorge: the `dispatch.h` tags in the numbered Debian archive against our snapshot, during G77). A canary per field in `tests/engine/` catches a change at a re-pin.
- **The build must stay F-Droid-clean.** `api.cc` is source we already compile, so that holds; the release container must also build it (the spike measures it).
- **Two ways to talk to Giac during the move.** Each caller moves in its own package behind the golden gate, and `giac_eval` stays for what has not moved.

## 3. Four smaller suggestions

### hind-2: the result-to-chip rule moves out of Svelte state (with audit-P5)
- **Why:** 1.3. The golden gate tests a copy of the session's rule, and the Solve app's known value is built in a rune file no Node-run gate runs.
- **Change:** `state/results.ts`, pure, turns an engine result into the history item's `full`, `fullExact`, facts and chip. `session.svelte.ts` and `goldenRun.ts` both import it, and the copy at `goldenRun.ts:140–153` goes. With the bridge, the engine returns most of it and the module gets shorter.
- **Cost:** half a day, inside audit-P5's first step. **Rule from then on:** a rune file holds state and calls, not rules.

### hind-3: a ratchet on text matches, in the gate
- **Why:** 1.5. P20 forbids new bracket loops and name regexes, and only review enforces it; 36 packages added engine pattern lines.
- **Change:** `app/scripts/gate.ts` gets a `rules` stage. It counts pattern lines over text per file in `app/src/engine` (`glue-growth.mjs`'s pattern) against a checked-in baseline. A count that rises fails the stage unless the package's report names the line and its reason; a count that falls lowers the baseline. The same stage checks `giac.eval` outside `app/src/engine/`.
- **Cost:** 2 h. It makes the audit's numbers go only one way.

### hind-4: golden cases through the keys
- **Why:** 1.4. 529 of 579 Home and precision cases skip the parser.
- **Already there:** the runner already sends a case written as `latex:` through our parser and checks its value and mark (`app/src/goldenRun.ts:179–182`, `app/scripts/golden.ts:408`). So no runner change is needed.
- **Change:** a rule, not a package: a new Home or precision case is written as `latex:` when the keys can type it (rules section 9). G61's generator builds keyboard LaTeX, so its sweep covers the old Giac-text cases.
- **Cost:** one rule line.

### hind-5: a deletion budget in the process
- **Why:** 1.5. 6 refactor commits in 1,044; fix packages repeat one pattern.
- **Changes:**
  - every eighth night step is a consolidation package, whose "Done when" is net lines removed in `app/src/engine` (`glue-growth.mjs`), with the golden gate unchanged;
  - a package text says "cause" or "symptom" (audit section 4);
  - the backlog's "Open bugs" and the queue table are generated from the package files and the known-failures lists. Fewer hand-kept lines then sit at the docs budgets, and the docs stop growing faster than the code.
- **Cost:** the first two are rule lines in `docs/shifts/rules.md`; the generator is half a day (A-lane).

## 4. The order I would take
1. **G58**, as queued: a hang hides everything.
2. **G67 as amended by audit-P1:** it must precede R4a, and it can move to bridge-1 later at no loss.
3. **The bridge spike (2.3), by day,** while G59 and G78 run at night.
4. **If the spike goes:** G65, G72, G73 and G74 are rewritten to call the bridge (smaller packages). **If it does not:** the audit's plan as written (G65 → G72 as a tree walk in Giac's language → G73/G74 narrowed).
5. **hind-3** right after the first engine package that removes matches, so the count holds.
6. **audit-P5 with hind-2**, before R36, R40, G81 and R61.
7. **hind-4 and hind-5** any time.

## 5. What I did not prove
- **The bridge's cost and completeness** come only from the spike. What is proven:
  - the hook exists (`gen.cc`);
  - the types and setting accessors exist (`dispatch.h`, `global.h`);
  - the data the bridge would return is there (`quote` and its head walk, `lname`, structure-audit.md 2.4).
- **"About 185 matches removed"** is an estimate from the inventory's kinds.
- **The device cost of a Giac call** (desktop 0.13 ms per call, `engine-calls.ts`; the Tab One 10–30× by the night check of 2026-10-19) is assumed, not measured for this.

## 6. How to rerun
- `GIAC_OUT=<dir> STORED=1 [SHOW=1] node tools/probes/call-trace.ts`: the calls per Enter.
- The audit's probes: `text-misses.ts`, `giac-globals.ts`, `glue-growth.mjs`, `churn.py`.
- Counts:
  - `grep -c 'latex:' tests/golden/*.yaml`;
  - the commit types with the `git log` line of 1.5;
  - `du -sb docs`;
  - `node tools/docs-check.mjs`.
- Giac's source: `engine/giac/_build/giac-2.1.0/src/gen.cc` (`caseval`), `dispatch.h:38–53`, `global.h:873–1042`, in a checkout where `build-wasm.sh` has unpacked the tarball.
