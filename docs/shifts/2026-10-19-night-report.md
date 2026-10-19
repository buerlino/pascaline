# Night report 2026-10-19 (fourth night)

Pipeline runs 51 to 74, eight Opus passes (20 to 27). The shift began with A14 and A15 by day (00:34) and the night proper started at 00:46. The owner ended `night.sh` at 10:54 after Opus pass 27; no package was running. Gates at pass 27 (phase-1 2da6710): typecheck 0 errors, vitest 1154/1154 with the Find index required, e2e 1044 passed and 1 skipped, golden gate passed (home 260/260, precision 222/222 with 1 pending, solve 54, function 28, units 136, parser 586/588 with 2 known gaps). Nothing was pushed.

## Merged into phase-1
- Pipeline and docs: A14 392884a (the pipeline reads the package files), A15 8745db1 (audit model is a floor; size and docs checks run), S12 ad9e070 (G2 audit table), S10 83474da (docs/04 from 69.5 to 59.7 kB).
- Angle mode: S14 8eb3fc9 (the 52-row research matrix; route R still open), R64a 86d9e2e (in DEG the Function plot scales the trig arguments), G34 b6ba560 (an angle-dependent exact value is stored, carried and exported as its confirmed decimal, marked ≈).
- Precision and marks: G38f1 6bb2f81 (G38's second decision; stored functions count as decisions), G38f2 5083753 (oracle fields for two cases), G39 36cfbd9 and G39f1 65b7fe1 (divergent sums and integrals; CAS guarded assignment), G35 5204408 (a zero term keeps its dimension), G36 299054b (FIX for complex values has its own digit count).
- Chips and facts: G49 3f6e273, G49f1 04c82a2, G49f2 ef23277, G49f3 d781f12, G49f4 20351f0 (a function, CAS definition or arrow function built from an inexact chip or name lends its facts), R65 df3296b (the session sends chips by name with facts).
- Complex and stats: G50f1 8872384 (CAS `w:=tanh(i)` then `evalf(w)` is right, else ⚠ naming the function; this merge carries G50), G42f1 2da6710 (median and percentile refuse symbols, complex elements and a non-real p; this merge carries G42).

## Unmerged
Nothing is left open. G38, G39, G50 and G42 each stopped at the pipeline's two-fix-round limit and were finished as G38f1, G39f1, G50f1 and G42f1 (branches kept until merged). Pass 22 found that run 59 merged G39's branch ref at aa1fad5, not the audited fix round ee654cd; G39f1 repaired that.

## Opus passes (NOTES)
- Pass 20: A14's backlog tick covered S10, and S12's covered G45 and R66 to R68; both lines split. `pipeline.test.sh` checks fixed dry-run echo lines, not `want_checks` or `resolve_audit_model` (filed for annabell). R66 makes `(−8)^(1/3)` complex in Home again (∛ stays −2), reversing P5 (b).
- Pass 21: S14's option-2 display examples re-derived by hand; the new docs/04 section 2.12 waits for the owner's yes to route R. R64a did not report the Function chunk's size delta.
- Pass 22: G34 oracle values checked against mpmath. G38 left four findings (stored functions, a float re-run at display digits, missing oracle fields, missing 30-digit rows); the cos(pi/7) tie is ⚠ without a count (default).
- Pass 23: found 2 oracle problems (G38f2). Probe: a result G38 marks ⚠ loses the mark through Store (`a:=floor(sin(10^100)*10^12)`); G49 step 3 covers it.
- Pass 24: G49 gave no facts to a function built from an inexact chip, and the golden runner gave a chip a value the app never sends (G49f1, G49f2). Romberg's stored B keeps Giac's float while Ans carries 11 digits; both are flagged.
- Pass 25: G49f1 left CAS definitions and names redefined after the function (G49f3). decisions.md is at 39,994 of 40,000 bytes.
- Pass 26: G49f3 left arrow definitions silent (G49f4); G50 and G42 round-2 findings confirmed by probe. A CAS result with no float, from a name or function with facts, shows no mark; it is a backlog package after G49f4.
- Pass 27: all three fixes ok. Minor: in CAS, `g(x):=tanh(x)+w` with `w:=tanh(i)`, then `evalf(g(i))`, shows ⚠ 0.9*i with no confirmed digit; the mark is honest but the value is wrong (a later package could refuse it).

## What the owner must do (decisions.md "Needs the user")
1. S14: say yes to route R (angle mode); R64 and then G46 wait for it.
2. S12: R66 ran under the 2026-10-19 rule and reverses P5 (b). If −2 is wanted for `(−8)^(1/3)`, R39 returns.
3. Pipeline: `scripts/pipeline.sh` audits the worktree's HEAD but merges the branch ref. Recommendation: a small annabell package that merges the audited commit and stops when the branch is not HEAD. Until then, check every merge that follows a fix round.
4. Still open from earlier nights: S4 scope, S9 yes, G15 `rpm → rad/s` message, R50a palette pick, R56 for Solve and the Function app, G33 lazy definition if A12 confirms the miss, G21 (a DEG `re` of a substituted `exp(i*x)` gives 0 with no mark; recommendation G21b with a Giac patch).
5. Optional: delete the gitignored `engine/giac/_out` link in this worktree if stale.

## Queue left for the next night
- The night check of 2026-10-19 (874ab01) rewrote the queue (brief 0c steps 30 to 58, route R). The next step is 30 (S15); the next Opus pass is 28.
- Follow-ups: the G49 CAS no-float mark package; `pipeline.test.sh` coverage of `want_checks` and `resolve_audit_model`; the Store ⚠ loss (G49 step 3); R15c2's rewrite of docs/04 5.1 must not grow the file.
