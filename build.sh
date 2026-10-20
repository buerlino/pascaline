#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Clean source -> engines -> web app (dist/) -> Capacitor sync -> Gradle -> APK. The F-Droid recipe runs the same steps itself (fdroid/README.md).
#
#   ./build.sh [--dev] [--measure] [--unsigned] [--engine-dir DIR] [--no-units] [--install [SERIAL]]
#
#   (default)        engine built with the pinned Debian trixie Emscripten in a container (P2: what every release ships)
#   --dev            engine built with the local emsdk instead (engine/giac/build-wasm.sh; fast iteration only)
#   --engine-dir D   use an existing engine build (giac.mjs + giac.wasm in D) and skip the engine step
#   --no-units       leave units, prefixes and constants out of the Find index (functions only); the numbers come from find/factors.yaml, no libqalculate build (A21)
#   --measure        measurement build: timing marks to logcat (PASCALINE_MEASURE=1); never for release
#   --unsigned       leave the APK unsigned (what F-Droid wants); default signs with the throwaway key in ~/.cache/pascaline/keys/ (PASCALINE_KEYS)
#   --install [S]    adb install -r on device S (default $ANDROID_SERIAL or the only device); installs io.github.buerlino.pascaline only
# Output: dist/pascaline.apk (last line printed). Env: PASCALINE_DL_DIR (Giac/GMP/MPFR/GSL tarball cache), PASCALINE_QALC_DL_DIR (libqalculate tarball cache: names and titles for the Find index), ANDROID_HOME (default ~/Android/Sdk),
# PASCALINE_KEYS (the throwaway signing key's folder, default ~/.cache/pascaline/keys), NO_LOCK=1 (the caller holds the host-cpu lock).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

DEV=0 MEASURE=0 SIGN=1 INSTALL=0 SERIAL="${ANDROID_SERIAL:-}" ENGINE_DIR="" WITH_UNITS=1
while (( $# )); do
  case "$1" in
    --dev) DEV=1; shift ;;
    --no-units) WITH_UNITS=0; shift ;;
    --measure) MEASURE=1; shift ;;
    --unsigned) SIGN=0; shift ;;
    --engine-dir) ENGINE_DIR="$(cd "$2" && pwd)"; shift 2 ;;
    --install) INSTALL=1; shift; if [[ $# -gt 0 && "$1" != --* ]]; then SERIAL="$1"; shift; fi ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
done

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
COORD_LOCK=(tools/devlock.sh)
lock()   { [[ "${NO_LOCK:-0}" == 1 ]] || "${COORD_LOCK[@]}" acquire host-cpu build.sh 1800 >&2; }
unlock() { [[ "${NO_LOCK:-0}" == 1 ]] || "${COORD_LOCK[@]}" release host-cpu build.sh >&2 || true; }

# 1. engine
if [[ -n "$ENGINE_DIR" ]]; then
  GIAC_OUT="$ENGINE_DIR"
elif (( DEV )); then
  engine/giac/build-wasm.sh >&2
  GIAC_OUT="$ROOT/engine/giac/_out/gsl"
else
  engine/giac/build-wasm-release.sh >&2     # takes the host-cpu lock itself
  GIAC_OUT="$ROOT/engine/giac/_out/release"
fi
export GIAC_OUT

# 2. web app -> app/dist. First the Find index (docs/04 3.3): app/src/find/_gen/find-index.json from the pinned
#    tarballs and the numbers in find/factors.yaml (no libqalculate build, A21); it needs the app's packages (yaml).
(( MEASURE )) && export PASCALINE_MEASURE=1 VITE_MEASURE=1
INDEX_ARGS=(); (( WITH_UNITS )) || INDEX_ARGS=(--no-units)
(cd app && npm ci --no-audit --no-fund >&2 && npm run index -- "${INDEX_ARGS[@]}" >&2 && npm run build >&2)

# 3. Capacitor project (android/ is committed; sync copies dist/ and the plugin list into it)
[[ -d android ]] || (cd app && npx cap add android >&2)
(cd app && npx cap sync android >&2)

# 4. Gradle
if (( SIGN )); then
  # One key for every checkout and worktree (outside git), so an install over the last one keeps the app's data;
  # android/_keys/ of the main checkout is where it lived until 2026-10-14 and is moved here once.
  KEYS="${PASCALINE_KEYS:-${PASCALINE_CACHE:-$HOME/.cache/pascaline}/keys}"
  if [[ ! -f "$KEYS/throwaway.jks" && -f "$ROOT/android/_keys/throwaway.jks" ]]; then
    mkdir -p "$KEYS" && cp -p "$ROOT/android/_keys/throwaway.jks" "$KEYS/"
  fi
  if [[ ! -f "$KEYS/throwaway.jks" ]]; then
    mkdir -p "$KEYS"
    keytool -genkeypair -keystore "$KEYS/throwaway.jks" -alias throwaway -keyalg RSA -keysize 2048 -validity 3650 \
      -storepass pascaline-throwaway -keypass pascaline-throwaway -dname "CN=pascaline throwaway, O=not for release" >&2
  fi
  export PASCALINE_KEYSTORE="$KEYS/throwaway.jks"
fi
# Gradle: pinned distribution, SHA-256 checked, cached outside git (no wrapper jar in the repo; F-Droid uses its own Gradle)
GRADLE_VERSION=8.14.3
GRADLE_SHA256=bd71102213493060956ec229d946beee57158dbd89d0e62b91bca0fa2c5f3531
CACHE="${PASCALINE_CACHE:-$HOME/.cache/pascaline}"
GRADLE_HOME_DIR="$CACHE/gradle-$GRADLE_VERSION"
if [[ ! -x "$GRADLE_HOME_DIR/bin/gradle" ]]; then
  mkdir -p "$CACHE"
  ZIP="$CACHE/gradle-$GRADLE_VERSION-bin.zip"
  if [[ ! -f "$ZIP" ]]; then
    curl -fL --retry 3 -o "$ZIP.part" "https://services.gradle.org/distributions/gradle-$GRADLE_VERSION-bin.zip"
    mv -f "$ZIP.part" "$ZIP"
  fi
  echo "$GRADLE_SHA256  $ZIP" | sha256sum -c - >&2 || { rm -f "$ZIP"; exit 1; }
  unzip -q "$ZIP" -d "$CACHE"
fi
lock
trap unlock EXIT
(cd android && "$GRADLE_HOME_DIR/bin/gradle" --console=plain -q assembleRelease >&2)
unlock; trap - EXIT

# 5. dist/
if (( SIGN )); then SRC=android/app/build/outputs/apk/release/app-release.apk
else SRC=android/app/build/outputs/apk/release/app-release-unsigned.apk; fi
[[ -f "$SRC" ]] || { echo "no APK at $SRC" >&2; exit 1; }
mkdir -p dist
cp "$SRC" dist/pascaline.apk

if (( INSTALL )); then
  ADB=(adb); [[ -n "$SERIAL" ]] && ADB=(adb -s "$SERIAL")
  if ! "${ADB[@]}" install -r dist/pascaline.apk >&2; then
    "${ADB[@]}" uninstall io.github.buerlino.pascaline >&2   # signature clash: remove our own app only
    "${ADB[@]}" install dist/pascaline.apk >&2
  fi
fi
echo "$ROOT/dist/pascaline.apk"
