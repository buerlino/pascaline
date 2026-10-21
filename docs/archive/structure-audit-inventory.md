<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Structure audit, appendix: every text match over Giac text or LaTeX in app/src

**Status (2026-10-20): reference** (a snapshot of `phase-1` `d6f6093`; it goes stale with every engine package). The appendix of [the structure audit](../research/structure-audit.md), section 1.3: one line per site that reads Giac text or LaTeX with a regex, a string test or a hand-written scan, with what it decides and the form it misses. Written by three read-only helper agents of the audit session (sandra) from the code; "CONFIRMED" or "confirmed" means an engine or parser run showed it (`tools/probes/engine.ts`, `tools/probes/parse.ts`, as each row says), "(inferred)" means read from the pattern only. Paths are relative to `app/src/` unless a row says otherwise. Kinds: BRACKET (a bracket or top-level split), NAMES (finds identifiers or calls), STATE (decides stored or run-once), REWRITE (rewrites text sent to Giac), SHAPE (classifies a Giac answer), NUMBER (reads a number), LATEX-EDIT (edits the entry's LaTeX), OTHER. Reads: GIAC-OUT (text Giac printed), GIAC-IN (Giac input text we built or the user typed), LATEX, NUM (a number string), OTHER.

## A. engine/numeric.ts and engine/homeEval.ts (88 sites)

### numeric.ts
| file:line | function | reads | what it decides | what it misses | kind |
|---|---|---|---|---|---|
| numeric.ts:85,90 | COMPLEX_CALL / complexSafe | GIAC-IN (+OUT: printed Ans at :593, stored text at :331) | which calls of tanh/asin/acos/atan/acosh go through our complex definitions | a function not followed by `(`. CONFIRMED: `evalf((tanh)(1+i))` shows 0.868014142896-0.217621561854*i (coth), ≈ with 38 confirmed digits, no ⚠ (mpmath tanh(1+i) = 1.08392332734+0.27175258532i). `evalf(map([1+i],tanh))` shows `[0.9-0.2*i]` (coth's leading digit) with ⚠ unaudited, 0 digits. An escaped quote `"a\"b"` in a string desyncs the `"[^"]*"` skip (inferred) | REWRITE |
| numeric.ts:99 | forValue | GIAC-IN (our rewrite) | which of our definitions to load | substring test: `pasacosh` contains `pasacos`, so pasacos loads too (harmless extra eval) | OTHER |
| numeric.ts:101 | forValue | GIAC-OUT | our definition is not loaded yet (the name prints as itself) | a user value stored under `pastanh` etc. prints otherwise, so ours is never loaded and the user's value is called (inferred; the `pas` prefix is not refused here) | STATE |
| numeric.ts:106,110 | FLOAT_LITERAL / hasFloat | GIAC-OUT | Giac printed a float (exact vs float path, ⚠ on symbolic) | a float-looking string literal. CONFIRMED: Home `"1.5"` is `approximate`, ⚠ unchecked | SHAPE |
| numeric.ts:120 | floatsAtDigits | GIAC-OUT | rounds every printed float to the display digits via Giac | digits inside a string literal are rewritten. CONFIRMED: Home `"1.123456789012345678"` shows `"1.12345678901"` with ⚠ | REWRITE |
| numeric.ts:121 | floatsAtDigits | GIAC-OUT (a FLOAT_LITERAL match) | mantissa and exponent of the literal | none found | NUMBER |
| numeric.ts:124 | floatsAtDigits | GIAC-OUT | first significant digit | none found | NUMBER |
| numeric.ts:148 | floatsShown | GIAC-OUT | regroup failed (`undef`) | none found | SHAPE |
| numeric.ts:156-171 | closing | GIAC-IN (+OUT via decisionCuts on printed program bodies) | the bracket that closes one at `open` | an escaped quote `"a\"b"` (Giac accepts it: raw `size("a\"b")` = 3) ends the string skip early (inferred effect); `(`, `[`, `{` share one depth, so `(]` pairs (inferred; Giac rejects such input) | BRACKET |
| numeric.ts:174-192 | topLevelArgs | GIAC-IN (+OUT at :349) | top-level comma split of an argument list | escaped quote as above; an unclosed quote swallows the rest; negative depth not detected (inferred) | BRACKET |
| numeric.ts:194,198-223 | PRECISION_CALL / withAskedPrecision | GIAC-IN | raises the n of `evalf(e,n)`/`approx(e,n)` at each check precision (M4-6) | an n that is not an integer literal is left pinned, so both evaluations agree on the same wrong digits. CONFIRMED: Home `evalf(sin(10^30),2*10)` shows -0.685710242506, ≈, reliableDigits 39, no ⚠; `evalf(sin(10^30),20)` shows -0.09011690191213805803 (mpmath -0.0901169019121380580303…). Also `evalf` passed as a value (`map(L,evalf)`) (inferred) | REWRITE |
| numeric.ts:195 (used :217, :237, :1048) | INTEGER | GIAC-IN | n is an integer literal | `2*10`, `+20`, `Digits` are not integers by design, see the row above | NUMBER |
| numeric.ts:232,235 | askedDigits | GIAC-IN (typed) | the whole input is `evalf(e,n)` (show n digits) | `-evalf(pi,30)`, `(evalf(pi,30))`, `2*evalf(pi,30)` are shown at the setting's digits (inferred) | SHAPE |
| numeric.ts:245 | functionsIn | GIAC-IN (+OUT: printed program bodies in callsStateful, decidingStored, complexReads) | the names called | a function used as a value: `map([1],inc)`, `(tanh)(…)`, `apply(f,…)`, `f@g`. CONFIRMED twice: via callsStateful (`map([1],inc)+floor(sqrt(2))` with `inc(x):={c:=c+1;c}` stores 3 times, c 1→4, then refused "undecided") and via complexSafe/isAudited (`(tanh)(1+i)` above). Keywords in a printed program (`for (`, `if (`) come back as calls; `for` and `return` are not in KEYWORDS, so `for` is asked of Giac on every Enter (inferred cost) | NAMES |
| numeric.ts:254 | namesIn | GIAC-IN (+OUT) | names not called | `0x1F` yields the name `x1F` (inferred); bound variables (`sum(k,k,1,9)`, lambda parameters) are reported as free names (callers mask some: boundIn, rationalOnly) | NAMES |
| numeric.ts:281 | nonReal | GIAC-OUT (print of `im(Ans)`) | value has a non-zero imaginary part | an imaginary part printed without a digit 1-9 (`pi`, `undef`, a name) reads as real (inferred; callers pass floats, so rare) | NUMBER |
| numeric.ts:305 | complexReads.stored | GIAC-OUT | the name is free or a builtin (prints as itself, or empty) | none found | STATE |
| numeric.ts:336-337 | complexReads | GIAC-IN | replaces a stored name by its copy slot `pasxn<k>` | the name as a bound variable or parameter (`sum(w,w,1,2)`, `(w)->…`) or quoted `'w'` is replaced too (inferred; a consistent rename is mostly harmless) | REWRITE |
| numeric.ts:345 | boundIn | GIAC-OUT (stored program print) | parameters of a stored program | a default value `(x,y=2)->` keeps `y=2` as a name; parameters of an inner `(y)->` are not bound (inferred) | NAMES |
| numeric.ts:347 | boundIn | GIAC-OUT | split of the parameter list | as above (split(",") on the head) | NAMES |
| numeric.ts:348,350 | boundIn | GIAC-OUT | `local` names | Giac prints `local a:=1,b` as `local a:=copy(1,b);` (CONFIRMED raw print), so topLevelArgs keeps one part and `b` is not bound | NAMES |
| numeric.ts:381-403 | splitList | GIAC-OUT (+NUM via numberLatex; converge.ts) | top-level elements of a printed list | strings are not skipped: `["a,b",1.5]` splits at the string's comma (CONFIRMED harmless: falls to symbolic); `{}` is not counted, so `[(x)->{local a,b;a},1]` splits inside the block (inferred) | BRACKET |
| numeric.ts:383-384 | splitList | GIAC-OUT | text is a bracketed list (`[`, `list[`) | `[1]+[2]` is caught by the depth<0 guard; none found | SHAPE |
| numeric.ts:405-413 | hasTopLevelComma | GIAC-OUT | a sequence, not a scalar | a comma in a string `"a,b"` (harmless: not a number anyway) | BRACKET |
| numeric.ts:421-423 | shapeOf | GIAC-OUT | `set[`, `poly1[` … prefix → not a number | none found | SHAPE |
| numeric.ts:429 | shapeOf | GIAC-OUT | a `list[` is never a matrix | none found | SHAPE |
| numeric.ts:458,462 | RATIONAL / rationalValue | GIAC-OUT | exact rational print `-7/3`, `12` | none found | NUMBER |
| numeric.ts:473 | anyValue | GIAC-OUT | Giac's negative-zero print `0.-000` → 0 | a negative zero with an exponent (`0.-000e-5`) (inferred) | NUMBER |
| numeric.ts:484,486 | shortDigits | GIAC-OUT | a part printed as a double (14-15 sig. digits) confirms one digit less | an MPFR value that prints 14-15 significant digits after Giac drops trailing zeros is taken as a double (one digit less, conservative); a double printed without a dot (`1e+20`) (inferred) | NUMBER |
| numeric.ts:492 | isError | GIAC-OUT | the engine wrapper's error prefix | none found | OTHER |
| numeric.ts:604 | exactFacts | GIAC-OUT | ICDF_FAILED flag is set | an error print counts as failed (conservative) | STATE |
| numeric.ts:823 | floatFactsOf | GIAC-OUT | ICDF_FAILED flag is set | same | STATE |
| numeric.ts:893 | floatPathFacts | GIAC-OUT | ICDF_FAILED flag is set | same | STATE |
| numeric.ts:981-994 | numberLatex | NUM (our STD/SCI/ENG text) | our number text as LaTeX (E → ×10^, i) | none found for our own formats | REWRITE |
| numeric.ts:1010-1017 | comparisonAt | GIAC-IN (+OUT via decidingStored) | a comparison operator at k (`->`, `=>` excluded) | none found for operators; see next row | OTHER |
| numeric.ts:1020-1024 | hasComparison | GIAC-IN (+OUT) | the input holds a comparison → may rest on a decision | comparisons written as calls (`superieur_strict(a,b)`, `is_positive(x)`) (inferred); escaped quote | OTHER |
| numeric.ts:1039 | rationalOnly | GIAC-IN (exact body) | a `"` or `.` means not rational-only | none found (conservative) | OTHER |
| numeric.ts:1042-1049 | rationalOnly | GIAC-IN | bound variable of a finite sum/product | `sum(k,k=1..9)` has 2 args → not rational-only (conservative) | NAMES |
| numeric.ts:1053-1059 | rationalOnly (pow) | GIAC-IN | an exponent that may be irrational | a sign before the bracket: `^-(1/2)` matches neither alternative, so rationalOnly is true and the second decision is skipped. CONFIRMED wrong exact result: Home `floor((2^-(1/2)+3^-(1/2))^2-5/6-2*6^-(1/2)+1)` shows `0` as exact (`=`); the value is floor(1) = 1 ((1/√2+1/√3)² = 5/6+2/√6), and the same input spelled `2^(-1/2)` shows 1 | OTHER |
| numeric.ts:1083-1084 | namePrint | GIAC-OUT | a builtin (printed `'name'`), cached per engine | an alias prints the canonical name: raw `arcsin` → `'asin'` (CONFIRMED), so arcsin is never cached and counts as not builtin (cost: every arcsin input is decided twice, inferred) | STATE |
| numeric.ts:1091 | notBuiltin | GIAC-OUT | name is not a builtin | same alias miss | STATE |
| numeric.ts:1098 | definitionStores | GIAC-OUT (printed program) | the program stores (`=>`, sto, purge, assume) | `c+=1` (printed as typed) and `c=<c+1` (printed `array_sto(c+1,c)`): both CONFIRMED raw. Home `g(1)+floor(sqrt(2))` with `g(x):={c+=1;c}` stores 3 times (c 0→3) and is refused "undecided"; `h(x):={c=<c+1;c}` the same | STATE |
| numeric.ts:1100-1101 | definitionStores | GIAC-OUT | parameters own to the program | same rule as boundIn :345 | NAMES |
| numeric.ts:1102-1103 | definitionStores | GIAC-OUT | `local` names | split(",") on `local a:=copy(1,b)` gives `b)`, so b counts as a store (conservative: runs once) | NAMES |
| numeric.ts:1104-1105 | definitionStores | GIAC-OUT | a `name:=` / `name[..]:=` to a name not own | `+=`, `-=`, `*=`, `array_sto` (see :1098); a nested index `L[M[1]]:=x` matches nowhere (inferred) | STATE |
| numeric.ts:1119 | callsStateful | GIAC-OUT | name is a stored function (`'name'`, `->`) | functions held by value (functionsIn) | STATE |
| numeric.ts:1134 | decidingStored | GIAC-OUT | same test | same | STATE |
| numeric.ts:1148 | restsOnDecision | GIAC-OUT | result holds `abs(` → decision | none found | SHAPE |
| numeric.ts:1161-1187 | comparisonCut | GIAC-IN | the one top-level comparison as `(lhs)-(rhs)` | two comparisons joined by `and`/`or` give no cut (inferred); escaped quote | BRACKET |
| numeric.ts:1195-1210 | decisionCuts | GIAC-IN | calls whose args are segments; floor/ceil/iPart/frac/fPart/round/sign cuts | a comparison inside a top-level `[...]` (`[a<b,c]`) is never a segment (inferred); a function held by value | BRACKET |
| numeric.ts:1230 | onCut | GIAC-IN | the input stores → no tie rewrite | `+=`, `=<`, `purge(` (inferred) | STATE |
| numeric.ts:1239,1244,1259 | onCut | GIAC-OUT | the quantity/distance/nearest value is rational | none found | NUMBER |
| numeric.ts:1247 | onCut | GIAC-OUT | the distance is a real float (`type` prints `real`, CONFIRMED raw) | none found | SHAPE |
| numeric.ts:1248 | onCut | GIAC-OUT | the two distances agree (`1`) | none found | OTHER |
| numeric.ts:1250 | onCut | GIAC-OUT | simplify/normal prove the distance 0 | none found | NUMBER |
| numeric.ts:1300,1303 | decideTwice | GIAC-OUT | P, P+20 and P+40 printed the same text | an exact text Giac orders differently at another Digits would read as a disagreement (inferred) | SHAPE |

### homeEval.ts
| file:line | function | reads | what it decides | what it misses | kind |
|---|---|---|---|---|---|
| homeEval.ts:127-129 | unquote | GIAC-OUT (latex() string) | strips the outer quotes | Giac prints an embedded quote doubled: raw `latex("a\"b")` → `"\mathrm{a""b}"` (CONFIRMED); `""` stays inside | OTHER |
| homeEval.ts:202 | decideFloatTest | GIAC-IN (our emit) | exactly one float test in the input | a test inside a stored function the input calls is not counted (inferred) | STATE |
| homeEval.ts:211-214 | decideFloatTest | GIAC-OUT | verdict `0`/`1`/`2` | none found | OTHER |
| homeEval.ts:222 | testSides | GIAC-IN (our emit) | the test sides after `(a_-b_))(` | none found (:202 refuses more than one test) | OTHER |
| homeEval.ts:237 | definitionsUsedBy | GIAC-IN | which of our definitions the input mentions | a name inside a string (`"par"`) loads it (harmless) | NAMES |
| homeEval.ts:270,274-311 | DECIMAL / rewriteDecimals (toExactLiterals, floatsAsEvalf) | GIAC-IN (+OUT via floatsAsEvalf) | decimal literals → exact rationals | Giac's range `a..b`: `1..3` becomes `1(3/10^1)` (`1.` read as 1, then `.3` as 3/10). CONFIRMED: Home `sum(k,k=1..3)` takes path float-error and shows 6 as ≈ (should be exact =); an escaped quote in a string (inferred) | REWRITE |
| homeEval.ts:301-302 | rewriteDecimals | NUM (a DECIMAL match) | integer vs decimal; the exponent | none found | NUMBER |
| homeEval.ts:322-334 | restoreLiterals | GIAC-OUT | put the typed decimals back into an open test | Giac reprints `(5/10^1)` reduced (`1/2`), so that literal stays a fraction (inferred) | REWRITE |
| homeEval.ts:348 | floatsAsEvalf | GIAC-OUT | significant digits of a printed float | a float inside a string literal is turned into `evalf(…)` text inside the string (inferred) | NUMBER |
| homeEval.ts:354-355 | exactRational | NUM | mantissa → p/10^k | none found | NUMBER |
| homeEval.ts:364-366 | isError | GIAC-OUT | the wrapper's error prefix | none found (duplicate of numeric.ts:492) | OTHER |
| homeEval.ts:369 | isTimeout | GIAC-OUT | an error is a timeout (`interrupt`) | a user `throw("interrupt …")` text (inferred; only the path label differs) | OTHER |
| homeEval.ts:373,378 | STATEFUL / isStateful | GIAC-IN | the input changes state (run once, replay) | `c+=…`, `c=<…`. CONFIRMED: Home `c+=floor(sqrt(2))` stores 3 times (c 3→6) and is refused "undecided" | STATE |
| homeEval.ts:375 | HELPER_STO | GIAC-IN (our emit) | strips our test helper's stores | none found for emit.ts:116's form (`sto(1,pasinexact)`, `sto(d_,pasdiff)`) | STATE |
| homeEval.ts:383 | simpleAssignment | GIAC-IN | `name:=value` (value may run twice) | a store inside the value; homeEval.ts:582 never checks isStateful(asg.rhs). CONFIRMED: Home `a:=(c:=c+1)+floor(sqrt(2))` stores c 3 times (0→3) and is refused | STATE |
| homeEval.ts:391 | definedBy | GIAC-IN | `f(x):=` defines a function | none found | STATE |
| homeEval.ts:408 | storeTargets | GIAC-IN | `[a,b]:=v` | none found | STATE |
| homeEval.ts:410 | storeTargets | GIAC-IN | `a,b:=v` | none found | STATE |
| homeEval.ts:412 | storeTargets | GIAC-IN | `v=>a` | `=>` inside a string (inferred) | STATE |
| homeEval.ts:414-415 | storeTargets | GIAC-IN | `sto(v,a)` (with closingParen) | none found | STATE |
| homeEval.ts:416 | storeTargets | GIAC-IN | `L[k]:=v` | a nested index `L[M[1]]:=5` gives null (inferred) | STATE |
| homeEval.ts:428 | onceUndecided | GIAC-IN | purge/assume/additionally store no value | none found (a third copy of the STATEFUL verbs) | STATE |
| homeEval.ts:438-439 | arrowFunction | GIAC-IN (+ Giac's reprint `name:=((x)->…)`) | `f:=x->…` defines a function | `f:=unapply(x^2,x)` (inferred) | STATE |
| homeEval.ts:443-455 | closingParen | GIAC-IN | the `)` closing `(` | escaped quote (same as closing) | BRACKET |
| homeEval.ts:469 | regrouped | GIAC-OUT | an open `==` test is not regrouped | none found (`!=` prints `<>`, CONFIRMED raw, and regroup leaves it) | SHAPE |
| homeEval.ts:471 | regrouped | GIAC-OUT | regroup merged factors (fewer `*`), or `undef` | a `*` inside a string (inferred) | SHAPE |
| homeEval.ts:584 | homeEval | GIAC-IN | a float test is present (purge the flag) | the test inside a stored function the input calls (inferred) | STATE |
| homeEval.ts:593 | homeEval | GIAC-OUT | the flag was set (`1`) | none found | STATE |
| homeEval.ts:691 | symbolic | GIAC-OUT | text holds `*` → try regroup | none found | SHAPE |
| homeEval.ts:693 | symbolic | GIAC-OUT | an open test (`==`, `<>`) → restore typed decimals | `==` in a string (inferred) | SHAPE |
| homeEval.ts:711 | homeEval | GIAC-OUT | the answer is ±infinity or undef (icdf polish) | none found | SHAPE |
| homeEval.ts:725 | homeEval | GIAC-OUT | a list holding a test is not a number | `==` in a string (inferred) | SHAPE |

### Duplicates found in A
- **Bracket matcher (closing bracket)**: numeric.ts:156 `closing` (all three kinds, strings skipped), homeEval.ts:443 `closingParen` (parens only, strings skipped), numeric.ts:1161-1187 `comparisonCut` (its own depth loop), and outside scope degrees.ts:23 another private `closing`.
- **Top-level comma split**: numeric.ts:174 `topLevelArgs` (strings skipped, `{}` counted), numeric.ts:381 `splitList` (no strings, no `{}`), numeric.ts:405 `hasTopLevelComma` (no strings, no `{}`). They split the same way but differ in what they skip.
- **String skip `"[^"]*"`**: regexes at numeric.ts:85, :194, :245, :254, :336, :1021, :1195; hand loops at numeric.ts:160, :180, :1167, homeEval.ts:279, :447. None of them handles `\"`; splitList and hasTopLevelComma skip no strings at all.
- **Identifier regex**: `[A-Za-z_][A-Za-z0-9_]*` at numeric.ts:245, :254, :345, :350, :1047, :1100, :1104, :1195. homeEval uses `[A-Za-z][A-Za-z0-9_]*` (no leading `_`) at :383, :391, :397, :412, :414, :416; :286-287 use `[A-Za-z_]`/`[A-Za-z_0-9]+`; :439 uses the numeric form. So `_a` is a name in numeric.ts but not an assignment target in homeEval.ts.
- **Store/stateful verbs**: homeEval.ts:373 STATEFUL (`:=`, `=>`, purge, assume, additionally, sto), numeric.ts:1230 onCut (`:=`, `=>`, sto), numeric.ts:1098+1104 definitionStores (`=>`, sto, purge, assume, additionally, `name:=`), homeEval.ts:428 onceUndecided (purge, assume, additionally). There are four lists with different members, and all four miss `+=` and `array_sto`/`=<`.
- **Printed-program head and locals**: numeric.ts:345-350 boundIn (locals via topLevelArgs) and numeric.ts:1100-1103 definitionStores (locals via split(",")) apply the same rule with different robustness; homeEval.ts:439 arrowFunction has the same head regex as :345, used on the input.
- **"Is it a builtin / stored function" from the print**: numeric.ts:1084 namePrint, :1091 notBuiltin, :1119 callsStateful (`'name'` and `->`), :1134 decidingStored (same).
- **Float/decimal literal regexes**: numeric.ts:106 FLOAT_LITERAL (lower-case `e` only, output), homeEval.ts:270 DECIMAL (`[eE]`, input), numeric.ts:254 namesIn's number alternative (`[eE]`), numeric.ts:121 and :484 (literal parse). Five regexes for one token.
- **evalf/approx call recognition**: numeric.ts:194 PRECISION_CALL and numeric.ts:232 askedDigits.
- **Open-test detection**: homeEval.ts:469 (`==` only), :693 and :725 (`==|<>`).
- **`undef` checks**: numeric.ts:148, homeEval.ts:471, :711.
- **isError**: numeric.ts:492 and homeEval.ts:364 (also converge.ts:48, degrees.ts:19, constUnc.ts:79, solve1.ts:103 inline).
- **Rational print**: numeric.ts:458 RATIONAL, used again at :1239/:1244/:1259 (converge.ts:287 has its own number regex).
- **Our engine names by substring**: numeric.ts:99 (`safe.includes(name)`) and homeEval.ts:237 (`\bname\b`) both decide which definitions to load.

## B. The other engine files, calc/ and goldenRun.ts (168 sites)

### Probe runs the rows cite (B-P1 to B-P16)
| # | input | result |
|---|---|---|
| B-P1 | CAS `seq(k^2,k=1..3)` | `(k^2)$(k=(3/10^1))` (ok, silently wrong); `sum(k,k=1..3)`, `int(x,x=0..1)`: GIAC_ERROR `k=(3/10^1)`, `x=0` |
| B-P2 | CAS `f(n):=sum(k^2,k=1..n)` then `f(3)` | stored as ` (n)->sum(k^2,k=n)`; `f(3)` error |
| B-P3 | Home `a:=1`, `a+=1`; `b:=2`, `b=<7` | values change to 2 and 7; `defs` = `[]` for both (not logged) |
| B-P4 | CAS `assume(0<y)` | defs `other::assume(0<y)` (no name) |
| B-P5 | CAS `L[M[1]]:=7` | defs `other::L[M[1]]:=7` (kept as typed, not as value) |
| B-P6 | `solveRequest` one eq `subst(t^2,t=x)-2`, guess 1 | `no sign change, Newton did not converge` (x^2-2 gives 1.41421356237); raw `left(int(t,t=0..x)-1)` = `x^2/2`, `right(..)` = `-1` |
| B-P7 | raw `lname(quote(x_m*2+a_b_c+e+i+pi+x1))` | `[x_m,a_b_c,x1]` |
| B-P8 | raw `h(x):={approx_mode(1);x}`, `h(1)`, `1/3` | `1/3` then prints `0.333333333333` (state leaked) |
| B-P9 | `parseLibrary` bodies | `{ [a,b]:=[1,2]; x }` accepted; `{ approx_mode(1); x }` accepted; `s:="a\"b:=1"` refused "assigns b" |
| B-P10 | raw `s:="a\"b:=1"`, `size(s)` | Giac prints `"a""b:=1"`, size 6: `\"` is a valid escape |
| B-P11 | Home `B:=evalf(sqrt(2),5)` then `int(B^2,B,0,1)` vs `int(x^2,x,0,1)` | exactRational false / approximate true vs exactRational true |
| B-P12 | CAS `lim(sin(x),x,inf)` vs `limit(sin(x),x,inf)` | `undecided` vs `noLimit` |
| B-P13 | raw `7 mod 3` | `1 % 3` (a modular number, not 1) |
| B-P14 | raw `f:=x->x+1`, `g(x):=x^2` | print ` (x)->x+1`, ` (x)->x^2` (leading space, always `(x)->`) |
| B-P15 | raw `type(sin)`, `type(median)`, `type(pasx)`, `type(e)` | `func`, `func`, `identifier`, `expression` |
| B-P16 | raw `fsolve(cos(x)-x,x=0..1,brent_solver)`, `1==1`, `type(3/4)` | `[0.739085133215]`, `true`, `rational` |

### Sites
| # | file:line | function | reads | what it decides | what it misses | kind |
|---|---|---|---|---|---|---|
| 1 | engine/host.ts:95 | isError | GIAC-OUT | output is an error (`startsWith("GIAC_ERROR")`) | none found | SHAPE |
| 2 | engine/host.ts:99 | isTimeout | GIAC-OUT | error is Giac's interrupt (`/interrupt/i`) | none found | SHAPE |
| 3 | engine/host.ts:126 | IDENT_NAME (used :408, :479) | GIAC-IN | a plain identifier | a unicode name; a name starting `_` (inferred; Giac allows both) | NAMES |
| 4 | engine/host.ts:147 | arrowBodyEnd | GIAC-IN | where an arrow body ends (top-level `,`, unmatched closer) | an escaped quote `"a\"b"` ends the string early (B-P10, inferred effect); a top-level `;` is not an end (unreachable in CAS, which wraps `pcasans:=(…)`; reachable in log/library cmds, inferred) | BRACKET |
| 5 | engine/host.ts:152 | arrowBodyEnd | GIAC-IN | skips a string via `indexOf('"')` | `\"` escape (B-P10) | BRACKET |
| 6 | engine/host.ts:168 | maskBound.mask | GIAC-IN | replaces bound names by `_` | `\"` escape; no number skip, so `2e5` yields name `e5` (inferred) | REWRITE |
| 7 | engine/host.ts:171 | maskBound | GIAC-IN | `f(params):=body` head | params with parentheses (`f(x,y:=1)`, typed `f(x::real)`) do not match `[^()]*` (inferred) | NAMES |
| 8 | engine/host.ts:172 | maskBound | GIAC-IN | parameter list split on `,` | none found | NAMES |
| 9 | engine/host.ts:175 | maskBound | GIAC-IN | arrow heads `(x,y)->` / `x->` | none found for Giac's `(x)->` (B-P14) | NAMES |
| 10 | engine/host.ts:180 | maskBound | GIAC-IN | arrow params split on `,` | none found | NAMES |
| 11 | engine/host.ts:182 | maskBound | GIAC-IN | resumes after the first `->` of the masked text | none found | BRACKET |
| 12 | engine/host.ts:186 | maskBound (QUOTING) | GIAC-IN | finds `diff(`/`sum(`/`int(`… to mask their bound variable | not string-aware (`"sum("` inside a string, inferred); `x=a..b` forms have 2–3 args < min so the bound var is listed (noise; and P1 shows those inputs break anyway) | NAMES |
| 13 | engine/host.ts:201 | matching | GIAC-IN | closing bracket of a QUOTING call | ignores `{}` and strings: `seq({k,1},k,1,3)` (inferred) | BRACKET |
| 14 | engine/host.ts:211 | splitTop | GIAC-IN | top-level argument split | ignores `{}` and strings: `seq({k,1},k,1,3)` splits into 5 args, var read from `1}` (inferred) | BRACKET |
| 15 | engine/host.ts:230 | indexedTarget | GIAC-IN | `L[i]:=` target name | nested index `L[M[1]]:=7`: `[^\]]*` stops at the inner `]` → entry `other`, replayed as typed, value depends on M at replay (B-P5 CONFIRMED) | STATE |
| 16 | engine/host.ts:298 | strict.eval | GIAC-OUT | `out === "undef"` triggers the message check | none found | SHAPE |
| 17 | engine/host.ts:300 | strict.eval | GIAC-OUT (messages) | `/syntax error/` → GiacSyntaxError | none found | SHAPE |
| 18 | engine/host.ts:322 | restore.flush | GIAC-OUT (messages + out) | a batch failed (`/error\|reserved word\|not allowed/i`, `/^GIAC_ERROR/`) → rerun one by one | a warning that contains "error" reruns needlessly (harmless, inferred) | STATE |
| 19 | engine/host.ts:399 | defsAfter | GIAC-IN | `purge(a,b)` input | `purge([a,b])` or nested parens → falls to `other` (inferred) | STATE |
| 20 | engine/host.ts:401 | defsAfter | GIAC-IN | purge names split on `,` | none found | NAMES |
| 21 | engine/host.ts:402 | defsAfter | GIAC-IN | `assume(name…` / `additionally(name…` names the entry | `assume(0<y)` (name not first) → kind `other`, so `additionally` cannot chain onto it (B-P4 CONFIRMED); `assume(x>0 and y>0)` files the whole command under x only (inferred) | STATE |
| 22 | engine/host.ts:408 | defsAfter | GIAC-IN | every purge name is an identifier | none found | NAMES |
| 23 | engine/host.ts:439 | snapshot | GIAC-OUT | name holds nothing (`t === name`, `""`, error) | none found | STATE |
| 24 | engine/host.ts:479 | inherited | GIAC-IN | expr is a bare name (skip perturbation) | `(B)` or `+B` run the perturbation needlessly (harmless) | SHAPE |
| 25 | engine/host.ts:552 | readFacts | GIAC-IN | `^(purge\|assume\|additionally)(` stores no value | none found | STATE |
| 26 | engine/host.ts:704 | casRun | GIAC-IN | input holds our equality-test flag (`includes`) | none found | OTHER |
| 27 | engine/host.ts:729 | casRun | GIAC-OUT | flag `=== "1"`: the test had a float side | none found | STATE |
| 28 | engine/host.ts:801 | casRun | GIAC-OUT | text holds `*` → regroup | `*` in a string → extra regroup call (harmless) | SHAPE |
| 29 | engine/host.ts:809 | casRun | GIAC-OUT | flag `=== "1"` again | none found | STATE |
| 30 | engine/host.ts:916 | balanced | GIAC-IN (log cmds) | brackets and quotes pair (batch-safe) | `\"` toggles the quote state: `"a\"b"` reads as unbalanced (safe side: runs alone) (B-P10) | BRACKET |
| 31 | engine/host.ts:932 | isMemoryFailure | OTHER (JS error text) | OOM / abort → restart | none found | OTHER |
| 32 | engine/library.ts:18 | HEADER | OTHER (library file) | stamp line and version | none found (BOM stripped at :149) | OTHER |
| 33 | engine/library.ts:19 | NAME (used :200) | GIAC-IN | definition name is ASCII ident | none found | NAMES |
| 34 | engine/library.ts:23 | STATE_WORDS (used :173, :193) | GIAC-IN | body/test changes engine state | `approx_mode(1)` accepted and leaks engine-wide (B-P8, P9 CONFIRMED); also `xcas_mode`, `epsilon`, `autosimplify`, `srand`, `timeout`, `ckevery` (inferred); not string-aware at :193 (`print("read")` refused, inferred) | STATE |
| 35 | engine/library.ts:56 | topLevelSemicolon | GIAC-IN | a second statement after `;` | `\"` escape flips the string state (B-P10, inferred effect); `//` comment text not skipped (inferred) | BRACKET |
| 36 | engine/library.ts:70 | NOSTR | GIAC-IN | strips strings before store checks | `"a\"b:=1"` leaves `b:=1"` → false refusal "assigns b" (B-P9 CONFIRMED) | REWRITE |
| 37 | engine/library.ts:75 | storedNames | GIAC-IN | every identifier, as a store candidate | none found (lookbehind keeps `.name`) | NAMES |
| 38 | engine/library.ts:79 | storedNames | GIAC-IN | `for k from/in`, `pour k de` loop variable | `for k in` with `(` (`for (k in L)`, inferred) | NAMES |
| 39 | engine/library.ts:84 | storedNames | GIAC-IN | `g(y):=` inside a body (paren scan) | none found (input is NOSTR'd) | BRACKET |
| 40 | engine/library.ts:96 | storedNames | GIAC-IN | skips `[index]` chains before `:=` | none found (nesting counted) | BRACKET |
| 41 | engine/library.ts:109 | storedNames | GIAC-IN | `:=`, `=<`, `+=`…, `++`, `--` after the name | list stores: `[a,b]:=[1,2]` accepted as local-only (B-P9 CONFIRMED); `a,b:=1,2` only finds `b` | STATE |
| 42 | engine/library.ts:116 | assigns | GIAC-IN (test line) | test assigns something | `2--1` (minus negative) refused as `--` (inferred) | STATE |
| 43 | engine/library.ts:119 | balanced | GIAC-IN | block still open (continuation) | returns `d <= 0`, so a stray `)` counts as balanced; `\"` escape; a `(` in a trailing `//` comment keeps the block open and swallows the next definition (inferred) | BRACKET |
| 44 | engine/library.ts:128 | globalAssigned | GIAC-IN | `f(params):=` head | params with parentheses (inferred) | NAMES |
| 45 | engine/library.ts:129 | globalAssigned | GIAC-IN | `f:=x->` / `f:=(x,y)->` head | `f:=((x)->…)` (Giac's printed form, P14, with outer parens) is not matched, so its body is not checked (inferred) | NAMES |
| 46 | engine/library.ts:133 | globalAssigned | GIAC-IN | params split | none found | NAMES |
| 47 | engine/library.ts:134 | globalAssigned | GIAC-IN | `local a,b;` names | `local` without `;` before `}` (inferred) | NAMES |
| 48 | engine/library.ts:149 | parseLibrary | OTHER (file) | BOM, CRLF, line split | none found | OTHER |
| 49 | engine/library.ts:167 | parseLibrary | OTHER (file) | comment line (`startsWith("//")`) | none found | OTHER |
| 50 | engine/library.ts:168 | parseLibrary | OTHER (file) | `// test:` line | none found | OTHER |
| 51 | engine/library.ts:178 | parseLibrary | OTHER (file) | strips `//` for the description | none found | OTHER |
| 52 | engine/library.ts:181 | parseLibrary | OTHER (file) | indented line outside a block | none found | OTHER |
| 53 | engine/library.ts:185 | parseLibrary | GIAC-IN | next line continues the block | none found | BRACKET |
| 54 | engine/library.ts:192 | parseLibrary | GIAC-IN | body = text after the first `:=` | none found | REWRITE |
| 55 | engine/library.ts:201 | parseLibrary | GIAC-IN | name is one of ours (`pasc_` prefix, `_` suffix, tables) | `pasans`, `pcasans`, `pasx`, `pasz0`, `pasr_1` pass (type is `identifier`, P15) and are overwritten/purged by Solve, analysis (`keepingAns` purges `pasans`), CAS (inferred) | NAMES |
| 56 | engine/library.ts:203 | parseLibrary | GIAC-IN | body names `pasdeg` | none found | NAMES |
| 57 | engine/library.ts:282 | importLibrary | GIAC-OUT | `type(name) === "func"` → built-in | none found (`func` for sin, median, solve: P15) | SHAPE |
| 58 | engine/library.ts:320 | importLibrary | GIAC-OUT | test passed (`"true"` or `"1"`) | none found (B-P16) | SHAPE |
| 59 | engine/library.ts:340 | inRadians | GIAC-OUT | previous pasdeg unset (`=== PASDEG`, `""`, `/GIAC_ERROR/`) | none found | STATE |
| 60 | engine/library.ts:347 | sameDefinition | GIAC-IN | same commands (string equality) | spacing differences count as different (inferred, harmless: "replaced") | STATE |
| 61 | engine/library.ts:352 | sameDefinition | GIAC-OUT | value equals the log's `name:=(value)` | Giac's leading space in printed functions (B-P14) — only for vars, so none found | STATE |
| 62 | engine/library.ts:357 | describe | GIAC-IN | `f(args)` head as a description | none found | OTHER |
| 63 | engine/library.ts:358 | describe | OTHER | whitespace collapse | none found | OTHER |
| 64 | engine/converge.ts:36 | callsIn | GIAC-IN | every `int/integrate/sum/limit(` call | `lim(` alias (B-P12: wrong message `undecided`); `x=a..b` forms have 2–3 args and are never checked (moot today: P1) | NAMES |
| 65 | engine/converge.ts:40 | callsIn | GIAC-IN | call's closing bracket (numeric.closing) | none found | BRACKET |
| 66 | engine/converge.ts:43 | callsIn | GIAC-IN | call arguments (numeric.topLevelArgs) | none found | BRACKET |
| 67 | engine/converge.ts:48 | isError | GIAC-OUT | error output | none found | SHAPE |
| 68 | engine/converge.ts:50 | notFinite | GIAC-OUT | undef or an infinity in it | none found | SHAPE |
| 69 | engine/converge.ts:52 | finiteValue | GIAC-OUT | no unevaluated `int/sum/limit(` left | not string-aware (harmless) | SHAPE |
| 70 | engine/converge.ts:58 | onlyNames | GIAC-OUT | `lname` list via splitList | none found | SHAPE |
| 71 | engine/converge.ts:65 | realOf | GIAC-OUT | `+infinity`/`inf`/`-infinity` | none found | NUMBER |
| 72 | engine/converge.ts:67 | realOf | GIAC-OUT | a plain real | Giac's MPFR negative zero `0.-000…` (handled only by solve1 negZero, inferred) | NUMBER |
| 73 | engine/converge.ts:74 | valueOf | GIAC-IN | the call is the whole input | none found | OTHER |
| 74 | engine/converge.ts:83 | seriesCheck | GIAC-OUT | limit is `"0"` | `0.0` (a float zero limit) is not 0 → goes to limitNonZero, which then says 0 (harmless) | SHAPE |
| 75 | engine/converge.ts:93 | limitNonZero | GIAC-OUT | bounded_function / undef / ±infinity | none found | SHAPE |
| 76 | engine/converge.ts:95 | limitNonZero | GIAC-OUT | a non-zero real | none found | NUMBER |
| 77 | engine/converge.ts:114 | periodOf | GIAC-OUT | difference is negative (`/^-/`) | none found | NUMBER |
| 78 | engine/converge.ts:127 | periodicCalls | GIAC-IN | every trig call | none found | NAMES |
| 79 | engine/converge.ts:130 | periodicCalls | GIAC-IN | trig call's closing bracket | none found | BRACKET |
| 80 | engine/converge.ts:139 | singularAt | GIAC-OUT | undef / infinity / error | none found | SHAPE |
| 81 | engine/converge.ts:148 | integralCheck | GIAC-OUT | `singular()` list via splitList | none found | SHAPE |
| 82 | engine/converge.ts:239 | refusalOf | GIAC-OUT | a step was interrupted | none found | SHAPE |
| 83 | engine/converge.ts:249 | check | GIAC-OUT | output `undef` | none found | SHAPE |
| 84 | engine/converge.ts:253 | check | GIAC-OUT | `bounded_function(` left | none found | SHAPE |
| 85 | engine/converge.ts:259 | check | GIAC-IN | bound variable is an identifier | none found | NAMES |
| 86 | engine/converge.ts:262 | check | GIAC-IN | a sum bound is infinite (`/\binf\b\|infinity/`) | none found | SHAPE |
| 87 | engine/converge.ts:264 | check | GIAC-OUT | call value `undef` | none found | SHAPE |
| 88 | engine/converge.ts:287 | giacPair | GIAC-OUT | `[exact, float]` pair shape | none found | SHAPE |
| 89 | engine/converge.ts:293 | hasDefiniteIntegral | GIAC-IN | input does not start with `[` | an input not starting with `[` whose value is a list `[exact, float]` holding a definite integral (e.g. `append([int(x,x,0,1)],0.5)`) is read as Giac's pair (inferred) | SHAPE |
| 90 | engine/format.ts:92 | decimalFromString | GIAC-OUT (also NUM from solve1.pt) | a printed float → DecimalValue | none found (rejects `E`, `inf`, `0.-0` → null) | NUMBER |
| 91 | engine/solve.ts:31 | withUnassigned | GIAC-IN | a name is IDENT | `a_b_c` throws "bad variable name" (types.ts IDENT) | NAMES |
| 92 | engine/solve.ts:32 | withUnassigned | GIAC-OUT | name unassigned (`=== name`) | none found | STATE |
| 93 | engine/solve.ts:53 | unknownsOf | GIAC-OUT | lname error | none found | SHAPE |
| 94 | engine/solve.ts:54 | unknownsOf | GIAC-OUT | lname list split (strip `[ ]`, `,`) | none found for names | SHAPE |
| 95 | engine/solve.ts:56 | unknownsOf | GIAC-OUT | keeps IDENT names except pasdeg | `a_b_c` is listed by Giac but dropped (B-P7 CONFIRMED) | NAMES |
| 96 | engine/solve.ts:109 | HAS_EQ / difference (:114) | GIAC-IN | the text is an equation | `=` inside a call: `subst(t^2,t=x)-2` is solved as `left−right` = x^2+2 → no root (B-P6 CONFIRMED); `=` in a string (inferred) | SHAPE |
| 97 | engine/solve.ts:127 | solveRequest | GIAC-IN | unknown/known names are IDENT | `a_b_c` refused (types.ts IDENT) | NAMES |
| 98 | engine/solve.ts:146 | one | OTHER (our message) | error kind from `info`/`display` text (`"bad equation"`, `startsWith("guess")`) | none found (our own strings) | OTHER |
| 99 | engine/solve.ts:164 | realList | GIAC-OUT | `[r1,r2,…]` of reals | nested lists `[[..],[..]]` → null (inferred; Giac returns one vector here) | SHAPE |
| 100 | engine/solve.ts:177 | system | GIAC-OUT | `startsWith("GIAC_ERROR")` | none found | SHAPE |
| 101 | engine/solve.ts:181 | system | GIAC-OUT | `startsWith("GIAC_ERROR")` | none found | SHAPE |
| 102 | engine/solve.ts:264 | polyRoots | GIAC-OUT | `startsWith("GIAC_ERROR")` | none found | SHAPE |
| 103 | engine/solve.ts:266 | polyRoots | GIAC-OUT | `=== "true"`, coeff list `startsWith("[")`, lname `=== "[]"` | none found | SHAPE |
| 104 | engine/solve.ts:281 | polyRoots | GIAC-OUT | `pasdz==0` `=== "true"`, error | none found (B-P16) | SHAPE |
| 105 | engine/solve.ts:287 | polyRoots | GIAC-OUT | imaginary part negligible `=== "true"` | none found | SHAPE |
| 106 | engine/solve.ts:300 | polyRoots | GIAC-OUT | as :281 | none found | SHAPE |
| 107 | engine/solve1.ts:63 | num | GIAC-OUT | a plain real number | none found | NUMBER |
| 108 | engine/solve1.ts:70 | negZero | GIAC-OUT | rewrites `0.-000` | none found | REWRITE |
| 109 | engine/solve1.ts:97 | solve1 | GIAC-IN | the text is an equation (same regex as solve.ts:109) | `=` inside a call or string (B-P6 CONFIRMED via solve.ts path) | SHAPE |
| 110 | engine/solve1.ts:103 | solve1 | GIAC-OUT | `startsWith("GIAC_ERROR")` | none found | SHAPE |
| 111 | engine/solve1.ts:123 | polish | GIAC-OUT | `pasv[0]==0` `=== "true"` | none found | SHAPE |
| 112 | engine/solve1.ts:147 | polishAgain | GIAC-OUT | `type(pasx)` integer/rational | none found (B-P16) | SHAPE |
| 113 | engine/solve1.ts:217 | accept | GIAC-OUT | f exactly 0 `=== "true"` | none found | SHAPE |
| 114 | engine/solve1.ts:222 | accept | GIAC-OUT | isolated zero `=== "true"` | none found | SHAPE |
| 115 | engine/solve1.ts:246 | snap | GIAC-OUT | exact root `!== "true"` | none found | SHAPE |
| 116 | engine/solve1.ts:313 | solve1 | GIAC-OUT | first element of fsolve's `[x]` | none found (B-P16: `[0.739085133215]`) | NUMBER |
| 117 | engine/icdf.ts:148 | ICDF_CALL (icdfCalls :153) | GIAC-IN | calls of the polished Giac names | a name passed without a call (`map(L,normald_icdf)`, `apply`) is not polished (inferred) | NAMES |
| 118 | engine/icdf.ts:161 | icdfPolished | GIAC-OUT | definition loaded (`trim() === name`) | none found | STATE |
| 119 | engine/icdf.ts:163 | icdfPolished | GIAC-IN | renames the calls to ours | as #117 | REWRITE |
| 120 | engine/types.ts:27 | IDENT (used solve.ts:31,:56,:127, analysis.ts:56) | GIAC-IN / GIAC-OUT | a variable name: letters/digits, one `_part` | two underscores (`a_b_c`, P7) or a trailing `_` | NAMES |
| 121 | engine/icdf.ts:168 | ERF_CALL (used :197) | GIAC-OUT | erf/erfc calls | uncalled `erf` (inferred) | NAMES |
| 122 | engine/icdf.ts:171 | closingAt | GIAC-OUT | `)` closing `1-erf(` | parens only, no strings (fine for Giac output) | BRACKET |
| 123 | engine/icdf.ts:187 | erfValueText | GIAC-OUT | text calls erf/erfc | none found | NAMES |
| 124 | engine/icdf.ts:189 | erfValueText | GIAC-OUT | finds `1-erf(` | none found | REWRITE |
| 125 | engine/icdf.ts:194 | erfValueText | GIAC-OUT | nothing binds tighter around `1-erf(u)` | none found | SHAPE |
| 126 | engine/icdf.ts:197 | erfValueText | GIAC-OUT | renames erf/erfc to ours | as #121 | REWRITE |
| 127 | engine/icdf.ts:199 | erfValueText | GIAC-OUT | definitions loaded | none found | STATE |
| 128 | engine/icdf.ts:213 | icdfAtEnd | GIAC-OUT | flag `"0"` and value `±infinity` | none found | SHAPE |
| 129 | engine/ourNames.ts:22 | renameCalls | GIAC-IN (library) | skips strings | `\"` escape ends the string early, so a `mod(` in the string tail is renamed (B-P10, inferred effect) | BRACKET |
| 130 | engine/ourNames.ts:29 | renameCalls | GIAC-IN (library) | renames `mod(`/`irem(`/`median(`/`percentile(` | infix `7 mod 3` stays Giac's modular `1 % 3` (B-P13 CONFIRMED); a name passed uncalled (`map(L,median)`) | REWRITE |
| 131 | engine/ourNames.ts:41 | renameCalls | GIAC-IN (library) | number literal lexer; inserts `*` before a renamed call | none found | REWRITE |
| 132 | engine/degrees.ts:15 | CALL (walk :55) | GIAC-OUT | trig/inverse calls to rewrite for DEG | uncalled names (`[sin,cos]`, inferred); not string-aware (guarded by :40) | NAMES |
| 133 | engine/degrees.ts:16 | ANY (needsDegrees :40) | GIAC-OUT | text needs the DEG rule | a text with both a `pasdeg` body and a plain trig term is left in radians (`hasAngleFactor` skips it all, inferred) | NAMES |
| 134 | engine/degrees.ts:18 | isError | GIAC-OUT | error | none found | SHAPE |
| 135 | engine/degrees.ts:23 | closing | GIAC-OUT | closing bracket of a trig call | none found | BRACKET |
| 136 | engine/degrees.ts:40 | needsDegrees | GIAC-OUT | no `"` in text | none found | SHAPE |
| 137 | engine/degrees.ts:62 | backInDegrees.walk | GIAC-OUT | trig vs inverse (`TRIG.includes`) | none found | OTHER |
| 138 | engine/degrees.ts:78 | backInDegrees | GIAC-OUT | `undef` | none found | SHAPE |
| 139 | engine/degrees.ts:79 | backInDegrees | GIAC-OUT | removes the inert prefix | none found | REWRITE |
| 140 | engine/degrees.ts:80 | backInDegrees | GIAC-OUT | inert name survived | none found | SHAPE |
| 141 | engine/angleMigration.ts:18 | PASEXP (withoutPasexp :22) | GIAC-IN (stored log) | `pasexp(` → `exp(` | `\"` escape (inferred) | REWRITE |
| 142 | engine/angleMigration.ts:26 | VALUE (used :49, :86) | GIAC-IN (stored log) | `name:=(rhs)` form | none found | SHAPE |
| 143 | engine/angleMigration.ts:30 | degreeReading | GIAC-IN | freezes `pasdeg` → `(pi/180)` | none found | REWRITE |
| 144 | engine/angleMigration.ts:36 | readsAngles | GIAC-IN | text holds an angle function (`rewriteAngles(text) !== text`) | none found | STATE |
| 145 | engine/angleMigration.ts:75 | matches | NUM (stored preview) | `E` → `e` in the preview | a preview cut at PREVIEW_MAX=200 mid-number, or a list preview (`abs(list)` is a list, never `/^-/`) never matches (inferred) | REWRITE |
| 146 | engine/angleMigration.ts:77 | matches | GIAC-OUT | difference below tolerance (`/^-/`, `0`, `0.0`) | none found (`0.0` printed, probe) | NUMBER |
| 147 | engine/analysis.ts:15 | keepingAns | GIAC-OUT | `pasans` holds something | none found | STATE |
| 148 | engine/analysis.ts:56 | analyze | GIAC-IN | variable is IDENT | `a_b_c` refused | NAMES |
| 149 | engine/analysis.ts:79 | notFound | OTHER (our message) | error kind from solve1 text | none found | OTHER |
| 150 | engine/analysis.ts:161 | run (area) | GIAC-OUT | romberg returned a list (`/^\[/`) or a number | none found | SHAPE |
| 151 | engine/analysis.ts:169 | run (area) | GIAC-OUT | romberg did not converge (`/^\[/`) | none found | SHAPE |
| 152 | engine/analysis.ts:173 | run (area) | GIAC-OUT | exact integral is plain (`GIAC_ERROR`, `/integrate\|int\(\|undef\|infinity/`) | `int\(` also hits `print(`, `pasint(` (inferred; num() decides anyway) | SHAPE |
| 153 | engine/constUnc.ts:23 | CONST_NAME (used :37, :46) | GIAC-IN | constants by name `pasc_<id>` | not string-aware (inferred, harmless) | NAMES |
| 154 | engine/constUnc.ts:27 | isZeroText | NUM (constant table) | uncertainty text is zero | none found | NUMBER |
| 155 | engine/constUnc.ts:37 | withConstValues | GIAC-IN | puts constant values in | none found | REWRITE |
| 156 | engine/constUnc.ts:46 | inexactConstsIn | GIAC-IN | inexact constants named | none found | NAMES |
| 157 | engine/constUnc.ts:79 | constUncDigits | GIAC-OUT | error | none found | SHAPE |
| 158 | engine/constUnc.ts:80 | constUncDigits | GIAC-OUT | σ as DecimalValue (format.ts) | none found | NUMBER |
| 159 | engine/chipFacts.ts:28 | CHIP_NAME (used :37, :47) | GIAC-IN | chips by name `pasr_<k>` | not string-aware (inferred, harmless) | NAMES |
| 160 | engine/chipFacts.ts:37 | chipsIn | GIAC-IN | chips held | none found | NAMES |
| 161 | engine/chipFacts.ts:47 | withChipValues | GIAC-IN | puts chip values in | none found | REWRITE |
| 162 | engine/defs.ts:115 | validDefs | OTHER (stored log) | entry name is an identifier | none found | NAMES |
| 163 | calc/engine.ts:46 | EngineCalc.home | GIAC-OUT | exact text is an integer or p/q (≤200 digits) | none found | SHAPE |
| 164 | calc/fake.ts:59 | FakeCalc.unknowns | GIAC-IN | single-letter names (fake engine) | `x1`, `x_1`, `ab` (dev only) | NAMES |
| 165 | goldenRun.ts:143 | runSteps | GIAC-OUT / NUM | Ans chip is exact (no `.`, no `dEd`) | an exact text with a `.` (none seen) | SHAPE |
| 166 | goldenRun.ts:152 | runSteps | GIAC-OUT / NUM | named chip is exact (same rule) | as #165 | SHAPE |
| 167 | goldenRun.ts:171 | RATIONAL_TEXT (used :216) | GIAC-OUT | CAS text is a rational → mark `=` | none found | SHAPE |
| 168 | goldenRun.ts:210 | runPrecisionCase | OTHER (test data) | `uses` list equality | none found | OTHER |

### Decisions made here by a helper that lives in numeric.ts or homeEval.ts
These sites hold no regex themselves; the rule is in `homeEval.ts`/`numeric.ts`/`input/angles.ts`, but the decision (and the
miss) lands here. Not counted in the main counts.

| file:line | helper (where the rule is) | what it decides here | miss |
|---|---|---|---|
| engine/host.ts:703 | toExactLiterals (homeEval.ts:270 `DECIMAL`) | CAS input decimals → rationals | `a..b` ranges: `1..3` → `1` + `(3/10^1)`: `seq(k^2,k=1..3)` silently `(k^2)$(k=(3/10^1))` (B-P1); a library `sum(k,k=1..n)` is stored as `sum(k,k=n)` (B-P2) — CONFIRMED |
| engine/host.ts:388, :648, :724 | isStateful (homeEval.ts:373 `STATEFUL`) | input changed state → defs log | `a+=1`, `b=<7` store but are not logged (B-P3 CONFIRMED; lost on restart); `++`, `--` (inferred); library.ts:116 knows all of them |
| engine/host.ts:462 | namesIn (numeric.ts:254), without maskBound | names whose facts the result inherits | a bound variable inherits: `int(B^2,B,0,1)` with B a stored float is no longer `=` (B-P11 CONFIRMED); `usesOf`/`readFacts` mask, `inherited` does not |
| engine/host.ts:457 | functionsIn (numeric.ts:245) | called functions lend facts | none found |
| engine/host.ts:404–407, :672–674 | simpleAssignment/definedBy/storeTargets (homeEval.ts:382–420) + indexedTarget | store target and kind | nested index (B-P5); list stores fine |
| engine/host.ts:237, :242, :574 | definedBy/arrowFunction (homeEval.ts:388, :434) | entry is a function | none found (handles `((x)->…)`, P14) |
| engine/host.ts:440, :776, :797 | hasFloat / shapeOf (numeric.ts:109, :419) | value holds a float; numeric shape | splitList ignores `{}` and strings (inferred) |
| engine/host.ts:441 | namesIn | value is symbolic → replay early | an arrow value lists its own parameter (`(x)->x+1` → early, harmless) |
| engine/host.ts:645 | namesIn | self-reference `B:=B*2` | none found |
| engine/host.ts:676, :553 | namesIn(maskBound(…)) | names a CAS input reads (F28, G51) | via #6/#12–#14 |
| engine/host.ts:710, :746 | callsIn, restsOnDecision (numeric.ts:1145) | value needs a guarded store | via #64 |
| engine/host.ts:768 | hasDefiniteIntegral, giacPair | `[exact, numeric]` pair | via #88, #89 |
| engine/host.ts:778 | askedDigits (numeric.ts:230) | `evalf(e,n)` digits | none found |
| engine/host.ts:812 | testSides (homeEval.ts:222, `indexOf("(a_-b_))(")`) | sides of our equality test | none found |
| engine/host.ts:398 | dropAngleFactor (input/angles.ts) | preview without pasdeg | not examined |
| engine/host.ts:282 | definitionsUsedBy (homeEval.ts:237, `\bname\b`) | which of our definitions to load | a name in a string loads it (harmless) |
| engine/converge.ts:106 | functionsIn | integrand is trig | none found |
| engine/chipFacts.ts:56 | hasFloat | chip value is a float | none found |
| engine/library.ts:188–189, :348 | definedBy / simpleAssignment | library block is a definition | `f:=((x)->…)` is a var (by design) |
| engine/library.ts:267 | rewriteAngles (input/angles.ts) | degree factor into library text | not examined |

### Duplicates found in B
1. **Bracket matcher (index of the closer)** — 7 copies, 4 different rule sets:
   numeric.ts:156 `closing` (strings, `()[]{}`); degrees.ts:23 `closing` (same rules, own copy); input/angles.ts:69 `closing`;
   homeEval.ts:443 `closingParen` (strings, `()` only); host.ts:201 `matching` (no strings, `()[]` only); icdf.ts:171 `closingAt`
   (no strings, `()` only, returns index + 1); library.ts:84–95 inline paren scan (no strings). Plus library.ts:96–106 inline `[]` scan.
2. **Top-level split on `,`** — numeric.ts:174 `topLevelArgs` (strings, `()[]{}`); host.ts:211 `splitTop` (no strings, `()[]`);
   numeric.ts:381 `splitList` (no strings, `()[]`, trims); numeric.ts:405 `hasTopLevelComma` (no strings, `()[]`);
   units/build.ts:280 `splitTop` (operators); solve.ts:54 and solve.ts:166 flat `split(",")`.
3. **Balanced / statement scans** — host.ts:916 `balanced` (quote toggle, `()[]{}`, rejects stray closer); library.ts:119
   `balanced` (strings stripped, accepts stray closer: `d <= 0`); library.ts:56 `topLevelSemicolon`; host.ts:147 `arrowBodyEnd`.
4. **Identifier regex** — `^[A-Za-z][A-Za-z0-9_]*$` four times: host.ts:126, library.ts:19, converge.ts:259 (with `\s*`
   in numeric.ts:1047), defs.ts:115; types.ts:27 `IDENT` is stricter (one `_part`), so `a_b_c` is a valid stored name (defs.ts:115,
   host.ts:126) but not a Solve/analysis variable (solve.ts:56, B-P7). Name tokens in text: `[A-Za-z_][A-Za-z0-9_]*` in
   numeric.ts:245/:254, host.ts:168/:175; `[A-Za-z][A-Za-z0-9_]*` in homeEval.ts:383/:391/:397/:412/:414/:416, library.ts:75/:128/:129.
5. **Names in text (namesIn-like)** — numeric.ts:254 `namesIn` (skips numbers and strings); host.ts:168 `mask` (skips strings, not
   numbers); library.ts:75 `storedNames` (on NOSTR text, lookbehind); calc/fake.ts:59.
6. **Calls in text (functionsIn-like `"[^"]*"|\bname\s*\(`)** — numeric.ts:245 `functionsIn`; numeric.ts:210 `PRECISION_CALL`;
   numeric.ts:1195 `opening`; converge.ts:36 `callsIn`; converge.ts:127 `periodicCalls`; icdf.ts:148 `ICDF_CALL`; icdf.ts:168
   `ERF_CALL`; angleMigration.ts:18 `PASEXP`; not string-aware: host.ts:186 QUOTING, converge.ts:52 `finiteValue`, degrees.ts:15/16
   `CALL`/`ANY`, icdf.ts:187. Call renamers: ourNames.ts:17 `renameCalls` (own lexer), icdf.ts:163/:197, angleMigration.ts:22.
7. **Store detection** — homeEval.ts:373 `STATEFUL` (`:=`, `=>`, purge/assume/additionally/sto); library.ts:116 `assigns`
   (`:=`, `=<`, `+=`…, `++`, `--`); library.ts:73–112 `storedNames`; library.ts:23 `STATE_WORDS`; numeric.ts:1097
   `definitionStores` (`=>`, sto/purge/assume, one-level `name[..]:=`, its own `local` regex at :1102); host.ts:399/:402
   purge/assume regexes. They disagree: `a+=1` and `b=<7` are stores to library.ts but not to `isStateful` (B-P3).
8. **"stores no value" prefix** `^\s*(purge|assume|additionally)\s*\(` — host.ts:552 and homeEval.ts:428 (identical).
9. **Indexed target `name[…]:=`** — host.ts:230 `indexedTarget` and homeEval.ts:416 (identical, one level); numeric.ts:1104 (one
   level, unanchored); library.ts:96–106 (any nesting). B-P5 shows the one-level form losing `L[M[1]]:=7`.
10. **Function head `f(params):=`** — host.ts:171, library.ts:128, homeEval.ts:391, library.ts:357 (all `[^()]*`).
11. **Arrow head** — host.ts:175, library.ts:129 (with `name:=`), homeEval.ts:439 `arrowFunction`, numeric.ts:345, numeric.ts:1100
    (two regexes, `[^)]*`).
12. **`local` declarations** — library.ts:134 (`[^;]+`, split on `\s|:=`) and numeric.ts:1102 (`[^;]*`, strips `:=…`).
13. **String skipping `"[^"]*"` / `indexOf('"')`** — every scanner above; none honours Giac's `\"` escape (B-P10).
14. **Decimal/number literal lexers** — homeEval.ts:270 `DECIMAL` (reads `1.` and `.3`, B-P1); numeric.ts:106 `FLOAT_LITERAL`
    (lookbehind on `.`); numeric.ts:254 number part of namesIn; ourNames.ts:41; homeEval.ts:287 and ourNames.ts:30 the same word lexer.
15. **Parsing a printed real** — format.ts:92 `decimalFromString`; solve1.ts:63 `num`; converge.ts:67 `realOf`; converge.ts:95;
    converge.ts:287 (giacPair); numeric.ts:120 (floatsAtDigits); solve1.ts:70 `negZero` is applied only by solve1/solve.
16. **Rational text** — calc/engine.ts:46 `^-?\d{1,200}(\/\d{1,200})?$`; goldenRun.ts:171 `RATIONAL_TEXT`; numeric.ts:458 `RATIONAL`.
17. **"text has a decimal"** — goldenRun.ts:143 and :152 (the same `/\.|\d[eE][+-]?\d/`, mirroring session.svelte.ts) vs
    numeric.ts:106 `hasFloat`.
18. **isError / isTimeout** — host.ts:94/:98, converge.ts:48, degrees.ts:18, numeric.ts:492, homeEval.ts:364/:368,
    units/evaluate.ts:81; inline `startsWith("GIAC_ERROR")` in solve.ts:53/177/181/264/281/300, solve1.ts:103, analysis.ts:173,
    constUnc.ts:79; regex `/^GIAC_ERROR/` host.ts:322, converge.ts:239; unanchored `/GIAC_ERROR/` library.ts:340.
19. **Equation test `HAS_EQ`** — solve.ts:109 and solve1.ts:97 (identical literal; both wrong for B-P6).
20. **"definition loaded?" (`giac.eval(name) === name`)** — icdf.ts:161, icdf.ts:199, numeric.ts:101, solve.ts:32 (untrimmed),
    analysis.ts:15, host.ts:439.

## C. Outside app/src/engine (157 sites)

### Sites
| file:line | function | reads | what it decides | what it misses | kind |
|---|---|---|---|---|---|
| render/tidy.ts:7-18 | matchBrace | GIAC-OUT (latex()) | the `}` closing a `\frac` group | none found (skips `\{`) | BRACKET |
| render/tidy.ts:21-45 (27, 32) | sizeBrackets | GIAC-OUT | every plain `(` `)` becomes `\left(` `\right)` | a `(` inside `\mbox{…}` string text is resized too; any unbalanced text is left wholly unsized (inferred) | REWRITE |
| render/tidy.ts:48-69 (52) | stripFracParens | GIAC-OUT | brackets around a whole numerator/denominator are dropped | none found | REWRITE |
| render/tidy.ts:72-81 | unparen | GIAC-OUT | `\left(X\right)` encloses the whole group | none found | BRACKET |
| render/tidy.ts:87-106 | equalitySides | GIAC-OUT | `\left(xy\right)==2` → `xy==2` | depth counts only `{[`/`\left(`; two `==` left as typed (by design); none found | SHAPE |
| render/tidy.ts:120-125 | implicitProducts | GIAC-OUT | `\cdot` dropped between a factor and a letter/command/bracket | none found (probe: `x\cdot y`→`xy`, `2\cdot\frac{\pi}{7}` kept, `\mathrm{i\_}\cdot x`→`ix`) | REWRITE |
| render/tidy.ts:131-134 | subscriptNames | GIAC-OUT | `\mathrm{x\_1}` → `x_{1}` | a two-level name `x_1_2` (`\mathrm{x\_1\_2}`) keeps upright text with `\_` (inferred) | NAMES |
| render/tidy.ts:141-146 | greekNames | GIAC-OUT | `\beta_` → β; ε, φ → varepsilon, varphi | none found (probe: `\beta_\cdot x`→`\beta x`, `\epsilon_`→`\varepsilon`) | NAMES |
| render/tidy.ts:155-160 (157, 159) | constantsAndLetters | GIAC-OUT | `e^`, `i` → upright constants; `\mathrm{e\_}`, `\mathrm{i\_}` → letters | an `i` in `\mbox{…}` string text becomes `\mbox{\mathrm{i}}` (confirmed on the function; whether Giac prints such a string: inferred) | NAMES |
| render/tidy.ts:166-181 | notEqualCalls | GIAC-OUT | `\mathrm{!=}\left(a,b\right)` → `a\ne b` | depth counts raw `([{` chars, so `\{`, `\left\{` or a bracket inside `\mbox{}` shifts the split (inferred); `\left[1,2\right]` works (confirmed) | SHAPE |
| render/tidy.ts:190 | tidyGiacLatex (matrices) | GIAC-OUT | `\left(\begin{array}…\end{array}\right)` → pmatrix | lazy `[\s\S]*?` ends at the first `\end{array}`: a matrix with a matrix entry is cut wrongly (inferred); a list of matrices is fine (confirmed) | SHAPE |
| render/tidy.ts:192 | tidyGiacLatex (inverse names) | GIAC-OUT | `\mathrm{asin}` … → `\arcsin`, arsinh… | none found (Giac prints asinh(x) as `\ln\left(x+\sqrt{x^{2}+1}\right)`, probe) | NAMES |
| render/tidy.ts:193 | tidyGiacLatex (factorial) | GIAC-OUT | `\mathrm{factorial}\left(…\right)` → `\left(…\right)!` | `[^()]*`: any argument holding a bracket, e.g. factorial(sin(x)), stays `\mathrm{factorial}\left(\sin\left(x\right)\right)` (confirmed) | SHAPE |
| render/tidy.ts:197 | tidyGiacLatex (`*`) | GIAC-OUT | every `*` → `\cdot` | a `*` inside `\mbox{}` string text (inferred) | REWRITE |
| render/tidy.ts:199 | tidyGiacLatex | GIAC-OUT | whitespace collapsed | none found | REWRITE |
| render/home.ts:18 | complexToLatex | NUM (our formatter) | real part is zero → drawn as `bi` alone | none found | NUMBER |
| render/home.ts:38-43, 68 | GREEK_NAME / greekLetter | GIAC-OUT or our list text | Greek names → letters | subscripted Greek `alpha_1`, `beta_1` stay as letter strings (confirmed); the letter names `e_`, `i_` stay `e_`, `i_` (confirmed) | NAMES |
| render/home.ts:46-53 | balanced | GIAC-OUT | brackets pair up | none found | BRACKET |
| render/home.ts:56-60 (57-59) | relationText | GIAC-OUT | `(x==2)` unbracketed, `<>` → ≠ | `!=` is not looked for (`/==\|<>/`); `((x==2))` loses one layer only (confirmed) | SHAPE |
| render/home.ts:63-76 | homeResultToLatex (whole) | GIAC-OUT (r.display when no r.latex, session.svelte.ts:530) and our list text (displayMode.ts:204) | Giac text → LaTeX | no rule for `pi`, `sqrt`, `exp`, function names: `pi*i`→`pi\mathrm{i}`, `sqrt(2)*i`→`sqrt(2)\mathrm{i}`, `exp(1)`→`exp(1)` (confirmed; which Home results lack r.latex: inferred) | REWRITE |
| render/home.ts:65 | homeResultToLatex (sci) | NUM | whole-string E notation → `\times10^{}` | E inside a larger text: `2.5e-3*x` stays `2.5e-3\cdot x` (confirmed) | NUMBER |
| render/home.ts:69-71 | homeResultToLatex (i) | GIAC-OUT / our list text | `i` → `\mathrm{i}` after `*`, a digit, start or ± | `[1,i]`, `(i+1)`, `exp(i)`, `2^i`, `1/i` keep an italic i (confirmed) | NAMES |
| render/home.ts:72 | homeResultToLatex | GIAC-OUT | `*` → `\cdot` | none found | REWRITE |
| render/home.ts:73-74 | homeResultToLatex | GIAC-OUT | `inf`, `infinity` → ∞ | none found | NAMES |
| render/home.ts:75 | homeResultToLatex | GIAC-OUT | `x_1` → `x_{1}` | multi-letter bases `ab_1`, `alpha_1` (confirmed: `alpha_1` unchanged) | NAMES |
| render/insertable.ts:7-18 (12) | hasTopLevelSum | LATEX (result display) | a sum gets brackets before insert | `a\pm b` not wrapped (± is a command, inferred); a mixed number `2\frac{1}{3}` not wrapped and the parser reads it `2*(1/3)` = 2/3 (parse confirmed); `\left\|x-1\right\|` and matrices over-wrapped (confirmed, harmless) | BRACKET |
| render/insertable.ts:23-24 | resultToEntry | LATEX | `\mathrm{i}`/`\mathrm{e}` → `\imaginaryI`/`\exponentialE` | an italic i/e left by home.ts:69-71 (e.g. `[1,i]`) goes back as the letter `i_` (inferred) | NAMES |
| clipboard/text.ts:54 | realText | NUM | trailing zeros dropped | none found | NUMBER |
| clipboard/text.ts:64 | realText | NUM | `.` → `,` | none found | NUMBER |
| clipboard/text.ts:93 | copyFull | GIAC-OUT (full) | an exact integer is copied whole | none found | NUMBER |
| clipboard/text.ts:95 | copyFull | GIAC-OUT | `E`→`e`, then decimalFromString: a float's digits | none found (complex float text falls back to the value) | NUMBER |
| clipboard/text.ts:109-111 | withoutMark | OTHER (our shown text) | strips a leading = ≈ ⚠ n | none found | OTHER |
| clipboard/text.ts:127 | copyMark | GIAC-OUT | exact integer → "=" | none found (same regex as :93) | NUMBER |
| clipboard/text.ts:135 | group | LATEX fragment | bare vs bracketed in `a/b`, `^` | none found | BRACKET |
| clipboard/text.ts:138-161 (140-158) | entryText | LATEX (entry) | the entry as plain text for Share session | nested `\frac{\frac{1}{2}}{3}`→`\frac1/23`; `\sqrt[3]{8}`→`\sqrt[3]8`; `\log_{2}(8)`→`\log_2(8)`; `\ne` kept; matrices→`\beginpmatrix1&2\endpmatrix`; `\emark`, `\placeholder` kept (all confirmed) | REWRITE |
| clipboard/paste.ts:22-39 (25, 29) | realPattern / parseReal | OTHER (clipboard) | one real number with e/ᴇ/×10^ | none wrong-valued found; refuses `1,234.5`, `(1+2i)`, `j` | NUMBER |
| clipboard/paste.ts:41 | isZeroReal | NUM | zero (no exponent written) | none found | NUMBER |
| clipboard/paste.ts:51-60 (56) | splitAt | OTHER (clipboard) | the sign between re and im | none found | NUMBER |
| clipboard/paste.ts:66-91 (68, 69, 75, 76, 83, 85) | parsePastedNumber | OTHER (clipboard) | a complex `a+bi` | none found | NUMBER |
| units/build.ts:27 | negate | NUM | sign of a power text | none found | NUMBER |
| units/build.ts:39, 66 | tokenGiac / isLog | OTHER (index dim key) | `/Np/` in dim: a logarithmic unit | none found (the same test twice) | NAMES |
| units/build.ts:41-42 | tokenGiac | GIAC-IN (index si) | `si.split("+")`: affine °C/°F | only `a+b`; a negative offset written `a-b` would be read as linear (today's index: 2 affine units, both `+`) | SHAPE |
| units/build.ts:65 | isAffine | GIAC-IN (index si) | `si.includes("+")` | as above | SHAPE |
| units/build.ts:83-98 (84, 88, 89, 95) | aloneNumber | GIAC-IN (formula) | the formula is one number × the slot | refuses numbers it cannot read: `sqrt(4)*pasu1`, `exp(1)*pasu1`, `5*pasu1*1` → "temperature" (confirmed); no wrong acceptance found | SHAPE |
| units/build.ts:109, 121 | specialSource / specialEnd | GIAC-IN (index si) | `si.split("+")`: factor and offset | as :41 | SHAPE |
| units/build.ts:146-172 (151, 166) | uncertainValues | GIAC-IN (formula) | `pasupm(v,σ)` → `pasv<n>` | none found | BRACKET |
| units/build.ts:182 | tokenSymbol | LATEX (index chip symbol) | drops the 1 of `1°` | none found (differs from slot.ts:57) | NAMES |
| units/build.ts:195 | hasCycles | OTHER (unit ids) | `/rpm\|rev\|Hz/` substring | none found in today's ids | NAMES |
| units/build.ts:213, 245 | shownOf (RATIONAL) | GIAC-IN (index si) | the factor to SI is exactly p/q | none found | NUMBER |
| units/build.ts:223, 240 | shownOf | NUM | integer powers only | none found | NUMBER |
| units/build.ts:238 | shownOf | GIAC-IN (index si) | `si.includes("+")` | as :41 | SHAPE |
| units/build.ts:275-276 (317, 319, 386, 402) | PLACEHOLDER / HAS_SLOT | GIAC-IN | `pasu<n>`/`pask<n>` placeholders | none found | NAMES |
| units/build.ts:280-302 (293) | splitTop | GIAC-IN | top-level terms and factors (binary ± vs E notation) | none found | BRACKET |
| units/build.ts:309-327 (312, 315, 321, 322) | dimensionForm | GIAC-IN | the dimension-check formula | none found | REWRITE |
| units/build.ts:330-346 | insideBrackets | GIAC-IN | each top-level bracket checked alone | none found | BRACKET |
| units/build.ts:361 | buildJob | GIAC-IN | `^pasv1*pasu<n>$`: one ± value on °C/°F | none found | SHAPE |
| units/build.ts:365, 367 | buildJob | GIAC-IN | `-( … °C)`: the "minus" message | none found | SHAPE |
| units/build.ts:395 | buildJob | GIAC-IN | `\bpas` left after our names: reserved name | refuses any user name that starts with "pas" (`pascal`, `past`) (inferred) | NAMES |
| units/build.ts:397 | buildJob (values) | GIAC-IN | `pasv<n>` → its value | none found | REWRITE |
| units/dims.ts:33-37 | isExponent | NUM | `p` or `p/q` | none found | NUMBER |
| units/dims.ts:41-53 (43) | parseDimKey | OTHER (index dim key) | base → exponent | none found | OTHER |
| units/dims.ts:70, 80, 122-124 | powerText / dimensionText / unitProduct | NUM | fraction or negative power text | none found | NUMBER |
| units/factors.ts:33-36 (34) | symbolOf | LATEX (index insert) | the unit symbol for messages | a symbol with braces (`[^{}]+`) falls back to the name; a different regex from slot.ts:55 (inferred) | NAMES |
| units/uncertainty.ts:13-17 (14) | parseDecimal | GIAC-OUT (evalf text) | decimal → m·10^k | none found (`1e+25` reads) | NUMBER |
| units/slot.ts:54-58 (55, 57) | symbolLatex | LATEX (index insert) | the chip symbol as LaTeX, `_` escaped, `1°`→`°` | `/^1(?=\D)/` strips a leading 1 before any non-digit, not only ° (inferred) | NAMES |
| units/slot.ts:78-113 (79, 86, 97) | exactFactor | GIAC-IN (index si) | si as p/q·π^k | a decimal si (`1.5`) gives undefined: the unit never pairs (inferred) | NUMBER |
| units/slot.ts:178 | SlotModel constructor | NUM | a power the pad can make | none found | NUMBER |
| units/slot.ts:292 | reading | GIAC-IN (index si) | `si.includes("+")`: an interval reading | as build.ts:41 | SHAPE |
| units/evaluate.ts:81-83 | isError | GIAC-OUT | `GIAC_ERROR` prefix | none found | STATE |
| units/evaluate.ts:88-90 (89) | withAngles | GIAC-IN (parser output) | `sin\|cos\|tan(pasdeg*` → `pasusin(` … | sec, csc, cot get the same `pasdeg*` from the parser (angles.ts ANGLE_IN) but are not rewritten: `sec(pasdeg*(30*pasu1))` stays (confirmed text; refusal in the unit view inferred) | REWRITE |
| units/evaluate.ts:93-112 (94, 107) | inverses | GIAC-IN | inverse calls → `pasu<name>(`, the `/pasdeg` after them dropped | `arg`, `angle`, `instphase`, `instfreq` (angles.ts ANGLE_OUT) keep `/pasdeg` and get no rad dimension (inferred) | REWRITE |
| units/evaluate.ts:117-144 | checked | GIAC-OUT (pasuq list) | the code 0-5 and its exponents | none found | SHAPE |
| units/evaluate.ts:177 | oneRadApart | OTHER (dim key) | integer rad exponent | none found | NUMBER |
| units/evaluate.ts:251, 381 | uncertainty / unitEval | GIAC-IN (our template) | `pasux` → the ratio | none found | REWRITE |
| units/evaluate.ts:269-271 | uncertainty | GIAC-OUT | share number; singular flag `"1"` | none found | SHAPE |
| units/evaluate.ts:294 | chosenUnit | NUM (JS toExponential) | decimal exponent for the prefix | none found | NUMBER |
| units/evaluate.ts:363 | unitEval | GIAC-OUT | `sign(…)` = "-1": below absolute zero | a symbolic sign passes (inferred) | STATE |
| units/evaluate.ts:377 | unitEval | GIAC-OUT | `sign` in {"-1","0"}: level of a ratio ≤ 0 | a non-real ratio's sign passes (inferred) | STATE |
| units/evaluate.ts:387 | unitEval | GIAC-OUT | `lname` = `[]`: engine vs symbolic error | none found | SHAPE |
| input/emit.ts:31, 67 | wholeText / oddIndex | NUM (MathJSON num) | whole literal | none found | NUMBER |
| input/emit.ts:136 | numberText | NUM | `e+` → `e` | none found | NUMBER |
| input/emit.ts:139-143 | numberText | NUM | a valid number literal | none found | NUMBER |
| input/emit.ts:152 | symbolText | OTHER (MathJSON) | `'…'` string literal | none found | OTHER |
| input/emit.ts:170 → angles.ts:53-56 | call (numericLiteral) | GIAC-IN (just emitted) | RE-READS emitted element text: is `[r,t]` a literal point | none found (conservative: `exp(1)` goes through RECT_IN) | SHAPE |
| input/emit.ts:224 | ser | GIAC-IN (just emitted number) | RE-READS emitted text: `-` → precedence 3 | none found | NUMBER |
| input/emit.ts:276 | ser (Power) | GIAC-IN (own p) | negative exponent in brackets | none found | NUMBER |
| input/angles.ts:69-81 | closing | GIAC-IN / GIAC-OUT | the bracket closing one, outside strings | an escaped quote `\"` ends the string early (confirmed via dropAngleFactor/rewriteAngles) | BRACKET |
| input/angles.ts:84-95 | unmatchedOpen | GIAC-OUT | last unclosed `(` | ignores strings (comment says so) | BRACKET |
| input/angles.ts:98-117 | splitArgs | GIAC-IN | top-level arguments | the same `\"` miss | BRACKET |
| input/angles.ts:124-129 | literalPoint | GIAC-IN (library) | `[r,t]` of two literals | none found | SHAPE |
| input/angles.ts:132-152 (143) | newDegrees | GIAC-IN (stored) | R64's ° form → DEGREE | only the exact spelling `(pi/180)^angle_radian()/pasdeg` (inferred) | REWRITE |
| input/angles.ts:161-164 (162) | rewriteAngles | GIAC-IN | text already holds `pasdeg` → only the ° fix | a `pasdeg` anywhere, even in a string, stops the whole rewrite (inferred) | STATE |
| input/angles.ts:166-215 (178, 183, 185, 204) | rewrite | GIAC-IN (library file, stored input) | every angle command gets the factor | a function passed by name: `map([1,2],sin)`, `sin@cos`, `f:=sin` unchanged (confirmed); `"a\"sin(x)"+sin(x)` rewrites inside the string and not the call (confirmed) | REWRITE |
| input/angles.ts:217-222 | hasAngleFactor | GIAC-IN / GIAC-OUT | text holds the factor | none found | STATE |
| input/angles.ts:230-280 (236-270) | dropAngleFactor | GIAC-OUT (homeEval.ts:705 display, host.ts:398 preview) and GIAC-IN (library.ts:377 export) | hides `pasdeg*`, `/pasdeg`, POLAR_OUT, RECT_IN | `sin(x*pasdeg)` kept (confirmed; Giac printed `(x)->sin(pasdeg*x)` in the probe, so the reordered form is inferred); `\"` in a string (confirmed: stripped inside, kept outside) | REWRITE |
| input/chip-giac.ts:15-19 (17) | chipName | OTHER (table key) | `res:<k>` → `pasr_<k>` | none found | NAMES |
| input/chip-giac.ts:21-42 (33, 37) | chipToGiac (DECIMAL) | GIAC-OUT (chip value) | a decimal → exact rational literal | a complex decimal `1.5+2.5*i` goes in as floats `(1.5+2.5*i)` (confirmed text) | NUMBER |
| input/chip-giac.ts:32 | chipToGiac | GIAC-OUT | `;` or `:=`: a statement | none found | SHAPE |
| input/chip-giac.ts:47, 102 | hasTest / piece | GIAC-OUT | an `==`/`<>`/`!=` test in a value | none found (`(n!)==2`, `[(x<>2),1]` confirmed) | SHAPE |
| input/chip-giac.ts:63-99 (64, 81, 89) | valueTests | GIAC-OUT | bracket groups and comma pieces | none found | BRACKET |
| input/chip-giac.ts:110 | piece | GIAC-OUT | a relation or logic word beside the test | none found | SHAPE |
| input/parse.ts:816 | Parser.chip | GIAC-OUT (chip value) | value with a test → inline, else by name | none found (duplicate of chip-giac.ts:47) | SHAPE |
| input/parse.ts:818-819 | Parser.chip | GIAC-IN (own `pasr_<k>`) | RE-READS its emitted name to get the key after `_` | none found | NAMES |
| input/parse.ts (52, 70, 79, 88, 104, 113, 131, 161, 280, 349, 519, 535, 700-702, 741, 763-769, 785, 806, 842, 879, 894, 1010, 1038, 1091, 1130, 1146, 1179) | tokenizer and recursive descent | LATEX | tokens, letters, number literals, chip/const ids, environments | summary line: the expected tokenizer regexes; not itemised | OTHER |
| input/chips.ts:34 | chipKeysIn | LATEX | `\res{k}`, `\const{ID}`, `\ans` used | none found | NAMES |
| input/chips.ts:55 | validChips | OTHER (stored key) | well-formed table keys | none found | STATE |
| input/latex-to-giac.ts:31, 39 | userFunctionsOf / definedFunction | OTHER (user names, MathJSON) | single letters that are functions | none found | NAMES |
| state/session.svelte.ts:131 | isDigitsText | GIAC-OUT (full) | rounded digits vs exact text | an exact text with a name like `a1e2` or a range `1..3` counts as digits (inferred; only greys Copy exact) | NUMBER |
| state/session.svelte.ts:135-140 | rationalOf | GIAC-OUT | exact rational n/d | none found | NUMBER |
| state/session.svelte.ts:453 | Session.run | LATEX | `\ans` in the entry | none found | NAMES |
| state/session.svelte.ts:521, 568 | Session.finish | GIAC-OUT | `true`/`false` from an inexact chip → approximate | `[true,false]` or a test inside a larger value not caught (inferred) | SHAPE |
| apps/decimal.ts:12-24 (14) | parseDec | NUM | plain decimal | none found | NUMBER |
| apps/decimal.ts:27-34 (29-32) | plainNumber | LATEX (entry) | the entry is a plain decimal | decimal comma `1{,}5` → undefined (confirmed); `1.5\cdot10^{-3}` → undefined (confirmed); non-global replaces (inferred) | NUMBER |
| apps/decimal.ts:54 | decText | NUM | trailing zeros | none found | NUMBER |
| apps/solve/app.svelte.ts:56 | numberLatex | NUM → LATEX | `e` → ᴇ for the entry | none found | NUMBER |
| apps/solve/app.svelte.ts:175, 337 | keepFull / setFromResult | NUM (our display) | `E` → `e` (first only) | none found | NUMBER |
| apps/solve/app.svelte.ts:255 (IDENT = engine/types.ts:27) | refreshUnknowns | GIAC-OUT (unknowns from Giac's names) | which names are unknowns | `^[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)?$` rejects `beta_`, `e_`, `i_` (confirmed), so β, γ, Γ, ε, Φ, Ψ and the letters e, i can never be solved for; also `x_1_2` | NAMES |
| apps/solve/app.svelte.ts:352-353 | restore | OTHER (stored) | stored names valid | same IDENT miss | NAMES |
| apps/solve/app.svelte.ts:357 | restore | NUM | stored copy text | none found | NUMBER |
| apps/function/app.svelte.ts:103, 239 | fmt / csvCell | GIAC-OUT (cell display) | `±infinity`, `inf`, `undef` → NaN | none found | STATE |
| apps/function/compile.ts:37 | compileDefinition | OTHER (MathJSON head) | a relation is not a function of x | `EqualTest` (==), `And`/`Or`/`Assign` heads are not in the list (inferred) | SHAPE |
| entry/controller.ts:15, 489 | COMPOUND / selectCompound | LATEX (atom) | a fraction or root atom | none found | LATEX-EDIT |
| entry/controller.ts:16, 470, 482 | MIXED_FRAC | LATEX (atom) | `\tfrac` | none found | LATEX-EDIT |
| entry/controller.ts:23-35 (29, 30) | hasOuterSup | LATEX | a `^` outside groups and `\left…\right` | none found | LATEX-EDIT |
| entry/controller.ts:41, 46 | isPower / isDms | LATEX (key template) | `#@^`, caret, `#@\degree` | none found | LATEX-EDIT |
| entry/controller.ts:55 | isPlainTerm | LATEX (selection) | one number, letter or chip | decimal comma `1{,}5` gets brackets (harmless, inferred) | LATEX-EDIT |
| entry/controller.ts:62, 410 | OPENS_TERM / noNumberBefore | LATEX (atom) | ᴇ starts a number here | `\pm`, `\mp`, `;` (argument separator with the decimal comma), `:` are missing: ᴇ stays bare there (inferred) | LATEX-EDIT |
| entry/controller.ts:288, 293, 295 | adopt | LATEX / table keys | renumber `\res{k}` | none found (new k > every key) | LATEX-EDIT |
| entry/controller.ts:370, 374, 381, 384 | run | LATEX (key template) | `#@` templates | none found | LATEX-EDIT |
| entry/controller.ts:397 | beforeDegree | LATEX | the selection is followed by `\degree` | none found | LATEX-EDIT |
| entry/controller.ts:417 | afterDigit | LATEX (atom) | a digit or point before the cursor | none found | LATEX-EDIT |
| entry/controller.ts:430-439 | selectENumber | LATEX (atoms) | `digits [±] \emark digits` | none found | LATEX-EDIT |
| entry/controller.ts:480-488 | selectCompound | LATEX (atoms) | digits, `^` | none found | LATEX-EDIT |
| entry/boxes.ts:19 (used delete.ts:86, 143, 542, 573; stops.ts:56) | NAME | LATEX (atom) | a function name that owns its bracket | MathLive's `\deg`, `\dim`, `\ker`, `\mod`, `\sup`, `\inf` (none typed by our keys; inferred) | LATEX-EDIT |
| entry/boxes.ts:21 (delete.ts:143, 542, 576) | LETTERS | LATEX | a name made of letters | none found | LATEX-EDIT |
| entry/boxes.ts:23 (263, 530; delete.ts:560) | MARK | LATEX | `=` or `\to` mark | none found | LATEX-EDIT |
| entry/boxes.ts:25-26 (106, 200, 251, 270, 279, 301, 331) | BIGOP / INT | LATEX | lim, Σ, Π, ∫ | none found | LATEX-EDIT |
| entry/boxes.ts:31 (107) | ARRAY | LATEX | matrix and cases environments | `smallmatrix`, `array`, `dcases` (none typed by keys; inferred) | LATEX-EDIT |
| entry/boxes.ts:35 (108, 123; delete.ts:104) | LOG_BASE | LATEX | `\log_`, `\ln_` | none found | LATEX-EDIT |
| entry/boxes.ts:37 (110, 123) | EQ_NAME | LATEX | EQ's name | none found | LATEX-EDIT |
| entry/boxes.ts:43 (471) | NOT_DEGREES | LATEX | what is not a ° value | `;` missing (inferred) | LATEX-EDIT |
| entry/boxes.ts:46, 96 (144, 171) | isNumberPart / DIGIT | LATEX (atom) | digit or point | none found | LATEX-EDIT |
| entry/boxes.ts:114, 126, 134, 140 | boxTemplate | LATEX (atom) | `_`, `\frac`, `\sqrt`, `\tfrac` prefixes | none found | LATEX-EDIT |
| entry/boxes.ts:382-385, 392 | isEvalPair / evalAt | LATEX | `\left.…\right\|` with a `_` | none found | LATEX-EDIT |
| entry/boxes.ts:574 | isPair | LATEX | `\left` atom | none found | LATEX-EDIT |
| entry/delete.ts:197, 205 | isSup / powerAt | LATEX | a script atom | none found | LATEX-EDIT |
| entry/delete.ts:220 | powerAt | LATEX | the key's own exponent (2, -1) | none found | LATEX-EDIT |
| entry/delete.ts:471 | joinFraction | LATEX | a space between a control word and a letter | none found | LATEX-EDIT |
| entry/delete.ts:583 | template | LATEX | `_`/`^` scripts on a pair | none found | LATEX-EDIT |
| entry/stops.ts:16, 18, 50-56 | MARK_AHEAD / NO_BOX / isStop | LATEX (atom) | where ◀ ▶ stop | none found | LATEX-EDIT |
| entry/stops.ts:87 | nextBox | LATEX | an empty box ahead | none found | LATEX-EDIT |
| entry/hwkeys.ts:100-103 | afterNumber | LATEX (atom) | digits before the cursor | none found | LATEX-EDIT |
| entry/hwkeys.ts:116 | leave | LATEX (atom) | the pair `\left(`/`\left\|` to leave | if MathLive writes the bars as `\left\vert`/`\lvert`, `\|` never leaves (inferred) | LATEX-EDIT |
| entry/kept.ts:26-36 | withoutLostChips | LATEX | a lost chip → its shown LaTeX (via resultToEntry) | a mixed number shown `2\frac{1}{3}` comes back as 2·(1/3) = 2/3 (parse confirmed; the lost-chip case inferred) | LATEX-EDIT |
| entry/macros.ts:51 | isChipLatex | LATEX | an atom is a chip | none found | LATEX-EDIT |
| views/tmplSheet.ts:13 | (template preview) | LATEX (key template) | `#?`, `#@`, `#0` → □ | none found (no `#1`… in spec) | REWRITE |
| find/rank.ts:37 | insertOf | OTHER (Giac command id) → LATEX | `_` → `\_` in `\operatorname{…}` | none found | NAMES |

Skipped (neither Giac text nor LaTeX), 39 sites: views/sheetKeys.ts:42, 47, 52; views/sheet.svelte.ts:32, 34;
views/modeSheet.ts:21, 103, 105; apps/shell.svelte.ts:139, 151, 206, 282; input/backLayer.ts:57, 62, 67;
entry/ans.ts:19; entry/hwkeys.ts:89; state/displayMode.ts:40, 42, 115, 143, 146; find/rank.ts:22, 23, 24, 59, 62, 78;
units/slot.ts:67-69 (titles); clipboard/text.ts:177 (CSV); apps/function/app.svelte.ts:394, 423, 443, 474;
apps/solve/app.svelte.ts:138, 256, 276. (Key ids, view and mode lists, search text, unit titles, CSV quoting.)
No sites in clipboard/actions.svelte.ts, files.ts, native.ts, port.ts, state/storage.ts, pickRows.ts, taps.svelte.ts,
units/types.ts, messages.ts, calc.ts, input/errors.ts, parser.ts, render/mathlive.svelte.ts.

### Duplicates found in C
1. Greek names: input/parse.ts:197 GREEK (LaTeX → `beta_`…), render/tidy.ts:141-146 (Giac LaTeX `\beta_` → β), render/home.ts:38-43 (Giac text `beta_` → β). epsilon→varepsilon and phi→varphi written twice (tidy.ts:144-145, home.ts:42). Neither reader handles a subscripted Greek name.
2. Imaginary unit to `\mathrm{i}`: render/home.ts:69-71, engine/numeric.ts:985-986 (same two regexes, home.ts adds the digit rule), render/tidy.ts:157 (LaTeX form), render/home.ts:17 (complexToLatex). Back to the entry: render/insertable.ts:23 (`\mathrm{i}`→`\imaginaryI`); to text: clipboard/text.ts:149 (`\imaginaryI`→`i`).
3. E notation to `\times10^{}`: render/home.ts:65 (whole string, `E|e|×10^`) vs engine/numeric.ts:984 (anywhere, capital `E` only). Entry LaTeX for an exponent: apps/solve/app.svelte.ts:56 (`\emark`), clipboard/paste.ts:43-48 (`\emark`); apps/decimal.ts:29-31 reads both `\emark` and `\times10^`.
4. Decimal-text parsers (one grammar, 10+ regexes): units/uncertainty.ts:14, apps/decimal.ts:14, input/chip-giac.ts:21, clipboard/paste.ts:22-25, input/emit.ts:140, input/emit-js.ts:29, apps/solve/app.svelte.ts:357, state/session.svelte.ts:131, input/angles.ts:54, units/build.ts:88 and :293 (E-notation guards), engine/format.ts:91 decimalFromString, engine/numeric.ts:106 FLOAT_LITERAL, engine/converge.ts:67.
5. Rational / integer text: state/session.svelte.ts:135, units/build.ts:213, units/slot.ts:178, units/dims.ts:33, clipboard/text.ts:93 and :127 (same regex twice), engine/numeric.ts:461 rationalValue.
6. Chip LaTeX syntax: input/chips.ts:34, entry/kept.ts:26, state/session.svelte.ts:453 (`\ans`), entry/macros.ts:51, clipboard/text.ts:155-157, entry/controller.ts:288-295, plus the tokenizer in input/parse.ts:875-900.
7. Test operators in a chip value: input/parse.ts:816 and input/chip-giac.ts:47, 102 (`/==|<>|!=/`), render/home.ts:58 (`/==|<>/`, no `!=`). Drawing a kept test: render/tidy.ts:87-106 and 166-181 (LaTeX) vs render/home.ts:56-60 (text).
8. Affine unit = `si` contains "+": units/build.ts:41, 65, 109, 121, 238 and units/slot.ts:292. Logarithmic `/Np/`: units/build.ts:39 and 66.
9. The chip symbol of a unit from the index's `insert`: units/factors.ts:34 (`[^{}]+`) vs units/slot.ts:55 (`.+`); the `1°` rule: units/build.ts:182 (`^1(?=°)`) vs units/slot.ts:57 (`^1(?=\D)`). Different regexes for the same field.
10. `_` escaping for `\operatorname`/`\mathrm` names: find/rank.ts:37, units/slot.ts:57; the reverse in render/tidy.ts:132.
11. Angle command lists, three different sets: input/angles.ts:16-27 (ANGLE_IN sin cos tan sec csc cot + 4 geometry; ANGLE_OUT asin acos atan asec acsc acot arg atan2 angle instphase instfreq), units/evaluate.ts:17 + 89 (sin cos tan in; atan2 asin acos atan asec acsc acot out), input/emit-js.ts:23-24 (Sin Cos Tan Cot Sec Csc in; Arcsin Arccos Arctan out).
12. Stripping the angle factor: input/angles.ts:230 dropAngleFactor and units/evaluate.ts:88-112 withAngles/inverses (own regexes for `pasdeg*` and `/pasdeg`); adding it: input/emit.ts:160-175 (from MathJSON) and input/angles.ts:166 rewrite (from text).
13. Hand-written bracket walkers (12): render/tidy.ts:7, 21, 87, 166; render/home.ts:46; render/insertable.ts:7; input/angles.ts:69, 84, 98; input/chip-giac.ts:63; units/build.ts:90-96, 146, 280, 330; units/evaluate.ts:93; entry/controller.ts:23; entry/kept.ts:8. Only angles.ts knows strings, and it does not know `\"`.
14. infinity/undef: render/home.ts:73-74, apps/function/app.svelte.ts:103 and 239 (same regex twice), engine/converge.ts:65-66, input/emit.ts:85-86 CONST.
15. `/^(true|false)$/`: state/session.svelte.ts:521 and 568.
16. `E`→`e`: apps/solve/app.svelte.ts:175 and 337; clipboard/text.ts:95.
17. Subscripted names: render/tidy.ts:131-134 (Giac LaTeX `\mathrm{x\_1}`) vs render/home.ts:75 (Giac text `x_1`), with different reach (tidy takes multi-letter bases, home only one letter).
18. LaTeX → something without the parser: clipboard/text.ts:138 entryText, apps/decimal.ts:27 plainNumber, render/insertable.ts:7 hasTopLevelSum, all beside input/parse.ts.
19. Real odd roots: input/emit.ts:273-276 (Power, only when realOddRoots === true) and 284 (Root) vs input/emit-js.ts:47-51 (Power, always) and 57 (Root); shared helpers oddRootExponent/oddIndex (emit.ts:43, 65).

### emit.ts vs emit-js.ts, construct by construct

Probe (p3): parse → mathJsonToGiac({realOddRoots:true}) vs jsonToJs. Our parser makes binary Add/Subtract, so the
binary-only Add of emit-js is safe today; a flat n-ary Add (Compute Engine's shape, which emit.ts's header accepts)
would lose every term after the second in emit-js (inferred).

| construct | emit.ts | emit-js.ts |
|---|---|---|
| number as JS `number` | numberText: String(e) (emit.ts:134-136) | not handled: fails "unsupportedNode2" (inferred) |
| number `{num}` | strips spaces/`_`, accepts Infinity, NaN (139-140) | own regex, no `_`, no Infinity/NaN (29) |
| string number `"12"` | accepted (143) | read as a symbol name → "unknown name" |
| Pi, ExponentialE, PositiveInfinity | pi, exp(1), inf | Math.PI, Math.E, Infinity |
| ImaginaryUnit, NegativeInfinity, ComplexInfinity | i, (-inf), infinity | not handled |
| Chip (a chip value) | its Giac text | not handled |
| Call (our parser's `\operatorname{…}` and user functions, e.g. asinh, atan2) | name(args) with angle factor | not handled (probe: asinh, atan2 → "unsupported Call") |
| Add | n-ary, Negate term → `-` | binary `(a+b)` only |
| Subtract, Negate, Multiply, Divide | same | same |
| InvisibleOperator (f(x), f(x)^2 calls) | handled | not handled |
| Rational | (a)/(b) | not handled |
| Square | x^2 | not handled |
| Power with base ExponentialE | exp(x) | Math.pow(Math.E,x) |
| Power with p/q, q odd | surd only with realOddRoots === true | always the real root |
| Root | surd for odd index unless realOddRoots === false | real root for odd index always |
| Log 1 arg / 2 args | log10 / ln/ln | same |
| Lb | ln(x)/ln(2) | not handled |
| Delimiter | (x) | x |
| Sequence, Tuple, List, Matrix | handled | not handled |
| Complex, PolarComplex | handled | not handled |
| Degrees | `u*pi/180/pasdeg` | `u*π/180` in RAD, `u` in DEG (same value) |
| Subst, Piecewise, Apply (InverseFunction), Sum, Product, Integrate, D, Limit | handled | not handled |
| Assign, EqualTest, NotEqual, And, Or, Xor, Not, Lambda | handled | not handled |
| Equal, Less, LessEqual, Greater, GreaterEqual | relation | not handled (compile.ts:37 refuses them first, except EqualTest) |
| Sin Cos Tan | angle factor `pasdeg*` | `*π/180` in DEG |
| Cot Sec Csc | cot/sec/csc with factor | 1/Math.tan… with factor |
| Arcsin Arccos Arctan | `/pasdeg` | `/(π/180)` in DEG |
| Arg, atan2, asec, acsc, acot (ANGLE_OUT) | `/pasdeg` | not handled |
| Sinh … Artanh | sinh … atanh | Math.sinh … Math.atanh |
| Arcsinh, Arccosh, Arctanh spellings | handled (emit.ts:75) | not handled |
| Exp, Ln, Lg, Abs, Floor, Ceil, Round, Sqrt, Sign | Giac names | Math.* (Round and Sign agree with Giac at ±2.5 and 0, probe) |
| Max, Min | max, min | Math.max, Math.min |
| Gcd, Lcm, Binomial, Factorial, Re, Im, Conjugate, Arg, Determinant, Transpose, Inverse, Gamma, Mod, Rem | handled | not handled (probe: Factorial → "unsupported") |
| PASDEG as a name | refused (157, 228) | not checked (not a known var anyway) |
| Ln, Sqrt, Power of a negative | complex result | NaN (by design: a break in the curve) |

## Counts

| | A | B | C | All |
|---|---|---|---|---|
| Sites | 88 | 168 | 157 | 413 |
| SHAPE | 15 | 56 | 24 | 95 |
| NAMES | 9 | 36 | 24 | 69 |
| NUMBER | 12 | 10 | 35 | 57 |
| STATE | 26 | 19 | 7 | 52 |
| REWRITE | 7 | 15 | 17 | 39 |
| BRACKET | 7 | 17 | 12 | 36 |
| LATEX-EDIT | 0 | 0 | 34 | 34 |
| OTHER | 12 | 15 | 4 | 31 |
| reads GIAC-OUT | 50 | 81 | 46 | 177 |
| reads GIAC-IN | 35 | 73 | 31 | 139 |
| reads LATEX | 0 | 0 | 46 | 46 |
| reads NUM | 3 | 2 | 19 | 24 |
| reads OTHER | 0 | 12 | 15 | 27 |

