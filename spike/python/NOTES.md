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

## Pyodide ("Python+" optional pack)
- Version **314.0.7** (Python 3.14, MPL-2.0), the full release tarball from GitHub (`pyodide-314.0.7.tar.bz2`, 337,536,678 B, sha256 `192b5864e6e6d30ab074861af800cb8b4acb0998ef0f9342c3367448aeb86645`) unpacked to gitignored `_build/pyodide/`. Loaded from local files (`indexURL`), no CDN. The npm `pyodide` package has the same loader but not the package wheels.
- Download sizes (`pyodide-sizes.mjs`; wheels and the stdlib are already zip-compressed, so only the wasm shrinks):

| Part | raw | gzip | brotli |
|---|---|---|---|
| core (`pyodide.asm.wasm` 9.6 MB, `pyodide.asm.mjs` 1.25 MB, `python_stdlib.zip` 2.5 MB, loader, lock) | 13.53 MB | 6.33 MB | 5.46 MB |
| numpy | 2.96 MB | 2.92 MB | 2.91 MB |
| sympy + mpmath (+numpy) | 7.58 MB | 7.47 MB | 7.43 MB |
| **pack: core + numpy + sympy + mpmath** | **21.1 MB** | **13.8 MB** | **12.9 MB** |
| scipy (+numpy), not bundled | 16.99 MB | 16.74 MB | 16.69 MB |

- Start time, **Node 22 on the laptop (desktop only; the host was shared with other workers, load average 3-5)**, medians of 5 runs after one warm-up (`pyodide-node-bench.mjs`):

| Step | ms |
|---|---|
| `loadPyodide` (core) | 1,806 (earlier run 2,284; with load 2,585-2,887) |
| `loadPackage(numpy, sympy)` | 686 |
| `import numpy, sympy` + one factor + one det | 4,428 (sympy import is almost all of it) |
| total, ready to compute | 6,929 (earlier run 8,829) |
| numpy only, total | 4,516 under load |
| core only, total | 2,588 under load |

- Against the Q4 criterion (under about 4 s after install): core alone passes on the desktop and core+numpy is borderline (4.5 s under load); **core+numpy+sympy fails (about 7 s)** even on the desktop, and a low-end tablet will be several times slower. Recommendation: Python+ ships numpy; sympy is not worth bundling because Giac already is our CAS; load sympy only on demand (user opts in), and snapshotting (Pyodide memory snapshots) is the thing to try if start time matters. The Tab One run still has to be done (through annabell) once there is a shell that serves the pack.
