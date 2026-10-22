// SPDX-License-Identifier: GPL-3.0-or-later
// G86: the clipboard item for one engine number outside the history (a Solve root, a Function cell): its shown text,
// value, full text and facts, whole, so Copy reads the same facts the item was marked with. Type imports only (no code
// joins the start chunk).
import type { ComplexValue } from "../engine/format.ts";
import type { ValueFacts } from "../engine/types.ts";
import type { CopySource } from "./text.ts";

/** A finished number as Copy reads it: `display` the text shown, `value`, `full` and `facts` the engine's. */
export function numberSource(display: string, n: { value?: ComplexValue; full?: string; facts: ValueFacts }): CopySource {
  return {
    latex: "",
    status: "done",
    text: display,
    ...(n.value ? { value: n.value } : {}),
    ...(n.full !== undefined ? { full: n.full } : {}),
    facts: n.facts,
  };
}
