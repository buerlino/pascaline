<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# F-Droid draft

`org.pascaline.app.yml` is a draft of the fdroiddata recipe. It is **never submitted**; the application id is a placeholder.

How it builds, and how it differs from `./build.sh`:
- `build.sh` builds the engine in a podman container (P2). The F-Droid build VM cannot nest that, so the recipe installs the **same Debian `emscripten` package** (3.1.69+dfsg-3 in trixie) and runs the same scripts with `EMSDK_DIR=system`. F-Droid then builds the APK with its own Gradle (`gradle: yes`) and signs it itself.
- Source tarballs (Giac, GMP, MPFR, GSL, MicroPython) are downloaded and SHA-256-checked by the scripts, and `npm ci` downloads packages. F-Droid builds are normally offline after `prebuild`, so check this (and a `srclibs` rework) before submitting.
- The container builds of the engine and of MicroPython are byte-reproducible between runs. The system-emscripten build on the VM should match; verify before claiming reproducible builds.
- Open items before a real submission: a release tag and `versionCode`, the real application id, an app icon and screenshots in `fastlane/metadata/android/en-US/`.

- Checked 2026-10-11 with fdroidserver 2.4.5 (pip, venv): `fdroid readmeta` parses the recipe. `fdroid lint` only complains that the category is unknown, because a scratch repo has no `config/categories.yml`; the real fdroiddata uses "Science & Education" in 534 recipes. A real `fdroid build` needs the build-server VM (vagrant/KVM image), which is not set up here, so the recipe is untested end to end.
