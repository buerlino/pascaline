<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Feature analysis: Pascaline as a precision engineering tool

*Written 2026-10-12 (Claude, for the project owner and Henri); **revised the same day** after the owner's answers. Base: `phase-1` at d99b3ba. "What is here" was checked in the code or docs on that day. **(to verify)** marks assumptions I did not test. Effort figures are my estimates, not measurements.*

**Goal (user, 2026-10-12):** not another calculator. A precision engineering tool that lets any engineer do day-to-day calculations much faster and more precisely. The mission text is in CLAUDE.md, README.md and the docs/02 header. The G2 key layout stays as the way in, not the aim.

## 0. Design rules from the owner (2026-10-12)

These bind every feature below. Henri: please treat them as decisions, not suggestions.

1. **No categories by discipline.** The calculator does not ask who you are. Engineers use several disciplines, so there is no "electronics" or "civil" content split. The tool must be so easy and intuitive that anyone finds what they need, **especially units and constants**.
2. **Speed is the test for units.** Entering `nm` must beat typing `E-10` (about one second). If finding a unit takes longer than that, it has failed. Searching a long unit list for ten seconds is a waste.
3. **Units stay separate from normal calculation.** A precision tool does one or two things well, not everything. Units are decided by utility: if they make Home, Solve or lists harder, they do not go there.
4. **Focus.** Fewer features done perfectly beat parity with the G2.

## 1. Recommendation (revised)

Build an **engineer core** in this order, ahead of the Prime-parity apps:

1. **EN0 Task benchmark** (start first, it judges everything else): real tasks with keystroke budgets, replayed by tests (section 6).
2. **EN1 Find, one search for everything.** A single search box that finds functions, constants, units and variables by typing a few letters, with aliases, typo tolerance, recents first, and a live preview. This is the answer to "everyone can find exactly what they need" and replaces category menus. Details in section 3.
3. **EN2 A separate Units app, plus SI prefix shorthand everywhere.** Home, CAS, Solve and lists stay unit-free; they get fast prefix entry and prefix display (`4.7k`, `2.2n`). The Units app does conversion, dimension checks and uncertainty, with its own entry. This amends the P3 plan (section 4).
4. **EN3 Honest precision**, **EN4 copy/share/export**, **EN5 matrices and lists you can enter**, **EN6 number bases**.
5. **EN7 Everyday functions** (parallel resistance, E-series, dB, interpolation, RMS, coordinate conversions) as ordinary functions found through Find, not a categorised library.

**Dropped from my first report:** a categorised formula library with unit-aware Solve (rule 1 and rule 3). A user's own saved formulas can come later through Find if wanted. **Deferred:** statistics with data entry, spreadsheet, signals and control, parametric/polar plots, then the Prime-parity apps (Geometry, 3D, Explorers, Inference, Finance).

## 2. What is here (checked 2026-10-12)

| Area | State |
|---|---|
| **Home** | Exact-first, 12 significant digits by default, float fallback for huge/slow cases, `Ans`, store ▶, variables shared with CAS, persisted history (123 golden cases) |
| **CAS** | Giac, exact results in 2D; calculus (`int`, `lim`, `sum`, `prod`, `diff`), matrices parsed, `det`, lists (330 parser cases) |
| **Entry** | Textbook entry, one-line mode, decimal comma, polar `r∡θ`, insertable results, trackpad on the arrow keys (K1) |
| **Formats** | STD, SCI, ENG, FIX; Format key cycles the last result (also fraction, mixed, polar ⇄ rectangular) |
| **Function app** | Plot, trace, root/extremum/intersection/slope/area, Num table (56 fps on the Tab One) |
| **Solve app** | 1-D, systems, polynomials; every root substituted back with ⚠ on a large residual |
| **Python** | MicroPython, editor, shell, graphics, `calc` reaches Giac and variables |
| **Platform and quality** | Android APK, offline PWA, no trackers; about 600 golden cases tagged by source; bit-reproducible release engine; Enter → result p95 92 ms on the Tab One |

**Designed, not built:** units/constants/uncertainty (P3, `docs/p3-units-plan.md`), compact keypad and hold-and-drag cursor (K2, K4), reference number-format parity (G9), and everything in docs/02 section 8 (v1, v2).

**Empty today:** the Vars, Math and Tmpl keys do nothing (`special: none`, keyboard.yaml); the Home/CAS Menu key opens nothing (menus exist only inside Function, Solve, Python); there is no clipboard, share or CSV code anywhere in the app (grep, 2026-10-12).

## 3. EN1 Find: one search for everything

**Problem.** The engine has hundreds of commands, a large unit database and the CODATA constants. Category menus (Math → Algebra → ...) are slow and need the user to know the taxonomy. Spelling `normald_cdf(` with alpha letters needs the exact name. Both break rule 1 and rule 2.

**Design.**
- **One entry point, one habit.** A Find key (candidates: the empty Tmpl or Math cell; the Home Menu key) opens a search field. The user just types; no alpha mode needed inside it. The Vars and Math keys can later open plain browse lists as a fallback, but search is the primary path.
- **Mixed results with a kind badge:** function, constant, unit, variable. Ranked by: recents and frequency first (the user's own habits), then exact name or symbol, then prefix, then alias and description words, then typo tolerance.
- **Aliases make it forgiving:** `kph` → km/h, `inch`/`in` → inch, `speed of light`/`c0`/`c` → c, `eps0`/`ε0`/`permittivity` → ε₀, `mu`/`µ` both, `ohm`/`Ω`, `degC`/`°C`. A user who types the word they think of should land on the thing.
- **Live preview, no extra tap:** a constant shows its symbol, value, unit and CODATA uncertainty; a unit shows its dimension and its factor to SI; a function shows its syntax and one example (Giac's help lines, R5 reads them as GPL-compatible, still to confirm with Parisse).
- **Insertion is a token, not text.** A constant or unit is inserted as an upright symbol chip (the P3 plan already requires explicit tokens), so `g` the constant never collides with `g` the variable and `R` is never read as röntgen.
- **Keystroke budget:** an item used before is 2 keys plus Enter (Find, first letters, Enter); a new one is the letters typed plus Enter. The benchmark enforces this (EN0).
- **Works without the units engine loaded.** Search needs only names, aliases, descriptions and values. These can be generated at build time from libqalculate's definitions (**to verify** that its XML has the names, abbreviations and titles needed) into a small static index, so Find is instant and does not load the 0.93 MB units worker. Only evaluating a unit or constant expression loads it.
- **Cost:** about 6–8 days for the palette, ranking, index generation and tests (reuses the existing `PickList` component). Functions, constants and units each need alias data; the unit and constant aliases are the content work, and should be tested by a list of "what a user would type" queries with the expected hit.

## 4. EN2 Units: a separate app, plus prefix shorthand

**Amends P3 decisions 2 and 6** (`docs/p3-units-plan.md` section 7; both accepted 2026-10-11) on the owner's direction of 2026-10-12. The engine choice (libqalculate as a lazy third worker), the build, the data checks, the `hp` patch and the tests of that plan stand.

**What changes.**

| P3 plan | Revised |
|---|---|
| Units and Constants as menu pickers | **Find** (section 3), type-ahead; no browse-by-category as the main path |
| Unit tokens allowed in Home/CAS expressions, split between Giac and qalc by a `unitEval` layer | **Units live in their own app.** The whole expression goes to qalc there. This removes the Giac/qalc split and the "mixed unit + CAS" error case (P3 risk 5) |
| Units in scalar Home expressions | Home, CAS, Solve and lists stay unit-free |
| ENG E-notation only | **SI prefix shorthand** in all views (below) |

**The Units app.**
- One entry line. After a number, typed letters bring up unit suggestions (the same index as Find, recents first); `→` converts, and it remembers the last target per dimension (if you always convert km/h → m/s, `→` already offers m/s).
- The result shows the number in the chosen unit, the dimension (for example L·T⁻¹), and one-tap alternatives (SI base unit, the two or three most used for that dimension).
- A dimension mismatch is a plain message that names both dimensions, never a number.
- Uncertainty (`±`) with first-order propagation, as P3 decision 4 (interval arithmetic stays off).
- Temperature offsets (°C, °F) get explicit rules and golden cases, as before.
- Constants work here and everywhere through Find. In Home, a constant is inserted as its number (full CODATA digits, one token), so the unit-free views stay unit-free.

**SI prefix shorthand (all views).**
- A strip of prefix chips (p n µ m k M G T) appears when the cursor follows a number; one tap writes `4.7 k` meaning 4700. The parser reads it as an exact power of ten (rule: one parser rule and one round-trip case per chip, as always).
- A display option shows results with prefixes (`4.7µ` instead of `4.7E-6`), in the same place as the existing ENG format.
- **Honest gain:** typing `E-9` is `EEX`, `(−)`, `9` (3 keys), a chip is 1 key. For input that is a small win, as the owner says; the larger win is **reading** results with prefixes. It stays only if the benchmark shows it helps, and it costs about 2 days.

**The speed gate (rule 2).** A unit insertion must take no more than 4 keystrokes at the median in the benchmark (recents ≤ 3), and the owner times ten sample tasks by hand, `E-notation` against units, before units ship as a default path. If units lose on a task, the answer is to improve ranking or entry, not to add a tutorial.

**Effort:** U1 build and worker 2 d, Units app and parsing 3 d, formatting and conversion 2 d, tests and device timing 1.5 d: about 8–9 days, plus EN1 (shared), plus about 2 days for prefixes. Cheaper than the P3 plan's 11–12 days because the Giac/qalc split disappears.

**What I could not decide for the owner: units elsewhere.** The owner's rule is "decide by utility". My view: not now. If after the Units app is in use a Home user wants `5 km + 300 m` directly, the same qalc worker can serve Home behind a setting. That is a later, measured decision, not a v1 requirement.

## 5. The other gaps, trimmed

| ID | Gap | Notes | Est. |
|---|---|---|---|
| **EN3** | **Honest precision.** Digits capped at 15 in Settings although the engine is arbitrary precision (allow 30+); an exact/approximate mark on every result; say when the float fallback was used (**to verify** that the UI does); copy full precision; significant-figure rounding as a format | MPFR is already linked; the formatter is ours | 3–4 d |
| **EN4** | **Copy, share, export.** Copy a result (plain number, LaTeX), paste a number into the entry, share a session as text, export a table as CSV | Capacitor Share/Clipboard (MIT), `navigator.clipboard` for the PWA. Nothing exists today | 2–3 d |
| **EN5** | **Matrices, vectors, lists you can enter.** Matrix template, a grid editor for stored variables, dot/cross/norm shortcuts through Find | The parser reads `pmatrix`; no key makes one. `det`, `rref`, `cross`, `eigenvals` probed OK | 5–7 d |
| **EN6** | **Number bases and bitwise.** BIN/OCT/DEC/HEX display, word size, two's complement, shifts | Giac prints no hex (`hexa(255)`, `dec2hex(255)` stay unevaluated, probed on our build); `bitand`/`bitor`/`bitxor` work. Formatter work | 3–4 d |
| **EN7** | **Everyday functions**, plain and searchable through Find: parallel `par(a,b)`, E-series nearest `eseries(24, x)`, dB/dBm/Np, interpolation, RMS, polar/cylindrical/spherical, degrees-minutes-seconds | A built-in Python/Giac library. Complex numbers, `abs`, `arg` already work | 4–5 d |

**Deferred (not scheduled):** statistics with data entry and tolerance/capability numbers; spreadsheet with CSV import; signals and control (Giac has `fft` and `ztrans`, probed OK; `bode_plot` is not in our build; numeric ODE support is **to verify**, my probe failed on argument form); parametric/polar/sequence and implicit plots; then Geometry, 3D, Explorers, Inference, Finance. RPN stays in v1.

## 6. EN0 The task benchmark: how "efficient" is tested

Latency is solved (Enter → result p95 92 ms). What decides day-to-day speed is **keystrokes per task**. Add `tests/tasks/tasks.yaml`: 25–30 realistic tasks, each written as the shortest key sequence found, with a **keystroke budget** and the right result. A Playwright test replays the sequence, checks the result and fails if the count grows. Each task also gets a hand-measured comparison column (G2, a typical phone calculator).

Start with these ten (my guesses; the owner chooses the real ones), written so that nothing depends on a discipline:

1. `4.7k ‖ 10k` (parallel combination, prefix shorthand)
2. `72 km/h → m/s` (Units app)
3. `2.2n × 4.7k` with prefix chips, against `2.2E-9 × 4.7E3` (the prefix chips must win or they go)
4. Circumference from a constant: `2π r` with r typed in mm, result in m
5. Insert the speed of light or ε₀ by name, in under 5 keys
6. Nearest E24 value to 3.87k
7. `0xFF AND 0x3C` shown in binary
8. Solve a 3×3 linear system
9. Mean and standard deviation of ten readings
10. `(12.34 ± 0.05) m × (3.2 ± 0.1) m` with uncertainty (Units app)

Plus a **query test for Find**: 100 phrases a user might type ("speed of light", "kph", "stdev", "ohm", "boltzmann") each with the expected first hit. This is what makes "everyone can find it" testable.

## 7. Precision promises (testable)

1. **No silent wrong answer:** a result is exact, or approximate and marked, or flagged (EN3 plus the existing residual check).
2. **Units are checked** where they are used (Units app): adding metres to seconds is a message, not a number.
3. **Uncertainty travels** in the Units app, first-order. Worst-case or Monte Carlo tolerance analysis would be a later add-on.
4. **The display never hides the value:** the user sees how many digits are shown and can copy all of them (EN3, EN4).
5. **Constants carry their uncertainty** (CODATA), shown in the Find preview.
6. **Every shipped number has a `source:` tag**, as the golden tests already require.

## 8. Proposed order and hand-off for Henri

| Step | Content | Est. |
|---|---|---|
| 0 | Finish what is open: K2, C5, device checks. Start **EN0** (the benchmark) beside it | days |
| 1 | **EN1** Find (functions, variables, then constants/units once the index exists) | 6–8 d |
| 2 | **EN2** Units app, prefixes, constants; worker, parser tokens, tests; owner timing test | 10–11 d |
| 3 | **EN3** precision, **EN4** copy/share | ~1 w |
| 4 | **EN5** matrices and lists, **EN6** bases | ~2 w |
| 5 | MVP release (R2–R4) with the engineer core | |
| 6 | **EN7** everyday functions | 4–5 d |
| 7 | Deferred list | |

About 7–8 weeks of shift work for steps 1–4 and 6 if the existing pace holds. That pace is unproven for features that touch the parser and keyboard, where the backlog shows many small follow-ups (L1–L9).

**Needs the owner's OK before Henri acts:**
- Amend P3 decisions 2 and 6 as in section 4 (units in their own app, search instead of pickers, Home unit-free).
- Which key opens Find (the empty Tmpl/Math cell, or the Home Menu key).
- Drop the categorised formula library (my first report's EN7).
- The ten benchmark tasks in section 6.

**Risks.** (1) Alias and ranking quality decides whether Find feels effortless; it needs real queries, not guesses. (2) Constants colliding with variable names: solved by tokens, but the chip's look must be clearly different from a variable. (3) The units index depends on libqalculate's definition files carrying usable names (**to verify** before step 2). (4) A prefix chip strip adds one more thing to the screen; it must appear only after a number and stay out of the way (principle 2).

*Files changed in this analysis: this document, the mission text (CLAUDE.md, README.md, docs/02 header) and one line in the backlog's "Needs the user". Nothing is committed.*
