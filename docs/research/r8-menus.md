<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# R8: Menu audit (P12 open point A)

sandra, 2026-10-13, package S2. Read and probe only; the code is `phase-1` at `04e0c0b` (R10 merged). Every claim is
a `file:line` in that tree, an e2e test that presses the sequence, the G2 record in `spec/mapping/vc-2026-10-11/`, or
the probe `tools/probes/menu-presses.mjs` (run `node tools/probes/menu-presses.mjs --cells`). Press counts use the
counting rule of docs/04 5.2: every press counts 1, **Shift included**, and a tap or a flick counts 1.

## 0. In one paragraph

The menus are already mostly one system: R7's sheet gives every list the same keys (▲▼, digits, Enter, ▶ submenu,
◀/Esc back, Cancel close). What breaks the pattern is small and specific: the Menu key ignores a picked history row
(it copies the last result instead), the Mode sheet has a "Decimals in Fixed" row but no Fixed format, the three
grid palettes pick in three different ways, Find will be the one list where digits don't pick, and after R15 no key
will reach Mode, Settings, Home or CAS. **Recommendation: keep the sheet as it is and adopt seven rules (section 5),
which cost R11 a fixed nine-item Home/CAS Menu, R15 a key path to Mode and Home/CAS in the Apps list, R18 nothing new
beyond its brief (plus a corrected press note for ∞), R4 digits on the empty-query menu, and a one-row move of
"Decimals" into Settings.** R10's palette stays as built.

## 1. Inventory: every menu, sheet and list

"Pick" = how an item is chosen besides ▲▼ + Enter and a tap, which every sheet has (`app/src/views/sheetKeys.ts:31-40`,
`app/src/views/sheet.svelte.ts:193-197`). "Last pick" = reopening highlights the item picked last, so a repeat is
open + Enter (`sheet.svelte.ts:10-11`, `:90-99`).

| Sheet | Entry keys today | Items, in order | Pick | Last pick | G2 counterpart (spec/mapping) |
|---|---|---|---|---|---|
| **Apps** | Apps; a tap on the place name (`App.svelte:368`) | 1 Function, 2 Solve (`apps/registry.ts:13-16`) | digits | yes (`sheet.spec.ts:155`) | Apps = Application Library, 18 apps (keys.yaml r1c1; apps.yaml) |
| **Menu, Home/CAS** | Menu (`App.svelte:152-154`) | 1 Copy, 2 Copy as shown, 3 Copy exact, 4 Copy LaTeX, 5 Paste, 6 Share session, 7 Clear history (`clipboard/actions.svelte.ts:137-161`); acts on the **last** result | digits | yes | Menu = Get from Home, Get from CAS, Messages (keys.yaml r3c4); ours differs on purpose (P4 item 6) |
| **Row list** | long press on a history row (`App.svelte:401`, `actions.svelte.ts:164-167`) | 1 Copy, 2 Copy as shown, 3 Copy exact, 4 Copy LaTeX (`actions.svelte.ts:153`); acts on that row | digits | yes | none recorded |
| **Menu, Function Plot** | Menu | 1 Root, 2 Extremum, 3 Intersection ›, 4 Slope, 5 Signed area, 6 Default window (`apps/function/app.svelte.ts:168-179`) | digits | yes | Plot soft keys (not recorded, to verify) |
| **Menu, Function Num** | Menu | 1 Start value, 2 Step, 3 Copy CSV (`function/app.svelte.ts:181-186`) | digits | yes | Num soft keys Zoom, More, Go To, Defn (keys.yaml r3c2) |
| **Menu, Solve Num** | Menu | 1 Solve, 2 Polynomial roots (`apps/solve/app.svelte.ts:135-148`) | digits | yes | the Solve soft key, one press (solve.yaml:4) |
| Menu, Function Symb, Solve Symb | Menu | none: no sheet opens, no feedback (`apps/shell.svelte.ts:188-195`) | — | — | Symb soft keys Edit, tick, X, Show, Eval (apps.yaml) |
| **Mode** | Shift + CAS; the format and digits chips open it on their row (`App.svelte:107-110`, `:381-382`) | 1 Angle, 2 Number format (Std, Sci, Eng, Pfx), 3 Significant digits ›, 4 Decimals in Fixed ›, 5 Entry, 6 Settings (`views/modeSheet.ts:38-86`) | digits; ◀ ▶ step a value; a digit on a value row steps it and stays | no (`remember: false`, decisions R8) | Shift + CAS = CAS Settings; Home Settings 4 pages (keys.yaml r3c5, r3c1; settings.yaml) |
| **Settings** | Shift + Home/CAS (`App.svelte:101-104`); Mode row 6 | 1 Format key cycle › (ticks Std, Sci, Eng, Pfx, Fix), 2 Key vibration, 3 Vibration strength, 4 Vibration length, 5 Shift / Alpha taps › (`modeSheet.ts:89-145`) | digits | no | Home Settings (settings.yaml) |
| **Angle chip** | a tap toggles RAD ↔ DEG at once (`App.svelte:379`) | — | — | — | none (Home Settings field) |
| **Tmpl palette** | Tmpl; not in views without an entry line (`App.svelte:91-95`) | 6 × 3 grid (`spec/keyboard.yaml` `templates:`) | arrows only; digits and letters do nothing (`sheet.svelte.ts:63-64`, `:193-197`; decisions R10 (3)) | yes | Tmpl = 3 × 6 palette of template icons, soft key OK (keys.yaml r4c3) |
| **Format cycle** | Fmt; Home/CAS only, nothing in an app (`App.svelte:161-164`) | steps the last result through the ticked notations (`state/displayMode.ts:32-33`, default Std, Sci, Eng) | — | — | none (the G2 sets formats in Settings) |
| **Form toggle** | a b/c on an empty Home/CAS line (`App.svelte:337-341`) | decimal ↔ fraction, a+bi ↔ polar (`displayMode.ts:35-37`) | — | — | a b/c on an empty line (G2 item 29, device) |
| *Shift + 6 palette* (R18) | Shift + 6 | 4 × 3: `<` `≤` `>` `≥` / `==` `≠` AND OR / NOT XOR EQ (brief, R18) | the key at the cell's place (7 8 9 ÷ / 4 5 6 × / 1 2 3) | planned | the G2's own (keys.yaml r8c4; brief R18) |
| *Shift + 9 palette* (R18) | Shift + 9 | 8 × 3: `!` → ∞ ° ′ ″ & Å / α … λ / μ … Ω (brief, R18) | arrows | planned | the G2's own (keys.yaml r7c4) |
| *Find* (R4) | Math; Vars = variables; Shift + Math = Memory (docs/04 5.1) | empty query: G2-style Math categories, fixed order (P11) | letters and **digits type** (docs/04 3.7) | — | Math toolbox: tabs Math, CAS, App, Catlg (menus.yaml) |

## 2. Presses per task

Today = `04e0c0b`. After = R15 built as P12 says, plus the set in section 5. G2 numbers only where
`spec/mapping/` records the sequence; everything else is **(to verify)**: the owner on the G2, same counting rule.

| Task | G2 | Today | After | Evidence |
|---|---|---|---|---|
| Home ↔ CAS | 1 (Home or CAS key) | 1 (Home/CAS or CAS key) | 1 tap on the place name; keys only: Apps, 1 or 2 = 2 | keys.yaml r3c1, r3c5; `App.svelte:127-137` |
| From an app back to Home | 1 (Home) | 1 (Home/CAS key) | 1 tap on the place name (R15a); keys: Apps, 1 = 2 | `apps/shell.svelte.ts:148-155` |
| Open Solve | (to verify) | 2: Apps, 2 | 2: Apps, 4 | `registry.ts:13-16`; `sheet.spec.ts:155` |
| RAD ↔ DEG | (to verify) | 1 tap; keys **4**: Shift, CAS, ▶, Enter (3 with a flick up on CAS) | 1 tap; keys 4 via Shift + Apps (3 with a flick) | `status.spec.ts:67`, `:82-97` |
| Digits to 20 | (to verify) | 3: digits chip, Enter, 7; keys **4**: Shift, CAS, 3, 7 | same counts via Shift + Apps | `status.spec.ts:99-109`; `sheet.svelte.ts:200-202`, `:239-260` |
| Open Settings | 2 (Shift, Home) | 2 (Shift, Home/CAS) | 2 taps: a format chip, 6; keys 3: Shift, Apps, 6 | keys.yaml r3c1; `modeSheet.ts:84` |
| Last result in the next notation | (to verify) | 1 (Fmt) | 1 | `fmt.spec.ts:35` |
| Last result as a fraction | 1 (a b/c) | 1 | 1 | G2 item 29 (device); `tmpl.spec.ts:109` |
| Copy the last result | (to verify) | 2 (Shift, View) | 2 | `copy.spec.ts:38` |
| Copy a picked row | (to verify) | 3 (▲, Shift, View) for the last row | 3, or 2 with R11's buttons (▲, tap Copy) | `copy.spec.ts:46`; `App.svelte:200-202` |
| Copy exact | — | 2 (Menu, 3) | 3 (Menu, 6, 2) | `copy.spec.ts:84` |
| Paste | 2 (Shift, Menu: a list of past entries) | 2 (Shift, Menu: a number from the clipboard) | 2 | keys.yaml r3c4; `copy.spec.ts:52` |
| Clear history | 2 (Shift, Esc) | 2 (Shift, Esc) | 2 | keys.yaml r1c5; `App.svelte:81-84`, `:120-122` |
| A template (Tmpl) | (to verify; touch 2) | keys median 4, max 6 (∫ 6); touch 2; a repeat 2 | same | probe; `tmpl.spec.ts:24` |
| `≤` | (to verify) | not on the keypad | 3: Shift, 6, 8 (2 with a flick up on 6) | probe; brief R18 |
| `∞` | (to verify) | 2 (Shift, 9) | keys **5** (Shift, 9, ▶, ▶, Enter); touch 3; flick + tap 2 | probe; `keyboard.yaml` d9 |
| A Greek letter (Shift + 9) | (to verify) | not on the keypad | keys median 6, max 8; touch 3; flick + tap 2 | probe |
| Plot: a root | (to verify) | 2 (Menu, 1) | 2 | `function.spec.ts:68` |
| Solve | 1 (Solve soft key) | 2 (Menu, 1) | 2 (Function and Solve are frozen, P11) | solve.yaml:4; `solve.spec.ts:29` |
| Repeat the last menu action | — | 2 (Menu, Enter) | 2 | `sheet.spec.ts:155` |

Probe output (`node tools/probes/menu-presses.mjs`, reproduced 2026-10-13): Tmpl by keys median 4, mean 4.11, max 6;
Shift + 6 by arrows median 5, by the key at its place 3 for every cell (2 with a flick); Shift + 9 by keys median 6,
mean 5.63, max 8 (δ), by touch 3 (2 with a flick). The brief's "∞ costs one press more" holds for touch only; by keys
∞ goes from 2 to 5.

## 3. Duplicates (kept on purpose, unless noted)

| Action | Ways in | Verdict |
|---|---|---|
| Copy | Shift + View; Menu 1; row list 1 | keep: a shortcut plus a menu home (rule M3) |
| Paste | Shift + Menu; Menu 5 | keep |
| Clear history | Shift + Esc; Menu 7 | keep (the G2's Shift + Esc) |
| Settings | Shift + Home/CAS; Mode row 6 | Shift + Home goes with R15; Mode row 6 stays |
| Mode | Shift + CAS; format and digits chips | Shift + CAS goes with R15; **a key path must stay** (I9) |
| Angle | angle chip; Mode row 1 | keep |
| Number format | Mode row 2 (the default); Fmt (one result); Settings › Format key cycle (what Fmt steps through) | keep: three places, two meanings, each named for what it does; but Decimals moves (I3) |
| Fraction | ÷; a b/c while typing; Tmpl cell 1 (`key: frac`) | keep: the same action (`keyboard.yaml` templates row 1) |
| √, ⁿ√, xʸ, \|x\| | their keys and Tmpl cells (`key:` / `layer:`) | keep: the same action, as on the G2 |
| Degree sign | Tmpl DMS; Shift + 9 ° (R18); ° on a b/c in a unit slot (r7) | keep, **but R18's ° must use the parser rule of R10's DMS** (degrees in every angle mode, decisions R10 (4)); otherwise `30°` means two things |
| µ / μ, Ω | unit slot: µ (micro sign) on (−), Ω on the comma; Shift + 9: μ and Ω as variable names | keep: Home is unit-free (P8); R18 maps μ and Ω to names that are not units, and the unit view (milestone 5) reads its own µ and Ω as micro and ohm |

## 4. Inconsistencies

| # | What | Evidence | Weight |
|---|---|---|---|
| I1 | **Menu ignores a picked row.** ▲ picks a row; Menu drops the pick and every Copy item acts on the last result. Shift + View in the same state copies the picked row. A copy of the wrong row is said to succeed ("Copied"). | `App.svelte:179-209` (the pick is cleared at :197-198, Menu falls through to :152-154), `clipboard/actions.svelte.ts:57-61` (no row = last), `App.svelte:200-202`; from the code, e2e to add in R11 | high: a wrong value can leave the calculator unmarked (principle 3) |
| I2 | The row list (4 items) and the Menu (7) number Copy alike today, but R11's draft list (Insert, Recall, Copy, Store ▶, Delete first, "when a row is picked") would give Menu two numberings: Copy is 1 without a pick and 3 with one. | brief R11; `actions.svelte.ts:137-161` | medium: the digit habit breaks (rule 8's intent) |
| I3 | Mode has "Decimals in Fixed" but its format row has no Fixed; Fixed exists only as a Fmt tick, which is off by default. | `modeSheet.ts:14`, `:66-74`; `calc/port.ts:14`; `displayMode.ts:32-33` | medium: a setting with no visible effect |
| I4 | A tap on the place name opens Apps; P12 makes it the Home ↔ CAS switch. | `App.svelte:368`; `status.spec.ts:46` | R15 changes it |
| I5 | Three ways to pick in a grid or list: list rows by digit; Tmpl by arrows only; Shift + 6 by the key at the cell's place. | `sheet.svelte.ts:193-197`; decisions R10 (3); brief R18 | low once each item shows the key that picks it (rule M1) |
| I6 | The opening key closes its sheet for Menu, Apps and Tmpl, but cannot for Shift + 6 (6 picks AND) or Shift + 9. | `sheetKeys.ts:39`, `App.svelte:270-278` | low: Esc is the rule (M5) |
| I7 | Find is the only list where digits do not pick (queries need them), but its empty query is a numbered category menu. | docs/04 3.7; docs/05 section 7 point 1 | medium for R4 |
| I8 | Keys that do nothing in a view give no sign: Menu in Symb, Tmpl in Plot, Fmt in an app. | `shell.svelte.ts:188-195`; `App.svelte:91-92`, `:161-164` | low |
| I9 | After R15 no key reaches Mode or Settings (today Shift + CAS, Shift + Home/CAS), and none reaches Home or CAS. Principle 2 says keyboard-first; the PWA on a desktop has no thumb. | `keyboard.yaml` app and cas keys; P12 points 2–3 | high for R15 |
| I10 | The docs call the Mode paths "3 keys" (Shift + CAS, ▶, Enter); the tests press 4 (`shift`, `cas`, `right`, `enter`), and docs/04 5.2 counts Shift. | `status.spec.ts:82-109`; `modeSheet.test.ts:26`, `:55`; docs/05 3.4 and U4; decisions R8 | doc fix (done in this package for docs/05 and decisions R8) |

## 5. The recommended set: seven rules

These hold for every sheet, palette and list, present and planned. Most are already true; the "Changes" column says
which package makes the rest true.

| Rule | Text | True today? | Changes |
|---|---|---|---|
| **M1** | **An item shows the key that picks it.** List rows show 1…9, 0; a grid that fits the digit block (≤ 4 × 3) shows the key at each cell's place and that key picks it; a larger grid shows nothing and is picked by arrows + Enter or a tap. Find's query takes digits once a letter is typed; its empty-query category menu is numbered like any list. | lists, Tmpl yes | R18 Shift + 6 labels; R4 digits on the empty query (none of the 110 phrases in `tests/tasks/find-queries.yaml` starts with a digit) |
| **M2** | **Menu = the verbs for what is on screen,** one fixed list per view, the same numbers whatever is picked. Row buttons, the long press and Menu show the same list (R11), acting on the picked row, else the last result. | no (I1, I2) | R11: the Home/CAS Menu below |
| **M3** | **A key layer is a shortcut to a menu item,** never the only way (Copy, Paste, Clear, Store ▶, Settings, Mode). Exceptions: the two per-result keys Fmt and a b/c, whose effect is visible at once. | yes, except Mode after R15 | R15: M6 |
| **M4** | **One home per setting:** what changes during work in Mode (angle, format, digits, entry); what is set once in Settings (the Format key cycle with its Fixed decimals, vibration, later theme); what changes one result on Fmt and a b/c. | no (I3) | move "Decimals in Fixed" from Mode into Settings › Format key cycle, as a value row under the Fixed tick |
| **M5** | **Esc goes back one level, Cancel closes all,** in every sheet. The key that opened a sheet also closes it where that key has no other job there (Menu, Apps, Tmpl). | yes | R18: Esc and Cancel close both palettes (6 and 9 pick there) |
| **M6** | **Every sheet and every place is reachable by keys alone,** and by one tap where the status line shows it. | yes today; no after R15 (I9) | R15: Mode on a key layer (candidate **Shift + Apps**, the G2's Info, which we omit, docs/06 section 2); the Apps sheet lists **1 Home, 2 CAS**, then the apps |
| **M7** | **Fixed order, last pick remembered** (repeat = open + Enter), except Mode and Settings, which always open on their first row so their paths are fixed (decisions R8). No usage ranking (P11). | yes | R18: both palettes remember the last pick, like Tmpl |

**The Home/CAS Menu under M2 (for R11):** 1 Insert, 2 Recall, 3 Copy, 4 Store ▶, 5 Delete, 6 Copy as › (as shown,
exact, LaTeX), 7 Paste, 8 Share session, 9 Clear history. Items 1–5 are R11's row buttons, in the same order. With
no row picked they act on the last result (Delete: the last row); a disabled item says why (docs/05 3.1). Nine
items keep it a numbered list: eleven flat items would cross `FILTER_ABOVE = 10` (`sheet.svelte.ts:8`), turn the
letter filter on and leave items 11+ without a digit. Cost: Copy exact, as shown and LaTeX take one press more
(Menu, 6, n). The long press opens this list on its row.

**Why this set and not another:** it keeps the G2's sequences that P12 did not remove (Shift + Esc, Shift + View,
Shift + Menu, Tmpl, the Shift + 6 key labels), it adds no gesture, zone or key (rule 7), it fixes the one place where
a menu can act on the wrong value (I1), and every sheet keeps a path without touch (principle 2).

## 6. What each package must change

| Package | Change | Evidence for the change |
|---|---|---|
| **R10** (built) | **Nothing.** Decision R10 (3) stands: the Tmpl grid is picked by arrows, Enter or a tap and opens on the last pick. 18 cells do not fit the digit block; the G2's Tmpl palette shows no key labels (keys.yaml r4c3: soft key OK). By keys: median 4, max 6; by touch 2. | probe; decisions R10 |
| **R18** | (a) Shift + 6 as briefed: each cell labelled with its key (M1). (b) Both palettes: Esc back, Cancel closes, last pick remembered (M5, M7). (c) ° from Shift + 9 uses R10's DMS parser rule. (d) μ and Ω as variable names, never units. (e) The report states ∞ as 5 presses by keys, 3 by touch, 2 by flick + tap (not "one more"). | probe; section 3 |
| **R15a/b** | (a) A key path to Mode (candidate Shift + Apps); Settings stays Mode's last row. (b) Apps lists 1 Home, 2 CAS, then the apps: Home ↔ CAS by keys is Apps, 1/2, and this is also open point B's fallback without a new flick. (c) Remove `app` and `cas` from `PASS` (`sheetKeys.ts:39`) and `AT_ONCE` (`App.svelte:286`), and `symb`/`plot`/`num` too if they fold into the status line. (d) The place-name tap changes from Apps (`App.svelte:368`, `status.spec.ts:46`) to the switch. (e) The press table in the R15a mockups uses section 2's rows. | I4, I9 |
| **R11** | The nine-item Menu of section 5, one list for buttons, long press and Menu, acting on the picked row; an e2e that picks row 1 of 3 and copies it through Menu (I1's regression test first). | I1, I2 |
| **R4** | On an empty query digits pick a category; after a letter they type (M1). | I7 |
| R13 (owner, 2026-10-13: with I1's fix) | Move "Decimals in Fixed" from Mode to Settings › Format key cycle (M4); a key that does nothing in the open view gives the dead-key haptic of docs/05 3.7 (I8). | I3, I8 |

## 7. Still to verify

| What | Who, how |
|---|---|
| The G2 columns marked (to verify) in section 2: open Solve, change the angle, 20 digits, a template by keys, `≤`, `∞`, a Greek letter, a Plot root | owner, on the G2, same counting rule |
| Does the G2 label the Shift + 9 cells with keys, as it does for Shift + 6? | owner, G2 photo (proposed G2 checklist item, report) |
| I1 in the running app: ▲ twice, Menu, Copy copies the last result, not the picked row | R11, as its first regression test |
| Whether Shift + Apps (Mode) suits the owner's hand after R15b | owner, on the R15 APK |

## 8. The decision (accepted 2026-10-13)

**2026-10-13 S2: one menu system (P12 open point A). ACCEPTED by the owner (2026-10-13), every recommendation;** the decision text is in decisions.md, and I1's fix is pulled forward into R13. The proposal as made:
- **Recommendation:** adopt rules M1–M7 (section 5). Concretely: (1) R11 builds the Home/CAS Menu as one fixed list
  of nine (Insert, Recall, Copy, Store ▶, Delete, Copy as ›, Paste, Share session, Clear history) acting on the picked
  row, else the last result; (2) R15 keeps a key path to Mode (Shift + Apps) and puts Home and CAS first in the Apps
  list; (3) "Decimals in Fixed" moves from Mode into Settings beside the Fixed tick; (4) R18 builds both palettes as
  briefed, with Esc/Cancel and the remembered pick; (5) R4 lets digits pick on Find's empty query. R10's palette
  stays as built.
- **Why:** the Menu can copy the wrong row today (I1); after R15 no key would reach Mode, Settings, Home or CAS (I9);
  the rest makes every list behave the same, adds no key, gesture or zone, and keeps the G2 sequences P12 kept.
- **Cost:** R11 and R15 absorb it in their own scope (about 0.25 d together); the Decimals move about 0.1 d. Copy as
  shown, exact and LaTeX take one press more.
- **Alternatives:** keep R11's draft (row actions first only when a row is picked): one press less for those copies,
  but two numberings of the same list. Fixed as a fifth Mode format instead of moving Decimals: G2 flow (Home
  Settings has Fixed), but a new path through the engine settings; backlog G9 already owns the G2's formats.
  Letters that jump to a cell in a grid: fewer presses by keys, not measured, a new behaviour (rule 7).
- **Would change if:** the owner finds Shift + Apps awkward on the R15 APK (then another free shifted cell); the
  G2 turns out to label the Shift + 9 cells too (then that grid follows M1's key labels where it can).
