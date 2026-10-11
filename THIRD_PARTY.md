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
