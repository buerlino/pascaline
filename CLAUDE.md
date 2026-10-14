# CLAUDE.md: Pascaline

Pascaline is an **open-source precision engineering tool** for Android (also PWA, later iOS and desktop): a graphing CAS calculator that lets any engineer do day-to-day calculations much faster and more precisely than with other tools. It stays **close to the HP Prime G2**: the same logical key layout, keys that never move (muscle memory), the same kind of apps and the same flow, including tapping into a formula on the screen. It has its own name and look, and it removes the G2's frictions and goes beyond it where engineers need it (units, uncertainty, honest precision). It reuses open-source projects wherever possible. The name comes from Blaise Pascal's 1642 calculating machine.

**The goal** (user, 2026-10-13, replacing the 2026-10-12 wording): *the G2's flow, without its friction, with precision you can trust.* After daily use the owner found the G2's flow is what makes it feel right. So the G2's layout and flow are the backbone, and we depart from them only to remove a friction the owner has hit, and only on top of the G2 way (a flick on top of a tap), never instead of it. Units, uncertainty and honest precision hang off that backbone. The rules that keep features out (one interaction model, fixed keys, vertical space, every UI package on the owner's phone, removal tests): [docs/03-feature-analysis.md](docs/03-feature-analysis.md) section 0; P11 in docs/decisions.md.

**Three principles decide every default** (1 and 2: user, 2026-10-10; 3: user, 2026-10-12):
1. **Fully open source, reuse first.** Build on existing open-source projects wherever one fits; we write glue, UI and tests, not maths engines. Write our own only when the measured gain is large (e.g. the LaTeX parser, P1).
2. **Speed and efficiency for engineers.** This is the calculator an engineer reaches for first: instant start, instant answers, keyboard-first, no clutter, and as few keystrokes per task as possible. Anyone finds any function, unit or constant in a few keys, with no split by discipline (user, 2026-10-12). When two options are otherwise equal, pick the faster and leaner one.
3. **Precision you can trust.** No silent wrong answers: a result is exact, or approximate and marked, or flagged. Units are checked, uncertainty travels with the number, every solver root is substituted back, and the display never hides digits the user can copy. When speed and correctness conflict, correctness wins.

**Repo:** https://github.com/buerlino/pascaline (default branch `master`; contains the GPL-3.0 `LICENSE`). The local folder tracks `origin/master`. **Never push or commit without the user's OK.** `gh` is installed but not logged in.

**Status:** milestones 1–3 done; **now milestone 4a "feel"** (P11), then the rest of the engineer core (milestones 4 Find and trust, 5 Units, 6 Structure; P8). Status, open items and tasks: [docs/backlog.md](docs/backlog.md). Packages: [docs/shifts/brief.md](docs/shifts/brief.md), run by the owner one at a time (no coordinator), with the rules in [docs/shifts/rules.md](docs/shifts/rules.md) and agents in `.claude/agents/`. **Work happens on branch `phase-1`.** Docs are kept current by rewriting, not amending: one place per fact, history in git.

Background reading (read before larger design decisions):
- [docs/04-architecture.md](docs/04-architecture.md): **the architecture for the engineer goal** (2026-10-12): precision chain and marks, Find, the unit view, keys, state, build, gates and budgets. Supersedes docs/02 where they differ.
- [docs/research/r6-pipelines.md](docs/research/r6-pipelines.md): how a key press, a number, a build and a check flow through the code today, engine and qalc behaviour learned by probing, and how to check a claim fast (probes in `tools/probes/`).
- [docs/06-keypad-vs-g2.md](docs/06-keypad-vs-g2.md): every difference between our keypad and the G2's, with its reason (decision P12). Read before changing a key.
- [docs/02-architecture-plan.md](docs/02-architecture-plan.md): the original plan. Stack, app→component mapping, solver choice, effort, F-Droid, licence.
- [docs/01-feasibility-report.md](docs/01-feasibility-report.md): the original study. **Section 3 (legal) is binding**; the rest is superseded by 02.
- Decisions: Phase 0 results and defaults D1–D9, P1, P2 in [spike/RESULTS.md](spike/RESULTS.md) and [spike/DECISIONS.md](spike/DECISIONS.md); from Phase 1 on in [docs/decisions.md](docs/decisions.md).
- [CONTRIBUTING.md](CONTRIBUTING.md): contributor rules (clean room, DCO, dependencies, golden-test sources); keep it consistent with this file.
- Outreach drafts (r/calculators post, email to Bernard Parisse) are kept **outside the repo** in `../outreach/`. The user sends these personally.

---

## Non-negotiable rules

### Legal / clean room
- **Never** use, copy, decompile or reference HP/Moravia code, firmware, ROMs, skins, icons, fonts, screenshots, manual text or help text. Learn behaviour only from black-box observation (a real device or the official Virtual Calculator), public documentation in our own words, and Giac's GPL sources.
- **No "HP" or "Prime"** in the app name, package IDs, identifiers, icons, file names or UI strings. One exception: a nominative mention in the README or store description together with the disclaimer *"Not affiliated with HP Inc. or Moravia."*
- Same **logical** key layout as the Prime (which function sits on which key or shift layer), but **our own visual design**: colours, shapes, icons.
- **Do not use NumWorks Epsilon/Omega/Upsilon code.** Its CC BY-NC-SA licence isn't GPL-compatible. KhiCAS and Giac (GPL) are fine.
- Every source file starts with `// SPDX-License-Identifier: GPL-3.0-or-later` (or the comment syntax of its language).
- Every new dependency must be **GPL-3.0-compatible**. Record it in `THIRD_PARTY.md` with name, version, licence and URL.

### F-Droid readiness (from day one)
- **No prebuilt binaries in git** (`.wasm`, `.so`, `.jar`, `.a`). Everything gets built from source by scripts in the repo. The only exception is throwaway experiments under `spike/`, which must be listed in `spike/RESULTS.md` and ignored via `.gitignore`.
- **No Google Play Services, Firebase, analytics, crash reporters or trackers.**
- **The app works 100% offline.** Network access is only allowed for an explicit, optional download, and only in non-F-Droid builds.
- **Never delete** `engine/giac/_downloads/` (the SHA-checked source tarballs) or `spike/prebuilt/` (Parisse's build, kept for comparisons). Both are gitignored.

### Maths correctness
- **The UI never calls Giac directly.** All maths goes through the async `MathEngine` interface. Engines run in Web Workers, and every call must be cancellable (Cancel key = terminate the worker and restore state).
- **Never invent expected values from memory of how a Prime behaves.** Each golden test case records `source:` with one of `device` (real G2, firmware 2.4 rev 15515), `virtual-calc` (official simulator), `oracle` (MPFR/mpmath/SymPy), `derived` (mathematically provable) or `assumed` (to verify; mark as such).
- **Every bug fixed gets a regression test first.**
- Fix Giac bugs **upstream** (Bernard Parisse) where possible, and keep local patches minimal and documented in `engine/giac/patches/README.md`.
- Home display: 12 significant digits by default (configurable). Use engine formatting, never JS `Number.toString()`, for anything shown to users.

---

## Architecture (summary; details in docs/04 section 8)

```
Capacitor shell (Android / iOS / desktop / plain web PWA)
└─ UI (TypeScript): keyboard (spec/keyboard.yaml), MathLive entry and output (MathPrint),
   app framework Symb/Plot/Num, JSXGraph views, spreadsheet
   └─ MathEngine (async interface)
      ├─ Worker 1: giac.wasm (+ GSL, GMP, MPFR): CAS + Home + numeric solving
      └─ Worker 3: libqalculate (the unit view; lazy; milestone 5, P3 as amended by P8 and P11)
   Find: a static index generated at build time, searched on the main thread (lazy)
Storage: IndexedDB (state) + Capacitor Filesystem (import/export)
```

Key decisions (reasons in docs/02 and the decision logs):
- **MathPrint everywhere:** textbook entry driven only by our keyboard (÷ makes a stacked fraction); results drawn in 2D from Giac `latex()` by MathLive, never raw engine text. One-line entry is a setting.
- **Our own LaTeX-subset parser** (P1) turns MathLive's LaTeX into Giac input and plot evaluators. Each keyboard template needs a parser rule and a round-trip case in the same commit.
- **Home = Giac "exact-first":** decimals become exact fractions, results are rounded to 12 digits and shown as decimals (`1÷3` → `0.333333333333`), with a float fallback when numbers get too big or slow. Exact 2D results belong to the **CAS** view.
- **No PPL, no Python** (P11: the Python app was removed in milestone 4a). Programs are Giac function definitions.
- **Solving: GSL inside the Giac wasm** (bracket + Brent, Newton/Steffensen, `hybrids`/`hybridsj` for systems, `proot` for polynomials). **Every root is substituted back**, with a ⚠ when the residual is large.
- **Releases build the engine with Debian's Emscripten** in a pinned `debian:trixie` container (P2); emsdk 6.0.12 is for development. Every engine build that ships must pass the golden gate.

## Stack (pin exact versions in package files and THIRD_PARTY.md)
TypeScript (strict, no `any`), Vite, **Svelte 5** for the app shell (D1; keyboard, parser and engine client stay plain TS), MathLive (MIT), JSXGraph (LGPL/MIT), Capacitor (MIT), Emscripten, Giac (GPL-3.0+), GMP/MPFR (LGPL), GSL (GPL-3.0+), Vitest, Playwright.

## Repo layout
`app/` (web app), `engine/giac/` (engine build + patches), `engine/qalc/` (libqalculate build), `android/` (Capacitor), `spec/keyboard.yaml` (key layout), `tests/golden/` (golden cases), `tests/engine/`, `tools/` (device tools), `docs/`, `fastlane/`, `fdroid/`, `logo/`, `build.sh` (clean source → APK; the F-Droid recipe mirrors it, see `fdroid/README.md`), `spike/` (Phase 0 record and the P3 qalc spike).

## This machine (checked 2026-10-10)
- Rocky Linux 10.2, 16 cores, 28 GB RAM
- Node 22.23 / npm 10.9 (no pnpm, so use npm), Python 3.12, CMake 3.31, GNU Make 4.4, git 2.52
- Java 21 (OK for Capacitor/Gradle), Android SDK at `~/Android/Sdk` (`adb` works; `sdkmanager` prints a deprecation warning but works)
- Docker 29 and Podman 5 available (useful for reproducible Emscripten / fdroidserver builds)
- Emscripten SDK 6.0.12 is installed in `~/emsdk` (see Commands).
- Browsers: Firefox 140 ESR only. Playwright installs its own Chromium (`npx playwright install chromium`).
- A local checkout of **fdroiddata** is at `../fdroiddata`. Reference recipes: `metadata/com.graphhopper.maps.yml` (Capacitor), `metadata/net.alexbarry.alexgames.yml` (Emscripten).

## Commands
Emscripten lives in `~/emsdk` (6.0.12). The build script sources `emsdk_env.sh` itself; don't add it to shell rc files.

```bash
# Giac + GSL + GMP + MPFR → wasm (pinned, SHA-256-checked; ≈5 min clean on 16 cores)
engine/giac/build-wasm.sh                                  # → engine/giac/_out/gsl/giac.{mjs,wasm} (the default)
WITH_GSL=0 engine/giac/build-wasm.sh fetch giac link      # without GSL → _out/base/ (comparisons only)
PASCALINE_DL_DIR=<main checkout>/engine/giac/_downloads   # share the download cache from a git worktree

# Node smoke test (from the repo root)
node engine/giac/smoke.mjs 'factor(x^4-1)' 'solve(x^2=2,x)'   # VARIANT=gsl (default)|base

# Devices and coordination: tools/README.md (device lock, measurement builds, launch and bench timings)

# App (from app/; Vite + Svelte 5; copies the engine from GIAC_OUT, default engine/giac/_out/gsl)
npm ci
npm run dev                                                # http://localhost:5173 (?engine=fake echoes input, dev only)
npm run typecheck && npm test                              # svelte-check + Vitest (real-engine tests need GIAC_OUT)
GIAC_OUT=<dir> npm run test:e2e                            # Playwright key-sequence tests (Chromium, phone size)
GIAC_OUT=<dir> npm run gallery                             # every view, sheet and layer, light and dark → app/test/gallery/index.html (PW_PORT=<port> if another dev server runs)
npm run build                                              # → app/dist/

# Engine gate (run on every engine build that ships; from app/, GIAC_MJS=<giac.mjs> or GIAC_OUT=<dir>)
npm run golden                                             # needs an ABSOLUTE GIAC_OUT/GIAC_MJS; must end in GOLDEN GATE PASSED (counts: tests/golden/README.md)
node scripts/compare-engines.ts <a/giac.mjs> <b/giac.mjs>  # output differences between two engine builds
python3 -m venv tests/golden/.venv && tests/golden/.venv/bin/pip install mpmath==1.3.0 pyyaml==6.0.2   # oracle, once (repo root)
tests/golden/.venv/bin/python tests/golden/oracle.py [--write|--g2]   # check cases; --g2 regenerates tests/golden/G2-CHECKLIST.md from tests/golden/g2.yaml

# Full build: clean source → engine (container, P2) → app → Capacitor → Gradle → dist/pascaline.apk (from the repo root)
./build.sh [--dev] [--measure] [--unsigned] [--engine-dir DIR] [--no-units] [--install [SERIAL]]   # --dev = emsdk engine; --measure = timing marks; --no-units skips libqalculate
PASCALINE_DL_DIR=<main checkout>/engine/giac/_downloads ./build.sh                    # in a fresh clone: reuse the tarball cache

# Release engine: Debian's Emscripten 3.1.69 in a pinned debian:trixie container (P2; works on scratch copies, takes the host-cpu lock)
engine/giac/build-wasm-release.sh                          # → engine/giac/_out/release/giac.{mjs,wasm} + SHA256SUMS

# libqalculate 5.13.1 → wasm (P3/P8; Find index in milestone 4, unit view in 5; build.sh step 1c, --no-units skips it)
engine/qalc/build-wasm.sh [dev|release]                    # dev = ~/emsdk → engine/qalc/_out/dev/; release = trixie container → engine/qalc/_out/release/ + SHA256SUMS
node engine/qalc/smoke.mjs engine/qalc/_out/dev            # desktop smoke test (72 km/h to m/s)

# Coordinator team (docs/shifts/rules.md + brief.md; agents in .claude/agents/); keeps the laptop awake while it runs
systemd-inhibit --what=sleep:idle:handle-lid-switch --why="Pascaline shift" claude --agent henri
tools/henri-next.sh <n>                                    # hand over to a fresh headless henri_<n>; spawning rules (never `background: true` in agent files): docs/shifts/rules.md section 4a

# Advisor: architecture and research questions, with evidence (.claude/agents/sandra.md; probes in tools/probes/)
claude --agent sandra
```

## Conventions
- Small, focused modules. Engine code knows nothing about the UI.
- User-facing strings go through an i18n table from the start (English first).
- Commits: Conventional Commits style (`feat(solver): …`) with a **DCO sign-off** (`git commit -s`). Branch from `master` for features; only commit or push when the user asks.
- Prefer upstream fixes and configuration over forking third-party code. If a fork is unavoidable, document why in `THIRD_PARTY.md`.

## Glossary
- **Home**: numeric calculator view. **CAS**: symbolic view (Giac).
- **Symb / Plot / Num**: the three views of every app (definition, graph, table).
- **Giac**: the C++ CAS by B. Parisse and R. De Graeve (Grenoble). The real Prime uses it too.
- **KhiCAS**: Parisse's calculator UI for Giac. A source of ideas and possibly code (GPL).
- **Golden case**: input + settings + expected output + `source:`.
