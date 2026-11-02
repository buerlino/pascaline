#!/usr/bin/env bash
# vg hunter (night review 2026-11-02), finding vg-2: G155's passem(l) (homeEval.ts ENGINE_DEFINITIONS) takes one
# parameter; Giac hands sem(list,weights) to it as one sequence of two lists, which passes the DOM_LIST check, so
# stddevp(list,weights) is divided by sqrt(2) (the number of arguments), not by sqrt(n). Home's parser renames sem( to
# passem( (ourNames.ts CALL_NAME); the probe calls passem directly. Run behind the CPU guard.
set -u
REPO=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)  # the checkout this file is in
W=$REPO
export GIAC_OUT=${GIAC_OUT:-$REPO/engine/giac/_out/gsl}
env -C "$W" node "$W/tools/probes/engine.ts" 'passem([1,2,3])' 'passem([1,2,3],[1,1,1])' 'stddevp([1,2,3],[1,1,1])' \
  'passem([1,2,3],[2,2,2])' 'passem([1,2,3,4,5],[1,1,1,1,1])'
"$REPO/tests/golden/.venv/bin/python" -I -c "
import mpmath as m
print('sem([1,2,3]) =', 1/m.sqrt(3), ' sem([1..5]) =', m.sqrt(m.mpf(5)/2)/m.sqrt(5))"
