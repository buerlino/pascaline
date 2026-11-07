<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Showcase beat tools (developer only, not shipped)

Beat analysis for the showcase video ([tests/core/SHOWCASE.md](../../tests/core/SHOWCASE.md)). The song is not in
the repo. Python with the pinned [requirements.txt](requirements.txt), in a venv outside the repo:

```bash
python3 -m venv ~/.cache/n62-beatenv && ~/.cache/n62-beatenv/bin/pip install -r tools/showcase/requirements.txt
P=~/.cache/n62-beatenv/bin/python
$P -I tools/showcase/analyze.py <song.wav> <outdir>    # beats.json (dynamic-tempo tracker on the kick band), click preview
$P -I tools/showcase/grid.py <song.wav> <outdir>       # grid.json: each beat snapped to its kick, kick and crash per beat
$P -I tools/showcase/timeline.py <song.wav> <outdir>   # timeline.json (→ tests/core/showcase-timeline.json), preview wav
```

`timeline.py` holds this song's layout as constants: the section 17–105 s, block 1 at beat 49, 28 blocks of 8, the
finale on beats 273–293. Another song means new constants, read off `grid.py`'s map.

## Recording and stitching

The test build on the phone (`tools/device-build.sh --test --install`), Show taps off, the phone unlocked. Then:

```bash
tools/showcase/record.sh --clips s13,K [--out DIR] [--advance FILE]     # every clip of showcase.yaml without --clips; DIR default ~/.cache/n62/showcase/take-<time>
python3 -I tools/showcase/stitch.py DIR [--end 105] [--no-intra]       # numpy and ffmpeg; the v6 cut: --end 71.2334 (3254 frames, about 3 min under host-cpu)
```

`record.sh` holds the device lock (default `ANDROID_SERIAL` 4d42e62f) and `host-cpu`, keeps the screen on, puts the status
bar in demo mode (12:00, full battery, no notifications) and undoes all of it on exit (the screen back to `.orig.real`).
It runs `app/test-device/showcase.rec.ts` (its own config, `app/playwright.showcase.config.ts`, so the core list never
runs it). Per clip: `pm clear`, the setup untimed, each sheet the clip opens opened once (their code loads lazily),
`screenrecord` at 20 Mb/s, a white flash, 2 s of clean screen, then each press as a real touch on its beat (down,
70 ms, up: a key acts on the lift). The page logs its own times (flash, every pointerdown, the frame and the box of the
result) in `DIR/<clip>.json`; the test fails on a wrong result, a missing press, or a press more than 30 ms late.

`stitch.py` finds the flash (the page's place on screen), each press's response (the first large change: highlight and
character together) and the result (the first change inside its box after the eval's own response), and maps time
so that every seen press lands on its beat and the result on beat 7. It writes `screen.mp4` and `screen-intra.mp4`
(60 fps, `--end` gives the length, BT.709), `report.md` (the delays, the stretch, and the output read back: `OUTPUT SYNC: worst
N frame(s) off the beat`), `advance.json` (for `record.sh --advance`: an eval whose result shows late is pressed early
in the next take, which keeps the stretch small), `check.mp4` (with `~/Music/n62-beat-preview.mp3`) and
`check-<clip>.png` (the frame before and on beat 1 and beat 7).
