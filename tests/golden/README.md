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
| `home.yaml` | 123 | exact-first Home, STD 12 digits (3 `assumed`: tie rule, G2 item 8; 1 `device`: G2 item 16); every case has a `mark:` (52 `=`, 71 `≈`), derived and checked by `oracle.py` |
| `precision.yaml` | 34 (21 active, 13 `pending`) | docs/04 section 2.3 regression list (#2–#6, #9) and the 20/30-digit `oracle` cases; `settings: { digits: N }`; `kind: cas` for the CAS view; mark-only cases (no `expect`) for results whose true digits are out of reach |
| `solve.yaml` | 42 | Solve: 1-D (nearest root to the guess), systems (`kind: system`), polynomials (`kind: poly`) |
| `function.yaml` | 25 | Function app: Plot analysis (root, extremum, intersection, slope, area) and Num table rows |
| `bench.yaml` | 55 | benchmark inputs (timing set; 14 `derived` values checked) |
| `parser.yaml` | 355 | LaTeX to Giac round trip for our parser (2 known gaps, `status: gap`; the gate prints 353/355); `error: true` cases must be rejected, `chips:` gives the chip table |
| `python.yaml` | 23 (1 `pending`) | MicroPython with `calc` and the graphics modules on the same Giac build |
| `g2.yaml` | 31 items (all answered by the Virtual Calculator; items 8, 29 and the real-G2 spot checks are still worth a device check) | G2 checklist questions and answers; `tests/golden/G2-CHECKLIST.md` is generated from it |

**Marks (docs/04 section 2.4).** In `home.yaml` and `precision.yaml` every case whose `expect` is a number has `mark:`.
`oracle.py` derives it: `=` when the oracle value equals the shown text exactly, `≈` when the text is rounded. `⚠` is
never derived: it is written by hand for functions whose result the engine cannot confirm, and needs a `note`.
A case with a mark and no `expect` is mark-only (the gate checks the mark, and that the answer is still a number). The gate
checks marks from EN3-engine on, when the engine result carries one; until then it only counts them.

**Pending.** `status: "pending"` (precision.yaml, python.yaml) marks a regression case written before its fix. The gate runs
it, lists it as still pending or `NOW PASSING`, and never fails on it. The package that fixes it removes the status.

**Digits.** `settings: { digits: N }` sets the significant digits of a case (default 12); `oracle.py --digits N` changes the
default for cases without it. The oracle is evaluated at N+20 and N+50 digits and must agree.

The gate also runs `tests/engine/interrupt-test.mjs` (16 forced interrupts, Giac patch 0002).

```bash
python3 -m venv tests/golden/.venv && tests/golden/.venv/bin/pip install mpmath==1.3.0 pyyaml==6.0.2   # once
tests/golden/.venv/bin/python tests/golden/oracle.py          # check expect values and the format
tests/golden/.venv/bin/python tests/golden/oracle.py --write  # fill expect for source: oracle
tests/golden/.venv/bin/python tests/golden/oracle.py --g2     # regenerate tests/golden/G2-CHECKLIST.md
(cd app && npm run golden)                                    # the gate: interrupt, home, precision, solve, function, bench, parser, python
(cd app && GIAC_MJS=<other>/giac.mjs npm run golden)          # gate another engine build
(cd app && node scripts/compare-engines.ts <a/giac.mjs> <b/giac.mjs>)   # list output differences between builds
```

**Recording a G2 answer:** put it in `g2.yaml` (`answer` with who and when, `source: device`), re-tag the
linked `assumed` cases (change `expect` if needed), then run `oracle.py --g2`. Never delete an answer.
