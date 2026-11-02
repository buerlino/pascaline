<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# The night review of 2026-11-02

**Status (2026-11-02): open.** What to verify, place or decide; it took over the open items of [the 10-31 note](../archive/night-review-2026-10-31.md).

*Written 2026-11-02 by Claude (Opus, the coordinator) on `phase-1` `ff37a93f6`; ids minted and docs written on `ff37a93f6`.* A day run (15:57–23:00, no lanes), weighted by the owner's brief of 2026-11-02 (vision, priorities, taste). Eight hunts, each checked by a separate verifier; 31 packages argued by an author and a reviewer until AGREED (three rounds). Run files: `.tasks/night-review-2026-11-02/` (reports, verdicts, `knowledge.md`, `packages/PLAN.md`).

## 1. The hunts
| hunt | found | confirmed | refuted | unsure | verifier's new |
|---|---|---|---|---|---|
| ca codebase | 8 | 7 | 1 | 0 | 0 |
| fh features | 6 | 5 | 1 | 0 | 0 |
| be maths | 4 | 4 | 0 | 0 | 0 |
| bu app (⌫ checked on the Tab One) | 11 | 8 | 2 | 1 | 1 |
| dc declutter | 14 | 14 | 0 | 0 | 1 |
| vr ron merges (43) | 11 | 9 | 1 | 1 | 0 |
| vg gorge, annabell, sandra merges (33) | 7 | 6 | 1 | 0 | 0 |
| lo leftovers | 14 | 14 | 0 | 0 | 0 |

S1 root causes: vg-2 (`sem` with a second list), be-1 (one unit chip used twice is two σ inputs), be-2 = vg-3 (`piecewise`/`when` missing from the unit view's jump list), vg-1 (patch 0025 and a base whose double is not finite). The worst entry surprise, vbu-1: on the APK's default Dark look with Android in light mode, what is typed inside a bracket is invisible while the cursor is in it (MathLive's own highlight, #EEF1F8, unthemed; device strips in the run's `probes/device/`).

## 2. The queue (the owner, 2026-11-02: as proposed; rows 442–463 and A4b's day row placed, the rest still this queue)
By the owner's priorities (bar, keys and entry, R92, polish, the AI port, the sync folder, the study, after v0.1.0), then dependencies. Package files: `docs/shifts/packages/<id>.md`.
- **Lane B (the bar, then the engine):** placed: G157 (442), R114 (443) → G158 `sem` one list (444) → R115 one chip once (445) → G162 fuzz cancellation families (446, merge before Wed 11-04) → G159 piecewise/when jumps (447); then → A63 kill run needs a tag (after A8) → G161 VA, var, gauge units → G163 the unit view's chunks → G164 sample library (day).
- **The weekly extreme night, Wed 11-04 (placed):** G148, G141, G142, G156 (rows 448–451; G152 waits on G142), then G160 (452, patch 0025, huge base), then G138 (row 408, after G162).
- **Lane A (ron):** placed: R92 (453; Constants and Tools; the owner's first from the night of 11-03) → R116 entry highlights, one calm scheme (454) → R117 ⌫ at AND/OR/XOR and subscripts (455) → R118 the unit view's ⌫ and More… (456); then → R119 Undo copy per view, Ctrl+Z (after R114) → R120 the unit view in the comma → R121 a stored name's note → R122 older backups restore, "Last backup" true → R123 presets naming and reads → (R12b → R12c → R41 → R40, taken) → R124 mark style → R125 group separator → (R59, taken) → R126 the backup's format for your AI → R127 per-key counters → R128 the sync folder's page (day) → S25 (taken) → R129 mockups → the owner's pick → R130 the work as a report; R131 the desktop key map after v0.1.0.
- **By day (a device, the pipeline or an owner's act):** A64 two pipeline guards; A65 the sync folder on Android (Tab One; after R122); A66 the optional key click (after R122); A67 red-first (the owner's yes); A68 `npm run dev` refreshes the Find index; A4b, Find's timing on the Tab One (bar point 4; its day row placed 2026-11-02).

## 3. Backlog lines
Written under "Open bugs": F164 (G158), F165 (R115), F166 (G159); under "Background stream": F167 (G160). None waits for room: the backlog's stale text paid for them (19,796 of 20,000 B). F156 and F157 now name G157 and R114.

## 4. To verify
- **bu-5** (S3): the first-start tips (`App.svelte:82`) check no presses before `showTips`; settle with a Playwright first start that types inside the idle window.
- **vr-5** (S3): a frozen first tab holding the Web Lock may make "Use here" wait; settle with a two-tab Playwright run (CDP `Page.setWebLifecycleState frozen`).
- **be-3 = vr-2** and **vr-8**: confirmed from the code; R120 and R118 carry the screen check.
- **fh-5**: the GUM clauses for k and U (JCGM 100:2008 7.2.2, 7.2.4); sandra, before any package.
- **vbu-1's reverse** (Light look under a dark system): R116's gallery shots cover it.

## 5. Items to place
- **Amendments to taken packages** (applied 2026-11-02, the owner's answer 7): R40 gets a room step (Numbers has seven rows; Fmt's ticks become one row) and only "U = 2σ (k = 2)"; R59's rows go under one "Library ›" row and its format file gets a backup part (R126); S25 weighs a named unit result (fh-1 b) and rewrites `tests/tasks/tasks.yaml` t01 and t03 to today's keys (prefix chips were dropped, decisions.md:95); R12b leaves the caret and highlights to R116; G138's next weekly copy (not row 408 itself; this text lives only here): "`--edges` includes G162's cancellation class, judged at the precision G162 gives the oracle."
- **fh-5** (σ for a report): unit Copy is `value ± σ unit` (`units/row.ts:45`) with no "(k = 1)"; the σ tap could list inputs by share of σ² from `units/evaluate.ts:90` (with G41's second-order term); ~0.75 d after R40 if wanted.
- **lo-4**: engine-made English in Solve's and Function's info lines (`analysis.ts:176-209`, `solve.ts:319, 380`, `solve1.ts:255, 277, 375`): the engine returns a code, the view words it; the next Solve or Function package.
- **ca-1**: the start chunk has 1,815 B left (59,185 of 61,000); `views/sheet.svelte.ts` is the lazy candidate (~2.5 kB gzip), not cheap (F42); a package when one hits the pin. **ca-7**: one IndexedDB connection per call (`storage.ts:81-88`); measure 50 `kvSet` on the Tab One first. **ca-5**: `host.ts` 1,261 lines, `numeric.ts` 1,090, `session.svelte.ts` 790, `parse.ts` 795.
- **From the 10-31 note:** vg-11, `negbinomial_icdf(3,0.0001,0.5)` = 26738 (oracle) takes 1517 ms and ends `float-timeout` (fix: the exact loop only when r(1−p)/p < 10⁴, else the double's k confirmed by cdf(k−1) < t ≤ cdf(k)), a backlog line under F90–F97 when there is room; A40's device path (a known case passing on a device should log `new none`; never run, every CORE DEVICE line has `known 0`); F61's id (backlog unchanged, the Opus pass mints it with its package); vg-2's nine hang inputs are not filed as known rows (a known row matches a generated tree's id, `app/scripts/sweep.ts:9, :64`), G138 files F145's shapes when the fuzz meets them; the held list: a hardware key for Find, a pasted column as a list, the error's position, split forms ft+in, h+min+s, ° ′ ″ (docs/03 rule 5). Dropped: c48 (no second sighting in five device runs).
- **lo-13:** five finished night reports in `docs/shifts/` go with `scripts/gc.sh` (14 days).

## 6. The owner's answers (2026-11-02, step 8)
1. **Red-first** (lo-3): yes to A67: only an added or tightened test counts.
2. **The stray `WriterNote.svelte`** (lo-11): the owner deletes it; yes to A64's warning (it warns, never deletes).
3. **Undo order** (vr-6 = bu-1; bu-6): the docs follow R98's code: docs/05:105's opening clause is struck, and decisions.md's R98 entry says, as docs/05 does, that the next Enter or a second Clear drops the copy.
4. **Kept decisions:** all six stay (vr-1, vr-4, fh-4, ca-4, dc-13, vg-4).
5. **The queue:** as proposed (section 2); the weekly night's rows 448–452, then 408 after G162; A4b gets a day row; rows 343 and 441 and the A7 and R96f1 day rows removed (done). The amendments of section 5 applied. R37 parked (out of every queue); `docs/mockups/settings.html:280` stays.
6. **Your acts (nowhere else):** Settings → Environments → `github-pages`: is any branch allowed besides `v*` (vg-7; A63 guards it either way); delete the three merged `p1/sandra-*` branches (lo-14); with the network, `git ls-remote` of the actions pinned in `.github/workflows/` and of the local tag `keep/eve-gestures` (96fcf50b); send email 5; delete `WriterNote.svelte`. **Checked 2026-11-02, 20:15:** `github-pages` allowed the branch `master` besides the tag `v*`; the owner removed it the same evening, so only a `v*` tag deploys (the API's branch policies); the four action pins match their tags upstream; `keep/eve-gestures` is on origin; the `p1/sandra-*` branches and the stray copy outside the repo are gone; email 5 waits for Parisse.

## 7. Budgets
Nothing is FULL after this review: backlog 19,795 of 20,000 B; decisions 39,999 of 40,000 (step 8 archived P19's full text); brief 27,963 of 28,000 (step 8's rows); docs/04 69,989 of 70,000 (dc-10's two stale lines); research notes after this note under 150 kB (the 10-31 note archived; bug-patterns section 4 and r6's history trimmed, dc-2 and dc-14). decisions.md has 1 B left: the next entry needs the Opus pass's move of a built entry's full text to the archive.
