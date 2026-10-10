# CLAUDE.md: Pascaline

Pascaline is an **open-source graphing CAS calculator** for Android (also PWA, later iOS and desktop). It feels like an HP Prime G2, with the same logical key layout, the same apps and the same functions, but it has its own name and look, and it reuses open-source projects wherever possible. The name comes from Blaise Pascal's 1642 calculating machine.

**Repo:** https://github.com/buerlino/pascaline (default branch `master`; contains the GPL-3.0 `LICENSE`). The local folder tracks `origin/master`. **Never push or commit without the user's OK.** `gh` is installed but not logged in.

**Status (2026-10-10):** planning is done and no code exists yet. **Next step: the Phase 0 spike.** Run it with the `phase-0-spike` skill ([.claude/skills/phase-0-spike/SKILL.md](.claude/skills/phase-0-spike/SKILL.md)).

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
└─ UI (TypeScript): keyboard (spec/keyboard.yaml), MathLive entry, KaTeX output,
   app framework Symb/Plot/Num, JSXGraph views, spreadsheet, CodeMirror editor
   └─ MathEngine (async interface)
      ├─ Worker 1: giac.wasm (+ GMP, MPFR, Boost.Math roots, cminpack): CAS + Home
      └─ Worker 2: Python: MicroPython-wasm (default) | Pyodide "Python+" (optional)
Storage: IndexedDB (state) + Capacitor Filesystem (import/export)
```

Key decisions (from the plan):
- **Home view = Giac in "exact-first" mode**: decimal input becomes exact fractions, results are rounded to 12 digits, with a guard that falls back to floats when numbers get too big or evaluation gets too slow. This is unvalidated until the spike runs; the fallback is decimal.js.
- **No PPL.** Programming is Python plus Giac function definitions. The `calc` and `hpprime`-compatible Python modules give access to calculator variables and a 320×240 graphics canvas.
- **Numerical solving:** 1-D: bracket + TOMS 748 (Boost.Math), with Newton/Halley using exact Giac derivatives. Systems: MINPACK `hybrd` (cminpack). Polynomials: Giac `proot`. **Every root is checked by substituting it back (residual check)**, and a ⚠ is shown if the residual is large.
- **Performance fallback:** native Giac (NDK) as a Capacitor plugin behind the same `MathEngine` interface.

## Stack (tentative; pin exact versions during the spike)
TypeScript (strict, no `any`), Vite, **Svelte 5** (tentative UI framework, confirm in spike), MathLive + Compute Engine (MIT), KaTeX (MIT), JSXGraph (LGPL/MIT), CodeMirror 6 (MIT), Capacitor (MIT), Emscripten, Giac (GPL-3.0+), GMP/MPFR (LGPL), Boost.Math (BSL-1.0), cminpack (BSD-style), MicroPython (MIT), Pyodide (MPL-2.0, optional), Vitest, Playwright.

## Planned repo layout
```
pascaline/
├─ app/                 Vite + TS web app (UI, app framework, MathEngine client)
├─ engine/giac/         Emscripten build scripts for Giac + GMP + MPFR (+ patches/)
├─ engine/solvers/      Boost.Math + cminpack wrappers (C++, built into the same wasm)
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
- **Emscripten is not installed.** Install emsdk into `~/emsdk` (see the phase-0 skill).
- Browsers: Firefox 140 ESR only. Playwright installs its own Chromium (`npx playwright install chromium`).
- A local checkout of **fdroiddata** is at `../fdroiddata`. Reference recipes: `metadata/com.graphhopper.maps.yml` (Capacitor), `metadata/net.alexbarry.alexgames.yml` (Emscripten).

## Commands
None yet. Add them here as soon as they exist (dev server, unit tests, golden tests, wasm build, APK build, lint).

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
