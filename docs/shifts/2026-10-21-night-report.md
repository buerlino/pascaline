# Night report 2026-10-21 (sixth night)

Pipeline runs 133 to 161, Opus passes 44 to 53. The shift ran from 17:25 on 2026-10-20 to 05:19. Gates at pass 52 (phase-1 226fad8): typecheck 0 errors, vitest 1565/1565, e2e 1068 passed and 1 skipped, golden gate passed (Giac calls per Home input 13.31 against a limit of 14.39). At pass 53 (6c54874) the sweep stage also passed (17 known failures, 0 new). Nothing was pushed.

## Merged into phase-1
- Before the shift's first pass: A21 e5693fd (Find index hash pinned), R15c2 3b26ea9 (keys moved as decided in R15c, all new keys marked assumed).
- Precision and marks: G58 3062c2a (six hang inputs answer in 75 ms or less), G59 96c69a0 with G59f1 687dc48 (the exact path is checked against the numeric route, also for inputs without a decimal), G78 via G78f1 cb445bf (lost answers and division by zero refused with their reason, F50 and F51), G84 4a99119 (an underflow is refused like an overflow), G71 f11b20e (values computed only at double precision carry ⚠).
- Solve, Area, state: G68f1 078642f (Solve counts a known's confirmed digits from its facts and solves a second time with the known moved by one unit), G70 9d8ccc1 (Area refuses a divergent integral; a stopped divergence check keeps the value with ⚠), G67f1 b34b8eb (Giac's settings read and put back; Home calls per input 11.92 to 13.09), G65 13dffbc (names and facts from Giac's whole state after an Enter that may store).
- Startup: G83 with G83f1 8820b9d (user functions load on first use; need() gets only the request's expression strings).
- Find and tools: G80 1969af0 (42 constants bases land within their uncertainty), A29 817c880 (three more timing tests in the pipeline's re-run list), G61 with G61f1 6c54874 (the oracle sweep stage).
- Docs: S18 226fad8 (ten moves to docs/archive).

## Unmerged
- G62 (p1/gorge-m4-seqsweep, 806841a): the code meets the package. Round 2 failed on a race in an old e2e test, app/test/solve.spec.ts R56b (after the reload it taps before the Solve app has loaded). G62f1 fixes it and merges phase-1 first.
- G63 (p1/gorge-m4-viewsweep, 1f7a008): the code meets the package. Round 2 failed only on the backlog budget (20,086 of 20,000 bytes); commit 9b024ae made room and the branch now merges cleanly. It needs a review-only merge.

## Opus passes (NOTES)
- Pass 44: A23, A11, A12, A20, A21, R15c2 ok. A11's phone check moved to the backlog's phone list. Leftovers: golden.ts line 513, the gate and the pipeline still name QALC_OUT for the index; two shell tests in tools/ are run by no gate.
- Pass 45: G58 ok (a Giac patch at the cause by P19; the 2 s deadline stands). G59 left F3 under ≈ for inputs without a decimal (G59f1). G78's code is sound against F50/F51; G78f1 adds four golden cases.
- Pass 46: G59f1 ok (calls 11.18 to 11.20). G78f1 ok; its open question (exp underflow shows ⚠ 0) became G84. G68's copy text dropped trailing zeros, so a known's digit count was wrong (G68f1). Typecheck failed twice on a stale node_modules.
- Pass 47: G68f1 ok; a copy saved before it shows ⚠ once, accepted. G84 ok. G70 turned "unchecked" into null (G70f1). homeEval.ts at 819 lines goes into A22's line baseline.
- Pass 48: G70f1, G67 and G71 ok. Three timing tests failed only under load (novalue timing case, homeDeadline acos case, golden g58-factorial-1e6-30). Two-argument round and trunc get a Giac patch (P19). F61 holds the acosh branch bug and that patch; no package yet.
- Pass 49: G67f1, G70 ok. The audit's objection to G65 was wrong (eval of the map parameter goes one level, with no side effect); G65f1 adds the reason and a test. G65 reads the whole state after every Enter that may store (70 ms with two 300×300 matrices, 178 ms with a list of 1!…1500!); this needs a backlog item (changed names only, or a cap). restart and rm_all_vars typed by hand still clear our definitions; R4a or R59 must refuse them.
- Pass 50: G80 ok. G65 failed only on timing tests under a load average of about 15 (A29). G83 held for one interaction with G65, and G81 must add pasl_ to our reserved names.
- Pass 51: A29, G65 ok. G83's first unit request loaded all 200 library functions, because need() read the keys of the JSON request (G83f1). Not run: a probe on the G83 branch, engine-calls.ts before and after.
- Pass 52: G83f1, S18 ok. G61's round 2 cut unrelated facts from docs to fit the budgets (G61f1 restored them). For S16 or G62: the sweep marks a hang after 6 s, Home's deadline is 2 s, so an input answering in 3 to 5 s goes unseen. decisions.md is full (39,972 of 40,000 bytes).
- Pass 53: G61f1 ok. G62 fix: F63 (a stored unaudited value reads one digit short) is an open bug line. G63 ok: F65 (DEG int claims 12 digits, right to 7) and F67 check against mpmath. New bug lines F63 to F67 (F64 Home's int leaves assume(x>0) on x, F66 plot NaN for x/x, F67 int drops an imaginary part). Depth-3 x trees crash the in-process engine (wasm memory out of bounds); depth 2 is decided as built, for S16.

## What the owner must do (decisions.md and backlog.md "Needs the user")
1. A21 (decisions.md): ask F-Droid whether checked-in derived data (find/factors.yaml) is acceptable; until then the recipe keeps its libxml2 and libqalculate builds. Drop QALC_OUT from the gate and pipeline when convenient.
2. Your steps from the research of 2026-10-19: push G75's patch commit once merged, then send Parisse the reply; after G77, annabell builds the release engine on the new pin.
3. G2 questions: the unanswered items of tests/golden/G2-CHECKLIST.md (including 70 and 71); optional real-G2 spot checks.
4. The phone checks in the backlog (A11's Share session and Paste among them), the new application id (install as a second app and copy what you need), the outside-test rounds (R70 first), "Allow USB debugging" when a device shows unauthorized.
5. Held steps (G69, R69, G66, G72, G73, G74, G76) wait for your release.

## Queue left for the next night
- First: scripts/pipeline.sh gorge "G63" --no-worker --audit-model auto (review-only merge of p1/gorge-m4-viewsweep), then G62f1 (sonnet, p1/gorge-m4-seqsweep), then the queue unchanged from step 86 (G64, S16, R60, R61), then the last Opus pass and the report.
- Follow-ups without a package: a backlog item for the cost of reading Giac's whole state (G65); the F61 Giac patch for round and trunc; F62 to F67; docs/04 is full (G67's proposed bullet for the engine host is not applied; it needs a trim first); decisions.md is at its budget.
