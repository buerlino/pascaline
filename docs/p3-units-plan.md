<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# P3 integration plan: units, constants and uncertainty (libqalculate)

Status: design only (gorge, 2026-10-11). **Superseded by P15 (2026-10-14, docs/decisions.md): no qalc worker; the unit view computes on Giac, and libqalculate runs only at build time, as the Find index's source.** Base: phase-1. Spike evidence: spike/RESULTS.md (P3 section), spike/qalc/. Decisions for the user are in section 7.

**Amended 2026-10-12 (P8 in docs/decisions.md):** units live in their own Units app (Shift+Tmpl); Home, CAS, Solve and lists stay unit-free, so the `unitEval` split in section 1 and the Home entry in section 2 are replaced; units and constants are found through Find (docs/03-feature-analysis.md section 3) instead of Menu pickers. Engine, build, data checks, `hp` patch and tests stand. What changed is in docs/03-feature-analysis.md section 4; it is milestone 5.

**Architecture settled 2026-10-12 in [04-architecture.md](04-architecture.md) section 4** (it replaces this plan where they differ): the `UnitEngine` interface (docs/04 8.2; `listUnits`/`listConstants` are replaced by the Find index); chip tokens `\unit{ID}` and `\const{ID}` as MathLive macros instead of `\mathrm{unit:km}`; our adapter's checks for mismatched sums and absolute-temperature arithmetic, which qalc accepts silently; the qalc build moves into `build.sh` in milestone 4 because the Find index takes its values from it. Probed with the spike build: "try exact" gives `72 km/h → m/s` = 20 and `1 in → mm` = 127/5 exactly; `hp` is still the wrong value and qalc flags it exact.

## 1. Architecture
- **Worker 3 `qalc`**, next to Giac (worker 1) and Python (worker 2). Same pattern as `MathEngine` and the Python engine: an async `UnitEngine` interface (`init`, `evaluate(expr, settings) -> {value, unit, uncertainty, error}`, `convert`, `listUnits/listConstants` for the picker), run through the existing `workerEngine` host. Cancel = terminate the worker and respawn on next use (qalc runs on the calling thread, no pthreads).
- **Lazy load:** the chunk (qalc.mjs + qalc.wasm, 0.93 MB brotli) is fetched only when a unit or constant is first inserted, opened from the Units menu, or an expression containing a unit token is evaluated. Optional idle preload after Giac is ready, off by default (a setting). Spike: first result 127 ms desktop, 626 ms on the S8+ (cold, < 1 s gate met); Tab One still unmeasured.
- **Who evaluates what.** Giac stays the only engine for plain maths. An expression without unit tokens never touches qalc. An expression with unit/constant tokens is split by the app: a small `unitEval` layer parses our LaTeX into a tree (P1 parser), and sends the whole expression to qalc. Qalc owns quantities (value, unit, uncertainty). Giac is called only for the pure-number parts that qalc cannot do (CAS functions: `solve`, `integrate`, matrices): such a call gets the quantity's numeric value and the unit is re-attached by dimension rules only if the result is a simple scalar; otherwise show "units not supported here" (no silent dropping).
- **Giac's own units (`_m`, `_kg` ...) are not used.** Two unit databases would disagree. The parser never emits Giac `_unit` forms; a Giac `_x` typed by hand is left to Giac.
- Variables never collide: qalc is given only parser-emitted tokens, with a fixed variable-free mode, so a user variable `g` or `R` is substituted by the app before the call and is never read as gram or roentgen.

## 2. Entry (clean room: our own layout, only the logical G2 idea of a units menu)
- **Units menu** on an existing shifted key (proposal: `Shift+Math` is not free; use the Menu key's Home menu, entry "Units", and a second one "Constants"). Searchable list (type-ahead) by category, recents first; this is the Qalculate-style picker from the backlog. Each pick inserts a MathLive template `\mathrm{unit:km}` shown as an upright `km`.
- **Quantity typing:** `12 [Units] km/h`. The `→` key (convert) follows with a target unit: `12 km/h → m/s`.
- **Parser rules** (each with a round-trip case in the same commit, as for every template): `\mathrm{unit:ID}` and `\mathrm{const:ID}` become the explicit qalc tokens (`ID` is a fixed qalc identifier from our whitelist, generated from the qalc definitions at build time); implicit product `12\,\mathrm{unit:m}` = quantity; `a/b` and `a^2` over units keep dimension; `\to` conversion node; `\pm` (keyboard template, uncertainty `12.0 ± 0.1`). Replace gap `gaps-03` in parser.yaml (`12\,\mathrm{m}`) with real cases: ~25 (units, prefixes, exponents, division, conversion, constants, uncertainty, precedence vs implicit multiplication, one per unit class). Unknown identifier = parse error, never raw text pass-through.
- **The reference's behaviour** (G2 item 30, Virtual Calculator 2026-10-12; was backlog G7): Shift + the Units key (r4c3) opens one menu with three tabs (Tools, Units, Const). A unit is attached as `5_km`; `CONVERT(5_km,1_m)` or `5_km▶_m` converts; mixed sums keep the first unit. The Constants tab wasn't opened. Details in `tests/golden/g2.yaml` item 30.
- Temperature offset units (degC, degF) get explicit rules and golden cases (qalc handles them; our token must not turn `20 degC + 5 degC` into nonsense).

## 3. Results
- **Our formatter, not qalc's print.** Qalc returns value, unit and uncertainty separately (as number strings plus unit parts). The Home number formatter (Std/Sci/Eng/Fixed, 12 digits, E notation) formats the number; the unit is drawn upright by MathLive in 2D (`km/h` stacked per setting).
- **Conversion:** `→ unit` converts; without a target, qalc's simplified base/best unit is offered as a tap suggestion, never applied silently. Compound units are handled by qalc.
- **Uncertainty:** `(12.34 ± 0.05) m` shown as `12.34 ± 0.05 m`; the format rounds the uncertainty to 1–2 significant digits and the value to match, in Fixed/Sci/Eng as well. Propagation is qalc's first-order Gaussian (matches the oracle in the spike); the setting "interval arithmetic" stays off (decision D4).
- Errors (dimension mismatch, unknown unit) come as short i18n messages, not qalc text.

## 4. Build
- Container build with Debian's Emscripten in the pinned `debian:trixie` image (P2), like Giac and MicroPython: `engine/qalc/build-wasm.sh [dev|release]`, promoted from `spike/qalc/build-wasm.sh`. Pinned SHA-256 tarballs: libqalculate 5.13.1 (GPL-2.0-or-later), libxml2 2.15.1 (MIT), GMP 6.3.0, MPFR 4.2.2 (shared with the Giac downloads). Compiled-in definitions, no data files, no prebuilts, so F-Droid can build it from source.
- The Debian-emscripten build must be re-run once (spike used emsdk 6.0.12): same size, cases and interrupt gate before it ships. The release engine gate (`npm run golden`) gains a units section.
- `build.sh` copies the output into the app as a lazy chunk (not in the start path); `--no-units` skips it like `--no-python`.
- THIRD_PARTY.md: add libqalculate, libxml2 (name, version, licence, URL). Combined GPL-2.0+ with GPL-3.0+ is fine.
- **Size budget:** +0.93 MB brotli (+1.19 MB gzip), lazy; start-up bundle must stay unchanged (check `L7` size test).

## 5. Tests
- `tests/golden/units.yaml` with a `source:` per case: `oracle` (mpmath 40 digits via a `check.py` successor, as in the spike), `derived` (dimension analysis, exact SI definitions like 1 in = 25.4 mm, c, h exact since 2019), `assumed` otherwise (marked). Start from the 26 spike cases; add temperature, prefixes, compound units, uncertainty propagation, and format cases (Sci/Eng/Fixed with units).
- **The `hp` typo** (units.xml 745.69998715 W vs true 745.69987158 W): report upstream first (Qalculate issue). Recommend a **minimal local patch** in `engine/qalc/patches/` (one number, documented in a README like Giac's), dropped when upstream fixes it, rather than shipping a known wrong value. The golden case stays and fails without the patch. Also audit the other horsepower variants and the rest of the data against mpmath/CODATA once (a one-off script, about 0.5 day).
- Parser round trips (section 2); worker tests (cancel, lazy load, no load for plain maths: assert the chunk is not requested); Playwright e2e: key sequence `12 [Units] km/h → m/s`, constants insert, uncertainty display.

## 6. Milestones (effort for one person, in order)
| # | Milestone | Days |
|---|---|---|
| U1 | `engine/qalc` build in the container, `UnitEngine` worker + client, lazy load, cancel | 2 |
| U2 | Parser tokens + `unitEval` split, golden units.yaml, hp patch | 3 |
| U3 | Units/Constants picker (menu, search, recents), i18n | 3 |
| U4 | Result formatting, `→` conversion, uncertainty display | 2 |
| U5 | e2e, device timing (S8+, Tab One), size gate, docs | 1.5 |
Total about 11–12 days (the backlog said 1–2 weeks: consistent).

**Risks:** (1) qalc output forms not fitting our formatter (mitigated: split value/unit); (2) temperature and non-linear units in expressions; (3) Tab One lazy start unmeasured; (4) data errors beyond `hp` (audit); (5) mixed Giac/qalc expressions confusing users (mitigated: explicit "not supported" message); (6) libxml2 and qalc upgrades need re-pinning and re-running goldens.

## 7. Decisions for the user (recommended default first)
1. **Units database:** qalc only, no Giac units (default: yes).
2. **Menu placement:** Units and Constants as entries in the Menu key's Home menu, no key relabelling (default: yes).
3. **hp typo:** local one-number patch plus an upstream report (default: yes).
4. **Interval arithmetic and exact rational mode in qalc:** off; only first-order uncertainty (default: off).
5. **Preload when idle:** off, load on first use (default: off; revisit after Tab One numbers).
6. **Mixed unit + CAS expressions:** scalar-only support in v1, else a clear message (default: yes).
7. **Constants:** qalc's CODATA set, replacing the backlog item "Giac built-in constants" (default: yes).
8. **Order:** schedule after the L1 key work and before Statistics (default: yes).
