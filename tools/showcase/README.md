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
