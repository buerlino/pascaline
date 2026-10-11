#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Build an app directory (default spike/app) into an Android APK with the Capacitor shell, and
# optionally install it on the tablet. One command for the whole team:
#
#   tools/device-build.sh [--app DIR] [--debug|--release] [--install] [--serial S]
#
# DIR must be a Vite project with @capacitor/* 8.5.3 and capacitor.config.ts (like spike/app).
# --release (default) is signed with a throwaway key (spike/android/_keys, gitignored).
# --install runs `adb install -r` for org.pascaline.app only (never other apps); annabell only.
# Output: prints the APK path on the last line. Takes the host-cpu lock for the Gradle part.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$REPO/spike/app" BUILD=release INSTALL=0 SERIAL="${ANDROID_SERIAL:-HA24BZ2Y}"
while (( $# )); do
  case "$1" in
    --app) APP="$(cd "$2" && pwd)"; shift 2 ;;
    --debug) BUILD=debug; shift ;;
    --release) BUILD=release; shift ;;
    --install) INSTALL=1; shift ;;
    --serial) SERIAL="$2"; shift 2 ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
done

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
MAIN="${REPO%%/.claude/worktrees/*}"   # main checkout, also when run from a worktree
export PASCALINE_DL_DIR="${PASCALINE_DL_DIR:-$MAIN/engine/giac/_downloads}"
# Engine build output: the main checkout's by default (only gorge rebuilds it).
export GIAC_OUT="${GIAC_OUT:-$MAIN/engine/giac/_out/gsl}"
KEYS="$REPO/spike/android/_keys"
OVERLAY="$REPO/spike/android/overlay"

cd "$APP"
[[ -d node_modules ]] || npm ci
npm run build

if [[ ! -d android ]]; then
  npx cap add android
fi
# Overlay: our MainActivity (timing marks, `--es path`) on top of the generated project.
cp "$OVERLAY/MainActivity.java" android/app/src/main/java/org/pascaline/app/MainActivity.java
npx cap sync android

if [[ "$BUILD" == release && ! -f "$KEYS/spike.jks" ]]; then
  mkdir -p "$KEYS"
  keytool -genkeypair -keystore "$KEYS/spike.jks" -alias spike -keyalg RSA -keysize 2048 -validity 3650 \
    -storepass pascaline-spike -keypass pascaline-spike -dname "CN=pascaline spike, O=throwaway" >/dev/null
fi
export PASCALINE_KEYSTORE="$KEYS/spike.jks"

"$REPO/tools/devlock.sh" acquire host-cpu "device-build" 1800 >&2
trap '"$REPO/tools/devlock.sh" release host-cpu device-build >&2 || true' EXIT
(cd android && ./gradlew --console=plain -q --init-script "$OVERLAY/init.gradle" "assemble${BUILD^}") >&2
"$REPO/tools/devlock.sh" release host-cpu device-build >&2; trap - EXIT

if [[ "$BUILD" == release ]]; then
  APK="$APP/android/app/build/outputs/apk/release/app-release.apk"
else
  APK="$APP/android/app/build/outputs/apk/debug/app-debug.apk"
fi
[[ -f "$APK" ]] || { echo "no APK at $APK (release without PASCALINE_KEYSTORE builds app-release-unsigned.apk)" >&2; exit 1; }
if (( INSTALL )); then
  # debug and release are signed differently: on a signature clash remove OUR app (and only ours) first.
  if ! adb -s "$SERIAL" install -r "$APK" >&2; then
    adb -s "$SERIAL" uninstall org.pascaline.app >&2
    adb -s "$SERIAL" install "$APK" >&2
  fi
fi
echo "$APK"
