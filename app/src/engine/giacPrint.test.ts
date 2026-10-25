// SPDX-License-Identifier: GPL-3.0-or-later
// G105: the one reader of Giac text. Prints are Giac's own (probe 2026-10-25, the gsl engine): `"a\"b"` typed prints
// `"a""b"`, and `g(x):="q,(\\"` prints ` (x)->"q,(\"` (a backslash is itself in a print).
import { describe, expect, it } from "vitest";
import {
  afterStore,
  balanced,
  callsOf,
  closing,
  definedName,
  firstNameIn,
  functionsIn,
  mapNumbers,
  namesIn,
  noneOpen,
  opening,
  programParams,
  renameCalls,
  replaceLiteral,
  splitList,
  typedFromPrinted,
  stringEnd,
  topLevelArgs,
  UNCLOSED,
  walk,
  wholeCall,
  withoutStrings,
} from "./giacPrint.ts";

describe("strings", () => {
  it("typed: a backslash escapes the quote (text-9)", () => {
    expect(stringEnd('"a\\"b:=1";x', 0, "typed")).toBe(8);
    expect(withoutStrings('s:="a\\"b:=1"; x', '""', "typed")).toBe('s:=""; x');
  });
  it("printed: a doubled quote reads as two strings, a backslash is itself", () => {
    expect(stringEnd('"q,(\\"', 0, "printed")).toBe(5);
    expect(withoutStrings('s:="a""b";1', "", "printed")).toBe("s:=;1");
    expect(topLevelArgs('"q,(\\",2', "printed")).toEqual(['"q,(\\"', "2"]);
  });
  it("an unclosed string runs to the end", () => {
    expect(withoutStrings('a+"b,c', '""', "typed")).toBe('a+""');
    expect(walk('f("x', 0, () => false, "typed")).toBe(UNCLOSED);
  });
});

describe("brackets", () => {
  it("closing and opening match ( [ { and skip strings", () => {
    expect(closing('f(a,"(",[b])+1', 1, "typed")).toBe(11);
    expect(closing("f(a", 1, "typed")).toBe(-1);
    expect(opening("x+(a*[b])", 8)).toBe(2);
  });
  it("topLevelArgs splits at depth 0 only", () => {
    expect(topLevelArgs("x^2,x,0,[1,2]", "typed")).toEqual(["x^2", "x", "0", "[1,2]"]);
  });
  it("balanced and noneOpen", () => {
    expect(balanced("f(x)+[1]", "typed")).toBe(true);
    expect(balanced("f(x))(", "typed")).toBe(false);
    expect(balanced('f(")")', "typed")).toBe(true);
    expect(noneOpen("x)", "typed")).toBe(true);
    expect(noneOpen("f(x", "typed")).toBe(false);
  });
  it("splitList reads a printed list, list[…] too, and nothing else", () => {
    expect(splitList("[1,[2,3],f(4,5)]")).toEqual(["1", "[2,3]", "f(4,5)"]);
    expect(splitList("list[1,2]")).toEqual(["1", "2"]);
    expect(splitList('["a,b",1]')).toEqual(['"a,b"', "1"]);
    expect(splitList("[]")).toEqual([]);
    expect(splitList("[1,2")).toBeNull();
    expect(splitList("[1]+[2]")).toBeNull();
    expect(splitList("x")).toBeNull();
  });
});

describe("names", () => {
  it("functionsIn and namesIn skip strings and the exponent of a number", () => {
    expect(functionsIn('romberg(exp(-x^2),x,0,1)+"f(y)"', "typed")).toEqual(["romberg", "exp"]);
    expect(namesIn("B*2e5+f(x)", "typed")).toEqual(["B", "x"]);
  });
  it("callsOf gives each call with its brackets; wholeCall the arguments of a text that is one call", () => {
    expect(callsOf("1+round(x,2)*myround(y)", ["round"], "typed")).toEqual([{ name: "round", at: 2, open: 7, close: 11 }]);
    expect(wholeCall(" purge(a, b) ", "purge", "typed")).toEqual(["a", "b"]);
    expect(wholeCall("purge(a)+1", "purge", "typed")).toBeNull();
  });
  it("renames calls only, and finds a name of a set", () => {
    expect(renameCalls("erf(x)+erf+xerf(1)", { erf: "paserfv" }, "typed")).toBe("paserfv(x)+erf+xerf(1)");
    expect(firstNameIn('"Digits" + Digits', new Set(["Digits"]), "typed")).toBe("Digits");
    expect(firstNameIn('"Digits"', new Set(["Digits"]), "typed")).toBeNull();
  });
  it("reads a store's name and value, and a printed program's parameters", () => {
    expect(afterStore(" B := 2*x", "B")).toBe(" 2*x");
    expect(afterStore("Bc:=2", "B")).toBeNull();
    expect(definedName("f(x):=x")).toBe("f");
    expect(definedName("f+1")).toBeNull();
    expect(programParams(" (x,y)->x+y")).toEqual(["x", "y"]);
    expect(programParams("x->x")).toBeNull();
    expect(programParams("x->x", true)).toEqual(["x"]);
  });
});

describe("numbers", () => {
  it("mapNumbers sees literals, not names or strings", () => {
    const seen: string[] = [];
    mapNumbers('x1+2.5e-3*0x1F+"7.5"+.5', (m, e) => (seen.push(m + (e ?? "")), null), "typed");
    expect(seen).toEqual(["2.5e-3", "0", ".5"]);
  });
  it("replaceLiteral replaces whole literals only", () => {
    expect(replaceLiteral("5/10^12+15/10^12*x", "5/10^12", "5e-12")).toBe("5e-12+15/10^12*x");
  });
  it("G105f2: typedFromPrinted writes a printed backslash as a join with char(92); a doubled quote stays", () => {
    expect(typedFromPrinted('["C:\\",1]')).toBe('[("C:"+char(92)),1]');
    expect(typedFromPrinted('"a""b"+"x\\y\\"')).toBe('"a""b"+("x"+char(92)+"y"+char(92))');
    expect(typedFromPrinted('"q""\\"')).toBe('("q"""+char(92))');
    expect(typedFromPrinted("[1,2]")).toBe("[1,2]");
  });
});
