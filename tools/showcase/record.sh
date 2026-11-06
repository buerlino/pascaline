#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# The showcase recorder (tests/core/SHOWCASE.md "Next", step 1): the clips of tests/core/showcase.yaml pressed on the
# phone at the song's beats, each recorded by `adb shell screenrecord` (app/test-device/showcase.rec.ts).
#   tools/showcase/record.sh [--clips s1,A,s8] [--out DIR] [--advance FILE]
# Needs the test build installed (tools/device-build.sh --test --install: WebView debugging on). $ANDROID_SERIAL is the
# device (default: the Fairphone 6). Holds the device lock and host-cpu (steady timing), keeps the screen on, puts the
# status bar in Android's demo mode (fixed clock, full battery, no notifications); all of it is undone on exit, the
# screen setting to the device's own (stay-awake.sh --restore-real). Writes <out>/<clip>.mp4 and <out>/<clip>.json;
# then tools/showcase/stitch.py <out>. --advance: a JSON {clip: ms} of evals pressed early (stitch.py's report).
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SERIAL="${ANDROID_SERIAL:-4d42e62f}"
CLIPS=""; OUT=""; ADVANCE=""
while (( $# )); do case "$1" in
  --clips) CLIPS="$2"; shift 2 ;;
  --out) OUT="$2"; shift 2 ;;
  --advance) ADVANCE="$(realpath "$2")"; shift 2 ;;
  *) echo "unknown option $1" >&2; exit 2 ;;
esac; done
OUT="$(realpath -m "${OUT:-$HOME/.cache/n62/showcase/take-$(date +%Y%m%d-%H%M%S)}")"
mkdir -p "$OUT"
A=(adb -s "$SERIAL")
OWNER="showcase-record-$$"
DEMO_WAS=""

cleanup() {
  if [[ -n "$DEMO_WAS" ]]; then
    "${A[@]}" shell am broadcast -a com.android.systemui.demo -e command exit >/dev/null 2>&1 || true
    if [[ "$DEMO_WAS" == "null" ]]; then "${A[@]}" shell settings delete global sysui_demo_allowed >/dev/null 2>&1 || true
    else "${A[@]}" shell settings put global sysui_demo_allowed "$DEMO_WAS" >/dev/null 2>&1 || true; fi
  fi
  "$REPO/tools/stay-awake.sh" "$SERIAL" --restore-real >&2 || true
  "$REPO/tools/devlock.sh" release host-cpu "$OWNER" >&2 || true
  "$REPO/tools/devlock.sh" release "$SERIAL" "$OWNER" >&2 || true
}
"$REPO/tools/devlock.sh" acquire "$SERIAL" "$OWNER" 600 || { echo "device $SERIAL busy" >&2; exit 3; }
trap cleanup EXIT
"$REPO/tools/devlock.sh" acquire host-cpu "$OWNER" 1800 || { echo "host-cpu busy" >&2; exit 3; }
"$REPO/tools/stay-awake.sh" "$SERIAL" >&2 || exit 4
sleep 1
win="$("${A[@]}" shell dumpsys window 2>/dev/null | tr -d '\r' || true)"
if grep -q 'isKeyguardShowing=true' <<<"$win"; then echo "the device is locked: unlock it first" >&2; exit 4; fi
# no tap dots (SHOWCASE.md): the developer option must be off; we do not change it
if [[ "$("${A[@]}" shell settings get system show_touches | tr -d '\r')" == "1" ]]; then
  echo "Show taps is on (Developer options): turn it off first" >&2; exit 4
fi

DEMO_WAS="$("${A[@]}" shell settings get global sysui_demo_allowed | tr -d '\r')"
"${A[@]}" shell settings put global sysui_demo_allowed 1
demo() { "${A[@]}" shell am broadcast -a com.android.systemui.demo -e command "$@" >/dev/null; }
demo enter
demo clock -e hhmm 1200
demo battery -e level 100 -e plugged false
demo network -e wifi show -e level 4 -e fully true
demo network -e mobile hide
demo notifications -e visible false
demo status -e volume hide -e bluetooth hide -e location hide -e alarm hide -e sync hide -e tty hide -e eri hide -e mute hide -e speakerphone hide

[[ -x "$REPO/app/node_modules/.bin/playwright" ]] || { echo "no Playwright in $REPO/app/node_modules: npm ci there first" >&2; exit 5; }
echo "showcase take → $OUT" >&2
cd "$REPO/app" && ANDROID_SERIAL="$SERIAL" SHOWCASE_OUT="$OUT" SHOWCASE_CLIPS="$CLIPS" SHOWCASE_EVAL_ADVANCE="$ADVANCE" \
  timeout 3000 npx --no-install playwright test -c playwright.showcase.config.ts
rc=$?
echo "showcase take → $OUT (exit $rc)" >&2
exit $rc
