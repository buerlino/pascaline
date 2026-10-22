// SPDX-License-Identifier: GPL-3.0-or-later
// G86 (audit fix 1, item 2): a Solve root and a Function cell go to Copy with their facts whole (numberSource), so the
// mark Copy reads is the one the app showed: a ⚠ root (warn, every digit confirmed) is ⚠, not ≈; an exact cell with a
// short decimal value is =; an inexact one ≈. Before G86 the apps passed only reliableDigits (⚠ root → ≈, exact cell → ≈).
import { describe, expect, it } from "vitest";
import { decimalFromString, ZERO_VALUE, type ComplexValue } from "../engine/format.ts";
import type { Cell } from "../apps/function/engineApi.ts";
import { numberSource } from "./source.ts";
import { copyFull, copyMark } from "./text.ts";

const re = (s: string): ComplexValue => ({ re: decimalFromString(s) ?? ZERO_VALUE, im: ZERO_VALUE });

describe("numberSource: Copy's mark of a Solve root and a Function cell (G86)", () => {
  it("a Solve root shown with ⚠ (warn unaudited, 40 confirmed digits) copies with ⚠", () => {
    const root = { display: "1.41421356237", value: re("1.414213562373095048801688724209698078570"), full: "1.414213562373095048801688724209698078570", facts: { exact: false, reliableDigits: 40, warn: "unaudited" as const } };
    const src = numberSource(root.display, root);
    expect(copyMark(src)).toEqual({ mark: "⚠", warn: "unaudited" });
    expect(copyFull(src)).toBe("1.41421356237309504880168872420969807857");
  });
  it("a Function cell with exact facts and a short decimal value copies with =", () => {
    const cell: Cell = { ok: true, display: "0.25", value: re("0.25"), full: "1/4", facts: { exact: true, reliableDigits: null } };
    expect(copyMark(numberSource(cell.display, cell))).toEqual({ mark: "=" });
  });
  it("an inexact Function cell copies with ≈", () => {
    const cell: Cell = { ok: true, display: "0.841470984808", value: re("0.8414709848078965066525023216302989996226"), full: "0.8414709848078965066525023216302989996226", facts: { exact: false, reliableDigits: null } };
    expect(copyMark(numberSource(cell.display, cell))).toEqual({ mark: "≈" });
  });
});
