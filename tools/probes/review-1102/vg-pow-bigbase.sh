#!/usr/bin/env bash
# vg hunter (night review 2026-11-02), finding vg-1: patch 0025 keeps Giac's root-extraction rewrite when the base's
# double is not finite, so b^(s/d) with b > 1.8E308 takes another branch. Home and CAS against mpmath.
# Run behind the CPU guard (the night review's COMMON): tools/devlock.sh status | grep -q '^host-cpu:' || bash <this>
set -u
REPO=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)  # the checkout this file is in
W=$REPO
export GIAC_OUT=${GIAC_OUT:-$REPO/engine/giac/_out/gsl}
date -r "$GIAC_OUT/giac.wasm"
FACTS=1 env -C "$W" node "$W/tools/probes/engine.ts" '(10^400)^(i/1000)' '(10^200)^(i/1000)' '(10^400)^sqrt(-1-10^-3)'
FACTS=1 MODE=cas env -C "$W" node "$W/tools/probes/engine.ts" 'evalf((10^400)^(i/1000))'
"$REPO/tests/golden/.venv/bin/python" -I -c "
import mpmath as m; m.mp.dps = 30
for B in (400, 200):
    print(B, m.exp(1j*B*m.log(10)/1000), m.exp(m.sqrt(m.mpf(-1)-m.mpf(10)**-3)*B*m.log(10)))"
