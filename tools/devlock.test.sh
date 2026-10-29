#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Test for tools/devlock.sh (decisions M4-9): a lock taken in a git worktree is the one the main checkout sees.
# Builds a throwaway repo with a worktree in a temp dir; touches nothing else. Run: tools/devlock.test.sh
set -euo pipefail
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/devlock.sh"
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT
unset PASCALINE_COORD PASCALINE_LOCK_PID  # a caller's pid (the pipeline exports its own) would be recorded by every acquire
fail() { echo "FAIL: $*" >&2; exit 1; }

mkdir -p "$T/main/tools"
cp "$SRC" "$T/main/tools/devlock.sh"
git -C "$T/main" init -q -b master
git -C "$T/main" add tools/devlock.sh
git -C "$T/main" -c user.name=t -c user.email=t@example.org commit -q -m init
git -C "$T/main" worktree add -q "$T/wt" -b side

# 1. acquire in the worktree, see it held from the main checkout
"$T/wt/tools/devlock.sh" acquire host-cpu test-wt >/dev/null
[[ -d "$T/main/.coord/locks/host-cpu" ]] || fail "lock not in the main checkout's .coord"
[[ ! -e "$T/wt/.coord" ]] || fail "worktree got a private .coord"
"$T/main/tools/devlock.sh" status | grep -q 'host-cpu: test-wt' || fail "main checkout does not see the worktree's lock"

# 2. the main checkout cannot take it; the owner mismatch cannot release it
if "$T/main/tools/devlock.sh" acquire host-cpu other 0 2>/dev/null; then fail "second acquire succeeded"; fi
if "$T/main/tools/devlock.sh" release host-cpu other 2>/dev/null; then fail "wrong owner released"; fi

# 3. release from the main checkout by the right owner
"$T/main/tools/devlock.sh" release host-cpu test-wt >/dev/null
"$T/wt/tools/devlock.sh" status | grep -q 'no locks held' || fail "lock still held after release"

# 4. PASCALINE_COORD still overrides
PASCALINE_COORD="$T/private" "$T/wt/tools/devlock.sh" acquire x me >/dev/null
[[ -d "$T/private/locks/x" ]] || fail "PASCALINE_COORD ignored"
"$T/main/tools/devlock.sh" status | grep -q 'no locks held' || fail "override leaked into the shared locks"

# 5. A35: a lock records pid and host; status shows the pid; a lock whose pid is gone is broken by the next acquire
export PASCALINE_COORD="$T/c5"
sleep 300 & live=$!
PASCALINE_LOCK_PID=$$ "$T/main/tools/devlock.sh" acquire r1 me >/dev/null
[[ -f "$T/c5/locks/r1/pid" ]] || fail "acquire writes no pid"
"$T/main/tools/devlock.sh" status | grep -q "pid $(cat "$T/c5/locks/r1/pid")" || fail "status does not show the pid"
"$T/main/tools/devlock.sh" release r1 me >/dev/null
mkdir -p "$T/c5/locks/r2"; echo ghost > "$T/c5/locks/r2/owner"; echo "$live" > "$T/c5/locks/r2/pid"; hostname > "$T/c5/locks/r2/host"
if "$T/main/tools/devlock.sh" acquire r2 new 0 2>/dev/null; then fail "a lock with a live pid was broken"; fi
kill "$live"; wait "$live" 2>/dev/null || true
out="$("$T/main/tools/devlock.sh" acquire r2 new 0 2>&1)" || fail "a lock with a dead pid was not broken: $out"
grep -q "broke stale lock r2 (pid $live gone)" <<<"$out" || fail "no stale-lock line: $out"
mkdir -p "$T/c5/locks/r3"; echo old > "$T/c5/locks/r3/owner"
if "$T/main/tools/devlock.sh" acquire r3 new 0 2>/dev/null; then fail "a lock without a pid was broken"; fi
mkdir -p "$T/c5/locks/r4"; echo far > "$T/c5/locks/r4/owner"; echo 999999 > "$T/c5/locks/r4/pid"; echo otherhost > "$T/c5/locks/r4/host"
if "$T/main/tools/devlock.sh" acquire r4 new 0 2>/dev/null; then fail "a lock of another host was broken"; fi
# a caller that does not opt in (an agent's short-lived shell) records no pid and is never broken
bash -c '"$1" acquire r5 agent >/dev/null' _ "$T/main/tools/devlock.sh"
[[ ! -e "$T/c5/locks/r5/pid" ]] || fail "a caller without PASCALINE_LOCK_PID got a pid recorded"
if "$T/main/tools/devlock.sh" acquire r5 pipeline 0 2>/dev/null; then fail "a lock held by a short-lived shell was broken"; fi
# two waiters on the same dead pid: exactly one breaks it, the other waits (no deleted live lock), no .stale leftovers
mkdir -p "$T/c5/locks/r6"; echo dead > "$T/c5/locks/r6/owner"; echo "$live" > "$T/c5/locks/r6/pid"; hostname > "$T/c5/locks/r6/host"
for i in 1 2 3 4 5 6; do ( PASCALINE_LOCK_PID=$$ "$T/main/tools/devlock.sh" acquire r6 "w$i" 0 >"$T/w$i.out" 2>&1 && echo ok >> "$T/winners" ) & done; wait $(jobs -p | grep -v "^$live$") 2>/dev/null || true
[[ "$(wc -l < "$T/winners")" == 1 ]] || fail "$(wc -l < "$T/winners") waiters hold the same lock"
ls -A "$T/c5/locks" | grep -q '^\.stale-\|^\.breaking-' && fail "stale or guard directories left behind"
unset PASCALINE_COORD

echo "devlock.test.sh: ok"
