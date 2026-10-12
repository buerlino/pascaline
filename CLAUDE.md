# CLAUDE.md: Pascaline

Pascaline is an **open-source graphing CAS calculator** for Android (also PWA, later iOS and desktop). It feels like an HP Prime G2, with the same logical key layout, the same apps and the same functions, but it has its own name and look, and it reuses open-source projects wherever possible. The name comes from Blaise Pascal's 1642 calculating machine.

**Two principles decide every default** (user, 2026-10-10):
1. **Fully open source, reuse first.** Build on existing open-source projects wherever one fits; we write glue, UI and tests, not maths engines. Write our own only when the measured gain is large (e.g. the LaTeX parser, P1).
2. **Speed and efficiency for engineers.** This is the calculator an engineer reaches for when they can't use their G2: instant start, instant answers, keyboard-first, no clutter. When two options are otherwise equal, pick the faster and leaner one.

**Repo:** https://github.com/buerlino/pascaline (default branch `master`; contains the GPL-3.0 `LICENSE`). The local folder tracks `origin/master`. **Never push or commit without the user's OK.** `gh` is installed but not logged in.

**Status (2026-10-11):** Phase 0 is done: **GO** (user, 2026-10-11), no native fallback. Results in [spike/RESULTS.md](spike/RESULTS.md), defaults D1–D9 and the accepted proposals P1/P2 in [spike/DECISIONS.md](spike/DECISIONS.md). **Phase 1 work happens on branch `phase-1`**; `master` was fast-forwarded to it on 2026-10-11 (b4431ae, user). Milestones 1 (MathPrint Home + CAS), 2 (Function + Solve apps) and 3 (Python) are **done**, with device numbers on the Tab One and the S8+. Next: MVP release (backlog R1–R4; R1 offline web app done) and units (P3, `docs/p3-units-plan.md`). Status, open items and tasks: [docs/backlog.md](docs/backlog.md). The current shift brief for the coordinator team is [docs/shifts/brief.md](docs/shifts/brief.md) (agents in `.claude/agents/`).

Background reading (read before larger design decisions):
- [docs/02-architecture-plan.md](docs/02-architecture-plan.md): **the plan**. Stack, app→component mapping, solver choice, effort, F-Droid, licence.
- [docs/01-feasibility-report.md](docs/01-feasibility-report.md): the original study. **Section 3 (legal) is binding**; the rest is superseded by 02.
- [CONTRIBUTING.md](CONTRIBUTING.md): contributor rules (clean room, DCO, dependencies, golden-test sources); keep it consistent with this file.
- Outreach drafts (r/calculators post, email to Bernard Parisse) are kept **outside the repo** in `../outreach/`. The user sends these personally.

---

## Non-negotiable rules

### Legal / clean room
- **Never** use, copy, decompile or reference HP/Moravia code, firmware, ROMs, skins, icons, fonts, screenshots, manual text or help text. Learn behaviour only from black-box observation (a real device or the official Virtual Calculator), public documentation in our own words, and Giac's GPL sources.
- **No "HP" or "Prime"** in the app name, package IDs, identifiers, icons, file names or UI strings. The only exception is a nominative mention in the README or store description together with the disclaimer: *"Not affiliated with HP Inc. or Moravia."*
- Same **logical** key layout as the Prime (which function sits on which key or shift layer), but **our own visual design**: colours, shapes, icons.
- **Do not use NumWorks Epsilon/Omega/Upsilon code.** Its CC BY-NC-SA licence isn't GPL-compatible. KhiCAS and Giac (GPL) are fine.
- Every source file starts with `// SPDX-License-Identifier: GPL-3.0-or-later` (or the comment syntax of its language).
- Every new dependency must be **GPL-3.0-compatible**. Record it in `THIRD_PARTY.md` with name, version, licence and URL.

### F-Droid readiness (from day one)
- **No prebuilt binaries in git** (`.wasm`, `.so`, `.jar`, `.a`). Everything gets built from source by scripts in the repo. The only exception is throwaway experiments under `spike/`, which must be listed in `spike/RESULTS.md` and ignored via `.gitignore`.
- **No Google Play Services, Firebase, analytics, crash reporters or trackers.**
- **The app works 100% offline.** Network access is only allowed for an explicit, optional download (e.g. the Pyodide "Python+" pack, and only in non-F-Droid builds).

### Maths correctness
- **The UI never calls Giac directly.** All maths goes through the async `MathEngine` interface. Engines run in Web Workers, and every call must be cancellable (Cancel key = terminate the worker and restore state).
- **Never invent expected values from memory of how a Prime behaves.** Each golden test case records `source:` with one of `device` (real G2, firmware 2.4 rev 15515), `virtual-calc` (official simulator), `oracle` (MPFR/mpmath/SymPy), `derived` (mathematically provable) or `assumed` (to verify; mark as such).
- **Every bug fixed gets a regression test first.**
- Fix Giac bugs **upstream** (Bernard Parisse) where possible, and keep local patches minimal and documented in `engine/giac/patches/README.md`.
- Home display: 12 significant digits by default (configurable). Use engine formatting, never JS `Number.toString()`, for anything shown to users.

---

## Architecture (summary; details in docs/02 section 6)

```
Capacitor shell (Android / iOS / desktop / plain web PWA)
└─ UI (TypeScript): keyboard (spec/keyboard.yaml), MathLive entry and output (MathPrint),
   app framework Symb/Plot/Num, JSXGraph views, spreadsheet, CodeMirror editor
   └─ MathEngine (async interface)
      ├─ Worker 1: giac.wasm (+ GSL, GMP, MPFR): CAS + Home + numeric solving
      └─ Worker 2: Python: MicroPython-wasm (default) | Pyodide "Python+" (optional)
Storage: IndexedDB (state) + Capacitor Filesystem (import/export)
```

Key decisions (from the plan):
- **MathPrint everywhere (decided 2026-10-11):** textbook entry (stacked fractions, raised exponents, root signs) driven only by our keyboard; results drawn in 2D from Giac `latex()` by MathLive's renderer; never raw engine text. A one-line entry mode is a setting. The ÷ key makes a stacked fraction, as on the reference calculator.
- **Our own LaTeX-subset parser** (decided 2026-10-11, P1) turns MathLive's LaTeX into Giac input and into fast plot evaluators. It only accepts what our keyboard can produce; each keyboard template needs a parser rule and a round-trip case in the same commit. Compute Engine is not used.
- **Home view = Giac in "exact-first" mode** (validated in Phase 0: 123/123 oracle cases): decimal input becomes exact fractions, results are rounded to 12 digits and shown as decimals (as on the reference calculator: `1÷3` → `0.333333333333`), with a guard that falls back to floats when numbers get too big or evaluation gets too slow. Exact 2D results belong to the **CAS** view.
- **No PPL.** Programming is Python plus Giac function definitions. The `calc` and `hpprime`-compatible Python modules give access to calculator variables and a 320×240 graphics canvas.
- **Numerical solving (decided 2026-10-10): GSL inside the Giac wasm**, used through Giac `fsolve`. 1-D: our bracket search + Brent, with Newton/Steffensen using exact Giac derivatives when there is no sign change. Systems: GSL `hybrids`/`hybridsj` (Powell hybrid). Boost.Math and cminpack were tested and dropped (MINPACK licence clause). Polynomials: Giac `proot`. **Every root is checked by substituting it back (residual check)**, and a ⚠ is shown if the residual is large.
- **Performance fallback:** native Giac (NDK) as a Capacitor plugin behind the same `MathEngine` interface. Not needed on Phase 0 evidence.
- **Toolchain (decided 2026-10-11, P2):** every release (F-Droid, GitHub, Play) builds the engine with **Debian's Emscripten** in a pinned `debian:trixie` container, so all channels ship the same engine. emsdk 6.0.12 is for development only. Any engine build that ships must pass the interrupt, Home and Solve golden runs.

## Stack (pin exact versions in package files and THIRD_PARTY.md)
TypeScript (strict, no `any`), Vite, **Svelte 5** for the app shell (D1; keyboard, parser and engine client stay plain TS), MathLive (MIT), JSXGraph (LGPL/MIT), CodeMirror 6 (MIT), Capacitor (MIT), Emscripten, Giac (GPL-3.0+), GMP/MPFR (LGPL), GSL (GPL-3.0+), MicroPython (MIT), Pyodide (MPL-2.0, optional), Vitest, Playwright.

## Planned repo layout
```
pascaline/
├─ app/                 Vite + TS web app (UI, app framework, MathEngine client)
├─ engine/giac/         Emscripten build scripts for Giac + GSL + GMP + MPFR (+ patches/)
├─ python/              MicroPython-wasm build + calc/hpprime modules
├─ android/             Capacitor Android project (generated by `npx cap add android`)
├─ spec/keyboard.yaml   Logical key layout: key → primary / shift / alpha actions
├─ tests/golden/        Golden cases (YAML) with `source:` per case
├─ spike/               Phase 0 experiments + RESULTS.md (throwaway code)
├─ docs/                Plans and reports
├─ fastlane/metadata/   Store texts and screenshots (read by F-Droid)
└─ build.sh             Single clean-source → dist/ → APK script (F-Droid uses this)
```

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

# Node smoke tests (from spike/node/)
node source-smoke.mjs 'factor(x^4-1)' 'solve(x^2=2,x)'     # VARIANT=gsl (default)|base
node compare-variants.mjs base gsl                         # output differences between two builds
node prebuilt-smoke.cjs 'version()'                        # Parisse's giacwasm.js in spike/prebuilt/ (gitignored)

# Spike app (from spike/app/; copies engine/giac/_out/gsl into public/engine/, or GIAC_OUT=<dir>)
npm ci
npm run dev                                                # http://localhost:5173/?engine=source|prebuilt
npm run build && npm run bench                             # Playwright, Chromium + Firefox → bench/results/*.json
ENGINES=source npx playwright test --project=chromium      # subset
npx playwright install chromium firefox                    # once

# Devices and coordination (from the repo root; state lives in .coord/, gitignored)
tools/stay-awake.sh <serial>            # keep a device awake, record SoC/RAM/WebView; --restore undoes it
tools/devlock.sh acquire <serial|host-cpu> <owner> [wait_s]   # release / status / break

tools/device-build.sh [--measure] [--install] [--engine-dir DIR] # build our APK, prints its path
tools/device_run.py start --mode first|cold|warm --runs 7         # launch timings from logcat marks
tools/device_run.py bench --runs 5                                 # the 55 benchmark cases on the device
tools/runs_summary.py                                             # medians from .coord/device-runs.jsonl

# App (from app/; Vite + Svelte 5; copies the engine from GIAC_OUT, default engine/giac/_out/gsl)
npm ci
npm run dev                                                # http://localhost:5173 (?engine=fake echoes input, dev only)
npm run typecheck && npm test                              # svelte-check + Vitest (real-engine tests need GIAC_OUT)
GIAC_OUT=<dir> npm run test:e2e                            # Playwright key-sequence tests (Chromium, phone size)
npm run build                                              # → app/dist/

# Engine gate (run on every engine build that ships; from app/, GIAC_MJS=<giac.mjs> or GIAC_OUT=<dir>)
npm run golden                                             # needs an ABSOLUTE GIAC_OUT/GIAC_MJS; interrupt 16/16, Home 123/123, Solve 42/42, Function 24/24, bench 55, parser 324/326 (2 known gaps), python 22/22 (needs PYTHON_OUT or python/_out/dev)
node scripts/compare-engines.ts <a/giac.mjs> <b/giac.mjs>  # output differences between two engine builds
python3 -m venv tests/golden/.venv && tests/golden/.venv/bin/pip install mpmath==1.3.0 pyyaml==6.0.2   # oracle, once (repo root)
tests/golden/.venv/bin/python tests/golden/oracle.py [--write|--g2]   # check cases; --g2 regenerates tests/golden/G2-CHECKLIST.md from tests/golden/g2.yaml

# Full build: clean source → engine (container, P2) → app → Capacitor → Gradle → dist/pascaline.apk (from the repo root)
./build.sh [--dev] [--measure] [--unsigned] [--no-python] [--engine-dir DIR] [--install [SERIAL]]   # --dev = emsdk engine; --measure = timing marks; --no-python skips MicroPython
PASCALINE_DL_DIR=<main checkout>/engine/giac/_downloads ./build.sh                    # in a fresh clone: reuse the tarball cache

# Release engine: Debian's Emscripten 3.1.69 in a pinned debian:trixie container (P2; works on scratch copies, takes the host-cpu lock)
engine/giac/build-wasm-release.sh                          # → engine/giac/_out/release/giac.{mjs,wasm} + SHA256SUMS

# MicroPython v1.29.0 → wasm (D6; milestone 3 Python; pinned + SHA-checked; build.sh copies it into the app, not loaded at start)
python/build-micropython.sh [dev|release]                  # dev = ~/emsdk → python/_out/dev/; release = trixie container (P2) → python/_out/release/
node python/smoke.mjs [python/_out/release]              # desktop smoke test: print(1+1) (default dir: python/_out/dev)

# Coordinator team (brief: docs/shifts/brief.md; agents in .claude/agents/); keeps the laptop awake while it runs
systemd-inhibit --what=sleep:idle:handle-lid-switch --why="Pascaline shift" claude --agent henri
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
