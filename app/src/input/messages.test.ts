// SPDX-License-Identifier: GPL-3.0-or-later
// R52: no parser or emitter message is written into the code; every error site names a key of i18n/enParser.ts.
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { enParser } from "../i18n/enParser.ts";

const dir = new URL(".", import.meta.url);
const sources = readdirSync(dir)
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && f !== "errors.ts")
  .map((f) => ({ f, src: readFileSync(new URL(f, dir), "utf8") }));

describe("parser messages are in the table", () => {
  it("no `new SerializeError(` outside errors.ts", () => {
    for (const { f, src } of sources) expect(src.match(/new SerializeError\(/g) ?? [], f).toEqual([]);
  });
  it("every parseError / fail takes a key that exists", () => {
    const keys = new Set(Object.keys(enParser));
    let n = 0;
    for (const { f, src } of sources)
      for (const m of src.matchAll(/(?<![\w.])(?:this\.)?(?:parseError|fail)\(\s*([^,)]*)/g)) {
        const arg = (m[1] ?? "").trim();
        if (/^\w+: ParseKey$/.test(arg) || arg.startsWith("t ?") || arg === "key") continue; // the definitions and the pass-through
        const lit = /^"(parse\.\w+)"$/.exec(arg);
        expect(lit && keys.has(lit[1] as string), `${f}: ${arg}`).toBe(true);
        n++;
      }
    expect(n).toBeGreaterThan(60);
  });
  it("every table key is used", () => {
    const all = sources.map((s) => s.src).join("\n");
    for (const k of Object.keys(enParser)) expect(all.includes(`"${k}"`), k).toBe(true);
  });
});
