<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Local Giac patches

`build-wasm.sh` applies every `*.patch` here (in name order, `patch -p1` in the Giac source root) after unpacking.
Keep this list short; each patch should also be reported upstream (Giac forum / B. Parisse).

| Patch | Why | Upstream status |
|---|---|---|
| `0001-gen-remove-add_evalf-debug-log.patch` | In EMCC/EMCC2 builds, `caseval` logs `console.log("gen.cc add_evalf", UI.addevalf)` on every evaluation once the host defines `UI.add_evalf` (needed to stop `1/3` printing as `1/3=0.333…`). The log also reads a misspelt property. Removes the log line only. | mentioned in the email to Parisse (2026-10-19); he takes fixes as links to our commits (his answer, 2026-10-19), so the link to this file goes with the reply (draft G12 in `../outreach/upstream-reports.md`) |
| `0002-emcc-subsecond-caseval-timeout.patch` | Home's exact-first time guard needs Giac to stop itself after ~0.3 s (`timeout 0.3`, `ckevery 10`). In EMCC builds the check compares whole seconds from `time(0)`, so it fired only after 1–2 s. Records the start with `emscripten_get_now()` and compares milliseconds; after a timeout it restarts that clock like the seconds clock, so the check doesn't fire again while Giac unwinds (without that, every interrupt with `ckevery 1` escaped `caseval` as an uncaught exception). Test: `tests/engine/interrupt-test.mjs`. | the same as 0001 |

Last checked 2026-10-19: every patch applies cleanly (`patch -p1 --dry-run`) to the pinned `giac-2.1.0.tar.gz` (SHA-256 `1d9536e0…`), to the same name re-published on 2026-10-15 (`46d57345…`) and to `giac_2.1.0-1.tar.gz` from Parisse's Debian folder (`cdec2989…`).

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
