# CLAUDE.md: Pascaline

Pascaline is an open-source graphing CAS calculator for engineers (Android and PWA, later iOS and desktop): the HP Prime G2's logical key layout and flow, our own look, plus units, uncertainty and honest precision. GPL-3.0. Repo: https://github.com/buerlino/pascaline (default `master`; work on `phase-1`; `gh` is not logged in). **Never push or commit without the owner's OK.**

**[docs/rules-core.md](docs/rules-core.md) is binding:** the goal, the three principles, and the clean-room, F-Droid and maths-correctness rules. Read it first. **Now: the core freeze (P23, 2026-10-21):** no new features until the core list (`tests/core/`) holds on desktop and on the night's device (the bar: `docs/shifts/brief.md` section 0, "What holds means"); the order of work is the same section. Status and tasks: [docs/backlog.md](docs/backlog.md). Decisions: [docs/decisions.md](docs/decisions.md). What to read for a design question: [docs/README.md](docs/README.md).

## Commands (Emscripten 6.0.12 in `~/emsdk`; the build scripts source it themselves)
```bash
engine/giac/build-wasm.sh                 # Giac+GSL+GMP+MPFR → engine/giac/_out/gsl/giac.{mjs,wasm} (≈5 min; WITH_GSL=0 → _out/base)
engine/giac/build-wasm-release.sh         # release engine in the debian:trixie container (P2) → _out/release + SHA256SUMS
engine/qalc/build-wasm.sh [dev|release]   # libqalculate → engine/qalc/_out/<mode>; developer only, for tools/find-index/refresh-factors.mjs (P22)
node engine/giac/smoke.mjs 'factor(x^4-1)'                 # engine smoke test (VARIANT=gsl|base)
cd app && npm ci && npm run dev                            # http://localhost:5173 (?engine=fake echoes input)
npm run typecheck && npm run index && FIND_INDEX=required npm test   # svelte-check + Vitest (from app/; absolute GIAC_OUT for engine tests)
npm run gate [-- --quick]                                  # from app/: every check in one command, one line each (A6)
PW_PORT=<free port> GIAC_OUT=<abs dir> npm run test:e2e    # Playwright key-sequence tests; fails at once if the port is in use
PW_PORT=<free port> GIAC_OUT=<abs dir> npm run test:core  # the core list only (tests/core/core.yaml); also part of test:e2e
GIAC_OUT=<abs dir> npm run golden                          # engine gate; must end in GOLDEN GATE PASSED
GIAC_OUT=<abs dir> npm run gallery                         # every view and layer → app/test/gallery/index.html
tests/golden/.venv/bin/python tests/golden/oracle.py [--write|--g2]   # mpmath oracle (venv: tests/golden/README.md)
./build.sh [--dev] [--measure] [--unsigned] [--install [SERIAL]]      # clean source → dist/pascaline.apk (--no-units: Find holds functions only)
PASCALINE_DL_DIR=<main checkout>/engine/giac/_downloads   # in a worktree: reuse the tarball cache; GIAC_OUT=<main>/engine/giac/_out/gsl
```
Devices, locks and timings: `tools/README.md` (`tools/devlock.sh acquire host-cpu <name> 1800` around heavy work).

## Pipeline
Every package runs through `scripts/pipeline.sh` (docs/shifts/rules.md section 4; the night queue is brief.md section 0c); never merge or start a worker another way. An interactive session that edits the `phase-1` worktree holds `tools/devlock.sh acquire integ <name> 1800` until it is clean again. `.tasks/` (gitignored) holds bundles, logs and the counter; `.coord/log.md` gets one line per step.
Context hygiene: `.claude/settings.json` denies reads of build output, caches, lock files, screenshots and run logs. Read sections (`grep -n '^#'`), not whole files; the owner's untracked files are not yours.

## Repo layout
`app/` (web app: Svelte 5, keyboard, MathLive entry, parser, MathPrint, engine client), `engine/giac/` (engine build + patches), `engine/qalc/` (libqalculate build, developer only), `android/` (Capacitor), `spec/keyboard.yaml` (key layout), `find/` (Find data; `factors.yaml` holds libqalculate's numbers, P22), `tests/golden/` (golden cases + oracle), `tests/engine/`, `tools/` (devices, probes, index generator), `scripts/` (pipeline), `docs/` (index: docs/README.md), `fastlane/`, `fdroid/`, `logo/`, `build.sh`, `spike/` (Phase 0 record), `.claude/agents/` (ron, gorge, annabell, sandra, sofia, henri, percy).

## Conventions
- Small, focused modules; engine code knows nothing about the UI. TypeScript strict, no `any`; user-facing strings go through the i18n table. Every other code rule is in docs/rules-core.md.
- New dependency: GPL-3.0-compatible, pinned, recorded in `THIRD_PARTY.md`. Prefer upstream fixes over forks.
- Commits: Conventional Commits with `git commit -s`; workers on `p1/<name>-<slug>` from `phase-1`; merges `--no-ff`; never `master`, never force, never push.
- Docs: one place per fact, rewrite in place (no "amended" notes); shared docs (`docs/*`, `CLAUDE.md`, `THIRD_PARTY.md`, `.claude/agents/*`) change only as a package's report says or by the owner. Size budgets and links: `node tools/docs-check.mjs` (in `npm run gate`); open packages are one file each in `docs/shifts/packages/`; history in `docs/archive/`.
