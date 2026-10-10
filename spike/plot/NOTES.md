<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Plot, MicroPython and Pyodide device pages (spike steps 6 and 7, Q4 and Q6), sandra

A Capacitor-ready Vite project (same shape as `spike/app`, so `spike/tools/device-build.sh --app spike/plot` works). Three pages:

| Page | What it does | Mark logged (`PASCALINE_T`) |
|---|---|---|
| `index.html?autorun=N` | JSXGraph 1.14.0: `sin(x)`, `x^3-2x`, `1/x` (LaTeX through Compute Engine 0.151.0 `compile()`), touch pan, pinch zoom, wheel zoom, FPS overlay. `autorun=N` runs a scripted zoom+pan for N seconds (same redraw path as a pinch, but repeatable). | `plot-ready`, `plot-fps fps= p95FrameMs= redrawMs= displayHz= frames=` |
| `python.html` | loads MicroPython-wasm v1.29.0 from `mpy/`, runs one line | `py-ready importMs= loadMs= firstRunMs= totalMs=` |
| `pyodide.html?pkgs=numpy,sympy` | loads Pyodide 314.0.7 from `pyodide/`, loads the packages, imports them (`?pkgs=` = core only) | `pyo-ready coreMs= packagesMs= importMs= totalMs=` |

`npm run build` first runs `scripts/copy-python.mjs`, which copies the gitignored MicroPython build (`spike/python/build-micropython.sh`) and the Pyodide pack (`spike/python/_build/pyodide`, see `spike/python/NOTES.md`) into `public/`. `PYODIDE_PKGS=numpy` keeps the APK smaller (default numpy,sympy; the APK then carries about 21 MB of Python+).

Desktop checks: `node scripts/check-pages.mjs` (all pages, Chromium) and `node scripts/fps.mjs [runs] [seconds] [cpuThrottle]` (Chromium and Firefox).

## Desktop FPS (Q6, laptop; not a device number)
Scripted zoom/pan with 3 functions, 1280x800, 60 Hz display, medians of 5 runs of 5 s. "redraw" = median synchronous cost of one `setBoundingBox` redraw (JS, including SVG update); the budget for 60 fps is 16.7 ms and for 30 fps 33 ms.

| Browser | CPU throttle | fps | p95 frame | redraw |
|---|---|---|---|---|
| Chromium 156 | x1 | 60.0 | 16.8 ms | 4.2 ms |
| Chromium 156 | x4 | 46.0 | 33.4 ms | 14.5 ms |
| Chromium 156 | x8 | 22.6 | 50.1 ms | 30.4 ms |
| Firefox 140 | x1 | 59.4 | 17.2 ms | 7.0 ms |

Reading: the desktop is capped by the display at 60 fps. With the CPU slowed 4x, which is roughly a mid-range phone core on a heavy page, it drops under 60; at 8x (a rough stand-in for a low-end tablet) it is below the 30 fps bar. CPU throttling is only a crude proxy, so the Tab One run decides.

## Observations
- The plot page bundle is 5.2 MB of minified JS (Compute Engine ships its whole CAS, JSXGraph its whole core). For the real app the plot path should avoid pulling the full Compute Engine just to evaluate points: use a Giac-generated JS function or a small expression compiler, or import only `compile`. Worth measuring the plot page start on the Tab One before choosing.
- JSXGraph's package `exports` hide `distrib/jsxgraph.css`, so the CSS is imported by relative path.
- `1/x` needs no special handling: JSXGraph breaks the curve at the pole.
