<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# R5: licence of Giac's built-in help texts (sandra)

Source: the README of the pinned `giac-2.1.0.tar.gz` (section "LICENSES", "Documentation") and the files under `doc/`. This is a reading of the README, not legal advice.

## What the README says
- Code (library and Xcas): GPL-3.0-or-later. Copyright B. Parisse and R. De Graeve; some parts are by others (list a/ to k/ in the README: GiNaC-derived parser, gl2ps, FLTK, Luka Marohnic's optimisation/signal/graph-theory code and manuals, QuickJS, MicroPython).
- **On-line help = `doc/aide_cas`** (19,205 lines, 760 KB): "released under the GPL version 3 or above"; copyright R. De Graeve and B. Parisse (English/French), M. Lopez de la Fuente and X. Vidaux (Spanish), A. Akritas (Greek).
- The English **tutorial** is under the FDL (GNU Free Documentation Licence, copyright B. Parisse). `giac_us.texinfo` and `giac_es.texinfo` are GPL-3.0-or-later.
- **The French documentation is not GPL.** "(c) Renee de Graeve. Free distribution for non-commercial purposes; other redistribution needs the copyright holder's consent."
- Item j/ in the README: the NumWorks "Delta" firmware parts shipped in the same tarball derive from Epsilon and are CC-BY-NC-SA. That matches our CLAUDE.md rule; our `build-wasm.sh` compiles only the library sources and no `doc/` binaries (`epsilon.dfu`, `bootloader.bin`, `*.nwa` are in `doc/` but unused).

## What `aide_cas` looks like
One entry per command: `# name`, then one numbered line per language (`1` French, `2` English, `3` Spanish, `4` Greek, `5` German), then the argument-type line (`0 Expr`), related commands (`-1 ...`) and example lines. So the file mixes GPL and non-GPL (French) text in the same file, while the README labels the whole file GPL.

## Consequences for a Help feature
1. The **English (language `2`) lines, the argument types, related-command lists and examples** are covered by the README's GPL-3.0-or-later statement for `aide_cas`. Using them is compatible with our GPL-3.0-or-later licence, with attribution to the authors named above and a pointer to the Giac source.
2. **Do not ship the French lines (language `1`)** in any build, since the README says they are non-commercial only. Spanish/Greek/German lines carry their own authors and should only be shipped if we also want those languages; the safest first step is English only.
3. Extract at build time from the pinned tarball with a script (no copy of `aide_cas` committed), keep only language `2`, and record the licence line in `THIRD_PARTY.md`.
4. The README's wording ("the file is GPL" but "the French part is not") is internally inconsistent, so **ask B. Parisse to confirm** in the email that is already planned after the device measurements (not tonight): that the English entries of `aide_cas` may be redistributed in a GPL-3.0-or-later app.
5. The HP/Prime help text rule in CLAUDE.md is unaffected: Giac's help is Giac's own, and we never use HP manual text.
