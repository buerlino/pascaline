<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Third-party components

Everything here is built from source by scripts in this repository. Spike-only tools and the prebuilt shortcut used during Phase 0 are listed in [spike/RESULTS.md](spike/RESULTS.md), not here.

## Maths engine (engine/giac/build-wasm.sh)

| Component | Version | Licence | Source | Notes | Copyright |
|---|---|---|---|---|---|
| Giac | 2.1.0, Debian revision 1 (`giac_2.1.0-1.tar.gz`, SHA-256 `cdec2989…3f57`, checked against its `.dsc` line; G77) | GPL-3.0-or-later | https://www-fourier.univ-grenoble-alpes.fr/~parisse/debian/dists/stable/main/source/giac_2.1.0-1.tar.gz (mirror: release `deps-giac-2.1.0-1-cdec2989` of this repo) | Parisse's numbered archive never changes (P21); see engine/giac/README.md. Local patches: engine/giac/patches/ | Copyright © B. Parisse, Institut Fourier (Université Grenoble Alpes), R. De Graeve and the other authors named in Giac's AUTHORS and README |
| GMP | 6.3.0 (tarball SHA-256 `a3c2b802…8898`) | LGPL-3.0-or-later OR GPL-2.0-or-later | https://ftp.gnu.org/gnu/gmp/gmp-6.3.0.tar.xz | GPG signature checked (Niels Möller) | Copyright © 1991, 1993–1997, 1999–2016, 2020, 2021 Free Software Foundation, Inc. |
| MPFR | 4.2.2 (tarball SHA-256 `b67ba038…ce01`) | LGPL-3.0-or-later | https://ftp.gnu.org/gnu/mpfr/mpfr-4.2.2.tar.xz | GPG signature checked (Vincent Lefèvre) | Copyright © 2000–2025 Free Software Foundation, Inc. (contributed by the AriC and Caramba projects, INRIA) |
| GSL | 2.8 (tarball SHA-256 `6a99eeed…3190`) | GPL-3.0-or-later | https://ftp.gnu.org/gnu/gsl/gsl-2.8.tar.gz | GPG signature checked (Patrick Alken). Numeric solvers behind Giac `fsolve` (decided 2026-10-10) | Copyright © 1996 and later, the GSL authors (Gerard Jungman, Brian Gough, Mark Galassi, James Theiler and others; its AUTHORS file) |

## Units and constants data (data only: not part of `./build.sh` since A21; engine/qalc/build-wasm.sh is a developer tool; not shipped in the app, P15)

The libxml2 and libqalculate tarballs are SHA-256-checked by the script. `find/factors.yaml` holds the numbers of the build below; `tools/find-index/refresh-factors.mjs` (developers) recomputes them and prints the difference.

| Component | Version | Licence | Source | Notes | Copyright |
|---|---|---|---|---|---|
| libqalculate | 5.13.1 (tarball SHA-256 `cf8d3eaf…d1b01d3cc3`; pinned at first download 2026-10-11, upstream publishes no hash) | GPL-2.0-or-later | https://github.com/Qalculate/libqalculate/releases/download/v5.13.1/libqalculate-5.13.1.tar.gz | Data only (P15, A21): its XML supplies names and titles to the Find index, and `find/factors.yaml` holds the unit factors, constants and uncertainties its build gave (rows that replace a wrong qalc value say so). The data ships in the Find index; its code is not in the APK and not built by `./build.sh`. Compiled-in definitions, no curl/icu/readline/NLS. Release build in the pinned trixie container, reproducible | Copyright © Hanna Knutsson and the Qalculate! contributors |
| libxml2 | 2.15.1 (SHA-256 `c008bac0…c39bc54c`, matches upstream `.sha256sum`) | MIT | https://download.gnome.org/sources/libxml2/2.15/libxml2-2.15.1.tar.xz | required by libqalculate's developer build (refresh-factors) to parse its definitions; built without iconv, zlib, ICU, HTTP, threads, validation | – |

## Find index data (tools/find-index/generate.mjs)

Generated at build time by `tools/find-index/generate.mjs`, not committed.

1. Giac 2.1.0 `doc/aide_cas`, English entries only: GPL-3.0-or-later per Giac's README (R5; P10; confirmed by B. Parisse by email on 2026-10-19: the whole file is GPL), authors as R5 lists.
2. libqalculate 5.13.1 `data/units.xml.in`, `variables.xml.in`, `prefixes.xml.in`: GPL-2.0-or-later, the library's licence (the combined work is GPL-3.0); names and titles read from the tarball. `find/factors.yaml`: the values and factors computed once by our qalc build (GPL-3.0-or-later as a file of ours; exact definitions and CODATA 2022 where they replace qalc's).
3. `find/aliases.yaml`, `find/functions.yaml`, `find/units.yaml`: ours, GPL-3.0-or-later.

Settings › Help and about (R87) lists every row of these tables with its licence and copyright line, built from this file at every build (`tools/third-party/parse.mts`), and ships the full text of each licence from `LICENSES/`. yaml (ISC) is build-time only and has no text there; Emscripten's runtime in the engine is used under the MIT side of its MIT / UIUC licence, so its rows open the MIT text (decisions.md, R87).

## Toolchain (not shipped)

| Component | Version | Licence | Source | Use | Copyright |
|---|---|---|---|---|---|
| Emscripten SDK | 6.0.12 | MIT / UIUC (NCSA) | https://github.com/emscripten-core/emsdk | development builds only | – |
| Emscripten (Debian package) | 3.1.69+dfsg-3 (`debian:trixie@sha256:913f6706df59a68922d1dd08f78c2476560a8d367897200a6005b00e5f67c2d5`) | MIT / UIUC (NCSA) | https://packages.debian.org/trixie/emscripten | **release builds** of the engine (decided 2026-10-11, P2; speed condition met 2026-10-11), `engine/giac/build-wasm-release.sh` | – |
| Gradle | 8.14.3 (distribution SHA-256 `bd711022…3531`, pinned in build.sh) | Apache-2.0 | https://services.gradle.org/distributions/gradle-8.14.3-bin.zip | Android build, downloaded by `build.sh` into `~/.cache/pascaline/`; no wrapper jar in git (F-Droid uses its own Gradle) | – |

## App (app/package.json, pinned)

| Component | Version | Licence | Source | Use | Copyright |
|---|---|---|---|---|---|
| MathLive | 0.111.1 | MIT | https://github.com/arnog/mathlive | textbook entry and 2D result rendering (shipped) | Copyright © 2017–present Arno Gourdol |
| Svelte | 5.57.2 | MIT | https://github.com/sveltejs/svelte | app shell (shipped, compiled) | Copyright © 2016–2025 Svelte Contributors |
| @sveltejs/vite-plugin-svelte | 7.3.1 | MIT | https://github.com/sveltejs/vite-plugin-svelte | build | – |
| svelte-check | 4.7.6 | MIT | https://github.com/sveltejs/language-tools | type check | – |
| Vite | 8.3.4 | MIT | https://github.com/vitejs/vite | build | – |
| TypeScript | 6.0.3 | Apache-2.0 | https://github.com/microsoft/TypeScript | build (7.x is rejected by svelte-check 4.7.6) | – |
| Vitest | 5.0.3 | MIT | https://github.com/vitest-dev/vitest | unit tests | – |
| @playwright/test | 1.64.0 | Apache-2.0 | https://github.com/microsoft/playwright | browser tests | – |
| yaml | 2.9.1 | ISC | https://github.com/eemeli/yaml | build-time keyboard.yaml → JSON, golden runner (not shipped) | – |
| @types/node | 26.6.5 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | types | – |
| @capacitor/core | 8.5.3 | MIT | https://github.com/ionic-team/capacitor | native shell bridge (shipped) | Copyright © 2017–present Drifty Co. |
| @capacitor/android | 8.5.3 | MIT | https://github.com/ionic-team/capacitor | Android project (shipped) | Copyright © 2017–present Drifty Co. |
| @capacitor/cli | 8.5.3 | MIT | https://github.com/ionic-team/capacitor | `cap sync` (build) | – |
| @capacitor/clipboard | 8.0.1 | MIT | https://github.com/ionic-team/capacitor-plugins | Android paste and copy; offline; no permission (shipped, clipboard chunk) | Copyright © 2020–present Ionic |
| @capacitor/share | 8.0.3 | MIT | https://github.com/ionic-team/capacitor-plugins | Android share sheet; offline; no permission (shipped, clipboard chunk) | Copyright © 2020–present Ionic |
| KaTeX fonts (`fonts/KaTeX_*.woff2` inside MathLive; `fonts/` of the package) | as bundled with MathLive 0.111.1 | OFL-1.1 | https://github.com/KaTeX/KaTeX | maths fonts for entry and results (shipped, assets of the bundle) | Copyright © 2009–2010 Design Science, Inc.; Copyright © 2014–2018 Khan Academy |
| JSXGraph | 1.14.0 | MIT OR LGPL-3.0-or-later | https://github.com/jsxgraph/jsxgraph | Function app Plot view (shipped, loaded lazily when Plot first opens; D7) | Copyright © 2008–2012 Matthias Ehmann, Michael Gerhaeuser, Carsten Miller, Bianca Valentin, Alfred Wassermann, Peter Wilfahrt |

## Android (android/variables.gradle and the Gradle files, pinned)

| Component | Version | Licence | Source | Use | Copyright |
|---|---|---|---|---|---|
| AndroidX appcompat | 1.7.1 | Apache-2.0 | https://developer.android.com/jetpack/androidx | app and Capacitor's Android shell (shipped) | Copyright © The Android Open Source Project |
| AndroidX coordinatorlayout | 1.3.0 | Apache-2.0 | https://developer.android.com/jetpack/androidx | the app module (shipped) | Copyright © The Android Open Source Project |
| AndroidX core-splashscreen | 1.2.0 | Apache-2.0 | https://developer.android.com/jetpack/androidx | start screen (shipped) | Copyright © The Android Open Source Project |
| Apache Cordova framework (`org.apache.cordova:framework`) | 14.0.1 | Apache-2.0 | https://github.com/apache/cordova-android | pulled in by Capacitor's plugin template (shipped) | Copyright © 2015–2020 The Apache Software Foundation |
| AndroidX libraries the above pull in (activity 1.11.0, core 1.17.0, fragment 1.8.9, lifecycle 2.6.2, webkit 1.14.0, emoji2, startup, savedstate, collection, annotation and others; full list: `cd android && gradle :app:dependencies --configuration releaseRuntimeClasspath`) | as resolved there | Apache-2.0 | https://developer.android.com/jetpack/androidx | transitive runtime classpath of the release APK (shipped) | Copyright © The Android Open Source Project |
| Kotlin standard library | 2.0.21 | Apache-2.0 | https://github.com/JetBrains/kotlin | pulled in by AndroidX (shipped) | Copyright © 2010–2024 JetBrains s.r.o. and Kotlin Programming Language contributors |
| kotlinx.coroutines | 1.8.1 | Apache-2.0 | https://github.com/Kotlin/kotlinx.coroutines | pulled in by AndroidX (shipped) | Copyright © 2016–2024 JetBrains s.r.o. and contributors |
| JetBrains annotations | 23.0.0 | Apache-2.0 | https://github.com/JetBrains/java-annotations | pulled in by the Kotlin library (shipped) | Copyright © 2000–2022 JetBrains s.r.o. |
| JSpecify | 1.0.0 | Apache-2.0 | https://github.com/jspecify/jspecify | pulled in by AndroidX (shipped) | Copyright © 2018–2023 The JSpecify Authors |
| Guava `listenablefuture` | 1.0 | Apache-2.0 | https://github.com/google/guava | pulled in by AndroidX (shipped) | Copyright © The Guava Authors (Google LLC) |
| Android Gradle plugin | 8.13.0 | Apache-2.0 | https://developer.android.com/build | Android build (not shipped) | – |

## Theme colours (app/scripts/theme-families.ts, generated into app/src/theme/)

Colour values only (no code); lightness adjusted where our contrast rules need it (`node tools/probes/themes-audit.mjs --fixes` lists the moves).

| Palette | Author | Licence | Source | Copyright |
|---|---|---|---|---|
| Solarized | Ethan Schoonover | MIT | https://github.com/altercation/solarized | Copyright © 2011 Ethan Schoonover |
| Gruvbox | Pavel Pertsev | MIT | https://github.com/morhetz/gruvbox | Copyright © Pavel Pertsev |
| Nord | Arctic Ice Studio | MIT | https://github.com/nordtheme/nord | Copyright © 2016–present Sven Greb (Arctic Ice Studio) |
