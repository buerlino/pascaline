# Pascaline: feasibility study (originally "an open-source Android calculator modelled on the HP Prime G2")

> **What still binds:** section 3 (the legal analysis) and its sources. The rest of this study of 2026-10-10 (the 1:1 clone: its architecture, effort, conformance and testing plan) was superseded by [02-architecture-plan.md](02-architecture-plan.md) and then [04-architecture.md](04-architecture.md); its text is in git at `82b261f9`.

*Date: 2026-10-10. This is an engineering study, not legal advice. Before you publish anything, have the legal section checked by a lawyer who knows IP law in your jurisdiction (CH/EU).*

---

## 1. TL;DR
Built or superseded; see docs/04 section 0 (text in git at `82b261f9`).

## 2. What the HP Prime G2 actually is (what we'd have to rebuild)
Built or superseded; see docs/04 section 8 and [06-keypad-vs-g2.md](06-keypad-vs-g2.md) (text in git at `82b261f9`).

## 3. Legal analysis

> Not legal advice. These are the issues to raise with a lawyer, plus the industry practice that makes this project normal and not exotic.

### 3.1 Precedents showing this is a well-trodden path
- **Free42** (Thomas Okken) is a GPLv2 clean-room reimplementation of the HP-42S that has been on Android, iOS and desktop for 20 years, with no HP ROM and no HP code. HP never shut it down.
- **KhiCAS** (Parisse) ports Giac to Casio, TI-Nspire and NumWorks calculators under the GPL.
- **GeoGebra** uses Giac as its CAS.
- **Xcas for Android and iOS** already exists, so Giac on Android is a solved problem.

### 3.2 Copyright: what we may and may not do
**Allowed (with low risk):**
- Reimplementing the **same functionality**. Functionality, maths and programming languages are not protected by copyright. In the EU see **CJEU C‑406/10 *SAS Institute v WPL* (2012)**, and in the US **Google v. Oracle (2021)**, which held that reimplementing an API's declarations was fair use.
- Using the **same command names and syntax** (`solve`, `int`, `PIXON_P`, `FOR … FROM … TO … DO … END;`). Without them, existing user programs can't run, and that is an interoperability purpose.
- Black-box testing a real calculator we own and recording its outputs as a specification.
- Reverse-engineering **file formats** to read and write user programs. This is generally allowed for interoperability (EU Software Directive 2009/24/EC Art. 6), but keep it narrow and document it.

**Not allowed:**
- Copying or extracting **firmware/ROM code**, decompiling HP's binaries to copy logic, or using leaked sources.
- Copying **HP's artwork**: skin images, icons, app icons, fonts that HP licensed, screenshots of HP's UI.
- Copying **manual or help text** verbatim. We may read the user guide to learn behaviour, but we must write our own documentation.
- Bundling HP's emulator, Connectivity Kit or Prime Pro app files.

**Clean-room discipline:** anyone who has decompiled HP firmware must not write engine code. Keep a log of specs and sources and where each behaviour was learned (device observation, public manual, Giac source). This log is our defence if anyone asks.

### 3.3 Trademark
- "HP", "Hewlett-Packard" and the HP logo are trademarks, and "HP Prime" is a product mark. **Don't use them in the app name, icon, package name or store listing title.** Pick our own name (e.g. "OpenPrime" is *still risky* because of "Prime"; a neutral, invented name is safer. Check F-Droid, Play and GitHub for collisions first: e.g. "Calyx" is already an F-Droid science app and also CalyxOS).
- Descriptive mention in the body text, such as *"Runs programs written for the HP Prime™. Not affiliated with HP Inc. or Moravia"*, is normally OK as nominative/referential use.

### 3.4 Design / trade dress (the "same layout" question)
- The **logical** layout (which function sits on which key and shift layer) is mostly functional, and it's what users actually want for muscle memory. Low risk.
- The **visual appearance** (exact colours, key shapes, bezel, the distinctive Prime look) could be protected as a registered design (EU Community Design) or as trade dress. **Recommendation:** same logical layout, different visual styling. Optionally let users load third-party skins, as Free42 does, but never ship HP's look ourselves.
- **Google Play's "impersonation" policy** is the most *practical* risk. An app that looks like an official HP product will be removed. F-Droid is less strict about this but still won't accept trademark-infringing names.

### 3.5 Licence obligations from our dependencies
- **Giac: GPLv3+**, so the whole app is GPLv3. That's fine for an open-source project. Consequences: we can't make a closed-source paid version unless we buy a commercial Giac licence from the authors, which is what HP did. Charging money for a GPL app on Play is still allowed.
- Typical Giac dependencies: **GMP** (LGPLv3/GPLv2), **MPFR** (LGPLv3), **NTL** (LGPL), **PARI/GP** (GPL, optional), **GSL** (GPL, optional). All are GPLv3-compatible.
- **MicroPython: MIT.** Compatible.
- **libmpdec** (decimal arithmetic): BSD-2. Compatible.

### 3.6 Optional: ask
Moravia Consulting now develops and sells HP calculators under licence from HP (since 2022). It costs nothing to email them about the project. They might grant a trademark/skin licence or point out what they object to. Do this before going public, not after.

---

## 4. Is the CAS engine open source? (detail)
Built or superseded; see docs/04 section 7.2 (text in git at `82b261f9`).

## 5. Proposed architecture
Built or superseded; see docs/04 section 8 (text in git at `82b261f9`).

## 6. How to get "all functions equal" (1:1 conformance)
Built or superseded; see docs/04 section 7.3 (the golden gate) and `tests/golden/g2.yaml` (text in git at `82b261f9`).

## 7. How to minimise bugs in the calculator engine
Built or superseded; see docs/04 section 7.3; the release bar is [release-0.1.0.md](release-0.1.0.md) (text in git at `82b261f9`).

## 8. Effort estimate
Built or superseded; see docs/02 section 8 (text in git at `82b261f9`).

## 9. Main risks
Built or superseded; see docs/04 section 9 (text in git at `82b261f9`).

## 10. Recommended next steps
Built or superseded; see [backlog.md](backlog.md) (text in git at `82b261f9`).

## Sources
- Xcas / Giac overview and licence: <https://en.wikipedia.org/wiki/Xcas>, <https://xcas.univ-grenoble-alpes.fr/en.html>, <https://xcas.univ-grenoble-alpes.fr/backup/giac.html> (GPL3, commercial dual licence, v2.0.0-21 Feb 2026)
- KhiCAS ports: <https://xcas.univ-grenoble-alpes.fr/calculatrices/en.html>
- HP Prime hardware, CAS origin, Moravia since 2022: <https://en.wikipedia.org/wiki/HP_Prime>
- HP Prime Pro (Moravia, iOS) and removal from Google Play (Oct 2024): <https://apps.apple.com/us/app/-/id1064702857>, <https://www.hpmuseum.org/forum/post-193030.html>
- Free42 clean-room precedent: <https://thomasokken.com/free42/>
- Giac in GeoGebra: <https://github.com/geogebra/geogebra>
- Legal references (look up with counsel): CJEU C-406/10 *SAS Institute v World Programming*; *Google LLC v. Oracle America* (US Supreme Court, 2021); EU Directive 2009/24/EC Art. 6.
- The other sources are in git at `82b261f9`.
