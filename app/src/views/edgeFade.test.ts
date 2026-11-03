// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { cutEdges } from "./edgeFade.ts";

describe("cutEdges (docs/05 3.5: a long history line fades at the edge with more behind it)", () => {
  it("a line that fits is not cut", () => {
    expect(cutEdges(0, 300, 300)).toBeUndefined();
    expect(cutEdges(0, 300, 301)).toBeUndefined(); // a pixel of rounding
  });
  it("a long line at its start is cut at the end, scrolled to its end at the start, in between at both", () => {
    expect(cutEdges(0, 300, 500)).toBe("end");
    expect(cutEdges(200, 300, 500)).toBe("start");
    expect(cutEdges(100, 300, 500)).toBe("both");
  });
  it("a right-to-left box (negative scrollLeft) reads the same", () => {
    expect(cutEdges(-100, 300, 500)).toBe("both");
  });
});
