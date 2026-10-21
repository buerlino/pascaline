<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# S18: status lines on every research note, decided notes to the archive (sandra, run 157)

**Status (2026-10-21): reference.** Base `phase-1` at `8820b9d`; branch `p1/sandra-noteslife`.

## Done
- **Tests first.** Before any edit, the notes without a status line:
  `for f in docs/research/*.md; do head -8 "$f" | grep -qE "^\*\*Status \([0-9-]+\): (open|decided|reference)\b" || echo "$f"; done`
  listed 18 of 19 (every note but `bug-patterns.md`). After the edits the same command prints nothing. A22 is not merged, so `docs-check` does not check the line yet; A22 should use this pattern (the line right under the title).
- **Status lines** (`**Status (2026-10-21): <kind>.**` under each title): **decided:** g2-correspondence (S12; R66, R67, R68, G45 merged), r7 (S1, P14; R24b–d), r8 (S2; built), r9 (P14, S5; R24b–d), r10 (S4; R59, R38a, R38b), r11 (S6; R38a, R38b), r13 (P16, S9; R53), r14 (S14; R64, G46 merged), r15 (S13, G57; G65 merged, G66), r17 (M4-2; R60–R63). **reference:** bug-patterns (already), engineer-needs, fdroid-feasibility, giac-help-licence, r2, r4, r6, r12, r18. **open:** none.
- **The move:** all ten decided notes `git mv`'d to `docs/archive/` (their packages are package files or merges). Every path `research/<note>.md` became `archive/<note>.md` in 53 files: live docs (README, 03, 04, 06, backlog, decisions, feedback, mockups), package files (G66, R24b–d, R38a/b, R53, R59, R60–R63), the archive's own links, `tools/probes/` (README and script comments), `spec/`, `tests/golden/` and path comments in 5 source files (path-only, no code changed). Bare sibling links fixed in `archive/r7-unit-slots.md` and `research/bug-patterns.md`. `git grep -E 'research/(<the ten>)'` finds nothing.
- **Docs fixed against the code:** r18 section 5 said the manifest allows Android backup; A23 made it `allowBackup="false"` (`android/app/src/main/AndroidManifest.xml:5`), so the bullet now says so, and section 6 says S8 decided both points. r9 lost its second, older status phrase. docs/README.md's notes line now lists the live notes and names the archived ones.
- **The sum:** live notes (open and reference) **134.0 kB** (`wc -c docs/research/*.md`), under 150 kB; bug-patterns is 55.8 kB of it. Nothing for "Needs the user".

## Tests
`node tools/docs-check.mjs`: docs ok, 548 links and paths. Vitest `src/units/slot.test.ts` 42/42 (a touched comment). Typecheck: 2 errors, both `Cannot find module '@capacitor/share'` in `src/clipboard/native.ts`: this worktree's `node_modules` predates A11 (`app/package.json:28`); unrelated to this diff, the pipeline's `npm ci` clears it (to verify: the pipeline run). No e2e or golden: no engine, parser or UI code changed.

## For shared files
Already on this branch: the backlog tick (`[x] S18`, backlog 19,997/20,000 bytes) and the path-only link fixes the package asks for. For the brief: drop S18 from section 0 step 5 and row 82 of the night queue on merge.

## Needs a decision
None.

## Not done
The status-line check in `docs-check` is A22's. Its rule: the line right under the title, matching the pattern above.

## Risks
- backlog.md (20.0/20), decisions.md (40.0/40) and docs/04 (70.0/70) sit at their budgets; this diff makes each 1 byte smaller per path it rewrites, but the next edit to any of them needs a trim first.
- Branches still in flight that add a link to `research/<moved>.md` will fail `docs-check` after this merges; the fix is the same path rewrite.
