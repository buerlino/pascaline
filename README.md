# Pascaline

**A free, open-source precision engineering tool for Android and the web: a graphing CAS calculator built so engineers calculate faster and more precisely.**

> 🚧 **Status: early development.** The Phase 0 spike is done; the MVP is being built (Home, CAS, textbook entry, the Function and Solve apps and Python work). There is nothing to download yet. Feedback and ideas are very welcome: please [open an issue](https://github.com/buerlino/pascaline/issues).

Pascaline is aimed at engineers: the fastest way to a correct number, with exact maths, checked answers, and (planned) units and uncertainty. It starts from the key layout and workflow of the HP Prime, so owners of one are fast from the first minute, and goes beyond it where engineering work needs it. It has its own design and is built entirely from open-source software. The name honours the *Pascaline*, the calculating machine Blaise Pascal built in 1642.

## Why?
- HP's official Prime app for Android disappeared from Google Play in late 2024.
- Most maths apps on phones are worksheets or chat-style tools. We want a **real calculator keyboard** with fast, predictable input.
- There's no open-source app of this kind on F-Droid yet.

## Features
- **Home** (numeric) and **CAS** (symbolic) views, with textbook-style (2D) input and output
- **Apps:** Function and Solve, with **Python** for programming (MicroPython built in; an optional full CPython pack with numpy is planned)
- **Checked answers:** numeric solutions are plugged back in and verified, and you get a warning if something looks wrong
- **Next (planned):** one **Find** key for every function, constant, unit and variable; **honest precision** (every result marked exact or rounded, up to 30 digits, copy the full value); a **Units app** with physical constants and uncertainty; matrices, number bases and everyday engineering functions
- **Later:** Statistics, Spreadsheet, more plot types, Geometry, 3D
- **Fully offline**, no ads, no tracking, no account
- Android first, also installable as a **web app (PWA)** on any device

What it is **not**: an exam calculator (phones aren't allowed in exams), an emulator, or a copy of HP's software.

## How it's built
Pascaline reuses mature open-source projects instead of reinventing them:

| Part | Project |
|---|---|
| Computer algebra + numerics | [Giac/Xcas](https://xcas.univ-grenoble-alpes.fr/) by Bernard Parisse & Renée De Graeve, compiled to WebAssembly |
| Math input and textbook display | [MathLive](https://mathlive.io/), with our own small LaTeX → Giac parser |
| Graphs & geometry | [JSXGraph](https://jsxgraph.org/) |
| Numerical solvers | Giac with the [GNU Scientific Library (GSL)](https://www.gnu.org/software/gsl/) |
| Python | [MicroPython](https://micropython.org/); optional [Pyodide](https://pyodide.org/) |
| App shell | [Capacitor](https://capacitorjs.com/) (Android, iOS, desktop) |

Details: [docs/04-architecture.md](docs/04-architecture.md).

## Roadmap
1. ~~**Phase 0, technical spike**~~ ✅ done (2026-10-11): Giac in WebAssembly is fast enough on a low-end Android tablet.
2. ~~**MVP**~~ ✅ keyboard, Home, CAS, textbook input, Function app, Solve app, Python.
3. **Engineer core** (next): Find and honest precision, then the Units app, then matrices, number bases and everyday functions.
4. **Later:** Statistics, Inference, Parametric/Polar/Sequence, Spreadsheet, Finance, RPN, Geometry, Advanced Graphing, 3D. Releases on F-Droid, Google Play and as a web app (not scheduled yet).

## Contributing
Feedback, ideas and code are all welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first. It contains a few **important legal rules**: Pascaline must never contain HP code, firmware or artwork.

## Project documents
- [Architecture](docs/04-architecture.md) and the [original project plan](docs/02-architecture-plan.md)
- [Feature analysis and roadmap](docs/03-feature-analysis.md)
- [Status and backlog](docs/backlog.md)
- [Original feasibility study](docs/01-feasibility-report.md) (its legal section is still current)

## Licence
Pascaline is free software under the **GNU General Public License v3.0 or later** (see [LICENSE](LICENSE)). It has to be, and we're happy that it is: it builds on Giac, which is GPL-3.0.

## Acknowledgements
Huge thanks to **Bernard Parisse and Renée De Graeve** for Giac/Xcas, the engine that makes this project possible, and to all the open-source projects listed above.

---

<sub>Pascaline is an independent project and is **not affiliated with, endorsed by, or connected to HP Inc. or Moravia Consulting**. HP and HP Prime are trademarks of HP Inc., mentioned here only to describe the kind of calculator Pascaline is inspired by.</sub>
