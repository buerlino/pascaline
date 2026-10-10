<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Python runtimes (spike step 6, Q4), sandra

## MicroPython-wasm (default runtime)
- Source: upstream `micropython/micropython` tag **v1.29.0** (`0fd6c573ea815774668bbb16b8e197c8822368b2`), MIT. `ports/webassembly`, variant `standard`, built with the repo's emsdk 6.0.12 by `build-micropython.sh` (clones into gitignored `_build/`, output in `_out/standard/`).
- Size (`-Os` defaults of the port, unmodified): `micropython.wasm` 1,116,714 B raw, 482,961 B gzip -9, 328,226 B brotli -11; `micropython.mjs` 239,629 B raw, 59,766 B gzip. (Giac for comparison: see RESULTS.md.)
- Start time, **Node 22 on the laptop (desktop only, not a device number)**: `loadMicroPython()` + first `runPython` median **11.3 ms** (n=7, min 7.5, max 41.5). Browser and Tab One numbers still to do (via annabell).
- `calc` bridge (`node-bench.mjs`): `mp.registerJsModule("calc", { cas })`, where `cas(expr)` posts a message to a Giac worker and returns a Promise. In Python: `r = await calc.cas("factor(x^2-1)")` under `runPythonAsync` gives `(x-1)*(x+1)`; round trip median **1.18 ms** (n=7, Node worker_threads, warm).
  - `solve(x^2=2,x)` returns the raw caseval text `list[-sqrt(2),sqrt(2)]`, so `calc` needs a result parser (as noted in the plan: never show raw caseval).
- Consequence for the API: the bridge is **async** (`await calc.cas(...)`). A synchronous `calc.cas(...)` would need the Python runtime in its own worker plus `SharedArrayBuffer`/`Atomics.wait`, which needs cross-origin isolation (COOP/COEP); check whether the Capacitor shell can serve those headers before committing to it. Alternative: let a tiny preprocessor turn `calc.cas(` calls into awaits.
- Language check: `math`, `cmath`, `random`, `json`, `re`, `collections` import fine. Gap found: `cmath.sqrt(-1)` gives `6.123233995736766e-17+1j` (not exact `1j`), so complex maths in user programs should go through Giac where it matters.
- Giac's own bundled `micropython-1.12/` (in the Giac 2.1.0 tarball, 2804 files) is a plain MicroPython 1.12 tree with `ports/{javascript,minimal,stm32,unix,windows}` plus a `micropython_emscripten.tgz`. It is nearly 14 releases older than 1.29, so we use upstream and keep it only as a reference (not built).
