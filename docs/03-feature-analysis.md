<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Feature analysis: Pascaline as a precision engineering tool

*Written 2026-10-12 (Claude, for the project owner and Henri), revised the same day after the owner's answers, then **merged with a second review** (Henri, at the owner's request: "decide based on the goal"). Base: `phase-1` at 8681313. "What is here" was checked in the code, the docs and the engine on that day. **(to verify)** marks assumptions nobody tested. Effort figures are estimates, not measurements. The plan in section 8 is the one to work from; the backlog carries its tasks and `docs/decisions.md` P8 records the decision. How each item is built is settled in [04-architecture.md](04-architecture.md) (sandra, 2026-10-12), which also corrects three statements below (marked "checked 2026-10-12").*

**Goal (user, 2026-10-13, replacing 2026-10-12):** *the G2's flow, without its friction, with precision you can trust* (rules 5–13 below; P11). **Earlier goal (2026-10-12):** not another calculator. A precision engineering tool that lets any engineer do day-to-day calculations much faster and more precisely. The mission text is in CLAUDE.md, README.md and the docs/02 header. The G2 key layout stays as the way in, not the aim.

## 0. Design rules from the owner (2026-10-12)

These bind every feature below. Henri: treat them as decisions, not suggestions.

1. **No categories by discipline.** The calculator does not ask who you are. Engineers use several disciplines, so there is no "electronics" or "civil" content split. The tool must be so easy and intuitive that anyone finds what they need, **especially units and constants**.
2. **Speed is the test for units.** Entering `nm` must beat typing `E-10` (about one second). If finding a unit takes longer than that, it has failed. Searching a long unit list for ten seconds is a waste.
3. **Units stay separate from normal calculation.** A precision tool does one or two things well, not everything. Units are decided by utility: if they make Home, Solve or lists harder, they do not go there.
4. **Focus.** Fewer features done perfectly beat parity with the G2.

### Rules added 2026-10-13 (owner, after the first days of daily use; P11)

The goal is now *the G2's flow, without its friction, with precision you can trust* (CLAUDE.md). The risk the owner named: an app that crams three open-source engines into one screen and ends up a soup where nothing is useful. These rules are how we keep that out. They bind every package, and Henri and the workers apply them before adding anything.

5. **One sentence decides.** A feature gets in only if it (a) is G2 flow, (b) removes a G2 friction the owner has actually hit (example: `=` sits on Shift while the letters are on Alpha, so typing `A=…` means leaving a mode), or (c) makes a result more trustworthy. "The G2 has it" is not enough on its own; "another app has it" is not a reason at all.
6. **G2 key sequences keep working.** A departure from the G2 is added on top of the G2 way (a flick on top of the Shift-then-key tap), never instead of it, unless the G2 way is measurably bad.
7. **One interaction model.** The screen is three zones: a thin status line, the calculation viewport, the keypad. A key is a tap, a flick up (its shift function) and a flick down (its letter). Every app has Symb / Plot / Num and Menu. The arrow keys are a trackpad that also accepts taps. Tapping a formula on the screen puts the cursor there. Anything looked up by name goes through Find. A feature that needs a new kind of gesture, a new screen zone or a new way to navigate is a red flag; the hold-and-drag cursor (K2) was one and was removed (P11).
8. **Keys never move.** Every function sits at one fixed position on the keypad, in every app and every mode, so muscle memory works. A context may change what a layer of a key does (inside a unit slot the letter layer types unit symbols), but no keypad reflows, scrolls or swaps its layout, and no on-screen element jumps up and down while typing. This is why people love the G2, and it is what Qalculate!'s phone UI gets wrong.
9. **Vertical space is precious.** The calculation viewport gets every pixel the keypad and a thin status line (one line, about 20 px) do not use. Switching views and apps lives on the keys (App, CAS, Apps, Symb, Plot, Num), not in tabs or bars on the screen. Any new on-screen element must say what it gives back for the space it takes; an e2e test keeps the viewport's share of the screen from shrinking.
10. **Nothing merges untried.** At most one UI change the owner has not used yet is in flight. A UI package ends with an APK on the owner's phone and is done only after the owner has used it for a day or two. Engine and precision work may run ahead, because tests judge it; feel cannot be tested.
11. **Every feature has a removal test, and we act on it.** Each feature states what would show it failed (as "prefix chips must beat E-notation or go"). When it fails, its code goes completely, with no dead setting left behind. First removals (P11): the hold-and-drag cursor (K2) and the Python app (the owner never uses it; a notebook on a laptop is the better tool for scripts).
12. **One feedback inbox.** The owner's points go into [feedback.md](feedback.md), dated, in the owner's words, and each becomes a bug (fixed now, regression test first), a feel item (the next feel package) or an idea (waits a week, then must pass rule 5).
13. **Win against the alternatives, or have no reason to exist.** Each benchmark task (section 6) records the hand-measured presses and time on the G2, on Qalculate! and on a phone calculator. A feature whose task Pascaline does not win gets reworked or removed. Graphing is the example: Desmos and GeoGebra are better graphers, so the Function app stays at its G2 level (quick roots, intersections and areas with checked residuals) and gets no further plot types unless a task shows a win.

## 1. Recommendation

Build an **engineer core** ahead of the Prime-parity apps, in three milestones (section 8):

- **Milestone 4, "find and trust":** EN0 task benchmark (first; it judges everything else), EN1 Find (one search for everything), EN3 honest precision, EN4 copy/share/export.
- **Milestone 5, "units":** EN2, the unit view (units after the formula, P11) with constants and uncertainty, plus SI prefixes in display (and in entry if the benchmark says so).
- **Milestone 6, "structure":** EN5 matrices and lists you can enter, EN6 number bases, EN7 everyday functions found through Find.

**Dropped:** a categorised formula library with unit-aware Solve (rules 1 and 3). The user's own functions (`f(x):=…`) are found through Find like every variable. **Deferred:** statistics with data entry, spreadsheet, signals and control, extra plot types, then the Prime-parity apps (Geometry, 3D, Explorers, Inference, Finance). **Not scheduled:** the MVP release (R2–R4); the owner said it is not a priority (2026-10-12).

## 2. What is here (checked 2026-10-12)

| Area | State |
|---|---|
| **Home** | Exact-first, 12 significant digits by default, float fallback for huge/slow cases (labelled "approximate" in the history), store ▶, variables shared with CAS, persisted history (123 golden cases). Checked 2026-10-12: the engine keeps Ans (`pasans`), but no key or parser rule reaches it, tapping a result inserts its rounded digits, and variables are not kept across a relaunch (docs/04 2.1, 6.2) |
| **CAS** | Giac, exact results in 2D; calculus (`int`, `lim`, `sum`, `prod`, `diff`), matrices parsed, `det`, lists (330 parser cases) |
| **Entry** | Textbook entry, one-line mode, decimal comma, polar `r∡θ`, insertable results (L5), trackpad on the arrow keys (K1), hold-and-drag cursor on the whole keypad (K2; removed by P11, 2026-10-13) |
| **Formats** | STD, SCI, ENG, FIX; Format key cycles the last result (also fraction, mixed, polar ⇄ rectangular) |
| **Function app** | Plot, trace, root/extremum/intersection/slope/area, Num table (56 fps on the Tab One, 89 on the Fairphone 6) |
| **Solve app** | 1-D, systems, polynomials; every root substituted back with ⚠ on a large residual |
| **Python** | MicroPython, editor, shell, graphics, `calc` reaches Giac and variables |
| **Platform and quality** | Android APK without the INTERNET permission (C5), offline PWA, no trackers; about 600 golden cases tagged by source; bit-reproducible release engine; Enter → result p95 92 ms on the Tab One |

**Designed, not built:** units/constants/uncertainty (P3, `docs/p3-units-plan.md`, amended by section 4), compact keypad (K4), reference number-format parity (G9), and everything in docs/02 section 8 (v1, v2).

**Empty today:** the Vars, Math and Tmpl keys do nothing (`special: none`, keyboard.yaml); the Home/CAS Menu key opens nothing (menus exist only inside Function, Solve, Python); there is no clipboard, share or CSV code anywhere in the app (grep, 2026-10-12).

**Engine probes (our GSL build, 2026-10-12):** `0xFF` → 255 and `bitxor(0xF0,0x3C)` → 204 (Giac reads hex input); `hexa(255)` and `dec2hex(255)` stay unevaluated (Giac prints no hex), `convert(255,base,16)` → `[15,15]`; `odesolve(sin(t*y),[t,y],[0,1],2)` → 1.82241255674 (numeric ODEs work); `bode_plot` does not exist; `evalf(1/3,40)` gives 40 digits.

## 3. EN1 Find: one search for everything

**Problem.** The engine has hundreds of commands, the unit database has 426 unit definitions (each also with SI prefixes) and the constants file 184 constants. Category menus (Math → Algebra → ...) are slow and need the user to know the taxonomy. Spelling `normald_cdf(` with alpha letters needs the exact name. Both break rules 1 and 2.

**Design.**
- **One key, one habit: the Math key opens Find** (the reference's Math key opens the functions menu, so the muscle memory fits). Inside Find the keys type letters directly; no Alpha needed. **Vars** opens Find filtered to variables (one ⌫ clears the filter). **Shift+Tmpl** opens the unit view (section 4; the reference opens units with Shift on the same key, G2 item 30). **Tmpl** opens the template list once EN5 brings templates worth listing (matrix, piecewise, Σ, ∫, ±). The **Home/CAS Menu** key holds actions on the current view (copy, share, clear history: EN4), not things to insert; Shift + View = Copy and Shift + Menu = Paste, the reference's positions. Help (r1c4) becomes context help from the index in milestone 6 (docs/04 5.1; the owner may veto).
- **Mixed results with a kind badge:** function, constant, unit, variable. Ranked by: recents and frequency first (the user's own habits), then exact name or symbol, then prefix, then alias and description words, then typo tolerance.
- **Aliases make it forgiving:** `kph` → km/h, `inch`/`in` → inch, `speed of light`/`c0`/`c` → c, `eps0`/`ε0`/`permittivity` → ε₀, `mu`/`µ` both, `ohm`/`Ω`, `degC`/`°C`. A user who types the word they think of should land on the thing.
- **Live preview, no extra tap:** a constant shows its symbol, value, unit and CODATA uncertainty; a unit shows its dimension and its factor to SI; a function shows its syntax and one example (Giac's help lines, R5 reads them as GPL-compatible, still to confirm with Parisse).
- **Insertion is a token, not text.** A constant or unit is inserted as an upright symbol chip (the P3 plan already requires explicit tokens), so `g` the constant never collides with `g` the variable and `R` is never read as röntgen. In Home, CAS and Solve a constant goes in as its number (full CODATA digits, one token); only the unit view keeps its unit.
- **Keystroke budget:** an item used before is 2 keys plus Enter (Find, first letters, Enter); a new one is the letters typed plus Enter. The benchmark enforces this (EN0).
- **Works without the units engine loaded.** Search needs only names, aliases, descriptions and values, generated at build time into a small static index, so Find is instant and does not load the 0.93 MB units worker. **Checked 2026-10-12:** libqalculate 5.13.1's `units.xml.in` (426 unit definitions; an earlier count of 982 also counted nested `<unit>` references) and `variables.xml.in` (184 constants) carry a title, all names and aliases with their kind (`a-c-r:kph,a-c-r:kmph`; `au:Ω,r:ohm,p:ohms`; `ar:c,speed_of_light`), the value with its unit and the uncertainty attribute (`G`: `uncertainty="1.5E-15"`). Giac's command list and help lines feed the function part. Our own alias file adds what a user types and the data lacks.
- **Speed:** results update within one frame per key (16 ms) on the Tab One; the index is loaded with Find, not at start (start chunk unchanged).
- **Cost:** about 6–8 days for the palette, ranking, index generation and tests (reuses the existing `PickList` component). The alias content is the real work and is tested by the query test (section 6).

## 4. EN2 Units: the unit view, plus prefixes

**Amends P3 decisions 2 and 6** (`docs/p3-units-plan.md` section 7; both accepted 2026-10-11) on the owner's rules of 2026-10-12. The engine choice (libqalculate as a lazy third worker), the build, the data checks, the `hp` patch and the tests of that plan stand.

| P3 plan | Now |
|---|---|
| Units and Constants as menu pickers | **Find** (section 3), type-ahead; no browse-by-category as the main path |
| Unit tokens allowed in Home/CAS expressions, split between Giac and qalc by a `unitEval` layer | **Units live in the unit view** (P11: slots after the numbers of a formula). The whole expression goes to qalc there. This removes the Giac/qalc split and the "mixed unit + CAS" error case (P3 risk 5) |
| Units in scalar Home expressions | Home, CAS, Solve and lists stay unit-free |
| ENG E-notation only | **SI prefixes** in display everywhere, in entry if the benchmark shows a gain (below) |

**The unit view (P11; design in docs/04 section 4.3, layout and press count in `docs/research/r7-unit-slots.md`).**
- The units key (Shift + Tmpl, the reference's position) on a line or a history row shows the same formula with an empty unit slot after every number and an optional end slot "→ should be"; on an empty line, one slot. Enter gives value, unit, dimension and mark.
- **Exact where the maths is exact.** Unit factors are exact in SI (1 in = 25.4 mm, 1 km/h = 5/18 m/s), so `72 km/h → m/s` gives exactly 20 with the `=` mark. qalc's default "try exact" mode does this (docs/04 4.1); its strict exact mode stays off (P3 decision 4). A result is marked `≈` only when qalc reports it approximate (EN3).
- A dimension mismatch is a plain message that names both dimensions, never a number. Uncertainty (`±`) with first-order propagation (P3 decision 4). Temperature offsets (°C, °F) get explicit rules and golden cases.
- **The way back:** a result goes into Home as a plain number in the unit shown (a `\res` chip), so a converted value is one step from any other calculation.

**SI prefixes (all views).**
- **Display (built):** a prefix format beside ENG shows `4.7µ` instead of `4.7E-6`. Reading is where prefixes clearly win; it is formatter work (EN3).
- **Entry (gated):** a strip of prefix chips (p n µ m k M G T) when the cursor follows a number; one tap writes `4.7 k` meaning 4700, read by the parser as an exact power of ten (one parser rule and one round-trip case per chip). `E-9` is 3 keys, a chip is 1, so the gain is small; the strip stays only if benchmark task 3 shows it wins and it does not clutter the screen (principle 2).

**The speed gate (rule 2).** A unit takes no more than 4 presses at the median (S1's paper test: 2, with flicks), and the owner times ten sample tasks by hand, E-notation against units, before units ship. If units lose on a task, the answer is better ranking or entry, not a tutorial.

**Units anywhere else: not now.** If, after the unit view is in use, a Home user wants `5 km + 300 m` directly, the same qalc worker can serve Home behind a setting. That is a later, measured decision. (Considered and set aside for v1: a units layer in our own parser for every view, with Giac computing on exact SI values. It would reach Solve and variables but goes against rule 3 and costs more.)

**Effort:** U1 build and worker 2 d, unit view and parsing 3 d, formatting and conversion 2 d, tests and device timing 1.5 d: about 8–9 days, plus the shared Find index, plus about 2 days for prefixes. Cheaper than the P3 plan's 11–12 days because the Giac/qalc split disappears.

## 5. The other gaps

| ID | Gap | Notes | Est. |
|---|---|---|---|
| **EN3** | **Honest precision.** (a) Digits up to 30 (capped at 15 in `Settings.svelte` and `session.svelte.ts` since the first shell commit, with no stated reason). (b) A mark on every Home result: `=` when the decimal shown is the exact value, `≈` when it is rounded or from floating point. (c) Copy the full value, not the displayed digits. (d) Rounding to n significant figures as a function. (e) The prefix display format (section 4). The float fallback is already labelled "approximate" in the history | The formatter already reads a 40-digit `evalf` and the fallback works at 30 digits, so (a) is golden cases at 20 and 30 digits (`oracle`) plus a Tab One timing check (Giac switches to MPFR above 14 digits). Checked 2026-10-12: (a) also needs an agreement check, because at 30 digits `UTPN(10)` and `romberg` show wrong digits from the 17th and `BesselJ`, `Airy_Ai` stop evaluating above 14 digits (docs/04 2.3–2.5) | 3–4 d |
| **EN4** | **Copy, share, export.** Copy a result (plain number, LaTeX), paste a number into the entry, share a session as text, export a Num table as CSV. In the Home/CAS Menu and on a long press of a history row | Capacitor Share/Clipboard (MIT), `navigator.clipboard` for the PWA. Nothing exists today; inside the app a result already goes back to the entry line (L5) | 2–3 d |
| **EN5** | **Matrices, vectors, lists you can enter.** Matrix template, a grid editor for stored variables, dot/cross/norm through Find | The parser reads `pmatrix`; no key makes one. `det`, `rref`, `cross`, `eigenvals` probed OK | 5–7 d |
| **EN6** | **Number bases and bitwise.** BIN/OCT/DEC/HEX display, word size, two's complement, shifts | Giac reads `0xFF` and has `bitand`/`bitor`/`bitxor` but prints no hex: formatter work, plus a literal token in our parser. Checked 2026-10-12: today the keys `0 x F F` parse as `0*x*F*F` and give 0 (docs/04 2.3 #1) | 2–3 d |
| **EN7** | **Everyday functions**, plain and searchable through Find: parallel `par(a,b)`, E-series nearest `eseries(24, x)`, dB/dBm/Np, interpolation, RMS, polar/cylindrical/spherical, degrees-minutes-seconds | Giac function definitions loaded with the engine (each with a golden case); complex numbers, `abs`, `arg` already work | 4–5 d |

**Deferred (not scheduled):** statistics with data entry and tolerance/capability numbers; spreadsheet with CSV import; signals and control (Giac has `fft`, `ztrans` and numeric `odesolve`; `bode_plot` is not in our build, plots would be ours); parametric/polar/sequence and implicit plots; then Geometry, 3D, Explorers, Inference, Finance. RPN stays in v1.

## 6. EN0 The task benchmark: how "efficient" is tested

Latency is solved (Enter → result p95 92 ms). What decides day-to-day speed is **keystrokes per task**. Add `tests/tasks/tasks.yaml`: 25–30 realistic tasks, each written as the shortest key sequence found, with a **keystroke budget** and the right result (with `source:` like a golden case). A Playwright test replays the sequence, checks the result and fails if the count exceeds the budget. Tasks that need a later milestone are listed as `pending` with their target budget, and today's best sequence (if any) is recorded as the baseline. Each task also gets a hand-measured comparison column (G2 via the Virtual Calculator, a typical phone calculator).

The first ten (the owner accepted them as the start, 2026-10-12; nothing depends on a discipline):

1. `4.7k ‖ 10k` (parallel combination, prefix entry)
2. `72 km/h → m/s` (unit view)
3. `2.2n × 4.7k` with prefix chips, against `2.2E-9 × 4.7E3` (the chips must win or they go)
4. Circumference from a constant: `2π r` with r typed in mm, result in m
5. Insert the speed of light or ε₀ by name, in under 5 keys
6. Nearest E24 value to 3.87k
7. `0xFF AND 0x3C` shown in binary
8. Solve a 3×3 linear system
9. Mean and standard deviation of ten readings
10. `(12.34 ± 0.05) m × (3.2 ± 0.1) m` with uncertainty (unit view)

Plus a **query test for Find** (`tests/tasks/find-queries.yaml`): 100 phrases a user might type ("speed of light", "kph", "stdev", "ohm", "boltzmann"), each with the expected item. Gate: every phrase finds its item in the top 3, at least 90 as the first hit. This makes "everyone can find it" testable. The owner adds real phrases whenever Find misses one.

## 7. Precision promises (testable)

1. **No silent wrong answer:** a result is exact, or approximate and marked, or flagged (EN3 plus the existing residual check).
2. **Units are checked** where they are used (unit view): adding metres to seconds is a message, not a number.
3. **Uncertainty travels** in the unit view, first-order. Worst-case or Monte Carlo tolerance analysis would be a later add-on.
4. **The display never hides the value:** the user sees how many digits are shown and can copy all of them (EN3, EN4).
5. **Constants carry their uncertainty** (CODATA), shown in the Find preview.
6. **Every shipped number has a `source:` tag**, as the golden tests already require.

## 8. The plan

Milestone 4a ("feel", P11) runs before the rest of milestone 4; status in the backlog.

The three workers own separate areas, so each milestone runs as three parallel tracks: **ron** (UI, keyboard, parser, e2e), **gorge** (engine, formatter, index data, golden), **annabell** (Capacitor, builds, devices). A milestone is done when its benchmark tasks pass within budget and its gates hold.

| Milestone | ron | gorge | annabell | Gate | Est. |
|---|---|---|---|---|---|
| **4 Find and trust** | **EN0** benchmark harness and the ten tasks (first, ~1 d); **EN1** Find UI: Math/Vars keys, ranking, preview, chips; functions and variables | **EN3** precision (digits ≤ 30, `=`/`≈`, full-value copy API, sig-fig function, prefix display format); **Find index** generator (Giac commands + help lines, qalc units/constants/prefixes, our alias file) and the 100-phrase query test | **EN4** copy/share/CSV (Capacitor plugins, PWA fallbacks, THIRD_PARTY), Home/CAS Menu actions; device APK for the owner (K1/K2 feel), L7 Tab One re-measure | Tasks 5 (constant by name) active; query test; start chunk unchanged | ~2 w |
| **5 Units** | the unit view (slots, live reading, result view), Shift+Tmpl; prefix chips behind the task 3 gate | U1–U2: qalc worker and client (from `spike/qalc`), "try exact" check, parser tokens, `tests/golden/units.yaml`, `hp` patch, data audit | qalc release build in the trixie container, size gate (+0.93 MB lazy), lazy-load test, first-unit timing on the Tab One and Fairphone 6 | Tasks 1–4 and 10; speed gate (≤ 4 keys median); owner's hand timing | ~2 w |
| **6 Structure** | **EN5** matrix/list entry and grid editor, Tmpl list | **EN6** bases formatter (and `0x…` in the parser), **EN7** everyday functions with golden cases | Device timing; F-Droid recipe (C4) if the owner wants it then | Tasks 6–9 | ~2 w |

After milestone 6: the deferred list (section 5), in the order the benchmark and the owner's use show is worth it. The MVP release (R2–R4) when the owner says.

**Decided by Henri on the owner's rules (P8), confirmed by the owner 2026-10-12:** P3 decisions 2 and 6 amended as in section 4; Math = Find, Vars = Find on variables, Shift+Tmpl = units (the unit view since P11), Menu = view actions; formula library dropped; the ten tasks above as the start.

**Risks.** (1) Alias and ranking quality decides whether Find feels effortless; it needs real queries, not guesses. (2) The chip of a constant must look clearly different from a variable. (3) The prefix strip adds something to the screen; it must appear only after a number and stay out of the way, or go. (4) qalc's "try exact" gives exact SI conversions (checked 2026-10-12), but qalc silently misreads some names (`degC`, `BTU`, `mu0`) and accepts `1 m + 1 s`; chips and an adapter handle it (docs/04 4.1, 4.3); the golden units cases decide. (5) The pace is unproven for parser- and keyboard-heavy work, where the backlog shows many small follow-ups (L1–L9).
