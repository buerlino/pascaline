<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# R13: results mode on the View key (P16)

**Status (2026-10-21): decided.** decisions.md P16 and S9 (2026-10-18): results mode on the View key's tap; package R53.

*sandra, 2026-10-18, package S9. Base: `phase-1` at 5a3f4b1 (layout D in `spec/keyboard.yaml`; R15c is decided and not built yet). The owner's idea (feedback.md #19): "a button makes the keypad collapse to the bottom with a small slice showing; tapping the slice brings it back. In this mode the viewport gains buttons to really work with the results, like a Jupyter notebook: delete, copy, move, merge, unit check, draw in Plot, and more later." P16 (decisions.md, 2026-10-18) put it on View's tap. This note gives the shape, checks it against docs/03 rules 7, 9 and 11, and holds R53's package text.*

**Evidence:** the code at the lines cited, and `tools/probes/results-geometry.mjs` (new): Playwright at the Pixel 7 profile that `app/test/status.spec.ts` uses (412 × 839 CSS px), `?engine=fake`, plus the press counts of `tests/tasks/tasks.yaml` under docs/04 5.2. Rerun: `node tools/probes/results-geometry.mjs` (about 20 s; `--counts` for the counts alone).

## In short

View's tap slides the keypad down until only a **44 px slice** is left. The viewport goes from 297 px to 767 px (share 0.354 → 0.914, about 5.4 more rows of stacked fractions). In this mode **a tap on a history row picks it**, and the picked row gets **R11's action line** (the line that already exists), with **six buttons instead of five**: Insert, Recall, Copy, Store ▶, Delete, and the new **Plot**. Insert, Recall and Store ▶ bring the keypad back, because they put something on the line. The slice, Esc and Android back bring it back too. Move, merge and unit check are defined below and wait: merge gains nothing over today's touch path, move changes nothing that is computed, and unit check needs the unit view (R24c). A counter on View and on each action decides after two weeks whether the mode stays.

## 1. The shape

### 1.1 The slice

Measured today (probe, Pixel 7 profile): window 839 px, status line 28, viewport (`.screen`) 297, of which 80 px are the entry line, and the keypad 514 px (`.keys`, `app/src/App.svelte:662`). The keypad is a grid with 8 px padding and 6 px gaps (`app/src/keyboard/Keypad.svelte:318-319`). It has three cluster rows of 36 px (`Keypad.svelte:377`, `:392`) and seven maths rows of 48 px (`Keypad.svelte:334`). A picked row adds R11's action line, 52 px, inside the viewport. The keypad does not move for it (`app/test/rows.spec.ts:142-149`).

- **Height: 44 px**, the smallest touch target docs/05 3.3 allows. The keypad gives back 514 − 44 = **470 px**. The viewport becomes 767 px (share **0.914**). An 8 px grip would give 506 px, but it is too small to hit. A slice holding a live row 0 of the cluster (48 px) would make "a tap on the slice" sometimes a key and sometimes the way back, which goes against the owner's words.
- **What it is:** the keypad's own top edge, in the keypad's panel colour, with a centred grip and the label "Keys" (i18n, `aria-label` "Show the keypad"). The keypad slides down as one piece, so no key moves relative to another (docs/03 rule 8). It never reflows. It is the keypad zone made small, not a new zone (rule 7). The slide lasts at most 120 ms and is off under `prefers-reduced-motion` (docs/05 2 rule 6).
- **A tap anywhere on the slice brings the keypad back.** Shift and Alpha keep their state (the status line shows them, `App.svelte` header). A picked row stays picked, so its line goes back to R11's five buttons.
- **Never automatic, never stored:** only View collapses the keypad (P7 point 5). A reload starts with the keypad up.
- **Where:** Home and CAS only in R53. In an app, View stays a dead key for now (see 1.4).

### 1.2 Leaving the mode without the cluster

While the keypad is collapsed, Esc and View are hidden: View is row 1, column 4 today and moves to row 0 under R15c, and Esc moves to row 0, column 5 under R15c. So the way out must not need them:

- **Tap on the slice:** the keypad comes back.
- **Android back:** the mode opens one back layer, as a sheet and the Settings page do (`openLayer`, `app/src/input/backLayer.ts:48`; the existing uses are `App.svelte:211` and `:215`). Back brings the keypad back. Back with a sheet open closes the sheet first, because that layer opened later.
- **A hardware Escape:** this is the Esc key (R15c point 3). Today it is `entry.onEscape → cancel()` (`App.svelte:63`, `:151`). It does Esc's jobs in order: stop a running job, close a sheet level, drop a picked row. When none of them applies, it brings the keypad back instead of clearing the line.
- **An action that needs the line** (Insert, Recall, Store ▶): it runs, and the keypad comes back with the cursor waiting.
- **Not a way out:** typing on a hardware keyboard. It goes to the entry line as now (`entry.onKey`, `App.svelte` `onMount`), and the keypad stays down, because whoever types on a hardware keyboard does not need it.

### 1.3 The picked row and its one action line

What exists:
- With the keypad up, ▲ on an empty line picks the last row (`historyKey`, `App.svelte:316-323`). ▲ and ▼ walk the rows, Enter inserts, Esc drops the pick, Menu opens the row's list, and Copy copies (`:339-346`). Any other key drops the pick (`:338`).
- The picked row's buttons are **one line above the entry line** (`App.svelte:635-636`). They are items 1–5 of the Home/CAS Menu's fixed list (`ClipActions.rowButtons`, `app/src/clipboard/actions.svelte.ts:226-228`): Insert, Recall, Copy, Store ▶, Delete (`:207-216`). Then come Copy as, Paste, Share and Clear (`:218-221`).
- A long press on a finished row opens all nine on that row (`app/src/views/History.svelte:38`, `actions.svelte.ts:236-239`).
- A tap on a row's input recalls it, and a tap on its result inserts it (`History.svelte:142`, `:162`; `App.svelte:616-617`).

**Results mode changes three things and adds no new bar:**

1. **A tap on a row picks it**, on its input or its result. With the keypad down there is nothing to type into, so recall and insert would leave the user stranded. The tap picks, and the line offers Insert and Recall, which bring the keypad back. The long press stays as it is. ▲ and ▼ from a hardware keyboard pick as before. With the keypad up, taps keep today's meaning.
2. **The same line shows six buttons, not five:** `menu(row).slice(0, 6)`. At 412 px six buttons are about 60 px wide each, which holds labels of up to 8 characters (docs/05 3.3). The line stays one line above the entry line, for the picked row only, never a bar per row.
3. **A sixth action, Plot,** goes into the Menu as item 6 (below), so the soft-key rule of docs/05 3.3 holds: the buttons are the Menu's first items, in the same order.

**The owner's six, against what R11 gives:**

| Owner's word | Today (R11) | In results mode |
|---|---|---|
| delete | Delete, item 5 (`actions.svelte.ts:173-182`, `Session.removeItem` `app/src/state/session.svelte.ts:648`) | the same button; the mode stays down |
| copy | Copy, item 3; Copy as, item 6 (shown, exact, LaTeX) | the same; the mode stays down |
| draw in Plot | none | **new, item 6.** The row's input goes into the Function app's first empty slot (`SlotsState.set`, `app/src/apps/slots.svelte.ts:47`), and the app opens on Plot (`AppShell.open`, `app/src/apps/shell.svelte.ts:112`). It is enabled on a finished CAS row whose result is not a number (no `numeric`, `app/src/calc/port.ts:73`) and whose input compiles to a drawable function of x (`app/src/apps/function/compile.ts:4`, `:13`). Otherwise it is disabled with the reason "Nothing to plot in x". The Function app itself is not changed (docs/05 section 7 point 2: frozen). Only its existing slot API is called. |
| unit check | none | **defined, waits for R24c.** On a Home row it is the unit view opened on that row (docs/04 4.3 already plans the units key on a picked row). There is a slot after every number and **no end slot**, so the request is G16's `UnitRequest` without `end` (`app/src/units/types.ts:23-34`). Enter gives the result's dimension and its unit (the first typed unit with that dimension, else SI with a prefix: `UnitJob.shows`). A dimension mismatch gives the message that names both dimensions. The check needs the unit pad, which is drawn over the keys, so this button brings the keypad back. It goes into the line and the Menu when R24c lands, and it is judged by its own counter. |
| merge | none | **defined, not built.** On Home rows the only meaning that computes something: the picked row and a second picked row become a new row "A op B", with the operator from a four-item sheet (+ − × ÷). Its cost is tap A, Merge, tap B, the operator = 4 presses. Today, with the keypad up, it is tap result A (inserts as a chip), the operator, tap result B, Enter = 4 presses, the same (docs/04 5.2 counting; `History.svelte:162`). No gain, so no build (docs/03 rule 5). It comes back if the owner meant something else, such as joining two inputs into one. |
| move | none | **defined, not built.** Move the picked row one place up or down. Order changes no value, since a chip carries its full value (`App.svelte:135-142`, docs/04 2.8), so it is layout for a shared session only (Share, `actions.svelte.ts:220`). That is none of rule 5's three reasons today. |

**Numbers (S2's fixed list):**
- The Home/CAS Menu becomes 1 Insert, 2 Recall, 3 Copy, 4 Store ▶, 5 Delete, **6 Plot**, 7 Copy as, 8 Paste, 9 Share, 0 Clear.
- Settings, which R15c1 adds as item 10 under key 0, becomes the last row without a digit. It is reached by ▲ from the first row (the list wraps, decisions.md "R7" point 3) or by a tap.
- The cost: Settings by keys goes from ☰ 0 (2 presses) to ☰ ▲ Enter (3). Settings is set rarely (docs/05 3.4).
- The alternative is Plot as an unnumbered row before Settings. It keeps S2's numbers, but the line's sixth button would then not be the Menu's sixth item, which breaks docs/05 3.3's rule. Not recommended.

**Digits while collapsed:** no digit key is on the screen. With a hardware keyboard, digits behave as with the keypad up: they type, and Menu + digit picks (rows.spec.ts:29-37 shows that a digit with a picked row types today; S2 rule M1 keeps digits for lists). So the key path is the same in both states: ▲ to pick, ☰ to open the row's list, a digit to act.

**A sheet while collapsed:** ☰ (R15c1, on the status line) opens the row's list. Its normal place is over the keypad's maths rows (`App.svelte` `.layer`, `mathsTop`), and those rows are not there. While collapsed it rises from the slice's top edge over the history, the placement letter lists already use (`sheetView(sheet, "view")`, `App.svelte` markup). This is the one layout case R53 adds.

### 1.4 What R53 leaves out

- **Plot and the other app views:** P7 point 5 imagined the collapse for Plot as well. There, ◀ ▶ trace and Enter ends a Signed area (`app/src/apps/function/app.svelte.ts:142-143`, `:471-478`), so a collapsed keypad needs a Menu item to end the area and a touch path for tracing. The Function app is frozen (docs/05 section 7 point 2). The recommendation is Home and CAS only in R53, and Plot after the removal test shows the mode in use. **This changes P7 point 5's last sentence** (the text is in the report).
- **Move, merge, unit check:** as in the table.

## 2. Rules 7 and 9

**Rule 7, one interaction model.**
- The zones stay three. The slice is the keypad zone made small, and the action line is R11's line above the entry line (`App.svelte:635`), which exists today.
- No new gesture: tap, long press, ▲ ▼, ☰ + digit and Enter keep their jobs.
- **The one difference is the meaning of a tap on a row** (it picks while collapsed, and recalls or inserts while up). That is acceptable because the state is in plain sight: the keypad is gone. It is also what the user can act on: with no keys, recall and insert would lead nowhere without bringing the keypad back.
- The model the user already knows from sheets is the same: a visible layer changes what a tap or a digit does, and Esc or back undoes it.
- With a hardware keyboard nothing differs between the two states, apart from what Esc does last.

**Rule 9, the viewport's pixels** (probe; the row pitch is a 1÷3 row: stacked input and result, 86.5 px):

| | Viewport | Share | History rows visible (no pick / picked) |
|---|---|---|---|
| Keypad up (today, unchanged by R53) | 297 px | 0.354 | 217 px ≈ 2.5 rows / 165 px ≈ 1.9 rows |
| Collapsed, 44 px slice | 767 px | 0.914 | 687 px ≈ 7.9 rows / 635 px ≈ 7.3 rows |

- The slice costs 44 px and gives back 470.
- With the keypad up the mode costs **0 px**: View is an existing key and the line exists. The 0.35 floor (`app/test/status.spec.ts:15`) is untouched.
- Rows with flat inputs are shorter, so more of them fit. Their pitch is **(to verify)**: R53's gallery shows a one-line session collapsed.
- The entry line (80 px) stays while collapsed. It is where Insert and Recall land, a hardware keyboard types into it, and hiding it would make the screen jump on every toggle (rule 8). The alternative, hiding it, would give a further 80 px.

**The ten benchmark tasks** (docs/04 5.2; `tests/tasks/tasks.yaml`; the probe counts the sequences): results mode adds **no press to any task with the keypad up**. View appears in no sequence, and R53 changes no other key. Started from a collapsed keypad, every task costs **one press more**, the tap on the slice. After the result the keypad stays up, so a following task pays nothing.

| Task | Planned, keypad up | Planned, collapsed | Baseline, up | Baseline, collapsed |
|---|---|---|---|---|
| t01 4.7k ‖ 10k | 14 | 15 | 18 | 19 |
| t02 72 km/h → m/s | 15 | 16 | 7 | 8 |
| t03 2.2n × 4.7k | 10 | 11 | 13 | 14 |
| t04 2π r, r in mm | 14 | 15 | 11 | 12 |
| t05 c by name | 4 | 5 | 10 | 11 |
| t06 nearest E24 | 12 | 13 | — | — |
| t07 0xFF AND 0x3C | — | — | — | — |
| t08 3×3 system | — | — | — | — |
| t09 mean, stdev | — | — | — | — |
| t10 ± product | 31 | 32 | — | — |

(— means no sequence yet: `keys: null` or `baseline: null`.)

**Where the mode wins:** work on rows that are already there. These are not benchmark tasks yet; the counts follow R15c's keys, docs/04 5.2.
- Copy the result before last: keypad up ▲ ▲ Copy = 3; collapsed, a tap on the row and Copy = 2.
- Delete the third row from the bottom: ▲ ▲ ▲ Delete = 4 against 2.
- Draw a CAS row in Plot: ▲ ☰ 6 = 3 against 2.
- Entering and leaving the mode costs 2 (View, then the slice). So one action on the last row is cheaper with the keypad up. The mode pays off from the second action in a visit, and on any row more than two back. That matches the owner's "work with the results", several actions in a row, and it is what the counters measure.

## 3. The removal test (rule 11)

**Counters:** R9's pattern (`app/src/state/taps.svelte.ts`):
- counts plus a `since` date in IndexedDB, with writes batched after 1 s (`:16`, `:69-72`);
- counts made before the load are added to the stored ones (`:33-42`);
- a reset (`:51-55`);
- on the device only, never sent.

R53 generalises it into one counter of named counts under a new key `uses`, and leaves `taps` as it is (P7 point 4 reads it around 2026-10-20). Counted:
- `view`: each collapse by View;
- `pick`: each row picked by a tap while collapsed;
- each action run from the line or the Menu **while collapsed**: `insert`, `recall`, `copy`, `store`, `delete`, `plot`; plus `plotUp`, Plot with the keypad up, so the new action is judged in both states.

R11's own use with the keypad up is not this test's business. The counts appear in Settings as rows of a "Counters" section beside R9's taps (`app/src/views/modeSheet.ts:172-175`; after R49 on that section's page), with Since and Reset.

**Read after 14 days of use, counted from `since`:**
- **The mode goes** if `view` < 14 (less than once a day), or if fewer than 10 actions in total ran while collapsed (then the mode is only a reader, and a scrolled history does that). The slice, the tap-to-pick, the sixth button's place in the line, the counters and the i18n strings go with it. View keeps only Help (Shift), and its tap is `special: none` again. Plot stays only if it passes its own line below.
- **An action goes** if it was used fewer than 3 times in 14 days in both states together (today only Plot is new; unit check gets the same test after R24c). Its Menu item and button go, and the numbers after it move up once.
- **The mode stays** otherwise. Plot's collapse (1.4) is then the next step to judge.

These thresholds are a recommendation. The owner may set them, but they are fixed before the counting starts and not adjusted afterwards.

## 4. R53's package text (for brief section 7)

### ron, R53: results mode on the View key (P16), branch `p1/ron-m4a-results`
**Lane:** day. **Opus** (it hides the keypad; a wrong state leaves the user without keys). **Starts when:** S9 is merged and the owner has said yes to its proposal (decisions.md "S9"), R15c2 is merged (the `view` key and Esc) and R4b is merged.
**Read:** `docs/archive/r13-results-mode.md` sections 1–3; decisions.md P16, "S2: one menu system" and "S9"; `spec/keyboard.yaml` (the `view` key); `app/src/App.svelte` (`press()`, `run()`, `historyKey`, `cancel()`, the `.rowbar` line, the `sheetView` snippet and `.layer`, the `openLayer` effects); `app/src/views/History.svelte` (the row taps, `tapped`); `app/src/clipboard/actions.svelte.ts` (`menu()`, `rowButtons()`); `app/src/apps/shell.svelte.ts` (`open`); `app/src/apps/slots.svelte.ts` (`set`); `app/src/apps/function/compile.ts`; `app/src/keyboard/Keypad.svelte` (the `.pad` box); `app/src/input/backLayer.ts`; `app/src/state/taps.svelte.ts`; `app/src/views/modeSheet.ts` (the taps rows); `app/test/rows.spec.ts`; `app/test/status.spec.ts`; `app/test/topcluster.spec.ts`.
- **The key:** `view` gets `special: results` on its tap (Shift stays as it is). In Home and CAS it collapses the keypad. In an app it is a dead key (r13 1.4). It is not in `AT_ONCE` and it waits in the queue like other keys. View with a sheet or Settings open does what the sheet does with a cluster key today.
- **The slice:** the keypad slides down to a 44 px slice: the keypad's own top edge, a grip and the label "Keys" (i18n), `aria-label` "Show the keypad". Its height is a token. No key reflows, and the slide is ≤ 120 ms and off under `prefers-reduced-motion`. A tap anywhere on it brings the keypad back. The state is not stored (a reload has the keypad up).
- **Ways back:** the slice; Android back (one `openLayer` while collapsed); a hardware Escape after Esc's own jobs (stop a job, a sheet level, a pick); Insert, Recall and Store ▶. Typing on a hardware keyboard does not bring it back.
- **Rows:** while collapsed, a tap on a row's input or result picks it (`picked`), and the long press is unchanged. With the keypad up the taps keep their meaning. A pick made before View stays picked.
- **The line:** R11's `.rowbar` shows `menu(row).slice(0, 6)` while collapsed (five with the keypad up, as now). It stays one line.
- **Plot (Menu item 6):** S2's list becomes 1 Insert, 2 Recall, 3 Copy, 4 Store ▶, 5 Delete, 6 Plot, 7 Copy as, 8 Paste, 9 Share, 0 Clear, and Settings becomes the last row without a digit. Plot is enabled on a finished CAS row with no `numeric` whose input compiles to a drawable function of x (`compile.ts`). Otherwise it is disabled with "Nothing to plot in x". It puts the row's input into the Function app's first empty slot (else F1, replaced) and opens Plot. The Function app's code does not change.
- **A sheet while collapsed** rises from the slice's top edge over the history (the `view` placement), not over the absent maths rows.
- **Counters:** one named-count counter after `taps.svelte.ts` under the IndexedDB key `uses`: `view`, `pick`, and the six actions while collapsed, plus `plotUp`. Shown in Settings beside the taps rows ("Counters"; R49's page if it is merged), with Since and Reset.
- **Docs** (exact text in the report): docs/05 3.3 and 3.5 (the line in results mode, the sixth item), decisions.md P7 point 5 (Home and CAS only, Plot later), and S2's numbers.
**Done when:**
- e2e by touch and by keys: View collapses; the slice, Android back and Escape (after a pick is dropped) bring the keypad back; a reload has it up; a tap picks a row while collapsed and recalls or inserts while up; each of the six actions works on a picked row while collapsed (Insert, Recall and Store ▶ bring the keypad back; Copy, Delete and Plot do not); Plot is disabled on a Home number row with its reason; ☰ while collapsed shows the list over the history; a hardware letter types while collapsed and the keypad stays down; every counter counts and Reset clears them.
- `rows.spec.ts`'s Menu-number tests move to the new numbers (6 Plot, 7 Copy as); the "row buttons cost no viewport" test still holds with the keypad up.
- The viewport share with the keypad up is unchanged (0.354 on the Pixel 7 profile, floor 0.35); a new e2e asserts the collapsed share ≥ 0.9; the gallery has the collapsed state with a picked row, light and dark.
- Typecheck, unit and e2e tests pass; the start chunk within +0.5 kB gzip (the number in the report); `spec/keyboard.yaml` changes only the `view` key's primary action.

## Top risks

1. **A user with no keys and no way out:** the slice is the only on-screen way back. R53's e2e must cover every route (slice, back, Escape, the line's actions), and the slice must stay at least 44 px at every font scale (A4a point 4: large system fonts clip faces, **to verify** in R41's gallery cases).
2. **Tap-to-pick surprises a hand used to tap-to-insert:** the state is visible, but the counters cannot tell a wrong tap. If the owner reports it, the alternative is a picked row by long press only (the Menu then carries the line's job).
3. **Menu numbers move again** (Plot at 6): `rows.spec.ts` and any hand that learned Menu 6 = Copy as. It happens before any release, once.
