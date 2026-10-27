<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Golden cases (D8)

One format, one folder. Each file is YAML with one flow mapping per case line:
`id`, the input (`input`, or `latex` / `eq` `var` `guess`), `settings`, `oracle` (an inline expression),
`expect`, `mark`, `source`, `g2`, `status`, `note`. `source` is one of `device`, `virtual-calc`, `oracle`,
`derived`, `reference`, `assumed` (CLAUDE.md); `reference` is a published value with its citation in `note` (the CODATA cases), neither derivable nor an oracle's; `assumed` needs a `g2:` item. Solve and Function cases also use `kind`
and `f` `g` `x0` `lo` `hi` `a` `b` `xs`; inputs and `expect` may be lists (one value per unknown, root,
or table cell; an oracle returns a list). In those two files `status: "warn"` means the case must raise
the ⚠, and every other case must not.

| File | Cases | What |
|---|---|---|
| `home.yaml` | 479 | exact-first Home, STD 12 digits (no `assumed` case: the G2's differing answers are `derived` with a note, items 8 and 43, G45; 1 `device`: G2 item 16); every number has a `mark:` (`⚠` for unaudited functions, a non-number that holds a float, G27, an undecided decision, or Giac's [exact, numeric] pair, G39; G47 pins the `round`/`trunc`/`normald_icdf` displays); a refusal (G39) expects its message; 21 are the accuracy cases of Find tier-0 functions, derived and checked by `oracle.py` |
| `precision.yaml` | 518 (1 `pending`) | docs/04 section 2.3 regression list (#2–#6, #9, #17) and the 20/30-digit `oracle` cases; `settings: { digits: N }`; `kind: cas` for the CAS view (`beforeHome:` runs inputs in Home first, `uses:` lists the stored names the result must report, G20); mark-only cases (no `expect`) for results whose true digits are out of reach |
| `solve.yaml` | 55 | Solve: 1-D (nearest root to the guess), systems (`kind: system`), polynomials (`kind: poly`) |
| `function.yaml` | 28 | Function app: Plot analysis (root, extremum, intersection, slope, area) and Num table rows |
| `bench.yaml` | 57 | benchmark inputs (timing set; 14 `derived` values checked) |
| `units.yaml` | 166 | the unit view (G16, P15): the formula with its unit slots on the Find index's factors; value, mark, `exact` (Giac's exact text, checked by `oracle.py` against the oracle), `dim` (the dimension key) and, with an end slot, `si` (the SI value's exact text, against `si_oracle`), or the refusal's `message`; `to` is the end slot. Needs the Find index (`npm run index`). The gate also holds the desktop p95 of an evaluation to ≤ 5 ms |
| `parser.yaml` | 623 | LaTeX to Giac round trip for our parser (2 known gaps, `status: gap`; group "palettes" 39); `error: true` cases must be rejected, `chips:` gives the chip table |
| `calls-baseline.yaml` | 2 totals | G52: Giac calls per Enter at 12 digits, summed over the bench inputs (CAS) and home.yaml's single inputs (Home), with the commit they were taken on. The gate's `calls` stage prints both totals and the five largest, and fails when a total is more than 10 % above its value. Raising a value is a one-line change and the package's report must give the reason |
| `invariants-known.yaml` | 0 | G43: the invariants the gate's `invariants` stage finds failing today, each with its package. The stage runs every `home.yaml` and `precision.yaml` input without settings (312 distinct, angle-only-setting cases with no angle function included, no expected values): (a) no angle function: same mark and text in RAD and DEG (252 inputs); (b) 12 and 30 digits round to the same 12-digit text (254); (c) the copy text read back by the paste reader gives the same text and no weaker mark (259); (d) `X:=input` in one mode, `X` in the other shows what the store line showed (505 runs, both directions). It passes when the failures are exactly the listed ones: a new failure, or a listed one that now passes, fails it. About 46 s on the desktop (limit 60) |
| `sweep-known.yaml` | — | G61: the oracle sweep's failures today (`app/scripts/sweep.ts`), each with the package whose fix removes it |
| `seqsweep-known.yaml` | — | G62: the sequence sweep's failures today (`app/scripts/seqsweep.ts`), each with its backlog id |
| `viewsweep-known.yaml` | — | G63: the view sweep's failures today (`app/scripts/viewsweep.ts`), each with its backlog id |
| `casback-known.yaml` | — | G64: the CAS check-back's failures today (`app/scripts/casback.ts`), each with its backlog id |
| `findcensus-known.yaml` | — | G110: the census of Find's tier-1 functions (`app/scripts/findcensus.ts`): each function's classes in Home and CAS |
| `giaccheck-known.yaml` | — | A19: the inputs of Giac's own check suite whose answer differs on our build (`tools/probes/giac-check.mjs`) |
| `corpus.yaml` | 199 inputs, 6 sequences | G55: everyday engineering inputs with **no expected values** (rounding, statistics, distributions, trig, complex, physics formulas, stored names and functions, lists and run-once assignments), one per line under an area comment, plus short `sequences` run in order. Not a gate: `app/scripts/behaviour-diff.ts <treeA> <treeB>` runs it, with the single inputs of `home.yaml`, `precision.yaml` and `bench.yaml`, through two trees (Home and CAS, 12 and 30 digits, RAD and DEG) and prints every input whose display, mark, warn or why differs; "none" when equal; about 170 s |
| `g2.yaml` | 71 items (13 unanswered: 41, 42, 52, 56, 63–71, backlog "Needs the user" 3; items 8, 29 and the real-G2 spot checks are still worth a device check) | G2 checklist questions and answers; `tests/golden/G2-CHECKLIST.md` is generated from it |

**Marks (docs/04 section 2.4).** In `home.yaml` and `precision.yaml` every case whose `expect` is a number has `mark:`.
`oracle.py` derives it: `=` when the oracle value equals the shown text exactly, `≈` when the text is rounded. `⚠` is
never derived: it is written by hand for functions whose result the engine cannot confirm, and needs a `note`.
A case with a mark and no `expect` is mark-only (the gate checks the mark, and that an answer came back: a number, or a
non-number that holds a float, never the input echoed back).

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
(cd app && npm run golden)                                    # the gate: interrupt, steps, flags, home, precision, solve, function, bench, calls, invariants, units, parser
(cd app && GIAC_MJS=<other>/giac.mjs npm run golden)          # gate another engine build
(cd app && node scripts/compare-engines.ts <a/giac.mjs> <b/giac.mjs>)   # list output differences between builds
```

**Recording a G2 answer:** put it in `g2.yaml` (`answer` with who and when, `source: device`), re-tag the
linked `assumed` cases (change `expect` if needed), then run `oracle.py --g2`. Never delete an answer.
