<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Local Giac patches

`build-wasm.sh` applies every `*.patch` here (in name order, `patch -p1` in the Giac source root) after unpacking.
Keep this list short; each patch should also be reported upstream (Giac forum / B. Parisse).

| Patch | Why | Upstream status |
|---|---|---|
| `0001-gen-remove-add_evalf-debug-log.patch` | In EMCC/EMCC2 builds, `caseval` logs `console.log("gen.cc add_evalf", UI.addevalf)` on every evaluation once the host defines `UI.add_evalf` (needed to stop `1/3` printing as `1/3=0.333…`). The log also reads a misspelt property. Removes the log line only. | not reported yet |

## Not patches, but build choices that change Giac behaviour
- `markup.cc` (improved LaTeX export by L. Marohnić) is not compiled: with `EMCC2`, `tex.cc` defines stand-ins for its two entry points. Revisit if KaTeX output needs the better exporter.
- `wasm/stubs.cc` provides `sigsuspend` (desktop-GUI child processes only) and `giac_gen_renderer` (WebGL 3D, not built).
- `wasm/api.cc` provides an identity `gettext()`; engine messages stay English.
