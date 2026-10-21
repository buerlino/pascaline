<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# S7, the docs diet: report (sandra, 2026-10-18, pipeline run 50)

## What I verified
- Every link and budget: `node tools/docs-check.mjs` (new) prints `docs ok: 319 links and paths; shifts/brief.md 20.9/25 kB without section 7, backlog.md 12.4/20 kB, decisions.md 34.3/40 kB, 04-architecture.md 69.5/70 kB, 34 package files ≤ 4.6/6 kB; section 7 = package files: 34 compared`.
- `scripts/gc.sh`'s path audit, run on this branch's CLAUDE.md and docs/README.md (the loop of gc.sh, since gc.sh itself reads the phase-1 worktree): no stale path.
- The pipeline's lookup, replayed on this branch's brief for all 34 package IDs: each heading gives its branch and the block equals its package file; the "Your report" and definition-of-done parts of the bundle are unchanged.
- Facts that changed since the texts were written, checked in the code or data: the merged packages (`git log --merges`), the stored keys (`kv.get/set` in `app/src/`), the type files of docs/04 8.2, `find/units.yaml`'s overrides (hp, mmHg, inHg, 13 constants), `tests/golden/units.yaml` u10, l01, l02, the unanswered items of `tests/golden/g2.yaml` (40–44, 46, 48–53, 55–59, 61), the 116 phrases of `tests/tasks/find-queries.yaml`.

## Sizes (bytes)
| File | phase-1 | now | budget |
|---|---|---|---|
| docs/shifts/brief.md | 100 511 | 85 344 with section 7, 20.9 kB without | 25 kB (holds once A14 deletes section 7) |
| docs/backlog.md | 77 630 | 12 370 | 20 kB |
| docs/decisions.md | 182 904 | 34 301 | 40 kB |
| docs/04-architecture.md | 94 424 | 69 455 | 70 kB |
| a package file | — | ≤ 4 570 (R53) | 6 kB |

## Where every moved section went
**docs/shifts/brief.md**
- Section 7's 35 blocks → `docs/shifts/packages/<ID>.md`, one each, byte for byte; A10 (merged as A10f1) and S5 (merged) deleted as finished; **A14 added** (the pipeline reads the files). Section 7 stays as the pipeline's copy until A14 (the bundle's rule); docs-check fails if the two differ.
- Section 0 "State at start": the list of merges → cut (`git log --merges`); "Left for the owner: `git branch -D`" → backlog "Needs the user" 6.
- "The path" and "Why this order" → kept, rewritten for what is left (A14 first; R48, A10 and the gorge lane done).
- Tables 0b, 0a, 0e, 0d, 0f, 0g, 0h → one table "The open packages" in section 0, each row linking its file; finished rows (R48, R58, R28, A10, S5) cut; "Why these models" → one paragraph; "Not packaged yet" and "Not a package" → one paragraph; "How to start a package" → section 0.
- 0g's findings in the code and the owner's secret table → `packages/A7.md`; 0g's defaults → decisions.md "The release path"; A8 now reads that.
- 0h's "Dropped in the analysis" → decisions.md "Feature analysis 2026-10-18".
- 0c, 2, 8, 8a → kept; they now name the package files (Opus pass point 1 and 4, section 2's bundle, 8a).
- Package texts that named moved things: A9 (backlog item 38 → feedback #50), S6, S8 (backlog item numbers → names), R24c (Opus pass 15 defaults → the archive), A11 (A10 is merged).

**docs/decisions.md** (the full text of everything below the "Needs the user" part, as of phase-1 `8f80db0`, is `docs/archive/decisions-2026-10.md`)
- "Needs the user": kept, every open item; A4a's decided points 2 and 5 and M4-2's decided point 2 cut there (decided entries are in the archive).
- "Decided proposals" (both): what binds, as Choice, Why, Would change if, grouped (pipeline and process; feel, keys and screen; precision, engine and parser; units; feature analysis). Only in the archive now, because superseded or done: R15a (layout D; replaced by R15c), P13's key (Undo moves to its own key in R15c), P6 (withdrawn), P3 and its integration plan (replaced by P8, P11, P15), the coordinator merges (replaced by P17), the three-lane path (replaced by P17 and the brief's path), the status-line hit area (in R15b), P12's open points, R21a, M4-2 part, M4-3, M4-9, M4-10, R8 (queued keys), G4's points, R26d, R26e, R26h (in the ⌫ default), the G2 answers of 2026-10-12 (in `tests/golden/g2.yaml`).
- "Defaults (Phase 1)": one line each that binds, grouped (entry and keys; engine, precision and formats; units; library, release and process). The Opus passes' defaults keep only the rules that bind code (R58, G21, G31, G26, G22, R52, R39, G23, G13, G16–G18, G25, G7, R28, R24a, R24af1, G30, G33); their audit notes are in the archive.

**docs/backlog.md** (the old text: `docs/archive/backlog-2026-10.md`)
- Every done item, its cause, steps and commits → cut (the archive, git history; open causes are in the package files).
- "Needs the user" → nine one-line items; the G2 item list → the checklist's unanswered numbers; "Checks on the phone" → one new list (C10's "one check-on-the-phone list"); the upstream reports → their own short section (kept here: `find/units.yaml` points to it).
- Milestones 4a, 4, 5, 6, the clean-up and release items → one or two lines per open item, linking package and decision; C10 (this package) is done and left.

**docs/04-architecture.md**
- Header → current (2026-10-15 check and S7), the archcheck report linked in the archive.
- 0: item 7 (Python) one line; item 13 qalc at build time only.
- 1.1: E4 today → A4a's numbers. 1.2: the table made current ("Open against the goal": the defs replay, `normald_icdf`'s polish, Find, the unit entry, CI).
- 2.1: "Today, per path" with "Marked today" → "The paths" with the mark each path gets; the 2026-10-12 reuse paragraph cut.
- 2.3: kept as the record of each case and its fix, shorter; #2's value polish is the one open.
- 2.5: line numbers cut, A4a's measurement kept. 2.6 mechanics: A4a's answers (A11). 2.10: one line.
- 3.1: "Today" → "State" (the index exists, its numbers). 3.3: the schema now names `app/src/find/types.ts`; the "Amended" note rewritten in place; G13's overrides; the licence paragraph points to THIRD_PARTY.md. 3.4, 3.5, 3.6: current (pask, pasc_; no Python).
- 4: intro de-duplicated; 4.1 → "Evidence (G15's probe)", the hp, mmHg and level rows show what G13 and G17 give now; the "36 units" list made current. 4.3 trimmed (the pad is decided: 18 user slots).
- 5.1: the "Today" column folded into "Decided" with built packages named; R15c named as the replacement of rows 0–2. 5.4: the `0x` error is built. 5.5: "Today" → "State", the done decisions shorter.
- 6.1, 6.2 (the stored keys as in the code: `entry`, `userKeys`, `taps`, `defsStarts`), 6.3 (sizes → 8.3), 7.1, 7.2 (A11's plugins), 7.3 (per-milestone gates → the backlog).
- 8.2: the copied TypeScript → a map of each interface to its file and its fields. 8.3: the start chunk 53.16 kB gzip (G30f1), the replay after G29.
- Appendix A → the probes' README; Appendix B → `tests/tasks/find-queries.yaml`; Appendix C → the open rows only.

**Archive** (`docs/archive/`): `cleanup-audit-2026-10-12.md`, `python-notes.md`, the 18 finished reports in `archive/shifts/`, `decisions-2026-10.md`, `backlog-2026-10.md`; their links rewritten to resolve from there; the paths in docs/02 section 12, `spike/RESULTS.md` and `spec/unit-pad.yaml` follow. `docs/README.md` indexes what stays, the package files and the archive.

**Tools:** `tools/docs-check.mjs` (new); `npm run gate`'s docs step runs it (`app/scripts/gate.ts`, `summarizeDocs` in `gate-summary.ts`, its test first); `tools/README.md` names it.

## For A14 (exact text)
`scripts/pipeline.sh`:
```diff
-# The spec: a package block of brief section 7, or the task text itself.
+# The spec: the package file docs/shifts/packages/<ID>.md, or the task text itself.
 spec_file="$(mktemp)"; trap 'rm -f "$spec_file"' EXIT
 if [[ "$task" =~ ^[A-Z][0-9]+[a-z0-9]*$ ]]; then
   id="${id:-$task}"
-  start="$(grep -nE "^### [a-z]+, $task:" "$brief" | head -n1 | cut -d: -f1 || true)"
-  [[ -n "$start" ]] || die "package $task has no '### <agent>, $task:' heading in $brief"
-  end="$(awk -v s="$start" 'NR>s && /^##/ {print NR-1; exit}' "$brief")"; : "${end:=$(wc -l < "$brief")}"
-  sed -n "${start},${end}p" "$brief" > "$spec_file"
-  heading="$(sed -n "${start}p" "$brief")"
+  pkg="$integ/docs/shifts/packages/$task.md"
+  [[ -f "$pkg" ]] || die "package $task has no file $pkg"
+  cp "$pkg" "$spec_file"
+  heading="$(head -n1 "$pkg")"
+  [[ "$heading" =~ ^"### "[a-z]+", $task:" ]] || die "package $task: the first line of $pkg is not '### <agent>, $task: ...': $heading"
@@ the bundle
-  awk '/^### Your report/{p=1} /^## 7\./{p=0} p' "$brief"
+  awk '/^### Your report/{p=1} /^## 8\./{p=0} p' "$brief"
```
`scripts/pipeline.test.sh`: loop over `"$integ"/docs/shifts/packages/*.md`, reading agent, ID and branch from each file's first line with the same regex, instead of `sed -n '/^## 7. Packages/,/^## [^7]/p'`.

The brief, after the pipeline change: delete section 7; in the header delete "**Until A14 is merged, section 7 is the pipeline's copy of those files:** edit a package in both places; `node tools/docs-check.mjs` fails when they differ."; in 0c's Opus pass point 4 delete "(until A14 is merged, also its block in section 7) "; in 8a delete "(and, until A14, their blocks in section 7) "; in the path and the table drop A14's row once merged.

`docs/shifts/rules.md` section 4 point 1: "1. **Bundle:** the package's file `docs/shifts/packages/<ID>.md` (or the task text), the files it names (capped), the report format of brief section 2 and the definition of done of section 8, written to `.tasks/<n>-<id>/spec.md`."

`.claude/agents/ron.md`, `gorge.md`, `annabell.md`: "your task is section 7 of `docs/shifts/brief.md` and its section 2 applies." → "your task is your package file in `docs/shifts/packages/` and brief section 2 applies."

## For shared files (Opus pass or owner)
- `.claude/agents/sandra.md`, "For older context": "the latest report in `docs/shifts/`" → "the latest report in `docs/shifts/` (finished ones in `docs/archive/shifts/`)".
- CLAUDE.md, the Docs convention line: append "Size budgets and links: `node tools/docs-check.mjs` (in `npm run gate`); open packages are one file each in `docs/shifts/packages/`; history in `docs/archive/`."
- Changed beyond the docs named by the task, because a moved file's path broke there: docs/02 section 12 (three report paths), `spike/RESULTS.md` (the Python notes' path), `spec/unit-pad.yaml` (a comment's report path), `docs/archive/r10-connector.md` (a planned file named without a path).

## Still to verify, and how
- The "Not packaged yet" unit result view: a ron or sandra package text is due now that G16 and G25 are merged (the owner or the next Opus pass places it).
- docs/04 4.1's list of units without a factor: G15's count minus G13's and G17's; a probe over the index's units without `si` would give the exact list (gorge, `tools/probes/units-giac.mjs`).
- The start chunk after the merges since G30f1 (R12a, G31f1, G21f1, R48, R58): `npm run size` on phase-1 (any UI package reports it anyway).

## Top risks
1. **Two copies until A14:** an Opus pass that edits a block in section 7 and not its file (or the reverse) fails docs-check; A14 should run first by day.
2. **docs/04 is at 69.5 of 70 kB:** R15c2's rewrite of 5.1 must cut as much as it adds, or a section moves out (8.1's diagram duplicates docs/README.md's summary).
3. **Facts read only in the archive:** a package that needs a decided entry's evidence must open `docs/archive/decisions-2026-10.md`; the condensed entries keep the names, so a search finds both.
4. **gc.sh dry runs overwrite the day's report:** `scripts/gc.sh` without `--apply` tees into `.tasks/gc-<date>.md`; running it here replaced the 20:44 applied report (its moves are done; only the listing is lost). A one-line fix for A14 or later: write dry runs to `gc-<date>-dry.md`.
