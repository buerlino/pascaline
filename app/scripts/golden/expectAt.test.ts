// SPDX-License-Identifier: GPL-3.0-or-later
// G140: a golden case shown with ⚠ n compares its expect rounded to n digits; a complex expect part by part.
import { describe, expect, it } from "vitest";
import { expectAt } from "./lib.ts";

describe("expectAt", () => {
  it("rounds a real expect, and refuses an exact tie", () => {
    expect(expectAt("3.14159265358979", 5)).toBe("3.1416");
    expect(expectAt("-2298.08529443488825891460699352", 14)).toBe("-2298.0852944349");
    expect(expectAt("0.125", 2)).toBeNull();
  });

  it("rounds each part of a complex expect", () => {
    expect(expectAt("0.0946503206224769772718784827219+1.07667404746858117413405079475*i", 12)).toBe("0.0946503206225+1.07667404747*i");
    expect(expectAt("-0.316151281697947644880271080244-0.190453469237834686284108861969*i", 12)).toBe("-0.316151281698-0.190453469238*i");
    expect(expectAt("7.0659737358292587E-92-3.5448551322644770E-91*i", 5)).toBe("7.066E-92-3.5449E-91*i");
    expect(expectAt("2.09439510239319549230842892219*i", 12)).toBe("2.09439510239*i");
    expect(expectAt("-1.5-i", 3)).toBe("-1.5-i");
    expect(expectAt("0.25+0.125*i", 2)).toBeNull();
  });
});
