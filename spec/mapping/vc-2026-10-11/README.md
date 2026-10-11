<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Virtual Calculator mapping run: 2026-10-11

Raw notes from a black-box mapping session against the official HP Prime Virtual Calculator,
run under the clean-room rules in [CLAUDE.md](../../../CLAUDE.md) (observe behaviour only; no
HP artwork, help text or manual text copied). Every value in `spec/keyboard.yaml` and
`tests/golden/` tagged `source: virtual-calc` and `fw: "2.4.2.15751"` traces back to the files
in this folder.

**Reference used:** HP Prime Virtual Calculator software **2.4.2, revision 15751**, CAS 1.5.0,
MicroPython 1.9.4. The brief originally called for firmware 2.4 build 15515 (the user's real
G2); the mapper stopped at the version check as instructed, and the user approved rev 15751 as
the reference for this run (see `vc-LOG.md`). Everything here is tagged with the firmware it was
actually observed on, not the brief's target build.

## Files
- `vc-LOG.md` — the mapper's running log: setup, the version-mismatch stop and user approval,
  settings touched and restored, the one accidental Help-key press (nothing recorded from it),
  problems encountered, and the final report with counts per section.
- `vc-PROGRESS.md` — final status: all sections done, end state of the emulator.
- `vc-SPOT-CHECK.md` — the mapper's own 10+2 spot-check picks (superseded for G2 purposes by
  `SPOT-CHECK.md` one level up, written for this integration).
- `g2-answers.yaml` — 16 answers to `tests/golden/g2.yaml` checklist items (items 5 and 16 were
  already answered on the real G2 and were skipped).
- `keys.yaml` — 59 rows: every physical key's primary/shift/alpha/shift+alpha layer, plus 7
  findings rows on Textbook entry, letters and Ans insertion.
- `home.yaml` — 123 Home cases + 10 Textbook-entry re-runs.
- `cas.yaml` — 55 CAS cases.
- `solve.yaml` — 23 Solve cases.
- `settings.yaml` — Home/CAS settings pages, number formats, entry modes.
- `menus.yaml` — Math/CAS/App toolbox tab contents and the 910-name flat Catalog (names and
  inserted text only, no descriptions — see the clean-room note below).
- `apps.yaml` — the 18 apps, their views and setup screens.

## Clean-room note on `menus.yaml`
The Catalog and toolbox listings record **command names and the text each one inserts into the
entry line** — both are behaviour, not expression, and Giac (GPL) defines most of these names
itself. No menu *description* text, and no help-page text, was copied; see `vc-LOG.md` for the
one place Help opened by accident (nothing was read from it).

## Differences from our defaults
Behaviour the reference showed that differs from something we already assumed or decided.
**None of these are applied to app code or `docs/decisions.md` by this integration** — the next
shift weighs them. Golden-case `expect` values that embody a deliberate default of ours were
left unchanged even where the reference disagrees (per the integration brief, a changed value
that would now fail stays here instead of being forced).

### Keyboard (`spec/keyboard.yaml`)
- **Alpha case is reversed.** Our header (lines 16-17) and every letter-bearing key say alpha =
  lowercase, shift+alpha = uppercase. The reference does the opposite: Alpha gives A-Z, Shift+Alpha
  gives a-z (`vc-2026-10-11/keys.yaml` r8c1, r9c1, "letters-layers" finding).
- **Letter-to-key order can't be mapped 1:1.** The reference spreads A-Z (and then #, :, quotes,
  `;` once letters run out) across ~26 of its ~50 row-4-to-9 keys in its own order; our keyboard
  has a different physical key count and row layout, so the per-key alpha assignments (`sin: a`,
  `cos: b`, … `d0: z`) stay our own choice.
- `menu` (line ~31): no clean reference match — r3c4 "Menu" opens Get from Home/CAS/Messages;
  r4c2 (unlabelled toolbox icon) opens the Math/CAS/App/Catalog toolbox. Neither is "the current
  view's menu" as we define it.
- `cancel` (line ~36): not confirmed — the reference's On key was not tested while a computation
  was running. See `SPOT-CHECK.md`.
- `app` (lines ~37-38): no clean reference match for a single Home/CAS-toggle-plus-Settings key.
- `up` (line ~45): on the reference, Up on an empty entry line selects the last history row; ours
  only moves within the math field (`keys.yaml` id `up`).
- `abs` (lines ~49-50): the reference reaches |x| via Shift of the +/− key (r6c2); we have a
  standalone key.
- `lpar`/`rpar` (lines ~80-81): the reference has one key, "( )", that inserts a matched pair; we
  have two separate keys.
- `frac` ("a/b" key, lines ~105-119): **not just a layout difference.** On the reference, the key
  literally labelled "a b/c" (r4c5) does not insert a fraction template while typing at all — it
  cycles the *last Home result's display form* (decimal → stacked fraction → mixed number → …).
  The reference's typing-time fraction template is its ÷ key (our `div`, already `source: device`
  and unaffected). This is exactly backlog item **L2** and the subject of G2 item 17/item 2's
  answer; `keys.yaml` row `r4c5`.
  **Correction (user, 2026-10-11):** this cycling was the user's own script (User key mode was
  locked), not the stock key. The stock a b/c behaviour is open (G2 item 29); L2 stays as built.
- `pi` (lines ~120-128): the reference has π as Shift of the "3" key (r9c4) and e as Shift of LN
  (r5c5); we combine both on one key.
- `i` (lines ~183-191): the reference has i as Shift of the "2" key (r9c3); we have a standalone
  key, and its shift (∞) has no reference equivalent there.
- `comma` (lines ~130-131): the reference's Shift+comma inserts `EVAL()`, not a store arrow; store
  (`▶`) is Shift of its EEX key (r7c1) instead.
- `dot` (lines ~194-201): the reference's Shift+"." inserts "=", not scientific notation; scientific
  entry goes through a separate EEX key (r7c1, primary inserts the exponent mark `ᴇ`) that our
  layout has no equivalent of.
- `sub` (line ~182): primary (subtraction) matches r9c5, but the reference has a *separate*
  negation key (+/−, r6c2) that we don't have; we rely on parsing `-` for both roles.
- `enter` (lines ~204-205): primary (evaluate) matches r6c5, but the reference's Shift+Enter
  inserts `approx()`, not `=`.

### Home / CAS behaviour (`tests/golden/home.yaml`, `tests/golden/solve.yaml`)
- `cx-sqrt-4` (home.yaml:127, g2 item 9), `cx-asin2` (home.yaml:137, g2 item 10): the reference
  raises "Error: Invalid input" for `sqrt(-4)` and `asin(2)` in real/default mode; our Home
  deliberately returns a complex result instead. Left unchanged.
- `cx-cbrt-neg8` (home.yaml:138, g2 item 11): the reference gives the real root `-2` for
  `(-8)^(1/3)`; our default gives the complex principal root `1+1.73205080757*i`. Left unchanged
  (same question as G2 item 4).
- `rnd-tie-pos`/`rnd-tie-neg`/`rnd-tie-small` (home.yaml:36-38, g2 item 8): the reference looks
  like half-to-even at 12 digits; our default is half-away-from-zero. The mapper flagged the
  reference reading itself `unsure` (rounding may happen at paste-time, not at display), so this
  was **not** forced into the golden `expect` values — see G2 item 8's answer for the caveat.
- `no-real-root` (solve.yaml:29, g2 item 13): the reference returns the guess value with message
  "Error: Extremum found", not a "no root found" text; ours is a deliberate UX choice, left
  unchanged.
- `pole-no-root` (solve.yaml:31, g2 item 14): the reference returns a huge finite value with
  message "Zero" and no pole mention; ours deliberately says "no root found". Left unchanged.
- `exp-no-root` (solve.yaml:30): same class as the two above — the reference returns a large
  negative finite value (`-1,149.15867377`) with message "Zero" for `exp(x)=0`, which has no
  solution; ours deliberately says "no root found". Left unchanged.
- `cubic-nearest` (solve.yaml:17, g2 item 12): the reference's displayed root is
  `0.347296355335`, one ULP away from our oracle value `0.347296355334`; likely the reference's
  own solver's last-digit rounding, not a bug — noted, not changed.
- `triple-root-2` (solve.yaml:25) and `cos-touch` (solve.yaml:28): for a double/triple root with
  no sign change, the reference's own numeric solver stops near but not at the exact root
  (`1.99999999998` with message "Error: Extremum found" for `(x-2)^3=0`; `1.92013295984e-6` for
  `cos(x)=1`) and names it an extremum. We deliberately polish to the exact root via Giac and
  don't raise that message; left unchanged. Cross-checks the rest of `cases: 1-D` exactly
  (`lambert-xexp`, `cube-root-2`, `dottie`, `sqrt2-pos/neg`, `ln-e`, `quintic`, `kepler`,
  `lambert-small`, `exp-big`, `tan-pole`, `double-root-0/1`, `triple-root-0`, `tiny-root`): all
  match our existing `oracle`/`derived` values. `sqrt-9` and `scale-small` match up to the
  reference's own floating display noise (`8.99999999998` vs our exact `9`).

### Function app defaults (G2 items 23, 24)
- Plot window: reference default is `X Rng -15.9..15.9`, `Y Rng -10.9..10.9`; we assumed
  `[-10,10]` on both axes.
- Num view: reference default `Num Step 0.1`; we assumed step `1`. `Num Start 0` matches.
- No golden case currently encodes the window/step default, so nothing needed updating; flagged
  here for whoever adds one.
