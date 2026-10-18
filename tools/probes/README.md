<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Probes: check a claim against the code, the engine and the data

Small read-only scripts that answer "what does it actually do today?" without the app or a device. They were
written for the architecture pass ([docs/04-architecture.md](../../docs/04-architecture.md), Appendix A) and are
kept so every claim there can be rerun. They are tools, not tests: a finding becomes a golden case or a unit test
before anything is fixed (CLAUDE.md). Output goes to `tools/probes/_out/` (gitignored); nothing here is shipped.
Background on the pipelines they probe: [docs/research/r6-pipelines.md](../../docs/research/r6-pipelines.md).

Run from the repo root. The engine probes need a built engine (`engine/giac/build-wasm.sh`, or `GIAC_OUT`/`GIAC_MJS`)
and `app/node_modules` (`cd app && npm ci`); Node 22 runs the `.ts` files directly.

| Probe | What it answers | Example |
|---|---|---|
| `engine.ts` | what Home shows for an input (path, display, value, flags), what CAS returns, or a raw Giac call | `node tools/probes/engine.ts 'normald_icdf(10^-10)'`; `MODE=cas …`; `MODE=raw …`; `DIGITS=30 …`; `FACTS=1 …` adds the mark facts (`exactRational`, `reliableDigits`, `warn`, `full`; in CAS `numeric`) |
| `bound.ts` | which CAS commands quote their variable: each input with x free and after Home `x:=3`, same result or not (G28: the names `uses` skips) | `node tools/probes/bound.ts ['limit(1/x,x,0)' …]` |
| `parse.ts` | what our LaTeX parser sends to Giac for keyboard LaTeX, or why it refuses | `node tools/probes/parse.ts '0xFF' '4.7k'` |
| `digits-cost.ts` | desktop time and path changes of the 123 `home.yaml` inputs at several digits settings | `DIGITS_LIST=12,20,30 node tools/probes/digits-cost.ts` |
| `qalc/link.sh`, `qalc/run.mjs` | libqalculate's exactness flags, name collisions and silent non-answers (needs the P3 spike's static libraries; the link takes the host-cpu lock, about a minute) | `tools/probes/qalc/link.sh` then `node tools/probes/qalc/run.mjs '72 km/h to m/s' 'mu0'` |
| `find/extract.py`, `find/rank.mjs` | size of a rough Find index from the pinned tarballs, and the per-key cost and first hits of a tiered ranking | `python3 -I tools/probes/find/extract.py` then `node tools/probes/find/rank.mjs speed kph` |
| `unit-presses.mjs` | presses to type 50 common units into a unit slot (`spec/keyboard.yaml` `unit_slot:`; median, worst ten, untypable symbols, tasks), and with a qalc build how qalc reads each unit and its wrong-case slips ([R7](../../docs/research/r7-unit-slots.md)); `--pad` counts the same units on the proposed unit pad (`spec/unit-pad.yaml`, [R9](../../docs/research/r9-unit-pad.md)) | `node tools/probes/unit-presses.mjs [--taps\|--lower-lock\|--pad\|--pad --taps]`; `… --read BTU lbm` |
| `g2-units.mjs` | each unit of Xcas's units menu (Giac's own definition from our build) against our Find index: the same unit, another size, or missing; finds Giac sizes to report upstream and units Find lacks (the menu itself is built from Find: [spec/units-menu.yaml](../../spec/units-menu.yaml)) | `node tools/probes/g2-units.mjs [--json]` |
| `units-giac.mjs` | P15's check (G15): the unit view's cases on Giac with the Find index's exact factors and one symbol per base dimension, against qalc's own answers and the oracle; the mismatch, temperature, logarithmic and angle checks, first-order uncertainty with `diff`, desktop timing, and the units without an exact factor with what each needs (needs the Find index, a qalc dev build and the oracle venv) | `node tools/probes/units-giac.mjs [--md]` |
| `start-chunk.mjs` | the start chunk (entry plus static imports) built with source maps: raw and gzip bytes and the raw bytes per source, largest first (R35; builds into `_out/start-chunk/`, about a minute) | `node tools/probes/start-chunk.mjs [--top=N] [--no-build]` |
| `menu-presses.mjs` | presses to pick each cell of the Tmpl palette and of R18's Shift + 6 and Shift + 9 palettes, by keys (the sheet's own grid moves), by the key at a cell's place and by touch ([R8](../../docs/research/r8-menus.md)) | `node tools/probes/menu-presses.mjs [--cells]` |
| `results-geometry.mjs` | S9's results mode ([R13](../../docs/research/r13-results-mode.md)): the keypad's, entry line's, action line's and a history row's heights at the Pixel 7 profile (Vite with `?engine=fake`), the viewport share with a collapsed keypad, and the ten tasks' presses with the keypad up and collapsed | `node tools/probes/results-geometry.mjs [--counts]` |
| `library.ts`, `library/` | S4's function-library file ([R10](../../docs/research/r10-connector.md)): reads and checks a library (stamp, encoding, definitions only, no state-changing bodies, built-in and own names, descriptions), defines it through `cas()` as if typed, runs its `// test:` lines; the replay time of 200 definitions (median of 5, desktop; take the host-cpu lock); an export of a typed log and its re-import. `library/` holds one good file and thirteen bad ones, each refused for one reason | `node tools/probes/library.ts check tools/probes/library/beams.txt`; `… replay`; `… export` |
| `replay-cost.mjs` | G29: the cost of the definitions replay (docs/04 8.3, bar 50 ms at 200): the `?bench=defs` log (150 values, 50 functions) on the dev engine in Node: time per entry kind, the per-call floor, batches of 10/50/200, and `EngineHost.restore` itself with its engine calls | `node tools/probes/replay-cost.mjs [runs]` |

**Oracle values** (never from memory): `tests/golden/.venv/bin/python -I -c "import mpmath as m; m.mp.dps=40; print(m.ncdf(-6))"`
(set the venv up once as in CLAUDE.md).

**Rules:** read-only against the repo (they write only to `_out/`); no network; downloaded tarballs are read
after their SHA-256 is checked; heavy work (the qalc link) takes the host-cpu lock (`tools/devlock.sh`).
