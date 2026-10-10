// SPDX-License-Identifier: GPL-3.0-or-later
// LaTeX (from MathLive) -> MathJSON (Compute Engine, form "raw" so numbers stay as typed)
// -> Giac input string. Spike code: the gaps are listed in spike/serializer/NOTES.md.
import { ComputeEngine } from "@cortex-js/compute-engine";
import { SerializeError, mathJsonToGiac, type Json, type SerializeOptions } from "./emit.ts";

export { SerializeError, mathJsonToGiac, type Json, type SerializeOptions };

let ce: ComputeEngine | undefined;
export function latexToMathJson(latex: string): Json {
  ce ??= new ComputeEngine();
  return ce.parse(latex, { form: "raw" }).json as Json;
}

export function latexToGiac(latex: string, o: SerializeOptions = {}): string {
  if (latex.trim() === "") throw new SerializeError("empty input");
  return mathJsonToGiac(latexToMathJson(latex), o);
}
