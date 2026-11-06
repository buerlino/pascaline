<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Showcase video (owner, 2026-11-06)

The shot list for the showcase video: 17 short clips (about 5 s each), each showing something different. Every input and result comes from a case we run: the core list ([core.yaml](core.yaml), ids c…) or the unit e2e tests (`app/test/unitresult.spec.ts`, `unitpad.spec.ts`, `pmkey.spec.ts`, `unitconst.spec.ts`). Keys as in [MORNING.md](MORNING.md).

**Recording on the phone:** the built-in recorder (Quick Settings › Screen record; add the tile with the pencil if missing), **No audio**, **Show touches on screen** on. One file per clip, each from a fresh Home (Shift Esc). Practise the unit clips (6–9) once first.

**Unit pad:** in a unit slot the keys show units: 4 = k, 6 = g, 9 = m, 3 = s (flick up: h), ÷ = /, x² = ², xʸ = ³, ( = W. The units key is Shift Tmpl (or a flick up on Tmpl); a flick up on Enter evaluates.

| # | Clip | Keys | Shows | From |
|---|---|---|---|---|
| 1 | Parallel resistors | 1 a b/c 1 a b/c 4 7 0 0 ▶ + 1 a b/c 1 0 0 0 0 Enter | `≈ 3197.27891156`, stacked | c05 |
| 2 | Σ template | Tmpl, Σ; Alpha log (K) ▶ 1 ▶ 1 0 ▶ Alpha log x² Enter | `= 385` | c60 |
| 3 | = and ≈ | 0 . 1 + 0 . 2 Enter; 1 ÷ 3 ▶ Enter | `= 0.3`, then `≈ 0.333333333333` | c15, c14 |
| 4 | a b/c toggle | 0 . 7 5 Enter; a b/c; a b/c | `3/4`, then `0.75` | c62 |
| 5 | Fmt key | 9 9 9 9 9 . 9 9 9 9 9 9 9 9 9 Enter; Fmt, Fmt, Fmt | Scientific, Engineering, Standard | c61 |
| 6 | Unit conversion | 7 2, units key, k m / h, flick up Enter; tap the `m/s` chip | `72 km/h`, then `= 20 m/s` | unitresult |
| 7 | Unit check | units key on an empty line; k g m ² / s ³ Enter; W Enter | `1 W` | unitpad |
| 8 | Uncertainty | 2 . 5 Shift , (±) 0 . 1, units key, m, flick up Enter | `2.5 ± 0.1 m` | pmkey |
| 9 | Constants | 5, units key, k g; Math › Constants › Physics › g₀; Enter Enter | `49.03325 N` | unitconst |
| 10 | Complex in polar | DEG as in MORNING c25; 1 + Shift 2 (i) Enter; a b/c | `√2∡45` | c63 |
| 11 | CAS | CAS; Shift x² (√) 8 ▶ Enter; Tmpl d/dx, x xʸ 3 ▶ ▶ x Enter; Tmpl ∫, 0 ▶ 1 ▶ x² ▶ x Enter | `2√2`, `3x²`, `1/3` stacked | c34, c36, c35 |
| 12 | Find | CAS; Math, type `solve`, Enter; x² Shift . (=) 4 , x ▶ Enter | `{-2,2}` | c38 |
| 13 | Linear system | Tmpl 2×2 matrix; 2 ▶ 1 ▶ 1 ▶ (−) 1 ▶; Shift ÷ (x⁻¹) ×; Tmpl column vector; 5 ▶ 1 ▶ Enter | `[[2],[1]]` | c42 |
| 14 | A function | p(x):=x² as in MORNING c30; then p(3) | `= 9` | c30 |
| 15 | Solve app | place tile, 4 (Solve), Symb; x² − 5 x + 6 Shift . (=) 0 Enter; Num; ☰ 2 | `x = 2`, `x = 3` | c45 |
| 16 | Plot and Root | place tile, Function, Symb; x² − 2 Enter; Plot; ▶ ten times along the curve; ☰ 1 (Root) | the curve, `x = 1.41421356237` | c46 |
| 17 | Signed area | Symb; x² Enter; Plot; ☰ 5 (Signed area); ▶ ten times; Enter | `0.333333333333` (check whether the area is shaded) | c47 |

**Edit:** open on clip 1, the unit clips in the middle, close on the plot; one caption line per clip, name and link at the end; 60–80 s.
