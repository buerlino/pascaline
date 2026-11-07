// SPDX-License-Identifier: GPL-3.0-or-later
// G184 (F70): a Home step Giac's own budget stopped is a time-out ("Stopped: it took too long"), on every path that
// fails with Giac's interrupt text; any other engine error keeps no code (the host makes it `engine`). A stand-in Giac:
// every call that holds the input answers the stand-in's text, the rest "0".
import { describe, expect, it } from "vitest";
import type { GiacValue } from "./bridge.ts";
import { DOUBLE_DIGITS, type Giac } from "./numeric.ts";
import { defaultHomeSettings, homeEval } from "./homeEval.ts";
import { PLAIN_FORM } from "./stores.ts";
import { enEngine } from "../i18n/enEngine.ts";

const INPUT = "sum(1/x,x,1,100000)";
const INTERRUPT = "GIAC_ERROR: User interrupt or Out of memory";

/** `error`: the text of every call that holds the input; `double`: what the double-precision run (atDouble) answers. */
function standIn(error: string, double: GiacValue | null = null): Giac {
  const zero: GiacValue = { kind: "integer", text: "0", num: "0", den: "1" };
  return {
    eval: (t) => (t.includes(INPUT) ? error : "0"),
    value: (t, precisions) => {
      if (!t.includes(INPUT)) return zero;
      if (double && precisions.length === 1 && precisions[0] === DOUBLE_DIGITS) return double;
      return { kind: "error", text: error };
    },
  };
}

describe("G184: Giac's interrupt on Home's paths is a time-out", () => {
  it("exact and float runs interrupted, the double run too: timeout, with the time-limit message", () => {
    const r = homeEval(standIn(INTERRUPT), INPUT, defaultHomeSettings);
    expect(r.ok).toBe(false);
    expect(r.path).toBe("float-timeout");
    expect(r.error).toBe("timeout");
    expect(r.display).toBe(enEngine["error.timeout"]);
  });

  it("an input that runs once (no double run): the float of the exact time-out interrupted is a time-out too", () => {
    const r = homeEval(standIn(INTERRUPT), INPUT, defaultHomeSettings, undefined, { ...PLAIN_FORM, stores: true, once: true });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("timeout");
    expect(r.display).toBe(enEngine["error.timeout"]);
  });

  it("atDouble finds no value (a non-number at the double): the float path's interrupt still decides", () => {
    const r = homeEval(standIn(INTERRUPT, { kind: "symbolic", text: "x" }), INPUT, defaultHomeSettings);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("timeout");
    expect(r.display).toBe(enEngine["error.timeout"]);
  });

  it("guard (passes on phase-1): an engine error that is no interrupt keeps Giac's text and no code", () => {
    const other = "GIAC_ERROR: Bad Argument Value";
    const r = homeEval(standIn(other), INPUT, defaultHomeSettings);
    expect(r.ok).toBe(false);
    expect(r.error).toBeUndefined();
    expect(r.display).toBe(other);
  });
});
