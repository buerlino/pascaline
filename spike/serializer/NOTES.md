<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Serializer: LaTeX → MathJSON → Giac (spike notes)

Code: `spike/input/src/serialize.ts` (Compute Engine 0.151.0 parses LaTeX with `form: "raw"`, so numbers stay as typed
and nothing is evaluated; our own walker writes the Giac string). Cases: `cases.yaml`. Runner:

```bash
GIAC_OUT=<dir with giac.mjs> node spike/serializer/run.mjs     # VERBOSE=1 lists every case
```

Each case is `[latex, intended Giac expression]`, the intended side written by hand from the mathematics
(`source: derived`). Equality is decided by Giac: identical text, same evaluated value, `simplify(a-b)==0`, or the
difference (relative to the intended value) below 1e-8 at 3 random points. Result: see the last line of a run.

## Design points
- Numbers are copied as typed (`1.5`, `6.02e23`, 20-digit integers). Turning decimals into exact fractions is the
  engine's job (gorge's `homeEval`), not the serializer's.
- Precedence-aware output with minimal parentheses; `e^x` becomes `exp(x)`, `\log` is base 10 (`ln(x)/ln(10)`; Giac's own
  `log` is natural), `\sqrt[n]{x}` is `x^(1/n)`, `x°` is `x*pi/180`, `5%` is `0.05`.
- Implicit multiplication: `2x`, `xy`, `(a)(b)`, `x(x+1)` multiply. A name followed by `(...)` is a function call only
  when it has more than one letter or is in `userFunctions` (default `f`, `g`, `h`). Layout spacing (`\,`) is dropped.
- Parse errors from Compute Engine are surfaced as `SerializeError`, never sent to Giac.
- The keyboard inserts structures (`\frac`, `^{}`, `\sqrt{}`); the caret stays inside after the key, so `x`, `^`, `2`, `+`
  puts `+` into the exponent (`x^(2+1)`). Users need the right arrow to leave. This is covered by a test; a real design
  probably moves the caret out after one operand or shows a clear "inside exponent" cue.

## Known gaps (the `gap` group in cases.yaml)
| Case | Behaviour | Needs |
|---|---|---|
| `\sqrt[3]{-8}` | `(-8)^(1/3)` gives the complex principal root, not -2 | decision: real roots for odd n (G2 checklist) |
| `x^y^z` | Compute Engine parse error (MathLive never produces it; it nests `x^{y^z}`) | none |
| units `12\,\mathrm{m}` | `__unit__` head not handled | unit design (R3/R4) |
| sets `\{1,2,3\}` | `Set` head not handled | list/set decision |
| decimal comma `1,5` | parsed as a sequence | locale setting |
| `x(x+1)` with `x` a user function | read as a product | tell the serializer which names are user functions (from the variable store) |

Not covered yet: piecewise functions, `\binom` with big arguments, vectors, sums with symbolic bounds beyond `n`,
`\mathrm{d}` forms other than `\frac{d}{dx}`, `\partial`, `\mathrm{E}` scientific notation key, `ans`, assignments
(`x:=2` / `→`), lists with `\{ \}`, units. Mixed numbers (`2\frac12`) read as `2*1/2`, which is a product, not 2½;
a mixed-number entry template would be needed if the calculator should support it.

## Size and start-up (desktop; Tab One numbers come from annabell)
Compute Engine is the heavy part: the bundle is MathLive 808 kB (223 kB gzip) plus Compute Engine **4.1 MB (1.18 MB gzip)**.
The page loads Compute Engine in the background after first paint (`timing.serializerReadyMs`), so the keyboard and
field are usable without it. Desktop Chromium, production build served by `vite preview`, median of 7 loads (ms from
navigation start; CPU throttling is only an indication, not a Tab One proxy):

| | field + keyboard usable | serializer ready |
|---|---|---|
| CPU x1 | 29 | 132 |
| CPU x4 | 93 | 440 |
| CPU x6 | 129 | 650 |

So the field costs 808 kB of JS (223 kB gzip) and Compute Engine adds 4.1 MB (1.18 MB gzip) in the background. Because we only use
`parse`, a small hand-written parser for the LaTeX subset our keyboard produces would cost a few hundred lines and about
20 kB; see ron's opinion to henri.

Dependencies: `yaml` in `spike/input/package.json` is a devDependency used only by `spike/serializer/run.mjs` (it reads `cases.yaml`); the page itself does not use it.
