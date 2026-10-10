<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Third-party components

Everything here is built from source by scripts in this repository. Spike-only tools and the prebuilt shortcut used during Phase 0 are listed in [spike/RESULTS.md](spike/RESULTS.md), not here.

## Maths engine (engine/giac/build-wasm.sh)

| Component | Version | Licence | Source | Notes |
|---|---|---|---|---|
| Giac | 2.1.0 (tarball SHA-256 `1d9536e0…5a67`, fetched 2026-10-10) | GPL-3.0-or-later | https://www-fourier.univ-grenoble-alpes.fr/~parisse/giac/giac-2.1.0.tar.gz | Upstream re-rolls this tarball in place; see engine/giac/README.md. Local patches: engine/giac/patches/ |
| GMP | 6.3.0 | LGPL-3.0-or-later OR GPL-2.0-or-later | https://ftp.gnu.org/gnu/gmp/gmp-6.3.0.tar.xz | GPG signature checked (Niels Möller) |
| MPFR | 4.2.2 | LGPL-3.0-or-later | https://ftp.gnu.org/gnu/mpfr/mpfr-4.2.2.tar.xz | GPG signature checked (Vincent Lefèvre) |
| GSL *(optional, `WITH_GSL=1`)* | 2.8 | GPL-3.0-or-later | https://ftp.gnu.org/gnu/gsl/gsl-2.8.tar.gz | Not in the default build yet (spike Q5) |
| Boost.Math *(optional, `WITH_SOLVERS=1`)* | 1.92.0 (standalone, header-only) | BSL-1.0 | https://github.com/boostorg/math/archive/refs/tags/boost-1.92.0.tar.gz | `toms748_solve` |
| cminpack *(optional, `WITH_SOLVERS=1`)* | 1.3.14 | MINPACK licence (BSD-style with an acknowledgment clause) | https://github.com/devernay/cminpack/archive/refs/tags/v1.3.14.tar.gz | `hybrd1`. **GPL compatibility of clause 3 still to be confirmed** before it ships; see spike/RESULTS.md |

## Toolchain (not shipped)

| Component | Version | Licence | Source |
|---|---|---|---|
| Emscripten SDK | 6.0.12 | MIT / UIUC (NCSA) | https://github.com/emscripten-core/emsdk |
