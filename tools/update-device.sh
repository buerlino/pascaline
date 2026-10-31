#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# A43: an app update keeps the user's data, on the device (steps: tools/update-device.ts). Holds the device lock, keeps it
# awake, restores it after. Needs both APKs (old: build.sh of ef857a6 with WebView debugging on; new: tools/device-build.sh --test).
#   ANDROID_SERIAL=<s> tools/update-device.sh <old.apk> <new.apk> [shots-dir]
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERIAL="${ANDROID_SERIAL:?set ANDROID_SERIAL to the device}"
OLD="${1:?old apk}" NEW="${2:?new apk}" SHOTS="${3:-$REPO/.tasks/update-device-shots}"
OWNER="update-device-$$"
"$REPO/tools/devlock.sh" acquire "$SERIAL" "$OWNER" 600 || { echo "device $SERIAL busy" >&2; exit 3; }
cleanup() { "$REPO/tools/stay-awake.sh" "$SERIAL" --restore >&2 || true; "$REPO/tools/devlock.sh" release "$SERIAL" "$OWNER" >&2 || true; }
trap cleanup EXIT
"$REPO/tools/stay-awake.sh" "$SERIAL" >&2 || exit 4
sleep 1
OLD_APK="$(realpath "$OLD")" NEW_APK="$(realpath "$NEW")" SHOTS="$SHOTS" timeout 900 node "$REPO/tools/update-device.ts"
