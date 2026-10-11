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
See the end of this README for behaviour the reference showed that differs from a default
already recorded in `docs/decisions.md`. These are **not** applied to app code or defaults by
this integration — they're left for the next shift to weigh.
