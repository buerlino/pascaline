#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# A32: replay the core list (tests/core/core.yaml) on a device's WebView over adb. Needs the test build installed:
#   tools/device-build.sh --test --install
#   tools/core-device.sh [--only c05,c07]     # $ANDROID_SERIAL is the device; holds its lock, keeps it awake, restores after
# Prints `CORE DEVICE <passed>/<active> (known <k>, needs <n>)`; one JSON line per case goes to .coord/device-runs.jsonl
# (kind core). Exit 0 when the count is complete. Our app's data is cleared before each case (pm clear), nothing else is touched.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERIAL="${ANDROID_SERIAL:?set ANDROID_SERIAL to the device}"
ONLY=""
while (( $# )); do case "$1" in --only) ONLY="$2"; shift 2 ;; *) echo "unknown option $1" >&2; exit 2 ;; esac; done
OWNER="core-device-$$"
"$REPO/tools/devlock.sh" acquire "$SERIAL" "$OWNER" 600 || { echo "device $SERIAL busy" >&2; exit 3; }
cleanup() { "$REPO/tools/stay-awake.sh" "$SERIAL" --restore >&2 || true; "$REPO/tools/devlock.sh" release "$SERIAL" "$OWNER" >&2 || true; }
trap cleanup EXIT
"$REPO/tools/stay-awake.sh" "$SERIAL" >&2 || exit 4
sleep 1
win="$(adb -s "$SERIAL" shell dumpsys window 2>/dev/null | tr -d '\r' || true)"  # captured first: grep -q would SIGPIPE adb
if grep -q 'isKeyguardShowing=true' <<<"$win"; then
  echo "the device is locked: unlock it, and for a night keep its screen on while charging (brief 0c rule 2); never remove its PIN" >&2; exit 4
fi
python3 "$REPO/tools/device_run.py" status >&2 || true
GREP=(); [[ -n "$ONLY" ]] && GREP=(--grep "\b(${ONLY//,/|}) ")
cd "$REPO/app" && timeout 3000 npx playwright test -c playwright.device.config.ts "${GREP[@]}"
rc=$?
python3 "$REPO/tools/device_run.py" status >&2 || true
exit $rc
