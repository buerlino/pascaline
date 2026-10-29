<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# UI plan: screens, menus and workflows

**Accepted by the owner 2026-10-13, with the changes in section 7 (they win where this text differs). Packages and order: milestone 4a in [backlog.md](backlog.md) and [shifts/brief.md](shifts/brief.md).**

*Written 2026-10-13 (Claude, as UI reviewer, for the project owner and ron). Base: `phase-1` at 165eece. Evidence: the code (file:line) and Playwright screenshots of every view at Pixel 7 size (light theme, real engine). Effort figures are estimates. This plan does not change the keypad: which function sits on which key and layer stays as in `spec/keyboard.yaml` (P4, P8). Everything on the screen above it is open to change.*

## 0. In one paragraph

The keypad already works well. The screen above it does not yet feel like one designed product: every surface (app list, menus, Settings, history actions) behaves in its own way, important state such as the angle mode is invisible, and a few visual bugs make the keypad look unfinished. **Recommendation:** build one interaction model for every surface (one sheet component, one status bar, one context bar of soft keys), then put Find, the unit view and the template palette on top of it. Do the quick fixes (U0) and the sheet component (U1) **before EN1 Find** (milestone 4, step 8), so Find is built on the shared component and not as one more special case. Total about 12–14 days for U0–U7, spread over milestones 4–6.

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

1. **The keypad drives everything.** Every screen, list and dialog can be used with keys alone. Touch is a shortcut, never the only way (the G2 habit, and the fastest way on a phone held in one hand). A sheet over the keypad is the exception on a phone: its rows sit where the keys were, so a tap on a row is the key press, and the top cluster still moves, goes back and closes (3.1); a hardware keyboard drives every sheet and Settings with keys alone.
2. **One way to choose.** Every choice (apps, menus, Find, templates, settings values, history actions) uses the same sheet with the same keys (section 3.1). Learn it once.
3. **State is always visible.** Angle mode, format, digits, Shift/Alpha, a running job and the current place are always on screen, in the same spot.
4. **Nothing is lost without notice.** No key goes "through" an open sheet; a dead key looks dead and gives a short haptic "no".
5. **Two keys for frequent things.** Anything an engineer does several times a day (switch DEG/RAD, copy a result, reuse a constant, change format) takes at most 2 key presses or 1 tap. The EN0 benchmark measures it.
6. **No motion that waits.** Sheets appear within one frame and animate for at most 120 ms; nothing blocks input while it animates. `prefers-reduced-motion` turns animation off.
7. **Our own look.** Our colours, shapes and icons; nothing traced from the reference (CLAUDE.md, clean room).

## 3. The interaction model

### 3.1 One sheet for every list (replaces `PickList`)

A pick sheet (Apps, every Menu, Mode, Tmpl, the Shift palettes) rises over the keypad's maths rows (rows 3–9), anchored at the keypad's bottom edge where the thumb is, and sized to its rows. It never covers the top cluster (rows 0–2), whose keys keep the jobs in the table below; no key moves (docs/03 rule 8). A pick closes it and the user goes on typing; a tap in the viewport closes it; maths keys a short sheet leaves visible keep their sheet job (a digit picks its row), dimmed. A list that takes letters (Find, any filtered list) stays above the keypad, over the history or view, because its query needs the letter keys. Inside a sheet:

| Key | Action |
|---|---|
| ▲ ▼ (and the arrow trackpad) | Move the highlight; the list scrolls to keep it in view |
| 1…9, 0 | Pick item 1–10 directly (Shift and Alpha are ignored while a sheet is open: fixes finding 4) |
| Enter | Pick the highlighted item |
| ▶ | Open a submenu (shown with `›`) |
| ◀ or Esc | Back one level (submenus stack; the title shows the path, e.g. `Plot › Intersection`) |
| Letter keys | Type-ahead filter, for lists longer than 10 items: a tap on a key that is not a digit types its letter (no Alpha press needed); a flick down types the letter on any key, digits included (section 7) |
| ☰, the place, Tmpl | Close the sheet they opened (the same control opens and closes it) |

- **Remembers the last pick** per sheet: reopening a menu highlights the item used last, so a repeated action is Menu + Enter (2 keys).
- **Fit, then scroll:** rows and grid cells shrink to the room, from their normal size down to a floor (list rows 36 px, grid cells 44 px); only below the floor does the sheet scroll, with a fade at the cut edge and a count ("7 items") in the title row (fixes finding 5). A grid has no title row: its title and × share the hint line. Shift + 6 draws each cell over the key that picks it (7 8 9 ÷ / 4 5 6 × / 1 2 3).
- **Disabled items** stay in place (numbers never shift) and say why on a second line, once for a run of neighbouring rows with the same reason, under the last of them ("Define a function first").
- Built once as `Sheet.svelte` plus a small model (`items`, `submenu`, `lastPick`, `filter`). Find (EN1), the template list (EN5), Base (EN6), the Units suggestions (EN2) and Settings values all use it. Find adds its preview pane and ranking but keeps the same keys.

### 3.2 A status bar instead of the tab row

The header row (`App.svelte` `<header>`) becomes a slim status bar, one line, at most 28 px (docs/03 rule 9):

```
 [⌂]▾ Home                ⇧   RAD   STD 12   ☰
 [ƒ]▾ [f=|∿|▦]            α   DEG   ENG 6    ☰
```

- **Left: where you are and the way out** (R82f2, [mockup](mockups/status-line.html) sections 1–3). The place's glyph tile and ▾ open the Apps sheet (1 Home, 2 CAS, then the apps); Home and CAS show their name beside it; the target is at least 48 × 28 px (R15b). In an app, the views Symb, Plot and Num follow as one segmented control of icons, the current one filled. Busy, or the engine starting, is a ring on the tile.
- **Glyphs** (R84, [mockup](mockups/status-line.html) section 5): every place has one glyph in the registry (`app/src/apps/registry.ts`), maths-font text or an inline SVG, at most three characters, not used by another place. The status line's tile and the Apps sheet's rows (between number and name) draw the same glyph, so the list teaches what each means. A new app brings its glyph with its registry entry; the mockup's Statistics `x̄`, Sequence `uₙ`, Parametric `x(t)` and Polar `rθ` are examples, not decisions.
- **Right: the state and the mode chips.** A fixed slot shows ⇧ or α once (underlined when locked, `a` when Alpha types lower case), then angle (`RAD`/`DEG`, coloured when not the default), format and digits. **A tap on a chip toggles or cycles it** (angle: 1 tap; format: opens the Mode sheet at that row). This fixes finding 6 and makes DEG/RAD one tap. **At the right end ☰ opens the view's menu**, or the picked history row's menu; every ☰ menu ends with Settings (item 10 in Home and CAS, key 0).
- Height freed by the tabs goes to the history (about 30 px on a phone).

### 3.3 A context bar of soft keys (the screen's own row of keys)

One row of up to 6 touch buttons directly above the entry line. Its content follows the context. The keypad stays the same; this is screen space. The G2 has the same kind of on-screen menu row, so it fits the muscle memory, in our own design.

| Context | Soft keys (Home and CAS only: Function, Solve and the prefix row were dropped, section 7 point 2) |
|---|---|
| Home/CAS, entry line has text | none, the row is hidden (no clutter while typing) |
| Home/CAS, a history row picked (▲ on an empty line) | Insert · Recall · Copy · Store ▶ · Delete |

- Tap targets at least 44 px high; a label of at most 8 characters; an item with a submenu shows `›`.
- Home/CAS (R11): the picked row's buttons are items 1–5 of the Menu's list of nine (S2), so ☰ + 1 is the same as a tap on Insert. A long press on a row opens the same nine on that row.

### 3.4 The Mode sheet and Settings (fixes finding 7)

One sheet, split by how often a thing changes (owner, 2026-10-27; the picture: [mockups/settings.html](mockups/settings.html)):

- **Mode** (the format pill opens it on Format, the digits chip straight on its list of digits, Shift + Fmt on Angle): Angle, Format, Significant digits, Entry, then Preset (R89) and Settings ›. Angle, Format and Entry show every value as buttons: a tap sets the value and closes the sheet; ◀ ▶ move the mark with the sheet open; a digit (or a tap on the row's name) steps the value forward; Enter closes. Buttons stand only where they save a press (format and entry 3 → 2 taps; digits 3 → 2 through the chip); every other value keeps its ◀ ▶ row. Digits open their list (4 6 8 10 12 15 20 25 30, the current one marked) on a digit, Enter or a tap; ◀ ▶ still step by one. With no chip, Mode opens on Angle. DEG ↔ RAD: one tap on the chip, or Shift, Fmt, ▶, Enter; 20 digits: the digits chip, then 20, or Shift, Fmt, 3, 7.
- **Settings** (Mode's last row, every ☰ menu's last row; Shift, Fmt, 5, then 6 once presets are in): the next level of the same sheet over the keypad's maths rows, not a page over everything, so the top cluster stays live (the pad, Esc, U1–U6). Digits pick a section, ▶ or Enter opens it, ◀ or Esc goes back one level onto the same row, × or a tap above the sheet closes it, Android back goes back one level; the title shows the path (`Mode › Settings › Numbers`). Seven sections in this order, each at most seven rows of 44 px so a level fits the 380 px at 372 × 767: Appearance (R50e), Numbers (the decimal mark R57, the Fmt key's cycle, the decimals of Fixed), Key vibration (with Try it), Your keys (U1–U6 on every layer R4b; the unit pad's cells R24d), Data (backup and restore R38a, R38b; library import and export R59), Counters (every removal-test count: R9, R70, R53, R37, R89), Help and about (first-start tips R15c4; version, source and licences R87). A section whose package has not landed is left out. A value row steps with ◀ ▶ and its 44 px buttons; ticks and switches toggle and stay; a pick in a list closes the sheet, except the theme list, which stays so the screen above shows the theme. No native `<select>`, no long-press shortcuts (owner, 2026-10-27).
- **Presets** (R88, R89): a named snapshot of any of five groups, each a tick, all ticked when saved: Mode, Numbers, Appearance, Key vibration, Your keys. Mode's Preset row applies the next one with ◀ ▶ and lists them on a tap (`Mode › Presets`: pick one, save the current setup, edit); a preset's page holds its ticks, Update, Rename and Delete; a name is typed in the entry line under an entry label. The fixed keys never change; the free keys switch with the preset. A switch shows a notice naming what changed; nothing saves by itself (after a later change the name carries a dot).
- Mode goes on Shift + Fmt, one of the free Shift cells (docs/04 5.1; built, R85). Apps, Menu and the views are on the status line since R15c1, so the old Shift + Apps path is gone, and the Home and CAS cells hold free keys (R15b).

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
- **Contrast at least 4.5:1** for every face and legend in every layer and every theme (fixes finding 3). A test computes it from the CSS tokens.
- **Dead keys** (today `special: none`) dim only in the layers where they do nothing. A press on one gives a short double haptic and no other effect.
- **Press feedback** within one frame: the key darkens while the finger is down (keys fire on lift because of flicks, P11, so the feedback must start on touch).

*Built in R6 (2026-10-13): the legend line, the fit rule (faces and legends shrink, `app/src/keyboard/fit.ts`) and the contrast test (`app/src/style.test.ts`); dead keys dim per layer. The double haptic on a dead key came with R13 (2026-10-13): Menu in Symb, Tmpl in Plot, Fmt in an app, `special: none` keys and typing in Plot.*

### 3.8 Errors and empty states

- Every empty state says what to do next in one line and never covers content: Plot with no function shows its hint in a box above the axes (finding 8).
- Error messages name the problem and the fix: "Units don't match: L vs T", "Angle is in degrees; result uses DEG". No error codes.

### 3.9 Tablet and landscape

Deferred (section 7 point 4): the app stays a centred column of at most 720 px (`App.svelte` `.app`).

### 3.10 Look and feel

- **Design tokens** (one file, already partly in `style.css`): colours per role, the type scale (entry 28, result 26, input 22, UI 15, legend 11), spacing on a 4 px grid, radii, motion durations. No colour or size written directly in a component.
- **Appearance** (owner, 2026-10-13 and 2026-10-18, decisions.md "R50"): a family (Pascaline, Graphite, Solarized, Gruvbox, Nord), a brightness System / Light / Dark (default **Dark on Android**, **System in the PWA**), and the switches High contrast and Plain keys.
- **Numbers:** one maths font for entry and results (MathLive's). UI text in the system font. Monospaced digits in tables (Num, Solve, the Find value column) so columns line up.
- **App icons:** our own simple line icons in the Apps sheet beside the number and name.

## 4. Work packages (built)

U0–U7 were built as R6 (U0: the quick fixes and the UI gallery, a Playwright script that renders every view, sheet and layer in light and dark into `app/test/gallery/`, `npm run gallery`), R7 (U1, one sheet), R8 (U2 and U4, the status bar and the Mode sheet), R11 (U3, the Home/CAS row actions) and R12 (U5 and U7); U6 (tablet) is deferred (section 7 point 9).

## 5. How we know it works

- **Keystrokes:** the EN0 task benchmark counts them; five UI tasks are still to add to `tests/tasks/tasks.yaml`: switch DEG/RAD, copy the last result, reuse the result before last, trace a root in Plot, change digits to 20. Budget for each: 3 presses or 1 tap.
- **Hand test with real users:** the owner and two engineers who have never used the app do the ten benchmark tasks with no instructions; note every hesitation longer than 3 seconds and every wrong key. Each one becomes an issue. Repeat after U3 and after milestone 5.
- **The gallery** is the review tool: the owner reviews screenshots of every state in one page instead of finding them on the device.
- **Feel on the device:** sheet open and key feedback within one frame on the Tab One (annabell measures with the `?bench` hooks).

## 6. Decisions for the owner

Decided on 2026-10-13 (section 7 point 8); point 3 is replaced by P12.

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
