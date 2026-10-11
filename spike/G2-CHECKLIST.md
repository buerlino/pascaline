<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# G2 checklist (for the user, by hand)
Questions only a real HP Prime G2 (firmware 2.4 rev 15515) or the official Virtual Calculator can answer. The G2 is never connected to the laptop. Until a question is answered, anything that depends on it is `source: assumed`. Write the answer and the date next to each item; the answer then becomes `source: device` (or `virtual-calc`).

| # | Area | Question | Why we ask | Asked by | Answer |
|---|---|---|---|---|---|
| 1 | CAS, numeric | In which order are numeric eigenvalues shown, e.g. `eigenvals([[2.,1.,0.],[1.,3.,1.],[0.,1.,4.]])`? | GSL sorts ascending; Giac without GSL doesn't | Q5 | |
| 2 | Keyboard | Where do sin/cos/tan, x^y, √, a/b, ln, log, π, i and Shift sit, and what are their shifted functions? | Our prototype grid is our own choice, not a copy | ron | |
| 3 | Entry | After the a/b, x^y and √ templates, does the cursor stay inside until you press →, or does the next operator leave the template? | Today `x ^ 2 +` puts the + into the exponent | ron | |
| 4 | Home/CAS | Does ∛(-8) (or another odd root of a negative number) give -2 or a complex number in the default mode? | Our serializer gives the complex principal root | ron | |
| 5 | Entry | Is ÷ shown as ÷ in the entry line, or turned into a fraction? | Display of division | ron | |
| 6 | Entry | How are `2x`, `x(x+1)` and `1/2x` read (implicit multiplication; does `1/2x` mean (1/2)·x or 1/(2x))? | We emit `2*x`, `x*(x+1)`, `(1/2)*x` | ron | |
| 7 | CAS | How does the CAS show `factor(x^20-1)`: over the rationals only, or with √5 factors? | Our Giac build factors over ℚ(√5) | Q1 bench | |
| 8 | Home | How are exact ties rounded at 12 digits, e.g. `0.1234567890125`: half away from zero (0.123456789013) or half to even? | We round half away from zero | gorge | |
| 9 | Home | In real mode, does `sqrt(-4)` give `2*i` or an error? | We give `2*i` | gorge | |
| 10 | Home | What does `asin(2)` give (which complex branch, or an error)? | We give 1.57079632679-1.31695789692*i | gorge | |
| 11 | Home | Does `(-8)^(1/3)` give -2 or 1+1.73205080757*i? (Same question as #4 for the Home view) | We give the principal complex root | gorge | |
