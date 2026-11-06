<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Showcase video (owner, 2026-11-06)

A beat-synced showcase: the app pressed by a script on the song's kicks, recorded on the phone, put on a 3D phone in
Blender. The song is the owner's (the first 2 min of a DJ set, not in the repo); the section used is **17–105 s**.
The keys of every clip are in [showcase.yaml](showcase.yaml) (one press per step); the beat times in
`showcase-timeline.json`, made by [tools/showcase/](../../tools/showcase/).

## Structure

The section is **28 blocks of 8 beats** (17.9–97.4 s, 140 → 199 BPM), then the finale (97.4–103.5 s):

- block: beats 1–6 kicks (presses), beat 7 the crash (the eval), beat 8 a gap (the cut to the next clip);
- **short clip** = 6 presses + eval (one block); **long clip** = 13 presses + eval (two blocks; beat 7 of the first
  block is a plain press, its beat 8 has none); **finale** = 20 presses + eval on the last kick before the breakdown;
- 10 short + 9 long = 28 blocks. Fills (beats 1–6 without a kick): block 14 (5 of 6), 20 (2), 24 (4), 26 (5),
  27 (6); the presses follow the grid there.
- `showcase-timeline.json`: every block's beats 1–8 (`kind` press, `eval/extra`, `gap`) and the finale's 20 presses
  and eval; `t` in song seconds. `crash_heard` on beat 7: a crash was detected (blocks 2–6 and 10 only; the detection
  is weak, the eval is on beat 7 either way).

## Clips and chapters

| Chapter (theme) | Blocks | Clip | Result |
|---|---|---|---|
| EXACT (N62) | 1 | 2/3 + 1, stacked (CAS) | `5/3` |
| | 2–3 | Σ K², K = 1 to 10 | `= 385` |
| | 4 / 5 | 2¹⁰⁰ in CAS / in Home | exact 31 digits / `≈ 1.26765060023E30` |
| | 6–7 | 6.022ᴇ23 × 1.25 | `= 7.5275E23` |
| | 8–9 | 0.375 × 0.0625, then a b/c | `3/128` |
| | 10 | √200 (CAS) | `10√2` |
| | 11 | e^(iπ) | `= -1` |
| UNITS (Teal) | 12–13 | 150 kg·m²/s³ → W | `150 W` |
| | 14 | 5 kg → lb | `≈ 11.0231131092 lb` |
| | 15 | 50 ± 1 m | `50.0 ± 1.0 m` |
| | 16–17 | 72.25 kg × g₀ | `708.5304625 N` |
| CAS (Solarized) | 18 | d/dx x² | `2x` |
| | 19–20 | solve(x² = 16) from Find | `{-4,4}` |
| | 21–22 | p(x):=x³ | stored |
| GRAPHS (N62) | 23–24 | Solve app: x² − 2x = 168 | `x = -12`, `x = 14` |
| | 25 / 26 | F1 = x³ − 2 / Plot, Root | `x = 1.25992104989` |
| | 27–28 | signed area of the same F1 on [0, 1] | `-1.75` |
| | finale | 3x + 2y = 8, x − 4y = −2 as A⁻¹·b | `[[2],[1]]` |

Between the beats: each clip's setup (CAS, an app, the theme) is recorded before its first press and cut away, so the
screen changes on the gap beat. A chapter change is a theme change plus a camera tilt and the chapter word.
In Blender: short clips straight on with hard cuts; long clips a slow push-in; big moves in the fills; a large
caption of the result on each eval beat.

## Check

`SHOWCASE=1 PW_PORT=<free port> GIAC_OUT=<abs dir> npx playwright test test/showcase.spec.ts` (from `app/`, under
`host-cpu`): every clip at its blocks' beat times; fails on a wrong press count, a wrong result, or a press more
than 80 ms after its beat, or a result not on screen before the cut (the next beat after the eval, 267–441 ms
later). 2026-11-06 on `a1715b54`: 20/20, presses within 6 ms, results 51–312 ms after their eval. Tight: s8 and s9
(301 and 312 ms of 348; their eval is a flick up on Enter, slower than a tap).

## Next

1. **Recorder** (built 2026-11-06: `tools/showcase/record.sh` and `stitch.py`, how they work in
   [tools/showcase/README.md](../../tools/showcase/README.md)): per clip, `adb shell screenrecord` on the phone, a
   full-screen flash as the sync mark, then 2 s of clean screen, the presses on the beat (a real touch over CDP:
   down, 70 ms, up), the file pulled. No tap dots. Android demo mode (fixed clock, full battery, no notifications).
   **Test take** (2026-11-06, Fairphone 6, the build of 11:40 before R139, clips s1, A, s8): 3/3 results right, every
   press within 1 ms of its beat on the host; the screen answers 80–180 ms after the touch-down (highlight and
   character together, on the lift), varying up to 70 ms within a clip, so the stitch maps time per press (at most
   ~20 % faster or slower between presses, on a still screen); read back from `screen.mp4`, every press that changes
   the screen is on its beat's frame (`OUTPUT SYNC: worst 0`). The result after the eval: CAS and Home about 50 ms
   (the eval pressed 52 / 37 ms early), the unit view (s8) about 170 ms, after a "Working…" line. A pad key (`right`)
   shows no highlight, only the caret's step. The take: `~/.cache/n62/showcase/test-take-2026-11-06/` (`check.mp4`
   with the beat preview). **The stitch, as Blender needs it:**
   - frame 0 = song time 17.000 s, constant **60 fps**, 5280 frames (88 s); the Fairphone's 1116×2484;
   - every event on the **nearest** frame: video frame (0-based) = round((t − 17.0) × 60), Blender frame = that + 1;
     for each switch, press and eval (block 1's gap, 20.956 s, is frame 237). Blender cuts on the same frame;
   - each clip takes over on the gap beat (beat 8) of the block before it, so one beat of clean screen precedes its
     first press; the flash never reaches the output; the last clip holds to the end;
   - two files: `screen.mp4` (H.264) and `screen-intra.mp4` (`libx264 -crf 12 -g 1`), both tagged bt709; the
     all-intra one is the final, delivered as `~/SY99/n62-showcase/input/screen.mp4` (the owner's Blender project;
     its `input/` holds copies of this file, the yaml and the timeline: this repo is the source);
   - measured from the recordings: the delay from each beat to the key's highlight and to the result on screen. The
     presses shift earlier by the measured highlight delay; an eval whose result shows more than 2 frames after
     beat 7 (CAS: 2¹⁰⁰, solve) is pressed that much earlier; a flick eval (s8, s9) starts early enough that its
     result shows on beat 7. The per-clip delays go in the run's report.
2. **Final take** Sat 11-14 on the release candidate of v0.1.0 (release Sun 11-15), after the UI rows (R140–R150,
   R53) and the queue have merged; per chapter theme.
3. **Blender** (owner): the screen plane, the camera keys, the song in the Video Editor from 17 s.

Found on the way: iⁱ cannot be typed (backlog F184); clip 11 shows e^(iπ) instead.
