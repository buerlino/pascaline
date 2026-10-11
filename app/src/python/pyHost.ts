// SPDX-License-Identifier: GPL-3.0-or-later
// The Python side of the worker, UI-free (also runs in Node for tests): loads MicroPython, runs editor
// scripts and shell entries, streams stdout/stderr in batches, turns exceptions into PyError.
//
// Two rules come from the MicroPython webassembly port (standard variant, built with ASYNCIFY):
// - Its GC scans wasm locals by unwinding the stack (emscripten_scan_registers), so every entry into
//   Python must be an async ccall. Upstream's runPython() is a sync ccall and aborts on the first GC,
//   so we never use it for user code.
// - `calc` is synchronous for the script: our `_host` C module (python/modules/host) suspends the wasm
//   stack (EM_ASYNC_JS) until `hostCall` resolves. No `await`, no SharedArrayBuffer.
import type { GfxCmd, PyError, PyOutput, PyResult } from "./types.ts";
import { DRAW_PY, COMPAT_PY, COMPAT_MODULE } from "./graphics.ts";

/** The part of upstream's loadMicroPython() result that we use. */
export interface MicroPython {
  _module: MpModule;
  FS: { mkdirTree(path: string): void; writeFile(path: string, data: string): void };
  runPython(code: string): unknown;
  registerJsModule(name: string, module: object): void;
}
interface MpModule {
  ccall(name: string, ret: "number", types: string[], args: number[], opts: { async: true }): Promise<number>;
  _malloc(n: number): number;
  _free(p: number): void;
  lengthBytesUTF8(s: string): number;
  stringToUTF8(s: string, p: number, max: number): void;
  UTF8ToString(p: number, n?: number): string;
  getValue(p: number, type: "i32"): number;
  pascalineHost?: (req: string) => Promise<string>;
}
export type LoadMicroPython = (opts: {
  heapsize?: number;
  pystack?: number;
  linebuffer?: boolean;
  url?: string;
  stdout?: (b: Uint8Array) => void;
  stderr?: (b: Uint8Array) => void;
}) => Promise<MicroPython>;

/** Python GC heap and stack (defaults: see docs/decisions.md "Python runtime"). */
export const PY_HEAP_BYTES = 4 * 1024 * 1024;
export const PY_STACK_WORDS = 8 * 1024;
/** Output is sent at most this often while a script runs (and always at the end of a call). */
export const PY_FLUSH_MS = 16;
const FLUSH_BYTES = 8192;

export interface PyHostHooks {
  output(o: PyOutput): void;
  /** A `calc`/host call from Python: resolve with a JSON-serialisable value, reject with a message. */
  hostCall(fn: string, args: unknown[]): Promise<unknown>;
  /** A batch of graphics commands (every 256 commands, at most every 16 ms with output, before each
   *  host call and at the end of every call). */
  graphics?(batch: GfxCmd[]): void;
}

/** Graphics commands per batch at most. */
export const GFX_BATCH = 256;

export const SHELL_FILE = "<shell>";
export const SCRIPT_FILE = "<script>";
/** Files whose frames are ours, not the user's: dropped from tracebacks. */
const INTERNAL_FILES = new Set(["<stdin>", "/lib/_pl.py", "/lib/calc.py", "/lib/draw.py", `/lib/${COMPAT_MODULE}.py`]);

const PL_PY = `# Pascaline glue (internal)
import _host, json

_ERR = {"NameError": NameError, "TypeError": TypeError}

def _py(v):
    if isinstance(v, dict):
        if "i" in v:
            return int(v["i"])
        if "f" in v:
            return float(v["f"])
        if "c" in v:
            return complex(float(v["c"][0]), float(v["c"][1]))
    if isinstance(v, list):
        return [_py(x) for x in v]
    return v

def call(fn, *args):
    r = json.loads(_host.call(json.dumps([fn, list(args)])))
    if r[0]:
        return _py(r[1])
    raise _ERR.get(r[2], ValueError)(r[1])

def run(g, src, file):
    for k in list(g):
        if k != "__name__":
            del g[k]
    exec(compile(src, file, "exec"), g)

def shell(g, src):
    try:
        c = compile(src, "${SHELL_FILE}", "single")
    except SyntaxError:
        c = compile(src, "${SHELL_FILE}", "exec")
    exec(c, g)
`;

const CALC_PY = `# calc: the calculator from Python. Every call is synchronous and goes to the Giac engine
# that Home and CAS use, so calculator variables are shared both ways.
from _pl import call as _call

def cas(expr):
    """Evaluate expr in the CAS; returns Giac's exact result as text, e.g. "(x-1)*(x+1)"."""
    return _call("cas", str(expr))

def eval(expr):
    """Evaluate expr numerically: int for an exact integer, else float, complex, a list, or text if not numeric."""
    return _call("eval", str(expr))

def get(name):
    """The value of calculator variable name (as eval returns it); NameError if it has none."""
    return _call("get", str(name))

def set(name, value):
    """Store value (int, float, complex, bool, list, or an expression as text) in calculator variable name.
    None deletes the variable."""
    _call("set", str(name), None if value is None else _giac(value))

def _giac(v):
    if v is True:
        return "1"
    if v is False:
        return "0"
    if isinstance(v, int):
        return str(v)
    if isinstance(v, float):
        if v != v:
            return "undef"
        if v in (float("inf"), float("-inf")):
            return "infinity" if v > 0 else "-infinity"
        return repr(v)
    if isinstance(v, complex):
        return "(" + _giac(v.real) + ")+(" + _giac(v.imag) + ")*i"
    if isinstance(v, (list, tuple)):
        return "[" + ",".join([_giac(x) for x in v]) + "]"
    if isinstance(v, str):
        return v
    raise TypeError("can't store a " + type(v).__name__ + " in a calculator variable")
`;

/** A host-call failure raised in Python as the named exception type (default ValueError). */
export class HostError extends Error {
  constructor(
    readonly pyType: "ValueError" | "NameError" | "TypeError",
    message: string,
  ) {
    super(message);
    this.name = "HostError";
  }
}

class OutStream {
  private bytes: number[] = [];
  private readonly dec = new TextDecoder();
  constructor(
    private readonly stream: "stdout" | "stderr",
    private readonly emit: (o: PyOutput) => void,
  ) {}
  push(b: Uint8Array): void {
    for (const c of b) this.bytes.push(c);
  }
  get size(): number {
    return this.bytes.length;
  }
  flush(final = false): void {
    if (this.bytes.length === 0 && !final) return;
    const text = this.dec.decode(new Uint8Array(this.bytes), { stream: !final });
    this.bytes = [];
    if (text) this.emit({ stream: this.stream, text });
  }
}

/** Parse MicroPython's "Type\\x04Traceback ..." exception string. */
export function parsePyException(raw: string, file: string): PyError {
  const sep = raw.indexOf("\x04");
  const type = sep >= 0 ? raw.slice(0, sep) : "Error";
  const text = sep >= 0 ? raw.slice(sep + 1) : raw;
  const lines = text.split("\n");
  const kept: string[] = [];
  let line: number | undefined;
  let errFile: string | undefined;
  for (const l of lines) {
    if (l.length === 0) continue;
    const m = /^\s*File "([^"]*)", line (\d+)/.exec(l);
    if (m) {
      const f = m[1] ?? "";
      if (INTERNAL_FILES.has(f)) continue;
      if (f === file) {
        line = Number(m[2]);
        errFile = f;
      }
    }
    kept.push(l);
  }
  // A traceback with no user frame left keeps only the error line.
  const traceback = (kept.length === 2 && kept[0]?.startsWith("Traceback") ? kept.slice(1) : kept).join("\n") + "\n";
  const last = lines.filter((l) => l.length > 0).at(-1) ?? "";
  const message = last.startsWith(type + ":") ? last.slice(type.length + 1).trim() : last === type ? "" : last;
  const err: PyError = { type, message, traceback };
  if (line !== undefined) err.line = line;
  if (errFile !== undefined) err.file = errFile;
  return err;
}

export class PyHost {
  private readonly out: OutStream;
  private readonly err: OutStream;
  private lastFlush = 0;
  /** Set when the runtime threw at the JS level (e.g. the JS stack overflowed in deep recursion):
   *  its state can't be trusted, so the worker must be replaced before the next call. */
  broken = false;
  private gfx: GfxCmd[] = [];
  private busy: Promise<unknown> = Promise.resolve();

  private constructor(
    private readonly mp: MicroPython,
    private readonly hooks: PyHostHooks,
    streams: { out: OutStream; err: OutStream },
  ) {
    this.out = streams.out;
    this.err = streams.err;
    const M = mp._module;
    M.pascalineHost = async (req: string) => {
      this.flushAll();
      let fn = "";
      let args: unknown[] = [];
      try {
        [fn, args] = JSON.parse(req) as [string, unknown[]];
        return JSON.stringify([true, await hooks.hostCall(fn, args)]);
      } catch (e) {
        const type = e instanceof HostError ? e.pyType : "ValueError";
        return JSON.stringify([false, e instanceof Error ? e.message : String(e), type]);
      }
    };
    mp.FS.mkdirTree("/lib");
    mp.FS.writeFile("/lib/_pl.py", PL_PY);
    mp.FS.writeFile("/lib/calc.py", CALC_PY);
    mp.FS.writeFile("/lib/draw.py", DRAW_PY);
    mp.FS.writeFile(`/lib/${COMPAT_MODULE}.py`, COMPAT_PY);
    // Python checks and converts the arguments (graphics.ts); here they are only queued.
    mp.registerJsModule("_gfx", {
      c: (...cmd: unknown[]) => {
        this.gfx.push(cmd as GfxCmd);
        if (this.gfx.length >= GFX_BATCH) this.flushGfx();
        else if (cmd[0] === "show" || performance.now() - this.lastFlush >= PY_FLUSH_MS) this.flushAll();
      },
    });
  }

  static async load(loadMicroPython: LoadMicroPython, hooks: PyHostHooks, url?: string): Promise<PyHost> {
    const out = new OutStream("stdout", hooks.output);
    const err = new OutStream("stderr", hooks.output);
    let host: PyHost | undefined;
    const sink = (s: OutStream) => (b: Uint8Array) => {
      s.push(b);
      if (b.includes(10) || s.size >= FLUSH_BYTES) host?.maybeFlush();
    };
    const mp = await loadMicroPython({
      heapsize: PY_HEAP_BYTES,
      pystack: PY_STACK_WORDS,
      linebuffer: false,
      stdout: sink(out),
      stderr: sink(err),
      ...(url ? { url } : {}),
    });
    host = new PyHost(mp, hooks, { out, err });
    // Older builds lack our C module; fail loudly instead of at the first calc call.
    const probe = await host.exec("import _host\n", "<stdin>");
    if (!probe.ok) throw new Error("this MicroPython build has no _host module; rebuild with python/build-micropython.sh");
    return host;
  }

  /** Editor Run: fresh __main__ globals. */
  run(code: string, file = SCRIPT_FILE): Promise<PyResult> {
    return this.serial(() => this.exec(`__import__("_pl").run(globals(), ${JSON.stringify(code)}, ${JSON.stringify(file)})\n`, file));
  }

  /** One shell entry: persistent globals; an expression's value is echoed (repr) as in a REPL. */
  shell(line: string): Promise<PyResult> {
    return this.serial(() => this.exec(`__import__("_pl").shell(globals(), ${JSON.stringify(line)})\n`, SHELL_FILE));
  }

  private serial<T>(f: () => Promise<T>): Promise<T> {
    const p = this.busy.then(f, f);
    this.busy = p.catch(() => {});
    return p;
  }

  private maybeFlush(): void {
    const now = performance.now();
    if (now - this.lastFlush >= PY_FLUSH_MS || this.out.size >= FLUSH_BYTES || this.err.size >= FLUSH_BYTES) this.flushAll();
  }

  private flushAll(final = false): void {
    this.lastFlush = performance.now();
    this.out.flush(final);
    this.err.flush(final);
    this.flushGfx();
  }

  private flushGfx(): void {
    if (this.gfx.length === 0) return;
    const batch = this.gfx;
    this.gfx = [];
    this.hooks.graphics?.(batch);
  }

  private async exec(src: string, file: string): Promise<PyResult> {
    const M = this.mp._module;
    const t0 = performance.now();
    this.lastFlush = t0;
    const len = M.lengthBytesUTF8(src);
    const buf = M._malloc(len + 1);
    M.stringToUTF8(src, buf, len + 1);
    const value = M._malloc(12);
    let error: PyError | undefined;
    try {
      await M.ccall("mp_js_do_exec", "number", ["pointer", "number", "pointer"], [buf, len, value], { async: true });
      // out = {kind, ...}; kind -1 is an exception carrying "Type\x04traceback". Other return values are
      // dropped (a module body returns None); their proxies hold no references we need to free.
      if (M.getValue(value, "i32") === -1) {
        const n = M.getValue(value + 4, "i32");
        const p = M.getValue(value + 8, "i32");
        const raw = M.UTF8ToString(p, n);
        M._free(p);
        if (!raw.startsWith("SystemExit\x04")) error = parsePyException(raw, file);
      }
    } catch (e) {
      // Not a Python exception: the wasm runtime itself failed. Deep recursion overflows the JS stack
      // (Emscripten's setjmp trampolines) before MicroPython's own limit, at roughly 50-100 frames.
      this.broken = true;
      const overflow = e instanceof RangeError;
      const type = overflow ? "RecursionError" : "InternalError";
      const message = overflow ? "maximum recursion depth exceeded" : e instanceof Error ? e.message : String(e);
      error = { type, message, traceback: `${type}: ${message}\n` };
    } finally {
      M._free(buf);
      M._free(value);
    }
    if (error) this.err.push(new TextEncoder().encode(error.traceback));
    this.flushAll(true);
    const ms = performance.now() - t0;
    return error ? { ok: false, ms, error } : { ok: true, ms };
  }
}
