<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# v0.1.0: the bar and the dates

The owner, 2026-11-01: "I want to release a good version as 0.1.0, I'm in no rush; the only rush is 2026-11-17, when Claude Max runs out." This page holds what "good" means for v0.1.0 and the days to it. How a release is made is decisions.md "The release path" (and A8's release how-to once it is written); what is still open is in [backlog.md](backlog.md). Rewrite this page in place as items are met; it moves to the archive after the tag.

## The bar (all of it, on the commit that is tagged)
1. **The mechanics are proven early.** A7 and A8 merged; the throwaway tag `v0.0.1-test` ended in a pre-release whose APK verifies against `android/release-cert.sha256`, and it did **not** deploy the website (A8, step 2: a tag with a `-` skips Pages); `pascaline-calc.org` serves the Pages site; the `github-pages` environment allows `v*` (on 11-01 it allowed only `master`).
2. **The net is green.** `npm run gate`; `GOLDEN GATE PASSED` on the release engine (the release run checks it); CORE 66/66 on the desktop; CORE DEVICE 65/65 on the Tab One **and** the Fairphone; the owner's morning check clean on two mornings in a row (MORNING.md).
3. **No known silent wrong number at everyday reach.** Every open bug line of everyday reach that shows a wrong value without ⚠ is fixed: today F156 (`trunc` of a name becomes `floor`) and F157 (Ctrl+V in comma mode), and what the night reviews of 11-02, 11-06 and 11-09 file at that reach. F156's and F157's packages are written on 11-02, shown to the owner first, and run first in lane B (owner, 2026-11-01). Marked or cost-only lines (F73, F80, F85) may ship; the release notes name them.
4. **What is merged by the freeze ships; nothing new is started for it.** Find (milestone 4) with A4b's timing on the Tab One against docs/04 8.3 (a miss: the owner decides, with the number); the units as merged (R92 if it is built by then, not a gate). Milestone 6 is not in v0.1.0.
5. **The owner's look.** The milestone reviews (after R50e; after R24d) are done, and the owner has used the build for daily work for a few days with no blocker left in [feedback.md](feedback.md). One outside round (research/r18) if three testers can be found before 11-12; no gate.
6. **The words.** The release notes: what is in, the known limits (point 3's marked lines, no Function plots, no Structure), the engine and qalc hashes (A8); the README and the fastlane screenshots match the build; About (R87) names the version.
7. **The frozen-for-good names, checked once by hand:** the application id, `sw.js`'s path and scope, the IndexedDB name `pascaline`, the manifest `id` (decisions.md "The release path"). After the tag they never change.

## The days (2026; the owner took them on 2026-11-01)
| When | What | Who |
|---|---|---|
| Mon 11-02, by day | The release key off this laptop and A7's table; `v*` in Settings → Environments → `github-pages`; `pascaline-calc.org` already points to Pages (checked 11-01: Pages' four addresses, `www` to buerlino.github.io, a valid certificate; "Site not found" until the first deploy; this laptop's Tailscale DNS answers 0.0.0.0 for it, so allow it there to look); A7 runs. Night review 1. | owner, annabell |
| Tue 11-03, by day | A8 and the owner's test tag `v0.0.1-test` (point 1); then the test release and tag are deleted. | annabell, owner |
| 11-03 to Wed 11-11 | The lanes as brief section 0, with point 3's fixes first in lane B; A4b on the Tab One by day; the milestone reviews; night reviews 2 (Fri 11-06) and 3 (Mon 11-09). | lanes, owner |
| Thu 11-12 | **The freeze for v0.1.0:** from this night on both lanes run only fixes for the bar; the rest of the queues waits for v0.1.1. | owner |
| 11-12 to Sat 11-14 | Release-candidate nights on the Tab One and the Fairphone; the morning checks of 11-13 and 11-14; night review 4 (Fri 11-13) files only bar items. | lanes, owner |
| Sat 11-14, morning | **Go or slip:** the owner reads the bar. A missed item: fix it by 11-15, or ship with it named in the notes, or slip past 11-17 (the release is then made by hand from A8's release how-to). | owner |
| Sun 11-15, by day | Bump versionCode 1 / versionName 0.1.0 (A48's three files) in one commit; fast-forward `master` to `phase-1` and push; push the tag `v0.1.0`; check the APK's SHA-256 and certificate and the website. | owner |
| Mon 11-16 to Tue 11-17 | Room for a v0.1.1 while the lanes still run. | lanes, owner |

**Why this order:** the signing and the workflow are the only steps nobody has run yet, and after 11-17 they are the hardest to do alone, so they go first (11-02, 11-03), not on release day. The freeze three days before the tag gives two release-candidate nights and two morning checks on the same code. The tag on 11-15 leaves two days for a fix release.
