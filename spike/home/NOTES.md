<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Exact-first Home (spike step 5, Q3)

Files: `spike/app/src/home/homeEval.ts` (core, runs next to the engine), `cases.yaml` (123 cases),
`oracle.py` (expected values), `run.ts` (Node runner). Engine patch 0002 + `giac_set_pow_limit` in
`engine/giac/` (see `engine/giac/patches/README.md`).

```bash
python3 -m venv spike/.venv && spike/.venv/bin/pip install mpmath==1.3.0 pyyaml==6.0.2
spike/.venv/bin/python spike/home/oracle.py            # check expect values (--write fills them)
node spike/home/run.ts                                  # ROUNDS=5, GIAC_MJS=<giac.mjs>, OUT=<json>
node spike/node/interrupt-test.mjs                      # engine regression test for patch 0002
```

## How it works
1. Decimal literals in the input become exact rationals (`0.1` → `(1/10)`, `1.5e300` → `(15*10^299)`).
2. Giac evaluates exactly, with Giac's own interrupt after `budgetMs` (300 ms): `timeout 0.3` + `ckevery 10`.
3. The value is rounded to 12 significant digits, half away from zero: exact rationals with BigInt
   arithmetic (no double rounding), anything else from `evalf(…,40)`.
4. Guards:
   - **time**: the exact evaluation is interrupted → re-evaluate with `Digits:=30` floats, round, mark approximate.
   - **size of one power**: `giac_set_pow_limit(1e5)`; `b^n` with |n·ln b| > 1e5 (≈43,000 digits) errors at once → float path.
     Needed because one huge GMP power can't be interrupted (`(1000001/1000000)^1000000`: 856 ms in a single call).
   - **size of the result**: numerator or denominator over 20 digits → shown from the exact value (already
     computed), but `Ans` keeps a 30-digit float so the blow-up doesn't carry into the next calculation.
     The literal plan (re-evaluate in float) is `guardMode: "reeval-float"`; on these 123 cases both give
     identical displays, and rounding the exact value is cheaper because it's already there.

## Desktop result (2026-10-11, Node 22.23, this machine, giac.wasm sha256 62b24490…1166)
**Q3 on desktop: pass.** 123/123 match (oracle or derived), no case over 500 ms. Medians over 5 fresh engines:
p50 0.16 ms, p95 3.4 ms, max 319 ms (`sum(1.0001^k,k,1,2000)`, time guard: 300 ms budget + ~20 ms float).
Paths: exact 107, exact-big 14, float-timeout 1, float-error (pow limit) 1.

Plain floating-point Giac (`evalf` at 12 digits) gets 20 of the same cases wrong: `1-0.9-0.1`, `1e16+1-1e16`,
cancellation (`exp(1)-2.718281828459`, `355/113-pi`), over/underflow (`1.5e300*2e300` → infinity,
`exp(-1000)` → 0), `sin(1e22)`, the 12th digit of `sum(1.1^k,k,1,500)`, and the three exact ties.

## Tab One result (2026-10-11, run by annabell)
**Q3 on the low-end device: pass.** Lenovo Tab One TB305FU, Android 15, WebView 131.0.6778.260, release build
(night/gorge@3ad1a78 + this engine), battery 80%, 24.9 °C. 5 cold launches of `/?home=1`: 123/123 in every run,
no case over 500 ms. Per-case medians: p50 3.9 ms, p95 65.7 ms, max 406 ms (`sum(1.0001^k,k,1,2000)`, the
time-guard case: 300 ms budget + float fallback ≈ 106 ms on this device). All 123 cases took ≈2.4 s per launch.
Next slowest: `sum(1.1^k,k,1,500)` 268 ms (exact, under the 300 ms budget but only just; a slower
device would push it to the float path, which gives the same 12 digits), `int(sin(x)/x,x,0,1)` 103 ms.
Raw logcat: `.coord/home-runs/run1..5.txt` (gitignored); summary: `spike/home/device_summary.py`.

## Findings
- Without a time guard, exact evaluation can hang: `sum(1.0001^k,k,1,2000)` takes 17.7 s exactly (16,000-digit rational).
- Giac's `timeout` in EMCC builds counted whole seconds (fired after 1–2 s). Patch 0002 makes it milliseconds;
  interrupts land within ~5 ms of the budget (worst seen: +127 ms in `expand((x+y+z+1)^40)`), and the engine
  stays usable without a worker restart. No exception escaped `caseval` in 16+17 forced interrupts with `ckevery 10`.
- At `Digits:=30`, Giac still parses decimal literals as binary floats: `1-0.9-0.1` → 2.96E-31 in the float path.
  The float fallback is only for cases the exact path gave up on, and is marked approximate.
- Giac's parser at `Digits:=12` turns a printed float beyond double range back into `infinity`
  (`re(0.199506311688e3011)` → `infinity`). Never re-parse printed floats; keep values in Giac variables.
- `powlog2float` is global: it also limits the CAS view. Fine for Home; the CAS default is a separate decision.

## Open
- Tab One run (through annabell): same cases in the WebView worker.
- Tie rule (half away from zero vs half even), complex display, `asin(2)` branch and `(-8)^(1/3)` → G2 checklist.
- Lists and matrices: shown as Giac text for now (out of scope for Q3).
