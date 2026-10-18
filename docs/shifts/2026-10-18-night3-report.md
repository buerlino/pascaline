# Night report 2026-10-18 (third night)

Pipeline runs 36 to 50, six Opus passes (14 to 19). The night began after the owner merged S5 (4ab5634) and answered G2 items 45, 54 and 60. Gates at pass 19 (phase-1 b6370a5): typecheck 0 errors, vitest 1050/1050, e2e 1042 passed and 1 skipped, `docs-check` ok. The golden gate was not run in pass 19 (no engine or parser change); at pass 18 (df3cad8) it passed (units 119/119, parser 586/586) and `npm run size` passed (start chunk 53.22 of 54.00 kB gzip). Nothing was pushed.

## Merged into phase-1
- Units chain: R24a d904baa (the unit slot), R24af1 a5e4d1b (a prefixed pair counts only when factor and dimension match), R28 376ab86 (units-mode parse), R28f1 83b8aee (the sign of a `±` number goes inside `pasupm`), G32 36b9936 (`rpm` and `rev` against an angle get their own message).
- Engine and data: G7 de9b388 (Find data: kip, fbm, Ah, mAh, TR, StdT, StdP; `rev` counts cycles), G30f1 99beb2e (E-series tables out of the start chunk), G31 383fabe and G31f1 5ec5a5d (FIX zero rule; scientific fallback cut to the confirmed digits), G21 cfa8b74 and G21f1 a2259eb (typed `exp` ignores DEG; the helper name `pasexp` never reaches the screen).
- App: R12a 9aacb29 (visual-pass mockup, review only), R48 21240ab (key faces equal the typed text under Shift + Alpha and the lower-case lock), R58 df3cad8 (CAS view: Alpha types lower case, Shift + Alpha the capital).
- Docs: S7 b6370a5 (the docs diet: one file per package, `docs-check`).

## Unmerged
Nothing. Every FIX line from the Opus passes (R24af1, R28f1, G30f1, G31f1, G21f1) was run as a package and merged.

## Opus passes (NOTES)
- Pass 14: the G7 decision (`cyc` and `cycle` moved to `rev`) is now a default: `rev` has rev, revolution and cycle, `cyc` is on no item, StdP is 1 atm. Found R24af1 (prefixed pair read as another unit, e.g. milli + inch as "minute").
- Pass 15: found R28f1 and G30f1 (`npm run size` failed at 54.39 of 54.00 kB; the pipeline's checks do not run `npm run size`). k + Da stays marked (default). British, American and Johnson keep their capital in R24c's text. A minus before a bracketed `±` value is still refused with the temperature-difference message (a refusal, not a wrong number).
- Pass 16: G31 followed G2 item 60 but showed unconfirmed digits in the scientific fallback (G31f1). G30f1 and G31 got Sonnet audits although rule 1 asks for Opus on gorge. In `host.ts`, any name not in ENGINE_DEFINITIONS falls back to the eseries text; a second such name needs a map.
- Pass 17: G21 leaked `pasexp` into the display (G21f1). New owner item: in DEG, `re` of `subst(exp(i*x),x=90)` gives 0 with no mark where the RAD value is -0.448; recommendation is a gorge package G21b with a Giac patch. An engine probe may have left a gitignored link at `engine/giac/_out` in this worktree.
- Pass 18: neither R48 nor R58 measured its size delta, and the gallery was not rendered or looked at (e2e checks the face text). R58's open question is a default: Shift + Alpha stays the capital in the CAS view until the unchecked half of G2 item 45 is tried. The comments at the top of `spec/keyboard.yaml` still say Alpha types the capital everywhere (in R15c3's block).
- Pass 19: docs are within budget (docs/04 is 69.5 of 70 kB, so R15c2's rewrite of 5.1 must cut as much as it adds). Until A14 is merged every package text lives twice, and a change to one copy fails `docs-check`. `docs-check` also reads untracked Markdown (`git ls-files -co`), so a stray local note with a broken link fails `npm run gate`. gc.sh's dry run overwrites the day's applied report (A14 picks this up).

## What the owner must do (decisions.md "Needs the user")
1. G21: in DEG a symbolic `exp(i*x)` substituted at 90 can give 0 with no mark. Recommendation: gorge package G21b with a Giac patch.
2. Still open from the earlier nights: S4 scope (definitions only), S9 yes (S2's new Menu numbers wait for it), G15 `rpm → rad/s` message, R50a palette pick (R50b then writes it), R56 for Solve and the Function app, G33 lazy definition if A12 confirms the miss.
3. Optional: delete the gitignored `engine/giac/_out` link in the phase-1 worktree if it is stale; spot-check G30's E48 to E192 tables against IEC 60063.

## Queue left for the next night
- Step 17 (S6) waits for A14 (its row says "S7 and A14"); step 18 (S8) waits for S6. A14 runs first, by day.
- Steps 17 to 19 were skipped tonight because S7 was meant to be the last package. No Opus pass is pending.
- Not at night: the ron lane (R15c1 to R15c4, R49, R50b, R12b, R12c, R53 and the rest, by day), devices (A9, A4b, A11, A12), A7 and A8 (the owner's go), R59, R38a and R38b (their texts are completed by S6's report).
- Follow-ups for annabell: the e2e timing rerun should compare its failures with Playwright's "N failed" summary; `npm run size` should join the pipeline checks.
