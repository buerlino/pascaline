<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Brief for sandra: settle the architecture for the precision-engineering goal

You are **sandra**, Pascaline's researcher (you wrote R1 and R3 in `docs/research/`). This is a solo, read-and-probe task: no feature code, no commits, no pushes, no devices. Your output is one document that settles the architecture so that the workers (ron, gorge, annabell) can build milestones 4–6 without another design round, plus the doc fixes that make every other doc agree with it.

## 1. Why this task exists

On 2026-10-12 the owner changed the product goal. Pascaline is no longer "a calculator that feels like an HP Prime G2". It is **the most efficient and most precise calculation tool an engineer can carry**. The G2 key layout is the way in, not the aim. Two reviews and the owner's answers were merged into decision **P8** (the engineer core). The architecture document (`docs/02-architecture-plan.md`) was written for the old goal on 2026-10-10 and has only a header note about the new one. Several pieces are now decided at feature level but not at architecture level, and some older decisions may quietly work against the new goal.

**Your job: go through every part of the architecture, every module, data flow, interface, budget, build step and test gate, and decide how each one serves the goal. Where a choice is still open, settle it. Where an existing choice works against the goal, show the evidence and propose the change. Leave nothing at "to be decided later" unless it genuinely depends on a measurement that cannot be made yet; then name the measurement, who makes it and what result picks which option.**

## 2. What binds you

Read these first, in this order. They are binding; do not reopen them, but do flag (with evidence) any point where one of them conflicts with the goal or with another.

1. `CLAUDE.md`: the goal, the **three principles** (open source and reuse first; speed and efficiency; precision you can trust), the non-negotiable legal, F-Droid and maths-correctness rules, the stack.
2. `docs/03-feature-analysis.md`: the owner's **design rules** (section 0: no split by discipline; a unit must beat typing `E-10`; units stay separate from normal calculation; focus over G2 parity), Find, the Units app, the gaps EN0–EN7, the task benchmark, the plan (section 8).
3. `docs/decisions.md`: **P8** (the roadmap, key assignments, units decision, what was set aside and why), P3 and its amendment, P5, P7 and the Phase 1 defaults. Phase 0 decisions D1–D9, P1, P2 in `spike/DECISIONS.md` and `spike/RESULTS.md`.
4. `docs/02-architecture-plan.md` (the old plan; the structure you are revising), `docs/p3-units-plan.md` (amended by P8), `docs/backlog.md` (state and tasks), `docs/01-feasibility-report.md` section 3 (legal, binding).
5. `docs/research/` (R1–R5 and the rest), `docs/cleanup-audit-2026-10-12.md`, the shift reports in `docs/shifts/` (latest: `2026-10-12-night-report.md`), `CONTRIBUTING.md`, `THIRD_PARTY.md`, `spec/keyboard.yaml`, `tests/golden/README.md`.

Rules for your evidence:
- **Check claims in the code, the engine and the data, not in the docs.** Docs drift. For every statement of "how it works today", cite `file:line` or a probe you ran. Mark anything you did not verify **(to verify)**, and say how to verify it.
- **Never invent expected values or reference behaviour.** Same `source:` discipline as the golden tests: `device`, `virtual-calc`, `oracle`, `derived`, `assumed`.
- You may run: `node engine/giac/smoke.mjs '<expr>' ...` (engine built in `engine/giac/_out/gsl`), the qalc spike (`spike/qalc/`, built tree in `../pascaline-deps/qalc-spike/`; read `spike/qalc/build-wasm.sh` and `smoke.mjs` first), the app tests (`cd app && npm run typecheck && npm test`), the oracle (`tests/golden/.venv`). Heavy builds take the host-cpu lock (`tools/devlock.sh`, see `tools/README.md`); do one only if a decision really needs it, and say so in your report. No device work: devices belong to annabell.
- Clean room: nothing from HP or Moravia, no NumWorks code. Behaviour of the reference only from `tests/golden/g2.yaml` and the mapping in `spec/mapping/`.
- The owner wants **one recommendation with plain reasons**, not option tables. When you weigh alternatives, give each one a sentence in an "alternatives" line, then decide.

## 3. What to settle

Go through all of it. The questions below are the minimum, not the boundary. Anything you find that is not listed, add.

### 3.1 The goal as a test
- For each module (keyboard, entry/MathLive, parser, engine client and workers, Home evaluation, formatter, history/state, Function, Solve, Python, PWA/Capacitor shell, build), state in two or three lines how it serves "faster" and "more trustworthy", and whether anything in it works against either. Name concrete costs: bundle bytes, start-up milliseconds, keystrokes, places where a wrong number could appear unmarked.
- Define **"efficient"** and **"precise"** operationally: the measures, the budgets and the test that enforces each (the task benchmark, the Find query test, latency bars, golden gates). Fill in what is missing.

### 3.2 Precision chain, end to end
- Trace a number from key press to screen to clipboard for every path: Home exact, exact-big, float-big, float-timeout, float-error, numeric (Solve), CAS exact and approximate, Function Num and Plot (JS evaluators from `emit-js.ts`: doubles), Python (`calc.eval`, `calc.cas`), and later the Units app. For each: working precision, where rounding happens, what the user sees, whether it is marked.
- Settle the **`=`/`≈` mark** (EN3): its exact definition per path, where it is computed (engine or app), how it is shown, and its golden cases.
- Settle **digits up to 30**: what changes in `workDigits`, the 40-digit `evalf` in `homeEval.ts`, `tieRisk`, Solve's 30-digit residual check, the Num table, settings migration (`session.svelte.ts` clamps to 15), and the latency cost (Giac switches to MPFR above 14 digits; give a measurement plan for the Tab One).
- Settle **"copy the full value"**: is it the exact rational, a 40-digit decimal, the displayed text? Per path, and for complex results and lists.
- Settle the **SI prefix display format** (which prefixes, `µ` vs `u`, when it falls back to E notation, interaction with digits) and whether **prefix entry** can be parsed without ambiguity against variables (`4.7k` vs a variable `k`): the token design and the parser rule.
- Is there any path today where a wrong or unrounded value can reach the user without a mark? List each one with a proof (input, output) and a fix.

### 3.3 Find (EN1)
- **Where it runs:** main thread or worker; the per-key budget (16 ms on the Tab One) and how to measure it.
- **The index:** its schema (id, kind, names, aliases, title, description, syntax, example, value, unit, uncertainty, dimension, insert action), its format and size budget, when it loads (with Find, never at start), and how it is **generated at build time from source** (Giac's command list and help lines; libqalculate 5.13.1 `units.xml.in`, `variables.xml.in`, `prefixes.xml.in`, checked usable on 2026-10-12; our own alias file). F-Droid: no generated data in git unless it is our own source; the generator runs in `build.sh`. Licences: libqalculate data GPL-2.0-or-later, Giac help per R5; what THIRD_PARTY.md must say.
- **Live entries:** user variables and user functions (`f(x):=…`), Python names if any. How they get into the index and stay current.
- **Ranking:** the algorithm, how recents and frequency are stored (IndexedDB? settings?), typo tolerance, tie-breaking. Pick a library or our own code by measurement (principle 1 vs size and speed).
- **Insertion:** how a constant or unit chip is represented in MathLive (macro, `\mathrm{const:ID}`?), the parser rule, what Home receives for a constant (exact CODATA value as an exact rational? the uncertainty dropped or kept?), how the history shows it, and how a chip looks unlike a variable.
- **i18n:** aliases and descriptions in other languages later; the structure must allow it now.
- **The query test:** where it lives, the 100 phrases (propose the first set, owner-independent), the gate.

### 3.4 The Units app (EN2, P3 as amended)
- The `UnitEngine` interface (P3 section 1), worker lifecycle, lazy load, cancel, memory on a low-end device with three workers (Giac, Python, qalc) alive.
- **Exactness:** verify with the qalc spike whether its default "try exact" approximation gives `72 km/h → m/s` = 20 exactly, `1 in → mm` = 25.4 exactly, and how qalc reports "approximate". Settle the mapping to our `=`/`≈` mark and the working precision.
- Entry grammar of the Units app (number, unit suggestions, `→`, `±`, constants), its parser (our P1 parser with unit tokens, or qalc's own parser behind a whitelist?), and its result model (value, unit parts, dimension, uncertainty, approximate flag) through **our** formatter.
- Temperature (absolute vs difference), logarithmic units (dB, Np), angles (is rad a dimension?), currency (must be off: no network).
- The "last target per dimension" memory: where stored, how dimensions are keyed.
- **The way back to Home:** what number crosses (exact? which unit?), and how `Ans` behaves across apps.
- Size and start budgets; the test that plain maths never loads the chunk.

### 3.5 Keyboard and entry
- The key assignments of P8 (Math = Find, Vars = Find on variables, Shift+Tmpl = Units app, Tmpl = templates, Menu = view actions, Help free) against `spec/keyboard.yaml`, the reference's logical layout (P4) and the Alpha letters on those keys (A, B, C). Settle every conflict and every free cell (Help, View, freed arrow cells after K3).
- Keystroke counting rules for the benchmark (does Shift count? a hold-drag? letters typed in Find?).
- Matrix and list entry (EN5): MathLive matrix environments, growing a matrix, the grid editor, where stored matrices live, parser rules and round trips.
- Number bases (EN6): is a base a display mode, a property of a value, or a function result? Word size and signedness as state; `0x…` and `0b…` through our parser (verify today's behaviour).

### 3.6 Engine, workers and state
- Re-check the worker topology (Giac, Python, later qalc), the `MathEngine` contract, cancel semantics and the restore-state rule against the new features. Does anything new need the engine on the main thread? (It must not.)
- State and persistence: settings schema and migration, history entries (what they store now; what Units results and `=`/`≈` add), variables shared between Home, CAS, Solve and Python, Find recents. One storage plan.
- Start-up: the start chunk (142.6 kB after K2), MathLive (808 kB after the keypad), the lazy chunks (Python, Find index, qalc). Settle a byte and millisecond budget per chunk and the test that enforces it.

### 3.7 Build, licences, F-Droid, tests
- `build.sh`, the release container (P2) and the F-Droid recipe with the qalc engine and the index generator added: inputs pinned and SHA-checked, outputs reproducible, nothing prebuilt in git.
- THIRD_PARTY.md and licence compatibility for every new piece (libqalculate, libxml2, the Capacitor clipboard and share plugins, any search library).
- The full test plan per milestone: golden files (new `units.yaml`), parser round trips, the task benchmark (`tests/tasks/tasks.yaml`), the Find query test, e2e, size and start tests, the engine gate. Which gate blocks a merge, which blocks a release.

### 3.8 The docs
- List every place where a doc contradicts P8, the new goal, the code or another doc (docs/02 sections on Home units, menus, v1 order; keyboard.yaml comments; CONTRIBUTING.md; README.md; backlog wording). Fix them in the docs as part of your work (docs only, no code), and list each fix in your report.

## 4. Deliverables

1. **`docs/04-architecture.md`**: the settled architecture for the goal. It supersedes `docs/02-architecture-plan.md` wherever they differ (add a header note to docs/02 saying so). Structure it by area (3.1–3.7). For each area: **today** (verified, with `file:line` or probe), **decision** (one, with the reason in plain words), **alternatives** (one line each), **budgets and gates** (numbers and the test that enforces them), **risks** and **what would change it**. End with a component diagram (text), an interface list (every async interface with its methods and result types), and a table of budgets.
2. **Decisions you could not settle yourself**: append them to `docs/decisions.md` under "Needs the user" as proposals in the existing style (recommendation first, why, cost), and add one line each to backlog "Needs the user". Keep this list short; settle what the goal and the owner's rules already decide.
3. **Backlog tasks**: refine the engineer-core tasks in `docs/backlog.md` so that each one names its worker, its files, its tests and its gate, in the order the architecture requires. Do not change milestone scope without saying why.
4. **The doc fixes** of 3.8.
5. **A short report** in `docs/shifts/2026-10-12-sandra-architecture-report.md`: what you verified, what you changed in which file, what is still (to verify) and how, and the top five risks to the goal.

Do not commit. Henri reviews your changes and commits with the owner's OK.

## 5. Definition of done
- Every statement about today's code has a citation or a probe; every open item names the measurement that closes it.
- Every module and interface of the app appears in `docs/04-architecture.md` and is judged against the goal.
- No doc contradicts another or the code on any point you touched.
- A worker can start milestone 4 from the backlog and docs/04 alone, without asking a design question.
