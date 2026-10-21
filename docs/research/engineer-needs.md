<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# R3: what engineers need day to day, mapped to Giac (sandra)

**Status (2026-10-21): reference.** R3's coverage of everyday engineering tasks on Giac (2026-10-10); a source for docs/03 and the Find tiers, nothing left to decide.

*Moved from `spike/research/` on 2026-10-12 (cleanup audit). The `spike/` paths below were archived; they are in `git show 8ff8576:<path>`.*

Method: a list of everyday engineering tasks (my own, from general engineering practice; no manual text), each tried on our GSL wasm build through `spike/research/coverage-probe.mjs` (`GIAC_OUT=... node coverage-probe.mjs ['expr' ...]`, Giac 2.1.0, desktop Node). "OK" = right-looking answer in a few ms; values were eyeballed, not oracle-checked (this is a coverage probe, not a test suite). Where I did not run something it says so.

## Coverage table

| Need | Giac command that worked | Status and gap |
|---|---|---|
| Units: convert `5 km -> m`, `km/h -> m/s`, `psi -> Pa`, `ft -> m` | `convert(5*_km,_m)`, `convert(1*_psi,_Pa)`, `ufactor(5*_ft,_m)` | OK, but results come back as `27.77..._(m*s^-1.0)` (float exponents) and need our own formatter. |
| Units: mixed-unit sums `5 ft + 2 in` | `5*_ft+2*_inch` = `5.16666666667_ft`; `convert(5*_ft+2*_inch,_m)` = `1.5748_m` | Works. My first probe used `_in`, which is **not a Giac unit name** (Giac's inch is `_inch`), hence the "Incompatible units" error. Gap is naming only: our unit table/keyboard must map familiar names (in, ft, lb, mph...) to Giac's, and show a friendly error for unknown names. |
| Units: **temperature** `25 degC -> K / degF` | `convert(25*_degC,_K)` | **Error** ("Incompatible units" / "could not be converted to MKSA"). Offset units are not handled by `convert`; `tconvert` stays unevaluated. Gap: small table of our own offset conversions (C, F, K, R). |
| Physical constants | `_c_`, `_qe_`, `_h_`, `_mu0_`, `_epsilon0_`, `_NA` parse | **Not numeric**: `evalf(_c_)` gives `1.0_c_` (a unit of that name). Gap: we ship our own constants table with CODATA values and units (e.g. generated from NIST data, public domain). |
| Complex arithmetic, abs, conj, re/im | `(3+4*i)*(1-2*i)`, `abs`, `conj`, `re` | OK. |
| Phasors / polar form | `abs`, `arg`, `exp(i*pi/6)` | `arg(3+4*i)` is exact `atan(4/3)`, `evalf(arg(..)*180/pi)` = 53.1301023542 OK. **`polar_complex(...)` stays unevaluated**; polar display (magnitude, angle in the current angle mode) is our formatter's job. |
| Number bases | `0b1011+0x1F` = 42, `convert(255,base,16)` = `[15,15]` | Parsing of `0b`/`0x` OK. Output as hex string is **not** provided (`hexa(255)` unevaluated, `convert(...base...)` returns digit lists), and `binary_and` names are not defined. Gap: our own base display (BIN/OCT/DEC/HEX, word size, two's complement). `bitand`, `bitor`, `bitxor` do work (8, 14, 6). |
| Matrices: det, inverse, product, rref, eigen*, LU, SVD, linsolve | all of them | OK and exact. SVD prints floats. |
| Numeric solve, one equation | `fsolve(x*exp(x)=5,x=1)` = 1.32672466524; `fsolve(cos(x)=x,x=0..1,brent_solver)` = 0.739085133215 | OK. **Argument forms matter**: `brent_solver` needs an interval `x=0..1`; with a guess (`x=0.5`) it errors "Bad Argument Type". This is the shape of our Solve strategy (bracket first, then Brent). |
| Numeric solve, systems | `fsolve([x^2+y^2=4,x*y=1],[x,y],[1,1])` | OK, returns one root near the guess. |
| Polynomial roots | `proot([1,-6,11,-6])` = `[1.0,2.0,3.0]` | OK. |
| Solve symbolic | `solve(x^2-2=0,x)` | OK, but the raw text is `list[-sqrt(2),sqrt(2)]`: needs result parsing/`latex()`. `nSolve` returned only the first root (-1.414...). |
| Integration, exact and numeric | `int(sin(x)^2,x,0,pi)` = `1/2*pi`; `romberg(exp(-x^2),x,0,1)` = 0.746824132812 | OK. |
| Derivatives, limits, series, ODEs | `diff`, `limit`, `series`, `desolve(y'+y=0,y)` | OK. |
| Laplace / Fourier / partial fractions | `laplace`, `ilaplace`, `fourier`, `cpartfrac` | OK (useful for control and signals). |
| Statistics: mean, stddev, median, regression, correlation, normal CDF, binomial | all tried | OK. `stddev([1..5])` returns `sqrt(2)` (population sd; check which one the sample/population key should call). |
| Finance-style solve (rate from a growth equation) | `fsolve(1000*(1+x)^10=1500,x=0.05)` = 0.0413797439924 | OK. No TVM app built in. |
| Number theory/discrete | `gcd`, `ifactor`, `factorial(20)` | OK. |
| ENG / SCI notation, significant digits | not a Giac feature | Our formatter. `evalf(10^300*10^10)` prints `0.100000000000e311`, so Giac's float text must be reparsed, not shown directly. |
| Exact-first float traps | `exact(0.1+0.2)` = `3/10` | Works as the plan expects (Home design is gorge's track). |

Not tried: spreadsheet-style statistics (two-sample tests), finance functions beyond the above, vectors/units in matrices, interval arithmetic, 3-D vectors (cross product is surely there but I did not run it).

## Gaps to plan for (in priority order)
1. **Units layer of our own** on top of Giac: name aliases (`in` -> `_inch`, etc.), offset temperatures, float exponents in output. Everything else about units that I tried works (including mixed sums), so wrap rather than replace.
2. **Constants table** with numeric values and units.
3. **Number formatting**: SCI/ENG, significant digits, base display (hex/bin/oct), polar/rectangular complex. All formatter work, none of it Giac's.
4. **Result parsing**: `list[...]`, `GIAC_ERROR: ...` strings, `1.0_(c_)`-style unit output.
5. Solve front end: pick the Giac method per input form (interval for Brent; guess for Newton/systems).
