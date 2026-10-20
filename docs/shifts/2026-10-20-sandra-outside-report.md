<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# S8 report: the outside-test protocol (sandra, 2026-10-20, pipeline run 110)

## Done
- **The note:** [research/r18-outside-test.md](../research/r18-outside-test.md). Named R18, not r12 as the package said: r12 is `r12-evidence.md` (docs/README.md:21) and r16 is in use. Two 30-minute rounds, three testers each from at least two fields (round 2 with new people where possible); round 1 after R4b, round 2 after R24c and before R24d's user cells; the ten tasks in engineering words (round 1: eight, t07 and t10 have no way yet), ten Find queries read as descriptions that avoid the name (each has its id in `find-queries.yaml`), five units on the pad (mm, µF, psi, °C, km/h; plan 10 presses with flicks, 13 with taps, derived from `spec/unit-pad.yaml`); recorded time, presses, misses, words typed, where they stopped; the script; privacy; rows back into feedback.md marked "outside".
- **The sheet:** [mockups/outside-test.html](../mockups/outside-test.html), one A4 page (checked: Chromium print to PDF gives 1 page).
- **Round 1 needs:** print the sheet on A4, one copy per tester plus one clean copy for the testers to read (4 copies); install the `phase-1` APK with R4b merged (`./build.sh`, `dist/pascaline.apk`) on a phone that is not the owner's daily copy (each tester starts with Clear storage); a watch for the time. Nothing else.

## Verified (file:line)
- The tap counter counts only Shift and Alpha taps (`app/src/App.svelte:533-537`, `app/src/state/taps.svelte.ts:2-3`), shown in Settings (`app/src/views/modeSheet.ts:169-175`); so presses in round 1 are the owner's tally.
- No INTERNET permission in the source manifest (`android/app/src/main/AndroidManifest.xml:41`, VIBRATE only); but `android:allowBackup="true"` (line 5): Android's backup may copy app data off the phone.
- Find stores nothing and has no usage boost (docs/04 3.5), so testers cannot change each other's ranking. docs/03 section 3 still says "ranked by recents and frequency first": out of date against docs/04 3.5 (P11).
- Expected results from `tests/tasks/tasks.yaml` with their sources; t09 to 12 digits from its 40-digit values.

## Still (to verify)
- The merged APK manifest has no INTERNET: annabell, `aapt2 dump permissions dist/pascaline.apk`.
- Whether the WebView's IndexedDB is in Android's Auto Backup: annabell, `adb shell bmgr backupnow io.github.buerlino.pascaline` then `adb shell dumpsys backup`.
- That the sheet's Find descriptions do not hand over the name: the first tester shows it.

## Shared-file text (for the next Opus pass)
- **docs/README.md** research list, after the r15 entry: `[research/r18-outside-test.md](research/r18-outside-test.md) (the outside test: two rounds, the script, the sheet [mockups/outside-test.html](mockups/outside-test.html))`.
- **docs/03-feature-analysis.md** section 3, "Mixed results with a kind badge": replace "Ranked by: recents and frequency first (the user's own habits), then exact name" with "Ranked with no usage boost (P11; docs/04 3.5): exact name".
- **docs/shifts/brief.md / packages:** if the owner accepts decisions.md "S8": a ron package "the press counter" (count every press as docs/04 5.2 in `TapCounter`, a Settings row beside Shift and Alpha, same reset; unit test, e2e that a flick and a screen tap count 1; before round 1) and an annabell package "`allowBackup=false`" (manifest attribute, the merged-manifest check above in `build.sh`).

## Top risks
- Round 1 without the press counter: long tasks (t09, about 50 presses) are tallied roughly.
- Android backup until it is off: the protocol covers it with flight mode and Clear storage after the last tester.
- Three people per round find problems, they do not measure them; the benchmark stays the gate.
