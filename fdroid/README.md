<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# F-Droid draft

`io.github.buerlino.pascaline.yml` is a draft of the fdroiddata recipe. It is **never submitted**; the application id is final (owner, 2026-10-14).

How it builds, and how it differs from `./build.sh`:
- `build.sh` builds the engine in a podman container (P2). The F-Droid build VM cannot nest that, so the recipe installs the **same Debian `emscripten` package** (3.1.69+dfsg-3 in trixie) and runs the same scripts with `EMSDK_DIR=system`. F-Droid then builds the APK with its own Gradle (`gradle: yes`) and signs it itself.
- Source tarballs (Giac, GMP, MPFR, GSL, libqalculate) are downloaded and SHA-256-checked by the scripts, and `npm ci` downloads packages. F-Droid builds are normally offline after `prebuild`, so check this (and a `srclibs` rework) before submitting.
- **libqalculate** (milestone 4; `engine/qalc/build-wasm.sh`, docs/04 7.1) builds the same way: `release` in the container, `dev` with `EMSDK_DIR=system` on the VM. Its tarballs (libxml2 2.15.1, libqalculate 5.13.1) are downloaded and SHA-256-checked by the script like the others; GMP and MPFR come from the Giac cache. The recipe's `prebuild` runs it before the app build, and the Find index generator (milestone 4, G4) reads `qalc.{mjs,wasm}` in Node from `engine/qalc/_out/dev/`. Nothing of qalc's code goes into the APK; its data ships in the Find index (P15). `./build.sh --no-units` skips it.
- The container builds of the engine and of libqalculate are byte-reproducible between runs. The system-emscripten build on the VM should match; verify before claiming reproducible builds.
- Open items before a real submission: a release tag and `versionCode`, the real application id, an app icon and screenshots in `fastlane/metadata/android/en-US/`.

- Checked 2026-10-11 with fdroidserver 2.4.5 (pip, venv): `fdroid readmeta` parses the recipe. `fdroid lint` only complains that the category is unknown, because a scratch repo has no `config/categories.yml`; the real fdroiddata uses "Science & Education" in 534 recipes. A real `fdroid build` needs the build-server VM (vagrant/KVM image), which is not set up here, so the recipe is untested end to end.
