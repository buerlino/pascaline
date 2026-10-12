// SPDX-License-Identifier: GPL-3.0-or-later
// The engine side of the protocol: one Giac instance, synchronous calls. Runs inside the Web
// Worker (giac.worker.ts) and, for tests and the golden runner, directly in Node. Knows nothing
// about the UI. Only erasable TypeScript syntax, so Node runs this file directly.
import type { Request, Response } from "./protocol.ts";
import type { AnalysisRequest, AnalysisResult, CasResult, CasSettings, HomeResult, HomeSettings, SolveOutcome, SolveRequest, TableRequest } from "./types.ts";
import { definitionsUsedBy, ENGINE_DEFINITIONS, homeEval, homeSetupCommands, isStateful, regrouped, resultFromFacts, safePrecision, toExactLiterals } from "./homeEval.ts";
import { floatFacts, hasFloat, numberLatex, shapeOf } from "./numeric.ts";
import { SOLVE_HARD_TIMEOUT_S, solveRequest, unknownsOf } from "./solve.ts";
import { analyze, table } from "./analysis.ts";


/** What the host needs from a loaded Giac module (engine/giac/wasm/api.cc). */
export interface GiacApi {
  eval(input: string): string;
  /** giac_set_pow_limit: returns the previous limit. */
  setPowLimit(limit: number): number;
  /** Text Giac printed (Emscripten `print`) since the last clearMessages(). Parse errors arrive here. */
  messages(): string;
  clearMessages(): void;
}

export interface LoadedGiac {
  giac: GiacApi;
  /** Fetch + compile + instantiate, measured by the loader. */
  instantiateMs: number;
}

export type GiacLoader = (baseUrl: string) => Promise<LoadedGiac>;

/** Read by Giac's EMCC hooks (gen.cc, maple.cc): no "=decimal" suffix on fractions, no WebGL 3D.
 *  Must be set before the module is instantiated. */
export function setGiacHostGlobals(): void {
  (globalThis as Record<string, unknown>).UI = {
    add_evalf: 0,
    js_bigint: 0,
    disable3d: -1,
    Datestart: Date.now(),
  };
}

/** Collects what the Emscripten module prints, for GiacApi.messages(). */
export function messageBuffer(): { print: (s: string) => void; messages: () => string; clear: () => void } {
  let buf: string[] = [];
  return {
    print: (s) => {
      if (buf.length < 50) buf.push(s);
    },
    messages: () => buf.join("\n"),
    clear: () => {
      buf = [];
    },
  };
}

export { isStateful };

function isError(out: string): boolean {
  return out.startsWith("GIAC_ERROR");
}

function isTimeout(out: string): boolean {
  return isError(out) && /interrupt/i.test(out);
}

/** Giac prints a string result in double quotes; latex() returns one. */
function unquote(s: string): string {
  return s.length >= 2 && s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s;
}

/** Commands that put Giac into CAS mode (D3). Home's are homeSetupCommands() in homeEval.ts. */
export function casSetupCommands(s: CasSettings): string[] {
  return [
    `angle_radian:=${s.angle === "rad" ? 1 : 0}`,
    `Digits:=${Math.trunc(s.digits)}`,
    `timeout ${Math.min(Math.max(s.hardTimeoutS, 0.001), 1439).toFixed(3)}`,
    "ckevery 10",
  ];
}

/** Giac reports a parse error by printing "syntax error" and returning `undef`. */
class GiacSyntaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GiacSyntaxError";
  }
}

type CasError = NonNullable<CasResult["error"]>;

/** Engine state and the synchronous operations on it. One per Giac instance. */
export class EngineHost {
  private modeKey = "";
  private readonly giac: GiacApi;
  /** `giac.eval` that throws GiacSyntaxError instead of quietly returning `undef` (which would
   *  otherwise leave the previous answer in place and show it again). */
  private readonly strict: { eval(input: string): string };

  /** Our definitions already loaded into this Giac instance (ENGINE_DEFINITIONS, loaded on first use). */
  private readonly loaded = new Set<string>();

  /** Loads the definitions `text` mentions that are not loaded yet. Called before every input reaches Giac. */
  need(text: string): void {
    for (const name of definitionsUsedBy(text)) {
      if (this.loaded.has(name)) continue;
      this.giac.eval(ENGINE_DEFINITIONS[name]!);
      this.loaded.add(name);
    }
  }

  constructor(giac: GiacApi) {
    this.giac = giac;
    this.strict = {
      eval: (input) => {
        giac.clearMessages();
        const out = giac.eval(input);
        if (out === "undef") {
          const msg = giac.messages();
          if (/syntax error/.test(msg)) throw new GiacSyntaxError(msg.trim());
        }
        return out;
      },
    };
  }

  eval(input: string): { output: string; ok: boolean; engineMs: number; replay: string[] } {
    this.need(input);
    const t0 = performance.now();
    const output = this.giac.eval(input);
    const ok = !isError(output);
    return { output, ok, engineMs: performance.now() - t0, replay: ok && isStateful(input) ? [input] : [] };
  }

  home(input: string, s: HomeSettings): { result: HomeResult; replay: string[] } {
    this.need(input);
    this.useHomeMode(s);
    const t0 = performance.now();
    let result: HomeResult;
    try {
      result = homeEval(this.strict, input, s);
    } catch (e) {
      if (!(e instanceof GiacSyntaxError)) throw e;
      const ms = performance.now() - t0;
      return {
        result: { ok: false, display: e.message, path: "float-error", approximate: false, tieRisk: false, exactMs: ms, totalMs: ms, error: "syntax", ...safePrecision(e.message) },
        replay: [],
      };
    }
    if (!result.ok) return { result: { ...result, error: "engine" }, replay: [] };
    let replay: string[] = [];
    if (isStateful(input)) {
      // Replay the form that actually ran: exact for the exact paths, floats for the fallbacks.
      replay =
        result.path === "exact" || result.path === "exact-big"
          ? [toExactLiterals(input)]
          : [`Digits:=${s.workDigits}`, input, `Digits:=${s.digits}`];
    }
    return { result, replay };
  }

  cas(input: string, s: CasSettings): { result: CasResult; replay: string[] } {
    this.need(input);
    this.useMode(`cas${JSON.stringify(s)}`, () => {
      for (const c of casSetupCommands(s)) this.giac.eval(c);
      this.giac.setPowLimit(s.powLimit);
    });
    const t0 = performance.now();
    const fail = (text: string, error: CasError): { result: CasResult; replay: string[] } => ({
      result: { ok: false, text, latex: "", timedOut: error === "timeout", error, engineMs: performance.now() - t0 },
      replay: [],
    });
    // P9 (docs/04 section 2.9): typed decimals are exact rationals, as in Home; approx() gives decimals.
    const exactInput = toExactLiterals(input);
    let text: string;
    try {
      text = this.strict.eval(`pcasans:=(${exactInput})`);
    } catch (e) {
      if (e instanceof GiacSyntaxError) return fail(e.message, "syntax");
      throw e;
    }
    if (isError(text)) return fail(text, isTimeout(text) ? "timeout" : "engine");
    const replay = isStateful(input) ? [exactInput] : [];
    // A number with a float in it: checked like Home (the value as `numeric`, its text and LaTeX from our formatter).
    const shape = hasFloat(text) ? shapeOf(text) : null;
    if (shape) {
      const facts = floatFacts(this.giac, "pcasans", isStateful(input) ? null : exactInput, shape, Math.trunc(s.digits), Math.trunc(s.digits));
      if (facts) {
        const numeric = resultFromFacts(facts, shape, Math.trunc(s.digits), "numeric", true, performance.now() - t0);
        return {
          result: { ok: true, text: numeric.display, latex: numberLatex(numeric.display), timedOut: false, engineMs: performance.now() - t0, numeric },
          replay,
        };
      }
    }
    // This build leaves x*x unevaluated (no top-level "regroup" autosimplify), and latex() then draws x·x as "xx".
    if (text.includes("*")) text = regrouped(this.giac, "pcasans", text);
    const tex = this.giac.eval("latex(pcasans)");
    if (isError(tex)) return fail(tex, isTimeout(tex) ? "timeout" : "engine");
    return {
      result: { ok: true, text, latex: unquote(tex), timedOut: false, engineMs: performance.now() - t0 },
      replay,
    };
  }

  solve(req: SolveRequest, s: HomeSettings): SolveOutcome {
    this.need(JSON.stringify(req));
    this.useSolveMode(s);
    return solveRequest(this.giac, req, s);
  }

  unknowns(equations: string[]): string[] {
    return unknownsOf(this.giac, equations);
  }

  analyze(req: AnalysisRequest, s: HomeSettings): AnalysisResult {
    this.need(JSON.stringify(req));
    this.useSolveMode(s);
    return analyze(this.giac, req, s);
  }

  /** Num table cells are Home evaluations, in Home mode (same budget per cell). */
  table(req: TableRequest, s: HomeSettings): HomeResult[][] {
    this.need(JSON.stringify(req));
    this.useHomeMode(s);
    return table(this.giac, req, s);
  }

  private useHomeMode(s: HomeSettings): void {
    this.useMode(`home${JSON.stringify(s)}`, () => {
      for (const c of homeSetupCommands(s)) this.giac.eval(c);
      this.giac.eval(`Digits:=${Math.trunc(s.digits)}`);
      this.giac.setPowLimit(s.powLimit);
    });
  }

  private useSolveMode(s: HomeSettings): void {
    this.useMode(`solve${JSON.stringify(s)}`, () => {
      this.giac.eval(`angle_radian:=${s.angle === "rad" ? 1 : 0}`);
      this.giac.eval(`timeout ${SOLVE_HARD_TIMEOUT_S}`);
      this.giac.eval("ckevery 10");
      this.giac.eval(`Digits:=${Math.trunc(s.digits)}`);
      this.giac.setPowLimit(s.powLimit);
    });
  }

  private useMode(key: string, apply: () => void): void {
    if (key === this.modeKey) return;
    apply();
    this.modeKey = key;
  }
}

/** Builds the message handler used by the worker: init loads Giac, then requests go to EngineHost. */
export function createRequestHandler(load: GiacLoader, post: (r: Response) => void): (req: Request) => Promise<void> {
  // Calls that arrive while init is still loading the engine wait for it, in arrival order (a Plot
  // view restored at launch asks for the trace before the engine is up).
  let starting: Promise<EngineHost> | null = null;
  return async (req) => {
    try {
      if (req.type === "init") {
        starting = (async () => {
          const loaded = await load(req.baseUrl);
          const t1 = performance.now();
          loaded.giac.eval("0");
          const host = new EngineHost(loaded.giac);
          const t2 = performance.now();
          for (const line of req.replay) {
            host.need(line); // a replayed definition may use one of ours
            loaded.giac.eval(line);
          }
          const t3 = performance.now();
          post({ id: req.id, type: "ready", instantiateMs: loaded.instantiateMs, initMs: t2 - t1, replayMs: t3 - t2 });
          return host;
        })();
        await starting;
        return;
      }
      if (!starting) throw new Error("engine not initialised");
      const host = await starting;
      switch (req.type) {
        case "eval":
          post({ id: req.id, type: "result", ...host.eval(req.input) });
          break;
        case "home":
          post({ id: req.id, type: "home", ...host.home(req.input, req.settings) });
          break;
        case "cas":
          post({ id: req.id, type: "cas", ...host.cas(req.input, req.settings) });
          break;
        case "solve":
          post({ id: req.id, type: "solve", result: host.solve(req.req, req.settings) });
          break;
        case "unknowns":
          post({ id: req.id, type: "unknowns", result: host.unknowns(req.equations) });
          break;
        case "analyze":
          post({ id: req.id, type: "analyze", result: host.analyze(req.req, req.settings) });
          break;
        case "table":
          post({ id: req.id, type: "table", result: host.table(req.req, req.settings) });
          break;
      }
    } catch (e) {
      post({ id: req.id, type: "fatal", message: e instanceof Error ? e.message : String(e) });
    }
  };
}
