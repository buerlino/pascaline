<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# R4: open-source building blocks still to choose

**Status (2026-10-21): reference.** R4, the open-source blocks checked on 2026-10-10; the chosen ones are pinned in `THIRD_PARTY.md`.

Checked 2026-10-10 by ron. Versions and "last published" dates are from the npm registry. Sizes are what an
esbuild `--bundle --minify` build of the package's main entry gives (tree-shaken, CSS and fonts excluded), then
`gzip -9`. They are indicative: real numbers come with the real app. "GPL ok" means the licence can be combined with
our GPL-3.0-or-later code. Nothing here has been run on the Tab One; the one on-device number we have is that
loading 4 MB of JS (Compute Engine) took about 1.2 s there, so every kilobyte below counts on the low-end device.

## 1. Units and conversions
| Candidate | Version | Licence | min / gzip | Last published | Notes |
|---|---|---|---|---|---|
| **Giac's own units** (`_m`, `convert(…,_km)`, `mksa`) | in our wasm | GPL-3.0+ | 0 extra | n/a | tested below |
| js-quantities | 1.8.0 | MIT | 32 kB / 9.6 kB | 2023-08 | small, no maintenance since 2023 |
| UnitMath | 1.1.1 | Apache-2.0 (GPL ok) | 31 kB / 8.8 kB | 2024-10 | |
| convert-units | 2.3.4 | MIT | 25 kB / 7.0 kB | 2025-07 | conversion only, no unit algebra |
| math.js (units only) | 15.2.0 | Apache-2.0 | 236 kB / 70 kB (full: 753 kB / 207 kB) | 2026-04 | heavy, brings its own number types |

Giac check (desktop, our GSL build): `convert(1_km,_m)` gives `1000.0_m`; `convert(60_mph,_km/_h)` gives
`96.56064_(km*h^-1.0)`; `convert(1_mile,_km)` gives `1.609344_km`; `2_ft+3_inch` gives `2.25_ft`. Gaps: temperature
(`convert(37_C,_F)` fails, because `_C` is the coulomb and offset scales like °C and °F are not supported), and the exponent
text `^-1.0` is ugly. Both are display and table issues we would have to handle with any library.

**Recommendation: Giac's built-in units, plus a small table of our own for temperature offsets and for how units are
displayed and picked.** It adds no bytes, keeps one number pipeline (exact fractions stay exact), and the same units
work inside CAS expressions. If a gap proves too deep, take UnitMath (smallest of the algebra-capable ones) rather than math.js.

## 2. Decimal fallback (when the Giac exact-first path is not enough)
| Candidate | Version | Licence | min / gzip | Last published | Notes |
|---|---|---|---|---|---|
| **decimal.js** | 10.6.0 | MIT | 32 kB / 12.9 kB | 2025-07 | arbitrary precision, sin/cos/ln/exp/pow, configurable rounding |
| decimal.js-light | 2.5.1 | MIT | 14 kB / 6.0 kB | 2022-06 | no trig, no maintenance |
| bignumber.js | 11.1.5 | MIT | 20 kB / 8.7 kB | 2026-07 | arithmetic only (+ sqrt, pow with integer exponent) |
| big.js | 7.0.1 | MIT | 6.9 kB / 3.0 kB | 2025-06 | arithmetic only, tiny |

Giac itself (MPFR at higher precision, which gorge's guard already re-evaluates in) is the first fallback and costs
nothing. Gorge's Q3 has not run yet, so we don't know whether a JS fallback is needed at all.

**Recommendation: add nothing until Q3 shows a gap. If one appears, decimal.js** (the fallback CLAUDE.md already
names): it is the only one here that also covers the elementary functions, it's actively published, and 13 kB gzip is small.
big.js is enough only if the fallback is limited to `+ − × ÷` and powers.

## 3. Spreadsheet grid
| Candidate | Version | Licence | min / gzip | Last published | Notes |
|---|---|---|---|---|---|
| **Own thin grid** (virtualised DOM or canvas, formulas through Giac) | – | ours | est. small | – | est.: a few hundred lines; nothing measured |
| Jspreadsheet CE | 5.0.4 | MIT (LICENSE file; no `license` field in package.json) | 486 kB / 131 kB | 2025-08 | full spreadsheet UI; its own formula engine (formula.js) |
| Tabulator | 6.6.1 | MIT | 457 kB / 105 kB | 2026-09 | a data table, not a spreadsheet; formulas not included |
| HyperFormula (formula engine only, no UI) | 3.5.0 | GPL-3.0-only (GPL ok, since the combined work is GPL-3.0) | 811 kB / 178 kB | 2026-10 | would duplicate Giac's evaluation and use JS floats |
| x-data-spreadsheet | 1.1.9 | MIT | not measured | 2022-05 | unmaintained |
| Handsontable | 18.1.2 | proprietary / non-commercial licence | – | – | **not usable** |
| Univer | 1.0.4 | Apache-2.0 | not measured (very large) | 2026-10 | full office suite, far beyond our needs |

Why not a library: the cells' values must come from Giac (exact, 12 digits, same display rules as Home), so a
library's formula engine would be bypassed, and the heavy ones cost 100+ kB gzip on first use. What we need is
about 26 columns by a few hundred rows, cell selection, touch scrolling, and a recalculation order.

**Recommendation: write a thin grid ourselves** (virtualised, with the dependency order done by a small topological sort),
with Giac as the formula evaluator. If the Spreadsheet app needs to ship earlier than the grid can be written,
Jspreadsheet CE is the stop-gap to try; I have not tested its touch behaviour or how well it works with our own formula path.

## 4. Code editor (Python and Giac programs)
| Candidate | Version | Licence | min / gzip | Last published | Notes |
|---|---|---|---|---|---|
| **CodeMirror 6** (`@codemirror/view` 6.43.14, `state` 6.7.6, `lang-python` 6.2.1, meta package `codemirror` 6.0.2) | see left | MIT | core only (view + state + commands + keymap, no language): 275 kB / 89 kB; with `basicSetup` + Python: 464 kB / 154 kB | 2026-02 to 2026-10, active | modular, built with phones in mind |
| Ace | 1.44.0 | BSD-3-Clause (GPL ok) | not measured | 2026-05 | older architecture, weaker mobile story |
| Monaco | 0.57.0 | MIT | several MB | 2026-09 | desktop editor, not for a phone |

**Recommendation: CodeMirror 6, as planned.** Build the editor from individual extensions (`basicSetup` pulls in more
than a calculator needs, e.g. search and autocomplete) and **lazy-load it with the Python app**, so Home never pays for it. It is
also the one place where the system keyboard is wanted: Python code is typed on the device keyboard, unlike Home entry.
Giac-language highlighting can be a small custom StreamLanguage later.

## 5. Result rendering (Giac `latex()` output)
| Candidate | Version | Licence | min / gzip | Render time | Notes |
|---|---|---|---|---|---|
| **MathLive static renderer** (`convertLatexToMarkup`) | 0.111.1 | MIT | no extra: it is inside the MathLive bundle we already load (840 kB / 227 kB; importing only this function saves just 8 kB) | 1.05 ms (n=300, node) | same fonts and look as the entry line |
| KaTeX | 0.19.0 | MIT | 268 kB / 77 kB | 0.45 ms | faster, but a second copy of nearly the same renderer |

Test: four typical Giac `latex()` strings (an `\mathrm{atan}` call, a fraction with a root, `\frac{1}{6}\cdot \pi ^{2}`,
and a 2×2 `array` matrix) rendered without error in both. Two things apply to either: Giac writes `\mathrm{atan}`
where `\arctan` would read better, and it leaves plain parentheses `(x+1)` inside fractions. A small post-processing pass
over Giac's LaTeX (a rename table plus a parenthesis tidy) is needed whichever renderer we pick. Never show raw `caseval` text.

**Recommendation: render results with MathLive's `convertLatexToMarkup`.** It's zero extra bytes (MathLive is needed for entry anyway), results
and the entry line then look the same, and 1 ms per result is fine. Switch to KaTeX only if profiling on the Tab One shows result
rendering matters, or if the entry field is ever dropped.

## Summary
| Need | Pick | Added size |
|---|---|---|
| Units | Giac built-in + own temperature table | 0 |
| Decimal fallback | nothing yet; decimal.js if Q3 fails | 0 (13 kB gzip if needed) |
| Spreadsheet grid | own thin grid, Giac as formula engine | small, not measured |
| Code editor | CodeMirror 6, lazy-loaded with Python | ~90 to 150 kB gzip, only when used |
| Result rendering | MathLive static renderer | 0 |

## Method
Sizes: `esbuild --bundle --minify --format=esm` on `import … from "<package>"` (CSS, fonts, wasm excluded), gzip level 9, packages
installed fresh in a scratch folder. Giac units and `latex()` strings: `giac_eval` on the current engine/giac/_out/gsl build.
Render times: node 22, 300 renders of one string, one machine; indicative only.
