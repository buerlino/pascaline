<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Multi-engine calculators: the risk report, and what this repo shows

**Status (2026-10-20): decided.** Answered by [multi-engine-answer.md](multi-engine-answer.md); Part II's proposals: 1 → S17, 2 → A21 (P22), 3 → G63, 4 → G67.

*2026-10-19, base `p1/sandra-padlayout` at b1de57e. Part I is an outside report on multi-engine calculators, kept as received (only its headings moved down one level, and section 5's three sub-headings became a numbered list). Part II tests its argument against this repo, cites `file:line`, probes and decisions, and extends it. Part I's subtitle says Pascaline runs Giac, Qalculate! and a numerical backend; Part II section 0 corrects that premise. Decisions are not made here; they are in [docs/04](../04-architecture.md) and [decisions.md](../decisions.md).*

---

# Part I: the report (as received)

## Engineering Analysis: Architectural Feasibility and Maintenance Risks of Multi-Engine Calculators

**Subject Focus:** Multi-engine computational tools (Case Study: *Pascaline* integrating Giac, Qalculate!, and numerical backends)
**Author:** Architectural Analysis & Systems Engineering
**Document Type:** Technical Feasibility & Risk Assessment Report

### Executive Summary

Designing an all-in-one computational environment by embedding multiple disparate math engines—specifically **Giac (Xcas)**, **`libqalculate`**, and a **dedicated numerical/decimal evaluator**—represents an ambitious engineering effort to bypass the classical trade-offs of computational mathematics.

While theoretically sound and capable of offering desktop-grade versatility inside a unified interface, this multi-engine paradigm introduces severe friction in:
1. **Toolchain orchestration and cross-platform compilation.**
2. **Upstream dependency drift and maintenance overhead.**
3. **Semantic collision and parsing ambiguities (the "Routing Problem").**
4. **Process vulnerability (native C/C++ segmentation faults cascading to the UI layer).**

This report analyzes the foundational motivations behind this architecture, categorizes the distinct roles of each engine, diagnoses specific failure modes, and outlines mitigation strategies necessary to prevent project abandonment.

### 1. Context & Motivation: The Computational Dilemma

No single engine can simultaneously optimize for symbolic manipulation, dimensional arithmetic, and raw real-time throughput. Existing single-engine calculators inevitably compromise in one or more domains:

```
                      Symbolic Depth
                         (Giac)
                           /\
                          /  \
                         /    \
                        /      \
                       /        \
   Dimensional Analysis ────────── High-Throughput Numerical
      (libqalculate)                  (ExprTk / Native IEEE 754)
```

1. **A pure CAS (e.g., Giac, SymPy, Maxima)** excels at exact algebraic proofs, formal limits, and factorizations, but stumbles on real-world inputs like currency exchange, informal percentage offsets, and physical unit conversions.
2. **A dimensional engine (e.g., `libqalculate`)** handles units, physical constants, and fuzzy everyday arithmetic with ease, but lacks the internal algorithms required for high-order non-linear differential equations, formal matrix decomposition, or abstract symbolic calculus.
3. **A high-speed numerical engine (e.g., ExprTk, tinyexpr, BLAS)** evaluates expressions at native processor speeds for 60 FPS viewport plotting, but lacks symbolic understanding or unit awareness entirely.

By embedding three distinct engines, a calculator theoretically offers an "ideal" unified experience: real-world unit math, rigorous symbolic manipulation, and responsive real-time graphing.

### 2. Technical Profile of the Three Engines

| Engine | Primary Specialization | Key Mathematical Capabilities | Inherent Limitations |
| :--- | :--- | :--- | :--- |
| **Giac / Xcas** | Computer Algebra System (CAS) | Polynomial factorization, symbolic integrals ($\int x \sin(x)\,dx$), exact radical roots, formal matrix operations. | Computationally heavy; non-intuitive syntax for units; rigid syntax requirements. |
| **Qalculate! (`libqalculate`)** | Dimensional & Everyday Applied Math | Dimensional reduction ($10\,\text{kW}\cdot\text{h} \to \text{MJ}$), live currency, uncertainty propagation ($x \pm \delta$), intuitive parsing. | Limited symbolic algebra; cannot solve complex non-linear analytical equations. |
| **Numerical / Decimal Evaluator** | High-Speed & Exact Arithmetic | High-frequency sampling for graphing viewports; exact base-10 decimal math (preventing $0.1 + 0.2 = 0.30000000000000004$); bitwise logic. | Completely blind to variables, algebraic equivalence, and dimensional units. |

### 3. Maintainability & Engineering Friction

While conceptually straightforward, maintaining this multi-engine architecture introduces compounding maintenance debt.

```
┌─────────────────────────────────────────────────────────────┐
│                      UI / Frontend Shell                    │
└──────────────┬──────────────────┬───────────────────┬───────┘
               │                  │                   │
               ▼                  ▼                   ▼
       ┌───────────────┐  ┌───────────────┐   ┌───────────────┐
       │     Giac      │  │ libqalculate  │   │ Fast Numerical│
       │  (Autotools,  │  │  (Autotools,  │   │  (Header-only │
       │ GMP, MPFR, NTL)│  │   CLN/ICU)    │   │  or Modular)  │
       └───────────────┘  └───────────────┘   └───────────────┘
```

#### 3.1 Toolchain and Dependency Hell
* **Build Complexities:** Giac and `libqalculate` both rely on legacy GNU Autotools/Make build systems with heavy C++ runtimes and extensive native dependencies (`GMP`, `MPFR`, `NTL`, `CLN`, `ICU`, `readline`, `libcurl`).
* **Cross-Compilation Headaches:** Compiling these libraries together for non-desktop environments (such as iOS via Xcode, Android via the NDK, or the web via WebAssembly/Emscripten) requires maintaining custom CMake, Meson, or toolchain patches that frequently break on minor OS SDK updates.

#### 3.2 Upstream Drift and API Volatility
* **Idiosyncratic Codebases:** Giac was authored by academic mathematicians primarily for standalone use. Its internal API relies heavily on global context pointers (`giac::context`), sparse documentation, and non-standard idioms.
* **Semantic Versioning Gaps:** Neither Giac nor `libqalculate` guarantees strict semantic versioning for their C++ internals. Upstream security or bug fixes can silently alter expression parsing rules, memory lifetimes, or return types, requiring substantial wrapper rewrites.

#### 3.3 Thread Safety and Reentrancy
Both libraries rely on global configuration state:
* Giac stores angular mode (Radians vs. Degrees), precision settings, and variable scopes in global or thread-local contexts.
* Running asynchronous computations on background worker threads without state corruption requires deep knowledge of each library's thread-safety invariants.

### 4. The Bug Surface: Where the Seams Show

The primary source of defects in a multi-engine calculator is not the stability of individual engines, but the **philosophical and syntactic contradictions** between them.

#### 4.1 Syntactic Ambiguities and Semantic Clashes
Because each engine was created under different assumptions, identical string inputs produce contradictory outputs:

1. **Implicit Multiplication & Precedence:**
   * In a strict mathematical context: $1 / 2x$ is often parsed as $\frac{1}{2x}$.
   * In standard computer arithmetic: $1 / 2x$ evaluates as $\frac{1}{2} \cdot x = \frac{x}{2}$.
   * If a user query moves between engines, results will flip unpredictably.

2. **Variables vs. Physical Units:**
   * To Giac, $m$ represents an unknown algebraic variable in a polynomial:
     $$E = m \cdot c^2 \implies \text{Solve for } m$$
   * To Qalculate!, $m$ represents the SI base unit meter ($1\,\text{m} = 100\,\text{cm}$):
     $$E = m \cdot c^2 \implies \text{Dimension mismatch (energy vs. distance } \times \text{ velocity}^2)$$

3. **Numeric Precision and Type Coercion:**
   * Giac works with exact symbolic expression trees (ASTs) and algebraic numbers.
   * Qalculate! encapsulates values with units, uncertainty tolerances, and approximate rational intervals.
   * Serializing and deserializing data between these two models invariably leads to rounding errors, loss of symbolic tags, or parsing crashes.

#### 4.2 The "Routing Problem" (The Heuristic Trap)
When an application attempts to present a single input bar and automatically guess which engine should execute the query, it falls into the **Routing Problem**:

```
                          User Input String
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │   Heuristic Router    │
                     └───────────┬───────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │ (contains 'diff',     │ (contains unit tags,  │ (pure arithmetic
         │  symbols, matrices)   │  currency, or 'to')   │  or continuous x)
         ▼                       ▼                       ▼
    [ Giac CAS ]          [ Qalculate! ]         [ Numerical Engine ]
```

* **False Positives/Negatives:** What happens with the input `diff(5 m/s * t^2, t)`?
  * If routed to Giac, `m` and `s` become arbitrary algebraic variables, losing unit semantics.
  * If routed to Qalculate!, the differentiation command may fail or return an unsupported function error.
* **The "Uncanny Valley" of Interaction:** Small, harmless formatting changes (e.g., adding a space or an operator) can trip different heuristic conditions, shifting the execution to a completely different engine and returning wildly inconsistent UI cards.

#### 4.3 Native Faults and Crash Isolation
Unlike managed environments (Swift, Kotlin, TypeScript) where errors throw catchable exceptions:
* Native C/C++ math libraries can suffer from **unchecked stack overflows** during deep recursive symbolic evaluations.
* Malformed input strings can trigger **segmentation faults (`SIGSEGV`)** or **abort signals (`SIGABRT`)**.
* In a monolithic binary architecture, a segmentation fault in Giac immediately kills the entire application process, wiping out the user's active session without a diagnostic crash report.

### 5. Architectural Recommendations for Success

To prevent such a project from succumbing to technical debt and structural instability, the system must enforce strict isolation boundaries:

```
┌────────────────────────────────────────────────────────────────────────┐
│                          User Interface Layer                          │
│        (Explicit Mode Selection: CAS | Engineering | Quick Math)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ IPC / Message Passing
        ┌───────────────────────────┼────────────────────────────┐
        ▼                           ▼                            ▼
┌─────────────────┐       ┌─────────────────┐          ┌─────────────────┐
│ Out-of-Process  │       │ Out-of-Process  │          │   In-Process    │
│  Worker (Giac)  │       │ Worker (Qalc)   │          │ Numerical Engine│
│ (Wasm / Daemon) │       │ (Wasm / Daemon) │          │ (Plotting/Fast) │
└─────────────────┘       └─────────────────┘          └─────────────────┘
```

1. **Explicit Modes Over "Magic" Heuristics.** Eliminate automatic engine guesswork. Provide explicit, well-defined user contexts:
   * **Algebra / CAS Mode:** Dedicated exclusively to Giac. Variables are strictly algebraic.
   * **Engineering / Units Mode:** Dedicated exclusively to Qalculate!. Characters default to physical constants and unit vectors.
   * **Standard / Programmer Mode:** High-speed floating-point, arbitrary precision decimal, and bitwise base conversion.
2. **Out-of-Process Sandboxing (Crash-Only Architecture).** Decouple unstable C++ native code from the main UI thread:
   * **Desktop/Mobile:** Spawn engines inside isolated sub-processes using Inter-Process Communication (IPC) via pipes or local sockets.
   * **Web/Wasm:** Run each engine inside an isolated Web Worker.
   * **Benefit:** If Giac encounters an unhandled pointer error or runs out of stack memory during symbolic simplification, only the child worker terminates. The UI remains intact, catches the broken pipe, and surfaces a user-friendly error message ("*Symbolic engine encountered an internal limit*").
3. **Unified Serialization Intermediate Representation (IR).** Avoid passing raw strings from one engine's output into another engine's input parser. If values must cross engine boundaries, establish a strict, minimal Intermediate Representation (e.g., MathJSON or MathML AST) with explicit type tags for units and exact scalars.

### 6. Conclusion & Verdict

**Is the concept too ambitious?** No. Handheld calculators like the HP Prime and NumWorks have proven that pairing a CAS (such as Giac) with specialized numeric runtimes is not only feasible, but commercially viable.

**Will it fail?** It is unlikely to fail due to mathematical shortcomings, but it faces a high risk of abandonment if built as a tightly coupled, monolithic application. If the author attempts to create a "magic" input bar that silently routes inputs between engines, the project will quickly drown in edge-case bug reports, syntax anomalies, and native process crashes.

**Final Verdict:** The multi-engine approach is an effective engineering solution to a fundamental limitation in computer algebra, provided the architecture implements **process isolation** and **explicit user-selected computational modes**.

---

# Part II: the argument against this repo

## 0. Summary: one engine decides, the others feed and check

The report's verdict holds. Pascaline went one step further than the report recommends: it planned three runtime engines, then **removed two of them on probe evidence**. Today one engine produces every number on screen. The other two roles still exist, but only where they cannot disagree with it at runtime:

| Role in the report | Where it lives in Pascaline | Can it put a number on screen? |
|---|---|---|
| Giac, the CAS | worker 1: every Home, CAS, Solve, Num and (milestone 5) unit-view result (docs/04 6.1) | **yes, the only one** |
| libqalculate | build time only: the source of the Find index's unit factors, constants and uncertainties (P15; `build.sh` step 1c) | no: its code does not ship in the APK |
| Fast numerical evaluator | our parser's JS emitter, compiled once with `new Function`, in doubles (`app/src/input/emit-js.ts`, `app/src/apps/function/compile.ts:37`) | no: drawing only; trace, Num and analysis values come from the engine (`compile.ts:2-3`, D7) |
| Exact base-10 decimal evaluator | Giac exact-first: typed decimals become exact rationals (`toExactLiterals` in `homeEval.ts`; in CAS too since P9) | through Giac only |
| (not in the report) a second engine as a cross-check | the mpmath oracle at test time (`tests/golden/oracle.py`, `source: oracle`) | no: gates only |

So three of the report's four frictions shrink or vanish here:
- the routing problem does not arise: no router exists (section 2);
- crash isolation is built (section 3);
- the IR between engines is build-time data, not text (section 5).

The fourth, the toolchain, is still paid in full (section 6). Section 7 lists what the report misses, which is what a single engine costs instead:
- one source of correlated error;
- the parser becomes the seam;
- isolation plus stored state can loop;
- global modes leak between views;
- a long job blocks the queue.

## 1. How the repo got here

The repo tried the multi-engine plan and removed engines twice. It did not rule them out up front.

| Date | Decision | Engines at runtime |
|---|---|---|
| 2026-10-11 | P3: libqalculate is the only units database, behind a Units app and its own worker (docs/archive/p3-units-plan.md) | Giac, MicroPython (Python app), qalc (planned) |
| 2026-10-13 | P11: no Units app (units go after the formula, in the unit view); the Python app and its MicroPython worker removed | Giac, qalc (planned) |
| 2026-10-14 | P15: the unit view computes on Giac; libqalculate at build time only. G15's gate passed 2026-10-15 | **Giac** |

The Python app had already shown the report's problem 4.1.3 in this repo: `calc.eval("1-0.9-0.1")` gave `1.7763568394e-15` while Home showed 0 for the same input (docs/04 2.3 #7). That is one input, two engines and two answers. P11 made it moot by removing the second engine. It was never fixed by routing.

## 2. The routing problem: replaced by views and tokens

**No router.** The view the user picked decides the path: Home, CAS, or the unit view on its own key (Shift + Tmpl). Inside a view, the kind of token decides. Nothing reads an input string to guess an engine. This is the report's recommendation 1, explicit modes. Here the modes are views on one engine, not routes to different engines.

**The report's example, `diff(5 m/s * t^2, t)`.** Pascaline cannot take this input as letters:
- Units are not letters. They enter as atomic chips (`\unit{ID}`, `\pfx{p}`) from Find or the unit pad, and only in unit slots after the formula (docs/04 section 0 item 9, 4.3). An `m` typed with Alpha is always a variable.
- A function of a quantity with units is refused with a message (docs/04 4.2). So the user gets an answer about the input, not a guess about what was meant.

**The report's three clashes, as they appeared here:**

1. *Implicit multiplication (1/2x).* The repo hit this inside **one** parser, not between engines. One-line `1/2x` gave 1/(2x) and `6÷2(1+2)` gave 1 (docs/04 2.3 #13). One rule fixed it, the G2's one-line rule from `tests/golden/g2.yaml` (R30, `6348baf`). Precedence is a parser decision, made once, with a recorded source.
2. *Variables versus units.* The qalc probes show the clash is worse than the report says: qalc's parser misreads common engineering names **silently** (r6 section 6):
   - `degC` → coulomb·degree, `BTU` → byte·tesla·…;
   - `mu0` → 0 kg, `epsilon0` → 0 J·bit;
   - `R` → röntgen, `h` → hour, `NA` → N·A.

   That is why qalc's parser was rejected for unit slots even before P15 (docs/04 4.3, "Alternative rejected"; r7 section 5.2).
3. *Precision across the boundary.* Mapping qalc's "approximate" flag onto our marks was one of the costs P15 removed (decisions.md P15, "It removes").

**The failures that matter are silent, not crashes.** The report frames the seam as parse errors and crashes. The probes found plausible wrong answers instead (docs/04 4.1, r6 section 6):
- `1 m + 1 s` returns `1 m + 1 s`, with no error;
- `20 °C × 2` returns 40 °C;
- `1 hp` is 745.699987158 W **flagged exact**, wrong from the 7th digit (true 745.69987158227… W, `derived`).

Under principle 3 (no silent wrong answers), a silent wrong answer is worse than a crash, and a router can't detect one.

**The seam moved to the parser.** With one engine, our P1 parser is the only place where meaning is decided. Its rules (r6 section 1 step 6):
- it accepts only what our keys produce, and unknown input is an error, never a guess;
- every template has a parser rule and a round-trip case in the same commit;
- `parser.yaml` is in the golden gate.

Four of the 19 wrong-value paths in docs/04 2.3 were parser bugs, not engine bugs:

| # | Input | What it showed |
|---|---|---|
| 1 | `0xFF` | parsed as `0*x*F*F`, shown as an exact 0 |
| 11 | `2.5.3` | `0.75`, marked `=` |
| 12 | the chip 0.5 followed by a typed 3 | `1.5` |
| 14 | `1e-3` | `1*exp(1)-3` |

That is the routing problem in miniature: even one front door has to decide what each token means. docs/04 section 9 lists it as risk 5.

## 3. Crash isolation: built, and what the report misses

**Built** (docs/04 6.1, r6 section 2):
- Giac runs in a Web Worker. Cancel terminates it, starts a fresh one and replays the user's definitions (`app/src/engine/workerEngine.ts:274`). A worker crash takes the same path.
- Budgets stop Giac from inside instead, so the worker survives: patch `0002-emcc-subsecond-caseval-timeout.patch` makes Giac's interrupt fire in milliseconds in wasm (`engine/giac/patches/README.md`; `tests/engine/interrupt-test.mjs`).
- Memory is capped at 1 GB (`engine/giac/build-wasm.sh:188`, G24). A failed allocation gives "Out of memory: the engine was restarted" (`tests/engine/memcap-test.mjs`).

**Missed by the report: isolation plus stored state can loop.** A respawned worker gets the stored definitions replayed. A stored definition that crashed the worker crashed it again at every start, forever (backlog F31). The fix was a safe start (G19, `5ad277e`):
1. count each start in the store (`defsStarts`) before the replay runs;
2. clear the count once the engine is ready;
3. at `MAX_FAILED_STARTS = 2` (`workerEngine.ts:42`), start without the log and say so in one history line.

General rule: a crash-only design needs a start that skips whatever state caused the crash. Without one, isolation turns a crash into a loop.

**Recovery has a cost.**
- Replaying 200 definitions takes 291 ms on the Tab One, against a 50 ms budget, and pushes engine-ready to 1489 ms (docs/04 8.3; A4a, 2026-10-16).
- Ans is not replayed, and inputs that use random numbers get new values (decisions.md "Cancel replays definitions only").
- Variables are stored as values, so a restart does not re-run an integral (G3).

**Memory is counted per worker.** The Giac wasm alone is 9.75 MB, and the Tab One has 3.9 GB. A third worker, with its "open memory question on the 3.9 GB Tab One", was one of P15's reasons. A multi-engine design multiplies resident engines on exactly the low-end phones an engineer carries, and the report does not count that cost.

## 4. Global state: the seam reappears inside one engine

The report's 3.3 is about threads. In this build threads are off: `HAVE_LIBPTHREAD` and `HAVE_PTHREAD_H` are commented out of Giac's `config.h`, so Giac runs single-threaded in one worker (`engine/giac/patches/README.md`). Reentrancy across threads does not arise.

Global state still leaks, though, **between views that share one context**:
- **Precision switch.** At `Digits` ≤ 14 Giac computes in doubles, above that in MPFR. So `evalf(x,40)` depends on the global `Digits`, and `BesselJ(1,2)` gives a double at 12 digits and "Bad Argument Value" at 30 (r6 section 5). The host sets `Digits` per call and restores it (`app/src/engine/host.ts:407`, `:529-539`), and caches the Home mode by a key (`host.ts:225`, `:545`).
- **Angle mode.** `angle_radian` is global (`host.ts:88`). In DEG mode `exp(i*90)` reads as i, while `exp(i*pi)` stays −1 (backlog F29, G21).
- **Shared variables.** Home and CAS share one context on purpose: one worker, and no second 9.8 MB copy (decisions.md, 2026-10-11). The known cost: after Home `3 ▶ x`, CAS `factor(x^2-1)` gives `8` with no sign that x held 3 (F28). The mitigation is a result that names every stored value it used (G20, R32).
- **Solve** protects Home's Ans and the user's variables with `keepingAns` and `withUnassigned` (r6 section 2).

So the clash the report puts between engines also shows up between modes within one engine. Each mode a view needs must be set per call, or cached by a key and restored. A leak is a silent wrong answer, so each one gets a regression case first.

## 5. The intermediate representation: data, not text

The report's recommendation 3 (an IR instead of text between engines) is what the repo does at its two crossings:
- **Entry to the engine and to Plot.** MathLive LaTeX goes to our parser, then to one JSON tree. That tree becomes Giac text (`emit.ts`) or JS (`emit-js.ts`, `compile.ts:1-7`). Plot and the engine read the same tree, so they cannot parse differently.
- **libqalculate to the app.** This crossing happens at build time, as data. The Find index (325.7 kB raw, 1,850 items) holds an exact SI factor `si` for 399 of its 435 units and a dimension `dim` for 434 (P15). Nothing parses qalc text at runtime, and "qalc never sees text the user typed" (docs/04 section 0 item 9).
- **Results reused.** Chips carry the full value (`\res{k}`, `full` up to 2 kB), not the digits shown (docs/04 2.3 #8, #18).

**The risk moved from parsing to data.** Errors now sit in the index's numbers, and a router can't catch those either:
- qalc's own data is wrong for hp and mmHg;
- 36 units have no exact factor yet;
- G13 audits the factors against CODATA and exact definitions (docs/04 4.1, section 9 risk 3).

The generator's round-trip check and `units.yaml` (milestone 5) are the gates.

## 6. Toolchain and drift: real, and still paid

This is the one friction P15 did not remove, because qalc stays in the build.
- **Pinned and checked.**
  - Versions: Giac 2.1.0, libqalculate 5.13.1, libxml2 2.15.1, and GMP/MPFR shared between the two, all as SHA-256-checked tarballs.
  - Two toolchains: releases use Debian's Emscripten 3.1.69 in a pinned `debian:trixie` container (P2), and development uses emsdk 6.0.12.
  - Release builds are bit-reproducible (`setarch -R`), and a reproducibility gate covers both `giac.wasm` and `qalc.wasm` (docs/04 7.3).
- **Measured cost.** Giac takes about 5 minutes clean on 16 cores. The qalc release build takes 7.5–8 minutes (docs/04 7.1). F-Droid builds everything from source, so a library used only at build time still costs its whole build in every F-Droid build. `--no-units` degrades cleanly: Find then holds functions only.
- **No CI yet** (C3; the local half is A6, `npm run gate`).
- **Drift control.** `scripts/compare-engines.ts` diffs the output of two engine builds. The golden gate, with a source for every case, runs on every engine build that ships.
- **Open drift risk: the two local Giac patches are not reported upstream** (`engine/giac/patches/README.md`). Every Giac update has to re-apply them until upstream takes them.
- **Since P15, qalc drift is a data question only:** does the generated index change? A diff of the generated index between qalc versions answers it (proposal 2 below).

## 7. What one engine costs (not in the report)

The report argues for several engines and isolation. Choosing one engine has its own costs, and the repo has measured each one:

1. **Correlated error, with no second engine to disagree.** `normald_icdf(10^-10)` is wrong from the 8th digit, and Giac's two precisions agree on 9 digits, so the agreement check passes (docs/04 2.3 #2). The repo's answer is not a runtime second engine:
   - the cross-check runs at test time (the mpmath oracle);
   - inverse functions are substituted back like Solve roots;
   - unaudited floats show `⚠` (`715e1e8`).

   docs/04 section 9 lists it as risk 1.
2. **Head-of-line blocking.** A long CAS job delays a unit conversion until Cancel (P15 "Cost"; docs/04 4.5). Mitigations: "Working…" after 150 ms, and Cancel.
3. **Glue that a second engine would have supplied.** Dimensions, temperatures, logarithmic units and first-order uncertainty are our code (G16–G18), each with golden cases. This trades against principle 1 (reuse first). It is justified by principle 3, and by a measured gain that is large: no 0.95 MB lazy wasm, no third worker, and no adapter for qalc's silent non-answers (P15 "Why").
4. **Two back ends of one tree, checked separately.** `emit-js.test.ts` compares the Plot evaluator with hand-written JS functions, not with Giac. A rule that differs between `emit.ts` and `emit-js.ts` (an angle-mode or branch-cut difference, say) would draw a curve that the engine's own numbers contradict. Trace, Num and analysis values come from the engine, so no wrong number is shown. But the drawing can disagree with those numbers (proposal 3).

## 8. Revised verdict

The report: a multi-engine calculator works if it has process isolation and explicit modes.

The repo's evidence supports a stronger rule:
- **One engine decides every number shown.**
- Other engines may supply data at build time or check results at test time, never answer at runtime.
- The parser is the one front door, and it refuses what it cannot read.

Explicit modes stay (Home, CAS and the unit view, each on its own key), but they are views on one engine, not routes to different engines. Isolation stays as well, plus a safe start for stored state.

**What would change it:**
- The owner wants `5 km + 300 m` in Home. P8 already answers this: the same worker, behind a setting, and the token design supports it (docs/04 4.5).
- Giac's accuracy audit (EN7) fails broadly. Then a second numeric path for the failing functions might be needed. It would still sit behind the `MathEngine` interface and the marks, not beside them.
- A feature that Giac cannot do at all. None is known today. Live currency, the report's example, is off: the app is 100 % offline.

## 9. Proposals (each a candidate package; ids and placement are the owner's)

1. **Report patches 0001 and 0002 upstream** with the email to Bernard Parisse (draft in `../outreach/`; the owner sends it). This removes the main Giac drift risk in section 6.
2. **An index diff on every libqalculate upgrade.** The generator prints every unit whose `si`, `dim` or constant value changed, and the change needs a golden case or an owner's OK. This gate covers data drift, which is all that is left of qalc after P15.
3. **Plot evaluator against the engine.** For each `emit-js.test.ts` case, sample some x through Giac (`homeEval` on `subst`) and compare, in RAD and DEG. This catches the two back ends of one tree drifting apart (section 7 point 4).
4. **A list of global modes.** Every Giac global the host sets (`Digits`, `angle_radian`, the Home mode, Ans variables), where it is set and where it is restored, with one test per view switch that checks nothing leaks (section 4). The F28 and F29 leaks were found by review, not by a test.
