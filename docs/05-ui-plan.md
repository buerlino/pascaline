<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# UI plan: screens, menus and workflows

**Accepted by the owner 2026-10-13, with the changes in section 7 (they win where this text differs). Packages and order: milestone 4a in [backlog.md](backlog.md) and [shifts/brief.md](shifts/brief.md).**

*Written 2026-10-13 (Claude, as UI reviewer, for the project owner and ron). Base: `phase-1` at 165eece. Evidence: the code (file:line) and Playwright screenshots of every view at Pixel 7 size (light theme, real engine). Effort figures are estimates. This plan does not change the keypad: which function sits on which key and layer stays as in `spec/keyboard.yaml` (P4, P8). Everything on the screen above it is open to change.*

## 0. In one paragraph

The keypad already works well. The screen above it does not yet feel like one designed product: every surface (app list, menus, Settings, history actions) behaves in its own way, important state such as the angle mode is invisible, and a few visual bugs make the keypad look unfinished. **Recommendation:** build one interaction model for every surface (one sheet component, one status bar, one context bar of soft keys), then put Find, the Units app and the template list on top of it. Do the quick fixes (U0) and the sheet component (U1) **before EN1 Find** (milestone 4, step 8), so Find is built on the shared component and not as one more special case. Total about 12–14 days for U0–U7, spread over milestones 4–6.

## 1. What the screenshots show (2026-10-13)

| # | Finding | Where | Effect |
|---|---|---|---|
| 1 | Shift legends overlap the key names in the top cluster: "Settings" on "Home/CA", "Clear" on "Esc", "Copy" on "View", "Paste" on "Menu". "Home/CAS" is cut to "Home/CA" | `Keypad.svelte` legend CSS (absolute `top: 2px`, 11 px, no room reserved); `i18n/en.ts:10` | Looks broken; the shifted functions are hard to read |
| 2 | Settings is on two keys (Shift + Home/CAS and Shift + CAS) | `spec/keyboard.yaml` keys `app`, `cas` | Wastes a shift cell; two legends say the same thing |
| 3 | Alpha layer: the Enter label is blue on green and unreadable; Vars/Math/Tmpl stay dimmed although they type A, B, C | `Keypad.svelte` (`data-reserved` opacity applies in every layer) | Looks disabled; low contrast |
| 4 | With Alpha lock on, an open list does not take the digit keys: "1" typed `Y` into the entry line behind the Apps list | `App.svelte` `press`: digits pick only when `!mods.alpha` | State leaks through an overlay; the user cannot tell what happened |
| 5 | The Home Menu has 7 items, 3 are visible, with no sign that it scrolls | `PickList.svelte` (`max-height`, no scroll cue); the sheet covers only the history area | Copy LaTeX, Paste, Share and Clear look missing |
| 6 | No angle mode, format or digits shown anywhere. The header holds view tabs that repeat the hardware keys | `App.svelte` header | An engineer cannot see RAD vs DEG before pressing Enter: the classic silent wrong answer (principle 3) |
| 7 | Settings is one long modal with native selects and number fields, a Close button at the very bottom, and no key control | `views/Settings.svelte` | Changing DEG to RAD takes about 4 taps and a scroll; the keypad does nothing there |
| 8 | Plot with no function: the hint text is drawn over the x axis | `FunctionPlot.svelte` | Hard to read |
| 9 | History rows have no separation; a tall input (a fraction) scrolls off at the top half cut | `History.svelte` | Hard to scan a long session |
| 10 | Each list is different: Apps (numbered sheet), view menus (numbered sheet, submenus replace the list), Settings (form), history actions (long press only) | `PickList`, `shell.svelte.ts`, `Settings.svelte`, `History.svelte` | Every surface has to be learned separately |

What already works and stays: the keypad's colour grouping, live faces for the Shift and Alpha layers, the large entry field, right-aligned results with `=`/`≈`/`⚠` marks, digit picking in lists, and gesture feedback.

## 2. Design rules for the screen

These sit under the three principles in CLAUDE.md and decide the details below.

1. **The keypad drives everything.** Every screen, list and dialog can be used with keys alone. Touch is a shortcut, never the only way (the G2 habit, and the fastest way on a phone held in one hand).
2. **One way to choose.** Every choice (apps, menus, Find, templates, settings values, history actions) uses the same sheet with the same keys (section 3.1). Learn it once.
3. **State is always visible.** Angle mode, format, digits, Shift/Alpha, a running job and the current place are always on screen, in the same spot.
4. **Nothing is lost without notice.** No key goes "through" an open sheet; a dead key looks dead and gives a short haptic "no".
5. **Two keys for frequent things.** Anything an engineer does several times a day (switch DEG/RAD, copy a result, reuse a constant, change format) takes at most 2 key presses or 1 tap. The EN0 benchmark measures it.
6. **No motion that waits.** Sheets appear within one frame and animate for at most 120 ms; nothing blocks input while it animates. `prefers-reduced-motion` turns animation off.
7. **Our own look.** Our colours, shapes and icons; nothing traced from the reference (CLAUDE.md, clean room).

## 3. The interaction model

### 3.1 One sheet for every list (replaces `PickList`)

A sheet slides up from just above the entry line and covers the history or view, never the keypad. Inside a sheet:

| Key | Action |
|---|---|
| ▲ ▼ (and the arrow trackpad) | Move the highlight; the list scrolls to keep it in view |
| 1…9, 0 | Pick item 1–10 directly (Shift and Alpha are ignored while a sheet is open: fixes finding 4) |
| Enter | Pick the highlighted item |
| ▶ | Open a submenu (shown with `›`) |
| ◀ or Esc | Back one level (submenus stack; the title shows the path, e.g. `Plot › Intersection`) |
| Cancel | Close every level |
| Letter keys | Type-ahead filter, for lists longer than 10 items: a tap on a key that is not a digit types its letter (no Alpha press needed); a flick down types the letter on any key, digits included (section 7) |
| Menu | Closes the sheet (the same key opens and closes it) |

- **Remembers the last pick** per sheet: reopening a menu highlights the item used last, so a repeated action is Menu + Enter (2 keys).
- **Scroll cue:** a fade at the cut edge plus a count ("7 items") in the title row when not everything fits (fixes finding 5). The sheet may grow over the entry line when it needs the room.
- **Disabled items** stay in place (numbers never shift) and say why on a second line ("Define a function first").
- Built once as `Sheet.svelte` plus a small model (`items`, `submenu`, `lastPick`, `filter`). Find (EN1), the template list (EN5), Base (EN6), the Units suggestions (EN2) and Settings values all use it. Find adds its preview pane and ranking but keeps the same keys.

### 3.2 A status bar instead of the tab row

The header row (`App.svelte` `<header>`) becomes a slim status bar, one line, at most 28 px (docs/03 rule 9):

```
 Home                           RAD · STD 12 · ⇧        ⟳
 Function › Plot                DEG · ENG 6             
```

- **Left: where you are**, app and view. **Since P12 the place name is the switch:** one tap changes Home ↔ CAS (the Home and CAS keys are gone), and R15a decides how Symb, Plot and Num are reached from it; the hit area is larger than the 28 px line. The Apps key still opens the Apps sheet.
- **Right: the mode chips.** Angle (`RAD`/`DEG`, coloured when not the default), format and digits, the Shift/Alpha state (`⇧`, `α`, `α🔒`), a busy spinner. **A tap on a chip toggles or cycles it** (angle: 1 tap; format: opens the Mode sheet at that row). This fixes finding 6 and makes DEG/RAD one tap.
- Height freed by the tabs goes to the history (about 30 px on a phone).

### 3.3 A context bar of soft keys (the screen's own row of keys)

One row of up to 6 touch buttons directly above the entry line. Its content follows the context. The keypad stays the same; this is screen space. The G2 has the same kind of on-screen menu row, so it fits the muscle memory, in our own design.

| Context | Soft keys (first draft; the benchmark decides the order) |
|---|---|
| Home/CAS, entry line has text | none, the row is hidden (no clutter while typing) |
| Home/CAS, a history row picked (▲ on an empty line) | Insert · Recall · Copy · Store ▶ · Delete |
| After a number, Units app (and Home if task 3 wins) | p n µ m k M G (the prefix chips of P8, in the same row) |
| Function Plot | Zoom · Trace · Analyse › · Window · Fcn |
| Function Num | Zoom · Go to · Start · Step · CSV |
| Solve | Solve · Roots · Copy |
| Python editor | Run · Scripts · Snippets › |

- Each soft key is also reachable without touch: **Menu** opens the full list for the view (the soft keys are the first items, in the same order, so their numbers are 1–6). So "Plot → Trace" is either one tap or Menu + 2.
- Tap targets at least 44 px high; a label of at most 8 characters; an item with a submenu shows `›`.
- Long press on a history row (today's only path to row actions) stays as a shortcut.

### 3.4 The Mode sheet and Settings (fixes finding 7)

Split by how often a thing changes:

- **Mode sheet** (a tap on a status chip; Shift + CAS until R15b removes that key, P12): angle, format, digits, entry (textbook/one-line); the decimals of Fixed are in Settings › Format key cycle (R13). Each row is a sheet item; ◀ ▶ change the value in place, a digit (or a tap) picks a row and steps its value forward with the sheet open, Enter closes. Digits open a list of presets on a digit or Enter (4 6 8 10 12 15 20 25 30), with the current value marked; ◀ ▶ still step them by one. The sheet always opens on Angle (a chip opens it on its own row). DEG → RAD from anywhere: one tap on the chip (by keys Shift, CAS, ▶, Enter: 4 presses, 3 with a flick up on CAS, until R15b); 20 digits: digits chip, Enter, 7 (by keys Shift, CAS, 3, 7).
- **Settings** (the last item of the Mode sheet; Shift + Home/CAS until R15b, P12): Format key cycle (a list of switches), haptics (on/off, strength on Android only, length), decimal comma, theme, about and licences; the first two are built (R8), theme comes with R12b, the rest later. Same sheet keys; no native `<select>` (they open the system picker, which the keypad cannot drive).
- This uses the duplicate Settings cell (finding 2) for the Mode sheet. **Keypad layout question for the owner:** this changes the meaning of Shift + CAS, not its position or the visual keypad. The reference opens CAS settings there, so the habit fits.

### 3.5 History rows

- A thin divider and 8 px more space between entries; input muted and left-aligned, result right-aligned (as now).
- A long result or input scrolls sideways with a fade at the edge that shows there is more; never cut without a sign.
- The picked row (▲ from an empty line) gets the context bar from 3.3, so its actions are visible, not hidden behind a long press.
- An error row shows the message on one line, with the part of the input that failed underlined when the parser knows its position.

### 3.6 Find (EN1): the screen design

docs/04 §3 sets the behaviour; this adds the layout so the work in milestone 4, step 8 can start from it:

- A full-height sheet (3.1). The query on top, then the results, then a preview pane for the highlighted item, fixed at the bottom so it does not jump.
- ~~An empty query lists recents first~~ **An empty query shows the G2-style Math menu: fixed categories in a fixed order** (P11), so the same keys always reach the same function; no usage ranking.
- Each row: kind badge (fn, const, unit, var) in its own colour and shape, name, one-line description, the value on the right for constants and variables.
- **While Find is open, the key faces show the lower-case letters they type** (the same live legend mechanism as Shift/Alpha), so the user sees the keypad change and knows Alpha is not needed.
- Preview: constant: symbol, value, unit, uncertainty, "exact" badge; unit: dimension and SI factor; function: syntax, one example, "not checked" for tier 1.

### 3.7 The keypad: look only

The layout stays. Only the drawing changes:

- **Legends get their own space** (fixes finding 1): every key reserves a legend line above the face; Shift legend top-right, Alpha top-left (as now), the face lower. In the top cluster the faces become shorter where they would not fit: `Home/CAS` → `Home` with the CAS key beside it, or the face shrinks to fit (one rule: never cut, never overlap).
- **Contrast at least 4.5:1** for every face and legend in every layer and both themes (fixes finding 3). A test computes it from the CSS tokens.
- **Dead keys** (today `special: none`) dim only in the layers where they do nothing. A press on one gives a short double haptic and no other effect.
- **Press feedback** within one frame: the key darkens while the finger is down (keys fire on lift because of flicks, P11, so the feedback must start on touch).

*Built in R6 (2026-10-13): the legend line, the fit rule (faces and legends shrink, `app/src/keyboard/fit.ts`) and the contrast test (`app/src/style.test.ts`); dead keys dim per layer. The double haptic on a dead key came with R13 (2026-10-13): Menu in Symb, Tmpl in Plot, Fmt in an app, `special: none` keys and typing in Plot.*

### 3.8 Errors and empty states

- Every empty state says what to do next in one line and never covers content: Plot with no function shows its hint in a box above the axes (finding 8).
- Error messages name the problem and the fix: "Units don't match: L vs T", "Angle is in degrees; result uses DEG". No error codes.

### 3.9 Tablet and landscape

The app is `max-width: 720px` and centred (`App.svelte` `.app`), so a Tab One in landscape shows a narrow column. Above 900 px width and in landscape: two panes, the screen on the left (history, plot, Find) and the keypad on the right at a fixed key size. The plot gets the full height. Phones in landscape: the same split with a smaller keypad, or the compact keypad of K4.

### 3.10 Look and feel

- **Design tokens** (one file, already partly in `style.css`): colours per role, the type scale (entry 28, result 26, input 22, UI 15, legend 11), spacing on a 4 px grid, radii, motion durations. No colour or size written directly in a component.
- **Theme setting: System / Light / Dark** (owner, 2026-10-13). Default **Dark on Android**, **System in the PWA**.
- **Numbers:** one maths font for entry and results (MathLive's). UI text in the system font. Monospaced digits in tables (Num, Solve, the Find value column) so columns line up.
- **App icons:** our own simple line icons in the Apps sheet beside the number and name.

## 4. Work packages

The order lets every package build on the previous one. Owner of the code: ron; device checks: annabell. Each package ends with the UI gallery (U0) updated and its screenshots checked by the owner on a phone.

| # | Package | Contents | Est. | Gate |
|---|---|---|---|---|
| **U0** | Quick fixes and the UI gallery | Findings 1, 3, 4, 8 fixed; a Playwright script that renders every view, sheet and layer in light and dark at phone and tablet size into `app/test/gallery/` (not committed, like other build output); a contrast test from the tokens; regression tests first for 4 (alpha leak) | 1.5 d | Contrast test; gallery reviewed by the owner |
| **U1** | One sheet | `Sheet.svelte` and its model (3.1) replace `PickList`; Apps, view menus and the Home menu move to it; last pick, submenu stack with path, scroll cue, type-ahead | 2 d | e2e per key in 3.1; every existing menu test green |
| **U2** | Status bar | 3.2: place, mode chips with tap actions, Shift/Alpha, busy | 1 d | e2e: tap RAD → DEG changes the next result |
| **U3** | Context bar | 3.3 for Home rows, Plot, Num, Solve, Python; Menu = the same items first | 2–3 d | Benchmark: no task gets more key presses; Plot trace in 1 tap |
| **U4** | Mode sheet and Settings | 3.4; settings rows as sheet items; native inputs gone | 1.5 d | e2e: DEG → RAD in one tap, or 4 presses by keys |
| **U5** | History rows | 3.5 | 1 d | Screenshot review; history performance test unchanged |
| **U6** | Tablet and landscape | 3.9 | 1.5 d | Gallery at 1280×800; Tab One check (annabell) |
| **U7** | Tokens, theme, icons, motion | 3.10, 3.7 press feedback, reduced motion | 2 d | Size test (start chunk unchanged within 2 kB) |

Fit with the current plan (docs/backlog.md, milestone 4): **U0 and U1 before step 8 (EN1 Find)**; Find then uses the sheet and the design in 3.6. U2 and U4 any time in milestone 4 (they serve EN3 honest precision: the angle mode visible is a precision feature). U3 before milestone 5, because the prefix chips of the Units app live in the context bar. U5–U7 in milestone 6 or when the owner wants a release.

## 5. How we know it works

- **Keystrokes:** the EN0 task benchmark already counts them; add 5 UI tasks: switch DEG/RAD, copy the last result, reuse the result before last, trace a root in Plot, change digits to 20. Budget for each: 3 presses or 1 tap.
- **Hand test with real users:** the owner and two engineers who have never used the app do the ten benchmark tasks with no instructions; note every hesitation longer than 3 seconds and every wrong key. Each one becomes an issue. Repeat after U3 and after milestone 5.
- **The gallery** is the review tool: the owner reviews screenshots of every state in one page instead of finding them on the device.
- **Feel on the device:** sheet open and key feedback within one frame on the Tab One (annabell measures with the `?bench` hooks).

## 6. Decisions for the owner

Each with my recommendation; the plan assumes the recommended answer.

1. **Replace the header tabs with the status bar (3.2).** Recommended: yes. The keys already switch views, and the space is better used for state the user cannot see today.
2. **Add the context bar of soft keys (3.3).** Recommended: yes. It is the largest speed gain for Plot, Num and history actions, and the reference has the same kind of row, so it keeps the habit.
3. **Shift + CAS opens the Mode sheet; Shift + Home/CAS opens Settings (3.4).** Recommended: yes. It removes the duplicate and gives the most-changed settings a 3-key path. It changes no key position.
4. **Dark theme by default on Android, system theme in the PWA (3.10).** Recommended: yes.

## 7. Changes from the owner's review (2026-10-13; these win over the text above)

1. **Find (3.6):** no "recents first". An empty query shows the G2-style Math menu, fixed categories in a fixed order; typing filters it; no usage ranking (P11, docs/03 rule 8). Later idea (owner): the user may rearrange the menu's slots; a personal order stays put, so it fits rule 8. Not scheduled.
2. **Context bar (3.3): Home and CAS history rows only.** Function and Solve are frozen, the Python app is removed, and the unit slots (P11) replace the prefix row. It appears only when a row is picked, never while typing. Its row actions are built so a later "results mode" (feedback.md #19) can reuse them.
3. **Status bar (3.2):** at most 28 px.
4. **Tablet and landscape (3.9, U6): deferred.** Not G2 flow and not a friction the owner has hit (docs/03 rule 5).
5. **Hold-and-drag** is removed (P11); the sheet keys never mention it.
6. **Letters in sheets:** a tap on a digit key picks a row, a tap on any other key types its letter, a flick down types the letter on any key (after flicks, R9).
7. **Theme:** a setting System / Light / Dark; Dark by default on Android, System in the PWA.
8. **Decisions in section 6:** 1 yes; 2 yes, limited as in point 2; 3 yes (Shift + CAS = Mode sheet, Shift + Home/CAS = Settings, the G2's places for CAS and Home settings; replaced by P12: the keys go and the status line takes over); 4 yes, with the setting of point 7.
9. **Packages:** U0 with the removal of hold-and-drag is R6; U1 is R7; U2 and U4 are R8; U3 (Home/CAS rows) is R11; U5 and U7 with the theme setting are R12; U6 is deferred. The order is milestone 4a (backlog).
