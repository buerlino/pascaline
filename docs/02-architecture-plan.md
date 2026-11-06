# Pascaline: architecture and project plan

*Pascaline is an open-source graphing CAS calculator that feels like an HP Prime: a "spiritual clone". The name comes from Blaise Pascal's 1642 calculating machine and was chosen on 2026-10-10.*

*Date: 2026-10-10. This follows up [01-feasibility-report.md](01-feasibility-report.md) and replaces its "1:1 clone" approach. The legal advice (section 3 of 01-feasibility-report.md) still applies.*

**What still binds:** the solver choice (section 4), the legal and licence reasoning and the F-Droid steps (sections 10 and 11), the release phases (section 8) and the milestone history (section 12). [04-architecture.md](04-architecture.md) supersedes everything else and wins where the two differ; the full plan of 2026-10-10 to 10-12 is in git at `82b261f9`.

---

## 1. TL;DR: the recommended approach
Built or superseded; see docs/04 section 0 (text in git at `82b261f9`).

## 1b. Does something like this already exist? (checked 2026-10-10)
Built or superseded; see docs/04 section 0 (text in git at `82b261f9`).

## 2. Options I considered
Built or superseded; see docs/04 section 0 (text in git at `82b261f9`).

## 3. PPL or Python?
Superseded: no PPL, and P11 (2026-10-13) removed the Python app; see docs/04 section 2.10 (text in git at `82b261f9`).

## 4. The numerical solver: which open-source project?

Yes, there are several excellent ones. The Prime's **Solve app** needs three solver types. Here's what to use for each:

> **Decided 2026-10-10 (Phase 0 spike, Q5):** GSL, linked into Giac's wasm, is the solver library. Boost.Math + cminpack were tested and work (+5 KB brotli), but MINPACK's licence has an acknowledgment clause whose GPL compatibility we didn't want to depend on. GSL is GPL-3.0 like Giac, covers the same algorithms, and Giac already calls it through `fsolve`. Cost: +68 KB brotli (≈3% of the engine). Details: [archive/phase-0-results.md](archive/phase-0-results.md).

| Problem | What the Prime does | Our solver | Why |
|---|---|---|---|
| **One equation, one unknown** (e.g. `x·eˣ = 5`, solve for `x` near a guess) | Iterates from the user's guess | Our bracket search, then **Brent** (GSL, via Giac `fsolve(…, x=a..b, brent_solver)`, guaranteed convergence); **Newton/secant/Steffensen** (GSL/Giac) with **exact derivatives from Giac** when there is no sign change | GSL's root finders are standard, well-tested implementations. Exact symbolic derivatives make Newton very robust. |
| **System of N equations, N unknowns** | Newton-type iteration from guesses | **GSL `hybrids` / `hybridsj`** (Powell's hybrid "dog-leg" method, the algorithm behind MINPACK and `scipy.optimize.fsolve`), via Giac `fsolve(…, hybrids_solver)` | Robust from poor starting guesses; Giac supplies the exact Jacobian for the `j` variants. |
| **Polynomials** (all roots, including complex) | `proot` / CAS | **Giac `proot`** (already included). Optionally **MPSolve** (GPLv3) for certified high-degree roots | `proot` covers calculator needs; MPSolve is overkill unless we want "certified" roots. |
| Least-squares fits / overdetermined systems | Statistics regressions | Giac's regression commands; for general nonlinear fits later, a small wrapper around GSL's nonlinear least squares (Levenberg–Marquardt) | Same library, no extra dependency |

Without GSL, Giac's wasm build only has Newton and interval bisection; every other `fsolve` method fails with "Not linked with GSL" (measured in the spike). Linking GSL changed none of the 55 benchmark results; numeric eigenvalue/eigenvector/SVD output comes out in a different (still correct) order or sign, and Airy functions gain numeric values.

**An improvement over the Prime:** after every numeric solve, we **plug the root back into the equation** (the residual check) and re-evaluate with **Giac at 30+ digits** (MPFR; mpmath is only available when the optional Python+ pack is installed). If the residual is not tiny, we show a ⚠ next to the answer. The real Prime silently returns wrong roots in some known cases (see docs/01 section 6, step 4, at `82b261f9`), so this check directly addresses "how do we avoid wrong answers?".

**Solver strategy for a single equation:**
1. Use Giac to get exact `f(x)` and `f'(x)`. For the many evaluations of the bracket search, compile both to fast JS functions with our LaTeX-subset parser's evaluator (or evaluate in Giac if that's fast enough; measure). Numbers shown to the user always come from Giac.
2. Starting from the guess, expand outward until the sign changes (bracket search).
3. If a bracket is found, run **Brent** (GSL via Giac `fsolve`). It's guaranteed to converge.
4. If there's no sign change (a double root like `x² = 0`), run **Newton** (or Steffensen) with the exact derivative and damping.
5. Polish the result with Newton at high precision (Giac `evalf` with more digits or mpmath), then run the residual check.
6. Report the result, the residual, and which method was used (visible as an "info" line, like the Prime's "Zero"/"Sign reversal" messages).

---

## 5. Mapping every Prime app to reused components
Built or superseded; see docs/04 section 8.1 (text in git at `82b261f9`).

## 6. Architecture
Built or superseded; see docs/04 sections 6 and 8 (text in git at `82b261f9`). The native fallback of 6.3 was never needed (Phase 0: [archive/phase-0-results.md](archive/phase-0-results.md)).

## 6b. The engine layer: a familiar layout over engines that can grow (user, 2026-10-11)
Built or superseded; see docs/04 section 6.1 (text in git at `82b261f9`).

## 7. Phase 0: spike (2–3 weeks) to de-risk before committing
Done 2026-10-11; see [archive/phase-0-results.md](archive/phase-0-results.md) (text in git at `82b261f9`).

## 8. Effort: refined estimate

The estimate in person-months is in git at `82b261f9`; the phases stand:

**Phases**
- **MVP (≈ 6–9 PM):** keyboard, Home, CAS, textbook entry, Function app, Solve app, Python (MicroPython, D6; numpy/sympy only in the optional Python+ pack). Release on Play (testing track) and as a web app.
- **v1 (≈ +10–15 PM):** Stats, Inference, Parametric/Polar/Sequence, Spreadsheet, Finance, Linear/Triangle solvers, RPN.
- **v2 (≈ +10–17 PM):** Geometry, Advanced Graphing, 3D, Python apps, Explorers, polish.

*Since 2026-10-12 (P8):* the engineer core (milestones 4–6: Find and honest precision, the unit view, matrices, bases and everyday functions) comes before v1; most of v1 is deferred and the MVP release is not scheduled. Order and tasks: docs/shifts/brief.md section 0, docs/backlog.md.

---

## 9. Bugs: what changes with the reuse approach
Built or superseded; see docs/04 section 7.3 (text in git at `82b261f9`).

## 10. Legal, revisited for the spiritual clone

The risk is now **lower** than for the 1:1 clone. We have no file-format reverse engineering, no PPL compatibility claims, and our own look. Remaining rules:
- No "HP" or "Prime" in the name, icon or store title. Nominative mention in the description is fine ("familiar to HP Prime users; not affiliated with HP Inc. or Moravia").
- Same **logical** key layout, our own colours, shapes and icons.
- The whole app is **GPLv3** (because of Giac). All other components listed (MIT, BSD, BSL, MPL-2.0, LGPL/MIT, Apache-2.0) are compatible.
- **F-Droid caveat:** F-Droid requires everything to be built from source on its servers. Giac-wasm and Pyodide are large builds, so F-Droid packaging means extra build work. Google Play and GitHub Releases are straightforward.

---

## 11. Languages, WebAssembly, distribution and licence

### 11.1 What we write code in
Superseded; see docs/04 section 8.1 (text in git at `82b261f9`).

### 11.2 What WebAssembly actually is (it isn't native code)
Background; see docs/04 section 6.1 (text in git at `82b261f9`).

### 11.3 One codebase, several release channels
The same web build (`dist/`) is shipped in different wrappers:

| Channel | How | Notes |
|---|---|---|
| **Web / PWA (all platforms)** | Static hosting (e.g. Codeberg/GitHub Pages) + service worker for offline use + web app manifest | **Android:** Chrome installs it as an app, works offline. **iOS/iPadOS:** "Add to Home Screen" in Safari works offline, but there's no install prompt and storage/memory limits are stricter, so test with the full Giac + Python download. **Desktop:** installable from Chrome/Edge. |
| **Android APK/AAB** | Capacitor wraps `dist/` into a native app | Google Play, F-Droid, IzzyOnDroid, GitHub Releases |
| **iOS App Store** | Capacitor iOS | **Problematic because of GPLv3** (11.4). Use the PWA for iOS unless the Giac authors grant an exception. |
| **Desktop app** (optional) | Capacitor/Electron or just the PWA | PWA is usually enough |

### 11.4 Licence: GPL-3.0-or-later
- **Yes, GPLv3 is required**, because Giac is GPLv3. Use **`GPL-3.0-or-later`** for our code (same as Giac). All other components (MIT, BSD, BSL-1.0, Apache-2.0, MPL-2.0, LGPL/MIT) are compatible.
- **Source for every channel:** the PWA also *distributes* our JS/wasm, so the app needs an "About → Source code" link to the exact tagged version, and the licence text has to be shipped.
- **Apple App Store conflict:** Apple's terms add usage restrictions that the FSF considers incompatible with the GPL (VLC was pulled from the App Store over this in 2011). We don't own Giac's copyright, so **we can't grant an App Store exception ourselves**. Options: (1) iOS via PWA only, (2) ask Parisse and De Graeve for a written exception or a licence (they already dual-license Giac commercially).
- **Contributions:** require a DCO sign-off ("Signed-off-by") in commits to keep provenance clear. That also supports the clean-room rules in 01-feasibility-report.md section 3.2.

### 11.5 Releasing on F-Droid
**F-Droid main repository rules:** everything is FOSS, **F-Droid builds the APK from our source on its own build server**, the source tree contains **no prebuilt binaries** (no committed `.wasm`, `.so` or `.jar` blobs), and there are no proprietary dependencies (no Google Play Services, Firebase, Crashlytics or closed analytics). Precedents in `../fdroiddata`: Capacitor apps (`com.graphhopper.maps`, `com.logseq.app`) and Emscripten builds (`net.alexbarry.alexgames` installs Debian's `emscripten` package in the build VM).

**Steps** (built: the recipe and its notes are in `fdroid/`; the six steps are in git at `82b261f9`): a public repo with release tags and `versionCode`/`versionName` in `android/app/build.gradle`; fastlane metadata; one `build.sh` from clean source; the fdroiddata recipe with Debian's emscripten (P2); a local `fdroid build`; reproducible builds.

**Faster first step:** **IzzyOnDroid** (an F-Droid-compatible third-party repo) accepts the APK we build ourselves from GitHub Releases. Ship there first, while the main F-Droid recipe is being reviewed.

---

## 12. Next steps

The milestone history to the engineer core. Each milestone's full text and measurements are in git at `82b261f9` and in its shift report; what is left is in [backlog.md](backlog.md).
1. Name and repo: **Pascaline** (2026-10-10), https://github.com/buerlino/pascaline (GPL-3.0); README.md and CONTRIBUTING.md (clean-room rules, DCO sign-off).
2. Email to **Bernard Parisse** about the project, the help-file licence, KhiCAS reuse and the spike's upstream reports: sent; he confirmed the help-file licence on 2026-10-19 (decisions.md P10).
3. Phase 0 spike: done 2026-10-11 on the Lenovo Tab One: **GO**, no native fallback needed (archive/phase-0-results.md).
4. **Phase 1, milestone 1: MathPrint Home + CAS:** done 2026-10-11 (`archive/shifts/2026-10-11-report.md` at `bf418e9d`).
   Bar: on the Tab One (release build), cold launch → keyboard usable < 1 s and → engine ready < 1.5 s; Enter → drawn result p95 < 150 ms on the 55 benchmark inputs.
5. **Phase 1, milestone 2: Function app + Solve app:** done 2026-10-11 (`archive/shifts/2026-10-11-m2-report.md` and `archive/shifts/2026-10-11-m2b-report.md` at `bf418e9d`).
   Bar: milestone 1's start-up numbers hold; Plot ≥ 30 fps while zooming and panning three functions; Enter → solve result p95 < 300 ms (1-D and a 2×2 system).
6. **Phase 1, milestone 3: Python:** done 2026-10-11 (`archive/shifts/2026-10-11-m3-report.md` at `87a8c468`); P11 removed the Python app on 2026-10-13. The MVP release is not scheduled (P8).

---

## 12b. Features requested by the user (2026-10-11)
Built or superseded; see docs/04 sections 2.7 and 4 (constants, the Format key, units) (text in git at `82b261f9`).

## Sources
- Giac `fsolve` methods (GSL-based bisection, Brent, false position, Newton, secant, Steffensen): <https://www-fourier.univ-grenoble-alpes.fr/~parisse/giac/doc/en/cascmd_en/cascmd_en750.html>
- The other sources are in git at `82b261f9`.
