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

| Component | Version | Licence | Source |
|---|---|---|---|
| Emscripten SDK | 6.0.12 | MIT / UIUC (NCSA) | https://github.com/emscripten-core/emsdk |
