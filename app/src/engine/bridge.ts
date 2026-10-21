// SPDX-License-Identifier: GPL-3.0-or-later
// G85 (structured bridge spike, docs/research/structure-hindsight.md 2.1): typed wrappers for the four JSON exports of
// engine/giac/wasm/api.cc. Unused by the host. Each export is looked up on its first call, never at load, so a module
// built before the bridge (the shared engine until A28 rebuilds it) loads and evaluates as before; calling a wrapper on
// it throws NO_BRIDGE.
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
}

/** bridge-2: Giac's tree of a text, not evaluated. */
export interface GiacParse {
  ok: boolean;
  heads: string[];
  reads: string[];
  targets: string[];
  bound: string[];
  float: boolean;
  string: boolean;
  nodes: number;
}

export type GiacKind =
  | "integer"
  | "rational"
  | "float"
  | "complex"
  | "list"
  | "matrix"
  | "sequence"
  | "set"
  | "symbolic"
  | "string"
  | "function"
  | "undef"
  | "error"
  | "other";

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

/** Wrappers over `M`; each resolves its export on its first call. */
export function bridgeOf(M: BridgeModule): GiacBridge {
  const fns = new Map<string, (...a: string[]) => string>();
  const call = (name: string, ...args: string[]): string => {
    let f = fns.get(name);
    if (!f) {
      if (typeof (M as unknown as Record<string, unknown>)[`_${name}`] !== "function") throw new Error(`${NO_BRIDGE}: ${name}`);
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
