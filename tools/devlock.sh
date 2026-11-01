#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Exclusive locks for shared resources during parallel work (devices, heavy host CPU use).
#
#   tools/devlock.sh acquire <resource> <owner> [wait_seconds]   # exit 0 = you hold it, 1 = busy
#   tools/devlock.sh release <resource> <owner>
#   tools/devlock.sh status
#   tools/devlock.sh break <resource>     # coordinator only, for a lock whose owner is gone
#   tools/devlock.sh slice <name> <cmd...> # A58: one piece of a long measurement: host-cpu for <name>, <cmd> under
#                                         # timeout PASCALINE_SLICE_MAX (600 s), host-cpu released after; exit = cmd's (124 = over the limit,
#                                         # 1 = host-cpu busy for PASCALINE_SLICE_WAIT, 1800 s). A worker holds host-cpu at most 10 minutes
#                                         # at a time: a longer measurement is a loop of slices, so a waiting check gets the lock between them.
#
# <resource> is an adb serial, "host-cpu", "integ" (the phase-1 worktree: merges and interactive edits), or "nodemods" (its app/node_modules: a copy out, an npm ci in; A47bf1). Locks are directories (mkdir is atomic).
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
cmd="${1:?usage: devlock.sh acquire|release|status|break|slice ...}"

case "$cmd" in
  acquire)
    res="${2:?resource}" owner="${3:?owner}" wait="${4:-0}" start=$SECONDS
    while ! mkdir "$LOCKS/$res" 2>/dev/null; do
      # A35: a lock whose recorded pid is gone on this host is broken; one without a pid (old format, or a caller that did not
      # opt in with PASCALINE_LOCK_PID) only by hand. Breakers take a guard, re-read the pid inside it and move the lock aside,
      # so two waiters that saw the same dead pid never delete a lock another waiter has just taken.
      lpid="$(cat "$LOCKS/$res/pid" 2>/dev/null || true)"; lhost="$(cat "$LOCKS/$res/host" 2>/dev/null || true)"
      if [[ "$lpid" =~ ^[1-9][0-9]*$ && "$lhost" == "$(hostname)" ]] && ! kill -0 "$lpid" 2>/dev/null \
         && mkdir "$LOCKS/.breaking-$res" 2>/dev/null; then
        if [[ "$(cat "$LOCKS/$res/pid" 2>/dev/null || true)" == "$lpid" ]] && mv "$LOCKS/$res" "$LOCKS/.stale-$res.$$" 2>/dev/null; then
          rm -rf "${LOCKS:?}/.stale-$res.$$"
          echo "broke stale lock $res (pid $lpid gone)" >&2
        fi
        rmdir "$LOCKS/.breaking-$res" 2>/dev/null || true
        continue
      fi
      if (( SECONDS - start >= wait )); then
        echo "busy: $res held by $(cat "$LOCKS/$res/owner" 2>/dev/null || echo '?')" >&2
        exit 1
      fi
      sleep 5
    done
    printf '%s\n' "$owner" > "$LOCKS/$res/owner"
    date -Iseconds > "$LOCKS/$res/since"
    # a pid is recorded only when the caller opts in with PASCALINE_LOCK_PID=<its own long-lived pid> (build.sh, pipeline.sh, the
    # build-wasm scripts export $$); agents and interactive shells call us from a short-lived shell, so they record none
    hpid="${PASCALINE_LOCK_PID:-0}"
    if [[ "$hpid" =~ ^[1-9][0-9]*$ ]]; then hostname > "$LOCKS/$res/host"; echo "$hpid" > "$LOCKS/$res/pid"; fi
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
      echo "$r: $(cat "$d/owner" 2>/dev/null) since $(cat "$d/since" 2>/dev/null)$([[ -f "$d/pid" ]] && echo ", pid $(cat "$d/pid") on $(cat "$d/host" 2>/dev/null)")"
    done
    (( any )) || echo "no locks held"
    ;;
  break)
    res="${2:?resource}"
    rm -rf "${LOCKS:?}/$res"
    echo "broke lock $res"
    ;;
  slice)
    name="${2:?name}"; shift 2
    (( $# )) || { echo "usage: devlock.sh slice <name> <cmd...>" >&2; exit 2; }
    max="${PASCALINE_SLICE_MAX:-600}"; swait="${PASCALINE_SLICE_WAIT:-1800}"; self="$(readlink -f "${BASH_SOURCE[0]}")"
    PASCALINE_LOCK_PID=$$ "$self" acquire host-cpu "$name" "$swait" >&2 || exit 1
    cp=""; rc=0
    trap '[[ -z "$cp" ]] || { kill -TERM "$cp" 2>/dev/null; wait "$cp" 2>/dev/null || true; }; "$self" release host-cpu "$name" >&2 || true' EXIT
    trap 'exit 143' TERM HUP INT
    timeout -k 30 "$max" "$@" & cp=$!
    wait "$cp" || rc=$?
    cp=""
    if [[ $rc -eq 124 ]]; then echo "slice $name: '$1' ran over $max s and was stopped; host-cpu is released; continue in the next slice" >&2; fi
    exit "$rc"
    ;;
  *) echo "unknown command $cmd" >&2; exit 2 ;;
esac
