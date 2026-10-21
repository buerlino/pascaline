<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Report: the structure audit (sandra, 2026-10-20)

Worktree `p1/sandra-structure` from `phase-1` `d6f6093`; read and probe only. Nothing is committed: the owner reads it first. The night shift's worktree and branches were not touched. No device was used and no build was run. The engine probes used the main checkout's `engine/giac/_out/gsl` and, through a symlink in this worktree (`app/node_modules`, gitignored), the main checkout's `app/node_modules`.

## What I verified
- **Churn and fix commits per file** (`tools/probes/churn.py`): the centre is `host.ts`, `homeEval.ts` and `numeric.ts`, each with four to six jobs. `parse.ts` is not a centre.
- **Glue added per package** (`tools/probes/glue-growth.mjs`): in `app/src/engine`, merges added 238 pattern lines and removed 26; one package removed more than it added.
- **413 text matches in `app/src`**, one per line ([appendix](../structure-audit-inventory.md), by three helper agents). The confirmed misses rerun in `tools/probes/text-misses.ts`.
- **Giac flags typed by the user** (`tools/probes/giac-globals.ts`):
  - the mode cache lets `angle_radian:=0` change the next `sin(1)` in the same view: Home shows `≈ 0.0174524064373` with 38 digits confirmed;
  - `integer_format(16)` is outside `cas_setup()`;
  - the log stores flags as entries that mean something else.
- **The two emitters of one tree agree on 516 of 520 pairs** (`tools/probes/twin-emitters.ts`); the DMS template loses its seconds in the plot.
- **The Calc port drops `why`** on every ⚠ result (`tools/probes/carriers.ts`).
- **Giac's parse tree answers "does it store"** without running anything (`quote` and a head walk); it costs 0.5 ms per call as a Giac program, and `lname` costs 0.01 ms.

## What I changed
- New:
  - `docs/research/structure-audit.md` (the note);
  - `docs/archive/structure-audit-inventory.md` (the appendix; a snapshot, so in the archive);
  - six probes in `tools/probes/`, with README rows.
- `docs/backlog.md`:
  - two "Open bugs" lines (audit-approx, audit-dms-plot), both reachable today;
  - "Needs the user" item 2 now points to the audit. The list of decided items it held is in decisions.md, and the line had to shrink to keep the backlog inside 20 kB.
- `docs/decisions.md`: a "Needs the user" entry, "Structure audit".
- On phase-1, with the owner's OK (`16405c4`, under the `integ` lock): G67's package widened as audit-P1; G69, R69, G66, G72, G73, G74 and G76 held in the night queue; `giac-globals.ts` added there.
- `node tools/docs-check.mjs` passes. backlog.md is at 20.0 of 20 kB.

## Still (to verify), and who
- **The cost of the per-Enter fallback** (`sommet(quote(…))`): gorge, in G72.
- **The tree walk on a 200-function library:** gorge, with A12's bench.
- **The context fields in `global.cc`:** gorge, in G67.
- **`entry/kept.ts:26` with a damaged chip store:** ron, a unit test.
- **The rows-per-cause split** is my reading, row by row.

## Top risks
1. **R4a or R59 lands before G67 is widened.** Every Giac flag then becomes reachable, among them `angle_radian`, which gives wrong values under `≈`.
2. **G72 runs as written.** It adds nine regex alternatives to five store lists that already disagree, the pattern of the G49 chain.
3. **G76 runs as a field-by-field port fix.** G68, R69, G81 and R61 would then each add one more field to one more carrier.

## Second part: hindsight (the owner's follow-up question)
- **New:** `docs/research/structure-hindsight.md` and `tools/probes/call-trace.ts`, with a README row. One sentence added to the decisions entry "Structure audit".
- **Verified:**
  - the whole Giac bridge is `caseval(text) → text` (`engine/giac/wasm/api.cc`);
  - Giac exposes typed values (`dispatch.h:38–53`), every setting (`global.h:873–1042`) and its evaluator's context (`caseval("caseval contextptr")`, `gen.cc:16851` onward) to C++ beside it;
  - 18 of 82 Giac calls over seven everyday inputs compute a value; the rest are setup, our stores and questions about form;
  - 2,920 lines in rune files with 54 rune declarations;
  - 529 of 579 Home and precision golden cases enter as Giac text;
  - commit types: 6 `refactor` in 1,044.
- **(to verify), by the spike the note proposes (gorge, by day, one engine build):** the bridge's cost, its handling of interrupts, the release build, and how many readers it removes.

## Third part: wave 1 as packages (the owner's go, 2026-10-20)
- **New package files:** G85 (the bridge spike, day, after A28), G86 (the chip from one pure rule), G87 (the plot shares the parser's tables), G88 (the text-match ratchet).
- **Rewritten:** G65 merged without G69, so G69 comes back on its own on `readsOf` (step 66, `G69.md` rewritten) and backlog F54 points to G69; G76 is one `ValueFacts` type carried whole (`Facts` is taken by `state/displayMode.ts:85`); R69 runs after G86; G62's reference follows.
- **Brief:** the queue rows placed (G69's row gone, R69 after G86, G88 after G65, G87 before G61), G85 in the day list and the table; G66 and G72–G74 stay held for G85's report.
- **Checked on `cb445bf`:** the unit view refuses `sec(30°)` with its message (`tools/probes/unit-result.ts`), so it is no wrong value and leaves audit-P3; the golden runner already sends `latex:` cases through the parser (`goldenRun.ts:179–182`), so hind-4 is a rule line, not a package (the hindsight note says so now).
- **The merge:** this branch was cut from `d6f6093`; phase-1 since held seven steps (`16405c4`) and pass 46 changed the queue. Expect conflicts in `brief.md` (take this branch's rows and its short hold note) and in the `giac-globals.ts` README row (take phase-1's).
