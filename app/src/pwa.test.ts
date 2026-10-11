// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { shouldRegister, type PwaEnv } from "./pwa.ts";

const web: PwaEnv = { prod: true, hasServiceWorker: true, native: false, search: "" };

describe("shouldRegister", () => {
  it("registers in the production web build", () => {
    expect(shouldRegister(web)).toBe(true);
    expect(shouldRegister({ ...web, search: "?foo=1" })).toBe(true);
  });
  it("does not register in dev, without service worker support, or in the Capacitor shell", () => {
    expect(shouldRegister({ ...web, prod: false })).toBe(false);
    expect(shouldRegister({ ...web, hasServiceWorker: false })).toBe(false);
    expect(shouldRegister({ ...web, native: true })).toBe(false);
  });
  it("does not register for ?bench= and ?engine= runs", () => {
    expect(shouldRegister({ ...web, search: "?bench=1" })).toBe(false);
    expect(shouldRegister({ ...web, search: "?engine=fake" })).toBe(false);
  });
});
