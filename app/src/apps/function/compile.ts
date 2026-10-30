// SPDX-License-Identifier: GPL-3.0-or-later
// A Function-app definition, parsed once by our parser (P1) into the Giac text the engine evaluates and
// the JS evaluator Plot draws with (D7: drawing only; every number shown comes from the engine).
// The variable is x, the key on the keyboard; X (shift + alpha) means the same.
import { mathJsonToGiac, type Json } from "../../input/emit.ts";
import { parseFailText } from "../../input/errors.ts";
import { jsonToJs } from "../../input/emit-js.ts";
import { parseLatex } from "../../input/parse.ts";

export interface Compiled {
  /** Giac text in x, or "" when the definition does not parse. */
  giac: string;
  /** Drawing evaluator; undefined when the expression cannot be drawn (e.g. it uses a stored variable). */
  fn?: (x: number) => number;
  /** Why it does not parse (empty when it does). Plot problems are not errors: the engine can still tabulate. */
  error: string;
  /** The angle mode the drawing evaluator was built for. */
  angle: "rad" | "deg";
}

function renameX(e: Json): Json {
  if (e === "X") return "x";
  if (Array.isArray(e)) return e.map((a, i) => (i === 0 ? a : renameX(a)));
  return e;
}

export function compileDefinition(latex: string, angle: "rad" | "deg" = "rad", decimalComma = false): Compiled {
  if (latex.trim() === "") return { giac: "", error: "", angle };
  let json: Json;
  let giac: string;
  try {
    json = renameX(parseLatex(latex, decimalComma ? { decimalComma: true } : {}));
    giac = mathJsonToGiac(json, { realOddRoots: true }); // P5 (b), R39
  } catch (e) {
    return { giac: "", error: parseFailText(e), angle };
  }
  if (Array.isArray(json) && typeof json[0] === "string" && /^(Equal|Less|Greater|LessEqual|GreaterEqual|NotEqual)$/.test(json[0]))
    return { giac: "", error: "not a function of x", angle };
  try {
    const fn = new Function("x", `return ${jsonToJs(json, ["x"], angle === "deg")};`) as (x: number) => number;
    return { giac, fn, error: "", angle };
  } catch {
    return { giac, error: "", angle };
  }
}
