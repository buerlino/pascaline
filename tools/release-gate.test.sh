#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Test for tools/release-gate.sh (A42): --dry-run prints the stages in order, each on the release engine; a GIAC_OUT that is not
# the release build is refused. Starts nothing. Run: tools/release-gate.test.sh
set -uo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script="$here/release-gate.sh"
fails=0; fail() { echo "FAIL: $*" >&2; fails=$((fails + 1)); }
[[ -x "$script" ]] || { echo "FAIL: no executable $script" >&2; exit 1; }

out="$(env -u GIAC_OUT "$script" --dry-run 2>&1)"; rc=$?
[[ $rc -eq 0 ]] || fail "--dry-run: exit $rc: $out"
prev=0
for st in build golden canaries core; do
  ln="$(grep -n "^STAGE $st " <<<"$out" | head -n1 | cut -d: -f1)"
  [[ -n "$ln" ]] || { fail "no STAGE $st line: $out"; continue; }
  (( ln > prev )) || fail "stage $st is out of order"; prev=$ln
  [[ "$st" == build ]] || grep "^STAGE $st " <<<"$out" | grep -q '_out/release' || fail "stage $st does not use _out/release"
done
grep '^STAGE' <<<"$out" | grep -E '_out/(gsl|base)' && fail "a stage names the dev engine"

out="$(GIAC_OUT=/tmp/x/engine/giac/_out/gsl "$script" --dry-run 2>&1)"; rc=$?
[[ $rc -eq 2 ]] && grep -q 'not the release build' <<<"$out" || fail "GIAC_OUT=_out/gsl: exit $rc: $out"
out="$(GIAC_OUT="$(cd "$here/.." && pwd)/engine/giac/_out/release" "$script" --dry-run 2>&1)"; rc=$?
[[ $rc -eq 0 ]] || fail "GIAC_OUT=this checkout's _out/release refused: $out"

[[ $fails -eq 0 ]] || { echo "release-gate.test.sh: $fails failure(s)" >&2; exit 1; }
echo "release-gate.test.sh: ok"
