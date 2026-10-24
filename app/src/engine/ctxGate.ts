// SPDX-License-Identifier: GPL-3.0-or-later
// G102: Giac's Digits set through bridge-1 (`giac_ctx_set` of decimal_digits) instead of `Digits:=` text. A set waits
// until the next Giac call of either kind (an eval, a parse, a value, a context read), so two sets with no call between
// them are one call (withDigits' restore and the next withDigits' set, numeric.ts), and a waiting set and the settings
// read after an input are one call too: giac_ctx_set returns the context after it (host.ts after).
// Only erasable TypeScript syntax, so Node runs this file directly.
import type { GiacBridge, GiacContext, GiacValue } from "./bridge.ts";
import type { GiacApi } from "./host.ts";

export interface GatedGiac {
  /** G103: an engine of numeric.ts (Giac): its value is bridge-3's. */
  giac: GiacApi & { digits(d: number): void; value(text: string, precisions: readonly number[], tree?: boolean): GiacValue };
  /** ctxGet answers with the waiting Digits set when there is one (giac_ctx_set returns the context after it). */
  bridge: GiacBridge;
}

/** The context bridge-1 answered, or a thrown error: every key the host sends is one api.cc knows. */
export function contextOf(r: GiacContext | { error: string }): GiacContext {
  if ("error" in r) throw new Error(`giac_ctx_set: ${r.error}`);
  return r;
}

/** giac_ctx_set, again once when it threw: after an interrupt (a timeout) Giac's `ctrl_c` is still set, and api.cc's
 *  ctx_set, unlike giac_value and giac_eval, does not clear it, so the first command function that looks at it throws
 *  (probe 2026-10-24: `timeout 0.001`, an interrupted factor, then ctx_set of decimal_digits). The throw clears it; the
 *  fields set before it are set again alike. */
function setOnce(bridge: GiacBridge, fields: Partial<GiacContext>): GiacContext | { error: string } {
  try {
    return bridge.ctxSet(fields);
  } catch {
    return bridge.ctxSet(fields);
  }
}

export function gated(raw: GiacApi, bridge: GiacBridge): GatedGiac {
  let waiting: number | null = null;
  const flush = (): GiacContext | null => {
    if (waiting === null) return null;
    const d = waiting;
    waiting = null;
    return contextOf(setOnce(bridge, { decimal_digits: d }));
  };
  return {
    giac: {
      eval: (input) => (flush(), raw.eval(input)),
      setPowLimit: (limit) => raw.setPowLimit(limit),
      messages: () => raw.messages(),
      clearMessages: () => raw.clearMessages(),
      digits: (d) => {
        waiting = Math.trunc(d);
      },
      value: (text, precisions, tree) => (flush(), bridge.value(text, precisions, tree)),
    },
    bridge: {
      ctxGet: () => flush() ?? bridge.ctxGet(),
      ctxSet: (fields) => {
        const d = waiting;
        waiting = null;
        return setOnce(bridge, d === null || "decimal_digits" in fields ? fields : { decimal_digits: d, ...fields });
      },
      parse: (text) => (flush(), bridge.parse(text)),
      value: (text, precisions, tree) => (flush(), bridge.value(text, precisions, tree)),
    },
  };
}
