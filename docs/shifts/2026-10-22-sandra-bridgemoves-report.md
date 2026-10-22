<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# S23: G85's report into packages (sandra, 2026-10-22)

**Status: reference.** On `phase-1` `f921d46`, branch `p1/sandra-bridgemoves`, pipeline run 185. G85 is GO (all four bars), so its moves are packages.

## Verified
- `tools/probes/bridge.ts --readers` on `f921d46`: 326 reader lines, 29 regex (bridge-1 48/0, bridge-2 159/25, bridge-3 119/4), the same as G85's report. Text baseline (`app/scripts/text-baseline.json`): 275 engine + 61 units = 336.
- `tools/probes/bridge-forms.ts` (new): `giac_parse` sees a program's global stores at its definition (`bump` → `cnt`, `h` → `m`, locals bound), `a+=1`, `=>`, `M[1,1]:=` and `purge` as targets, `expr("q:=5")` as a string leaf. So G66's store counter is not needed: the string case keeps the full read (G100).
- New: `giac_parse` binds nothing in the `x=a..b` form (`sum(x^2,x=1..3)`, `seq(x^2,x=1..3)` read x). Home today: after `x:=BesselJ(1,2)`, `sum(x^2,x=1..3)` shows ⚠ 14 "inherited: x" (F54's family; `engine.ts`). G99 fixes api.cc first.
- Giac quotes `diff`'s variable (`x:=3`, `diff(x^3,x)` = `3*x^2`): Home's ⚠ on it comes from the result naming x; G99 keeps it.
- F74 holds on `f921d46`: CAS and Home `f(x):=x^-1`, `f([[5],[1]])` = `[[1/5],[1]]` under `=` (`engine.ts`, `MODE=cas`).

## Each held package's fate
G66 replaced by G100 (not needed); G69 by G99; G72 by G100; G73 and G74 by G105; G95 by G104. G82 runs as written after G103; G92 after G102 (bridge-1 cannot see an assumption); G93 after G92 (decided). F75 → G98, F74 → G101, F73 → G103.

## Risks
1. G99 changes api.cc and makes the bridge required: the first night step builds the engine (A28 key build, about 5 min).
2. G103 is the largest (3 h); if it passes a day, the CAS value path (`host.ts` 777) is its own follow-up.
3. Heads that evaluate a string besides `expr` are (to verify, G100's worker, from the pinned tarball).

## Not done
- `docs/research/structure-audit.md` is decided but stays in `docs/research/` until its path in `api.cc` and `bridge.ts` comments can change with an engine-touching package (G99).
- `.claude/agents/sofia.md` line 35 still names `giacText.ts` (exact text in the report commit).
