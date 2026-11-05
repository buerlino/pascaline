// SPDX-License-Identifier: GPL-3.0-or-later
// G164: the sample library the engineer's AI copies the shape of (app/public/samples/materials.txt). The rules a value
// line keeps (a source comment, a unit in words) are checked on the text without an engine; the file's own `// test:`
// lines run on the real one through the library reader and import, as the phone runs them.
import { existsSync, readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { giacAvailable, loadNodeGiac, nodeHost } from "./nodeGiac.ts";
import type { GiacParse } from "./bridge.ts";
import { importLibrary, parseLibrary } from "./library.ts";
import { LIBRARY_FORMAT } from "../state/libraryFormat.ts";

const SAMPLE = new URL("../../public/samples/materials.txt", import.meta.url);
/** The units a value's description may name, in words after "in" (SI only: the file holds SI values). */
const UNIT_IN_WORDS = / in (Pa|kg\/m³|1\/K|W\/\(m·K\))(\s|$|[,;(])/;
const SOURCE = /^\/\/ source: \S.*\S$/;
const TO_VERIFY = "(to verify: owner)";

describe("the sample library file (G164, no engine)", () => {
  it("exists where the app serves it (a missing file fails here, not as a skip)", () => {
    expect(existsSync(SAMPLE)).toBe(true);
  });
  const lines = existsSync(SAMPLE) ? readFileSync(SAMPLE, "utf8").split("\n") : [];
  it("starts with the stamp and says it is an example of the format, not a material table", () => {
    // the stamp an export wrote when the file was made: a later DATA_VERSION still reads it (its migration steps)
    expect(Number(/^\/\/ pascaline library (\d+)$/.exec(lines[0] ?? "")?.[1])).toBeLessThanOrEqual(LIBRARY_FORMAT.version);
    expect(lines[0]).toMatch(/^\/\/ pascaline library [1-9]\d*$/);
    const head = lines.slice(0, lines.findIndex((l) => l.trim() === "")).join(" ");
    expect(head).toMatch(/example of the library format/);
    expect(head).toMatch(/not a material table/);
  });
  // a value line: a definition at column 0 without an argument list (`name:=…`)
  const values = lines.map((l, i) => ({ l, i })).filter(({ l }) => /^[A-Za-z]\w*:=/.test(l));
  it("holds values (four materials, four properties each)", () => {
    expect(values.length).toBe(16);
  });
  for (const { l, i } of values) {
    const name = l.slice(0, l.indexOf(":="));
    it(`${name}: exact SI value, its unit in words, its source above the description`, () => {
      // `<integer>*10^<n>` or an integer: exact, never a Giac float (r10-connector.md 1.1)
      expect(l.slice(l.indexOf(":=") + 2)).toMatch(/^\d+(\*10\^-?\d+)?$/);
      expect(lines[i - 1]).toMatch(UNIT_IN_WORDS);
      expect(lines[i - 2]).toMatch(SOURCE);
      // a source not checked against a document the worker could quote says so (G164 point 3)
      if (!lines[i - 2]!.includes("verified:")) expect(lines[i - 2]!.endsWith(TO_VERIFY)).toBe(true);
    });
  }
});

describe.skipIf(!giacAvailable())("the sample library file (G164, real Giac)", () => {
  let parse: (text: string) => GiacParse;
  beforeAll(async () => {
    parse = (await loadNodeGiac()).bridge.parse;
  });
  it("reads, imports and passes every one of its own `// test:` lines", async () => {
    const lib = parseLibrary(readFileSync(SAMPLE), parse, LIBRARY_FORMAT);
    const fns = lib.defs.filter((d) => d.kind === "fn");
    expect(fns.map((d) => d.name)).toEqual(["thermal_strain", "axial_stiffness"]);
    for (const f of fns) expect(f.tests.length, f.name).toBeGreaterThan(0);
    const r = importLibrary(await nodeHost(), lib, []);
    if (!r.ok) throw new Error(r.error);
    expect(r.tests).toBe(lib.defs.reduce((n, d) => n + d.tests.length, 0));
    expect(r.plan.added.length).toBe(lib.defs.length);
  });
});
