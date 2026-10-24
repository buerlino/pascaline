<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Local Giac patches

`build-wasm.sh` applies every `*.patch` here (in name order, `patch -p1` in the Giac source root) after unpacking.
Keep this list short; each patch should also be reported upstream (Giac forum / B. Parisse).

| Patch | Why | Upstream status |
|---|---|---|
| `0001-gen-remove-add_evalf-debug-log.patch` | In EMCC/EMCC2 builds, `caseval` logs `console.log("gen.cc add_evalf", UI.addevalf)` on every evaluation once the host defines `UI.add_evalf` (needed to stop `1/3` printing as `1/3=0.333…`). The log also reads a misspelt property. Removes the log line only. | sent as a link (email 2); Parisse: "integrated in my codebase" (answer received by 2026-10-21). Drop it at the first numbered Debian archive that has it (P21; asked which one in `../outreach/email-parisse-3.md`); S17's canary shows it |
| `0002-emcc-subsecond-caseval-timeout.patch` | Home's exact-first time guard needs Giac to stop itself after ~0.3 s (`timeout 0.3`, `ckevery 10`). In EMCC builds the check compares whole seconds from `time(0)`, so it fired only after 1–2 s. Records the start with `emscripten_get_now()` and compares milliseconds; after a timeout it restarts that clock like the seconds clock, so the check doesn't fire again while Giac unwinds (without that, every interrupt with `ckevery 1` escaped `caseval` as an uncaught exception). Test: `tests/engine/interrupt-test.mjs`. | integrated upstream, as 0001 |
| `0003-complex-tanh-mpfr.patch` | Giac's complex `tanh` with MPFR parts (Digits > 14) returns `(e^2z+1)/(e^2z-1)`, which is coth (`usual.cc:2673`, the `_CPLX` branch): `evalf(tanh(1+i))` at Digits 30 gave `0.868014…-0.217621…*i`, mpmath `1.083923…+0.271752…*i`. Computes `(sinh 2x + i·sin 2y)/(cosh 2x + cos 2y)` in radians, as Giac's complex `exp` does (the plain swap to `(g-1)/(g+1)` leaves a rounding real part for x = 0, `7e-81+1.557…*i`, which cost the agreement check its digits); the double branch was right. Lets the host drop its `pastanh` workaround (G50). Test: `tests/engine/tanh-test.ts`; canary: `tests/engine/patch-canary.ts` (fails once the pinned tarball no longer has the line). | G75; the owner sends the commit link to B. Parisse |
| `0004-caseval-step-budget.patch` | A result must not depend on the speed of the device (A20: the Tab One's slower CPU ran out of Home's 300 ms in 16 golden cases the desktop finished). `control_c` (the interrupt check, where 0002 compares milliseconds) also counts its own calls; the new caseval command `ckbudget N` (N > 0) interrupts after N calls since the evaluation started (or since the last interrupt), `ckbudget 0` (the default) turns it off, and `ckcount` returns the count of the last evaluation. With it off Giac behaves as before and `timeout` stays a clock. Home sets `ckbudget` (its `budgetSteps`, G82; the clock is a safety net at 2 s); the CAS view and Solve set `ckbudget 0` and keep their clocks. Our `giac_value` (`wasm/api.cc` `startClock`) resets the count as caseval does. Test and canary: `tests/engine/step-budget-test.mjs` (golden stage `steps`); `patch-canary.ts` fails once the pinned tarball's `control_c` counts. | G82; the owner sends the commit link to B. Parisse |

Next (P19): the next patch takes `0005`. Each patch gets a canary in `tests/engine/` (`patch-canary.ts`) that fails once upstream has fixed the cause, and its commit link goes to B. Parisse (the owner sends it). A workaround in our TypeScript instead of a patch needs a written reason and a row in "Workarounds in our code" (S17 writes that table). The pin moves to Parisse's numbered Debian archive (P21; G77).

Last checked 2026-10-19: every patch applies cleanly (`patch -p1 --dry-run`) to the pinned `giac-2.1.0.tar.gz` (SHA-256 `1d9536e0…`), to the same name re-published on 2026-10-15 (`46d57345…`) and to `giac_2.1.0-1.tar.gz` from Parisse's Debian folder (`cdec2989…`).

## Workarounds in our code
Giac behaviour we handle in our TypeScript instead of a patch, each with its reason and a canary that shows whether Giac still does it.

| Package | Giac's behaviour | Our code | Canary | Why not a patch |
|---|---|---|---|---|
| G97 (F69) | `^` of a non-square matrix is v.v or elementwise; `inv` of one, and division by one, is elementwise (`gen.cc:6880-6886`, `usual.cc:357`, `gen.cc:7706-7708`) | `app/src/engine/nonsquare.ts` `nonSquarePower`, refusal `notSquare` | `node engine/giac/smoke.mjs '[[5],[1]]^2'` gives `26`; Giac prints "Warning, ^ is ambiguous on non square matrices" to its print, which `smoke.mjs` drops (pass a `print` to see it) | Giac's meaning on purpose (it warns), not a bug to file (decisions.md, Opus pass 56) |

## Not patches, but build choices that change Giac's source tree or behaviour
All of these live in `build-wasm.sh`; compile defines and configure flags are listed in `../README.md` ("Build choices").
- The prebuilt `doc/giacwasm.{js,wasm}` from the tarball are deleted right after unpacking (never used or shipped).
- `config.h` (from Giac's `configure`) gets `HAVE_LIBPTHREAD`, `HAVE_PTHREAD_H` and `HAVE_LIBRT` commented out: no threads in the browser build (they would need SharedArrayBuffer + COOP/COEP), so Giac's threaded code paths run single-threaded.
- Files from `libgiac_la_SOURCES` in `src/Makefile.am` that are not compiled:
  - `markup.cc` (improved LaTeX export by L. Marohnić): with `EMCC2`, `tex.cc` defines stand-ins for its two entry points. Revisit if KaTeX output needs the better exporter.
  - QuickJS and its Giac bridge (`--disable-quickjs`): `quickjs.c`, `quickjs-libc.c`, `libbf.c`, `libregexp.c`, `libunicode.c`, `cutils.c`, `js.c`, `qjsgiac.c`, `caseval.c`, `graphic.c`.
  - KhiCAS calculator UI: `kadd.cc`, `kdisplay.cc`, and `qrcodegen.c` (QR-code generator; nothing we compile needs it, the link succeeds without it).
- `wasm/stubs.cc` provides `sigsuspend` (desktop-GUI child processes only) and `giac_gen_renderer` (WebGL 3D, not built).
- `wasm/api.cc` provides an identity `gettext()`; engine messages stay English.
