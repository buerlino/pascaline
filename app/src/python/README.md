<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# app/src/python: the Python runtime (milestone 3, D6)

MicroPython v1.29.0 (`python/build-micropython.sh`, plus our C module in `python/modules/host`) in its own
Web Worker, behind `PythonEngine` (`types.ts`). Nothing here loads at app start.

| File | Role |
|---|---|
| `types.ts` | `PythonEngine`, `PyResult`/`PyError`/`PyOutput`, graphics `GfxCmd` (agreed with the UI) |
| `pythonEngine.ts` | main thread: `loadPythonEngine(math)`; starts the worker on first use; Cancel = terminate + new worker |
| `protocol.ts` | messages between the two |
| `python.worker.ts` | the worker: loads `python/micropython.mjs` (copied to `app/public/python/` by `npm run engine:copy` or `build.sh`) |
| `pyHost.ts` | worker side, UI-free (also runs in Node): run/shell, output batching, exceptions → `PyError` |
| `calcHost.ts` | main thread: answers `calc` calls through the `MathEngine` |
| `nodePython.ts`, `nodeMath.ts` | Node loaders for tests and the golden runner (`PYTHON_OUT`, else `python/_out/dev`; Giac as usual) |

```ts
const { loadPythonEngine } = await import("../python/pythonEngine.ts");   // lazily, when the Python app opens
const py = loadPythonEngine(mathEngine);
py.onOutput((o) => append(o.stream, o.text));
await py.ready();
await py.shell("1+1");                 // stdout "2\n" (expressions are echoed, as in a REPL)
const r = await py.run(src, { file: "main.py" });   // r.error?.line for the editor
await py.cancel();                     // pending calls reject with PythonCancelled
```

## The `calc` module (our API, in our own words)
All calls are synchronous and go to the same Giac engine as Home and CAS, so variables are shared both ways.

| Call | Returns |
|---|---|
| `calc.cas(expr)` | Giac's exact result as text, e.g. `"(x-1)*(x+1)"`; `ValueError` with Giac's message on error |
| `calc.eval(expr)` | evaluated like Home (exact-first, decimals exact, digits checked; docs/04 2.10): `int` for an exact integer; else a `float` (or `complex`) from the leading 17 digits; a list (of lists) for a list or matrix; text if not numeric. Uses its own Ans, so Home's Ans is untouched |
| `calc.get(name)` | a calculator variable, as `eval` returns it; `NameError` if it has no value |
| `calc.set(name, v)` | stores `int`/`float`/`complex`/`bool`/list, or an expression given as text; `None` purges |

Names are letters, digits and `_`, starting with a letter. Exact values come to Python to 17 digits;
Giac floats come as Giac prints them (12 digits by default, which is also about all they carry).
Stores are definitions (`name:=…`), so the MathEngine replays them after a Cancel.

## Graphics (`graphics.ts`)
`draw` is our own module: `clear`, `pixel`, `line`, `rect`, `fill_rect`, `circle`, `fill_circle`, `text`,
`show`, `rgb`, on 320×240 (origin top-left, y down, 0xRRGGBB, floats rounded). Each call becomes one `GfxCmd`;
PyHost sends them through `onGraphics` in batches of at most 256, at most every 16 ms, before each `calc`
call and at the end of every call. 10,000 `draw.pixel` calls: 61 ms (desktop Chromium).
The compatibility module (`COMPAT_MODULE`, the name scripts for the reference calculator import) maps
`pixon`, `line`, `rect`, `fillrect`, `circle`, `fillcircle`, `textout` (screen G0 only) and `eval` onto
`draw`/`calc`; its names and argument orders are `assumed` (G2 items 26-28).

## How it works, and why
- **`calc` is synchronous.** `calc.cas("factor(x^2-1)")` is a plain call that returns a string, also inside
  functions and comprehensions. Our `_host` C module (`python/modules/host/host.c`) uses Emscripten's
  `EM_ASYNC_JS` to suspend the wasm stack (Asyncify, already part of the upstream build) until the main
  thread answers. No `await`, no preprocessor, no SharedArrayBuffer and so no COOP/COEP headers.
- **Every entry into Python is an async `ccall`.** The port's GC finds roots by unwinding the wasm stack
  with Asyncify (`emscripten_scan_registers`). Upstream's `runPython()`/`runPythonAsync()` use a sync
  `ccall` and abort at the first GC of an allocating loop, so `PyHost.exec` calls `mp_js_do_exec` itself.
- **Our variant** (`python/variant/pascaline`, built via `VARIANT_DIR`, upstream tree untouched): upstream's
  standard variant plus `-O2` at link (upstream links at -O0), a 128 KiB Asyncify buffer, and no JS hook
  (a Ctrl-C poll we don't need; under Node it fails in worker threads). wasm 1.12 MB → 0.63 MB, a
  1e6-iteration loop 1.3 s → 0.61 s (desktop Chromium, dev build).
- **One MicroPython per JS realm.** Upstream's JS proxies use a global `Module`, so a second instance in the
  same realm breaks the first one's JS modules (`_gfx`). The app has one per worker; the golden runner uses
  worker threads where it needs more than one.
- **Run vs shell.** `run` clears `__main__` and execs the script under its file name; `shell` compiles in
  `single` mode (echoes expression values), or `exec` for several statements. Tracebacks drop our own frames;
  `PyError.line` is the innermost frame in the user's file.
- **Output** goes out on each newline at most every 16 ms, at 8 KiB, before each `calc` call, and at the end.
- **Recursion limit.** Deep recursion (roughly 50-100 Python frames) overflows the JS stack through
  Emscripten's setjmp trampolines before MicroPython's own check; it is reported as `RecursionError` and the
  worker is replaced (globals are lost). Same in the stock upstream build.

Tests: `npx vitest run src/python` (real MicroPython, skipped without a build) and
`npx playwright test test/python-engine.spec.ts` (the worker in Chromium).
