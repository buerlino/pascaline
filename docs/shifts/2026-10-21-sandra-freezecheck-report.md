<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Freeze check: the review's 18 points fixed, five core cases added (sandra, 2026-10-21)

A review of the freeze commit (8f921c4, merged as e0d03ed) found 18 points. The owner added a 19th: the main checkout lacks `scripts/`. All 19 are fixed on `p1/sandra-freezefix`. The owner decided four things: core cases c52–c56, the morning check on the Tab One, 1÷0 kept as ∞, and A28 by day before the night.

## What I checked myself (on e0d03ed, the shared engine of 2026-10-19 in `engine/giac/_out/gsl`)
- **The lock (point 4).** `build-wasm-release.sh:32` takes `host-cpu` as annabell and waits 1800 s. `devlock.sh:27` is a plain `mkdir` loop, so it is not re-entrant.
- **The count line (point 2).** R74 printed the count from `afterAll` (`R74.md:15`), which runs once per worker process.
- **Non-square powers (point 9),** with `node engine/giac/smoke.mjs`:

  | Input | Giac gives | What it is |
  |---|---|---|
  | `[[1,2,3],[4,5,6]]^2` | `91` | sum of squares |
  | `[[5],[1]]^2` | `26` | sum of squares |
  | `[[1,2,3],[4,5,6]]^3` | elementwise | |
  | `[[5],[1]]^0` | `1` | |
  | `[[5],[1]]^(1/2)` | `[[sqrt(5)],[1]]` | |
  | `[[1,2]]^2` | `5` | |
  | `[[5],[1]]^1` | the matrix | correct |
  | `[1,2]^2`, `[5,1]^2` | `5`, `26` | v·v |
  | `[5,1]^-1` | `[1/5,1]` | elementwise |

- **The MathLive cause (point 11).** `isImplicitArg` (`node_modules/mathlive/mathlive.mjs:35093`, 0.111.1) accepts only `mord|surd|subsup|leftright|mop|mclose`, so a matrix never counts as the previous atom. `controller.ts:370` handles a selection.
- **Where night.sh runs (point 19).** `night.sh:30` changes into the main checkout. It then runs henri and every pipeline line in the phase-1 worktree (`night.sh:55, 82, 93`), so only the command that starts it fails in the main checkout. The fix is to start it from the phase-1 worktree.
- **Probe of the new cases** (throwaway Playwright spec, removed after the run; desktop Chromium, real engine):

  | Case | Input | Result | Notes |
  |---|---|---|---|
  | c52 | ∫₀¹ asin(x)·12ˣ dx | `≈ 3.65123679188` | mpmath gives 3.65123638112457186 (F65) |
  | c53 | Share session of √2 | `\sqrt2 ⚠ 39 1.41421356237309504880168872420969807857` on the clipboard | F55; Chromium has no `navigator.share` |
  | c54 | 1÷0 | `infinity`, no mark | |
  | c55 | CAS Σ_{k=1}^{2000} cos(k)/k | done after 3.1 s | Esc at 300 ms gives a `cancelled` row; 2+2 then answers in 27 ms |
  | c56 | Solve, then Home, then 2+2 Enter | `= 14` | the Solve line followed to Home (F72) |

- **Oracle values** (mpmath 1.3.0): ln 10 = 2.302585092994045684…; ∫₀¹ asin(x)·12ˣ dx = 3.65123638112457185941….
- **The docs check passes:**

  | File | Size | Budget |
  |---|---|---|
  | brief | 25.9 kB | 28 kB |
  | backlog | 14.4 kB | 20 kB |
  | decisions | 39.0 kB | 40 kB |
  | docs/04 | 68.9 kB | 70 kB |
  | largest package | 5.7 kB | 6 kB |

## What changed, by review point
1. **Full docs.** decisions.md: the full texts of R15c and P7 went to the archive and short lines replaced them. docs/04: alternatives trimmed, Appendix B folded into 3.8, the `tieRisk` note moved to the backlog, section 0 items 7 and 13 shortened. A new sentence in brief section 2 says workers never cut text they did not write to fit a budget.
2. **R74's count.** A reporter (`core-reporter.ts`) prints the count once in `onEnd`. The core file runs its cases in parallel.
3. **G85's bars.** Bar 1 is now "no mismatch the report calls a bridge bug". The call-count bar now says how it is counted. The golden gate is a build check, not a bar.
4. **G85's lock.** The package now says when to take the lock and when not to. Its wrappers resolve their exports on first call, with a test on today's engine (this is also point 16).
5. **R75 moves up** to step 102, right after R74.
6. **G92 is held for G85's report** (the brief, P23 point 3, S23, the backlog). F64 moved to the background stream.
7. **One order.** Section 0 gives only the reasons; the order is 0c's queue, steps 101–110.
8. **Core cases (owner).** Added c52 (F65), c53 (F55), c54 (1÷0), c55 (Cancel) and c56 (F72). Schema additions: `rows` (with `status`), `clipboard`, and `{wait: ms}`. G90's and R69's Done-when lines now drop the `known:` on their case.
9. **G97 widened** to every power but 1 of a non-square matrix, with expected values for the vector cases. After A28, at step 104.
10. **c38, c39, c43.** Their keys are a placeholder, and R4a's Done-when now rewrites them as the Find route.
11. **MathLive.** R75 names MathLive's share of the cause. The backlog's upstream list gets M5, which R75 drafts.
12. **Morning check.** It runs on the Tab One with the APK the night checked (A33 now leaves its last APK installed). The day session logs `morning <date>: clean|fails <ids>` in `.coord/log.md`, and brief section 8 counts these lines.
13. **A32's audit** runs on Opus (the queue row, rule 1, the command list, the package).
14. **Start lines** fixed in A28, G87, R4a and G97. P23 point 3 now names every held package.
15. **Early end.** If no step can start, the night goes to its last pass and the report; an early end is fine. A28 should run by day first (owner).
17. **"Why" reworded.** 45 of 208 merges since 2026-10-14 were follow-up fix packages.
19. **Start command.** The brief's section 0c and `tools/README.md` say to start night.sh from the phase-1 worktree.

## New findings, logged in the backlog (to verify)
- **F72 (core lane, no package yet).** A value typed in Solve's Num view stays in the shared line after Enter and follows you to Home. Typing 2+2 Enter there gave `12+2 = 14`. ron should first check whether R34 meant this. Core case c56 fails until it is fixed, so **the freeze cannot end without a package for it** (the next free R id).
- **F70 (background).** In Home, Σ to 10^5 of 1/x and Σ to 2000 of cos(K)/K fail after about 1 s with "The calculation failed", not a time-limit message. gorge should check whether this is the deadline or an engine error.
- **F71 (background).** CAS Σ_{k=1}^{2000} cos(k)/k shows raw LaTeX text instead of a drawn result. For ron.

## Still to verify
- **c52–c56 on the Tab One** (A32): c55's 300 ms wait has a margin of about 10× on the desktop. c53 depends on whether the WebView has `navigator.share`; A32 now says how to handle it.
- **The cell-by-cell keys of c52 and c56** were checked only through my probe; R74's run confirms them.

## Top risks
- **F72 has no package**, and while it doesn't, the freeze cannot end. Draft it tomorrow by day (ron, about 0.25 d).
- **decisions.md has 1.0 kB left.** The next Opus pass that writes more than that must move built entries to the archive first; P16 is the next candidate.
- **Most of the background stream waits for A28.** If A28 isn't merged before the night starts, the night may end early.
