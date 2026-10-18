### annabell, A4b: Find timing on the Tab One, branch `p1/annabell-m4-find`
**Lane:** day (device). **Starts when:** R4b is merged and the Tab One is connected (rules section 6). Backlog step 12, its Find part.
**Read:** docs/04 3.2 and 8.3 (the per-key bar); `tools/README.md`; `tools/device_run.py`; `tools/page-series.py`; R4a's and R4b's reports (`?bench=find`).
- Find per key (`?bench=find`) against the §8.3 bar; a miss goes under "Needs a decision" with the number (docs/04 says what changes: incremental Find). Leave an APK built from `phase-1` on the Tab One for the owner. Then the report says whether milestone 4's gate (section 8) is complete.
**Done when:** the medians of ≥ 5 runs with device, Android, WebView and build type are in the report and in `.coord/device-runs.jsonl`; the backlog step 12 line and the milestone 4 gate line are ticked or the miss is a proposal in decisions.md.
