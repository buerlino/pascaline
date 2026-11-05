// SPDX-License-Identifier: GPL-3.0-or-later
// R134: what people paste is plain text. Every cell of the Symbols palette, every constant chip and every unit slot's
// LaTeX (plain and rare) read through entryText leaves no backslash and no brace. The constants and units are the Find
// index's (npm run index; FIND_INDEX=required fails instead of skipping when it is missing).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { constChip } from "../entry/macros.ts";
import type { IndexItem } from "../find/types.ts";
import { SlotModel, slotCatalogue } from "../units/slot.ts";
import { entryText, PLAIN_COMMANDS } from "./text.ts";

const here = dirname(fileURLToPath(import.meta.url));
const indexFile = join(here, "../find/_gen/find-index.json");
const index: IndexItem[] = existsSync(indexFile) ? (JSON.parse(readFileSync(indexFile, "utf8")) as IndexItem[]) : [];
const hasIndex = index.some((it) => it.kind === "unit" && it.si !== undefined);
const needIndex = (): boolean => {
  if (hasIndex) return true;
  if (process.env["FIND_INDEX"] === "required") expect.fail("app/src/find/_gen/find-index.json is missing or holds functions only; run npm run index");
  return false;
};

const kb = parse(readFileSync(join(here, "../../../spec/keyboard.yaml"), "utf8")) as { symbols: { items: { id: string; insert: string; desc: string }[] } };
const PALETTE = kb.symbols.items;
const clean = (s: string): boolean => !/[\\{}]/.test(s);

describe("plain text of what is shared (R134)", () => {
  it("every insert of the Symbols palette has its text, and the command table holds no name the palette lacks for a letter", () => {
    for (const c of PALETTE) {
      const t = entryText(`2${c.insert}`);
      expect(clean(t), `${c.id}: ${t}`).toBe(true);
      const name = /^\\([A-Za-z]+)$/.exec(c.insert)?.[1];
      if (name !== undefined && !["rightarrow"].includes(name)) expect(PLAIN_COMMANDS, c.id).toContain(name);
    }
    expect(entryText("\\alpha")).toBe("α");
    expect(entryText("\\varepsilon")).toBe("ε");
    expect(entryText("\\varphi")).toBe("φ");
    expect(entryText("\\Delta")).toBe("Δ");
    expect(entryText("\\Omega")).toBe("Ω");
  });

  it("every constant chip (symbol with braces, Greek, \\mathrm) is plain", () => {
    if (!needIndex()) return;
    const consts = index.filter((it) => it.kind === "const");
    expect(consts.length).toBeGreaterThan(40);
    for (const it of consts) {
      const m = /^\\const\{([^{}]*)\}\{(.*)\}$/.exec(it.insert ?? "");
      const t = entryText(`${constChip(m?.[1] ?? "", m?.[2] ?? "")}\\times2`);
      expect(clean(t), `${it.id}: ${t}`).toBe(true);
    }
  });

  it("every unit slot's LaTeX, plain and rare, is plain", () => {
    if (!needIndex()) return;
    const cat = slotCatalogue(index);
    const ids = [...cat.units.keys()];
    expect(ids.length).toBeGreaterThan(300);
    const lines: string[] = [];
    for (const id of ids) {
      const plain = new SlotModel(cat);
      plain.apply({ do: "unit", id });
      lines.push(plain.latex);
      const rare = new SlotModel(cat);
      rare.apply({ do: "pair", prefix: "M", id });
      rare.apply({ do: "power", n: 2 });
      rare.apply({ do: "per" });
      rare.apply({ do: "unit", id: "s" });
      lines.push(rare.latex);
      const root = new SlotModel(cat);
      root.apply({ do: "sqrt" });
      root.apply({ do: "pair", prefix: "k", id });
      lines.push(root.latex);
    }
    expect(lines.some((l) => l.includes("\\class{pas-rare}"))).toBe(true);
    for (const l of lines) {
      const t = entryText(`5\\,${l}\\to\\,${l}`);
      expect(clean(t), `${l} → ${t}`).toBe(true);
    }
  });
});
