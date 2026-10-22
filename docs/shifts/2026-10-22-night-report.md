# Night report 2026-10-22 (seventh night)

Pipeline runs 171 to 182, Opus passes 54 to 58. The shift ran from 22:39 on 2026-10-21 to 07:37, and stopped at the time limit (`--until 07:30`) with 19 steps. The last pass had no closing Opus pass of its own (NO PASS); pass 58 was the one before. Nothing was pushed.

**Core list:** desktop CORE 52/52 (known 1: c56 F72; needs 3) at phase-1 0eb486f. On the Fairphone 6 CORE DEVICE 51/51 (known 2, needs 3), from A32's run at pass 57. The Tab One has not run the list yet (A33). Gates at pass 58 (0eb486f): typecheck 0 errors (707 files), vitest 1688/1688, e2e 1140 passed with 4 skipped, golden gate passed. Calls per Home input: 13.81 against a limit of 14.39 (pass 57).

## Merged into phase-1
- Day, before the night: S19 2302c52, G63 5021a13, S21 4e2b4f8, G62f1 880f580, S22 73ea5b5, A28 60f858d (checked by pass 54).
- Core list: R74 7f4f6c1 (tests/core runs inside e2e, one CORE line), R75 dd8b3cc (a key that takes the term before it now takes a whole matrix or vector).
- Precision and engine: G90 61607ec (a definite int that Giac cannot close is read from the typed integrand with float bounds, shown as ⚠, at most 14 digits), G85 8861b6d (bridge spike: GO on all four bars, the host does not call it; new shared engine key f99ba8f84cafd3af), G97 with G97f1 93be51a (a non-square matrix power, inverse or division is refused; workaround row in patches/README.md; F74 filed), G76 822f1b7 (ValueFacts carried whole), G86 1ad117a (the chip rule).
- Tests and tools: G88 197e2d7 with G88f1 acbd9f8 (the text-match baseline is now a vitest case, so every pipeline run enforces it), A32 b1fefcd (WebView debugging off unless the build uses the test flag; core list on the device).
- Clipboard: R69 0eb486f (Copy session writes the mark the screen shows).

## Unmerged
Nothing is held on a branch. Two fix packages from pass 58 were not started:
- G86f1 (p1/gorge-casbool-chip): a CAS true or false that rests on a float still gives an exact chip (results.ts casItem line 123), so Ans loses the approximate mark. Home does this right.
- R69f1 (p1/ron-copymark-frac): in fraction mode Copy session writes "1/3 = 0.3333…" (40 digits), a false equation; markFor also gives "=" for an exact path with warn unchecked.

## Opus passes (NOTES)
- Pass 54: S19, G63, S21, G62f1, S22, A28 ok. The shared engine had no A28 stamp, so R74 rebuilt it first (305 s). G69 must clear three known entries, among them a definite int after a "=>" store that still shows ⚠.
- Pass 55: R74, R75, G90 ok. CORE 51/51 on desktop (known 2: c53 F55, c56 F72). G90's default settles the mark-only ⚠ rule and the e2e clipboard races. Open question: a { } list squared shows = 5 (dot product) while its x⁻¹ and ÷ go elementwise.
- Pass 56: G97 code right, but two doc findings and the text-baseline rise (host.ts 28, nonsquare.ts 7) were open (G97f1). G85 ok; the QUOTING table now exists in host.ts and api.cc, and S23 must give it one source or a comparing test. G88's ratchet ran only in `npm run gate` (G88f1).
- Pass 57: G88f1, G97f1, A32 ok. c53 is desktop-only on the device (the WebView blocks reading the clipboard), step 2a of A33. F74 (a user function's body is not checked for non-square powers) has no package; S23 should place it. Not run: anything on the device.
- Pass 58: G76 ok (its lead, an exact result with warn unchecked getting "=" in fraction mode, goes to R69f1). G86 fix and R69 fix as above. The golden runner parses its latex steps without chipNames, so the gate checks a different input than the app: backlog line F75, no package.

Carried over from the previous night: G67's report notes that restart and rm_all_vars typed by hand still clear our own definitions behind the host's back; R4a or R59 must refuse them.

## What the owner must do
1. The Fairphone still has the test build with WebView debugging on: reinstall a release build.
2. Decide the { } list squared: I recommend elementwise {1,4} as a small package after G97 (pass 55).
3. MathLive M5 is drafted in ../outreach/upstream-reports.md and not filed.
4. The older items under "Needs the user" in decisions.md and backlog.md (F-Droid and checked-in derived data, Parisse reply, G2 checklist, phone checks, held steps).

## Queue left for the next night
- First: scripts/pipeline.sh gorge for G86f1 (sonnet), scripts/pipeline.sh ron for R69f1 (sonnet), then the queue unchanged from step 120 (G75, G60, G56, S17, G77, G89, G91, G87, G96, G64, S16), then the last Opus pass and the report. Steps 101 to 103 are done.
- By day: S23 (also owns the QUOTING table copy, F73 and F74), and A33 for the Tab One run of the core list.
- Follow-ups without a package: F63 to F67, F72, F75.
