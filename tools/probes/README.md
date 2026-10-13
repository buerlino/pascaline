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
| `engine.ts` | what Home shows for an input (path, display, value, flags), what CAS returns, or a raw Giac call | `node tools/probes/engine.ts 'normald_icdf(10^-10)'`; `MODE=cas …`; `MODE=raw …`; `DIGITS=30 …` |
| `parse.ts` | what our LaTeX parser sends to Giac for keyboard LaTeX, or why it refuses | `node tools/probes/parse.ts '0xFF' '4.7k'` |
| `digits-cost.ts` | desktop time and path changes of the 123 `home.yaml` inputs at several digits settings | `DIGITS_LIST=12,20,30 node tools/probes/digits-cost.ts` |
| `qalc/link.sh`, `qalc/run.mjs` | libqalculate's exactness flags, name collisions and silent non-answers (needs the P3 spike's static libraries; the link takes the host-cpu lock, about a minute) | `tools/probes/qalc/link.sh` then `node tools/probes/qalc/run.mjs '72 km/h to m/s' 'mu0'` |
| `find/extract.py`, `find/rank.mjs` | size of a rough Find index from the pinned tarballs, and the per-key cost and first hits of a tiered ranking | `python3 -I tools/probes/find/extract.py` then `node tools/probes/find/rank.mjs speed kph` |
| `unit-presses.mjs` | presses to type 50 common units into a unit slot (`spec/keyboard.yaml` `unit_slot:`; median, worst ten, untypable symbols, tasks), and with a qalc build how qalc reads each unit and its wrong-case slips ([R7](../../docs/research/r7-unit-slots.md)) | `node tools/probes/unit-presses.mjs [--taps\|--lower-lock]`; `… --read BTU lbm` |

**Oracle values** (never from memory): `tests/golden/.venv/bin/python -I -c "import mpmath as m; m.mp.dps=40; print(m.ncdf(-6))"`
(set the venv up once as in CLAUDE.md).

**Rules:** read-only against the repo (they write only to `_out/`); no network; downloaded tarballs are read
after their SHA-256 is checked; heavy work (the qalc link) takes the host-cpu lock (`tools/devlock.sh`).
