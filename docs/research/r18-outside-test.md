<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# R18: the outside test, two 30-minute rounds

**Status (2026-10-21): reference.** The script and sheet of the owner's two outside rounds (backlog "Needs the user" 7); what they wait for is decided (decisions.md S8: R70 first, A23).

*sandra, 2026-10-20, package S8 (deep-dive item 24). The package named this note `r12-outside-test.md`; r12 is already [r12-evidence.md](r12-evidence.md) (docs/README.md:21) and r16 is in use, so it is R18. The printable sheet is [../mockups/outside-test.html](../mockups/outside-test.html). Nothing here changes the app.*

**Why.** Every press count so far is ours: the benchmark (`tests/tasks/tasks.yaml`) replays the shortest sequence *we* found, and the Find query test (`tests/tasks/find-queries.yaml`) holds phrases *we* guessed. Rules 1, 2 and 13 of docs/03 promise more: anyone finds units and constants, a unit beats E-notation, and each task wins against the alternatives. Only people who have never seen the keys can show where that fails: the words they type, the key they look for, the place they stop. Three people per round are enough to find the big problems; this is not a statistic and no gate hangs on its numbers.

## 1. Who and when

- **Testers:** three engineers or engineering students per round who have not seen Pascaline's keys, from at least two fields (for example electrical and mechanical, or civil and process). Whether they know the G2 is noted, not a reason to exclude anyone.
- **Round 2 takes three new people** where the owner can find them: someone from round 1 has seen the keys. If one comes back, the sheet says "seen" and their numbers are read apart.
- **Round 1:** after R4b (Find with Vars and the user keys) is merged and in an APK. It tests the tasks that can be done some way without units, and the Find words.
- **Round 2:** after R24c (the unit view with the unit pad) and **before R24d sets the user cells**, so the testers' units can still move cells. It adds the unit tasks (t02, t04, t10) and five units on the pad.
- **Where:** in person, 30 minutes per tester, one tester at a time, on one phone the owner holds ready (section 4).

## 2. What they do (30 minutes)

| Minutes | Part | Round 1 | Round 2 |
|---|---|---|---|
| 0–3 | Introduction (the script in section 3), the three questions about the tester | yes | yes |
| 3–18 | **Tasks**, read out by the owner, done in any way the tester likes | t01, t02, t03, t04, t05, t06, t08, t09 | all ten; t07 only if number bases (EN6) are built |
| 18–24 | **Ten Find queries**: the owner shows Math → Find once, then reads each description; the tester types their own words | yes | yes, same ten |
| 24–27 | **Five units on the pad** from the printed list (section 2.3) | no | yes |
| 27–30 | Three closing questions (section 3) | yes | yes |

Each task and query has a **cap of 2 minutes** (tasks) or **45 seconds** (queries): at the cap it is a miss and the next one starts. The owner does not help with keys during the round; after the last question the owner may show the shortest ways.

### 2.1 The tasks

Read out in engineering words, never in keys (the sheet's left column). The expected results come from `tasks.yaml` with its `source:` tags; "text" is what Home shows at 12 digits.

| Task | Read out | Result to check | Source | Round 1: the way that exists |
|---|---|---|---|---|
| t01 | Two resistors, 4.7 kΩ and 10 kΩ, in parallel: total resistance? | 3197.27891156 | derived (470000/147) | `par` from Find, or 1/(1/a+1/b) |
| t02 | 72 km/h in m/s | 20 | derived | 72 ÷ 3.6 (round 2: the unit view) |
| t03 | RC time constant of 2.2 nF and 4.7 kΩ, in seconds | 1.034E-5 | derived | E-notation |
| t04 | Circumference of a circle of radius 25 mm, in metres | 0.157079632679 | oracle | 25E-3 by hand (round 2: mm in a slot) |
| t05 | The speed of light, put in by name without typing its digits | 299792458 | derived | Find |
| t06 | The nearest E24 resistor value to 3.87 kΩ | 3900 | derived | `eseries` from Find |
| t07 | 0xFF AND 0x3C, shown in binary | 111100 | derived | none (EN6); skipped |
| t08 | Solve x+y+z=6, 2x−y+z=3, x+2y−z=2 | x=1, y=2, z=3 | derived | the Solve app or `solve` from Find |
| t09 | Mean and standard deviation of the ten readings on the sheet | 9.81 and 0.0182574185835 (sample) | oracle | `mean`, `stddevp` from Find |
| t10 | (12.34 ± 0.05) m × (3.2 ± 0.1) m, with its uncertainty | 39.5 ± 1.2 m² | derived | none; round 2 only |

A result that is right in another unit or form (t04 as 157.08 mm, t09 as the population value 0.0173205080757) counts as right and gets a note: it says what the tester expected.

### 2.2 The ten Find queries

The owner reads a description that avoids the item's name; the tester types whatever they would search for. These ten have ids in `find-queries.yaml`, so a missed word becomes a new phrase for the query test with its expected id.

| # | Read out | Expected item |
|---|---|---|
| Q1 | The constant in E = m·c² | `const:c` |
| Q2 | The number of particles in one mole | `const:N_A` |
| Q3 | The charge of one electron | `const:q_e` |
| Q4 | The constant R in pV = nRT | `const:gas_constant` |
| Q5 | The constant in F = G·m₁·m₂ / r² | `const:G` |
| Q6 | The constant ε in C = ε·A / d, for vacuum | `const:epsilon_0` |
| Q7 | The spread of a set of readings (the n − 1 kind) | `fn:stddevp` |
| Q8 | How many ways to choose 3 items out of 10 | `fn:comb` |
| Q9 | The remainder of 17 divided by 5 | `fn:irem` |
| Q10 | The total of two resistors side by side | `fn:par` |

Find has no usage boost and stores nothing (docs/04 3.5), so one tester's searches cannot change the next tester's order.

### 2.3 Five units on the pad (round 2)

On an empty line the owner shows the units key once (Shift, Tmpl, or a flick up on Tmpl: one slot opens); the tester types each unit from the list, reads the line under the slot, and clears it with ⌫. Presses are the plan from `spec/unit-pad.yaml` (derived: each pad press counts 1, docs/04 5.2), with flicks and with the G2's taps:

| Unit | Pad presses (flicks) | Taps only | What it tries |
|---|---|---|---|
| mm | 2: m (key 1, prefix), m (key 9) | 2 | the prefix m against the metre m |
| µF | 2: µ (key 2), F (ln) | 2 | a prefix on an electrical cell |
| psi | 1: flick down on Pa (+) | 2: Alpha, Pa | a flick down |
| °C | 1: flick up on K (space) | 2: Shift, K | a flick up |
| km/h | 4: k (key 4), m (key 9), per (÷), h (flick up on s, key 3) | 5 | a compound; `h` on key 4's flick down is the hecto prefix, not the hour |

The plan sums to 10 presses with flicks, 13 with taps. A unit the tester cannot place within 45 seconds is a miss, and the cell they looked at first is the most useful note of the round.

## 3. The script

**Before the start** (owner, in their own words): "This is a calculator app for engineers that I am building. We are testing the app, not you; when something is hard, the app is wrong. Please think aloud. I will not help with keys until the end. I keep no names; I write down your field and what you press. Nothing you type leaves this phone, and I clear it when you are done."

**About the tester (written as a code, never a name):** T1, T2, T3 per round; the field; student or engineer (years); the calculator they use most (G2, other graphing calculator, scientific, phone, computer).

**At the end:** (1) Which task felt slowest, and why? (2) What did you look for and not find? (3) Would you use this for work, and for what? Their answers go down in their words.

## 4. The owner's set-up

**Before round 1 the owner prints** the sheet (`docs/mockups/outside-test.html`, opened in a browser and printed on A4, one page): one copy per tester to write on, plus one clean copy the testers read the numbers from (t09's readings, the equations). For round 2 the same, with the round box ticked.

**And installs** the APK of `phase-1` with R4b merged (`./build.sh`, `dist/pascaline.apk`; round 2: with R24c) on one Android phone that is **not the owner's daily copy**, because the reset below wipes it. Nothing else is needed: the time is read from any watch or clock.

**Before each tester:**
1. Android Settings › Apps › Pascaline › Storage › **Clear storage**. This empties the history, variables, user keys, settings and the tap counter, so every tester starts from the shipped state.
2. Open the app, wait until the keypad works, put it in Home with an empty line.
3. Flight mode on (section 5).

**While the tester works, per task** the owner writes on the sheet: the time from "go" to the result on the screen (or the cap), a tally stroke for every press (docs/04 5.2: a tap, a flick, a tap on the screen, Shift and Alpha each count 1), a stroke under "miss" for every wrong press undone (⌫, Esc, Cancel), whether the result is right, and in the notes the key or screen where they stopped for more than about three seconds and what they said. For the Find queries: every word they typed, in order, and the place of the right item when they picked it (or "not found").

**Presses: the honest limit.** The tap counter in Settings (`app/src/state/taps.svelte.ts`, shown by `app/src/views/modeSheet.ts:169-175`) counts only taps on Shift and Alpha (`app/src/App.svelte:533-537`), not every press. So in round 1 the presses are the owner's tally, good to about one press in a short task. Section 6 proposes a counter of every press before round 1; with it, the owner reads the count after each task and resets it, and the tally becomes a check. The Shift and Alpha counts are worth reading either way: after a tester they show how often a newcomer uses the one-shot taps instead of flicks (P7 point 4).

## 5. Privacy

- **No names are kept.** The sheet holds a tester code, a field and a calculator; the notes hold what was pressed and said about the app. No photos, no video, no audio.
- **No data leaves the phone through the app:** the APK asks for no INTERNET permission (`android/app/src/main/AndroidManifest.xml:41` declares only VIBRATE; the merged manifest of the built APK **(to verify)**: annabell, `aapt2 dump permissions dist/pascaline.apk` lists no INTERNET), and the tap counter stays on the device (`taps.svelte.ts:2-3`).
- **Android's own backup is off:** the manifest sets `android:allowBackup="false"` (`android/app/src/main/AndroidManifest.xml:5`, A23, decisions.md S8), so Android copies none of the app's data to the phone's Google backup; the app's own backup file (S6) is the one way out, and only when the owner saves one.
- **The owner takes the notes** on paper; what goes into the repo is the summary in section 7, with tester codes only. The paper sheets stay with the owner.

## 6. Two things decided before round 1

Both are decided (decisions.md S8, the owner, 2026-10-20): the counter is R70, the manifest change A23 (merged).

1. **A counter of every press (recommended).** Make the tap counter count every press as docs/04 5.2 defines it (key taps, flicks, screen taps), shown in Settings beside the Shift and Alpha rows, with the same reset; a ron package of about half a day, one concern, on the device only. Why: the press count is the measure the rules judge by (rule 13), and a tally of a 50-press task (t09) is unreliable. Cost: one more number in Settings and a counter call in `press()`. Else: the owner's tally alone (section 4). Would change if: round 1 runs before the package can be built.
2. **`allowBackup="false"` (recommended).** One attribute in the manifest (annabell). Why: "no data leaves the phone" should hold without flight mode, for the testers and for every user; the app's own backup file (S6, R11) is the way to move data. Cost: Android's phone-to-phone transfer no longer carries Pascaline's history. Else: flight mode and clear storage, as section 5 says. Would change if: annabell shows the WebView data is not in Android's backup at all.

## 7. What comes back

After each round the owner (or the next sandra package with the owner's sheets) adds a dated section to [../feedback.md](../feedback.md), "## <date> (outside test, round N)", with:

- **One row per point**, marked "outside" and the tester code, in the tester's words where it is a quote: `| 56 | outside, T2 (civil): looked for °C under Shift on the 0 key | feel |`. Triage as for every row (rule 12): bug, feel, idea or decided.
- **One summary table:** per task, the median time and presses of the three, the misses, the number who got it right, and the budget from `tasks.yaml`; per query, the words typed and whether Find had it first, in the top 3, or not at all; per unit (round 2), the presses against the plan.
- **New phrases:** every word a tester typed that did not bring the expected item into the top 3 becomes a row in `find-queries.yaml` with `note: "outside, round N"` (a gorge package adds the alias in `find/` so the query test passes).

How to read it (defaults, not gates): a task that two of three testers miss or take more than twice its budget becomes a feel item; a query that two of three cannot find becomes aliases; a unit that two of three place wrong moves its cell before R24d, or becomes a user-cell default; and a part where all three are fast is evidence that the design holds, with nothing to do.

## 8. Risks

- **Too few people for numbers.** Three per round finds problems, it does not measure them; the medians are notes, the benchmark stays the gate.
- **The owner's presence.** Testers try harder and ask more when watched; the script asks them to think aloud and the owner stays silent until the end.
- **Order effects.** The tasks come before the Find block, so whether a tester finds Find at all is seen in t05, t06 and t09; the Find block then teaches it. The order is fixed, so testers can be compared.
- **The tally.** Without the press counter (section 6), press counts on long tasks are approximate; the times and misses are not affected.
