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
