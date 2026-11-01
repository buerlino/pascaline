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

# 6. A58: a pipeline wait for host-cpu that passes the note time logs one line with the holder and how long it has held the lock
LIB="$(cd "$(dirname "$SRC")/.." && pwd)/scripts/pipeline-lib.sh"
export PASCALINE_COORD="$T/c6"; mkdir -p "$T/c6/locks/host-cpu"
echo annabell-a53 > "$T/c6/locks/host-cpu/owner"; date -Iseconds -d '-700 seconds' > "$T/c6/locks/host-cpu/since"
(
  cd "$T/main"; coord="$T/c6"; log() { echo "$*" >> "$T/c6.log"; }
  # shellcheck source=scripts/pipeline-lib.sh
  source "$LIB"
  PASCALINE_LOCK_NOTE=2 PASCALINE_CPU_WAIT=6 host_cpu_acquire me "pre:" && exit 3
  exit 0
) || fail "a busy host-cpu was taken in the pipeline wait test"
[[ "$(grep -c 'pre: host-cpu held by annabell-a53 for [0-9]* s' "$T/c6.log")" == 1 ]] || fail "the long host-cpu wait logs no single holder line: $(cat "$T/c6.log")"
n="$(sed -n 's/.*held by annabell-a53 for \([0-9]*\) s.*/\1/p' "$T/c6.log")"
[[ "$n" -ge 700 && "$n" -lt 760 ]] || fail "the holder line gives $n s, not about 700"
grep -q 'pre: waiting for host-cpu (annabell-a53)' "$T/c6.log" || fail "the first wait line is gone"
# a wait shorter than the note time logs no holder line
rm -f "$T/c6.log"
(
  cd "$T/main"; coord="$T/c6"; log() { echo "$*" >> "$T/c6.log"; }
  source "$LIB"
  PASCALINE_LOCK_NOTE=600 PASCALINE_CPU_WAIT=1 host_cpu_acquire me "pre:" && exit 3
  exit 0
) || fail "a busy host-cpu was taken (short wait)"
grep -q 'held by' "$T/c6.log" && fail "a short wait logs a holder line"
rm -rf "$T/c6/locks/host-cpu"

# 7. A58: slice <name> <cmd...> runs one piece of a measurement under host-cpu and releases it after
DL="$T/main/tools/devlock.sh"
out="$("$DL" slice me-a sh -c 'echo piece; "$1" status' _ "$DL" 2>&1)" || fail "slice: a plain command failed: $out"
grep -q '^piece$' <<<"$out" && grep -q 'host-cpu: me-a' <<<"$out" || fail "slice: the command did not run under host-cpu held by <name>: $out"
"$DL" status | grep -q 'no locks held' || fail "slice: the lock is still held after the command"
rc=0; "$DL" slice me-b sh -c 'exit 7' >/dev/null 2>&1 || rc=$?
[[ $rc -eq 7 ]] || fail "slice: the command's exit code is $rc, not 7"
"$DL" status | grep -q 'no locks held' || fail "slice: the lock is still held after a failing command"
# a piece over the limit is killed (exit 124), the lock is released, the reason is said
t0=$SECONDS; rc=0; out="$(PASCALINE_SLICE_MAX=2 "$DL" slice me-c sleep 30 2>&1)" || rc=$?
[[ $rc -eq 124 && $((SECONDS - t0)) -lt 15 ]] || fail "slice: a piece over the limit: exit $rc after $((SECONDS - t0)) s: $out"
grep -q 'ran over 2 s' <<<"$out" || fail "slice: no reason for the kill: $out"
"$DL" status | grep -q 'no locks held' || fail "slice: the lock is still held after a kill"
# a busy host-cpu: the slice waits PASCALINE_SLICE_WAIT, then exits 1 without running the command
"$DL" acquire host-cpu other >/dev/null
rc=0; out="$(PASCALINE_SLICE_WAIT=0 "$DL" slice me-d sh -c 'echo ran' 2>&1)" || rc=$?
[[ $rc -eq 1 ]] && ! grep -q '^ran$' <<<"$out" || fail "slice: a busy lock ran the command or exited $rc: $out"
"$DL" release host-cpu other >/dev/null
# a slice killed by TERM releases the lock too
PASCALINE_SLICE_MAX=60 "$DL" slice me-e sleep 30 >/dev/null 2>&1 & sp=$!
for _ in $(seq 1 50); do "$DL" status | grep -q 'host-cpu: me-e' && break; sleep 0.1; done
kill -TERM "$sp"; wait "$sp" 2>/dev/null || true
"$DL" status | grep -q 'no locks held' || fail "slice: a TERM left the lock held"
# a slice reads the caller's stdin (a background job would get /dev/null)
out="$(echo piped | "$DL" slice me-f cat 2>&1)" || fail "slice: cat failed: $out"
grep -q '^piped$' <<<"$out" || fail "slice: the command got no stdin: $out"
# a waiting acquire gets the lock between two consecutive slices (it polls every 5 s; a loop of slices must not take it back at once)
mkdir -p "$T/c7"; export PASCALINE_COORD="$T/c7"
"$DL" slice me-g sleep 2 >/dev/null 2>&1 & sg=$!
for _ in $(seq 1 50); do "$DL" status | grep -q 'host-cpu: me-g' && break; sleep 0.1; done
"$DL" acquire host-cpu waiter 30 > "$T/waiter.out" 2>&1 & wp=$!
wait "$sg"
rc=0; PASCALINE_SLICE_WAIT=0 "$DL" slice me-h true >/dev/null 2>&1 || rc=$?   # the second slice of the loop, at once
"$DL" status | grep -q 'host-cpu: waiter' || fail "slice: the waiter did not get host-cpu between two slices (second slice exit $rc): $(cat "$T/waiter.out")"
[[ $rc -eq 1 ]] || fail "slice: the second slice took host-cpu from the waiter (exit $rc)"
wait "$wp" 2>/dev/null || true
"$DL" release host-cpu waiter >/dev/null
ls -A "$T/c7/locks" | grep -q '^\.waiting' && fail "a waiter marker is left behind"
unset PASCALINE_COORD

echo "devlock.test.sh: ok"
