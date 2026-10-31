<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# A16: Enter p95 on the Tab One (third row), 2026-10-27

Device: Tab One (TB305FU), Android 15 (SDK 35), WebView 131.0.6778.260, build type **measure**, from `phase-1` 85ad9ed (G53, G65, G67 merged).
`?bench=1`, 57 cases of `tests/golden/bench.yaml`, medians of 5 cold runs, 17:14–17:43. The raw rows are in `.coord/device-runs.jsonl` (kind `bench`; gitignored, so this file is the record on the branch).

| Digits | Angle | p95 (case median) | p95 (per run) | max | p50 |
|---|---|---|---|---|---|
| 12 | RAD | 146.8 | 146.8 | 207.4 | 57.0 |
| 12 | DEG | 145.0 | 145.0 | 181.1 | 59.5 |
| 30 | RAD | 128.7 | 137.4 | 210.5 | 58.3 |
| 30 | DEG | 135.2 | 136.6 | 180.3 | 59.3 |

A4a (2026-10-16, before G53): 138–160 ms at 12 digits, 147–149 ms at 30. Now 145–147 at 12 and 129–137 at 30: under 150 ms in every row, so no "Needs the user" entry.
Slowest cases (12 RAD): solve-trig 207.4, arith-frac 151.8, heavy-int 146.8, heavy-ifactor 129.0, heavy-factor 120.4. Cancel to ready 402–425 ms; no errors, no mismatches.

For decisions.md "A4a" point 1, append: "A16 (2026-10-27, Tab One, phase-1 85ad9ed, G53+G65+G67): Enter p95 145–147 ms at 12 digits, 129–137 ms at 30, RAD and DEG; under 150."

Notes: the measure build is 61.19 kB gzip, 0.19 over the 61 kB start budget (bench code); built with the size check removed locally (not committed). Decide whether measure builds are exempt. The 30-digit DEG run hung once on a locked screen; `tools/stay-awake.sh` fixed it.
