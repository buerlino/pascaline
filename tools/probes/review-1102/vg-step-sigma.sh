#!/usr/bin/env bash
# vg hunter (night review 2026-11-02), finding vg-3: G143's jump check (pasujl, units/evaluate.ts) knows floor, ceil,
# trunc, frac, round, sign and Heaviside, not piecewise/when: an input whose x ± 2σ crosses the condition shows σ with no ⚠.
# Needs the Find index (npm run index in app/), or FIND_INDEX_JSON.
# Run behind the CPU guard.
set -u
REPO=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)  # the checkout this file is in
W=$REPO
export GIAC_OUT=${GIAC_OUT:-$REPO/engine/giac/_out/gsl} FIND_INDEX_JSON=${FIND_INDEX_JSON:-$REPO/app/src/find/_gen/find-index.json} ALTS=0
for e in 'floor(pasupm(2.95,0.1))' 'piecewise(pasupm(2.95,0.1)<3,1,2)' 'when(pasupm(2.95,0.1)<3,1,2)' \
         'piecewise(pasupm(2.95,0.1)<3,pasupm(2.95,0.1),6)*{m}'; do
  env -C "$W" node "$W/tools/probes/unit-result.ts" "$e" | head -3
done
