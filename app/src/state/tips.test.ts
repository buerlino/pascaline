// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { tipsDue, TIPS_SEEN } from "./tips.ts";

describe("the first-start tips flag (R15c4)", () => {
  it("is due when nothing is stored, and not when the flag is there", async () => {
    expect(await tipsDue("", async () => ({ kind: "none" }))).toBe(true);
    expect(await tipsDue("", async () => ({ kind: "value", value: true }))).toBe(false);
  });
  it("is not due when the store could not be read: the flag may be in it", async () => {
    expect(await tipsDue("", async () => ({ kind: "failed" }))).toBe(false);
  });
  it("reads its own key", async () => {
    const keys: string[] = [];
    await tipsDue("", async (k) => (keys.push(k), { kind: "none" }));
    expect(keys).toEqual([TIPS_SEEN]);
  });
  it("?tips=off hides them without reading the store", async () => {
    expect(await tipsDue("?engine=fake&tips=off", async () => ({ kind: "none" }))).toBe(false);
    expect(await tipsDue("?tips=on", async () => ({ kind: "none" }))).toBe(true);
    expect(await tipsDue("?tips=off", async () => { throw new Error("read"); })).toBe(false);
  });
});
