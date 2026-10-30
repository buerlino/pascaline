# Night report 2026-10-30 (the first night of the merge queue)

Pipeline runs 316 to 321, Opus pass 13. The section starts at 23:29 on 2026-10-29 (`--until 07:00`, one queue without lanes: no log line carries `[A]` or `[B]`, because A47c was merged during this night) and the log ends at 01:22 with this report. The queue ran out early: the night's six steps took under two hours. Nothing was pushed.

**Core list:** desktop CORE 66/66 (known 0) at f13de4a (pass 13). The night's device: **CORE DEVICE 61/65 (known 0, new c25, c26, c27, c63) at 6f0f27f (01:05)**; the four cases are the first red device result since the freeze ended. Gates at f13de4a: typecheck 0 errors, vitest 2009 passed with 1 expected fail, e2e 1269 passed with 1 skipped, the four shell tests pass run directly (pipeline, night, gc, devlock). No golden run (no engine or parser change).

## Merged into phase-1
- A47a e167510 (every job takes its number from one counter under flock and gets the port 5200 + number % 100; branch locks and pid files; the `selftest` subcommand). No fix round.
- A47b 9226369 (the merge queue: a run holds `integ` from the merge of phase-1 through checks, audit and merge; an EXIT trap releases it). Two fix rounds: phase-1 was not merged into the branch in the queue; a worker package had edited a shared doc (decisions.md) directly.
- A47c f13de4a (`night.sh --lane A|B`, `--stop`, one pid file per lane; lane A's report waits for lane B). No fix round.
- A47bf1 6b805d6 (finishes A47b: `setup_node_modules` takes a short lock `nodemods` of its own, so a start no longer waits for the other lane's checks and audit; lock order integ, nodemods, host-cpu). No fix round. It is a FIX package of the last pass, so it had its audit only (rule 5), no further Opus pass.
- Doc commit on phase-1 (not pushed): 6f0f27f (A47a–c shared texts applied to rules.md, brief 0c, CLAUDE.md and percy.md; the A47b node_modules default in decisions.md; the package files and queue rows 214–219 deleted; brief at 27.8 of 28 kB).
- Selftests: runs at 23:44 and 00:24 PASSED but ran the main checkout's old tests (23 s each: pipeline.sh resolved its own folder after changing to the main checkout; A47c fixed that). The 00:43 selftest (82 s) was the first real one and PASSED, as did the 01:20 one (114 s) after A47bf1.

## Unmerged
- None.

## Earlier on 2026-10-29, the 20:14 section (no report was written; the owner stopped it at 22:41)
- A44 e5f0efa (the nightly sweep reads its own known-rows file only with `--nightly`; the gate's list is unchanged).
- G131 a2a6ad3 (patch 0017: an MPFR NaN no longer counts as zero or one, so a product with a refused factor is refused; two fix rounds: an e2e failure, then the missing patches README row; engine key 8032a40083fc6404).
- G132 2fb13a4 (patch 0018: (a^b)^c is rewritten as a^(b·c) only where that holds; one fix round; engine key 400095e511904660).
- Opus pass 12: all three ok. Docs fa52380: F134 (CAS `simplify` and `normal` of sqrt(z^3) give the other root) and F135 (Giac writes sqrt(exp(z)) as exp(z/2) without checking the branch; `sqrt(exp(3·acosh(-2)))` gives -7.20976852011·i, right +7.20976852011·i) filed; F129 and F130 removed; G136 now removes their nightly rows. Desktop CORE 66/66 at 2fb13a4; no CORE DEVICE line.

## What went wrong
- **Device regression, not yet looked at:** CORE DEVICE 61/65 at 6f0f27f. The four new failures c25, c26, c27 and c63 all start with `@mode, right, enter` (they switch the angle mode through the Mode sheet and then compute in DEG), and desktop CORE passed 66/66 at f13de4a. Pass 13 ran before this line existed and its NOTES say "no CORE DEVICE line since pass 12", so no pass has judged it. It is neither a FIX nor a backlog line yet.
- A47b (run 317) needed two fix rounds, both found by the audit (phase-1 not merged into the branch in the queue; a shared-doc edit in a worker package).
- The two first selftests (steps 215 and 217) were not real tests (see above); the 00:34 `FAILED` line is annabell's own test run inside run 318, not a step.
- A47b's report says the queue had run only in the sandbox, never as a real two-lane run.

## Opus passes (NOTES)
- 13: A47a, A47b, A47c ok. Decision: every start waits for the other lane's queue is settled as a default and goes to A47bf1 (the `nodemods` lock). Docs 6f0f27f. CORE 66/66 on desktop at f13de4a (known 0).

## What the owner must do
1. Look at the device result: c25, c26, c27 and c63 fail on the night's device and pass on desktop. Decide whether it is a FIX package or a device-only effect, and write the backlog line.
2. The morning check: read this report and the log, then start both lanes to 16:00 as `docs/shifts/brief.md` section 0 says (`scripts/night.sh --lane A --until 16:00` and `--lane B`), or rule 12's single queue if a selftest failed (none did). The first real two-lane start also tests A47a–c and A47bf1 for real.
3. Push phase-1 when you are content (nothing was pushed; fa52380, 6f0f27f and the merges since a178154 are local).

## Queue left for the next night
- Step 220 was this report; the night queue table now holds only that row.
- Lane A (rows 301–311): R91, R49, R87, R15c3, R4b, R86, R57, R50e, R24b, R24c, R24d.
- Lane B (rows 401–405): A48, G135, A50, A49, A45; rows 406–408 (G133, G134, the fuzz and its triage as G136) run only on the weekly extreme night.
- Follow-ups without a package: F134 and F135 (from pass 12); A43 and A7 to A9 run by day.
