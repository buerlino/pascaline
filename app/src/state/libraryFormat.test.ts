// SPDX-License-Identifier: GPL-3.0-or-later
// R59: upToDate brings an older library file to DATA_VERSION before the worker sees it: the stamp rewritten, the text
// migrated (2 → 3: pasexp goes, G46), every line where the file had it; anything else goes on as it came.
import { describe, expect, it } from "vitest";
import { upToDate } from "./libraryFormat.ts";
import { DATA_VERSION } from "./storage.ts";
import { LIB_MAX_BYTES } from "../engine/libraryHeader.ts";
import { READ_CAP } from "../views/libraryJobs.ts";

const v2 = "// pascaline library 2\n// phasor\nph(w):=pasexp(i*w)\n// test: simplify(ph(pi)+1)==0\n";

describe("upToDate (no engine)", () => {
  it("a version-2 file: the stamp names DATA_VERSION, pasexp is exp, the lines stay where they were", () => {
    const out = upToDate(v2);
    expect(typeof out).toBe("string");
    const lines = (out as string).split("\n");
    expect(lines[0]).toBe(`// pascaline library ${DATA_VERSION}`);
    expect(lines.slice(1)).toEqual(["// phasor", "ph(w):=exp(i*w)", "// test: simplify(ph(pi)+1)==0", ""]);
    expect(out).not.toMatch(/pasexp/);
  });
  it("bytes with a BOM and CR LF: the same text, one line each", () => {
    const bytes = new TextEncoder().encode("\ufeff" + v2.replace(/\n/g, "\r\n"));
    expect(upToDate(bytes)).toBe(upToDate(v2));
  });
  it("up to date, a missing or newer stamp, or not UTF-8: unchanged, for the reader to take or refuse", () => {
    const now = `// pascaline library ${DATA_VERSION}\n// x\nf(x):=pasexp(x)\n`;
    expect(upToDate(now)).toBe(now);
    expect(upToDate("// no stamp\nf(x):=x\n")).toBe("// no stamp\nf(x):=x\n");
    const newer = `// pascaline library ${DATA_VERSION + 1}\n`;
    expect(upToDate(newer)).toBe(newer);
    const bad = new Uint8Array([0x2f, 0x2f, 0xff]);
    expect(upToDate(bad)).toBe(bad);
  });
  it("over the limit: unchanged, even where the migration would bring it under (a picked file cut at READ_CAP)", () => {
    // ~300 kB of version-2 definitions; each pasexp is 3 bytes longer than the exp it becomes
    const defs = Array.from({ length: 7500 }, (_, k) => `// d${k}\nd${k}(w):=pasexp(w)+pasexp(2*w)`).join("\n");
    const whole = new TextEncoder().encode(`// pascaline library 2\n${defs}\n`);
    expect(whole.length).toBeGreaterThan(READ_CAP);
    const cut = whole.slice(0, READ_CAP); // what importFile reads of it
    const decoded = new TextDecoder().decode(cut);
    expect(new TextEncoder().encode(decoded.replaceAll("pasexp", "exp")).length).toBeLessThanOrEqual(LIB_MAX_BYTES);
    expect(upToDate(cut)).toBe(cut);
    expect(upToDate(decoded)).toBe(decoded);
  });
});
