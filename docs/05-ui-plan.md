<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# UI plan: screens, menus and workflows

**Reference: the screens as built** (milestone 4a, R6–R12 and the packages after them); a point not built says so. The keys themselves are `spec/keyboard.yaml` and [06-keypad-vs-g2.md](06-keypad-vs-g2.md); the order of the open packages is [shifts/brief.md](shifts/brief.md). The plan of 2026-10-13 and the owner's review of it (section 7) are folded in; the section numbers stay, since code cites them.

## 0. In one paragraph

One interaction model for every surface above the keypad: one sheet for every list (3.1), one status line for the place and the state (3.2), one row of soft keys for a picked history row (3.3), Mode and Settings as levels of the same sheet (3.4). Find, the unit view and the template palette are built on them. The keypad's layout does not change here (P4, P8).

## 1. What the screenshots show (2026-10-13)

The ten findings on the screenshots of 2026-10-13, all fixed (U0, R6–R8; `app/test/u0.spec.ts` and `Sheet.svelte` cite them by number); text in git at `6550cc93`.

## 2. Design rules for the screen

These sit under the three principles in CLAUDE.md and decide the details below.

1. **The keypad drives everything.** Every screen, list and dialog can be used with keys alone. Touch is a shortcut, never the only way (the G2 habit, and the fastest way on a phone held in one hand). A sheet over the keypad is the exception on a phone: its rows sit where the keys were, so a tap on a row is the key press, and a tap on any other key closes it (3.1, R144); a hardware keyboard drives every sheet and Settings with keys alone.
2. **One way to choose.** Every choice (apps, menus, Find, templates, settings values, history actions) uses the same sheet with the same keys (section 3.1). Learn it once.
3. **State is always visible.** Angle mode, format, digits, Shift/Alpha, a running job and the current place are always on screen, in the same spot.
4. **Nothing is lost without notice.** No key goes "through" an open sheet; a dead key looks dead and gives a short haptic "no".
5. **Two keys for frequent things.** Anything an engineer does several times a day (switch DEG/RAD, copy a result, reuse a constant, change format) takes at most 2 key presses or 1 tap. The EN0 benchmark measures it.
6. **No motion that waits.** The key press is the only motion (owner, 2026-11-02): sheets, results and marks appear at once, with no rise, fade or slide, in every setting, so `prefers-reduced-motion` has nothing to turn off. A pressed key shows at once, in every family, in Plain keys and under High contrast.
7. **Our own look.** Our colours, shapes and icons; nothing traced from the reference (CLAUDE.md, clean room).

## 3. The interaction model

### 3.1 One sheet for every list (replaces `PickList`)

A pick sheet (Apps, every Menu, Mode, Tmpl, the Shift palettes) rises over the keypad's maths rows (rows 3–9), anchored at the keypad's bottom edge where the thumb is, and sized to its rows. It never covers the top cluster (rows 0–2); a tap on any of its keys closes the sheet and does nothing else, and Esc goes back one level (R144). The table is the hardware keyboard's; no key moves (docs/03 rule 8). A pick closes it and the user goes on typing; a tap in the viewport, or on a maths key a short sheet leaves visible (dimmed), closes it. A list that takes letters (Find, any filtered list) stays above the keypad, over the history or view, because its query needs the letter keys. Inside a sheet:

| Key | Action |
|---|---|
| ▲ ▼ | Move the highlight; the list scrolls to keep it in view |
| 1…9, 0 | Pick item 1–10 directly (Shift and Alpha are ignored while a sheet is open) |
| Enter | Pick the highlighted item |
| ▶ | Open a submenu (shown with `›`) |
| ◀ or Esc | Back one level (submenus stack; the title shows the path, e.g. `Plot › Intersection`) |
| Letter keys | Type-ahead filter, for lists longer than 10 items: a tap on a key that is not a digit types its letter (no Alpha press needed); a flick down types the letter on any key, digits included |
| ☰, the place, Tmpl | Close the sheet they opened (the same control opens and closes it) |

There is no hold-and-drag (P11); the sheet keys never mention it.

- **Remembers the last pick** per sheet: reopening a menu highlights the item used last, so a repeated action is Menu + Enter (2 keys).
- **Fit, then scroll:** rows and grid cells shrink to the room, from their normal size down to a floor (list rows 36 px, grid cells 44 px); only below the floor does the sheet scroll, with a fade at the cut edge and a count ("7 items") in the title row. A grid has no title row: its title and × share the hint line. Shift + 6 draws each cell over the key that picks it (7 8 9 ÷ / 4 5 6 × / 1 2 3).
- **Disabled items** stay in place (numbers never shift) and say why on a second line, once for a run of neighbouring rows with the same reason, under the last of them ("Define a function first").
- Built once as `Sheet.svelte` plus a small model (`items`, `submenu`, `lastPick`, `filter`). Find (EN1), the template list (EN5), Base (EN6), the Units suggestions (EN2) and Settings values all use it. Find adds its preview pane and ranking but keeps the same keys.

### 3.2 A status bar instead of the tab row

The header row (`App.svelte` `<header>`) becomes a slim status bar, one line, at most 28 px (docs/03 rule 9):

```
 [⌂]▾ Home                ⇧   RAD   STD 12   ☰
 [ƒ]▾ [f=|∿|▦]            α   DEG   ENG 6    ☰
```

- **Left: where you are and the way out** (R82f2, the mockup `mockups/status-line.html` at `3856ad4d` sections 1–3). The place's glyph tile and ▾ open the Apps sheet (1 Home, 2 CAS, then the apps); Home and CAS show their name beside it; the target is at least 48 × 28 px (R15b). In an app, the views Symb, Plot and Num follow as one segmented control of icons, the current one filled. Busy, or the engine starting, is a ring on the tile.
- **Glyphs** (R84, the mockup `mockups/status-line.html` at `3856ad4d` section 5): every place has one glyph in the registry (`app/src/apps/registry.ts`), maths-font text or an inline SVG, at most three characters, not used by another place. The status line's tile and the Apps sheet's rows (between number and name) draw the same glyph, so the list teaches what each means. A new app brings its glyph with its registry entry; the mockup's Statistics `x̄`, Sequence `uₙ`, Parametric `x(t)` and Polar `rθ` are examples, not decisions.
- **Right: the state and the mode chips.** A fixed slot shows ⇧ or α once (underlined when locked, `a` when Alpha types lower case), then angle (`RAD`/`DEG`, coloured when not the default), format and digits. **A tap on a chip toggles or cycles it** (angle: 1 tap; format: opens the Mode sheet at that row). DEG/RAD is one tap. **At the right end ☰ opens the view's menu**, or the picked history row's menu; every ☰ menu ends with Settings (item 10 in Home and CAS, key 0).
- Height freed by the tabs goes to the history (about 30 px on a phone).

### 3.3 A context bar of soft keys (the screen's own row of keys)

One row of up to 6 touch buttons directly above the entry line. Its content follows the context. The keypad stays the same; this is screen space. The G2 has the same kind of on-screen menu row, so it fits the muscle memory, in our own design.

| Context | Soft keys |
|---|---|
| Home/CAS, entry line has text | none, the row is hidden (no clutter while typing) |
| Home/CAS, a history row picked (▲ on an empty line) | Insert · Recall · Copy · Store ▶ · Delete |

- **Home and CAS history rows only** (owner, 2026-10-13): Function and Solve are frozen, the Python app is removed, and the unit slots (P11) replace the prefix row, so the unit view's prefix cells are the only prefix entry (docs/04 2.7). The row appears only when a row is picked, never while typing; its row actions are built so results mode (P16, R53) can reuse them.
- Tap targets at least 44 px high; a label of at most 8 characters; an item with a submenu shows `›`.
- Home/CAS (R11): the picked row's buttons are items 1–5 of the Menu's list of nine (S2), so ☰ + 1 is the same as a tap on Insert. A long press on a row opens the same nine on that row.

### 3.4 The Mode sheet and Settings

One sheet, split by how often a thing changes (owner, 2026-10-27; the picture: [mockups/settings.html](mockups/settings.html)):

- **Mode** (the format pill opens it on Format, the digits chip straight on its list of digits, Shift + Fmt on Angle): Angle, Format, Significant digits, Entry, then Preset (R89) and Settings ›. Angle, Format and Entry show every value as buttons: a tap sets the value and closes the sheet; ◀ ▶ on a hardware keyboard move the mark with the sheet open; a digit (or a tap on the row's name) steps the value forward; Enter closes. Buttons stand only where they save a press (format and entry 3 → 2 taps; digits 3 → 2 through the chip); every other value keeps its ◀ ▶ row. Digits open their list (4 6 8 10 12 15 20 25 30, the current one marked) on a digit, Enter or a tap; ◀ ▶ still step by one. With no chip, Mode opens on Angle. DEG ↔ RAD: one tap on the chip, or Shift, Fmt, then DEG or RAD; 20 digits: the digits chip, then 20, or Shift, Fmt, 3, 7.
- **Settings** (Mode's last row, every ☰ menu's last row; Shift, Fmt, 6): the next level of the same sheet over the keypad's maths rows, not a page over everything, so the top cluster stays uncovered (Esc goes back, U1–U6 go to their rows in Your keys, any other tap closes it, R144). Digits pick a section, ▶ or Enter opens it, ◀ or Esc goes back one level onto the same row, × or a tap above the sheet closes it, Android back goes back one level; the title shows the path (`Mode › Settings › Numbers`; its last three levels when deeper). A level can be a text to read (a licence, R87): it scrolls, ▲ ▼ page it, ◀ and Esc go back. Seven sections in this order, each level of settings at most seven rows of 44 px so it fits the 380 px at 372 × 767 (a level that is a list, Your keys' slots or the unit pad's cells, scrolls, as the mockup draws it; Opus pass 64): Appearance (built, R50e), Numbers (the decimal mark R57, the Fmt key cycle › with its five ticks, the decimals of Fixed, Uncertainty R40, Marks R124, Digit groups R125), Key vibration (with Try it), Your keys (U1–U6 on every layer, built as in the mockup, R4b; the unit pad's cells R24d), Data (backup and restore R38a, R38b; library import and export R59; its last row says whether the data is kept, R96: "Kept on this device", "Kept, but the browser may delete it: save a backup" or "Not saved: changes are lost when the app closes", with "Last backup: <date>" under it once a backup was saved), Counters (every removal-test count: R9, R70, R53, R89), Help and about (first-start tips R15c4; version, source and licences R87). A section whose package has not landed is left out. A value row steps with ◀ ▶ and its 44 px buttons; ticks and switches toggle and stay; a pick in a list closes the sheet, except the theme list, which stays so the screen above shows the theme. No native `<select>`, no long-press shortcuts (owner, 2026-10-27).
- **Numbers › Decimal mark** (R57), the level's first row: Point (default) or Comma, a value row stepped by < > or a tap. With the comma the . key shows and types , (MathLive's {,}, never a list comma), the , key shows and types ; (the argument separator), and a hardware . or , types the mark. Results, Copy and Paste use the comma; list elements are separated by ;. ᴇ after the mark types no 1 (3,ᴇ3 is 3.ᴇ3), after ; it types 1ᴇ. The keys never move: only the two faces change, as the Alpha faces do.
- **Numbers › Uncertainty** (R40): Muted digits, σ on tap (the default) or Muted digits. A result from a constant with a CODATA uncertainty draws the digits past its σ (G26's `uncDigits`) muted; a tap on the row shows `σ = … · U = 2σ = … (k = 2)` under it, one row at a time. Copy, chips and the entry line keep every digit.
- **Numbers › Marks** (R124): three buttons, Muted (every mark in the muted colour), ⚠ coloured, ⚠ + reason (the default): a ⚠ row carries R36's line under it in the warn colour, one line ellipsed, its full text on a tap; the line's place is there from the row's first frame. The unit view follows: σ's why-line shows with ⚠ + reason only.
- **Numbers › Digit groups** (R125): three buttons, thin space (default), apostrophe, comma, for the groups of a drawn result (Home, CAS, the unit view, Solve's and Function's readouts): the thin space groups the digits on both sides of the point (3.141 592 653 59), the apostrophe and the comma only those before it (1,234,567.89123; π as 3.14159265359; R125f1, the owner 2026-11-04); Copy, chips and the entry line have none. With the decimal comma the comma's button is off and the row says why; a stored comma draws as the thin space.
- **Presets** (R88, R89): a named snapshot of any of five groups, each a tick, all ticked when saved: Mode, Numbers, Appearance, Key vibration, Your keys. Mode's Preset row applies the next one with ◀ ▶ and lists them on a tap (`Mode › Presets`: pick one, save the current setup, edit); a preset's page holds its ticks, Update, Rename and Delete; a name is typed in the entry line under an entry label. The fixed keys never change; the free keys switch with the preset. A switch shows a notice naming what changed; nothing saves by itself (after a later change the name carries a dot).
- Mode goes on Shift + Fmt, one of the free Shift cells (docs/04 5.1; built, R85). Apps, Menu and the views are on the status line since R15c1, so the old Shift + Apps path is gone, and the Home and CAS cells hold free keys (R15b).

### 3.5 History rows

- A thin divider between entries (R12b; the 8 px more space is S25 part 3's); input muted and left-aligned, result right-aligned (as now).
- A long result or input scrolls sideways with a fade at the edge that shows there is more; never cut without a sign.
- The picked row (▲ from an empty line) gets the context bar from 3.3, so its actions are visible, not hidden behind a long press.
- An error row shows the message on one line. Not built: the part of the input that failed underlined when the parser knows its position (`History.svelte` draws the message only).
- Clear history and Delete (R98): Clear (Shift + Esc on an empty line, ☰ Clear history) removes the finished and error rows only; a running row stays with its Cancel, so Esc still stops it and Enter is refused while it runs. Clear and Delete keep what they took (rows and places, one level, stored with the history so a relaunch keeps it), and a note row says "History cleared · Undo" or "Row deleted · Undo"; a tap on it puts the rows back.
- One Undo order (R98 with P13): on an empty line Undo first takes the Clear or Delete copy while there is one, then the line's own undo (P13: the line cleared by Enter or Esc); Redo is always the line's own. On a non-empty line Undo is always the line's own, and the copy waits for an empty line. The next Enter, or a second Clear, drops the copy. Each view keeps its own copy: only that view's Enter or second Clear drops it (R119). On a hardware keyboard Ctrl+Z is the Undo key and Ctrl+Y or Ctrl+Shift+Z the Redo key (Cmd on a Mac; R119).

### 3.6 Find (EN1): the screen

docs/04 §3 sets the behaviour; R4a and R4b built this layout:

- A sheet (3.1) that stays above the keypad, since its query takes the letter keys. The query on top, then the results, then a preview pane for the highlighted item, fixed at the bottom so it does not jump (`Sheet.svelte`, `find-preview`).
- **An empty query shows the G2-style Math menu: fixed categories in a fixed order** (P11, docs/03 rule 8), so the same keys always reach the same function; typing filters it; no recents and no usage ranking. A later idea (owner): the user rearranges the menu's slots; a personal order stays put, so it fits rule 8. Not scheduled.
- Each row: the item's title, its first name on the right (`finder.ts` `itemRow`). Not built: a kind badge (fn, const, unit, var) in its own colour and shape.
- **While Find is open a tap on a key types its letter in lower case** (docs/04 3.7), so Alpha is not needed; a flick down shows and types the letter on any key. The faces stay as they are (`Keypad.svelte` `face` reads no sheet), where the plan of 2026-10-13 had them show the lower-case letters (to verify: ron, on the gallery's Find state).
- Preview: constant: symbol, value, unit, uncertainty or "exact"; unit: dimension and SI factor; function: syntax, one example, "not checked" for tier 1.

### 3.7 The keypad: look only

The layout stays. Only the drawing changes:

- **Legends get their own space**: every key reserves a legend line above the face; Shift legend top-right, Alpha top-left (as now), the face lower. In the top cluster the faces become shorter where they would not fit: `Home/CAS` → `Home` with the CAS key beside it, or the face shrinks to fit (one rule: never cut, never overlap).
- **Contrast at least 4.5:1** for every face and legend in every layer and every theme. A test computes it from the CSS tokens.
- **Dead keys** (today `special: none`) dim only in the layers where they do nothing. A press on one gives a short double haptic and no other effect.
- **Key vibration is one pulse per touch, at finger-down**: a trackpad step, an armed flick and a held ⌫'s repeat make none; a dead key's double pulse is the only second pulse (owner, 2026-11-02, R112).
- **The unit view's ⌫ and More… (R118):** ⌫ on an empty slot steps back to the slot before, as on the entry line (its next ⌫ removes that slot's last token); on the first slot it is a dead key. Shift + ⌫ is dead in a slot (no cursor, nothing after the last token). More… opens Find on the dimension's units; the end slot and the result stay until a unit is picked, so Esc there leaves the view as it was.
- **Press feedback** within one frame: the key darkens while the finger is down (keys fire on lift because of flicks, P11, so the feedback must start on touch).

*Built in R6 (2026-10-13): the legend line, the fit rule (faces and legends shrink, `app/src/keyboard/fit.ts`) and the contrast test (`app/src/style.test.ts`); dead keys dim per layer. The double haptic on a dead key came with R13 (2026-10-13): Menu in Symb, Tmpl in Plot, Fmt in an app, `special: none` keys and typing in Plot.*

### 3.8 Errors and empty states

- Every empty state says what to do next in one line and never covers content: Plot with no function shows its hint in a box above the axes.
- Error messages name the problem and the fix: "Units don't match: L vs T", "Angle is in degrees; result uses DEG". No error codes.

### 3.9 Tablet and landscape

Deferred (owner, 2026-10-13): not G2 flow and not a friction the owner has hit (docs/03 rule 5). The app stays a centred column of at most 720 px (`App.svelte` `.app`).

### 3.10 Look and feel

- **Design tokens** (one file, already partly in `style.css`): colours per role, the type scale (entry 28, result 26, input 22, UI 15, legend 11), spacing on a 4 px grid, radii. No colour or size written directly in a component. Built (R12b): the tokens are in `app/src/style.css`; `src/tokens.test.ts` fails on a literal colour or size in a `.svelte` file.
- **Appearance** (owner, 2026-10-13 and 2026-10-18, decisions.md "R50"): a family (N62: black or white with the logo's teal #529997 and an orange Shift; Teal: N62 inside out, the whole screen in the logo's teal with near-black keys; Solarized on the owner's grounds #2d4056 and #ffffd6; R140, R150), a brightness System / Light / Dark (default **Dark on Android**, **System in the PWA**), and the switches High contrast and Plain keys. Built (R50e); the mockup's radio rows are ticks in the app (the sheet's convention). Shift, Alpha, Fmt, ⌫ and the pad have the other keys' colour (`--key-ctl` is `--key-fn`); the Shift and Alpha labels are drawn in their layer's colour, an armed key fills with it (label `--on-shift` / `--on-alpha`, black or white), a locked one adds a 3 px outline. The generator keeps Shift and Alpha at least 0.12 apart (OKLab after the Machado 2009 matrices, three deficiencies) and ⚠ 0.08 from Shift; 0.10 and 0.06 in High contrast (`app/scripts/cvd.ts`). Legends on the keys may have their own colour (`--key-text`, `--key-shift`, …; R150): Teal Dark draws #ff9a33 and #529997 on its keys and #5c3a00 and #04282a for Shift and Alpha on its screen, and its ≈, ⚠ and error marks near-black, carried by their glyphs (principle 3). Plain keys turns the colour off and changes nothing else. A legend that types a variable (the Alpha letters, x, y, a Greek letter a layer types) is italic in every mode, as the entry line draws it (ISO 80000-2); function names, units, numbers and constants are upright, and nothing on the keys is bold (R142).
- **Numbers:** one maths font for entry and results (MathLive's). UI text in the system font. Monospaced digits in tables (Num, Solve, the Find value column) so columns line up.
- **App glyphs:** one per place, drawn in the status line and the Apps sheet (3.2, R84).

## 4. Work packages (built)

U0–U7 were built as R6 (U0, with the UI gallery: `npm run gallery` renders every view, sheet and layer in light and dark into `app/test/gallery/`), R7, R8, R11 and R12; U6 (tablet) is deferred (3.9). Text in git at `6550cc93`.

## 5. How we know it works

- **Keystrokes:** the task benchmark (docs/03 section 6, `tests/tasks/tasks.yaml`). Not done: its five UI tasks (switch DEG/RAD, copy the last result, reuse the result before last, trace a root in Plot, change digits to 20) are not in `tasks.yaml`; rule 5 of section 2 sets their budget, 2 presses or 1 tap.
- **Real users:** the outside test, [research/r18-outside-test.md](research/r18-outside-test.md). **The look:** the gallery (section 4). **Feel on the device:** a sheet and a key's feedback within one frame on the Tab One, measured with `?bench` (`app/src/keypadBench.ts`, A4a).

## 6. Decisions for the owner

Decided on 2026-10-13 (the status bar, the soft keys, Mode and Settings, the theme default; the keys of point 3 were replaced by P12). Text in git at `6550cc93`.

## 7. Changes from the owner's review (2026-10-13)

Folded into section 3 on 2026-11-06 (text in git at `6550cc93`). Where each point went, for the code that cites it: 1 Find's Math menu → 3.6; 2 the soft keys on Home and CAS rows only, the unit slots in place of the prefix row → 3.3; 3 the status bar at most 28 px → 3.2; 4 tablet deferred → 3.9; 5 no hold-and-drag and 6 letters in sheets → 3.1; 7 the theme setting → 3.10; 8 the decisions → section 6; 9 the packages → section 4.
