<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Third-party components

Everything here is built from source by scripts in this repository. Spike-only tools and the prebuilt shortcut used during Phase 0 are listed in [spike/RESULTS.md](spike/RESULTS.md), not here.

## Maths engine (engine/giac/build-wasm.sh)

| Component | Version | Licence | Source | Notes |
|---|---|---|---|---|
| Giac | 2.1.0 (tarball SHA-256 `1d9536e0…5a67`, fetched 2026-10-10) | GPL-3.0-or-later | https://www-fourier.univ-grenoble-alpes.fr/~parisse/giac/giac-2.1.0.tar.gz (mirror: release `deps-giac-2.1.0-1d9536e0` of this repo) | Upstream re-publishes this tarball in place, so we mirror the pinned file; see engine/giac/README.md. Local patches: engine/giac/patches/ |
| GMP | 6.3.0 | LGPL-3.0-or-later OR GPL-2.0-or-later | https://ftp.gnu.org/gnu/gmp/gmp-6.3.0.tar.xz | GPG signature checked (Niels Möller) |
| MPFR | 4.2.2 | LGPL-3.0-or-later | https://ftp.gnu.org/gnu/mpfr/mpfr-4.2.2.tar.xz | GPG signature checked (Vincent Lefèvre) |
| GSL | 2.8 | GPL-3.0-or-later | https://ftp.gnu.org/gnu/gsl/gsl-2.8.tar.gz | GPG signature checked (Patrick Alken). Numeric solvers behind Giac `fsolve` (decided 2026-10-10) |

## Python (python/build-micropython.sh)

| Component | Version | Licence | Source | Notes |
|---|---|---|---|---|
| MicroPython | 1.29.0 (release tarball with submodules, SHA-256 `d925a7c6…efeca0`; tag commit `0fd6c573`) | MIT | https://micropython.org/resources/source/ | default Python (D6). Release builds use the same pinned trixie container as the engine and are reproducible. Copied into the app's assets by `build.sh` (`--no-python` skips it) and not loaded at start; the UI comes in milestone 3 |

## Toolchain (not shipped)

| Component | Version | Licence | Source | Use |
|---|---|---|---|---|
| Emscripten SDK | 6.0.12 | MIT / UIUC (NCSA) | https://github.com/emscripten-core/emsdk | development builds only |
| Emscripten (Debian package) | 3.1.69+dfsg-3 (`debian:trixie@sha256:913f6706df59a68922d1dd08f78c2476560a8d367897200a6005b00e5f67c2d5`) | MIT / UIUC (NCSA) | https://packages.debian.org/trixie/emscripten | **release builds** of the engine (decided 2026-10-11, P2; speed condition met 2026-10-11), `engine/giac/build-wasm-release.sh` |
| Gradle | 8.14.3 (distribution SHA-256 `bd711022…3531`, pinned in build.sh) | Apache-2.0 | https://services.gradle.org/distributions/gradle-8.14.3-bin.zip | Android build, downloaded by `build.sh` into `~/.cache/pascaline/`; no wrapper jar in git (F-Droid uses its own Gradle) |

## App (app/package.json, pinned)

| Component | Version | Licence | Source | Use |
|---|---|---|---|---|
| MathLive | 0.111.1 | MIT | https://github.com/arnog/mathlive | textbook entry and 2D result rendering (shipped) |
| Svelte | 5.57.2 | MIT | https://github.com/sveltejs/svelte | app shell (shipped, compiled) |
| @sveltejs/vite-plugin-svelte | 7.3.1 | MIT | https://github.com/sveltejs/vite-plugin-svelte | build |
| svelte-check | 4.7.6 | MIT | https://github.com/sveltejs/language-tools | type check |
| Vite | 8.3.4 | MIT | https://github.com/vitejs/vite | build |
| TypeScript | 6.0.3 | Apache-2.0 | https://github.com/microsoft/TypeScript | build (7.x is rejected by svelte-check 4.7.6) |
| Vitest | 5.0.3 | MIT | https://github.com/vitest-dev/vitest | unit tests |
| @playwright/test | 1.64.0 | Apache-2.0 | https://github.com/microsoft/playwright | browser tests |
| yaml | 2.9.1 | ISC | https://github.com/eemeli/yaml | build-time keyboard.yaml → JSON, golden runner (not shipped) |
| @types/node | 26.6.5 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | types |
| @capacitor/core | 8.5.3 | MIT | https://github.com/ionic-team/capacitor | native shell bridge (shipped) |
| @capacitor/android | 8.5.3 | MIT | https://github.com/ionic-team/capacitor | Android project (shipped) |
| @capacitor/cli | 8.5.3 | MIT | https://github.com/ionic-team/capacitor | `cap sync` (build) |
| JSXGraph | 1.14.0 | MIT OR LGPL-3.0-or-later | https://github.com/jsxgraph/jsxgraph | Function app Plot view (shipped, loaded lazily when Plot first opens; D7) |
| CodeMirror 6 (`@codemirror/state` 6.7.6, `view` 6.43.14, `commands` 6.11.1, `language` 6.13.1, `lang-python` 6.2.1) | pinned exactly | MIT | https://github.com/codemirror | Python app editor (milestone 3); lazy chunk, not loaded at start. Transitive: `@codemirror/autocomplete` 6.20.3, style-mod 4.1.4, w3c-keyname 2.2.8, crelt 1.0.7 (all MIT) |
| Lezer (`@lezer/common` 1.5.3, `highlight` 1.2.5, `lr` 1.4.11, `python` 1.1.19) | pinned via lockfile | MIT | https://github.com/lezer-parser | Parser for CodeMirror's Python mode |
