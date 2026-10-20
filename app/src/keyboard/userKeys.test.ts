// SPDX-License-Identifier: GPL-3.0-or-later
// The free keys U1–U6 (R15b, R15c): defaults from spec/keyboard.yaml, the user's slots over them, kept in the stamped store.
import { describe, expect, it } from "vitest";
import { legend } from "../i18n/index.ts";
import { stamp, unstamp, USER_KEYS, type Kv } from "../state/storage.ts";
import { actionFor, KeyboardSpecError, keyboard, labelFor, type Key } from "./keyboard.ts";
import { USER_KEY_IDS, UserKeys } from "./userKeys.svelte.ts";

function memKv(): Kv & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    get: <T>(k: string) => Promise.resolve(data.get(k) as T | undefined),
    set: (k: string, v: unknown) => {
      data.set(k, structuredClone(v));
      return Promise.resolve();
    },
  };
}
const key = (id: string): Key => keyboard.byId.get(id) as Key;
const sinh = { label: "sinh", action: { insert: "\\sinh\\left(#0\\right)" } };

describe("user keys (R15b)", () => {
  it("are U1 … U6; before anything is set they are the defaults, all empty (R15c: no Home or CAS on U2, U3)", () => {
    const u = new UserKeys(memKv());
    expect(USER_KEY_IDS).toEqual(["u1", "u2", "u3", "u4", "u5", "u6"]);
    expect(u.resolve(key("u2"))).toBe(key("u2"));
    for (const id of USER_KEY_IDS) {
      expect(actionFor(u.resolve(key(id)), false, false), id).toEqual({ kind: "special", name: "none" });
      expect(u.isEmpty(key(id)), id).toBe(true);
    }
    // any other key is passed through as it is
    expect(u.resolve(key("sin"))).toBe(key("sin"));
  });

  it("a slot set by the user replaces its default, in the tap and in the Shift layer, and is stored", async () => {
    const kv = memKv();
    const u = new UserKeys(kv);
    u.set("u1", "primary", sinh);
    u.set("u2", "shift", { label: "Settings", action: { special: "settings" } });
    const u1 = u.resolve(key("u1"));
    expect(actionFor(u1, false, false)).toEqual({ kind: "insert", latex: "\\sinh\\left(#0\\right)" });
    expect(legend(labelFor(u1, false, false))).toBe("sinh");
    expect(u.isEmpty(key("u1"))).toBe(false);
    const u2 = u.resolve(key("u2"));
    expect(actionFor(u2, false, false)).toEqual({ kind: "special", name: "none" }); // its tap keeps the default (empty)
    expect(actionFor(u2, true, false)).toEqual({ kind: "special", name: "settings" });
    expect(u2.label.shift).toBe("Settings");
    expect(kv.data.get(USER_KEYS)).toEqual({ u1: { primary: sinh }, u2: { shift: { label: "Settings", action: { special: "settings" } } } });
    // after a relaunch
    const again = new UserKeys(kv);
    expect(again.isEmpty(key("u1"))).toBe(true);
    await again.restore();
    expect(actionFor(again.resolve(key("u1")), false, false)).toEqual({ kind: "insert", latex: "\\sinh\\left(#0\\right)" });
    expect(actionFor(again.resolve(key("u2")), true, false)).toEqual({ kind: "special", name: "settings" });
  });

  it("the user's choice wins over the default: an emptied U2 stays empty, and reset gives the default back", async () => {
    const kv = memKv();
    const u = new UserKeys(kv);
    u.set("u2", "primary", sinh);
    u.set("u2", "primary", null);
    const u2 = u.resolve(key("u2"));
    expect(actionFor(u2, false, false)).toEqual({ kind: "special", name: "none" });
    expect(u2.label.primary).toBe("$key.user");
    expect(u.isEmpty(key("u2"))).toBe(true);
    const again = new UserKeys(kv);
    await again.restore();
    expect(again.isEmpty(key("u2"))).toBe(true);
    again.reset("u2", "primary");
    expect(again.resolve(key("u2"))).toBe(key("u2"));
    again.set("u3", "primary", sinh);
    again.set("u3", "shift", sinh);
    again.reset();
    expect(again.resolve(key("u3"))).toBe(key("u3"));
    expect(kv.data.get(USER_KEYS)).toEqual({});
  });

  it("refuses a slot that is not a keyboard action, a key that is not free, and an empty label", () => {
    const u = new UserKeys(memKv());
    expect(() => u.set("u1", "primary", { label: "x", action: { special: "nope" } })).toThrow(KeyboardSpecError);
    expect(() => u.set("u1", "primary", { label: "x", action: { insert: "x", type: "y" } })).toThrow(KeyboardSpecError);
    expect(() => u.set("sin", "primary", sinh)).toThrow(KeyboardSpecError);
    expect(() => u.set("u1", "primary", { label: "", action: { type: "x" } })).toThrow(KeyboardSpecError);
    expect(u.isEmpty(key("u1"))).toBe(true);
  });

  it("a damaged or older record never breaks the keypad: what is not valid is dropped, slot by slot", async () => {
    const stored = {
      u1: { primary: { label: "sinh", action: { insert: "\\sinh\\left(#0\\right)" } }, shift: { label: "?", action: { special: "gone" } } },
      u2: { primary: null, alpha: { label: "A", action: { type: "A" } } },
      u3: "nonsense",
      sin: { primary: { label: "cos", action: { type: "c" } } },
    };
    const kv = memKv();
    kv.data.set(USER_KEYS, stored);
    const u = new UserKeys(kv);
    await u.restore();
    expect(actionFor(u.resolve(key("u1")), false, false)).toEqual({ kind: "insert", latex: "\\sinh\\left(#0\\right)" });
    expect(u.resolve(key("u1")).actions.shift).toBeUndefined();
    expect(u.isEmpty(key("u2"))).toBe(true);
    expect(u.resolve(key("u2")).actions.alpha).toBeUndefined(); // a free key has no alpha layer
    expect(u.resolve(key("u3"))).toBe(key("u3"));
    for (const bad of [null, "x", 7]) {
      const k = memKv();
      k.data.set(USER_KEYS, bad);
      const v = new UserKeys(k);
      await v.restore();
      expect(v.resolve(key("u2"))).toBe(key("u2"));
    }
  });

  it("slots stored for U1–U3 before R15c stay valid: the ids kept their meaning, a held Home or CAS still works", async () => {
    const kv = memKv();
    kv.data.set(USER_KEYS, { u1: { primary: sinh }, u2: { primary: { label: "Home", action: { special: "home" } } }, u3: { shift: { label: "CAS", action: { special: "cas" } } } });
    const u = new UserKeys(kv);
    await u.restore();
    expect(actionFor(u.resolve(key("u1")), false, false)).toEqual({ kind: "insert", latex: "\\sinh\\left(#0\\right)" });
    expect(actionFor(u.resolve(key("u2")), false, false)).toEqual({ kind: "special", name: "home" });
    expect(actionFor(u.resolve(key("u3")), true, false)).toEqual({ kind: "special", name: "cas" });
    expect(u.isEmpty(key("u3"))).toBe(true); // its tap is still the empty default
  });

  it("a label that starts with $ is the user's text, never a message key", () => {
    const u = new UserKeys(memKv());
    u.set("u1", "primary", { label: "$", action: { type: "$" } });
    expect(legend(labelFor(u.resolve(key("u1")), false, false))).toBe("$");
  });

  it("is a stamped record (docs/04 6.2): it comes back from the store's stamp unchanged", () => {
    const v = { u1: { primary: sinh } };
    expect(unstamp(USER_KEYS, stamp(v))).toEqual({ value: v, upgraded: false });
  });
});
