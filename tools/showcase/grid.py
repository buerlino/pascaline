# SPDX-License-Identifier: GPL-3.0-or-later
"""Beat grid from the tracker, each beat snapped to the nearest kick onset; per beat: kick and crash strength.
Usage: grid.py <audio> <outdir>  (reads <outdir>/beats.json)"""
import json, sys
import numpy as np, librosa
src, out = sys.argv[1], sys.argv[2]
beats = np.array(json.load(open(f"{out}/beats.json"))["beats"])
y, sr = librosa.load(src, sr=22050, mono=True)
hop = 128
S = librosa.feature.melspectrogram(y=y, sr=sr, hop_length=hop, n_mels=96, fmax=11000)
f = librosa.mel_frequencies(n_mels=96, fmax=11000)
D = librosa.power_to_db(S)
kick = librosa.onset.onset_strength(S=D[f < 150], sr=sr, hop_length=hop)
hi = librosa.onset.onset_strength(S=D[f > 6000], sr=sr, hop_length=hop)
hi_level = D[f > 6000].mean(axis=0)            # sustained high energy (a crash rings)
fr = lambda t: int(round(t*sr/hop))
win = fr(0.045)
rows = []
for b in beats:
    i = fr(b); lo, hi_i = max(0, i-win), min(len(kick)-1, i+win)
    k = lo + int(np.argmax(kick[lo:hi_i+1]))
    rows.append(dict(t=float(b), snap=k*hop/sr, kick=float(kick[k]), crash=float(hi[lo:hi_i+1].max()),
                     ring=float(hi_level[i:i+fr(0.3)].mean() - hi_level[max(0,i-fr(0.3)):i].mean())))
kk = np.array([r["kick"] for r in rows]); cc = np.array([r["crash"] for r in rows]); rg = np.array([r["ring"] for r in rows])
kn = kk/np.percentile(kk, 90); cn = cc/np.percentile(cc, 99)
for r, a, c, g in zip(rows, kn, cn, rg):
    r["K"] = bool(a > 0.35); r["C"] = bool(c > 0.6 and g > 3)
line = ""
for n, r in enumerate(rows):
    if n % 32 == 0: line += f"\n{r['t']:6.1f}s #{n:3d} "
    line += "C" if r["C"] and r["K"] else "c" if r["C"] else "K" if r["K"] else "."
print("per beat: K kick, C crash on a kick, c crash without kick, . no kick" + line)
crashes = [n for n, r in enumerate(rows) if r["C"]]
print("\ncrash beats:", crashes)
print("beats between crashes:", list(np.diff(crashes)))
json.dump(rows, open(f"{out}/grid.json", "w"))
