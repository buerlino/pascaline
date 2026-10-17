// SPDX-License-Identifier: GPL-3.0-or-later
// R47 (bug F39): ⌫ between a function's name and its bracket. ◀ ▶ never stop in `log‸(100)` (R27b, `isStop`), but a
// finger tap did, and ⌫ there deleted the name alone: `(100)` with the cursor at the line's start. Two halves:
// a tap never leaves the cursor where ◀ ▶ cannot stop (it moves on to the next stop, the body's start), and ⌫ at that
// position acts as at the start of the body (decisions.md "⌫ and Del keep a template whole" point 4: the template goes,
// its content stays, the cursor where the name was). Del there is point 5's: right before the pair, it steps into the
// body. Every named function key comes from spec/keyboard.yaml; expected lines are derived from the rule.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { parse } from "yaml";
import { entryValue, open, tap } from "./helpers.ts";

const here = dirname(fileURLToPath(import.meta.url));
interface Act { insert?: string; line?: { insert?: string } }
interface Cell { id: string; insert?: string }
const doc = parse(readFileSync(join(here, "../../spec/keyboard.yaml"), "utf8")) as {
  keys: Record<string, unknown>[];
  templates: { items: Cell[] };
  relations: { items: Cell[] };
};

/** A named function: a name (with a log base's subscript) right before its pair, `#0` the pair's first box. */
const NAMED = /^\\(?:[a-z]+|operatorname\{[^{}]*\})(?:_\{#\?\})?\\left\(#0(?:,#\?)?\\right\)$/;

function named(): { name: string; insert: string }[] {
  const out: { name: string; insert: string }[] = [];
  const add = (name: string, insert: string | undefined): void => {
    if (insert !== undefined && NAMED.test(insert) && !out.some((t) => t.insert === insert)) out.push({ name, insert });
  };
  for (const key of doc.keys) {
    for (const layer of ["primary", "shift", "alpha"]) {
      const a = key[layer] as Act | undefined;
      add(`${key["id"] as string}/${layer}`, a?.insert);
      add(`${key["id"] as string}/${layer}/line`, a?.line?.insert);
    }
  }
  for (const c of [...doc.templates.items, ...doc.relations.items]) add(c.id, c.insert);
  return out;
}
const NAMED_KEYS = named();

/** The template with its main box `body` and its other boxes `other` (□ when empty). */
const fill = (insert: string, body: string, other = "\\placeholder{}"): string =>
  insert.replace("#0", body).replaceAll("#?", other);

interface State { value: string; position: number; collapsed: boolean }

/**
 * Put `latex` on the line, the cursor between the (last) top-level name and its pair, and return that offset.
 * The name is the depth-0 atom right before the pair's body sentinel.
 */
async function atName(page: Page, latex: string): Promise<number> {
  return page.evaluate((l) => {
    const mf = window.pascaline.entry.field;
    if (!mf) throw new Error("no field");
    mf.value = l;
    mf.focus();
    let at = -1;
    for (let o = 1; o < mf.lastOffset; o++) {
      const here = mf.getElementInfo(o);
      const next = mf.getElementInfo(o + 1);
      if ((here?.depth ?? 0) === 0 && /^\\(?:[a-z]+|operatorname)/.test(here?.latex ?? "") && (next?.depth ?? 0) === 1) {
        // o + 1 starts a box one level down: the pair's body when the pair's atom follows that box
        let q = o + 1;
        while (q <= mf.lastOffset && (mf.getElementInfo(q)?.depth ?? 0) > 0) q++;
        if ((mf.getElementInfo(q)?.latex ?? "").startsWith("\\left(")) at = o;
      }
    }
    if (at < 0) throw new Error(`no name before a pair in ${l}`);
    mf.position = at;
    return at;
  }, latex);
}

/** Run ⌫ (dir −1) or Del (dir +1) through the key path and return the state after it. */
async function press(page: Page, dir: -1 | 1): Promise<State> {
  return page.evaluate((d) => {
    const { entry } = window.pascaline;
    entry.run({ kind: "cmd", name: d < 0 ? "deleteBackward" : "deleteForward" });
    const mf = entry.field;
    if (!mf) throw new Error("no field");
    return { value: mf.value, position: mf.position, collapsed: mf.selectionIsCollapsed };
  }, dir);
}

test.describe("⌫ between a name and its bracket, every named function key", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
  });

  test("the yaml has the named keys this suite is about", () => {
    const names = NAMED_KEYS.map((t) => t.insert);
    for (const n of ["\\log", "\\ln", "\\sin", "\\cos", "\\tan", "\\arcsin", "\\arccos", "\\arctan", "\\operatorname{sqrt}"]) {
      expect(names.some((i) => i.startsWith(`${n}\\left(`)), n).toBe(true);
    }
  });

  for (const { name, insert } of NAMED_KEYS) {
    test(`${name}: Del at name‸(2) steps into the body and deletes nothing`, async ({ page }) => {
      const line = fill(insert, "2");
      const at = await atName(page, line);
      const s = await press(page, 1);
      expect(s.value).toBe(line);
      expect(s.position).toBe(at + 1); // the body's start (its sentinel follows the name)
    });

    if (insert.includes("_{#?}")) {
      // a name with a box of its own (the log base): the body is its second box, so ⌫ at the body's start steps to the
      // end of the box before it and deletes nothing (point 3)
      for (const base of ["3", "\\placeholder{}"]) {
        test(`${name}: name‸(2) with base ${base} ⌫ steps into the base`, async ({ page }) => {
          const line = fill(insert, "2", base);
          const at = await atName(page, line);
          const s = await press(page, -1);
          expect(s.value).toBe(line);
          const inBase = await page.evaluate(() => {
            const mf = window.pascaline.entry.field;
            if (!mf) throw new Error("no field");
            const [a, b] = mf.selection.ranges[0] ?? [mf.position, mf.position];
            return { from: Math.min(a, b), to: Math.max(a, b), depth: mf.getElementInfo(Math.max(a, b))?.depth ?? 0 };
          });
          expect(inBase.to).toBe(at - 1); // the base's last atom: the name's parts come right before it
          expect(inBase.depth).toBe(1);
        });
      }
      continue;
    }

    test(`${name}: name‸(2) ⌫ keeps 2, the cursor where the name was`, async ({ page }) => {
      await atName(page, fill(insert, "2"));
      const s = await press(page, -1);
      expect(s.value).toBe("2");
      expect(s.position).toBe(0);
      expect(s.collapsed).toBe(true);
    });

    test(`${name}: 1+name‸(2) ⌫ is 1+2, the cursor after the +`, async ({ page }) => {
      await atName(page, `1+${fill(insert, "2")}`);
      const s = await press(page, -1);
      expect(s.value).toBe("1+2");
      expect(s.position).toBe(2);
    });

    test(`${name}: name‸(□) ⌫ empties the line`, async ({ page }) => {
      await atName(page, fill(insert, "\\placeholder{}"));
      expect((await press(page, -1)).value).toBe("");
    });

    if (insert.includes("#?")) {
      test(`${name}: with its other box filled, ⌫ selects the template, a second ⌫ deletes it`, async ({ page }) => {
        const line = fill(insert, "2", "3");
        await atName(page, line);
        const first = await press(page, -1);
        expect(first.value).toBe(line);
        expect(first.collapsed).toBe(false);
        expect((await press(page, -1)).value).toBe("");
      });
    }

  }
});

test.describe("a finger tap at a name's right edge", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
  });

  /** Put `latex` on the line, then tap 1 px inside the right edge of the name's glyphs (where F39 put the cursor). */
  async function tapNameEdge(page: Page, latex: string, mouse = false): Promise<void> {
    await page.evaluate((l) => {
      const mf = window.pascaline.entry.field;
      if (!mf) throw new Error("no field");
      mf.value = l;
      mf.focus();
      mf.executeCommand("moveToMathfieldEnd");
    }, latex);
    await page.waitForTimeout(550); // MathLive reads a second tap within 500 ms as a double tap
    const p = await page.evaluate(() => {
      const root = window.pascaline.entry.field?.shadowRoot;
      const el = [...(root?.querySelectorAll("[data-atom-id]") ?? [])].find((e) => e.textContent === "log");
      if (!el) throw new Error("no log atom");
      const r = el.getBoundingClientRect();
      return { x: r.right - 1, y: r.top + r.height / 2 };
    });
    if (mouse) await page.mouse.click(p.x, p.y);
    else await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(80);
  }

  const caret = (page: Page): Promise<{ position: number; collapsed: boolean }> =>
    page.evaluate(() => {
      const mf = window.pascaline.entry.field;
      return { position: mf?.position ?? -1, collapsed: mf?.selectionIsCollapsed ?? false };
    });

  for (const mouse of [false, true]) {
    test(`${mouse ? "a mouse click" : "a tap"} never leaves the cursor between log and (`, async ({ page }) => {
      await tapNameEdge(page, "\\log\\left(100\\right)", mouse);
      // `\log` is offset 1, the body's sentinel 2: the cursor is at the body's start, never at 1
      expect(await caret(page)).toEqual({ position: 2, collapsed: true });
    });
  }

  test("tap at log's edge, then ⌫ until the line is empty: one change per press", async ({ page }) => {
    await tapNameEdge(page, "2+\\log\\left(100\\right)");
    const seen = [`${await entryValue(page)}@${(await caret(page)).position}`];
    // ⌫ from the tap: the template goes and keeps 100, then the +, then the 2; the cursor is then at the line's start
    for (const want of ["2+100", "2100", "100"]) {
      await tap(page, ["bksp"]);
      expect(await entryValue(page)).toBe(want);
    }
    expect((await caret(page)).position).toBe(0);
    // the rest from the line's end: a tap there, then ⌫ per character
    const end = await page.evaluate(() => {
      const atoms = [...(window.pascaline.entry.field?.shadowRoot?.querySelectorAll("[data-atom-id]") ?? [])];
      const r = atoms.map((e) => e.getBoundingClientRect()).filter((b) => b.width > 0).sort((a, b) => b.right - a.right)[0];
      if (!r) throw new Error("no atoms");
      return { x: r.right + 3, y: r.top + r.height / 2 };
    });
    await page.waitForTimeout(550);
    await page.touchscreen.tap(end.x, end.y);
    await page.waitForTimeout(80);
    for (let k = 0; k < 8 && (await entryValue(page)) !== ""; k++) {
      await tap(page, ["bksp"]);
      const now = `${await entryValue(page)}@${(await caret(page)).position}`;
      expect(seen, `⌫ changed nothing at ${now}`).not.toContain(now);
      seen.push(now);
    }
    expect(await entryValue(page)).toBe("");
  });

  test("tap at the edge of an empty log(□), then ⌫ empties the line", async ({ page }) => {
    await tapNameEdge(page, "\\log\\left(\\placeholder{}\\right)");
    await tap(page, ["bksp"]);
    expect(await entryValue(page)).toBe("");
  });
});
