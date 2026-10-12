#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Exclusive locks for shared resources during parallel work (devices, heavy host CPU use).
#
#   tools/devlock.sh acquire <resource> <owner> [wait_seconds]   # exit 0 = you hold it, 1 = busy
#   tools/devlock.sh release <resource> <owner>
#   tools/devlock.sh status
#   tools/devlock.sh break <resource>     # coordinator only, for a lock whose owner is gone
#
# <resource> is an adb serial or "host-cpu". Locks are directories (mkdir is atomic).
# Locks live in the main checkout's .coord (shared by every git worktree); PASCALINE_COORD overrides.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Default: the MAIN checkout's .coord, so a lock taken in a git worktree is the shared one (decisions M4-9).
# `git rev-parse --git-common-dir` is the main checkout's .git from any worktree; its parent is the main checkout.
# PASCALINE_COORD still overrides it. Outside a git checkout, fall back to this copy's own .coord.
COMMON="$(git -C "$REPO" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
if [[ -n "$COMMON" ]]; then MAIN_REPO="$(dirname "$COMMON")"; else MAIN_REPO="$REPO"; fi
LOCKS="${PASCALINE_COORD:-$MAIN_REPO/.coord}/locks"
mkdir -p "$LOCKS"
cmd="${1:?usage: devlock.sh acquire|release|status|break ...}"

case "$cmd" in
  acquire)
    res="${2:?resource}" owner="${3:?owner}" wait="${4:-0}" start=$SECONDS
    while ! mkdir "$LOCKS/$res" 2>/dev/null; do
      if (( SECONDS - start >= wait )); then
        echo "busy: $res held by $(cat "$LOCKS/$res/owner" 2>/dev/null || echo '?')" >&2
        exit 1
      fi
      sleep 5
    done
    printf '%s\n' "$owner" > "$LOCKS/$res/owner"
    date -Iseconds > "$LOCKS/$res/since"
    echo "acquired $res for $owner"
    ;;
  release)
    res="${2:?resource}" owner="${3:?owner}"
    holder="$(cat "$LOCKS/$res/owner" 2>/dev/null || true)"
    [[ "$holder" == "$owner" ]] || { echo "not releasing $res: held by '${holder:-nobody}', not $owner" >&2; exit 1; }
    rm -rf "${LOCKS:?}/$res"
    echo "released $res"
    ;;
  status)
    shopt -s nullglob
    any=0
    for d in "$LOCKS"/*/; do
      any=1
      r="$(basename "$d")"
      echo "$r: $(cat "$d/owner" 2>/dev/null) since $(cat "$d/since" 2>/dev/null)"
    done
    (( any )) || echo "no locks held"
    ;;
  break)
    res="${2:?resource}"
    rm -rf "${LOCKS:?}/$res"
    echo "broke lock $res"
    ;;
  *) echo "unknown command $cmd" >&2; exit 2 ;;
esac
