#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Start the next coordinator of a night shift (docs/shifts/brief.md section 0c)
# as a fresh, detached, headless session, so no henri carries a long context.
# Usage: tools/henri-next.sh <n>   (starts henri_<n>; output in .coord/henri_<n>.out)
set -euo pipefail
n="${1:?usage: tools/henri-next.sh <n>}"
main="$(cd "$(dirname "$0")/.." && pwd)"
out="$main/.coord/henri_$n.out"
if [[ -e "$out" ]]; then
  echo "henri_$n was already started ($out); not starting it twice" >&2
  exit 1
fi
cd "$main"
setsid nohup claude --agent henri --model sonnet --effort medium --permission-mode auto \
  -n "henri_$n" \
  -p "You are henri_$n. Resume the night shift from .coord/log.md: follow docs/shifts/brief.md section 0c, starting at the first step the log does not show as done." \
  >"$out" 2>&1 </dev/null &
echo "henri_$n started (pid $!), output in $out"
