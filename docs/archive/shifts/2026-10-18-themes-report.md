<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Themes (R50): the owner's pick, and what the packages need (2026-10-18)

For the session that writes the work packages. It replaces the plan "R50b writes one picked palette into `style.css`" with a theme set: five families, each light and dark, and two switches. The owner saw the mockup on the phone and said: "it's amazing, exactly like I wanted it" (2026-10-18). Everything below is decided. Only section 6 is still open.

## 1. What was decided (owner, 2026-10-18)
1. **A theme is a family plus a brightness.** The families are Pascaline (default), Graphite, Solarized, Gruvbox and Nord, each in light and dark. Brightness is System / Light / Dark, the setting R12c already planned. The defaults stay Dark on Android and System in the PWA (docs/05 3.10).
2. **High contrast is a switch that works on every family, not a family of its own.** It deepens the backgrounds, puts all text at 7:1 (dead faces 4.5:1) and draws a 1.5 px outline in `--line` round every key and the round pad, at 3:1 against the screen. It is on at first start when the system asks for more contrast (`prefers-contrast: more`); after that the setting decides. R50a's separate "High contrast" palette and its "Slate" palette are dropped. Nord covers the cool blue-grey look.
3. **Plain keys** (the owner asked for a "no syntax" mode) removes colour coding from the keys:
   - every key gets one neutral tone, with the digit block one step brighter;
   - Shift and Alpha legends take the text colour;
   - **bold always means Shift** (the legend, the faces while Shift is on, the sheet numbers);
   - **italic always means Alpha** (the letter legend in the maths font, the faces while Alpha is on);
   - Enter is inverted (text colour on the screen colour), and a key that is on, the focus and the picked row use the text colour.

   Two exceptions keep their colour. **⚠ and error text**, because of principle 3: a warning must never blend in. **Plot curves**, because they need colour to be told apart.
4. **Pascaline** is a new family, our own, built from the logo (`logo/`: ink blue `#0025b5` / `#000c3c`, amber `#ffbf00`). Shift is the amber of the P and Enter is the logo blue. Graphite is R50a's grey, refined.
5. **Borrowed palettes change only where they fail our contrast rules, and only in lightness (the hue stays).** Solarized moves 7 colours (its accents are low-contrast by design), Nord 5 and Gruvbox 3. `node tools/probes/themes-audit.mjs --fixes` lists each one.
6. The entry line is 52 px tall in the mockup (feedback #54). R12b owns that change.

This answers feedback #53 and #55. The decisions.md entry ("R50: themes", as Choice / Why / Would change if) is still to write. Point 1 above is the Choice. **Why:** one interaction model with no extra keys; the setting R12c planned grows into a single Appearance page. **Would change if:** a family is not used in four weeks (the removal test; the family goes), or the startup-size budget forbids lazy theme files.

## 2. The source of truth
- **The mockup:** [../mockups/themes-r50.html](../mockups/themes-r50.html) (published copy: claude.ai/artifact/MZ5N19jZ2ggMn2NiEo5uvw). It draws the real keypad (the R3 cluster, then rows 3–9 of `spec/keyboard.yaml`) with history, a Menu sheet, Shift on, Alpha on, and the **Settings › Appearance** page as the owner will see it: Theme as radio rows with five swatch dots, Brightness as a three-way control, then High contrast and Plain keys as switches with one line of explanation each.
- **The values and the rules:** [../../tools/probes/themes-audit.mjs](../../../tools/probes/themes-audit.mjs) contains the same code as the mockup's script:
  - `FAMILIES`: the base values per role;
  - `base()`: the contrast floor;
  - `highContrast()` and `plain()`: the two transforms;
  - `checks()`: every pair the app draws.

  It prints 40/40 pass. Use `--css` to print every combination as a CSS block. Keep the probe and the mockup in step until the generator (R50c) owns the code.
- **The roles:** today's tokens in `app/src/style.css` plus six new ones, listed in R50a: `--approx` (≈), `--warn` (⚠), `--pick` (the picked row), `--focus` (focus ring and caret), `--key-on` and `--on-key-on` (a key that is on).
- **The contrast rules** (from `style.test.ts`, extended):

  | Pair | Normal | High contrast |
  |---|---|---|
  | Text, muted text, legends, marks, the picked row, chips, sheet rows | 4.5:1 | 7:1 |
  | Dead faces and disabled rows | 3:1, and at least 1 below a live face on the same key | 4.5:1, and at least 1 below a live face |
  | Focus against the screen; key outline against the screen | 3:1 | 3:1 |

## 3. Facts in the code that the packages must handle
- **The token file:** `app/src/style.css` holds dark in `:root` and light in `@media (prefers-color-scheme: light)` (71 lines). There is no theme attribute yet, and nothing reads `prefers-contrast`.
- **The contrast test parses exactly those two blocks** (`app/src/style.test.ts:16-18`). It has to read every theme block instead. The best design builds the pairs from the same `checks()` list.
- **Colours written directly in components** (they break in light or in another family):
  - `app/src/App.svelte:887`: `--selection-background-color: #36506b` (MathLive's selection); `:886` already uses `var(--shift)` for the caret, which should become `--focus`;
  - `app/src/views/History.svelte:279`: `color: #fff` on `--error` (the prominent Cancel);
  - `app/src/apps/function/FunctionPlot.svelte:116`: trace point `#fff`, invisible on light themes.
- **Plot curves:** `CURVE_COLORS` (`app/src/apps/function/app.svelte.ts:17`) is one list for every background, and no test checks it. Check the curves against each family's `--bg`, non-text 3:1. Any that fail need a darker or lighter list per brightness.
- **Keypad colour rules for Plain keys** (`app/src/keyboard/Keypad.svelte`):
  - legends at `:422` and `:425`;
  - faces under Shift and Alpha at `:428` and `:431`;
  - a key that is on at `:444-457`;
  - the flick bubble at `:459` (border and text in `--shift`; in Plain keys, bold text).

  Plain keys adds a class or attribute on the root that switches weight and style, not colour. `.key:active` (`:368`) uses `filter: brightness(1.4)`, which R12c's press feedback replaces anyway.
- **Startup:** settings live in IndexedDB (`app/src/state/storage.ts`), which can only be read asynchronously. Without care, the first frame shows the default theme and then flips. The recommendation is to mirror the four values into `localStorage` and apply them in a few lines of inline script in `app/index.html` before `main.ts` runs. `app/index.html:16-36` already has an inline script. Also update `<meta name="theme-color" content="#1f2a44">` at `:8`, so the PWA's bar follows.
- **Size:** only Pascaline (light and dark) may sit in the start CSS. The other four families and the two transforms go in lazy CSS loaded when chosen, so the start chunk stays within budget (`app/scripts/size-check.ts:93`: 156 kB raw, 54 kB gzip). Report the numbers.
- **The Settings page:** R49 builds the rows-with-pages pattern. Appearance becomes one row (`Appearance   Pascaline · Dark ›`). `app/src/views/modeSheet.ts:87` already names "Theme (R12c)" as a later row.
- **Android system bars:** there is no `@capacitor/status-bar` and no native code that sets their colour (`android/app/src/main/res/values/styles.xml`). See section 6.
- **Licences:** Solarized (Ethan Schoonover), Gruvbox (Pavel Pertsev) and Nord (Arctic Ice Studio) are all MIT, and only their colour values are used. Add one line each to `THIRD_PARTY.md`, with the note that the lightness was adjusted. No HP material is involved (clean room).

## 4. Proposed packages
**Written as R50b–R50e (2026-10-18):** the R50c below became R50c (the generator and the families) and R50d (Plain keys and High contrast in the components); the R50d below is R50e. The package files win where they differ.

The IDs stay inside R50, so they cannot clash with the R6x and G4x numbers being written in parallel. All are ron, Sonnet, with the Opus review the rules give. Each fits one package file of 6 kB or less.

| ID | What | Lane | Starts when | Size |
|---|---|---|---|---|
| **R50b** (rewrite) | **Pascaline in the app.** `style.css` moves to `:root[data-family][data-brightness]` blocks with Pascaline dark and light (the probe's `--css` values) and the six new roles. The three direct colours of section 3 become tokens. `style.test.ts` reads every block and checks the full pair list. No setting yet: the brightness follows the system as today. | day (the owner looks at the colours on the phone) | R49 merged | ~0.5 d |
| **R50c** | **The theme generator, the four families and the two transforms.** A script (from the probe's code) writes the theme CSS; a test fails when the generated files are out of date or any of the 40 combinations fails. Lazy CSS per family; Plain keys' weight and style rules in `Keypad.svelte`, sheets and chips; the High-contrast outline; ⚠ and errors keep their colour. Plot curves are checked per brightness. THIRD_PARTY lines added. | night-safe (tests decide; nothing changes until a setting picks it) | R50b merged | ~1 d |
| **R50d** | **Settings › Appearance.** Theme, Brightness, High contrast and Plain keys, drawn as in the mockup and stored with the other settings; the `localStorage` mirror and the inline script so the first frame is right; the `theme-color` meta follows; the first-start default for High contrast from `prefers-contrast`. **This takes over R12c's theme setting.** E2e tests, by touch and by keys: each value survives a reload, and the first frame after a reload already has the stored theme (screenshot before `main.ts`'s first `await`). Gallery: every family in light and dark, plus one High-contrast and one Plain-keys set. | day (the owner tries it on the phone) | R50c and R49 merged | ~1 d |

**Changes to existing packages:**
- **R12b:** its token file is the theme CSS of R50b and R50c. It no longer chooses colours; it adds the type scale, spacing, radii and motion, and the 52 px entry line.
- **R12c:** drop "Theme setting System / Light / Dark" (now R50d). Keep press feedback, reduced motion and the sheet-rise profile. Press feedback must stay visible in Plain keys and High contrast.
- **R57:** waits for R50b as today (unchanged).
- **R41:** TalkBack reads no colour, so it is unaffected; Plain keys helps colour-blind users without it.
- **brief.md "The path":** R50b, then R50c (it can run at night), then R50d, before R12b.
- **backlog item 40:** rewrite as the three packages.
- **docs/05 3.10:** rewrite the Theme line to "Appearance: family, brightness, High contrast, Plain keys".
- **Docs budgets** (`node tools/docs-check.mjs`, 2026-10-18, with the other session's uncommitted edits): decisions.md is at 39.2 of 40 kB, so the R50 entry must be short (about 0.6 kB) and point to this report. The brief is already over its budget (26.3 of 25 kB) because of those edits, so its R50 lines must replace text, not add to it.

## 5. Gates common to the three
Typecheck, unit and e2e tests; the contrast test over all 40 combinations; `node tools/probes/themes-audit.mjs` still 40/40 until R50c replaces it (then the probe calls the generator, or is deleted with a line in the report); the gallery rebuilt; the start chunk and start CSS delta in the report (R50b at most +0.3 kB gzip, R50c +0.1 kB, R50d +0.4 kB).

## 6. Open for the owner (do not block the packages)
1. **Android status and navigation bar colours.** Matching them to the theme needs either `@capacitor/status-bar` (MIT, a new dependency) or a few lines of native code. **Recommendation:** leave this out of R50d. If the dark bar over a light theme bothers the owner on the phone, add a small annabell package.
2. **Five families or fewer.** The owner approved all five. The removal test (section 1, Would change if) trims the list later if a family goes unused.

## Files of this report
- New: `docs/mockups/themes-r50.html` (the mockup), `tools/probes/themes-audit.mjs` (the probe), one row in `tools/probes/README.md`, this file.
- Not touched: `docs/decisions.md`, `docs/backlog.md`, `docs/shifts/brief.md`, `docs/feedback.md` and the package files. Another session had uncommitted edits to the first three when this was written. The package session makes the changes of sections 1 and 4 there.
- Nothing is committed yet.
