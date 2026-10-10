# Pascaline: feasibility study (originally "an open-source Android calculator modelled on the HP Prime G2")

> **Update:** the project direction changed to a *spiritual clone* that reuses as much open source as possible. See **[02-architecture-plan.md](02-architecture-plan.md)**. The legal analysis below still applies; the architecture, effort and testing sections are superseded.

*Date: 2026-10-10. This is an engineering study, not legal advice. Before you publish anything, have the legal section checked by a lawyer who knows IP law in your jurisdiction (CH/EU).*

---

## 1. TL;DR

| Question | Short answer |
|---|---|
| **Can we do it?** | Yes, as a **clean-room reimplementation** that behaves like the Prime. We can't do a literal "port", because most of the Prime's software is closed and owned by HP/Moravia. |
| **Is the CAS open source?** | **Yes.** The Prime's CAS is **Giac** (by Bernard Parisse, Univ. Grenoble Alpes), licensed **GPLv3**. HP uses it under a separate commercial dual licence. We can use upstream Giac for free, but then **our whole app has to be GPLv3**. |
| **What is *not* open?** | The Home-view numeric engine (12-digit BCD decimal), the HP PPL programming language interpreter, the apps (Function, Geometry, Spreadsheet…), the UI, the help texts, the skin artwork and the firmware. All of these have to be rewritten. |
| **Legal trouble?** | Low if we do it right: no HP code, ROMs, artwork or help texts, and no "HP" or "Prime" in the name or icon; same *logical* key layout but our own visual design. High if we ship a pixel copy called "HP Prime". Google Play also rejects apps that look like an official brand. |
| **Effort?** | A full-feature clone takes about **45–80 person-months** (roughly 4–7 person-years). A useful MVP (Home + CAS + Function app + basic PPL) takes about **8–12 person-months**. |
| **Can we guarantee no bugs?** | **No.** Nobody can guarantee that for a CAS, and that includes HP. What we can do is make bugs rare, quickly found and never silently reintroduced. We get there with differential testing against a real G2, independent oracles (MPFR, a second CAS, decimal test suites), metamorphic/property tests, fuzzing and a growing regression corpus (section 7). |
| **1:1 functions?** | Treat the real calculator as the **specification**: enumerate every catalog command, capture its behaviour on a real G2 into a golden test corpus, and track conformance per command (section 6). |

The idea is worth pursuing because there's a market gap: HP's official Android app **"HP Prime Pro" (now published by Moravia Consulting) disappeared from Google Play around October 2024**. It's still on iOS for about $24.99. Android users currently have no good option.

---

## 2. What the HP Prime G2 actually is (what we'd have to rebuild)

### 2.1 Hardware (only relevant for behaviour and performance targets)
- NXP i.MX 6ULL, ARM Cortex-A7 @ 528 MHz, 256 MiB RAM, 512 MB flash, FreeRTOS (G1 had 400 MHz/32 MiB/256 MB).
- **320×240 colour touch display.** This number matters: PPL programs draw to pixel coordinates on a 320×240 grid (`G0`…`G9`, `PIXON`, `BLIT`, `TEXTOUT`…). To run existing programs we **must keep a 320×240 logical framebuffer**, even when we scale it up on a phone.

### 2.2 Software components and their licence status

| Component | What it does | Source available? | Our plan |
|---|---|---|---|
| **CAS (Giac)** | Symbolic maths: `solve`, `int`, `diff`, `factor`, `limit`, matrices, ~1000+ commands | **Yes, GPLv3** (HP uses it under a dual licence; Prime is commonly cited as Giac 1.5.x, upstream is 2.0.0-21 as of Feb 2026) | **Reuse upstream Giac** |
| **Home numeric engine** | Non-CAS calculations: **12-digit BCD decimal**, exponent range ~±499, Home variables A–Z, lists L0–L9, matrices M0–M9 and so on. FW 2.4 (Sept 2025) added **exact small rationals** in Home and the Function app, so `(1/3)*3 = 1` now. | No (HP proprietary) | **Rewrite** on top of a decimal library (section 5.3) |
| **HP PPL** | Pascal-like programming language, programs, user apps, key reassignment | No | **Rewrite** (parser + interpreter) |
| **Python app** | MicroPython (≈ Python 3.4 level) with modules such as `hpprime`, `cas`, graphics and linalg | MicroPython is **MIT**. HP's glue modules are closed, and several Prime Python modules come from Parisse's KhiCAS work (verify licence). | **Embed MicroPython** and rewrite the modules |
| **Built-in apps** | Function, Advanced Graphing (implicit plots and inequalities), Graph 3D, Geometry, Spreadsheet, Statistics 1Var/2Var, Inference, DataStreamer, Solve, Linear Solver, Triangle Solver, Finance, Parametric, Polar, Sequence, Explorers (Linear/Quadratic/Trig), Python. *Check the exact list against firmware 2.4.* | No | **Rewrite** each one |
| **UI shell** | Keyboard with shift/alpha layers, soft menus, Toolbox/Catalog, Textbook (2D) entry and display, Algebraic and RPN entry modes, history, Symb/Plot/Num views, Settings, Notes, Memory manager, Exam mode | No | **Rewrite** |
| **Help system** | Context help for every command | No (copyrighted text) | **Write our own** (or reuse Giac's GPL docs where they apply) |
| **Connectivity / files** | `.hpprgm`, `.hpappdir`, `.hpnote`… via the Connectivity Kit | No (formats undocumented) | Reverse-engineer formats **for interoperability only** |

**Key takeaway:** Giac covers maybe **25–35% of the total work**, even though it's the mathematically hardest part. The rest is UI, a decimal engine, a language interpreter and about 20 apps, and all of that is new code.

---

## 3. Legal analysis

> Not legal advice. These are the issues to raise with a lawyer, plus the industry practice that makes this project normal and not exotic.

### 3.1 Precedents showing this is a well-trodden path
- **Free42** (Thomas Okken) is a GPLv2 clean-room reimplementation of the HP-42S that has been on Android, iOS and desktop for 20 years, with no HP ROM and no HP code. HP never shut it down.
- **KhiCAS** (Parisse) ports Giac to Casio, TI-Nspire and NumWorks calculators under the GPL.
- **GeoGebra** uses Giac as its CAS.
- **Xcas for Android and iOS** already exists, so Giac on Android is a solved problem.

### 3.2 Copyright: what we may and may not do
**Allowed (with low risk):**
- Reimplementing the **same functionality**. Functionality, maths and programming languages are not protected by copyright. In the EU see **CJEU C‑406/10 *SAS Institute v WPL* (2012)**, and in the US **Google v. Oracle (2021)**, which held that reimplementing an API's declarations was fair use.
- Using the **same command names and syntax** (`solve`, `int`, `PIXON_P`, `FOR … FROM … TO … DO … END;`). Without them, existing user programs can't run, and that is an interoperability purpose.
- Black-box testing a real calculator we own and recording its outputs as a specification.
- Reverse-engineering **file formats** to read and write user programs. This is generally allowed for interoperability (EU Software Directive 2009/24/EC Art. 6), but keep it narrow and document it.

**Not allowed:**
- Copying or extracting **firmware/ROM code**, decompiling HP's binaries to copy logic, or using leaked sources.
- Copying **HP's artwork**: skin images, icons, app icons, fonts that HP licensed, screenshots of HP's UI.
- Copying **manual or help text** verbatim. We may read the user guide to learn behaviour, but we must write our own documentation.
- Bundling HP's emulator, Connectivity Kit or Prime Pro app files.

**Clean-room discipline:** anyone who has decompiled HP firmware must not write engine code. Keep a log of specs and sources and where each behaviour was learned (device observation, public manual, Giac source). This log is our defence if anyone asks.

### 3.3 Trademark
- "HP", "Hewlett-Packard" and the HP logo are trademarks, and "HP Prime" is a product mark. **Don't use them in the app name, icon, package name or store listing title.** Pick our own name (e.g. "OpenPrime" is *still risky* because of "Prime"; a neutral, invented name is safer. Check F-Droid, Play and GitHub for collisions first: e.g. "Calyx" is already an F-Droid science app and also CalyxOS).
- Descriptive mention in the body text, such as *"Runs programs written for the HP Prime™. Not affiliated with HP Inc. or Moravia"*, is normally OK as nominative/referential use.

### 3.4 Design / trade dress (the "same layout" question)
- The **logical** layout (which function sits on which key and shift layer) is mostly functional, and it's what users actually want for muscle memory. Low risk.
- The **visual appearance** (exact colours, key shapes, bezel, the distinctive Prime look) could be protected as a registered design (EU Community Design) or as trade dress. **Recommendation:** same logical layout, different visual styling. Optionally let users load third-party skins, as Free42 does, but never ship HP's look ourselves.
- **Google Play's "impersonation" policy** is the most *practical* risk. An app that looks like an official HP product will be removed. F-Droid is less strict about this but still won't accept trademark-infringing names.

### 3.5 Licence obligations from our dependencies
- **Giac: GPLv3+**, so the whole app is GPLv3. That's fine for an open-source project. Consequences: we can't make a closed-source paid version unless we buy a commercial Giac licence from the authors, which is what HP did. Charging money for a GPL app on Play is still allowed.
- Typical Giac dependencies: **GMP** (LGPLv3/GPLv2), **MPFR** (LGPLv3), **NTL** (LGPL), **PARI/GP** (GPL, optional), **GSL** (GPL, optional). All are GPLv3-compatible.
- **MicroPython: MIT.** Compatible.
- **libmpdec** (decimal arithmetic): BSD-2. Compatible.

### 3.6 Optional: ask
Moravia Consulting now develops and sells HP calculators under licence from HP (since 2022). It costs nothing to email them about the project. They might grant a trademark/skin licence or point out what they object to. Do this before going public, not after.

---

## 4. Is the CAS engine open source? (detail)

**Yes.** Giac/Xcas has been developed since 2000 by Bernard Parisse and Renée De Graeve at Institut Fourier, Université Grenoble Alpes:
- About 150k+ lines of C++ and over 1,000 pages of (mostly French) documentation.
- Licence: **GPLv3**, with a commercial dual licence available on request (HP's route).
- Upstream is **newer than what's on the Prime**. The Prime's CAS is a frozen, adapted snapshot that Parisse syncs only occasionally. Some bugs found on the Prime are already fixed upstream, and some upstream behaviour differs from the Prime.

Implications for a "1:1" clone:
1. Upstream Giac gives us roughly **90%+ of Prime CAS behaviour for free**, because it's the same engine with the same command names.
2. The remaining differences come from version drift, Prime-specific display formatting, and Prime-specific settings (Prime "CAS settings" page: exact/approx, complex, principal solutions, number of digits…). We handle these with a thin **compatibility layer** and golden tests, not by forking Giac heavily.
3. Contribute fixes **upstream** to Parisse. He is famously responsive, and it keeps our fork small.

---

## 5. Proposed architecture

```
┌────────────────────────── Android app (Kotlin, Jetpack Compose) ───────────────────────────┐
│  Keyboard (shift/alpha layers, long-press, haptics)  │  320×240 logical LCD view (scaled)  │
│  Soft-menu bar, Toolbox/Catalog, Settings, file import/export (SAF), share, themes         │
└────────────────────────────────────────┬───────────────────────────────────────────────────┘
                                         │ JNI (thin C API: key events in, framebuffer/out)
┌────────────────────────────────────────▼───────────────────────────────────────────────────┐
│                     calc-core (portable C++17, builds on Linux/macOS/Windows/Android)      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  ┌─────────────┐  ┌──────────────────┐ │
│  │ UI state    │  │ Home engine  │  │ CAS bridge │  │ PPL lexer/  │  │ App framework    │ │
│  │ machine,    │  │ (12-digit    │  │ (Giac +    │  │ parser/     │  │ Symb/Plot/Num    │ │
│  │ editor,     │  │ decimal,     │  │ Prime      │  │ interpreter │  │ views; Function, │ │
│  │ 2D textbook │  │ lists, mats, │  │ compat     │  │ + graphics  │  │ Stats, Solve,    │ │
│  │ renderer    │  │ units, bases)│  │ layer)     │  │ G0–G9       │  │ Geometry, …      │ │
│  └─────────────┘  └──────────────┘  └────────────┘  └─────────────┘  └──────────────────┘ │
│  MicroPython + hpprime/cas/graphic modules │ Persistence (vars, programs, apps) │ File fmt │
└────────────────────────────────────────────────────────────────────────────────────────────┘
       Deps: giac, GMP, MPFR, (NTL), libmpdec, MicroPython, FreeType (own/OFL fonts)
```

### 5.1 Key design decisions
1. **The core renders into a 320×240 framebuffer, like the real device.** Android only displays it, scaled, and forwards key and touch events. Benefits: PPL graphics programs work unmodified, screenshots can be compared pixel-for-pixel in tests, and the whole calculator runs headless on a desktop for CI. A later "hi-res mode" can render text natively.
2. **Everything is testable without Android.** The core is a desktop library plus a CLI (`calc-core --keys "2 + 3 ENTER"`), which makes tests fast and fuzzable.
3. **Giac is behind a bridge.** We never call Giac from UI code, so we can swap versions, pin behaviour and add Prime-compatibility shims in one place.
4. **Home engine is separate from CAS**, as on the real device. Home is decimal. CAS uses binary floats plus exact arithmetic. Mixing them up gives the wrong last digits everywhere.

### 5.2 Building Giac for Android
- Cross-compile GMP, MPFR (and NTL if needed) with the NDK for `arm64-v8a`, `armeabi-v7a` and `x86_64`. This is known to work (Xcas for Android exists). Expect 1–3 weeks of build-system work.
- Disable GUI parts (FLTK), and drop optional heavy libs (PARI, GSL) at first.
- APK size: Giac plus its libs is several tens of MB per ABI, so ship an **App Bundle** so each device gets only its ABI.

### 5.3 Home engine (the tricky part nobody gives us)
- Use **libmpdec** (the engine behind Python's `decimal`, BSD) with context `prec=12`, `Emax=499`, `Emin=-499` and the rounding mode HP uses (to be confirmed by device tests: round-half-up vs half-even).
- Basic arithmetic is correctly rounded in libmpdec. **Transcendentals** (sin, ln, Γ…) are where HP's results may differ in the last digit. We compute them at higher precision (e.g. 20–30 digits) and round to 12. Wherever the device differs, we record it in a documented divergence list ("we are correctly rounded, the device is off by 1 ulp") instead of copying errors, unless we choose a strict compatibility mode.
- FW 2.4 behaviour: **exact rationals** with numerator and denominator up to about 19 digits, falling back to decimal beyond that. Implement this with 64/128-bit integers.
- Also needed: complex numbers, integers in bases with word size (`#1Fh`), units and conversions, physical constants, lists, matrices, the Home variable system, angle modes, number formats (Standard/Fixed/Sci/Eng, digit grouping).

---

## 6. How to get "all functions equal" (1:1 conformance)

A literal 1:1 port is impossible without HP's source code. The achievable goal is **behavioural equivalence, verified per command**.

### Step 1: build the specification inventory
- Enumerate **every** entry in the Catalog, Toolbox (Math/CAS/App/User), every PPL keyword, every app's views and settings, and every Settings page option. Export the catalog list from a real device or the official Virtual Calculator by hand, or via screenshots/OCR.
- Store it as a machine-readable spec, e.g. `spec/commands.yaml`, with name, context (Home/CAS/PPL/Python), arity, argument types, settings it depends on, and source of truth.

### Step 2: capture golden behaviour from a real G2
- Buy one or two **HP Prime G2** units (and keep their firmware pinned to **2.4 rev 15515**, the baseline we target).
- For each command, write test cases: normal inputs, edge cases, error inputs, and each relevant setting (angle mode, exact/approx, complex on/off).
- Run them on the device and record the outputs. Options from cheapest to best:
  1. Write a **PPL test-runner program** that loops over test expressions (strings), runs `EXPR()`/`CAS()` on each, and writes the results to a Note or list. Transfer that to the PC with the Connectivity Kit. This automates thousands of cases per batch.
  2. Use the official **HP Prime Virtual Calculator** (Windows/macOS) for high volume, then spot-check against the hardware (they should be the same firmware build). *Check its EULA first. Observing outputs is black-box testing, not reverse engineering.*
- Golden files go into git: `golden/home/sin.yaml`, `golden/cas/solve.yaml`…

### Step 3: conformance dashboard
- CI runs every golden case against `calc-core` on desktop and reports, per command, **pass / documented divergence / fail / not implemented**.
- "1:1" then becomes a measurable number: *"97.3% of 41,000 golden cases pass; 112 documented divergences."*

### Step 4: decide policy for HP's own bugs
The Prime has known CAS bugs; community examples include wrong infinite complex sums, a wrong root from `solve`/`zeros` with float coefficients, and `exact(1e-80)` returning 0. Decide once:
- **Default:** be mathematically correct and list the divergence.
- **Optional:** a strict "device-compat" flag only where real user programs depend on the quirk (rare).

### Step 5: programs as conformance tests
Collect public PPL programs (hpcalc.org, the HP Museum forum), with licence permission or just as local test inputs that we don't redistribute. Every program that runs identically on device and on our app is an end-to-end test.

---

## 7. How to minimise bugs in the calculator engine

You can't *prove* a CAS bug-free, and even Mathematica ships bugs. The realistic goal: **bugs are rare, caught before release, and never come back.** We get there by layering many independent checks.

### 7.1 Oracles: what do we compare against?
| Oracle | Use for |
|---|---|
| **Real HP Prime G2 (golden corpus)** | "Does it behave like the Prime?" (conformance) |
| **MPFR / Arb (FLINT)** at high precision | "Is the numeric result *correct*?" Ground truth for every transcendental, rounded to 12 digits |
| **IBM/Cowlishaw General Decimal Arithmetic test suite (`dectest`)** | Exhaustive edge cases for the decimal engine (rounding, overflow, subnormals) |
| **Second CAS: SymPy, Maxima, or free Wolfram Engine for developers** | Cross-checking symbolic results; when two CAS disagree, a human looks |
| **Upstream Giac test suite** | Regression for the CAS itself |

### 7.2 Testing techniques
1. **Golden/differential tests** against the device (section 6).
2. **Self-verifying (metamorphic) tests.** These need no oracle at all:
   - `diff(int(f,x),x) - f` simplifies to 0, or is numerically 0 at random points
   - `expand(factor(p)) == p`, `subst(solve(eq), eq)` holds
   - `A * inv(A) == I`, `det(A*B) == det(A)*det(B)`
   - `sin²+cos² = 1` at random decimal points within 1 ulp
3. **Property-based testing** (RapidCheck for C++, Hypothesis via Python bindings) generates random expressions, matrices and decimals, and shrinks failures to minimal cases.
4. **Fuzzing** with libFuzzer/AFL++ plus **ASan/UBSan** on the expression parser, PPL parser/interpreter, file importers and Giac entry points. Fuzzing finds crashes, hangs and memory bugs, which on a phone mean "app died, user's work lost".
5. **Timeouts and resource limits.** Every CAS call runs with a time/memory budget and is cancellable (the device has an ON-key interrupt; we need the same).
6. **UI tests:** key-sequence scripts that check the resulting framebuffer (pixel diff against golden screenshots), plus Compose UI and screenshot tests (Roborazzi/Paparazzi) for the Android shell.
7. **Regression rule:** every bug report becomes a test before it's fixed. No exceptions.
8. **Continuous integration:** run everything on Linux on every commit, nightly long fuzzing runs, and Android instrumented tests on an emulator matrix (old/new API levels, arm64/x86_64).
9. **Persistence safety:** fuzz/crash-test saving and loading of state, with versioned file formats and migrations. Losing a user's programs is the worst kind of calculator bug.
10. **Optional formal methods** for the small, critical decimal core (e.g. checking rounding against MPFR exhaustively over structured input spaces). Full formal verification of a CAS isn't realistic.

### 7.3 Release gates
- 100% of the golden corpus is either passing or a documented divergence.
- No open crash or wrong-answer bugs in the Home engine.
- 24h of fuzzing without new crashes.
- Public beta on F-Droid or the Play testing track, with in-app "report wrong result" that exports the expression and settings as a ready-made test case.

---

## 8. Effort estimate

Assumes experienced developers (C++ and Kotlin, some numerical/CAS background). PM = person-months.

| Work package | PM (low–high) |
|---|---|
| Project setup, architecture, CI, Giac + GMP/MPFR NDK builds | 1–2 |
| UI shell: keyboard layers, soft menus, Toolbox/Catalog, history, entry line, **2D Textbook editor and pretty-printer**, RPN mode, settings | 5–8 |
| Home engine: 12-digit decimal, FW 2.4 rationals, complex, lists, matrices, units, constants, base integers, ~400 Home functions | 6–9 |
| CAS bridge + Prime compatibility layer + CAS settings | 2–3 |
| PPL interpreter, graphics (G0–G9), program editor and debugger, user apps, key reassignment | 5–8 |
| App framework (Symb/Plot/Num, zoom, trace, tables) | 3–4 |
| Function, Parametric, Polar, Sequence, Solve, Linear/Triangle solvers, Finance, Explorers | 5–7 |
| Statistics 1Var/2Var, Inference, Spreadsheet | 4–6 |
| Advanced Graphing (implicit/inequality plotting, interval arithmetic) | 2–3 |
| Geometry app (dynamic geometry, a large app on its own) | 4–6 |
| Graph 3D | 2–3 |
| Python app: MicroPython embed + `hpprime`/`cas`/graphics modules | 2–3 |
| File compatibility (`.hpprgm`, `.hpappdir`, notes) import/export | 1–2 |
| Help system (original text for ~1,000+ commands) | 3–5 |
| Test infrastructure + capturing the golden corpus + fuzzing | 4–6 (ongoing) |
| Polish, accessibility, translations, store releases, bug fixing | 3–5 |
| **Total** | **≈ 52–85 PM** (about 4.5–7 person-years) |

**Phased plan (one option):**
- **Phase 1 – MVP (≈ 8–12 PM, e.g. 2–3 devs × 4 months):** keyboard and layout, Home with the decimal engine, CAS view (Giac), history, Function app (Symb/Plot/Num), basic PPL (no graphics). Published on F-Droid. Already better than anything currently on Android.
- **Phase 2 (≈ +15–20 PM):** PPL graphics, Stats/Solve/Sequence/Parametric/Polar, Spreadsheet, file import, Python.
- **Phase 3 (≈ +20–30 PM):** Geometry, Advanced Graphing, 3D, Inference/Finance/Explorers, full help, compat polish to ≥95% conformance.

**Shortcut worth evaluating first:** **KhiCAS / Xcas for Android** by Parisse already has a calculator-style shell with Giac and MicroPython under the GPL. Forking it, or at least reusing its Giac build and MicroPython-Giac glue, could save **3–6 PM** in Phase 1. Talk to Parisse before starting. He might also be interested in the project.

AI coding assistants can speed up boilerplate (apps, UI, test scaffolding) considerably. They don't shorten golden-corpus capture or the verification work, and those are what decide quality.

---

## 9. Main risks

| Risk | Impact | Mitigation |
|---|---|---|
| Takedown or store removal over branding | High | Own name and visual design, disclaimer, optionally ask Moravia first (section 3.6) |
| Underestimating "small" apps (Geometry, Spreadsheet, Textbook editor) | High | Phase plan, ship the MVP early |
| Home decimal results differ in last digit | Medium | MPFR oracle + device corpus + documented divergence policy |
| Giac version drift vs Prime | Medium | Compat layer + golden tests; upstream fixes |
| Giac performance or memory on low-end phones | Low–Med | Phones are about 10× a G2; add cancellation and timeouts |
| GPLv3 limits commercialisation | Low (intended to be OSS) | Accept, or negotiate a commercial Giac licence later |
| Contributor accidentally copies HP material | Medium | Clean-room rules, CONTRIBUTING.md, review checklist |

---

## 10. Recommended next steps
1. **Pick a name** that doesn't use HP or Prime, and register the GitHub/Codeberg org.
2. **Email Bernard Parisse** about the plan, KhiCAS reuse and upstreaming.
3. Optionally **email Moravia**, then **get a short legal review** (an hour with an IP lawyer) of section 3.
4. **Buy a G2**, pin firmware 2.4 rev 15515, and write the PPL test-runner (section 6, step 2).
5. Prototype in **2–3 weeks**: Giac built with the NDK, a Compose keyboard, a 320×240 framebuffer, and `2+3` and `solve(x^2=2,x)` working on a phone.
6. Write the `spec/commands.yaml` inventory and set up the conformance dashboard from day one.

---

## Sources
- Xcas / Giac overview and licence: <https://en.wikipedia.org/wiki/Xcas>, <https://xcas.univ-grenoble-alpes.fr/en.html>, <https://xcas.univ-grenoble-alpes.fr/backup/giac.html> (GPL3, commercial dual licence, v2.0.0-21 Feb 2026)
- KhiCAS ports: <https://xcas.univ-grenoble-alpes.fr/calculatrices/en.html>
- HP Prime hardware, CAS origin, Moravia since 2022: <https://en.wikipedia.org/wiki/HP_Prime>
- Home 12-digit BCD vs CAS binary floats: <https://hpmuseum.org/forum/printthread.php?tid=3558>, <https://www.hpmuseum.org/forum/printthread.php?tid=644>
- Firmware 2.4 rev 15515 (2025-09-17, exact rationals in Home): <https://www.hpmuseum.org/forum/post-218396.html>, <https://hpcalc.org/details/7783>
- HP Prime Pro (Moravia, iOS) and removal from Google Play (Oct 2024): <https://apps.apple.com/us/app/-/id1064702857>, <https://www.hpmuseum.org/forum/post-193030.html>
- Python on the Prime (MicroPython, `hpprime` module): <https://udel.edu/~mm/hp/primePython/>
- Known Prime CAS bugs (examples): <https://hpmuseum.org/forum/thread-2723.html>, <https://hpmuseum.org/forum/printthread.php?tid=8648>
- Free42 clean-room precedent: <https://thomasokken.com/free42/>
- Giac in GeoGebra: <https://github.com/geogebra/geogebra>
- Legal references (look up with counsel): CJEU C-406/10 *SAS Institute v World Programming*; *Google LLC v. Oracle America* (US Supreme Court, 2021); EU Directive 2009/24/EC Art. 6.

*Items marked "verify" (exact app list on FW 2.4, rounding mode, licences of Prime-specific Python modules, Virtual Calculator EULA) weren't confirmed in this study and should be checked first.*
