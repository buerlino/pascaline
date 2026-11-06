# SPDX-License-Identifier: GPL-3.0-or-later
"""Stitch a showcase take (tools/showcase/record.sh) into the screen video Blender needs (tests/core/SHOWCASE.md "Next").

    python3 -I tools/showcase/stitch.py <take dir> [--end 105] [--preview ~/Music/n62-beat-preview.mp3] [--no-intra]

Reads <take>/<clip>.mp4 and <clip>.json (the page's own times: the flash, each pointerdown, the result's frame) and
tests/core/showcase-timeline.json. Per clip:
  - the flash: the frame where the page is white; its top row is the page's top on screen (the status bar above it);
  - each press's response: the first frame, from the page clock's prediction on, where a large part of the page
    changes (the key's highlight and the new character come together, on the lift; a caret blink is too small);
  - the clip's offset: the median of (beat - response) over its presses (the eval left out when it was pressed early),
    so the presses land on their beats, shifted earlier by the measured delay;
  - the result: the first large change from the page's result frame on; how late it shows after beat 7.
The output: frame 0 = song 17.000 s, constant 60 fps; each clip takes over on the gap beat (beat 8) of the block
before its first (block 1 from 17.000), the last one holds to the end; a clip missing from the take is filled by
holding the frame before it. screen.mp4 (H.264 CRF 16) and screen-intra.mp4 (CRF 12, every frame a keyframe), both
BT.709 (screenrecord writes BT.601: the matrix is converted, then tagged). report.md: the delays per clip and press;
advance.json: the ms to press each late eval early in the next take (record.sh --advance); check.mp4: screen.mp4 with
the beat preview; check-<clip>.png: the frames at a few beats. Holds the host-cpu lock while it encodes.
Needs ffmpeg/ffprobe and numpy.
"""
import argparse
import json
import os
import statistics
import subprocess
import sys
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[2]
W, H = 1116, 2484  # the Fairphone 6's screen
FPS = 60
SONG0 = 17.0
CHANGED_PX = 2500  # pixels (of the page area) that differ by > 24 grey levels: a press or a result, not a caret blink
LATE_OK = 2 / FPS  # a result up to 2 frames after beat 7 is on the beat
WRONG_MATCH = 0.08  # s: a response this far from the clip's shift is not the press's own


def probe_pts(mp4):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "frame=pts_time", "-of", "csv=p=0", str(mp4)],
                         capture_output=True, text=True, check=True).stdout.split()
    return [float(x) for x in out]


def frames(mp4, fmt):
    """Every frame as stored (no rate change), raw: gray or yuv420p."""
    size = W * H if fmt == "gray" else W * H * 3 // 2
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", str(mp4), "-map", "0:v:0", "-fps_mode", "passthrough", "-enc_time_base", "demux",
                          "-f", "rawvideo", "-pix_fmt", fmt, "-"], stdout=subprocess.PIPE)
    try:
        while True:
            b = p.stdout.read(size)
            if len(b) < size:
                break
            yield b
    finally:  # a reader that stops early: no broken-pipe noise
        p.kill()
        p.wait()


class Clip:
    def __init__(self, take, rec, beats):
        self.id = rec["id"]
        self.rec = rec
        self.mp4 = take / f"{self.id}.mp4"
        self.pts = probe_pts(self.mp4)
        # one pass, two frames in memory: the white share (the flash) and the pixels changed since the frame before
        # (the whole screen: in demo mode the status bar does not change)
        # and the pixels changed inside the box where the page drew the result (once the flash has placed the page)
        white, changed, in_box, prev, self.top, box = [], [], [], None, None, None
        rb, dpr = rec["page"].get("resultBox"), rec["view"]["dpr"]
        for b in frames(self.mp4, "gray"):
            f = np.frombuffer(b, np.uint8).reshape(H, W)
            w = f > 200
            white.append(w.mean())
            if self.top is None and white[-1] > 0.8:
                self.top = int(np.where(w.mean(1) > 0.95)[0].min())  # the page's top row on screen
                if rb:
                    box = (slice(max(0, int(self.top + rb["y"] * dpr)), min(H, int(self.top + (rb["y"] + rb["height"]) * dpr) + 1)),
                           slice(max(0, int(rb["x"] * dpr)), min(W, int((rb["x"] + rb["width"]) * dpr) + 1)))
            f = f.astype(np.int16)
            d = None if prev is None else np.abs(f - prev) > 24
            changed.append(0 if d is None else int(d.sum()))
            in_box.append(0 if d is None or box is None else int(d[box].sum()))
            prev = f
        if len(white) != len(self.pts):
            sys.exit(f"{self.id}: {len(white)} frames decoded, {len(self.pts)} timestamps")
        if self.top is None:
            sys.exit(f"{self.id}: no flash frame")
        self.flash_i = next(i for i, x in enumerate(white) if x > 0.8)
        self.flash_end = self.pts[self.flash_i + 1]  # the first frame after the flash
        page = rec["page"]
        tf = self.pts[self.flash_i]
        self.v = lambda pt: tf + (pt - page["flash"]) / 1000  # page clock -> video time

        def response(t_from, t_to):
            for j in range(1, len(self.pts)):
                if self.pts[j] >= t_from - 0.02 and changed[j] > CHANGED_PX:
                    return self.pts[j] if self.pts[j] <= t_to else None
            return None

        downs = page["downs"]
        n = len(rec["steps"])
        if len(downs) != n:
            sys.exit(f"{self.id}: {len(downs)} pointerdowns for {n} presses")
        self.beats = rec["beats"]
        self.pred = [self.v(d) for d in downs]
        self.resp = [response(p, p + 0.3) for p in self.pred]
        use = range(n - 1) if rec.get("advance") else range(n)
        diffs = [self.beats[i] - self.resp[i] for i in use if self.resp[i] is not None]
        if len(diffs) < 3:
            sys.exit(f"{self.id}: only {len(diffs)} presses seen in the video")
        self.offset = statistics.median(diffs)  # one shift for the clip: song time = video time + offset
        self.result = None
        if page.get("result") is not None and box is not None:
            # the first change inside the result's box after the eval's own response (Enter moves the entry line, which
            # can cross the box), near the page's own result frame (the page clock maps to the video within some 30 ms;
            # the unit view's "Working…" in the same box comes earlier); none: the result came with the response
            area = (box[0].stop - box[0].start) * (box[1].stop - box[1].start)
            t_page = self.v(page["result"])
            after = self.resp[-1] if self.resp[-1] is not None else self.pred[-1]
            self.result = next((self.pts[j] for j in range(1, len(self.pts))
                                if self.pts[j] > after and t_page - 0.06 <= self.pts[j] <= t_page + 0.15 and in_box[j] > max(150, 0.02 * area)), self.resp[-1])
        elif page.get("result") is not None:
            self.result = response(self.v(page["result"]), self.pts[-1])
        # the time map: each press's response on its beat, the eval's result on beat 7 (when seen; else its response);
        # straight lines between, the clip's own speed outside. A response far off the clip's shift is a wrong match.
        anchors = [(self.beats[i], self.resp[i]) for i in range(n - 1) if self.resp[i] is not None]
        last = self.result if self.result is not None else self.resp[-1]
        if last is not None:
            anchors.append((self.beats[-1], last))
        self.anchors = [(b, r) for b, r in anchors if abs(b - r - self.offset) <= WRONG_MATCH]
        self.dropped = len(anchors) - len(self.anchors)
        sb, vb = np.array([a[0] for a in self.anchors]), np.array([a[1] for a in self.anchors])
        if np.any(np.diff(vb) <= 0):
            sys.exit(f"{self.id}: the responses are out of order")
        self.speed = np.diff(sb) / np.diff(vb)  # song s per video s between anchors (1 = no stretch)
        self.to_video = lambda s: float(np.interp(s, sb, vb, left=s - (sb[0] - vb[0]), right=s - (sb[-1] - vb[-1])))
        # the takeover: beat 8 of the block before the first; block 1 from the start
        first = rec["blocks"][0]
        blocks = [b["block"] for b in beats if b["kind"] == "gap"]
        before = None if first == 1 else (28 if first == "finale" else blocks[blocks.index(first) - 1])
        self.start = SONG0 if before is None else next(b["t"] for b in beats if b["block"] == before and b["kind"] == "gap")
        if self.to_video(self.start) < self.flash_end + 0.05:
            sys.exit(f"{self.id}: the takeover at song {self.start:.3f} s would show the flash (record a longer lead)")

    def report(self):
        resp_ms = ["-" if r is None else f"{(r + self.offset - b) * 1000:+.0f}" for r, b in zip(self.resp, self.beats)]
        delay = [round((r - p) * 1000) for r, p in zip(self.resp, self.pred) if r is not None]
        late = None if self.result is None else self.result + self.offset - self.beats[-1]
        stretch = round(float(np.max(np.abs(self.speed - 1))) * 100) if len(self.speed) else 0
        return {"id": self.id, "offset": self.offset, "start": self.start, "resp_ms": resp_ms, "delay_ms": delay, "result_late_ms": None if late is None else round(late * 1000),
                # the next take's early eval: this one's, corrected by how far the result missed beat 7 (both ways)
                "advance_ms": max(0, round((late + self.rec.get("advance", 0) / 1000) * 1000)) if late is not None and abs(late) > LATE_OK else self.rec.get("advance", 0),
                "anchors": len(self.anchors), "dropped": self.dropped, "stretch_pct": stretch}


def lock(action):
    if os.environ.get("NO_LOCK") == "1":
        return
    args = [str(REPO / "tools/devlock.sh"), action, "host-cpu", f"showcase-stitch-{os.getpid()}"] + (["1800"] if action == "acquire" else [])
    if subprocess.run(args).returncode != 0 and action == "acquire":
        sys.exit("host-cpu busy")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("take", type=Path)
    ap.add_argument("--end", type=float, default=105.0, help="song time the output ends (a short test)")
    ap.add_argument("--preview", type=Path, default=Path.home() / "Music/n62-beat-preview.mp3")
    ap.add_argument("--no-intra", action="store_true")
    a = ap.parse_args()
    take = a.take.resolve()
    beats = json.loads((REPO / "tests/core/showcase-timeline.json").read_text())
    recs = [json.loads(p.read_text()) for p in sorted(take.glob("*.json")) if p.name != "advance.json"]
    recs = [r for r in recs if "steps" in r]
    clips = sorted((Clip(take, r, beats) for r in recs), key=lambda c: c.start)
    if not clips:
        sys.exit("no clips in the take")
    reps = [c.report() for c in clips]

    nframes = round((a.end - SONG0) * FPS)
    out = take / "screen.mp4"
    intra = take / "screen-intra.mp4"
    vf = ("scale=in_color_matrix=bt601:out_color_matrix=bt709:in_range=tv:out_range=tv,"
          "setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv")
    tags = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"]
    enc = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "yuv420p", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-vf", vf, "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", *tags, "-movflags", "+faststart", str(out)]
    if not a.no_intra:
        enc += ["-vf", vf, "-c:v", "libx264", "-preset", "medium", "-crf", "12", "-g", "1", "-pix_fmt", "yuv420p", *tags, "-movflags", "+faststart", str(intra)]
    lock("acquire")
    try:
        p = subprocess.Popen(enc, stdin=subprocess.PIPE)
        held = None
        j = 0
        for k, c in enumerate(clips):
            stop = clips[k + 1].start if k + 1 < len(clips) else a.end
            src = frames(c.mp4, "yuv420p")
            cur, nxt, idx = next(src), next(src, None), 0
            while j < nframes:
                s = SONG0 + (j + 0.5) / FPS  # the frame's middle: a change shows on the nearest frame
                if s >= stop and k + 1 < len(clips):
                    break
                vt = c.to_video(max(s, c.start))  # before a partial take's first clip: its takeover frame holds
                while nxt is not None and idx + 1 < len(c.pts) and c.pts[idx + 1] <= vt:
                    cur, nxt, idx = nxt, next(src, None), idx + 1
                p.stdin.write(cur)
                held = cur
                j += 1
            src.close()
        while j < nframes and held is not None:
            p.stdin.write(held)
            j += 1
        p.stdin.close()
        if p.wait() != 0:
            sys.exit("ffmpeg failed")
    finally:
        lock("release")

    lines = ["# Showcase take: delays", "", f"Take `{take}`; output frame 0 = song {SONG0:.3f} s, {FPS} fps, {nframes} frames.",
             "Response: the first large change on screen after the touch-down (the key's highlight and the character, on the lift).",
             "Per press: where the response would land against its beat with one shift for the clip (ms; 0 = on the beat; - = no",
             "large change: a pad key's caret step, a lazily loaded sheet). The output maps time so that every seen press is on its",
             "beat and the result on beat 7 (anchors); stretch: the largest speed change between anchors.", "",
             "| Clip | Takeover (song s) | Down → response (ms, min–median–max) | Response vs beat, one shift (ms) | Result after beat 7, one shift (ms) | Anchors (dropped) | Stretch | Advance next take (ms) |",
             "|---|---|---|---|---|---|---|---|"]
    for r in reps:
        d = r["delay_ms"]
        lines.append(f"| {r['id']} | {r['start']:.3f} | {min(d)}–{statistics.median(d):.0f}–{max(d)} | {' '.join(r['resp_ms'])} | "
                     f"{'-' if r['result_late_ms'] is None else r['result_late_ms']} | {r['anchors']} ({r['dropped']}) | {r['stretch_pct']} % | {r['advance_ms'] or '-'} |")
    # the output itself, read back: for every beat of every clip, the nearest frame where the screen changes (a quarter
    # of the size; 0 = on the beat's frame; . = no large change within 4 frames: a pad key's caret step)
    small = subprocess.run(["ffmpeg", "-v", "error", "-i", str(out), "-vf", "scale=279:621", "-f", "rawvideo", "-pix_fmt", "gray", "-"],
                           capture_output=True, check=True).stdout
    g = np.frombuffer(small, np.uint8).reshape(-1, 621, 279).astype(np.int16)
    ch = np.r_[0, (np.abs(np.diff(g, axis=0)) > 24).sum(axis=(1, 2))]
    del g
    lines += ["", "Read back from screen.mp4: per beat, the frame of the nearest screen change against the beat's frame.", ""]
    worst = 0
    for c in clips:
        offs = []
        for b in c.beats:
            k = round((b - SONG0) * FPS)
            near = [j for j in range(k - 4, k + 5) if 0 <= j < len(ch) and ch[j] > 150]
            if near:
                o = min(near, key=lambda j: abs(j - k)) - k
                worst = max(worst, abs(o))
                offs.append(f"{o:+d}")
            else:
                offs.append(".")
        lines.append(f"- {c.id}: {' '.join(offs)}")
    lines.append(f"\nOUTPUT SYNC: worst {worst} frame(s) off the beat")
    (take / "report.md").write_text("\n".join(lines) + "\n")
    (take / "advance.json").write_text(json.dumps({r["id"]: r["advance_ms"] for r in reps if r["advance_ms"]}, indent=1) + "\n")
    print("\n".join(lines))

    if a.preview.exists():
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(out), "-i", str(a.preview), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac",
                        "-shortest", str(take / "check.mp4")], check=True)
    # the frames at the first press and the eval of each clip, with the frame before each (a look at the sync)
    for c in clips:
        picks = []
        for t in (c.beats[0], c.beats[-1]):
            f = round((t - SONG0) * FPS)
            picks += [f - 1, f]
        sel = "+".join(f"eq(n\\,{f})" for f in picks if 0 <= f < nframes)
        if len(picks) != sel.count("eq("):
            continue  # past --end
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(out), "-vf", f"select={sel},scale=279:-1,tile=4x1", "-frames:v", "1", "-update", "1",
                        str(take / f"check-{c.id}.png")], check=True)
    print(f"wrote {out}{'' if a.no_intra else ', ' + str(intra)}, report.md, advance.json, check.mp4, check-<clip>.png")


if __name__ == "__main__":
    main()
