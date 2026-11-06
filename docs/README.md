<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Docs index

What to read, and where each fact lives. One place per fact: status and tasks in [backlog.md](backlog.md), decisions in [decisions.md](decisions.md), the binding rules in [rules-core.md](rules-core.md), one file per open work package in [shifts/packages/](shifts/packages/). The garbage collection of the pipeline (`scripts/gc.sh`) checks that every path named here exists; `node tools/docs-check.mjs` checks every link and the size budgets (the numbers are in the script), and `npm run gate` runs it.

## Read before larger design decisions

- [04-architecture.md](04-architecture.md): **the architecture for the engineer goal** (2026-10-12): precision chain and marks, Find, the unit view, keys, state, build, gates and budgets. Supersedes docs/02 where they differ.
- [research/r6-pipelines.md](research/r6-pipelines.md): how a key press, a number, a build and a check flow through the code today, engine, qalc and MathLive behaviour learned by probing, and how to check a claim fast (probes in `tools/probes/`).
- [06-keypad-vs-g2.md](06-keypad-vs-g2.md): every difference between our keypad and the G2's, with its reason (decision P12). Read before changing a key.
- [02-architecture-plan.md](02-architecture-plan.md): the original plan, trimmed to what still binds: the solver choice (section 4), licence and F-Droid (sections 10–11), the release phases (8) and the milestone history (12); the rest is in git at `82b261f9`.
- [01-feasibility-report.md](01-feasibility-report.md): the original study, trimmed to its binding **section 3 (legal)** and its sources; the rest is in git at `82b261f9`.
- Decisions: Phase 0 results and defaults D1–D9, P1, P2 in [archive/phase-0-results.md](archive/phase-0-results.md) and [archive/phase-0-decisions.md](archive/phase-0-decisions.md); from Phase 1 on in decisions.md (above).
- [CONTRIBUTING.md](../CONTRIBUTING.md): contributor rules (clean room, DCO, dependencies, golden-test sources); keep it consistent with rules-core.md.
- Outreach drafts (r/calculators post, email to Bernard Parisse) are kept **outside the repo** in `../outreach/`. The user sends these personally.

## The rest of docs/ (what each file is for)
- [03-feature-analysis.md](03-feature-analysis.md): trimmed to what binds: **section 0** (the owner's design rules and the removal tests), section 6 (the task benchmark) and section 7 (the precision promises); the engineer-core plan is in git at `82b261f9`.
- [05-ui-plan.md](05-ui-plan.md): the UI plan for milestone 4a (its section 7 wins where it differs); [feedback.md](feedback.md): the owner's feedback inbox, dated, in the owner's words (docs/03 rule 12).
- [release-0.1.0.md](release-0.1.0.md): what v0.1.0 must meet and the days to its tag (owner, 2026-11-01); [release.md](release.md): the owner's checklist for every release tag (A8).
- [shifts/rules.md](shifts/rules.md) (the standing rules for every agent; section 4 is the pipeline) and [shifts/brief.md](shifts/brief.md) (the path, the table of open packages, the night queue; the package files are linked above). Shift reports: those of the last week are in shifts/ (the night review reads the last few); a report is deleted a week after its last commit and older ones are in git, unless code or a live doc cites one as its spec (rules section 10; r19 cites S25's report), for example the first two-lane night (`shifts/2026-10-30-night-report.md` at `08e037fd`), the core freeze (`archive/shifts/2026-10-21-sandra-freeze-report.md` at `4eacbed6`) and the cleanup of 2026-10-20 (`archive/shifts/2026-10-20-cleanup-report.md` at `87a8c468`).
- **The core list (P23, the net after the freeze):** [../tests/core/README.md](../tests/core/README.md) (the core list's rules and how it runs), [core.yaml](../tests/core/core.yaml) (the cases) and [MORNING.md](../tests/core/MORNING.md) (the owner's daily check).
- Research notes, each opening with its status line (rules section 10); the live ones (open and reference) stay under 150 kB (86.1 kB after S27, 2026-11-06): [research/r12-evidence.md](research/r12-evidence.md) (the evidence behind docs/04: the regression list, units on Giac, the module table), [research/r18-outside-test.md](research/r18-outside-test.md) (the outside test: two rounds, the script), [research/bug-patterns.md](research/bug-patterns.md) (the sixteen bug families, each with its pattern and hunt lead; the rows to 2026-10-19 at `742169a8`), [research/night-review-2026-11-02.md](research/night-review-2026-11-02.md) (the night review of 2026-11-02: what to verify, place or decide), [research/r19-results-and-keys.md](research/r19-results-and-keys.md) (results mode, the six top-right keys, the viewport room; S25); r6 is above. Decided notes are deleted once their packages exist; one that code or a live doc cites as its spec moves to [archive/](archive/): the unit slots (r7), the menus (r8), the unit pad (r9), the library file (r10), files and the backup (r11), results mode (r13), the angle mode (r14), state facts (r15), verification (r16), the unit result view (r17), the S12 audit (g2-correspondence, `tests/golden/g2.yaml`) and the structure hindsight (the bridge, `app/src/engine/bridge.ts`); the multi-engine answer is in git only (`archive/multi-engine-answer.md` at `98e96656`); [archive/giac-help-licence.md](archive/giac-help-licence.md) (R5) stays as the evidence for the help texts' licence (THIRD_PARTY.md, docs/04's Find generation, `tools/find-index/generate.mjs`). The reference notes R1 (F-Droid, `research/fdroid-feasibility.md` at `742169a8`), R2 (wasm start, `research/r2-wasm-start.md` at `7789c445`), R3 (engineer needs, `research/engineer-needs.md` at `7789c445`) and R4 (building blocks, `research/r4-building-blocks.md` at `742169a8`) are in git only.
- Mockups, each the picture an open package or test builds from: [mockups/outside-test.html](mockups/outside-test.html) (the outside test's sheet, R18 and r18), [mockups/top-cluster-r15c.html](mockups/top-cluster-r15c.html) (R3, today's keys and the R15c chain; `app/test/topcluster.spec.ts`), [mockups/settings.html](mockups/settings.html) (Mode and Settings in one sheet, presets: R49, R85–R89; the Settings tests and views name its sections), [mockups/results-mode.html](mockups/results-mode.html) (the six top-right keys, results mode and the viewport room: S25, R129; the owner picks from it). The mockups of merged packages are in git only: the unit pad (R9, R24a–R24d; `mockups/unit-pad.html` at `b1de57ee`, its rule in [archive/r9-unit-pad.md](archive/r9-unit-pad.md)), the unit result (R17, R62; `mockups/unit-result.html` at `b1c44ee4`), the visual pass (R12b, R12bf1, R12c; `mockups/visual-pass.html` at `295c4e03`) and the status line (R82f2, R83, R84; `mockups/status-line.html` at `3856ad4d`).
- History only, in [archive/](archive/): the full decision log to 2026-10-18 ([archive/decisions-2026-10.md](archive/decisions-2026-10.md), read when a decision is questioned), the Phase 0 record (above), and what code or a live doc cites as its spec: the decided notes named above, the units plan that P15 replaced ([archive/p3-units-plan.md](archive/p3-units-plan.md), amended by docs/03 section 4) and three reports in [archive/shifts/](archive/shifts/) (the themes' contrast rules for `app/scripts/theme-gen.ts`, the check of 2026-10-19 for `tests/golden/units.yaml`, A16's Enter p95 for decisions.md); the other shift reports, the backlog with its done items (`archive/backlog-2026-10.md` at `87a8c468`), the cleanup audit of 2026-10-12 (`archive/cleanup-audit-2026-10-12.md` at `87a8c468`) and the Python notes (`archive/python-notes.md` at `bf418e9d`) are in git only.

## Architecture
The component diagram is docs/04 section 8.1; what follows is the short list of the decisions that shape it.

Key decisions (reasons in docs/04 and the decision logs):
- **MathPrint everywhere:** textbook entry driven only by our keyboard (÷ makes a stacked fraction); results drawn in 2D from Giac `latex()` by MathLive, never raw engine text. One-line entry is a setting.
- **Our own LaTeX-subset parser** (P1) turns MathLive's LaTeX into Giac input and plot evaluators. Each keyboard template needs a parser rule and a round-trip case in the same commit.
- **Home = Giac "exact-first":** decimals become exact fractions, results are rounded to 12 digits and shown as decimals (`1÷3` → `0.333333333333`), with a float fallback when numbers get too big or slow. Exact 2D results belong to the **CAS** view.
- **No PPL, no Python** (P11: the Python app was removed in milestone 4a). Programs are Giac function definitions.
- **Solving: GSL inside the Giac wasm** (bracket + Brent, Newton/Steffensen, `hybrids`/`hybridsj` for systems, `proot` for polynomials). **Every root is substituted back**, with a ⚠ when the residual is large.
- **Releases build the engine with Debian's Emscripten** in a pinned `debian:trixie` container (P2); emsdk 6.0.12 is for development. Every engine build that ships must pass the golden gate.


## Stack (pin exact versions in package files and THIRD_PARTY.md)
TypeScript (strict, no `any`), Vite, **Svelte 5** for the app shell (D1; keyboard, parser and engine client stay plain TS), MathLive (MIT), JSXGraph (LGPL/MIT), Capacitor (MIT), Emscripten, Giac (GPL-3.0+), GMP/MPFR (LGPL), GSL (GPL-3.0+), Vitest, Playwright.


## This machine (checked 2026-10-10)
- Rocky Linux 10.2, 16 cores, 28 GB RAM
- Node 22.23 / npm 10.9 (no pnpm, so use npm), Python 3.12, CMake 3.31, GNU Make 4.4, git 2.52
- Java 21 (OK for Capacitor/Gradle), Android SDK at `~/Android/Sdk` (`adb` works; `sdkmanager` prints a deprecation warning but works)
- Docker 29 and Podman 5 available (useful for reproducible Emscripten / fdroidserver builds)
- Emscripten SDK 6.0.12 is installed in `~/emsdk` (see Commands).
- Browsers: Firefox 140 ESR only. Playwright installs its own Chromium (`npx playwright install chromium`).
- A local checkout of **fdroiddata** is at `../fdroiddata`. Reference recipes: `metadata/com.graphhopper.maps.yml` (Capacitor), `metadata/net.alexbarry.alexgames.yml` (Emscripten).


## Glossary
- **Home**: numeric calculator view. **CAS**: symbolic view (Giac).
- **Symb / Plot / Num**: the three views of every app (definition, graph, table).
- **Giac**: the C++ CAS by B. Parisse and R. De Graeve (Grenoble). The real Prime uses it too.
- **KhiCAS**: Parisse's calculator UI for Giac. A source of ideas and possibly code (GPL).
- **Golden case**: input + settings + expected output + `source:`.
