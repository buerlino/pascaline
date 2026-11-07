<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Showcase video (owner, 2026-11-06)

A beat-synced showcase: the app pressed by a script on the song's kicks, recorded on the phone, put on a 3D phone in
Blender. The song is the owner's (the first 2 min of a DJ set, not in the repo). The video uses **17–69.23 s** (the
owner's v6 cut, 2026-11-07: blocks 1–17); the beat grid runs on to 105 s.
The keys of every clip are in [showcase.yaml](showcase.yaml) (one press per step); the beat times in
`showcase-timeline.json`, made by [tools/showcase/](../../tools/showcase/).

## Structure

The grid is **28 blocks of 8 beats** (17.9–97.4 s, 140 → 199 BPM), then a finale (97.4–103.5 s):

- block: beats 1–6 kicks (presses), beat 7 the crash (the eval), beat 8 a gap (the cut to the next clip);
- **short clip** = 6 presses + eval (one block); **long clip** = 13 presses + eval (two blocks; beat 7 of the first
  block is a plain press, its beat 8 has none); a **finale** would be 20 presses + eval on the last kick before the
  breakdown;
- the v6 cut: 7 short + 5 long = 12 clips on blocks 1–17 (S L S S L L S S S L L S), ending on block 17's gap
  (69.230 s). Fills (beats 1–6 without a kick) in it: block 14 (5 of 6); the presses follow the grid there.
- `showcase-timeline.json`: every block's beats 1–8 (`kind` press, `eval/extra`, `gap`) and the finale's 20 presses
  and eval; `t` in song seconds. `crash_heard` on beat 7: a crash was detected (blocks 2–6 and 10 only; the detection
  is weak, the eval is on beat 7 either way).

## Clips and chapters

The chapters are N62's five selling points (owner, 2026-11-07); every clip proves its chapter's headline. Units come
before the HP layout because the slot kinds are fixed. The headlines and the captions with their Blender frames:
`~/SY99/n62-showcase/selling-points/` (README.md, captions.csv).

| Chapter (headline) | Blocks | Clip | Result |
|---|---|---|---|
| 1,000+ functions | 1 | s7: d/dx x² (CAS) | `2x` |
| | 2–3 | F: solve(x² = 16) from Find (CAS) | `{-4,4}` |
| | 4 | s5: √200 (CAS) | `10√2` |
| Up to 30 digits | 5 | s13: the digits chip 12 → 30, then √2 | `≈ 1.41421356237309504880168872421` |
| | 6–7 | K: π, then e^(π√163), at 30 digits | `≈ 262537412640768743.999999999999` |
| HP Prime key layout | 8–9 | A: Σ K², K = 1 to 10 | `= 385` |
| | 10 / 11 | s10 / s11: F1 = x³ − 2 / Plot, Root | `x = 1.25992104989` |
| 400+ units, 70+ constants | 12 | s8: 5 kg → lb | `≈ 11.0231131092 lb` |
| | 13–14 | U: 500 m in 40 ± 1 s | `12.50 ± 0.31 m/s` |
| | 15–16 | E: 72.25 kg × g₀ | `708.5304625 N` |
| Free & offline | 17 | s6: e^(iπ) | `= -1` |

A tap on the status line's digits chip opens the Digits list (4, 6, 8, 10, 12, 15, 20, 25, 30): `9` picks 30. Each
clip starts from a cleared app, so K sets 30 digits in its setup. The chapter themes are open (owner).

Between the beats: each clip's setup (CAS, an app, the digits) is recorded before its first press and cut away, so
the screen changes on the gap beat. A chapter change is a camera move plus the headline. In Blender: short clips
straight on with hard cuts; long clips a slow push-in; big moves in the fills; a caption of the result on each eval
beat.

## Check

`SHOWCASE=1 PW_PORT=<free port> GIAC_OUT=<abs dir> npx playwright test test/showcase.spec.ts` (from `app/`, under
`host-cpu`): every clip at its blocks' beat times; fails on a wrong press count, a wrong result, or a press more
than 80 ms after its beat, or a result not on screen before the cut (the next beat after the eval, 267–441 ms
later; a flick eval starts `lead` ms before its beat). 2026-11-07 on the selling-points list (phase-1 b8ea3bd7):
12/12.

## Next

1. **Recorder** (`tools/showcase/record.sh` and `stitch.py`, how they work in
   [tools/showcase/README.md](../../tools/showcase/README.md)): per clip, `adb shell screenrecord` on the phone, a
   full-screen flash as the sync mark, then 2 s of clean screen, the presses on the beat (a real touch over CDP:
   down, 70 ms, up), the file pulled. No tap dots. Android demo mode (fixed clock, full battery, no notifications).
   The screen answers 80–180 ms after the touch-down (highlight and character together, on the lift), varying up to
   70 ms within a clip, so the stitch maps time per press (at most ~20 % faster or slower between presses, on a
   still screen). A pad key (`right`) shows no highlight, only the caret's step.
   **The stitch, as Blender needs it:**
   - frame 0 = song time 17.000 s, constant **60 fps**; the v6 cut is `--end 71.2334`: 3254 frames, the video's
     last frame Blender 3134 plus a 120-frame handle; the Fairphone's 1116×2484;
   - every event on the **nearest** frame: video frame (0-based) = round((t − 17.0) × 60), Blender frame = that + 1;
     for each switch, press and eval (block 1's gap, 20.956 s, is frame 237). Blender cuts on the same frame;
   - each clip takes over on the gap beat (beat 8) of the block before it, so one beat of clean screen precedes its
     first press; the flash never reaches the output; the last clip holds to the end;
   - two files: `screen.mp4` (H.264) and `screen-intra.mp4` (`libx264 -crf 12 -g 1`), both tagged bt709; the
     all-intra one is the final, delivered as `~/SY99/n62-showcase/input/screen.mp4` (the owner's Blender project;
     its `input/` holds copies of the yaml and the timeline: this repo is the source);
   - an eval whose result shows late is pressed earlier in the next take (`record.sh --advance`, the stitch's
     `advance.json`); a flick eval (s8, U) starts early enough that its result shows before the cut (`lead`).
   **Preview take** (2026-11-07, Fairphone 6, the test build of 2026-11-06 19:19): 12/12 results right, every press
   within 1 ms of its beat on the host; `OUTPUT SYNC: worst 4` (s11's result, the read-back taking the wrong change),
   every press 0–1 frames off; stretch at most 17 % (A); U's result 249 ms after beat 7 (the unit view's "Working…"
   line). The take `~/.cache/n62/showcase/take-2026-11-07-sellpoints/` is `input/screen.mp4`. Both locks matter:
   `record.sh` and `stitch.py` take `host-cpu` themselves, and the phone (a PIN) must stay awake while they wait.
2. **Final take** Sat 11-14 on the release candidate of v0.1.0 (release Sun 11-15), after the UI rows (R140–R150,
   R53) and the queue have merged.
3. **Blender** (owner): the screen plane, the camera keys, the song in the Video Editor from 17 s.

Found on the way (no backlog line yet unless named):
- **History rows show `\exponentialE` and `\imaginaryI` raw, in red** (clips K and s6): `app/src/render/Math.svelte`
  passes `{ macros: ENTRY_MACROS }` to MathLive's `convertLatexToMarkup`, which replaces MathLive's own macros
  (checked in Node: `\exponentialE^{\imaginaryI\pi}` draws without the option, raw with any `macros`); the entry
  line merges them (`entry/field.ts`). Every user with an e or i in a row sees it.
- **A 30-digit Home result does not fit its row** on the Fairphone: grouped, it is about 39 characters and fades out
  after about 27, so K's nines are off screen (the captions carry them).
- iⁱ cannot be typed (backlog F184); F1 = p(x) − 2 does not work in the Function app (the trace shows `(0)->-2`,
  Root fails).
