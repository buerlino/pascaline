// SPDX-License-Identifier: GPL-3.0-or-later
// R56: which single letters are calls comes from the user's names (the stored definitions log), not from the parses
// of this session, so a function defined before a relaunch still is one.
import { describe, expect, it } from "vitest";
import type { UserName } from "../engine/defs.ts";
import { latexToGiac, userFunctionsOf } from "./latex-to-giac.ts";

const name = (n: string, kind: UserName["kind"]): UserName => ({ name: n, kind, preview: "", view: "home", time: 0 });

describe("userFunctionsOf (R56)", () => {
  // as the defs log replays them after a relaunch: p a function, F a value, area a longer function name
  const names = [name("p", "fn"), name("F", "var"), name("area", "fn")];
  const user = userFunctionsOf(names);

  it("a stored single-letter function is a call", () => {
    expect(latexToGiac("p\\left(2\\right)", { userFunctions: user })).toBe("p(2)");
  });
  it("a stored value followed by brackets is a product", () => {
    expect(latexToGiac("F\\left(2\\right)", { userFunctions: user })).toBe("F*(2)");
  });
  it("f, g and h stay functions; longer names are not listed", () => {
    expect([...user].sort()).toEqual(["f", "g", "h", "p"]);
    expect(latexToGiac("f\\left(2\\right)", { userFunctions: userFunctionsOf([]) })).toBe("f(2)");
  });
  it("without the list a parse knows only f, g, h: no state is kept between parses", () => {
    expect(latexToGiac("p\\left(x\\right):=x^{2}")).toBe("p(x):=x^2");
    expect(latexToGiac("p\\left(2\\right)")).toBe("p*(2)");
  });
});
