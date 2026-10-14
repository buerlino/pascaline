// SPDX-License-Identifier: GPL-3.0-or-later
// The version stamp on stored values (R18f2 verification, 2026-10-14): old records are told apart and migrated.
import { describe, expect, it } from "vitest";
import { DATA_VERSION, stamp, unstamp } from "./storage.ts";

describe("stored values carry a version", () => {
  it("round-trips a stamped value without a write-back", () => {
    expect(unstamp("history", stamp({ home: [1] }))).toEqual({ value: { home: [1] }, upgraded: false });
    expect(unstamp("view", stamp("cas"))).toEqual({ value: "cas", upgraded: false });
  });
  it("reads a value stored before versions as version 0 and writes it back", () => {
    expect(unstamp("defs", [{ name: "a" }])).toEqual({ value: [{ name: "a" }], upgraded: true });
    expect(unstamp("view", "home")).toEqual({ value: "home", upgraded: true });
  });
  it("runs the steps for its key from its version up", () => {
    const steps = { 0: { defs: (v: unknown) => String(v).replace("Psi", "Psi_") } };
    expect(unstamp("defs", "Psi+1", steps).value).toBe("Psi_+1");
    expect(unstamp("view", "Psi", steps).value).toBe("Psi");
    expect(unstamp("defs", stamp("Psi+1"), steps).value).toBe("Psi+1");
  });
  it("keeps a record from a newer version as it is", () => {
    expect(unstamp("view", { "@pascaline": DATA_VERSION + 1, value: "cas" })).toEqual({ value: "cas", upgraded: false });
  });
});
