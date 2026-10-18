<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Report: the architecture for the precision-engineering goal (sandra, 2026-10-12)

Brief: [2026-10-12-sandra-architecture-brief.md](2026-10-12-sandra-architecture-brief.md). Result: [docs/04-architecture.md](../../04-architecture.md). Nothing is committed; Henri reviews and commits with the owner's OK. No feature code, no devices. One heavy step: two links of a throwaway qalc probe under the host-cpu lock (about a minute each), because the "try exact" question could only be answered with qalc's own approximation flags.

## What I verified (code, engine, data; evidence in docs/04 with `file:line` or a probe)

- **Silent wrong or unmarked values today** (docs/04 2.3, each now a regression case to write first):
  1. `0xFF` typed with the keys parses as `0*x*F*F` and Home shows `0`.
  2. Home `normald_icdf(10^-10)` shows `-6.36134035799`; mpmath gives −6.36134090240…: wrong from the 8th digit at the default 12 digits, unmarked. A 40-digit `fsolve` against `normald_cdf` fixes it (32 digits agree).
  3. At 30 digits, `UTPN(10)` and `romberg(…)` show wrong digits from the 17th; `BesselJ` and `Airy_Ai` stop evaluating above 14 digits.
  4. The CAS view reads decimals as binary floats: `1-0.9-0.1` → 1.78E-15, `evalf(sin(10^22))` → −0.5476 (true −0.8522), `1e16+1-1e16` → 0.0.
  5. Python `calc.eval("1-0.9-0.1")` → 1.78E-15 (Home: 0).
  6. Tapping a result inserts its rounded digits (`1/3`, tap, `×3` = 0.999999999999); no key reaches Ans.
  7. Rounded results carry no mark.
- **qalc (spike build, relinked probe):** "try exact" gives exact SI conversions (`72 km/h → m/s` = 20, `1 in → mm` = 127/5). qalc flags π, logarithms and uncertainties as approximate. It also accepts `1 m + 1 s` and `20 °C × 2` without error, misreads `degC`, `BTU`, `mu0` (0 kg), `epsilon0`, `NA`, `R`, `h`, `g`, and still has the wrong `hp`, flagged exact.
- **Digits 30 cost (desktop):** the 123 Home golden inputs show p95 2.74 → 3.63 ms, no path changes.
- **Find feasibility:** an index from Giac's help (1,780 entries) and qalc's data (426 unit definitions, 184 constants; not 982 units as docs/03 said, which counted nested `<unit>` references) is 282 kB, 68 kB gzip without Giac's `_` entries. Our own tiered ranking takes p95 1.04–1.23 ms per key on the desktop.
- **State:** user variables are not persisted (`workerEngine.ts:54`). Settings have no schema version. `tieRisk` has no reader. The "L7 size test" does not exist.
- **Keys:** the reference has Copy on Shift + View, Paste on Shift + Menu, Ans on Shift + `+`, Base on Shift + `−`, `[ ]` on Shift + 5, `{ }` on Shift + 8, Matrix on Shift + 4 (mapping data). Each of these settles an EN4, EN5 or EN6 position under P4.
- **Bundle:** start chunk 142.62 kB (49.64 gzip), MathLive 807.73 kB, JSXGraph chunk 1,035 kB, Python 377 kB, whole build 13 MB.

## What I changed

| File | Change |
|---|---|
| `docs/04-architecture.md` | new: the settled architecture (sections 0–9, appendices A–C) |
| `docs/02-architecture-plan.md` | header: superseded by docs/04 where they differ; Units row in section 5; "units" removed from worker 1 in the section 6 diagram; libqalculate line in 6b (interval arithmetic off, Units app); P8 note after the phases in section 8; MVP release "not scheduled" in section 12; Units in 12b |
| `docs/03-feature-analysis.md` | header points to docs/04. Corrected with "checked 2026-10-12": Ans is not reachable in Home; Help → context help (m6) and Shift + View/Menu = Copy/Paste; qalc "try exact" verified; EN3(a) needs the agreement check; EN6: our parser does not pass `0x` through; risk 4 updated |
| `docs/decisions.md` | Needs the user: **P9** (exact decimals in CAS), **P10** (Giac help lines in Find; confirm with Parisse before a public release). Defaults: "2026-10-12 Architecture for the engineer core" (the settled defaults, with evidence), and the parser-ownership correction |
| `docs/backlog.md` | header points to docs/04; engineer-core tasks rewritten: milestone 4 in 12 ordered steps, milestone 5 in 5, milestone 6 in 4, each with worker, files, tests and gate; Needs the user 6 (P9) and 7 (P10); L7 and the start-up line updated to 142.6 kB; the non-existent size test noted |
| `docs/p3-units-plan.md` | header: architecture settled in docs/04 section 4 (interface, chips, adapter checks, probe results) |
| `docs/shifts/rules.md` | three principles, not two; `app/src/input/` (the parser) is ron's, as in `ron.md`, 03 section 8 and git history (rules said gorge) |
| `CLAUDE.md` | background reading lists docs/04; architecture summary adds worker 3 and the Find index |
| `CONTRIBUTING.md` | engine interfaces link to docs/04 8.2; one line on `=`/`≈`/`⚠` |
| `README.md` | features and roadmap show the engineer core next; doc links to docs/04 and docs/03 |
| `spec/keyboard.yaml` | comments only (rows 0–3: what Vars, Math, Tmpl, View, Help become); keyboard tests pass (24/24) |

## Still (to verify), and how (docs/04 Appendix C)
- Digits 30 latency on the Tab One: `?bench=1&digits=N` (annabell, m4). Decides cap 30 or 20.
- Find per-key time on the Tab One: `?bench=find` (annabell, m4). Decides main thread or incremental/worker.
- MathLive 0.111.1 keeps `expand: false` macros and draws chips distinctly: unit test plus screenshot (ron, first step of m4 task 5); fallback `\mathrm{const:ID}`.
- `navigator.clipboard` and `navigator.share` in the Android WebView (annabell, m4). Decides the Capacitor plugins.
- Memory with three workers alive: `dumpsys meminfo` on the Tab One (annabell, m5).
- qalc release-container build time and size; currency data in qalc's compiled-in definitions; qalc's name for Rankine (annabell, gorge).
- Units first result on the Tab One (annabell, m5).

## Top five risks to the goal
1. **Correlated errors in Giac's numeric routines.** Both of Giac's paths can be wrong in the same way (`normald_icdf`), so the agreement check is not enough on its own. The answer is an audit of every Find-listed function at its domain edges, substitute-back polish for inverses, and `⚠` until audited.
2. **Find quality depends on aliases, not code.** The 100-phrase gate starts on day one, and the owner adds the queries Find misses.
3. **qalc accepts nonsense silently.** Chips only, the generator's round-trip check of every id, and the adapter's single-term and temperature checks.
4. **Tab One budgets for the new work are desktop estimates** until measured: Find per key, digits 30, and three workers' memory.
5. **Milestone 4 is heavy on parser and keyboard work:** five token kinds, Ans behaviour and Find keys, where past milestones needed many small follow-ups. The ordered task list lands the harness and the chips first.

## The owner's answers (2026-10-12)
P8 confirmed (no veto), P9 yes (exact decimals in CAS), P10 yes (ship Giac's English help lines; confirm with Parisse before a public release). Recorded in `docs/decisions.md`, `docs/backlog.md` and docs/04. The settled defaults of docs/04 stand; the two most visible ones are Help = context help (P8 had left Help free) and an operator on an empty line inserting Ans (the reference's behaviour, but a change from today).

## Follow-up the same evening (after f87874a): the advisor kit
The owner asked for sandra as a standing advisor and for the deep-dive knowledge to be kept.
- `tools/probes/` (new, with a README): the probes behind docs/04, made repo-relative and rerunnable: `engine.ts` (Home, CAS, raw Giac), `parse.ts`, `digits-cost.ts`, `qalc/` (probe glue, a link script under the host-cpu lock, a runner), `find/` (index extract from the pinned tarballs, SHA-checked, and the ranking timer). Output in `tools/probes/_out/` (gitignored). All rerun on 2026-10-12.
- `docs/research/r6-pipelines.md` (new): how a key press, a number, a build and a check flow through the code; Giac and qalc behaviour learned by probing; the doc-vs-code traps; how to check a claim fast.
- `.claude/agents/sandra.md` (new): the advisor role (`claude --agent sandra`, or spawned by Henri). Pointers in `CLAUDE.md` (background reading, Commands) and `docs/shifts/rules.md`.
- **Correction:** qalc's `units.xml.in` has 426 unit definitions, not 982 (that count included 556 nested `<unit>` references); constants are 184 (166 plus 18 built-in). Fixed in docs/03, docs/04 and this report. The reproducible Find prototype (without Giac's `_` entries) is 2,179 items, 282 kB, 68 kB gzip, p95 1.04 ms per key on the desktop.
- `tools/README.md` points to the probes; docs/04 Appendix A points to them.
