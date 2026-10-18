// SPDX-License-Identifier: GPL-3.0-or-later
// σ to 2 significant digits and the value rounded to its last digit (G18, docs/04 2.6).
import { describe, expect, it } from "vitest";
import { shownWithUncertainty, uncertaintyText } from "./uncertainty.ts";

describe("uncertainty text (G18)", () => {
  it("σ is 2 significant digits, a trailing zero kept", () => {
    expect(uncertaintyText("1.2443295383458515")).toBe("1.2");
    expect(uncertaintyText("0.1")).toBe("0.10");
    expect(uncertaintyText("0.0999")).toBe("0.10");
    expect(uncertaintyText("9.96")).toBe("10");
    expect(uncertaintyText("12443.3")).toBe("12000");
    expect(uncertaintyText("1.5e-15")).toBe("1.5E-15");
    expect(uncertaintyText("0")).toBe("0");
    expect(uncertaintyText("x")).toBeNull();
  });
  it("the value is rounded to σ's last digit", () => {
    expect(shownWithUncertainty("39.488", "1.2443295383", "39.488")).toBe("39.5 ± 1.2");
    expect(shownWithUncertainty("2.5", "0.080039", "2.5")).toBe("2.500 ± 0.080");
    expect(shownWithUncertainty("394880", "12443.3", "394880")).toBe("395000 ± 12000");
    expect(shownWithUncertainty("-0.004", "0.28", "-0.004")).toBe("0.00 ± 0.28");
    expect(shownWithUncertainty("1.5", "0", "1.5")).toBe("1.5 ± 0");
    expect(shownWithUncertainty("6.6743E-11", "1.5e-15", "6.6743E-11")).toBe("6.67430E-11 ± 1.5E-15");
  });
});
