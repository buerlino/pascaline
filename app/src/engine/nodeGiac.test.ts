// SPDX-License-Identifier: GPL-3.0-or-later
// G146: ENGINE=required turns a missing engine into a failure (giacAvailable), not a skip.
import { afterEach, describe, expect, it } from "vitest";
import { ENGINE_REQUIRED_ENV, giacAvailable } from "./nodeGiac.ts";

const saved = { mjs: process.env["GIAC_MJS"], req: process.env[ENGINE_REQUIRED_ENV] };
const restore = (k: string, v: string | undefined): void => {
  if (v === undefined) delete process.env[k];
  else process.env[k] = v;
};
afterEach(() => {
  restore("GIAC_MJS", saved.mjs);
  restore(ENGINE_REQUIRED_ENV, saved.req);
});

describe("giacAvailable", () => {
  const missing = "/nonexistent/g146/giac.mjs";
  it("is false for a missing engine without ENGINE=required (the tests skip)", () => {
    process.env["GIAC_MJS"] = missing;
    delete process.env[ENGINE_REQUIRED_ENV];
    expect(giacAvailable()).toBe(false);
  });
  it("throws for a missing engine with ENGINE=required, naming the path", () => {
    process.env["GIAC_MJS"] = missing;
    process.env[ENGINE_REQUIRED_ENV] = "required";
    expect(() => giacAvailable()).toThrow(/ENGINE=required.*\/nonexistent\/g146\/giac\.mjs/);
  });
  it("is true for a present file with ENGINE=required", () => {
    process.env["GIAC_MJS"] = new URL(import.meta.url).pathname; // any file that exists
    process.env[ENGINE_REQUIRED_ENV] = "required";
    expect(giacAvailable()).toBe(true);
  });
});
