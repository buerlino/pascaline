#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Keep an Android device awake for long measurement sessions, and undo it afterwards.
#
#   tools/stay-awake.sh <serial>            # save originals (once), keep screen on, record device info
#   tools/stay-awake.sh <serial> --restore  # put the saved settings back
#
# Only touches: global stay_on_while_plugged_in, system screen_off_timeout. Originals are saved
# to the main checkout's .coord/devices/<serial>.orig the first time and never overwritten.
set -euo pipefail

SERIAL="${1:?usage: stay-awake.sh <serial> [--restore]}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# the main checkout's .coord, from any worktree (as devlock.sh does), so --restore works wherever it runs
COMMON="$(git -C "$REPO" rev-parse --path-format=absolute --git-common-dir)"
COORD="${PASCALINE_COORD:-$(dirname "$COMMON")/.coord}"
DIR="$COORD/devices"
mkdir -p "$DIR"
ORIG="$DIR/$SERIAL.orig"
sh_() { adb -s "$SERIAL" shell "$@" | tr -d '\r'; }

state="$(adb -s "$SERIAL" get-state 2>&1 || true)"
if [[ "$state" != device ]]; then
  echo "$SERIAL is not ready ($state). If 'unauthorized', someone must tap 'Allow USB debugging' on the device." >&2
  exit 2
fi

put() { # namespace key value ("null" deletes)
  if [[ "$3" == null ]]; then sh_ settings delete "$1" "$2" >/dev/null; else sh_ settings put "$1" "$2" "$3"; fi
}

if [[ "${2:-}" == --restore ]]; then
  [[ -f "$ORIG" ]] || { echo "no saved settings in $ORIG" >&2; exit 1; }
  # shellcheck disable=SC1090
  source "$ORIG"
  put global stay_on_while_plugged_in "$STAY_ON"
  put system screen_off_timeout "$SCREEN_OFF"
  echo "restored $SERIAL: stay_on_while_plugged_in=$STAY_ON screen_off_timeout=$SCREEN_OFF"
  exit 0
fi

if [[ ! -f "$ORIG" ]]; then
  printf 'STAY_ON=%q\nSCREEN_OFF=%q\n' \
    "$(sh_ settings get global stay_on_while_plugged_in)" "$(sh_ settings get system screen_off_timeout)" > "$ORIG"
fi
put global stay_on_while_plugged_in 7       # stay awake while on AC, USB or wireless charging
put system screen_off_timeout 2147483647    # and as long as allowed when on battery
sh_ input keyevent KEYCODE_WAKEUP || true
sh_ wm dismiss-keyguard >/dev/null 2>&1 || true   # only works without a secure lock screen

{
  echo "serial: $SERIAL"
  echo "model: $(sh_ getprop ro.product.manufacturer) $(sh_ getprop ro.product.model)"
  echo "android: $(sh_ getprop ro.build.version.release) (SDK $(sh_ getprop ro.build.version.sdk))"
  echo "soc: $(sh_ getprop ro.soc.manufacturer) $(sh_ getprop ro.soc.model) / platform $(sh_ getprop ro.board.platform) / hw $(sh_ getprop ro.hardware)"
  echo "abi: $(sh_ getprop ro.product.cpu.abi)  cores: $(sh_ cat /proc/cpuinfo | grep -c '^processor')"
  echo "ram: $(sh_ cat /proc/meminfo | grep MemTotal)"
  echo "webview: $(sh_ dumpsys webviewupdate | grep -iE 'current webview package' | head -1 | sed 's/^ *//')"
  echo "battery: $(sh_ dumpsys battery | grep -E 'level|temperature|AC powered|USB powered' | tr -s ' \n' ' ')"
  echo "recorded: $(date -Iseconds)"
} | tee "$DIR/$SERIAL.info"
echo "stay-awake on for $SERIAL (originals in $ORIG)"
