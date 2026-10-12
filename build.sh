#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Clean source -> engines -> web app (dist/) -> Capacitor sync -> Gradle -> APK. The F-Droid recipe runs the same steps itself (fdroid/README.md).
#
#   ./build.sh [--dev] [--measure] [--unsigned] [--engine-dir DIR] [--python-dir DIR | --no-python] [--qalc-dir DIR | --no-units] [--install [SERIAL]]
#
#   (default)        engine built with the pinned Debian trixie Emscripten in a container (P2: what every release ships)
#   --dev            engine built with the local emsdk instead (engine/giac/build-wasm.sh; fast iteration only)
#   --engine-dir D   use an existing engine build (giac.mjs + giac.wasm in D) and skip the engine step
#   --python-dir D   use an existing MicroPython build (micropython.mjs + .wasm in D); default builds it like the engine (python/build-micropython.sh: dev with --dev, else release container)
#   --no-python      skip MicroPython (it is only copied to app/public/python/ for milestone 3; nothing loads it at start)
#   --qalc-dir D     use an existing libqalculate build (qalc.mjs + qalc.wasm in D); default builds it like the engine (engine/qalc/build-wasm.sh: dev with --dev, else release container)
#   --no-units       skip libqalculate (the Find index then holds functions only; the Units app is milestone 5)
#   --measure        measurement build: timing marks to logcat (PASCALINE_MEASURE=1); never for release
#   --unsigned       leave the APK unsigned (what F-Droid wants); default signs with a throwaway key in android/_keys/
#   --install [S]    adb install -r on device S (default $ANDROID_SERIAL or the only device); installs org.pascaline.app only
# Output: dist/pascaline.apk (last line printed). Env: PASCALINE_DL_DIR (Giac/GMP/MPFR/GSL tarball cache), PASCALINE_QALC_DL_DIR (libxml2/libqalculate cache), ANDROID_HOME (default ~/Android/Sdk),
# NO_LOCK=1 (the caller holds the host-cpu lock).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

DEV=0 MEASURE=0 SIGN=1 INSTALL=0 SERIAL="${ANDROID_SERIAL:-}" ENGINE_DIR="" PYTHON_DIR="" WITH_PYTHON=1 QALC_DIR="" WITH_UNITS=1
while (( $# )); do
  case "$1" in
    --dev) DEV=1; shift ;;
    --python-dir) PYTHON_DIR="$(cd "$2" && pwd)"; shift 2 ;;
    --no-python) WITH_PYTHON=0; shift ;;
    --qalc-dir) QALC_DIR="$(cd "$2" && pwd)"; shift 2 ;;
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

# 1b. MicroPython (milestone 3 prepares it; app/public/python/ is copied into dist/, loaded lazily later)
if (( WITH_PYTHON )); then
  if [[ -z "$PYTHON_DIR" ]]; then
    if (( DEV )); then python/build-micropython.sh dev >&2; PYTHON_DIR="$ROOT/python/_out/dev"
    else python/build-micropython.sh release >&2; PYTHON_DIR="$ROOT/python/_out/release"; fi
  fi
  mkdir -p app/public/python
  cp "$PYTHON_DIR/micropython.mjs" "$PYTHON_DIR/micropython.wasm" app/public/python/
fi

# 1c. libqalculate (milestone 4: the Find index takes constant values and unit factors from it, run in Node; docs/04 7.1).
#     It is not copied into app/public/ or dist/: the Units worker that loads it in the browser is milestone 5.
if (( WITH_UNITS )); then
  if [[ -z "$QALC_DIR" ]]; then
    if (( DEV )); then engine/qalc/build-wasm.sh dev >&2; QALC_DIR="$ROOT/engine/qalc/_out/dev"
    else engine/qalc/build-wasm.sh release >&2; QALC_DIR="$ROOT/engine/qalc/_out/release"; fi
  fi
  [[ -f "$QALC_DIR/qalc.mjs" && -f "$QALC_DIR/qalc.wasm" ]] || { echo "no qalc.mjs/qalc.wasm in $QALC_DIR" >&2; exit 1; }
  export QALC_OUT="$QALC_DIR"
fi

# 2. web app -> app/dist
(( MEASURE )) && export PASCALINE_MEASURE=1 VITE_MEASURE=1
(cd app && npm ci --no-audit --no-fund >&2 && npm run build >&2)

# 3. Capacitor project (android/ is committed; sync copies dist/ and the plugin list into it)
[[ -d android ]] || (cd app && npx cap add android >&2)
(cd app && npx cap sync android >&2)

# 4. Gradle
if (( SIGN )); then
  KEYS="$ROOT/android/_keys"
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
    "${ADB[@]}" uninstall org.pascaline.app >&2   # signature clash: remove our own app only
    "${ADB[@]}" install dist/pascaline.apk >&2
  fi
fi
echo "$ROOT/dist/pascaline.apk"
