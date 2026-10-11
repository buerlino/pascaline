// SPDX-License-Identifier: GPL-3.0-or-later
// The Python app (milestone 3). Views: Symb = the script editor, Plot = the 320×240 graphics, Num = the
// shell. MicroPython loads when the app first opens (Calc.python(), its own worker); CodeMirror comes with
// this app's chunk. Run executes the current script with fresh globals and shows the shell; the shell keeps
// its globals between entries. Cancel stops a running script; the editor and shell keep their text.
import { t } from "../../i18n/index.ts";
import { PythonCancelled, type GfxCmd, type PyOutput, type PyResult, type PythonEngine } from "../../python/types.ts";
import type { AppHost, AppInstance, MenuItem, TextInput, ViewId } from "../types.ts";
import { GfxSurface } from "./canvas.ts";
import type { CodeView } from "./codeView.ts";

export interface Script {
  name: string;
  code: string;
}
interface Stored {
  scripts: Script[];
  current: number;
}
export interface Line {
  id: number;
  kind: "in" | "out" | "err" | "note";
  text: string;
}

/** Limits (defaults, docs/decisions.md): script size, number of scripts, and the shell transcript kept. */
export const MAX_SCRIPT_CHARS = 64 * 1024;
export const MAX_SCRIPTS = 50;
export const MAX_TRANSCRIPT_CHARS = 64 * 1024;
const SHELL_HISTORY = 50;

const NEW_SCRIPT = "";
const KEYWORDS: readonly [string, string][] = [
  ["def", "def "],
  ["if", "if "],
  ["for … in range", "for i in range("],
  ["while", "while "],
  ["return", "return "],
  ["print", "print("],
  ["import calc", "import calc\n"],
  ["else", "else:"],
  ["elif", "elif "],
  ["True", "True"],
  ["False", "False"],
  ["None", "None"],
  ["and", " and "],
  ["or", " or "],
  ["not", "not "],
  ["in", " in "],
];

export class PythonApp implements AppInstance {
  readonly id = "python" as const;
  readonly views: readonly ViewId[] = ["symb", "plot", "num"];
  scripts = $state<Script[]>([{ name: "main.py", code: NEW_SCRIPT }]);
  current = $state(0);
  transcript = $state<Line[]>([]);
  status = $state<"loading" | "ready" | "running" | "failed">("loading");
  /** The last Run error, shown under the editor (line number and message). */
  error = $state<{ line?: number; text: string } | undefined>();
  /** Shown in the shell while the engine is not usable. */
  failure = $state("");

  private readonly host: AppHost;
  private engine: PythonEngine | undefined;
  private loading: Promise<PythonEngine | undefined> | undefined;
  private editor: CodeView | undefined;
  private shellInput: CodeView | undefined;
  private inputs: string[] = [];
  private recall = -1;
  private nextId = 1;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private surface: GfxSurface | undefined;
  /** A Run is in progress and has not drawn yet (its first drawing shows the Plot view). */
  private runAwaitingGfx = false;
  /** Shell entries typed while one runs wait their turn; Cancel drops them (a new generation). */
  private chain: Promise<unknown> = Promise.resolve();
  private generation = 0;

  constructor(host: AppHost) {
    this.host = host;
  }

  get busy(): boolean {
    return this.status === "running";
  }
  get script(): Script {
    return this.scripts[this.current] ?? (this.scripts[0] as Script);
  }
  /** The graphics surface, created on first use (it needs a document). */
  get gfx(): GfxSurface {
    this.surface ??= new GfxSurface();
    return this.surface;
  }

  viewLabel(view: ViewId): string {
    return t(view === "symb" ? "python.editor" : view === "plot" ? "python.graphics" : "python.shell");
  }
  entryLabel(): string | undefined {
    return undefined;
  }
  takesText(view: ViewId): boolean {
    return view !== "plot";
  }
  show(view: ViewId): void {
    void this.load();
    queueMicrotask(() => (view === "symb" ? this.editor : view === "num" ? this.shellInput : undefined)?.focus());
  }
  enter(): void {}

  input(view: ViewId, key: TextInput): void {
    const target = view === "symb" ? this.editor : view === "num" ? this.shellInput : undefined;
    target?.input(key);
  }

  // ---- views register their text views
  attachEditor(v: CodeView | undefined): void {
    this.editor = v;
  }
  attachShell(v: CodeView | undefined): void {
    this.shellInput = v;
  }

  // ---- the engine
  /** Load MicroPython once; output and drawings stream into the shell and the canvas. */
  load(): Promise<PythonEngine | undefined> {
    this.loading ??= (async () => {
      try {
        const py = await this.host.calc.python();
        py.onOutput((o) => this.output(o));
        py.onGraphics((b) => this.graphics(b));
        await py.ready();
        this.engine = py;
        if (this.status === "loading") this.status = "ready";
        return py;
      } catch (e) {
        this.status = "failed";
        this.failure = e instanceof Error ? e.message : String(e);
        return undefined;
      }
    })();
    return this.loading;
  }

  private output(o: PyOutput): void {
    const kind = o.stream === "stderr" ? "err" : "out";
    const last = this.transcript.at(-1);
    if (last && last.kind === kind && !last.text.endsWith("\n")) last.text += o.text;
    else this.push(kind, o.text);
    this.trim();
  }

  /** A batch of drawing commands from the worker (public for tests). */
  graphics(batch: GfxCmd[]): void {
    this.gfx.draw(batch);
    if (this.runAwaitingGfx) {
      this.runAwaitingGfx = false;
      this.host.showView("plot");
    }
  }

  private push(kind: Line["kind"], text: string): void {
    this.transcript.push({ id: this.nextId++, kind, text });
  }
  private trim(): void {
    let total = this.transcript.reduce((n, l) => n + l.text.length, 0);
    while (total > MAX_TRANSCRIPT_CHARS && this.transcript.length > 1) total -= (this.transcript.shift() as Line).text.length;
  }

  private async job(start: (py: PythonEngine) => Promise<PyResult>): Promise<PyResult | undefined> {
    if (this.busy) return undefined;
    const py = await this.load();
    if (!py) return undefined;
    this.status = "running";
    try {
      const r = await start(py);
      if (!r.ok && r.error && !this.transcript.at(-1)?.text.includes(r.error.type)) this.push("err", r.error.traceback || `${r.error.type}: ${r.error.message}\n`);
      return r;
    } catch (e) {
      if (!(e instanceof PythonCancelled)) this.push("err", `${e instanceof Error ? e.message : String(e)}\n`);
      return undefined;
    } finally {
      this.runAwaitingGfx = false;
      if (this.status === "running") this.status = "ready";
    }
  }

  /** Editor Run: the current script with fresh globals; the shell shows its output. */
  async run(): Promise<void> {
    if (this.busy) return;
    this.flush();
    const s = this.script;
    this.error = undefined;
    this.push("note", t("python.running", { name: s.name }));
    this.host.showView("num");
    this.runAwaitingGfx = true;
    const r = await this.job((py) => py.run(s.code, { file: s.name }));
    if (r && !r.ok && r.error) {
      const e = r.error;
      this.error = { ...(e.line !== undefined ? { line: e.line } : {}), text: `${e.type}: ${e.message}` };
      if (e.line !== undefined) this.editor?.showLine(e.line);
    }
  }

  /** Shell Enter: run the input (a whole block once it is complete), keep it for ▲. */
  shellEnter(): boolean {
    const v = this.shellInput;
    if (!v) return true;
    const text = v.doc;
    const lines = text.split("\n");
    const lastLine = lines.at(-1) ?? "";
    // A block (a line ending in ":") goes on until an empty line, as in the Python prompt.
    if (/:\s*$/.test(lastLine) || (lines.length > 1 && lastLine.trim() !== "")) return false;
    const code = text.replace(/\s+$/, "");
    if (code === "") return true;
    v.doc = "";
    this.inputs.push(code);
    if (this.inputs.length > SHELL_HISTORY) this.inputs.shift();
    this.recall = -1;
    this.push("in", code);
    const gen = this.generation;
    this.chain = this.chain.then(() => (gen === this.generation ? this.job((py) => py.shell(code)) : undefined));
    return true;
  }

  /** ▲ / ▼ at the edge of the shell input: earlier inputs. */
  shellRecall(dir: "up" | "down"): boolean {
    const v = this.shellInput;
    if (!v || this.inputs.length === 0) return false;
    if (dir === "up") this.recall = this.recall < 0 ? this.inputs.length - 1 : Math.max(0, this.recall - 1);
    else if (this.recall < 0) return false;
    else this.recall = this.recall + 1 >= this.inputs.length ? -1 : this.recall + 1;
    v.doc = this.recall < 0 ? "" : (this.inputs[this.recall] as string);
    return true;
  }

  async cancel(): Promise<void> {
    if (!this.engine) return;
    this.generation++;
    await this.engine.cancel();
    this.status = "ready";
    this.push("note", t("python.cancelled"));
  }

  // ---- scripts
  setCode(code: string): void {
    const s = this.scripts[this.current];
    if (!s || s.code === code) return;
    s.code = code.length > MAX_SCRIPT_CHARS ? code.slice(0, MAX_SCRIPT_CHARS) : code;
    this.error = undefined;
    this.save();
  }
  open(i: number): void {
    if (!this.scripts[i]) return;
    this.flush();
    this.current = i;
    this.error = undefined;
    if (this.editor) this.editor.doc = this.script.code;
    this.save();
  }
  newScript(): void {
    if (this.scripts.length >= MAX_SCRIPTS) return;
    const names = new Set(this.scripts.map((s) => s.name));
    let n = this.scripts.length + 1;
    while (names.has(`script${n}.py`)) n++;
    this.scripts.push({ name: `script${n}.py`, code: NEW_SCRIPT });
    this.open(this.scripts.length - 1);
  }
  deleteScript(): void {
    if (this.scripts.length <= 1) {
      if (this.editor) this.editor.doc = "";
      this.setCode("");
      return;
    }
    this.scripts.splice(this.current, 1);
    this.open(Math.min(this.current, this.scripts.length - 1));
  }
  clearShell(): void {
    this.transcript = [];
  }

  menu(view: ViewId): MenuItem[] {
    const insert = (text: string) => () => this.input(view, { kind: "text", text });
    const keywords = KEYWORDS.map(([label, text]) => ({ id: `kw-${label}`, label, run: insert(text) }));
    if (view === "plot")
      return [{ id: "clear", label: t("python.clearCanvas"), run: () => this.gfx.clear(0xffffff) }];
    if (view === "num")
      return [{ id: "clear", label: t("python.clearShell"), run: () => this.clearShell() }, ...keywords];
    return [
      { id: "run", label: t("python.run"), disabled: this.busy, run: () => void this.run() },
      { id: "new", label: t("python.new"), disabled: this.scripts.length >= MAX_SCRIPTS, run: () => this.newScript() },
      { id: "delete", label: t("python.delete"), run: () => this.deleteScript() },
      ...this.scripts.map((s, i) => ({ id: `open-${i}`, label: t("python.open", { name: s.name }), disabled: i === this.current, run: () => this.open(i) })),
      ...keywords,
    ];
  }

  // ---- storage (IndexedDB key app.python)
  async restore(): Promise<void> {
    const s = await this.host.kv.get<Partial<Stored>>("app.python");
    if (!s || !Array.isArray(s.scripts)) return;
    const scripts = s.scripts
      .filter((x): x is Script => typeof x?.name === "string" && typeof x.code === "string")
      .slice(0, MAX_SCRIPTS);
    if (scripts.length === 0) return;
    this.scripts = scripts;
    this.current = typeof s.current === "number" && scripts[s.current] ? s.current : 0;
  }
  private save(): void {
    this.saveTimer ??= setTimeout(() => this.flush(), 300);
  }
  flush(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    const s: Stored = { scripts: $state.snapshot(this.scripts), current: this.current };
    void this.host.kv.set("app.python", s);
  }
}
