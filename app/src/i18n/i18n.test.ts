// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { keyboard } from "../keyboard/keyboard.ts";
import { legend, t } from "./index.ts";

describe("i18n", () => {
  it("resolves every $-legend used by the keyboard", () => {
    for (const k of keyboard.keys) for (const l of Object.values(k.label)) expect(() => legend(l)).not.toThrow();
  });
  it("names every palette cell and title (Tmpl, Shift + 6, Shift + 9)", () => {
    for (const [prefix, p] of [["tmpl", keyboard.palette], ["rel", keyboard.relations], ["sym", keyboard.symbols]] as const) {
      expect(() => legend(`$${prefix}.title`)).not.toThrow();
      for (const it of p.items) expect(() => legend(`$${prefix}.${it.id}`), `${prefix}.${it.id}`).not.toThrow();
    }
  });
  it("passes plain legends through", () => {
    expect(legend("sin⁻¹")).toBe("sin⁻¹");
    expect(legend("$key.enter")).toBe(t("key.enter"));
  });
  it("throws on an unknown message", () => {
    expect(() => legend("$nope")).toThrow(/missing message/);
  });
});
