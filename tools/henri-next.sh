#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Start the next coordinator of a night shift (docs/shifts/brief.md section 0c)
# as a fresh, detached, headless session, so no henri carries a long context.
# Usage: tools/henri-next.sh <n>   (starts henri_<n>, or the next free number;
# output in .coord/henri_<n>.out)
set -euo pipefail
n="${1:?usage: tools/henri-next.sh <n>}"
main="$(cd "$(dirname "$0")/.." && pwd)"
# A number already used (a henri that stopped) is never reused.
while [[ -e "$main/.coord/henri_$n.out" ]]; do n=$((n + 1)); done
out="$main/.coord/henri_$n.out"
cd "$main"
# A headless session stops background agents 10 min after its last turn;
# workers are spawned in the foreground, and this keeps any stray one alive.
export CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0
setsid nohup claude --agent henri --model sonnet --effort medium --permission-mode auto \
  -n "henri_$n" \
  -p "You are henri_$n. Resume the night shift from .coord/log.md: follow docs/shifts/brief.md section 0c, starting at the first step the log does not show as done." \
  >"$out" 2>&1 </dev/null &
echo "henri_$n started (pid $!), output in $out"
