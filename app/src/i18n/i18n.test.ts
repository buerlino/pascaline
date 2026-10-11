// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { keyboard } from "../keyboard/keyboard.ts";
import { legend, t } from "./index.ts";

describe("i18n", () => {
  it("resolves every $-legend used by the keyboard", () => {
    for (const k of keyboard.keys) for (const l of Object.values(k.label)) expect(() => legend(l)).not.toThrow();
  });
  it("passes plain legends through", () => {
    expect(legend("sin⁻¹")).toBe("sin⁻¹");
    expect(legend("$key.enter")).toBe(t("key.enter"));
  });
  it("throws on an unknown message", () => {
    expect(() => legend("$nope")).toThrow(/missing message/);
  });
});
