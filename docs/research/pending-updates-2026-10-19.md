<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Pending doc updates (handover, 2026-10-19, night)

This is not a research note. It lists the repo edits I held back on the evening of 2026-10-19, because the night shift was running: `scripts/pipeline.sh:79` refuses a `phase-1` worktree with uncommitted changes to tracked files. Untracked files like this one don't block it. **Delete this file once A is committed.**

Context:
- The upstream bug drafts are in `../outreach/upstream-reports.md` (G1–G13, Q1–Q3, M1–M3).
- The French email to Parisse is in `../outreach/email-parisse.md`; it was **sent on 2026-10-19**.
- **Parisse replied the same evening** (copy: `../outreach/email-parisse-reply-2026-10-19.md`). His answers are in section E. They change A1 and A2, add A6–A9, and confirm C3.
- The owner filed six issues:

| Draft | Issue |
|---|---|
| Q1 `hp` | https://github.com/Qalculate/libqalculate/issues/1043 (fixed in master, see F) |
| Q2 `mmHg` and `inHg` | https://github.com/Qalculate/libqalculate/issues/1044 (fixed in master, see F) |
| Q3 derived CODATA constants | https://github.com/Qalculate/libqalculate/issues/1045 (open, partly addressed, see F) |
| M1 ⌫ at a bracket (F10) | https://github.com/arnog/mathlive/issues/3122 |
| M2 touch caret (F33) | https://github.com/arnog/mathlive/issues/3123 |
| M3 focus restore (F9) | https://github.com/arnog/mathlive/issues/3124 |

## How to apply (by day)
1. Check that no pipeline run is going and that `git -C .claude/worktrees/phase-1 status --porcelain --untracked-files=no` is empty.
2. Re-read each target first. The anchors below were taken from `b235842` and may have moved.
3. Apply A1–A9 together and run `node tools/docs-check.mjs` (the backlog has a 20 kB budget; with A1 and A2 it was 19.0 kB).
4. Show the owner the diff. On their OK, make one commit: `docs: upstream reports filed; Parisse confirms aide_cas is GPL (P10)`, with `git commit -s`.
5. Delete this file.

## A. Ready to apply (one commit)

### A1. `docs/backlog.md`, "Needs the user" item 8
Parisse answered all three questions on 2026-10-19, so the email part of the item goes. P10 is settled in A6–A9, the tarballs become package C3, and the bug route is in A2.

Replace:
```
8. **Later, not now:** the email to Bernard Parisse (draft in `../outreach/`, with P10's question: may the English entries of `aide_cas` ship in a GPL-3.0-or-later app? Needed before any public release), the name and trademark checks, CI (C3) and the F-Droid recipe (C4); the upstream reports below.
```
with:
```
8. **Later, not now:** the name and trademark checks, CI (C3) and the F-Droid recipe (C4).
```

### A2. `docs/backlog.md`, section "Upstream reports"
Replace the heading and its three bullets (libqalculate, Giac, MathLive) with:
```
### Upstream reports (owner; drafts in `../outreach/upstream-reports.md`)
- **libqalculate**, filed 2026-10-19: `hp` [#1043](https://github.com/Qalculate/libqalculate/issues/1043) and `mmHg` = 1 Torr, with `inHg` [#1044](https://github.com/Qalculate/libqalculate/issues/1044), both fixed in master (`92ecde7`, after 5.13.1); 10 derived constants off CODATA 2022 in the last digit [#1045](https://github.com/Qalculate/libqalculate/issues/1045), open. A fix fails the index build on its `override` in `find/units.yaml` once we pin a release that has it.
- **MathLive**, filed 2026-10-19: F10 ⌫ stuck at a `\left…\right` [#3122](https://github.com/arnog/mathlive/issues/3122), F33 the touch caret [#3123](https://github.com/arnog/mathlive/issues/3123), F9 the focus restore [#3124](https://github.com/arnog/mathlive/issues/3124).
- **Giac**, not filed yet (Parisse, 2026-10-19: by email, on the forum, or as links to fix commits in this repo; fill in the route and date once sent): the build fixes we patch (`engine/giac/patches/README.md`) and the re-published tarballs; complex `tanh` gives coth (G50); `erfc` as 1−erf (`evalf(erfc(5))` wrong from the 3rd digit, `UTPN(10)` = 0.0); the exact path of `(-3)^(1/1000-i/50)`; `re()` of nested roots; `normald_icdf(10^-10)` (docs/04 2.3 #2); `acos(pi)` = undef; `int(1/x,x,-1,1)` = 0 and `sum(cos(k),k,1,inf)` = −1/2 (G39); `round(x,n)` and `trunc(x,n)` in a double; no MPFR path for complex `acos` (real part), complex `asinh`, `romberg`, `BesselJ`, `Airy_Ai`; degree mode (deep check D4–D7, D12); unit data (US quart, tsp, cup, UK gallon, inHg = 25.4 Torr, au, light-year, `u`, f0) and Xcas menu names Giac does not read (`tools/probes/g2-units.mjs`). Asked in the email instead: `median`, `round(-2.5)` (G42), `atan(2*i)`, `sign` decided at `Digits` (G38).
```
This corrects the old text in three places:
- `UTPN` (the cause is `erfc`);
- complex `asin`, `atan` and `acosh` (40 right digits on raw Giac; only `acos` has a double real part);
- libqalculate's constants (computed by formula, not stored wrong).

### A3. `find/units.yaml`, the `override` notes
- Header comment (line 15): `upstream (docs/backlog.md "Needs the user")` becomes `upstream (docs/backlog.md "Upstream reports")`.
- In the 16 `override` strings, `; to report upstream` becomes `; reported: libqalculate#<n>`:
  - `unit:hp` takes `libqalculate#1043, fixed after 5.13.1`;
  - `unit:mmHg` and `unit:inHg` take `libqalculate#1044, fixed after 5.13.1`;
  - the 13 constants (`Z_0` … `d_220`, each "variables.xml differs from CODATA 2022") take #1045. Three of them (`m_n`, `neutron_compton_wavelength`, `d_220`) were wrong in our report (see F3): check whether their overrides are needed at all before applying.
- Afterwards no "to report upstream" is left. The YAML still parses with 16 overrides, and only the note text changes (checked on a copy, 2026-10-19).

### A4. `engine/giac/patches/README.md`
- **0001, status column:** "not reported yet (goes with the email to Parisse, after the device measurements)" becomes "mentioned in the email to Parisse (2026-10-19); the full report waits for his answer (draft G12 in `../outreach/upstream-reports.md`)".
- **0002, status column:** "not reported yet (same email)" becomes "the same as 0001".
- **"Last checked" line:** "Last checked 2026-10-10: every patch applies cleanly (`patch -p1 --dry-run`) to the pinned `giac-2.1.0.tar.gz` (SHA-256 `1d9536e0…`)." becomes "Last checked 2026-10-19: every patch applies cleanly (`patch -p1 --dry-run`) to the pinned `giac-2.1.0.tar.gz` (SHA-256 `1d9536e0…`), to the same name re-published on 2026-10-15 (`46d57345…`) and to `giac_2.1.0-1.tar.gz` from Parisse's Debian folder (`cdec2989…`)." All three dry runs passed on 2026-10-19.

### A5. `fdroid/README.md:9`
"Nothing of qalc goes into the APK until the Units app (milestone 5)" is out of date. The Units app was replaced by the unit view, which computes on Giac (P11, P15). New text: "Nothing of qalc's code goes into the APK; its data ships in the Find index (P15)". Check the rest of that sentence when applying.

### A6. `docs/decisions.md:60`, P10
Replace `- **P10 (2026-10-12): Giac's English help lines in Find,** Parisse's confirmation before a public release.` with:
```
- **P10 (2026-10-12): Giac's English help lines in Find.** Confirmed by B. Parisse (email, 2026-10-19): `aide_cas` is entirely GPL; the non-GPL French documentation means R. De Graeve's LaTeX/PDF manuals.
```

### A7. `THIRD_PARTY.md:28`
Replace `(R5; P10, accepted 2026-10-12: shipped now, confirmation from B. Parisse before any public release)` with `(R5; P10; confirmed by B. Parisse by email on 2026-10-19: the whole file is GPL)`. Keep "English entries only", because it says what we ship.

### A8. `docs/research/giac-help-licence.md` (R5)
- Point 2 ("Do not ship the French lines …, since the README says they are non-commercial only") no longer holds. Parisse says the non-GPL French documentation is R. De Graeve's LaTeX/PDF manuals, not the French lines of `aide_cas`. Rewrite it: the French lines are GPL too, and we ship English only because the app is English-first (i18n can add French later).
- Point 4 (ask Parisse) is answered: write the answer in its place, with the date.

### A9. `docs/04-architecture.md:212`
Replace `(Giac's English lines under P10, with B. Parisse's confirmation before any public release)` with `(Giac's English lines under P10, confirmed by B. Parisse on 2026-10-19)`.

## B. Untracked notes (any time; they never block the pipeline)
- **`docs/research/bug-patterns.md`:**
  - line 287 (F10): "MathLive upstream report open" becomes "MathLive #3122";
  - line 296 (F33): it becomes "MathLive #3123";
  - line 349 (hp): "upstream report open" becomes "libqalculate #1043";
  - line 350 (G13): it becomes "libqalculate #1044, #1045";
  - line 365 (Giac data): "upstream report open" becomes "drafted (G11), waiting for Parisse's answer".
- **`docs/research/r16-verification.md`,** "For Giac upstream" (about line 183): F2 and F3 are now drafts G4 and G3, and F4–F6 are in G9.
- **`docs/research/deep-check-2026-10-19-angle-marks.md`** (tracked, so it goes with A, or later): D10's `asin(i)` printing `0.-000…` does not reproduce on raw Giac at Digits 40. Check it through Home before changing D10. D4's mechanism holds on raw Giac: `re(cosh(90*i))` = 0 in DEG, while `evalf(cosh(90*i))` is right.

## C. Waiting for the owner
1. **Commit the untracked notes?** `docs/research/multi-engine-risk.md`, `multi-engine-answer.md`, `bug-patterns.md`, `bug-hunt-2026-10-19.md`, `r16-verification.md`.
2. **The multi-engine answer's hardening list:**
   - ids for H1–H7;
   - H6 (libqalculate out of the build) yes or no;
   - the H3 rule "patch at the cause", for CLAUDE.md and CONTRIBUTING.md;
   - the H7 budgets.

   The G56 hold until H3 is already done (brief, queue step 37). If Parisse takes G1's one-line tanh fix, H3's patch only lasts until the next pin.
3. **A versioned Giac pin,** a package to propose now (engine owner gorge; needs an id). Parisse confirmed on 2026-10-19 that the numbered Debian archives never change once public ("c'est l'utilité du numéro après le signe -"), and he recommends them:
   - Pin `https://www-fourier.univ-grenoble-alpes.fr/~parisse/debian/dists/stable/main/source/giac_2.1.0-1.tar.gz`, checked against the SHA-256 in its `.dsc` (`cdec29897d6a55f9e53f82285ffd85cd82bcaba0bd90a494f710be002bd73f57`, size 150842401). Keep our GitHub mirror as the fallback.
   - Today the upstream fallback in `build-wasm.sh` cannot match our pin anymore: the same name was re-published on 10-15 with SHA-256 `46d57345…`. Only the mirror works.
   - Its source is another snapshot. 46 files under `src/` differ from our pin, mostly interrupt and out-of-memory handling (`gen_oom`), which is near patch 0002. Both patches still apply.
   - It has the same build leftovers as the plain tarball (67 `.o`/`.wasm` files; we already delete `doc/giacwasm.*`).
   - Gates: the golden gate, `compare-engines.ts` against the current build, and the interrupt test.
   - Files: `engine/giac/build-wasm.sh`, `engine/giac/README.md`, `THIRD_PARTY.md`, the F-Droid recipe.

## E. Parisse's answers (2026-10-19) and what follows
1. **`aide_cas` licence:** "aide_cas est entièrement GPL". The non-GPL French documentation means R. De Graeve's LaTeX/PDF documents. P10 is settled, so the help texts no longer block a public release (A6–A9).
2. **Tarballs:** the numbered Debian archives never change once public, and he recommends them. That's package C3.
3. **Bug reports:** "comme vous préférez": by email, on the forum, or as bug-fix commits on our GitHub repo with links sent to him.
   - The two build patches are already on GitHub `master` (`ef857a6`, the same as `phase-1`):
     - https://github.com/buerlino/pascaline/blob/ef857a61c73ac166465a704bcc5911705a87fd0c/engine/giac/patches/0001-gen-remove-add_evalf-debug-log.patch
     - https://github.com/buerlino/pascaline/blob/ef857a61c73ac166465a704bcc5911705a87fd0c/engine/giac/patches/0002-emcc-subsecond-caseval-timeout.patch
   - The tanh fix (G1) would become `0003` with H3. He can take the one line from the report as well.
   - The route for the other reports is the owner's choice. The drafts are in `../outreach/upstream-reports.md`.
   - **Reply draft v1:** `../outreach/email-parisse-2.md`, in English, waiting for the owner's review. Once sent, it promises:
     - the tanh fix as a commit (H3, patch 0003);
     - the other bugs in the forum, grouped as in the "Status" block of `upstream-reports.md` (four "Bugs" threads, one in "Developpement › Giac");
     - an offer of our test cases as Giac regression tests.

     It explains the two projects (KhiCAS everywhere and for teaching; Pascaline for engineers, with units, uncertainty and marks) and why we keep one layout: flicks for Shift and Alpha, and 6 user keys × 3 layers = 18 commands, set from Find.
4. **Language:** he offered to switch to English, so the owner can read the thread without translation.
5. **KhiCAS for Linux on the HP Prime G2** (his current project; native and wasm, a PWA once stable, built with Emscripten 3):
   - demo: https://www-fourier.univ-grenoble-alpes.fr/~parisse/khicasg2/khicas.html
   - source: https://www-fourier.univ-grenoble-alpes.fr/~parisse/hpg2/khicasg2.zip

   He suggests "there may be bits of code to share". Before anyone reads it for reuse, run a licence and provenance check per file (CLAUDE.md):
   - KhiCAS and Giac code under the GPL is fine;
   - no NumWorks Epsilon-derived parts (CC BY-NC-SA);
   - no HP firmware, fonts, skins or text.
6. **Keyboard layouts:** "J'aimerais aussi proposer un choix de layout du clavier (Casio/TI/Numworks/user designed?), pas que celui de la hp prime." It's unclear whether this is about his KhiCAS or a suggestion for Pascaline; ask him.
   - For Pascaline, P11 and the goal (the G2's layout as the backbone, keys that never move) say one layout.
   - `spec/keyboard.yaml` is GPL and open to him if it helps his project.

## F. libqalculate answers (2026-10-19, night)
1. **#1043 (`hp`) and #1044 (`mmHg`, `inHg`) are fixed** in master, commit `92ecde7` (2026-10-19 20:57 UTC). Checked in master's `data/units.xml.in`:
   - `hp` = 745.69987158227022 W, the exact value from the report (line 4268);
   - `mHg` = 133322.387415 Pa, so `mmHg` = 133.322387415 Pa and `inHg` = 25.4 mmHg = 3386.388640341 Pa (lines 3756–3781). `Torr` stays atm/760.
2. **Nothing changes in our build yet.** We pin 5.13.1 (`engine/qalc/build-wasm.sh:43`), which still has the old values, so the three overrides stay. When we pin the next release, their checks in the index build fail by design. That is the moment to delete the overrides for `unit:hp`, `unit:mmHg` and `unit:inHg`, and to close the hp/mmHg part of package G13.
3. **#1045 is still open.** The maintainer replied: CODATA computes from inputs with more digits in their uncertainties, and storing the published values would break correlations (Z0·qe² = 2hα). The same commit `92ecde7` tweaked four input values in `data/variables.xml.in`: the uncertainty of α (1.13E-12 → 1.1322E-12), the τ and μ masses in u, and R∞. Our rerun on 5.13.1 also showed that three rows of the filed table were wrong: qalc already matches CODATA for `m_n` (± 8.5E-37), `neutron_compton_wavelength` (± 6.7E-25) and `d_220` (± 3.2E-18). So the report covers 10 constants, not 13. The owner's reply admits the three rows and withdraws the "store CODATA values" suggestion.
