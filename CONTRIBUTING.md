# Contributing to Pascaline

Thanks for your interest! Pascaline is at an early stage, so **ideas and feedback are as valuable as code**. You can open an issue to:
- suggest a feature or tell us which calculator features you use most
- report a **wrong result** (see [Reporting wrong results](#reporting-wrong-results))
- point us to an open-source project we should reuse

Before writing code, please read the rules below. **The legal ones aren't optional.** They protect the project from being taken down.

---

## 1. Clean-room rules (most important)

Pascaline is *inspired by* the HP Prime but contains **nothing from it**.

**Never contribute:**
- code, firmware, ROMs or binaries from HP, Moravia or any HP calculator, emulator or app, including decompiled or disassembled code and "leaked" sources
- HP artwork: skins, key or app icons, fonts, screenshots, colour schemes copied from the device
- text from HP manuals or the built-in help, even paraphrased sentence by sentence
- code from NumWorks Epsilon or its forks (Omega, Upsilon). Its CC BY-NC-SA licence isn't compatible with the GPL.

**Allowed:**
- implementing the **same functionality** (maths, apps, workflows) and using **common command names** (`solve`, `int`, `factor`…)
- learning behaviour by **using** a calculator, or the official HP Prime Virtual Calculator, as a black box: type inputs, observe outputs
- reading public documentation to understand behaviour, then **writing everything in your own words**
- reusing code from **Giac/Xcas and KhiCAS** (GPL), with attribution

**If you have ever disassembled or decompiled HP calculator firmware**, please contribute documentation, tests or design work, not engine code. Mention it in your pull request so we can route your work accordingly.

**Naming:** don't use "HP" or "Prime" in identifiers, file names, package names, icons or UI text. When you need to refer to the original, write "the reference calculator", or "HP Prime" in documentation only. One exception: the Python compatibility module keeps the import name `hpprime`, because scripts written for the reference import it; the files and identifiers around it use our own names.

## 2. Licence and sign-off

- Pascaline is licensed under **GPL-3.0-or-later**. By contributing, you agree that your contribution is licensed the same way.
- **Every source file** starts with an SPDX header, for example:
  ```ts
  // SPDX-License-Identifier: GPL-3.0-or-later
  ```
- **Sign off every commit** under the [Developer Certificate of Origin](https://developercertificate.org/). This states that you have the right to submit the code:
  ```bash
  git commit -s -m "feat(solver): add bracket search"
  # adds: Signed-off-by: Your Name <you@example.com>
  ```
  Pull requests with unsigned commits can't be merged.

## 3. Dependencies

- New dependencies must have a **GPL-3.0-compatible licence** (MIT, BSD, Apache-2.0, MPL-2.0, LGPL, BSL-1.0, GPL-3.0…). Add each one to `THIRD_PARTY.md` (name, version, licence, URL) in the same pull request.
- **No prebuilt binaries in the repository** (`.wasm`, `.so`, `.jar`, `.a`…). Everything is built from source by scripts in the repo. F-Droid requires this.
- **No trackers, analytics, ads, crash reporters, Google Play Services or Firebase.**
- **The app must work fully offline.** Any network use must be optional and clearly explained to the user.
- Prefer **fixing things upstream** (Giac, MathLive, JSXGraph…) over patching local copies. If a local patch is unavoidable, document why.

## 4. Maths correctness

A calculator that's wrong is worse than no calculator. So:
- **Every bug fix comes with a regression test.**
- Golden test cases record **where the expected value comes from**: `source: device` (real calculator), `virtual-calc` (official simulator), `oracle` (MPFR/mpmath/SymPy), `derived` (provable), or `assumed` (still to verify). Never write an expected value from memory.
- The UI never calls a maths engine directly. Everything goes through the async engine interfaces (`MathEngine` for Giac; the units engine gets its own). See [docs/04-architecture.md](docs/04-architecture.md), section 8.2.
- A number shown to the user is exact (`=`), rounded with every digit confirmed (`≈`), or flagged (`⚠`). Never show digits the engine has not confirmed (docs/04 section 2).
- If a bug is in **Giac** itself, please also report it upstream to the Giac authors with a minimal example.

## 5. Code style and workflow

- **TypeScript** in strict mode, without `any`. C++ only for thin wrappers around engine libraries.
- User-facing strings go through the translation table, never hard-coded.
- Commit messages use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `test:`, `build:`…).
- Small, focused pull requests are easier to review. Open an issue first for bigger changes.
- Build and test commands are in [CLAUDE.md](CLAUDE.md), section "Commands".

AI-assisted contributions are welcome, but **you** are responsible for them: understand the code you submit, make sure it follows the clean-room rules, and test it.

## Reporting wrong results

Please include:
1. **What you typed**, exactly, and in which view or app (Home, CAS, Solve…)
2. **Settings**: angle mode (deg/rad), exact or approximate, number format
3. **What Pascaline showed** and **what you expected**
4. **How you know the expected answer**: another calculator (which one?), Wolfram Alpha, a textbook…
5. App version and device

Each confirmed report becomes a permanent test case. Thank you!

## Code of conduct

Be kind and constructive. Everyone's welcome here, from first-time contributors to maths professors.
