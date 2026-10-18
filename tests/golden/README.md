<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Golden cases (D8)

One format, one folder. Each file is YAML with one flow mapping per case line:
`id`, the input (`input`, or `latex` / `eq` `var` `guess`), `settings`, `oracle` (an inline expression),
`expect`, `mark`, `source`, `g2`, `status`, `note`. `source` is one of `device`, `virtual-calc`, `oracle`,
`derived`, `assumed` (CLAUDE.md); `assumed` needs a `g2:` item. Solve and Function cases also use `kind`
and `f` `g` `x0` `lo` `hi` `a` `b` `xs`; inputs and `expect` may be lists (one value per unknown, root,
or table cell; an oracle returns a list). In those two files `status: "warn"` means the case must raise
the ⚠, and every other case must not.

| File | Cases | What |
|---|---|---|
| `home.yaml` | 147 | exact-first Home, STD 12 digits (3 `assumed`: tie rule, G2 item 8; 1 `device`: G2 item 16); every case has a `mark:` (67 `=`, 77 `≈`, 3 `⚠`: a non-number that holds a float, G27); 21 are the accuracy cases of Find tier-0 functions, derived and checked by `oracle.py` |
| `precision.yaml` | 103 (102 active, 1 `pending`) | docs/04 section 2.3 regression list (#2–#6, #9, #17) and the 20/30-digit `oracle` cases; `settings: { digits: N }`; `kind: cas` for the CAS view (`beforeHome:` runs inputs in Home first, `uses:` lists the stored names the result must report, G20); mark-only cases (no `expect`) for results whose true digits are out of reach |
| `solve.yaml` | 42 | Solve: 1-D (nearest root to the guess), systems (`kind: system`), polynomials (`kind: poly`) |
| `function.yaml` | 25 | Function app: Plot analysis (root, extremum, intersection, slope, area) and Num table rows |
| `bench.yaml` | 55 | benchmark inputs (timing set; 14 `derived` values checked) |
| `units.yaml` | 116 | the unit view (G16, P15): the formula with its unit slots on the Find index's factors; value, mark, `exact` (Giac's exact text, checked by `oracle.py` against the oracle), `dim` (the dimension key) and, with an end slot, `si` (the SI value's exact text, against `si_oracle`), or the refusal's `message`; `to` is the end slot. Needs the Find index (`npm run index`). The gate also holds the desktop p95 of an evaluation to ≤ 5 ms |
| `parser.yaml` | 529 | LaTeX to Giac round trip for our parser (2 known gaps, `status: gap`; the gate prints 527/529; group "palettes" 39); `error: true` cases must be rejected, `chips:` gives the chip table |
| `g2.yaml` | 31 items (all answered by the Virtual Calculator; items 8, 29 and the real-G2 spot checks are still worth a device check) | G2 checklist questions and answers; `tests/golden/G2-CHECKLIST.md` is generated from it |

**Marks (docs/04 section 2.4).** In `home.yaml` and `precision.yaml` every case whose `expect` is a number has `mark:`.
`oracle.py` derives it: `=` when the oracle value equals the shown text exactly, `≈` when the text is rounded. `⚠` is
never derived: it is written by hand for functions whose result the engine cannot confirm, and needs a `note`.
A case with a mark and no `expect` is mark-only (the gate checks the mark, and that an answer came back: a number, or a
non-number that holds a float, never the input echoed back). The gate
checks marks from EN3-engine on, when the engine result carries one; until then it only counts them.

**Pending.** `status: "pending"` (precision.yaml) marks a regression case written before its fix. The gate runs
it, lists it as still pending or `NOW PASSING`, and never fails on it. The package that fixes it removes the status.

**Digits.** `settings: { digits: N }` sets the significant digits of a case (default 12); `oracle.py --digits N` changes the
default for cases without it. The oracle is evaluated at N+20 and N+50 digits and must agree.

The gate also runs `tests/engine/interrupt-test.mjs` (16 forced interrupts, Giac patch 0002).

```bash
python3 -m venv tests/golden/.venv && tests/golden/.venv/bin/pip install mpmath==1.3.0 pyyaml==6.0.2   # once
tests/golden/.venv/bin/python tests/golden/oracle.py          # check expect values and the format
tests/golden/.venv/bin/python tests/golden/oracle.py --write  # fill expect for source: oracle
tests/golden/.venv/bin/python tests/golden/oracle.py --g2     # regenerate tests/golden/G2-CHECKLIST.md
(cd app && npm run golden)                                    # the gate: interrupt, home, precision, solve, function, bench, units, parser
(cd app && GIAC_MJS=<other>/giac.mjs npm run golden)          # gate another engine build
(cd app && node scripts/compare-engines.ts <a/giac.mjs> <b/giac.mjs>)   # list output differences between builds
```

**Recording a G2 answer:** put it in `g2.yaml` (`answer` with who and when, `source: device`), re-tag the
linked `assumed` cases (change `expect` if needed), then run `oracle.py --g2`. Never delete an answer.
