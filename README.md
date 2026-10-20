<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="logo/wordmark/pascaline_wordmark_light.svg">
    <img alt="Pascaline" src="logo/wordmark/pascaline_wordmark_dark.svg" width="320">
  </picture>
</p>

A graphing CAS calculator for Android and the web. Giac, GSL and MPFR compiled to WebAssembly, run in a Web Worker, fully offline. GPL-3.0-or-later.

> **Pre-release.** No APK or web app to download yet; build it from source (below).

## What it is
- **Home:** numeric, exact-first. Decimals are turned into exact rationals, evaluated by Giac, then rounded to 12 significant digits (`1÷3` → `0.333333333333`). It falls back to floats when the numbers get too big or too slow.
- **CAS:** symbolic, with exact 2D results.
- **Function:** Symb/Plot/Num views, with JSXGraph plots.
- **Solve:** GSL bracketing with Brent, `hybrids` for systems, `proot` for polynomials. Every root is substituted back, and a large residual is flagged with `⚠`.
- **Entry:** textbook (MathPrint) entry with MathLive, driven only by the on-screen keyboard. Our own LaTeX-subset parser turns the entry into Giac input. Results are drawn in 2D from Giac's `latex()`.
- **Keyboard:** the logical key layout of the HP Prime (which function sits on which key and shift layer), defined in [spec/keyboard.yaml](spec/keyboard.yaml). The visual design is our own.
- **Result chips and `Ans`:** reusing a result passes its full-precision value, not the digits on screen.
- **Cancel:** terminates the worker and restores state; every engine call can be cancelled.

## Architecture
```
Capacitor shell (Android; plain web as an offline PWA)
└─ UI: Svelte 5 + MathLive + JSXGraph
   └─ MathEngine (async, cancellable)
      └─ Worker: giac.wasm (Giac 2.1.0 + GSL 2.8 + GMP 6.3.0 + MPFR 4.2.2); the unit view computes here too
Find: a static index generated at build time (unit factors and constants from libqalculate 5.13.1, which never runs in the app)
```
Details: [docs/04-architecture.md](docs/04-architecture.md).

## Measured
| | Lenovo Tab One (low end) | Fairphone 6 |
|---|---|---|
| Keyboard usable | 662 ms | 329 ms |
| Engine ready | 995 ms | 609 ms |
| Home Enter → result, p95 | 92 ms | 23 ms |
| Plot | 56 fps | 89 fps |

The start chunk is capped at 150 kB (52 kB gzip), and the build fails above that.

## Testing
- **Golden gate:** about 600 cases across Home, precision, Solve, Function and parser, checked against the real engine build. Every case records its source: `device`, `virtual-calc`, `oracle` (mpmath), `derived` or `assumed`. An engine build that fails the gate does not ship.
- **Also:** svelte-check, Vitest unit tests and Playwright key-sequence tests at phone size.

## Status
| Milestone | Content | State |
|---|---|---|
| 1 | Home + CAS with MathPrint | done |
| 2 | Function + Solve | done |
| 3 | Python | done; removed in 4a (P11) |
| 4 | **Find and trust** | **in progress** |
| 5 | Units | next |
| 6 | Structure | after 5 |

**Milestone 4, Find and trust:**
- A mark on every result: `=` for exact, `≈` for rounded with only confirmed digits shown, `⚠` for unverified. Precision up to 30 digits.
- **Find:** one search over every function, constant and unit, from a static index built at build time.
- Copy, paste and share the full value.

**Milestone 5, Units (libqalculate):**
- Unit-checked arithmetic and conversion.
- Physical constants.
- Uncertainty that travels with the number.

**Milestone 6, Structure:**
- Matrices and vectors, and number bases.
- Engineering functions: parallel resistance, E-series, dB and interpolation.

**Later:** statistics, spreadsheet, more plot types, 3D, iOS and desktop.

No release dates yet. Task list: [docs/backlog.md](docs/backlog.md).

## Build
```bash
engine/giac/build-wasm.sh          # Giac + GSL → wasm, needs emsdk (about 5 min on 16 cores)
cd app && npm ci && npm run dev    # http://localhost:5173
./build.sh                         # clean source → dist/pascaline.apk
```
- **No binaries in git:** every source tarball is pinned and SHA-256 checked.
- **Release builds:** these use Debian's Emscripten 3.1.69 in a pinned `debian:trixie` container, and are reproducible.
- **F-Droid:** no Google services and no trackers, so the app is ready for F-Droid.

All other commands: [CLAUDE.md](CLAUDE.md#commands).

## Built on
- **Engine:** [Giac](https://xcas.univ-grenoble-alpes.fr/) by Bernard Parisse and Renée De Graeve.
- **Libraries:** [GSL](https://www.gnu.org/software/gsl/), [GMP](https://gmplib.org/), [MPFR](https://www.mpfr.org/), [libqalculate](https://qalculate.github.io/), [MathLive](https://mathlive.io/), [JSXGraph](https://jsxgraph.org/), [Svelte](https://svelte.dev/) and [Capacitor](https://capacitorjs.com/).

Versions and licences: [THIRD_PARTY.md](THIRD_PARTY.md).

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md). The project is clean-room: no HP code, firmware or artwork, and every commit needs a DCO sign-off.

---

<sub>Not affiliated with HP Inc. or Moravia Consulting. HP and HP Prime are trademarks of HP Inc., named only to describe the key layout. Named after Blaise Pascal's 1642 calculating machine.</sub>
