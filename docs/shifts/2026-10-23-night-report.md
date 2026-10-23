# Night report 2026-10-23 (eighth night)

Pipeline runs 189 to 191, Opus passes 59 and 60. The shift started at 22:46 on 2026-10-22 and was stopped at 05:07 by pass 60 (steps: 7 of 40). A stale host-cpu lock blocked every check from 03:13 on, so no package of the night was merged. Nothing was pushed.

**Core list:** desktop CORE 52/52 (known 1: c56 F72; needs 3) at phase-1 93ab512 (pass 59). On the Fairphone 6 CORE DEVICE 51/51 (known 1, new none) from device run 188; the Tab One has not run the list. Pass 60 ran no gates (lock). Gates at pass 59 (93ab512): typecheck 0 errors, vitest 1692/1692, e2e 1140 passed with 4 skipped, pipeline.test.sh ok (68). No golden run (no engine or parser code changed).

## Merged into phase-1
- Day, before the night (checked by pass 59): G86f1 b80bd7c (a CAS true or false on a float gives an inexact chip), R69f1 f921d46 (Copy session writes the mark of the decimal it copies; an unchecked exact fraction shows ⚠), S23 f6d5092, A34 ce29744 (worktrees copy node_modules), A33 bdc084f (device step for the core list), A33f1 93ab512 (a locked device is DEVICE SKIPPED).
- During the night: nothing.

## Unmerged
All three were built by their worker; none was checked or audited, because run 189 to 191 stopped at "host-cpu lock busy".
- R76 (p1/ron-solvenum-line, 7c658ad): going back to Home clears what the app put on the shared line; pass 60 says ok. Enter in Num still refills the line, settled as a default in decisions.md.
- R77 (p1/ron-listpow, 06fb30f): a power of a braces list is elementwise; tests fail on phase-1; pass 60 says ok. Bug lines F77 (`L:=[1,2]` then `L^2` gives 5) and F78 (`[1,4]+1` gives poly1[1,5]) are filed.
- G98 (p1/gorge-golden-chipnames, 0fde084): giacOfEntry is the one place for the per-view options. The worker ran no vitest or e2e, and the golden gate's units and parser stages failed in its worktree for lack of a Find index, so GOLDEN GATE PASSED is not yet shown; the review-only run must show it.

## What went wrong
Device step 59 ran from 23:13 to 03:13 and hit its timeout with no CORE DEVICE line: Gradle failed reading its input (Input/output error). build.sh left the host-cpu lock held from 23:13, so runs 189 to 191 each waited 30 minutes and failed. `devlock break` was refused in the night. Filed as A35 (annabell).

## Opus passes (NOTES)
- Pass 59: G86f1, R69f1, S23, A34, A33, A33f1 ok. Docs commit 26e1a89: shared text of S23 and A34 applied, A33f1's package file gone, R15c, R21 and P16 moved to the archive (decisions.md 38.7 of 40 kB). New day lines: A33f2 (tools/core-device.sh tells the user to set the screen lock to None, against the owner's rule never to remove a PIN) and A34f1 (the node_modules staleness check misses a version bump in package-lock.json).
- Pass 60: R76, R77, G98 ok in code. Queue: stop the night, skip the device step, report. Docs commit f3bd915: backlog F77, F78, A35; R76's default in decisions.md. No FIX packages. Not run: CORE and gates (lock).

## What the owner must do
1. Run `tools/devlock.sh break host-cpu` before the day's runs.
2. The Fairphone's night setup is still in place (owner, 2026-10-22): move `.coord/devices/4d42e62f.orig.real` back to `.orig` and run `tools/stay-awake.sh 4d42e62f --restore`.
3. The older items under "Needs the user" in decisions.md and backlog.md (MathLive M5 drafted, not filed; F-Droid and checked-in derived data; Parisse reply; G2 checklist; phone checks; held steps).

## Queue left for the next night
- By day, after the lock is broken: review-only runs in this order, each with `--no-worker --audit-model auto`: R76, R77, G98 (the golden gate must pass). Then the queue unchanged from step 114 (S23's moves G98 to G105 sit at steps 113 to 119 and 131 to 134; then G75, G60, G56, S17, G77, G89, G91, G87, G96, G64, S16).
- By day, small packages: A35, A33f2, A34f1; the Tab One run of the core list (A33).
- Follow-ups without a package: F63 to F67, F72, F73, F74, F75, F77, F78.
