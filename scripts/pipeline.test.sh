#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Test for scripts/pipeline.sh (A10): no agent is started, every call is a --dry-run or fails before a run.
# For every "### <agent>, <ID>: ... branch `B`" heading of brief section 7 in the phase-1 worktree, the dry run
# exits 0 and names B; a made-up ID exits 2 and names the ID; the tarball dir is printed even when unset.
#   scripts/pipeline.test.sh [path/to/pipeline.sh]      (default: the script next to this test)
set -uo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script="${1:-$here/pipeline.sh}"
integ="$(git worktree list --porcelain | awk '/^worktree /{w=$2} /^branch refs\/heads\/phase-1$/{print w}')"
[[ -n "$integ" ]] || { echo "no phase-1 worktree" >&2; exit 1; }
fails=0; count=0
fail() { echo "FAIL: $*" >&2; fails=$((fails + 1)); }
re='^### (ron|gorge|annabell|sandra), ([A-Z][0-9]+[a-z0-9]*):.*branch `([^`]+)`'
while IFS= read -r line; do
  [[ "$line" =~ $re ]] || { fail "heading without agent, ID and branch: $line"; continue; }
  agent="${BASH_REMATCH[1]}"; pid="${BASH_REMATCH[2]}"; br="${BASH_REMATCH[3]}"
  count=$((count + 1))
  out="$("$script" "$agent" "$pid" --dry-run 2>&1)"; rc=$?
  [[ $rc -eq 0 ]] || { fail "$agent $pid: exit $rc: $(tail -n 1 <<<"$out")"; continue; }
  grep -qF "branch $br" <<<"$out" || fail "$agent $pid: dry run does not print branch $br"
done < <(grep -E '^### [a-z]+, ' "$integ/docs/shifts/brief.md")
[[ $count -gt 0 ]] || fail "no package headings found"

out="$("$script" ron R9999x --dry-run 2>&1)"; rc=$?
[[ $rc -eq 2 ]] || fail "made-up ID: exit $rc, expected 2"
grep -q 'R9999x' <<<"$out" || fail "made-up ID: message does not name it: $out"

out="$(env -u PASCALINE_QALC_DL_DIR "$script" gorge G16 --dry-run 2>&1)"
grep -qE 'PASCALINE_QALC_DL_DIR=[^ ]*engine/qalc/_downloads' <<<"$out" || fail "dry run does not print the tarball dir to export"

[[ $fails -eq 0 ]] || { echo "pipeline.test.sh: $fails failure(s) in $count packages" >&2; exit 1; }
echo "pipeline.test.sh: ok ($count packages)"
