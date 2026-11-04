// SPDX-License-Identifier: GPL-3.0-or-later
// G163: a Home result as the formatter reads it (format.ts markOf, formatConfirmed). Pure, no engine: the unit view's chunks
// (units/result.ts) and the golden runs read it without homeEval.ts's graph. It is a module of its own, not part of format.ts,
// because format.ts is in the start chunk and the start does not call it (+0.07 kB gzip there, over R91's pin).
import type { ComplexValue, PrecisionFacts } from "./format.ts";
import type { ValueFacts } from "./types.ts";

/** The fields of a Home result (homeEval.ts HomeResult) that the formatter reads; HomeResult has them structurally. */
export interface ResultLike {
  facts: ValueFacts;
  value?: ComplexValue;
  items?: ResultLike[];
  shape?: [number, number];
  braces?: true;
  approximate: boolean;
}

/** A result as the formatter reads it (markOf, formatConfirmed): its facts with its value, elements and shape. */
export function precisionFacts(r: ResultLike): PrecisionFacts & { shape?: [number, number] } {
  return {
    ...r.facts,
    ...(r.value ? { value: r.value } : {}),
    ...(r.items ? { items: r.items.map(precisionFacts) } : {}),
    ...(r.shape ? { shape: r.shape } : {}),
    ...(r.braces ? { braces: r.braces } : {}),
    approximate: r.approximate,
  };
}
