<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Night review 2026-10-30: hunts, verification, the queue it proposes

**Status (2026-10-31): open.** Holds what the review found that has no other place yet: findings to verify, items for the owner to place, the questions behind decisions.md's entry, the queue order past what fits in the brief. Moves to the archive once every item has a backlog line, a package or a decision.

*Written 2026-10-31 by Claude (Opus, the coordinator) on `phase-1` `bb90a5e`; ids minted and docs written on `0fc50d2`. Eight independent hunts (sandra), each checked by its own adversarial verifier (sofia); packages argued between an author (sandra) and a reviewer (sofia), both Opus xhigh, until AGREED (4 rounds). Run files: `.tasks/night-review-2026-10-30/` (gitignored): `reports/`, `verified/`, `knowledge.md`, `packages/REVIEW-1..4.md`, `id-map.md`.*

## 1. The hunts

| hunt | what | found | confirmed | refuted | unsure |
|---|---|---|---|---|---|
| ca | codebase analysis | 10 | 9 | 1 | 0 |
| fh | features an engineer misses | 13 | 12 (4 proposals) | 1 | 0 (+1 new) |
| be | maths: engine, parser, marks | 11 | 10 (+1 new) | 0 | 1 |
| bu | app: keys, entry, state, views | 10 | 8 | 1 | 1 |
| dc | declutter | 12 | 10 | 2 | 0 |
| vr | this week's ron merges | 13 | 12 | 1 | 0 |
| vg | this week's gorge, annabell, sandra merges | 15 | 15 | 0 | 0 |
| lo | leftovers of earlier sessions | 21 | 21 (+1 new) | 0 | 0 |

105 found, 97 confirmed, 6 refuted, 2 unsure, 3 new from the verifiers. Nine S1 root causes after de-duplication, each with a package and a backlog line (F146–F154). The lanes held `host-cpu` most of the night, so several checks were read-only; each package's Tests first settle them. The probes the findings cite: `tools/probes/review-1030/` (README row). Its vitest at `0fc50d2` (2026-10-31 05:50): 3 tests, 3 red: bu-1 (stored history 0 after an early hide, expected 4), bu-2 (Clear while a CAS job runs), bu-3/6/7 (bare commas). `failed-read.mts` at 06:05: ca-1 reproduces (after one failed read, one save replaces the three stored definitions with one; a migration step that throws leaves `kvGet` unsettled).

## 2. The queue the review proposes (after tonight's queues)

28 packages. In brief section 0c now: lane A steps 317–320 (R106, R93, R94, R95), lane B 412–415 (A52, A53, G139, G140). The rest waits here; the Opus pass moves rows in as rows merge (brief "Opus pass" step 4).

- **Lane A (ron), in order:** R106 the history written only after it was read (bu-1, S1); R93 a failed store read is not "nothing stored" (ca-1, S1 latent; after R106, R88); R94 an older build never writes back a newer settings schema (ca-2, bu-9; after R88); R95 one writer per browser profile (fh-2, S1 web; day; after R106, R93 and your answer "Two tabs"); R97 App.svelte split (ca-5, vg-13; Sonnet); R98 Clear keeps a running job, plus Undo (bu-2, fh-1; day; after R106, R97); R99 the decimal comma in Solve's and Function's entry (bu-3, be-5); R100 copy and paste round-trip with the comma (vr-1, fh-6, bu-6, be-8; after R99); R96 Settings › Data tells whether data is kept (fh-4; day, Opus; after R93, R38a); R101 the Alpha slot in CAS (vr-2; Sonnet; after R97); R104 `± n %` in the unit view (fh-5a; after R24c, R71); R102 spoken names and strings (vr-7, vr-8, ca-10, bu-8, vr-10; Sonnet; after R97); R105 the core list's visibility check looks at every match (vr-11; Sonnet); R103 room in the start chunk (ca-3, vr-4; after R93).
- **R103** (owner, 2026-10-31): kept, trimmed to the inline script and the migrations on demand; last of lane A, not before R88 (R70f1 gave the room).
- **Lane B, in order:** A52 the web version's kill switch as a workflow input, narrower permissions (vg-6, vg-14; audit Opus); A53 the audit's behaviour diff compares something (vg-4; day; after A52); G139 `eseries` and `sigfig` on the exact value (be-10, vbe-1, S1); G140 a non-real special function known only as a double shows ⚠ (be-9, be-11, S1); G143 σ through a step function flagged, a rounded 0 written "0" (be-2, be-7, S1; after R61); G146 unit tests for the decision code, `tieRisk` dropped (ca-7, dc-11; after G139); G144 the gate's sweep fails on a crash, probe imports checked (vg-10, dc-1; Sonnet; after G137); G145 one home for helpers, dead code (ca-6, dc-7, dc-10, dc-4, vlo-1; Sonnet; after G139, G140); G147 one import direction, checked by the gate (ca-4, dc-9; Sonnet; after R103, G145); A54 the pipeline owns its children (vg-5, vg-9; day; after A53); A55 guards that never fire (vg-12, dc-5, lo-12; day; after A54).
- **The weekly extreme night (lane B):** G148 `approx`/`evalf` past the range refused as an overflow (vg-3, S1; after A53); G141 a long exact literal raises the agreement check's precision (be-1, S1; after A53); G142 complex acosh of a small number at 30 digits (vg-1, S1; its step 0 rechecks first: G133 and G133f1 added patches 0020–0023 tonight).

## 3. Backlog lines

All nine S1 lines fit (backlog.md "Open bugs" F148–F150, F154, F146, F147; "Background stream" F151–F153), with the pointer to this note; each line names its package, which holds the rerun. Everything else of the review stays here (sections 4 and 5).

## 4. To verify (no package until settled)

- **Ctrl+V on the entry line (bu-7 = be-4 = vfh-1; S2, S1 if MathLive writes an upright e).** Ctrl/Cmd+V goes to MathLive's own paste (`entry/hwkeys.ts:15-16`, `:64`), past `parsePastedNumber` and R31's e→ᴇ rule. Parser side reproduced: `1e-3` parses as `1*e_-3`, `1\mathrm{e}-3` as `1*exp(1)-3` = −0.2817; in comma mode a pasted `1,5` would separate arguments. Settle: a Playwright test (comma mode, `max(`, Ctrl+V `1,5`, `)`, Enter; and Ctrl+V `1e-3`), read the entry's LaTeX. R100's step 0 runs it.
- **vr-13's spacing:** whether MathLive's space after a bare comma tells an argument comma from a decimal one: a gallery shot (question "Recalled commas", section 6).
- **vg-14's pins and lo-20's tag:** `git ls-remote` of the pinned actions, and whether `keep/eve-gestures` is on GitHub (network; not run).
- **vr-3, c48:** failed once on the device in R82f1's run (`aa6ad21`); 14 device runs since are green and it passes alone. Rerun: `PW_PORT=<port> GIAC_OUT=<dir> npm run test:core -- --grep '\bc48 '`; device: `tools/core-device.sh --only c48`. A second sighting makes it a bug line.

## 5. Items to place (each with its text)

- **vg-2, hangs:** no answer within 30 s (Esc cancels; one Giac call runs to `hardTimeoutS: 600`) for inverse functions of a huge or tiny exact real: `cosh(acos(1ᴇ300))`, `tanh(acos(1ᴇ1000+0.999999))`, `asinh(acosh(1ᴇ-1000))`, `√acosh(1ᴇ-300-√-2)`, `acos(-1)·e^∛1ᴇ1000`, DEG `cos(acosh(1ᴇ300))`, `tanh(asin(1e300))`, `sqrt(acos(1e1000))`, `asin(asinh(1e-300))`. Rerun: `timeout 40 node tools/probes/engine.ts 'cosh(acos(1E300))'` (rc 124). F62's class; family 6. Filed by Opus pass 24 as F145 (the nightly hangs); these rows go under it.
- **The next weekly fuzz package** (G138, written by Opus pass 24): `--edges` gains be-1's family (`(1±10^-k)^(c·10^k)`, `(f(a+10^-k)−f(a))·10^k + b`, `(1−cos 10^-k)·10^(2k) + b`, k 40 to 300); vg-2's rows go into `tests/golden/sweep-nightly-known.yaml` under F145.
- **vg-11:** `negbinomial_icdf(3,0.0001,0.5)` = 26738 (right, oracle) takes 1517 ms and ends `float-timeout`; patch 0010's exact loop alone 2940 ms. Fix shape: the exact loop only when r(1−p)/p < 10⁴, else the double path's k confirmed by cdf(k−1) < t ≤ cdf(k) exactly. Joins F90–F97 (backlog) when there is room.
- **A40's device path (vg-13):** a known case that passes on a device logs `new none`; it never ran, as every CORE DEVICE line since has `known 0`. Checked the next time a case is marked known.
- **lo-10:** F61's round/trunc patch was to get an id after the freeze (ended 2026-10-27); the Opus pass mints it when it drafts the package.
- **One-time phone checks (lo-8, lo-9, vr-9):** in `tests/core/ONE-TIME.md` since 2026-10-31 (A46, R91, R49, R87); A46's bug-patterns row (lo-9) waits for the next Opus pass.
- **lo-13:** evidence outside git: `../drafts/2026-10-21-packages/g94-raw` (22 MB), `.tasks/sweep-*-triage.md`; no known-file holds G94.
- **Done in step 5:** R89's Done when gained vr-6's gallery shots; S20's probe list gained G141's rows (be-1).
- **By the next Opus pass** (brief "Opus pass" step 4; R57.md, A45.md and their rows already went with passes 21 and 22): backlog's R1 still lists A45 among the open (vg-15); brief:21 drops F106 (lo-5); brief:39's "one lane, to 07:00" (lo-15).
- **Code declutter and S3 without a package:** ca-5's other splits (`host.ts` by request kind, `numeric.ts` facts apart from print; when the next engine fix needs a line, decisions "line baseline"); ca-8, engine-made English in Solve and Function (`solve.ts:298,301,319,380`, `solve1.ts:75-78,350`, `analysis.ts:116,192,200`: the engine returns a code, the view words it); fh-7, named values with σ (after R61, first check what `chip ▶ X` stores for a σ chip); fh-11, `sem(L)` in Find (`stddevp(L)/sqrt(size(L))` works today; a golden case `derived` from `tasks.yaml:153`).
- **Held until the owner hits them** (docs/03 rule 5): a hardware key for Find (fh-3 part 2), a spreadsheet column pasted as a list (fh-6), the error's position (fh-10), split forms ft+in, h+min+s, ° ′ ″ (fh-13). Kept as decided: R31 (fh-3 part 1), G18 (fh-5 part b), R10 (fh-12), R4b's defaults (bu-10). Refuted: ca-9 (R59 plans the library UI), dc-12, fh-9, vr-12.

## 6. Questions for the owner (decisions.md "Night review 2026-10-30, seven questions")

Decided 2026-10-31, each as recommended: decisions.md "Owner answers of 2026-10-31" (two entries) and "Prefix entry". Left for the next Opus pass: `tests/tasks/tasks.yaml:30, 62` (t01, t03) still need "prefix chips (milestone 5)" (fh-8's proposal: t01 in the unit view with `par(`, t03 the unit pad's prefix).

- **Two tabs (fh-2, R95):** recommended: one writer per browser profile (Web Locks); a second tab computes but stores nothing until "Use here". Smaller than merging, and never merges two histories silently; about 1 d. Else: merge on write. Would change if: you use two tabs side by side on purpose.
- **Recalled commas (vr-13, be-6):** recommended: in comma mode draw a stored input's argument commas as `;` (display only; Parser L6 stays), so every comma shown is a decimal mark; about 0.25 d. Else: keep (a recalled `max(1,5)` shows `1,5` and gives 5).
- **The website deploys only a gated build (vg-7):** recommended: check-version and the golden gate in `pages.yml` until A8's `release.yml` exists (A52 step 4; annabell checks the CI venv there). Else: wait for A8.
- **Newer data kept in memory (vg-8):** recommended: a one-time status note (R94 step 4). Else: A50 as designed, silent.
- **Start-chunk allowances (vr-5):** recommended: drop them; the pin is the only rule, each package gives its measured delta. Else: a pipeline check of each allowance.
- **Prefix chips (fh-8):** recommended: drop docs/04 2.7's "if the benchmark shows a gain" (`:145`, `:313`); no package builds the chip.
- **R90 (lo-7):** it has no package and lapsed once R24c merged (`bfc6e4e`; units come with the unit view): drop it. decisions.md:21 and brief:13 stay as they are until you answer.

## 7. Options for the owner (docs budgets)

Decided 2026-10-31: (a), and decisions.md's own rule ("The docs budgets stay"): ten built entries shortened, their texts in the archive.

backlog.md is at 19.95 of 20 kB, decisions.md at 39.9 of 40 kB, the brief at 27.4 of 28 kB after this review. (a) Move "One-time checks on the phone" (1.4 kB) beside `tests/core/MORNING.md` with one pointer line, which makes room for vg-2, vg-11, F61 and the phone checks above; (b) trim F93 and F96 to their class and the pointer to `tests/golden/findcensus-known.yaml` (about −0.55 kB); (c) raise the backlog budget (decisions "The docs budgets stay").
