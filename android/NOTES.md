<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# android/ notes

- Capacitor project for `app/` (`app/capacitor.config.ts` has `android.path: ../android`). `./build.sh` builds the web app and runs `npx cap sync android`, which copies `app/dist` into `android/app/src/main/assets/public` (gitignored).
- **No Gradle wrapper is committed** (a `gradle-wrapper.jar` would be a prebuilt binary). `build.sh` downloads Gradle 8.14.3 (SHA-256 pinned in the script) into `~/.cache/pascaline/` and runs it. F-Droid uses its own Gradle (`gradle: yes` in the recipe), so it needs nothing from us.
- Signing: release builds are signed with a throwaway key only when `PASCALINE_KEYSTORE` is set (`build.sh` makes one in `android/_keys/`, gitignored). `build.sh --unsigned` leaves the APK unsigned, as F-Droid wants.
- Measurement builds (`./build.sh --measure`): `PASCALINE_MEASURE=1` turns on timing marks (logcat tag `PASCALINE_T`, JS marks via `app/src/marks.ts`) and the `?bench=1` page. Never ship one.
- `.wasm` is stored uncompressed in the APK (D9); minSdk 24.
- Device runs: `tools/device_run.py start|bench` (see `tools/README.md`).
