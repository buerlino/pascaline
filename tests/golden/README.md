<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Golden cases (D8)

One format, one folder. Each file is YAML with one flow mapping per case line:
`id`, the input (`input`, or `latex` / `eq` `var` `guess`), `settings`, `oracle` (an inline expression),
`expect`, `source`, `g2`, `status`, `note`. `source` is one of `device`, `virtual-calc`, `oracle`,
`derived`, `assumed` (CLAUDE.md); `assumed` needs a `g2:` item.

| File | Cases | What |
|---|---|---|
| `home.yaml` | 123 | exact-first Home, STD 12 digits (3 `assumed`: tie rule, G2 item 8; 1 `device`: G2 item 16) |
| `solve.yaml` | 23 | Solve strategy (nearest root to the guess) |
| `bench.yaml` | 55 | benchmark inputs (timing set; 14 `derived` values checked) |
| `parser.yaml` | 296 | LaTeX to Giac round trip for our parser (4 known gaps) |
| `g2.yaml` | 18 items | G2 checklist questions and answers; `spike/G2-CHECKLIST.md` is generated from it |

```bash
python3 -m venv tests/golden/.venv && tests/golden/.venv/bin/pip install mpmath==1.3.0 pyyaml==6.0.2   # once
tests/golden/.venv/bin/python tests/golden/oracle.py          # check expect values and the format
tests/golden/.venv/bin/python tests/golden/oracle.py --write  # fill expect for source: oracle
tests/golden/.venv/bin/python tests/golden/oracle.py --g2     # regenerate spike/G2-CHECKLIST.md
(cd app && npm run golden)                                    # the gate: interrupt, home, solve, bench, parser
(cd app && GIAC_MJS=<other>/giac.mjs npm run golden)          # gate another engine build
(cd app && node scripts/compare-engines.ts <a/giac.mjs> <b/giac.mjs>)   # list output differences between builds
```

**Recording a G2 answer:** put it in `g2.yaml` (`answer` with who and when, `source: device`), re-tag the
linked `assumed` cases (change `expect` if needed), then run `oracle.py --g2`. Never delete an answer.
