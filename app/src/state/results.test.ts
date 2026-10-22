// SPDX-License-Identifier: GPL-3.0-or-later
// G86: the rule that turns an engine result into a history item's chip text, facts and chip (state/results.ts), over
// every row the rules decide. The expected values are what the session gave on phase-1 before the rule moved out of
// state/session.svelte.ts (run 181: each row went through Session.submit with a stub engine; source: derived).
import { describe, expect, it } from "vitest";
import type { CasOutcome, HomeOutcome } from "../calc/port.ts";
import { decimalFromString, type ComplexValue } from "../engine/format.ts";
import { casItem, chipFactsOf, chipOf, homeItem, type ItemResult } from "./results.ts";


const re = (s: string, sticky = false): ComplexValue => ({ re: { ...decimalFromString(s)!, ...(sticky ? { sticky: true } : {}) }, im: { neg: false, digits: "", exp: 0, sticky: false } });
const LONG = "1/" + "7".repeat(2100);
const home = (o: Partial<HomeOutcome>): HomeOutcome => ({ ok: true, display: "?", approximate: false, facts: { exact: false, reliableDigits: null }, full: "?", ...o });
const cas = (o: Partial<CasOutcome>): CasOutcome => ({ ok: true, text: "?", latex: "?", facts: { exact: false, reliableDigits: null }, ...o });

const HOME_ROWS: [string, HomeOutcome, boolean][] = [
  ["exact rational", home({ display: "0.333333333333", exact: "1/3", rational: true, value: re("0.333333333333", true), facts: { exact: true, reliableDigits: null }, full: "1/3" }), false],
  ["exact symbolic", home({ display: "1.41421356237", exact: "sqrt(2)", value: re("1.41421356237", true), full: "sqrt(2)" }), false],
  ["inexact input", home({ display: "0.333333333333", exact: "1/3", rational: true, value: re("0.333333333333", true), facts: { exact: true, reliableDigits: null }, full: "0.333333333333333333333333333333333333333" }), true],
  ["inexact input, no full", home({ display: "0.333333333333", exact: "1/3", value: re("0.333333333333", true), full: "" }), true],
  ["float", home({ display: "1.41421356237", approximate: true, value: re("1.41421356237", true), facts: { exact: false, reliableDigits: 40 }, full: "1.414213562373095048801688724209698078570" }), false],
  ["warn", home({ display: "0.12345678", approximate: true, value: re("0.12345678"), facts: { exact: false, reliableDigits: 8, warn: "unaudited", why: { unaudited: ["foo"] } as never }, full: "0.12345678" }), false],
  ["cut exact text", home({ display: "0.142857142857", exact: LONG, value: re("0.142857142857", true), facts: { exact: true, reliableDigits: null }, full: "0.1428571428571428571428571428571428571429" }), false],
  ["sticky value, integer text", home({ display: "2", value: re("2", true), facts: { exact: true, reliableDigits: null }, full: "2" }), false],
  ["digits text", home({ display: "2.5", value: re("2.5"), full: "2.5" }), false],
  ["digits text, exact facts", home({ display: "2.5", value: re("2.5"), facts: { exact: true, reliableDigits: null }, full: "2.5" }), false],
  ["integer text", home({ display: "5", value: re("5"), full: "5" }), false],
  ["E text", home({ display: "1E30", value: re("1e30"), full: "1E30" }), false],
  ["symbolic, drawn differs (DEG)", home({ display: "sin(x)", exact: "sin(pi*x/180)", full: "sin(pi*x/180)", latex: "\\sin x" }), false],
  ["true from an inexact chip", home({ display: "true", full: "true", exact: "true" }), true],
  ["error", home({ ok: false, display: "bad", error: "syntax", full: "" }), false],
  ["list", home({ display: "[1,2.5]", approximate: true, full: "[1,2.5]", items: [home({ display: "1", value: re("1"), facts: { exact: true, reliableDigits: null }, full: "1" }), home({ display: "2.5", value: re("2.5"), facts: { exact: false, reliableDigits: 12 }, full: "2.5" })], shape: [1, 2], digits: 5 }), false],
];

const CAS_ROWS: [string, CasOutcome, boolean][] = [
  ["exact rational", cas({ text: "3/4" }), false],
  ["decimal text", cas({ text: "2.5" }), false],
  ["symbolic", cas({ text: "x+1" }), false],
  ["symbolic, inexact input", cas({ text: "x+1" }), true],
  ["DEG drawn", cas({ text: "sin(x)", full: "sin(pi*x/180)" }), false],
  ["DEG drawn, exact rational", cas({ text: "1/2", full: "sin(pi/6)" }), false],
  ["numeric", cas({ text: "1.41421356237", numeric: home({ display: "1.41421356237", approximate: true, value: re("1.41421356237", true), facts: { exact: false, reliableDigits: 40 }, full: "1.414213562373095048801688724209698078570" }), facts: { exact: false, reliableDigits: 40 } }), false],
  ["true on a float", cas({ text: "true", approximate: true, facts: { exact: false, reliableDigits: null } }), false],
  ["true from an inexact chip", cas({ text: "true" }), true],
  ["non-number with a float (G27)", cas({ text: "x+0.5", approximate: true, facts: { exact: false, reliableDigits: null, warn: "unchecked" } }), false],
  ["too long", cas({ text: "x".repeat(2100) }), false],
  ["error", cas({ ok: false, text: "bad", error: "syntax" }), false],
];

const F40 = "1.414213562373095048801688724209698078570";
/** Per row: the item's fields and its chip (null: none). A CAS row's value is listed; a Home row keeps the engine's. */
const EXPECT: Record<string, ItemResult & { chip: unknown }> = {
  "home exact rational": {"approximate": false, "facts": {"exact": true, "reliableDigits": null}, "rational": {"n": "1", "d": "3"}, "full": "1/3", "fullExact": true, "chip": {"value": "1/3", "exact": true}},
  "home exact symbolic": {"approximate": false, "facts": {"exact": false, "reliableDigits": null}, "full": "sqrt(2)", "fullExact": true, "chip": {"value": "sqrt(2)", "exact": true}},
  "home inexact input": {"approximate": false, "facts": {"exact": true, "reliableDigits": null}, "rational": {"n": "1", "d": "3"}, "full": "0.333333333333333333333333333333333333333", "fullExact": false, "chip": {"value": "0.333333333333333333333333333333333333333", "exact": false, "reliableDigits": null}},
  "home inexact input, no full": {"approximate": false, "facts": {"exact": false, "reliableDigits": null}, "rational": {"n": "1", "d": "3"}, "chip": null},
  "home float": {"approximate": true, "facts": {"exact": false, "reliableDigits": 40}, "full": F40, "fullExact": false, "chip": {"value": F40, "exact": false, "reliableDigits": 40}},
  "home warn": {"approximate": true, "facts": {"exact": false, "reliableDigits": 8, "warn": "unaudited", "why": {"unaudited": ["foo"]}}, "full": "0.12345678", "fullExact": false, "chip": {"value": "0.12345678", "exact": false, "reliableDigits": 8, "warn": "unaudited"}},
  "home cut exact text": {"approximate": false, "facts": {"exact": true, "reliableDigits": null}, "rational": {"n": "1", "d": "7".repeat(2100)}, "full": "0.1428571428571428571428571428571428571429", "fullExact": false, "chip": {"value": "0.1428571428571428571428571428571428571429", "exact": false, "reliableDigits": null}},
  "home sticky value, integer text": {"approximate": false, "facts": {"exact": true, "reliableDigits": null}, "full": "2", "fullExact": false, "chip": {"value": "2", "exact": false, "reliableDigits": null}},
  "home digits text": {"approximate": false, "facts": {"exact": false, "reliableDigits": null}, "full": "2.5", "fullExact": false, "chip": {"value": "2.5", "exact": false, "reliableDigits": null}},
  "home digits text, exact facts": {"approximate": false, "facts": {"exact": true, "reliableDigits": null}, "full": "2.5", "fullExact": true, "chip": {"value": "2.5", "exact": true}},
  "home integer text": {"approximate": false, "facts": {"exact": false, "reliableDigits": null}, "full": "5", "fullExact": true, "chip": {"value": "5", "exact": true}},
  "home E text": {"approximate": false, "facts": {"exact": false, "reliableDigits": null}, "full": "1E30", "fullExact": false, "chip": {"value": "1E30", "exact": false, "reliableDigits": null}},
  "home symbolic, drawn differs (DEG)": {"approximate": false, "facts": {"exact": false, "reliableDigits": null}, "full": "sin(pi*x/180)", "fullExact": true, "drawn": "sin(x)", "chip": {"value": "sin(pi*x/180)", "exact": true}},
  "home true from an inexact chip": {"approximate": true, "facts": {"exact": false, "reliableDigits": null}, "full": "true", "fullExact": false, "chip": {"value": "true", "exact": false, "reliableDigits": null}},
  "home error": {"approximate": false, "chip": null},
  "home list": {"approximate": true, "facts": {"exact": false, "reliableDigits": null, "digits": 5, "items": [{"exact": true, "reliableDigits": null, "value": {"re": {"neg": false, "digits": "1", "exp": 0, "sticky": false}, "im": {"neg": false, "digits": "", "exp": 0, "sticky": false}}}, {"exact": false, "reliableDigits": 12, "value": {"re": {"neg": false, "digits": "25", "exp": 0, "sticky": false}, "im": {"neg": false, "digits": "", "exp": 0, "sticky": false}}}], "shape": [1, 2]}, "full": "[1,2.5]", "fullExact": false, "chip": {"value": "[1,2.5]", "exact": false, "reliableDigits": null}},
  "cas exact rational": {"approximate": false, "rational": {"n": "3", "d": "4"}, "full": "3/4", "fullExact": true, "chip": {"value": "3/4", "exact": true}, "value": {"re": {"neg": false, "digits": "75", "exp": -1, "sticky": false}, "im": {"neg": false, "digits": "", "exp": 0, "sticky": false}}},
  "cas decimal text": {"approximate": false, "full": "2.5", "fullExact": false, "chip": {"value": "2.5", "exact": false}, "value": {"re": {"neg": false, "digits": "25", "exp": 0, "sticky": false}, "im": {"neg": false, "digits": "", "exp": 0, "sticky": false}}},
  "cas symbolic": {"approximate": false, "full": "x+1", "fullExact": true, "chip": {"value": "x+1", "exact": true}},
  "cas symbolic, inexact input": {"approximate": false, "full": "x+1", "fullExact": false, "chip": {"value": "x+1", "exact": false}},
  "cas DEG drawn": {"approximate": false, "full": "sin(pi*x/180)", "fullExact": true, "drawn": "sin(x)", "chip": {"value": "sin(pi*x/180)", "exact": true}},
  "cas DEG drawn, exact rational": {"approximate": false, "rational": {"n": "1", "d": "2"}, "full": "sin(pi/6)", "fullExact": true, "drawn": "1/2", "chip": {"value": "sin(pi/6)", "exact": true}, "value": {"re": {"neg": false, "digits": "5", "exp": -1, "sticky": false}, "im": {"neg": false, "digits": "", "exp": 0, "sticky": false}}},
  "cas numeric": {"approximate": false, "full": F40, "fullExact": false, "facts": {"exact": false, "reliableDigits": 40}, "chip": {"value": F40, "exact": false, "reliableDigits": 40}, "value": {"re": {"neg": false, "digits": "141421356237", "exp": 0, "sticky": true}, "im": {"neg": false, "digits": "", "exp": 0, "sticky": false}}},
  "cas true on a float": {"approximate": true, "full": "true", "fullExact": true, "facts": {"exact": false, "reliableDigits": null}, "chip": {"value": "true", "exact": true}},
  "cas true from an inexact chip": {"approximate": true, "full": "true", "fullExact": false, "facts": {"exact": false, "reliableDigits": null}, "chip": {"value": "true", "exact": false, "reliableDigits": null}},
  "cas non-number with a float (G27)": {"approximate": true, "full": "x+0.5", "fullExact": false, "facts": {"exact": false, "reliableDigits": null, "warn": "unchecked"}, "chip": {"value": "x+0.5", "exact": false, "reliableDigits": null, "warn": "unchecked"}},
  "cas too long": {"approximate": false, "chip": null},
  "cas error": {"approximate": false, "chip": null},
};

const done = (r: { ok: boolean }, it: ItemResult) => chipOf({ status: r.ok ? "done" : "error", ...it }) ?? null;

describe("homeItem", () => {
  for (const [name, r, inexact] of HOME_ROWS)
    it(name, () => {
      const got = homeItem(r, inexact);
      const { chip, ...want } = EXPECT[`home ${name}`]!;
      expect(got).toEqual({ ...want, ...(r.value ? { value: r.value } : {}) });
      expect(done(r, got)).toEqual(chip);
    });
});

describe("casItem", () => {
  for (const [name, r, inexact] of CAS_ROWS)
    it(name, () => {
      const got = casItem(r, inexact);
      const { chip, ...want } = EXPECT[`cas ${name}`]!;
      expect(got).toEqual(want);
      expect(done(r, got)).toEqual(chip);
    });
});

describe("chipOf and chipFactsOf", () => {
  it("an item that is not finished, or has no chip text, gives no chip", () => {
    expect(chipOf({ status: "pending", full: "1", fullExact: true })).toBeUndefined();
    expect(chipOf({ status: "done" })).toBeUndefined();
  });
  it("a chip that is not exact and has no facts carries none", () => {
    expect(chipOf({ status: "done", full: "2.5", fullExact: false })).toEqual({ value: "2.5", exact: false });
  });
  it("named chips go to the engine with their facts; a missing reliableDigits is null", () => {
    expect(chipFactsOf({ "1": { value: "0.33333", exact: false, reliableDigits: 5, warn: "unchecked" }, "2": { value: "1/3", exact: true } })).toEqual({
      "1": { value: "0.33333", reliableDigits: 5, exact: false, warn: "unchecked" },
      "2": { value: "1/3", reliableDigits: null, exact: true },
    });
  });
});
