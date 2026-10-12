// SPDX-License-Identifier: GPL-3.0-or-later
// docs/04 2.8: on an empty Home or CAS entry line, these operators start with Ans, as on the reference
// (spec/mapping/vc-2026-10-11/keys.yaml r9c5, r10c5, r5c1: "Ans+ on an empty line"). (−) stays negation.
import type { Layer } from "../keyboard/keyboard.ts";

const ANS_FIRST: Readonly<Record<string, readonly Layer[]>> = {
  add: ["primary"], // +
  sub: ["primary"], // −
  mul: ["primary"], // ×
  div: ["primary", "shift"], // ÷, x⁻¹
  pow: ["primary"], // xʸ
  sq: ["primary"], // x²
};

/** The key (in this layer) is an operator that takes Ans first on an empty line. */
export function startsWithAns(keyId: string, layer: Layer): boolean {
  return ANS_FIRST[keyId]?.includes(layer) === true;
}
