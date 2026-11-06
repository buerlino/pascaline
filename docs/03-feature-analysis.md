<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Feature analysis: N62 as a precision engineering tool

**What still binds:** section 0 (the owner's design rules 1–13, with the removal tests), section 6 (the task benchmark, EN0) and section 7 (the precision promises); every package applies them. Sections 1–5 and 8 (the engineer-core plan of 2026-10-12, decision P8) are built or replaced by [04-architecture.md](04-architecture.md), the backlog and the brief; their text is in git at `82b261f9`.

## 0. Design rules from the owner (2026-10-12)

These bind every feature below. Henri: treat them as decisions, not suggestions.

1. **No categories by discipline.** The calculator does not ask who you are. Engineers use several disciplines, so there is no "electronics" or "civil" content split. The tool must be so easy and intuitive that anyone finds what they need, **especially units and constants**.
2. **Speed is the test for units.** Entering `nm` must beat typing `E-9` (about one second). If finding a unit takes longer than that, it has failed. Searching a long unit list for ten seconds is a waste.
3. **Units stay separate from normal calculation.** A precision tool does one or two things well, not everything. Units are decided by utility: if they make Home, Solve or lists harder, they do not go there.
4. **Focus.** Fewer features done perfectly beat parity with the G2.

### Rules added 2026-10-13 (owner, after the first days of daily use; P11)

The goal is now *the G2's flow, without its friction, with precision you can trust* (CLAUDE.md). The risk the owner named: an app that crams three open-source engines into one screen and ends up a soup where nothing is useful. These rules are how we keep that out. They bind every package, and Henri and the workers apply them before adding anything.

5. **One sentence decides.** A feature gets in only if it (a) is G2 flow, (b) removes a G2 friction the owner has actually hit (example: `=` sits on Shift while the letters are on Alpha, so typing `A=…` means leaving a mode), or (c) makes a result more trustworthy. "The G2 has it" is not enough on its own; "another app has it" is not a reason at all.
6. **G2 key sequences keep working.** A departure from the G2 is added on top of the G2 way (a flick on top of the Shift-then-key tap), never instead of it, unless the G2 way is measurably bad. **One exception (P12, owner, 2026-10-13):** the top cluster (the Home, CAS, Symb, Plot and Num keys) may fold into the status line, as long as every view stays one action away; R15a proves it with a press count.
7. **One interaction model.** The screen is three zones: a thin status line, the calculation viewport, the keypad. A key is a tap, a flick up (its shift function) and a flick down (its letter). Every app has Symb / Plot / Num and Menu. The arrow keys are a trackpad that also accepts taps. Tapping a formula on the screen puts the cursor there. Anything looked up by name goes through Find. A feature that needs a new kind of gesture, a new screen zone or a new way to navigate is a red flag; the hold-and-drag cursor (K2) was one and was removed (P11).
8. **Keys never move.** Every function sits at one fixed position on the keypad, in every app and every mode, so muscle memory works. A context may change what a layer of a key does (inside a unit slot the maths rows become the unit pad, P14), but no keypad reflows, scrolls or swaps its layout, and no on-screen element jumps up and down while typing. A sheet drawn over the keypad for a moment (a menu, a palette, Settings; decisions.md "R21") moves no key: the keypad under it stays as it is and comes back as it was. This is why people love the G2, and it is what Qalculate!'s phone UI gets wrong.
9. **Vertical space is precious.** The calculation viewport gets every pixel the keypad and a thin status line (one line, at most 28 px) do not use. Switching views and apps lives on the status line (it shows where you are; the place opens Apps, so Home ↔ CAS is 2 taps; R15c1), not in tab rows or extra bars. Any new on-screen element must say what it gives back for the space it takes; an e2e test keeps the viewport's share of the screen at or above 0.35 on a Pixel 7 (412 × 915; 0.354 after R8; `app/test/status.spec.ts`).
10. **One package at a time.** Packages go one at a time, in the brief's order, and the next starts as soon as the review has merged the one before.
11. **Every feature has a removal test, and we act on it.** Each feature states what would show it failed (as "prefix chips must beat E-notation or go"). When it fails, its code goes completely, with no dead setting left behind. First removals (P11): the hold-and-drag cursor (K2) and the Python app (the owner never uses it; a notebook on a laptop is the better tool for scripts).
12. **One feedback inbox.** The owner's points go into [feedback.md](feedback.md), dated, in the owner's words, and each becomes a bug (fixed now, regression test first), a feel item (the next feel package) or an idea (waits a week, then must pass rule 5).
13. **Win against the alternatives, or have no reason to exist.** Each benchmark task (section 6) records the hand-measured presses and time on the G2, on Qalculate! and on a phone calculator. A feature whose task N62 does not win gets reworked or removed. Graphing is the example: Desmos and GeoGebra are better graphers, so the Function app stays at its G2 level (quick roots, intersections and areas with checked residuals) and gets no further plot types unless a task shows a win.

## 1. Recommendation
Built or superseded; see docs/04 section 0 and decision P8 (text in git at `82b261f9`).

## 2. What is here (checked 2026-10-12)
Built or superseded; see docs/04 section 8 and [research/r6-pipelines.md](research/r6-pipelines.md) (text in git at `82b261f9`).

## 3. EN1 Find: one search for everything
Built or superseded; see docs/04 section 3 (text in git at `82b261f9`).

## 4. EN2 Units: the unit view, plus prefixes
Built or superseded; see docs/04 section 4 (text in git at `82b261f9`). This section amended P3 decisions 2 and 6 (`archive/p3-units-plan.md` section 7): units and constants are found through Find, not menu pickers; units live in the unit view, and Home, CAS, Solve and lists stay unit-free; SI prefixes in display (prefix entry: decisions.md "Prefix entry"). Still binding, word for word:

**The speed gate (rule 2).** A unit takes no more than 4 presses at the median (S1's paper test: 2, with flicks), and the owner times ten sample tasks by hand, E-notation against units, before units ship. If units lose on a task, the answer is better ranking or entry, not a tutorial.

## 5. The other gaps
Built or superseded (text in git at `82b261f9`). The labels: EN0 the task benchmark (section 6), EN1 Find (docs/04 section 3), EN2 units (docs/04 section 4), EN3 honest precision (docs/04 sections 2.4–2.5), EN4 copy, share and export (docs/04 section 2.6), EN5 matrices and lists (docs/04 section 5.3), EN6 number bases (docs/04 section 5.4), EN7 everyday functions found through Find.

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
Built or superseded: the order of work is docs/shifts/brief.md section 0 with [backlog.md](backlog.md), the gates are docs/04 section 7.3, and the decision is P8 (text in git at `82b261f9`). Still binding, word for word: "A milestone is done when its benchmark tasks pass within budget and its gates hold." and, from its risks, "The chip of a constant must look clearly different from a variable."
