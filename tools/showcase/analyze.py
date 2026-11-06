# SPDX-License-Identifier: GPL-3.0-or-later
"""Beat analysis: kick-band onset envelope, local tempo, dynamic-tempo beat tracking. Usage: analyze.py <audio> <outdir>"""
import json, sys
import numpy as np, librosa

src, out = sys.argv[1], sys.argv[2]
y, sr = librosa.load(src, sr=22050, mono=True)
hop = 256
S = librosa.feature.melspectrogram(y=y, sr=sr, hop_length=hop, n_mels=64, fmax=8000)
mel_f = librosa.mel_frequencies(n_mels=64, fmax=8000)
kick = librosa.onset.onset_strength(S=librosa.power_to_db(S[mel_f < 150]), sr=sr, hop_length=hop)
full = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
# local tempo every frame (8 s window), range for hardcore
tempo_dyn = librosa.feature.tempo(onset_envelope=kick, sr=sr, hop_length=hop, aggregate=None,
                                  start_bpm=170, max_tempo=260, ac_size=8.0)
tempo_glob = librosa.feature.tempo(onset_envelope=kick, sr=sr, hop_length=hop, start_bpm=170, max_tempo=260)[0]
_, beats = librosa.beat.beat_track(onset_envelope=kick, sr=sr, hop_length=hop, bpm=tempo_dyn, units="time", tightness=200)
# energy over time (RMS dB per second) to find silent / breakdown parts
rms = librosa.feature.rms(y=y, hop_length=sr)[0]
db = 20*np.log10(rms + 1e-9)
ibi = np.diff(beats)
print(f"duration {len(y)/sr:.1f}s, global tempo {tempo_glob:.1f} BPM, beats {len(beats)}")
print(f"first beat {beats[0]:.2f}s, last {beats[-1]:.2f}s")
for t0 in range(0, 120, 10):
    sel = (beats[1:] >= t0) & (beats[1:] < t0+10)
    lt = tempo_dyn[int(t0*sr/hop):int((t0+10)*sr/hop)]
    bpm = 60/np.median(ibi[sel]) if sel.any() else float('nan')
    print(f"{t0:3d}-{t0+10:3d}s: beats {sel.sum():3d}, beat-BPM {bpm:6.1f}, local-tempo {np.median(lt):6.1f}, loudness {np.median(db[t0:t0+10]):6.1f} dB")
json.dump({"source": src, "beats": [round(float(b), 4) for b in beats],
           "tempo_dynamic": [[round(i*hop/sr, 2), round(float(t), 1)] for i, t in enumerate(tempo_dyn) if i % 86 == 0]},
          open(f"{out}/beats.json", "w"), indent=0)
# click preview: song + click on each beat
ys, srs = librosa.load(src, sr=44100, mono=True)
click = librosa.clicks(times=beats, sr=srs, length=len(ys), click_freq=2500, click_duration=0.03)
mix = 0.6*ys/np.max(np.abs(ys)) + 0.5*click
import soundfile as sf
sf.write(f"{out}/click-preview.wav", mix.astype(np.float32), srs)
print("wrote beats.json, click-preview.wav")
