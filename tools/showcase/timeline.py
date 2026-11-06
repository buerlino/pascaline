# SPDX-License-Identifier: GPL-3.0-or-later
"""Timeline for 17-105 s: 28 blocks of 8 beats from beat 49 (6 presses, beat 7 = eval or extra, beat 8 = gap: the cut)
crash_heard: a crash was detected on beat 7 (the detection is weak; the eval is on beat 7 either way),
then the finale on beats 273-292 with the eval on 293. Press times: the kick onset when there is one, else the grid.
Usage: timeline.py <audio> <outdir>"""
import json, sys
import numpy as np, librosa, soundfile as sf
src, out = sys.argv[1], sys.argv[2]
rows = json.load(open(f"{out}/grid.json"))
T = lambda n: rows[n]["snap"] if rows[n]["K"] else rows[n]["t"]
ev = []
for b in range(28):
    s = 49 + 8 * b
    for k in range(6): ev.append(dict(t=T(s + k), block=b + 1, beat=k + 1, kind="press", kick=rows[s + k]["K"]))
    ev.append(dict(t=T(s + 6), block=b + 1, beat=7, kind="eval/extra", kick=rows[s + 6]["K"], crash_heard=rows[s + 6]["C"]))
    ev.append(dict(t=T(s + 7), block=b + 1, beat=8, kind="gap", kick=rows[s + 7]["K"]))
for i, n in enumerate(range(273, 293)): ev.append(dict(t=T(n), block="finale", beat=i + 1, kind="press", kick=rows[n]["K"]))
ev.append(dict(t=T(293), block="finale", beat=21, kind="eval", kick=rows[293]["K"]))
json.dump(ev, open(f"{out}/timeline.json", "w"), indent=0)
print(f"events {len(ev)}; block 1 starts {ev[0]['t']:.3f}s; finale {T(273):.3f}-{T(293):.3f}s")
for b in range(28):
    e = [x for x in ev if x["block"] == b + 1]
    miss = sum(1 for x in e[:6] if not x["kick"])
    print(f"block {b+1:2d} {e[0]['t']:7.2f}s  {60/np.median(np.diff([x['t'] for x in e[:6]])):5.1f} BPM  "
          f"beat7 {e[6]['t']:7.2f}s{'  crash' if e[6].get('crash_heard') else ''}{f'  ({miss} presses without a kick)' if miss else ''}")
y, sr = librosa.load(src, sr=44100, mono=True, offset=17.0, duration=88.0)
y = 0.6 * y / np.max(np.abs(y))
tick = librosa.clicks(times=[x["t"] - 17 for x in ev if x["kind"] == "press"], sr=sr, length=len(y), click_freq=3000, click_duration=0.025)
boom = librosa.clicks(times=[x["t"] - 17 for x in ev if x["kind"] in ("eval/extra", "eval")], sr=sr, length=len(y), click_freq=800, click_duration=0.12)
sf.write(f"{out}/preview-17-105.wav", (y + 0.45 * tick + 0.7 * boom).astype(np.float32), sr)
print("wrote timeline.json, preview-17-105.wav")
