<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Docs index

What to read, and where each fact lives. One place per fact: status and tasks in [backlog.md](backlog.md), decisions in [decisions.md](decisions.md), the binding rules in [rules-core.md](rules-core.md), one file per open work package in [shifts/packages/](shifts/packages/). The garbage collection of the pipeline (`scripts/gc.sh`) checks that every path named here exists; `node tools/docs-check.mjs` checks every link and the size budgets (the numbers are in the script), and `npm run gate` runs it.

## Read before larger design decisions

- [04-architecture.md](04-architecture.md): **the architecture for the engineer goal** (2026-10-12): precision chain and marks, Find, the unit view, keys, state, build, gates and budgets. Supersedes docs/02 where they differ.
- [research/r6-pipelines.md](research/r6-pipelines.md): how a key press, a number, a build and a check flow through the code today, engine, qalc and MathLive behaviour learned by probing, and how to check a claim fast (probes in `tools/probes/`).
- [06-keypad-vs-g2.md](06-keypad-vs-g2.md): every difference between our keypad and the G2's, with its reason (decision P12). Read before changing a key.
- [02-architecture-plan.md](02-architecture-plan.md): the original plan. Stack, app→component mapping, solver choice, effort, F-Droid, licence.
- [01-feasibility-report.md](01-feasibility-report.md): the original study. **Section 3 (legal) is binding**; the rest is superseded by 02.
- Decisions: Phase 0 results and defaults D1–D9, P1, P2 in [spike/RESULTS.md](../spike/RESULTS.md) and [spike/DECISIONS.md](../spike/DECISIONS.md); from Phase 1 on in decisions.md (above).
- [CONTRIBUTING.md](../CONTRIBUTING.md): contributor rules (clean room, DCO, dependencies, golden-test sources); keep it consistent with rules-core.md.
- Outreach drafts (r/calculators post, email to Bernard Parisse) are kept **outside the repo** in `../outreach/`. The user sends these personally.

## The rest of docs/ (what each file is for)
- [03-feature-analysis.md](03-feature-analysis.md): **section 0 is binding** (the owner's design rules and the removal tests); the engineer-core plan and gates (section 8).
- [05-ui-plan.md](05-ui-plan.md): the UI plan for milestone 4a (its section 7 wins where it differs); [feedback.md](feedback.md): the owner's feedback inbox, dated, in the owner's words (docs/03 rule 12).
- [shifts/rules.md](shifts/rules.md) (the standing rules for every agent; section 4 is the pipeline) and [shifts/brief.md](shifts/brief.md) (the path, the table of open packages, the night queue; the package files are linked above). Shift reports land in shifts/ and move to the archive once their findings live in the docs: today [the night of 2026-10-21](shifts/2026-10-21-night-report.md) (the latest), [the core freeze](shifts/2026-10-21-sandra-freeze-report.md) (P23: the plan, the replay, what is still to verify), [the themes report](shifts/2026-10-18-themes-report.md) (R50; its section 6 is open, R50e) and [the cleanup of 2026-10-20](shifts/2026-10-20-cleanup-report.md) (open packages link it).
- **The core freeze (P23):** [../tests/core/README.md](../tests/core/README.md) (the core list's rules and how it runs), [core.yaml](../tests/core/core.yaml) (the cases) and [MORNING.md](../tests/core/MORNING.md) (the owner's daily check).
- Research notes, each opening with its status line (rules section 10); the live ones (open and reference) stay under 150 kB: [research/r12-evidence.md](research/r12-evidence.md) (the evidence behind docs/04: the regression list, units on Giac, the module table), [research/r18-outside-test.md](research/r18-outside-test.md) (the outside test: two rounds, the script), [research/bug-patterns.md](research/bug-patterns.md) (every bug to 2026-10-19 by family), [research/r4-building-blocks.md](research/r4-building-blocks.md), [research/r2-wasm-start.md](research/r2-wasm-start.md), [research/engineer-needs.md](research/engineer-needs.md), [research/fdroid-feasibility.md](research/fdroid-feasibility.md), [research/giac-help-licence.md](research/giac-help-licence.md); r6 is above. Decided notes move to [archive/](archive/) once their packages exist: the unit slots (r7), the menus (r8), the unit pad (r9), the library file (r10), files and the backup (r11), results mode (r13), the angle mode (r14), state facts (r15), verification (r16), the unit result view (r17), the S12 audit (g2-correspondence) and the multi-engine answer.
- Mockups, each the picture an open package or test builds from: [mockups/outside-test.html](mockups/outside-test.html) (the outside test's sheet, R18), [mockups/themes-r50.html](mockups/themes-r50.html) (R50e), [mockups/top-cluster.html](mockups/top-cluster.html) (layout D, today's keys; `app/test/topcluster.spec.ts`), [mockups/top-cluster-r15c.html](mockups/top-cluster-r15c.html) (R3, the R15c chain), [mockups/unit-pad.html](mockups/unit-pad.html) (R9, the R24 chain), [mockups/unit-result.html](mockups/unit-result.html) (R17, R62), [mockups/visual-pass.html](mockups/visual-pass.html) (R12b).
- History only, in [archive/](archive/): the full decision log to 2026-10-18 ([archive/decisions-2026-10.md](archive/decisions-2026-10.md), read when a decision is questioned), the backlog with its done items ([archive/backlog-2026-10.md](archive/backlog-2026-10.md)), the finished shift and check reports ([archive/shifts/](archive/shifts/)), the cleanup audit of 2026-10-12 ([archive/cleanup-audit-2026-10-12.md](archive/cleanup-audit-2026-10-12.md)), the units plan that P15 replaced ([archive/p3-units-plan.md](archive/p3-units-plan.md)) and the Python notes ([archive/python-notes.md](archive/python-notes.md); the app was removed by P11).

## Architecture
The component diagram is docs/04 section 8.1; what follows is the short list of the decisions that shape it.

Key decisions (reasons in docs/02 and the decision logs):
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
