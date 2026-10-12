#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Test for tools/devlock.sh (decisions M4-9): a lock taken in a git worktree is the one the main checkout sees.
# Builds a throwaway repo with a worktree in a temp dir; touches nothing else. Run: tools/devlock.test.sh
set -euo pipefail
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/devlock.sh"
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT
unset PASCALINE_COORD
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

echo "devlock.test.sh: ok"
