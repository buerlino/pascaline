// SPDX-License-Identifier: GPL-3.0-or-later
// A stand-in Python engine for UI work and tests (?engine=fake). It understands just enough to drive the
// Python app: print of a literal or a+b, `while True` (runs until Cancel), `raise Name` (an error with its
// line), and the drawing calls line/circle/fillrect/clear (graphics batches). Everything else is ignored.
import { PythonCancelled, type GfxCmd, type PyOutput, type PyResult, type PyTimings, type PythonEngine } from "../python/types.ts";

const TIMINGS: PyTimings = { loadMs: 0, readyMs: 0 };

export class FakePython implements PythonEngine {
  private out = new Set<(o: PyOutput) => void>();
  private gfx = new Set<(b: GfxCmd[]) => void>();
  private stop: (() => void) | undefined;

  ready(): Promise<PyTimings> {
    return Promise.resolve(TIMINGS);
  }
  run(code: string): Promise<PyResult> {
    return this.exec(code);
  }
  shell(line: string): Promise<PyResult> {
    return this.exec(line);
  }
  cancel(): Promise<PyTimings> {
    this.stop?.();
    return Promise.resolve(TIMINGS);
  }
  onOutput(cb: (o: PyOutput) => void): () => void {
    this.out.add(cb);
    return () => this.out.delete(cb);
  }
  onGraphics(cb: (batch: GfxCmd[]) => void): () => void {
    this.gfx.add(cb);
    return () => this.gfx.delete(cb);
  }
  dispose(): void {
    this.out.clear();
    this.gfx.clear();
  }

  private write(stream: PyOutput["stream"], text: string): void {
    for (const cb of this.out) cb({ stream, text });
  }

  private async exec(code: string): Promise<PyResult> {
    await Promise.resolve();
    const batch: GfxCmd[] = [];
    const lines = code.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const s = (lines[i] as string).trim();
      const num = (a: string): number[] => a.split(",").map((v) => Number(v.trim()));
      let m: RegExpExecArray | null;
      if (/^while True\s*:/.test(s))
        return new Promise((_, reject) => (this.stop = () => reject(new PythonCancelled())));
      if ((m = /^print\((.*)\)$/.exec(s))) {
        const arg = (m[1] as string).trim();
        const sum = /^(-?\d+)\s*\+\s*(-?\d+)$/.exec(arg);
        const text = sum ? String(Number(sum[1]) + Number(sum[2])) : arg.replace(/^["'](.*)["']$/, "$1");
        this.write("stdout", `${text}\n`);
      } else if ((m = /^raise (\w+)/.exec(s))) {
        const tb = `Traceback (most recent call last):\n  File "<stdin>", line ${i + 1}\n${m[1]}: fake\n`;
        this.write("stderr", tb);
        return { ok: false, ms: 0, error: { type: m[1] as string, message: "fake", line: i + 1, traceback: tb } };
      } else if ((m = /^line\((.*)\)$/.exec(s))) batch.push(["line", ...(num(m[1] as string) as [number, number, number, number, number])]);
      else if ((m = /^circle\((.*)\)$/.exec(s))) batch.push(["circle", ...(num(m[1] as string) as [number, number, number, number])]);
      else if ((m = /^fillrect\((.*)\)$/.exec(s))) batch.push(["fillrect", ...(num(m[1] as string) as [number, number, number, number, number])]);
      else if ((m = /^clear\((.*)\)$/.exec(s))) batch.push(["clear", Number(m[1] || 0xffffff)]);
    }
    if (batch.length) for (const cb of this.gfx) cb([...batch, ["show"]]);
    return { ok: true, ms: 0 };
  }
}
