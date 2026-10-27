<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Core rules (binding)

These rules bind every session, agent and contributor. They are the goal, the three principles and the non-negotiable rules that were in `CLAUDE.md` until 2026-10-18, word for word. `CLAUDE.md` links here; where the two differ, this file wins. Rewrite in place, never amend (git keeps the history).

Pascaline is an **open-source precision engineering tool** for Android (also PWA, later iOS and desktop): a graphing CAS calculator that lets any engineer do day-to-day calculations much faster and more precisely than with other tools. It stays **close to the HP Prime G2**: the same logical key layout, keys that never move (muscle memory), the same kind of apps and the same flow, including tapping into a formula on the screen. It has its own name and look, and it removes the G2's frictions and goes beyond it where engineers need it (units, uncertainty, honest precision). It reuses open-source projects wherever possible. The name comes from Blaise Pascal's 1642 calculating machine.

**The goal** (user, 2026-10-13, replacing the 2026-10-12 wording): *the G2's flow, without its friction, with precision you can trust.* After daily use the owner found the G2's flow is what makes it feel right. So the G2's layout and flow are the backbone, and we depart from them only to remove a friction the owner has hit, and only on top of the G2 way (a flick on top of a tap), never instead of it. Units, uncertainty and honest precision hang off that backbone. The rules that keep features out (one interaction model, fixed keys, vertical space, every UI package on the owner's phone, removal tests): [03-feature-analysis.md](03-feature-analysis.md) section 0; P11 in docs/decisions.md.

**Three principles decide every default** (1 and 2: user, 2026-10-10; 3: user, 2026-10-12):
1. **Fully open source, reuse first.** Build on existing open-source projects wherever one fits; we write glue, UI and tests, not maths engines. Write our own only when the measured gain is large (e.g. the LaTeX parser, P1).
2. **Speed and efficiency for engineers.** This is the calculator an engineer reaches for first: instant start, instant answers, keyboard-first, no clutter, and as few keystrokes per task as possible. Anyone finds any function, unit or constant in a few keys, with no split by discipline (user, 2026-10-12). When two options are otherwise equal, pick the faster and leaner one.
3. **Precision you can trust.** No silent wrong answers: a result is exact, or approximate and marked, or flagged. Units are checked, uncertainty travels with the number, every solver root is substituted back, and the display never hides digits the user can copy. When speed and correctness conflict, correctness wins.

**Reliable before wide (owner, 2026-10-21, P23; the freeze ended 2026-10-27).** The core list (`tests/core/core.yaml`, everyday tasks on Home, CAS, Solve and Function) is the net under all work: it runs on every merge and on the night's device, and a case that fails is a bug fixed before new work on the same code. Everyday inputs come first; precision bugs found only with extreme inputs are still caught and marked (principle 3). Order of the work: `docs/shifts/brief.md` section 0.

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
- **Fix Giac bugs at their cause:** a local cause gets a minimal patch with a canary, sent to Bernard Parisse as a commit link; a TypeScript workaround needs a written reason (P19). Both are listed in `engine/giac/patches/README.md`.
- Home display: 12 significant digits by default (configurable). Use engine formatting, never JS `Number.toString()`, for anything shown to users.

