// SPDX-License-Identifier: GPL-3.0-or-later
// G85 (structured bridge spike, docs/research/structure-hindsight.md 2.1): typed wrappers for the four JSON exports of
// engine/giac/wasm/api.cc. G99: the host reads names through them, so a module without the exports fails at load
// (bridgeOf throws NO_BRIDGE); each export is wrapped on its first call.
// Plain TypeScript with only erasable syntax, so Node runs this file directly (tools/probes/bridge.ts).

/** bridge-1: caseval's context. angle_mode: 0 rad, 1 deg, 2 grad (angle_radian is its rad flag). */
export interface GiacContext {
  angle_mode: number;
  angle_radian: boolean;
  approx_mode: boolean;
  complex_mode: boolean;
  complex_variables: boolean;
  integer_format: number;
  scientific_format: number;
  decimal_digits: number;
  epsilon: number;
  increasing_power: boolean;
  all_trig_sol: boolean;
  xcas_mode: number;
  calc_mode: number;
  // The other fields today's settings check reads (flags.ts CONTEXT_FIELDS "read").
  python_compat: number;
  integer_mode: boolean;
  withsqrt: boolean;
  keep_algext: boolean;
  auto_assume: boolean;
  parse_e: boolean;
  convert_rootof: boolean;
  ntl_on: boolean;
  step_infolevel: number;
  proba_epsilon: number;
  eval_level: number;
  prog_eval_level: number;
  autosimplify: string;
}

/** bridge-2: Giac's tree of a text, not evaluated. `reads`: the free names (a bound name read outside its binding
 *  counts); `bound`: every name bound somewhere (parameters, locals, a quoting command's variable, `x=a..b` too);
 *  `top`: the targets of the top-level store alone; `program`: that store's value is a program (G99). G100: `value`:
 *  the targets of that store's value alone (a body storing into its own name keeps it here); `form`: how its target is
 *  written ("name", which `f(x):=…` is too, "indexed" `L[k]:=`, "list" `[a,b]:=`, "call" `Beta(x):=` on a built-in,
 *  whose head is `callee`, "other"; "" when the text is not one store). */
export interface GiacParse {
  ok: boolean;
  heads: string[];
  reads: string[];
  targets: string[];
  bound: string[];
  top: string[];
  program: boolean;
  value: string[];
  form: "" | "name" | "indexed" | "list" | "call" | "other";
  callee: string;
  float: boolean;
  string: boolean;
  nodes: number;
}

/** Every kind `kindOf` in engine/giac/wasm/api.cc returns (bridge.test.ts checks the two lists agree). */
export const GIAC_KINDS = [
  "integer",
  "rational",
  "float",
  "complex",
  "boolean",
  "infinity",
  "list",
  "matrix",
  "sequence",
  "set",
  "symbolic",
  "string",
  "function",
  "undef",
  "error",
  "other",
] as const;
export type GiacKind = (typeof GIAC_KINDS)[number];

/** bridge-3: one evaluation. `at[P]`: [re, im] printed for every element of evalf(value, P), null when not a number. */
export interface GiacValue {
  kind: GiacKind;
  text: string;
  cut?: boolean;
  num?: string;
  den?: string;
  shape?: number[];
  elements?: string[];
  at?: Record<string, [string, string][] | null>;
}

export interface GiacBridge {
  ctxGet(): GiacContext;
  /** Sets the given fields; the context after, or an error (nothing set after the bad key). */
  ctxSet(fields: Partial<GiacContext>): GiacContext | { error: string };
  parse(text: string): GiacParse;
  value(text: string, precisions: readonly number[]): GiacValue;
}

export const NO_BRIDGE = "no bridge exports";

/** The parts of an Emscripten module the wrappers use. */
export interface BridgeModule {
  cwrap(name: string, ret: "string", args: string[]): (...a: string[]) => string;
}

const EXPORTS = ["giac_ctx_get", "giac_ctx_set", "giac_parse", "giac_value"] as const;

/** Wrappers over `M`; throws NO_BRIDGE when `M` lacks an export, and wraps each export on its first call. */
export function bridgeOf(M: BridgeModule): GiacBridge {
  const missing = EXPORTS.filter((name) => typeof (M as unknown as Record<string, unknown>)[`_${name}`] !== "function");
  if (missing.length) throw new Error(`${NO_BRIDGE}: ${missing.join(", ")}`);
  const fns = new Map<string, (...a: string[]) => string>();
  const call = (name: string, ...args: string[]): string => {
    let f = fns.get(name);
    if (!f) {
      f = M.cwrap(name, "string", args.map(() => "string"));
      fns.set(name, f);
    }
    return f(...args);
  };
  return {
    ctxGet: () => JSON.parse(call("giac_ctx_get")) as GiacContext,
    ctxSet: (fields) => JSON.parse(call("giac_ctx_set", JSON.stringify(fields))) as GiacContext | { error: string },
    parse: (text) => JSON.parse(call("giac_parse", text)) as GiacParse,
    value: (text, precisions) => JSON.parse(call("giac_value", text, precisions.join(","))) as GiacValue,
  };
}
