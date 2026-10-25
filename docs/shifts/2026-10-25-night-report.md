# Night report 2026-10-25 (tenth night)

Pipeline runs 231 to 240, Opus passes 72 to 75. The section starts at 23:08 on 2026-10-24 (`--until 11:00`) and the log ends at 07:04 with this report. Nothing was pushed. Day runs before the night (A34f1 de3336c, G64f1 5452c73, G108 d26ee0e) are not counted here.

**Core list:** desktop CORE 54/54 (known 3, needs 3) at phase-1 0901b51 (pass 75). On the device CORE DEVICE 53/53 (known 3, new none) on 461afcf (device run 75). Gates at 0901b51: typecheck 0 errors, vitest 1869 passed and 1 expected fail, e2e 1146 passed with 4 skipped, GOLDEN GATE PASSED with the regress stage (8.09 calls per input at pass 74).

## Merged into phase-1
- G104 76f0e04 (state cost: stored names against a full read; Giac calls per Enter did not rise).
- G92 7575ed0 (assumptions Giac leaves are put back by the read after the input).
- G93 842e9e8 (a command that clears names clears ours and the log's; restart(1) keeps Giac's meaning).
- G105f2 694fb92 (G105: readers of Giac text live in giacPrint.ts, every log command is typed text).
- G110f1 6eee1cc (G110: Find census judges list answers item by item in both views).
- G108 0901b51 (run 240 was empty: the work was merged by day as d26ee0e; Opus pass 75 audited it).
- Doc commits on phase-1 (not pushed): f39b5b7, 4f7a947, 76b0f34, 461afcf.

## Unmerged
- G109 (p1/gorge-listtype, 0010a1e): two fix rounds; the solve-form fact lives only in the in-memory `solveTexts` (host.ts:662). It waits for the owner's answer (below). R80 (steps 119a, 119b) waits with it.
- Step 135 skipped: A37 is not merged.

## What went wrong
- G109, G105 and G110 each ended at "NOT MERGED after two fix rounds". G105 became G105f1, which also failed (library.ts:343 read every log command as printed), then G105f2 on the shared cause, the log's mixed quoting; f2 is the chain's last allowed id and it merged. G110 became G110f1, which merged.
- G105f1 and G105f2 net lines in app/src/engine are +23 against the Done-when's "removed" (accepted in pass 74: numeric.ts lost 98 lines and host.ts 12; the copies sit in one module).

## Opus passes (NOTES)
- 72: G104 ok; G109 fix, not merged, waits for the owner (a solve result has Giac's list type: S^2 gives list[4,4]; recommendation: braces); G105 fix: G105f1.
- 73: G92, G93 ok; G105f1 fix: G105f2. New F87 (restart shows pcasans: recursive definition), F88 (nonsquare.ts reads string(part) printed), F89 (laplace leaves garbage in VARS). VARS(1) goes on the upstream list.
- 74: G105f2 ok; G110 fix: G110f1 (a Home list answer never got a mark).
- 75: G110f1, G108 ok. Census shows no wrong list item in either view. F98 filed: Giac reads LambertW({1,2}) as LambertW(1,2); reachable through Find only. The regression files in tools/giac-regress hold in the golden gate (check 288/0, known 0 passed and 45 failed, patched 26/0, 1 s).

## What the owner must do
1. Answer G109's solve form in decisions.md under Needs the user (braces recommended, or brackets by carrying the origin, G109f1, about half a day). R80 waits for it.
2. Decide which F lines R4a waits for (G110's proposal, under Needs the user).
3. Send Parisse the regression-file link (G108 is merged); patches 0003 and 0006 (commit 8c6cb63) as commit links, if not yet sent.
4. Upload the mirror for the new Giac pin; then annabell runs the release build and the golden gate.
5. Morning check, and the Tab One run of the core list. No device run on the Tab One tonight.

## Queue left for the next night
- Steps 119a and 119b (G109, R80) after the owner's answer; step 135 once A37 is merged; step 130 (S16) after A19. Then the queue as written in brief.md section 0c.
- Follow-ups without a package: F63 to F67, F72 to F75, F77 to F89, F98.
