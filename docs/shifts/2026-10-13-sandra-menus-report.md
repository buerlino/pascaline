<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# S2 report: menu audit (sandra, 2026-10-13)

Package S2 of the brief, branch `p1/sandra-m4a-menus`, from `phase-1` at `04e0c0b`. Read and probe; no feature code.
The note: [docs/research/r8-menus.md](../research/r8-menus.md).

## Recommendation
Keep R7's sheet as it is and adopt seven menu rules (r8 section 5). In practice: R11 builds the Home/CAS Menu as one
fixed nine-item list that acts on the picked row (else the last result); R15 keeps a key path to Mode (Shift + Apps)
and lists Home and CAS first in Apps; "Decimals in Fixed" moves from Mode to Settings; R18 builds both palettes as
briefed, with Esc/Cancel and the remembered pick; R4 lets digits pick on Find's empty query. R10's palette stays.

## Verified (evidence in r8)
- Every menu, sheet and list, with its entry keys, items, picking and G2 counterpart, from the code at `04e0c0b`
  (r8 section 1).
- Presses per task (r8 section 2), each from code or an e2e test that presses the sequence; G2 columns only where
  `spec/mapping/vc-2026-10-11/` records them.
- Grid costs from the new probe `tools/probes/menu-presses.mjs` (copy of the sheet's grid moves): Tmpl by keys median
  4, max 6, touch 2; Shift + 6 by the key at its place 3 (flick 2); Shift + 9 by keys median 6, max 8, touch 3.
- **I1 (high): the Menu key ignores a picked history row** and copies the last result (`App.svelte:179-209`,
  `clipboard/actions.svelte.ts:57-61`), while Shift + View copies the picked row. From the code; R11 should add the
  e2e first (rules: regression test first).
- **I9 (high for R15):** after R15 no key reaches Mode, Settings, Home or CAS.
- The "3-key" Mode paths are 4 presses under docs/04 5.2 (the tests press `shift`, `cas`, `right`, `enter`).

## Changed
- `docs/research/r8-menus.md` (new): the audit, the rules, what each package changes, the decision proposal.
- `tools/probes/menu-presses.mjs` (new) and its row in `tools/probes/README.md`.
- `docs/05-ui-plan.md` 3.4 and table U4, `docs/decisions.md` defaults R8: "3 keys" corrected to 4 presses (docs
  disagreed with the tests and with docs/04 5.2).
- `docs/04-architecture.md` 5.1: the "Today" column of Tmpl, Shift + View, Menu, Shift + Menu and Shift + `+` was
  stale (built in R2, A3, R10); the Menu row names S2's proposal as "to decide".

## Accepted (owner, 2026-10-13): "yes to all of your recommendations"
Applied on this branch, so the review only checks and merges: decisions.md (P12 point A done; new Decided entry "S2: one menu system"), backlog.md (3a, R13, R18, S2 done, R15, R11), brief.md (S2 removed; the accepted items written into R13, R18, R15a/b, R11, R4; R13 now ~0.5 d with I1's fix, the Decimals move and the dead-key haptic), docs/06 point A, docs/04 5.1, G2 item 37 in `tests/golden/g2.yaml` with `G2-CHECKLIST.md` regenerated (`oracle.py --g2`: 0 problems). The proposal text below is kept as made.

## For shared files (as proposed; now applied)
- **docs/decisions.md, "Needs the user"**, as the first item:
  > - **2026-10-13 S2: one menu system (P12 open point A). PROPOSED, needs the user.** Seven rules for every menu
  >   (research/r8-menus.md section 5). **Recommendation:** (1) R11 builds the Home/CAS Menu as one fixed list (Insert,
  >   Recall, Copy, Store ▶, Delete, Copy as ›, Paste, Share session, Clear history) that acts on the picked row, else
  >   the last result: today Menu copies the last result even with a row picked (I1); (2) R15 keeps a key path to
  >   Mode (Shift + Apps) and lists Home and CAS first in Apps, so no place or setting needs touch; (3) "Decimals in
  >   Fixed" moves from Mode to Settings beside the Fixed tick; (4) R18 as briefed, plus Esc/Cancel and the remembered
  >   pick; (5) digits pick on Find's empty query (R4). R10's palette stays. **Cost:** inside R11 and R15 (~0.25 d),
  >   the Decimals move ~0.1 d; Copy as shown, exact and LaTeX take one press more. **Alternatives and would-change:**
  >   r8 section 8.

  And in the P12 open-points item, point A becomes: "A. **Menu audit: done** (S2, research/r8-menus.md); its proposal
  is the S2 item below."
- **docs/backlog.md "Needs the user"** (one line): "S2 menu rules (decisions.md, research/r8-menus.md): accept the
  nine-item Home/CAS Menu for R11 and the Mode key path and Home/CAS in Apps for R15."
- **docs/backlog.md** milestone 4a item 13 (S2): "*Done* (`<commit>`): research/r8-menus.md; proposal in decisions.md."
- **docs/06-keypad-vs-g2.md** section 4, point A: "**A. Menu audit: done** (S2, [research/r8-menus.md](research/r8-menus.md));
  the proposal waits for the owner (decisions.md)."
- **docs/shifts/brief.md:** remove the S2 row and section; add to R11, R15a and R18 "If the owner accepts S2, build
  r8 section 6's row for this package."
- **tests/golden/g2.yaml**, new item 37 (then `oracle.py --g2`):
  `- { n: 37, area: "Keyboard", question: "In the Shift + 9 palette (symbols and Greek), is each cell labelled with a key that picks it, as in the Shift + 6 palette, or is it picked with the arrows and OK only?", why: "S2 rule M1: a grid that shows keys is picked by them; R18 builds Shift + 9 with arrows only", asked_by: "sandra (S2)", source: "assumed" }`

## Still to verify
- The G2 press counts marked (to verify) in r8 section 2: owner, on the G2.
- I1 in the running app: R11's first regression test.
- Shift + Apps for Mode: owner, on the R15 APK.

## Top risks
1. **I1 stays until R11:** a picked row copied through Menu gives the last result's value, with a "Copied" notice.
   R11 is several packages away (after R15b); if the owner copies rows through Menu now, pulling I1's fix forward
   into R13 (~0.1 d: pass the picked row to the Menu) is the cheap option.
2. R15 built without M6 would leave the PWA with no keyboard path to Mode, Settings, Home and CAS.
3. R18's ° with its own parser rule would make `30°` mean two things (DMS is degrees in every angle mode).
