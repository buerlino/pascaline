// SPDX-License-Identifier: GPL-3.0-or-later
// The gallery's theme shots (gallery.spec.ts runs them, each under a light and a dark system): R50e, every family and
// the two switches on Home; R116, the entry line's highlights in every family's Dark and Light; R124, the mark styles;
// R125, the digit-group separators.
import type { Page } from "@playwright/test";
import { tap } from "../test/helpers.ts";

export interface LookShot {
  readonly id: string;
  readonly group: string;
  readonly title: string;
  readonly setup: (page: Page) => Promise<void>;
  /** Only this element (a CSS selector), with animations stopped (the caret does not blink away). */
  readonly element?: string;
}

const FAMILIES = ["n62", "teal", "solarized"] as const;
const name = (f: string): string => f[0]!.toUpperCase() + f.slice(1);

/** Put a look on the page as Settings › Appearance does, and wait for its lazy CSS. */
async function setLook(p: Page, patch: Record<string, unknown>): Promise<void> {
  await p.evaluate((o) => {
    const s = window.n62.session;
    s.settings.look = { ...s.settings.look, ...o };
    s.onLook?.({ ...s.settings.look });
  }, patch);
  await p.waitForFunction((f) => document.documentElement.getAttribute("data-family") === f, patch["family"] ?? "n62");
  await p.waitForTimeout(400); // the lazy CSS is in
}

/** R50e: Home with some history and the Shift key on, in each family (light and dark come with every shot), then the two switches. */
export function lookShots(someHistory: (p: Page) => Promise<void>): LookShot[] {
  const set = (patch: Record<string, unknown>) => async (p: Page) => {
    await someHistory(p);
    await tap(p, ["shift"]);
    await setLook(p, patch);
  };
  return [
    ...FAMILIES.map((family) => ({
      id: `look-${family}`,
      group: "Themes (R50e): every family, Shift on",
      title: name(family),
      setup: set({ family, brightness: "system" }),
    })),
    { id: "look-contrast", group: "Themes (R50e): the switches", title: "N62, High contrast", setup: set({ contrast: true }) },
    { id: "look-plain", group: "Themes (R50e): the switches", title: "N62, Plain keys, Shift on (colour off; the italic letters stay)", setup: set({ plain: true }) },
    { id: "look-plain-alpha", group: "Themes (R50e): the switches", title: "N62, Plain keys, Alpha on (R142: the letters are italic, nothing is bold)", setup: async (p) => { await someHistory(p); await tap(p, ["alpha"]); await setLook(p, { plain: true }); } },
    { id: "look-plain-cas", group: "Themes (R50e): the switches", title: "N62, Plain keys, CAS view, Alpha on (lower case, italic)", setup: async (p) => { await tap(p, ["@cas", "alpha"]); await setLook(p, { plain: true }); } },
    { id: "look-teal-contrast", group: "Themes (R50e): the switches", title: "Teal, High contrast (the teal lightened until black reads at 7:1)", setup: set({ family: "teal", contrast: true }) },
    { id: "look-teal-plain", group: "Themes (R50e): the switches", title: "Teal, Plain keys", setup: set({ family: "teal", plain: true }) },
    { id: "look-teal-both", group: "Themes (R50e): the switches", title: "Teal, High contrast and Plain keys together", setup: set({ family: "teal", contrast: true, plain: true }) },
  ];
}

/** R116: the entry line in four states (the caret, the cursor inside a filled pair, a selection, the unit view's field),
 *  in every family's Dark and Light; the two images of each are the light and the dark system. */
export function entryShots(): LookShot[] {
  const cases: [string, string, (p: Page) => Promise<void>][] = [
    ["caret", "the caret after 1+2", (p) => tap(p, ["d1", "add", "d2"])],
    ["pair", "the cursor inside a filled pair: 2 sin(0.5|)", (p) => tap(p, ["d2", "sin", "d0", "dot", "d5"])],
    ["selection", "a selection: 12+34 with 34 selected", async (p) => {
      await tap(p, ["d1", "d2", "add", "d3", "d4"]);
      await p.evaluate(() => {
        const mf = window.n62.entry.field;
        mf?.executeCommand("extendSelectionBackward");
        mf?.executeCommand("extendSelectionBackward");
      });
    }],
    ["units", "the unit view's field on 72 (units key)", (p) => tap(p, ["d7", "d2", "shift", "tmpl"])],
  ];
  return FAMILIES.flatMap((family) =>
    (["dark", "light"] as const).flatMap((brightness) =>
      cases.map(([id, what, run]) => ({
        id: `entry-${family}-${brightness}-${id}`,
        group: `Entry highlights (R116): ${name(family)}`,
        title: `${name(family)} ${name(brightness)}: ${what}`,
        element: ".entry",
        setup: async (p: Page) => {
          await setLook(p, { family, brightness });
          await run(p);
          await p.waitForTimeout(300);
        },
      })),
    ),
  );
}

/** R124: Settings › Numbers › Marks, the three styles on the same rows: two ⚠ with their reasons (G39 differ, G50
 *  unaudited, as why.spec.ts), a ≈ and an =. */
export function markShots(): LookShot[] {
  const rows = ["\\operatorname{int}\\left(\\operatorname{abs}\\left(x-\\sin\\left(10^{50}\\right)\\right),x,-1,1\\right)", "\\operatorname{normald\\_icdf}\\left(2,-1,0.3\\right)", "\\sqrt{2}+0.5", "\\frac{1}{4}"];
  const titles = {
    reason: "⚠ + reason (the default): each ⚠ row's reason line under it, in the warn colour, one line ellipsed",
    colour: "⚠ coloured: the rows as before R124, the marks in colour, no line",
    muted: "Muted: every mark in the muted colour, no line",
  } as const;
  return (["reason", "colour", "muted"] as const).map((m) => ({
    id: `home-marks-${m}`,
    group: "Mark style (R124)",
    title: titles[m],
    setup: async (p) => {
      await p.evaluate((style) => (window.n62.session.settings.marks = style), m);
      for (const [i, l] of rows.entries()) {
        await p.evaluate((x) => window.n62.session.submit(x), l);
        await p.waitForFunction((k) => document.querySelectorAll('[data-status="done"]').length >= k, i + 1);
      }
    },
  }));
}

/** R125: Settings › Numbers › Digit groups, the three separators on the same rows (a long integer, a long decimal, a
 *  short one, never grouped), and the comma under the decimal comma, where it draws as the thin space. */
export function groupShots(): LookShot[] {
  const rows = ["123456789", "\\frac{10000}{7}", "1234.5"];
  const shots = [
    { id: "thin", sep: "thin", comma: false, title: "Thin space (the default, R55's): 123 456 789" },
    { id: "apos", sep: "apos", comma: false, title: "Apostrophe: 123’456’789" },
    { id: "comma", sep: "comma", comma: false, title: "Comma, with the point: 123,456,789" },
    { id: "comma-dc", sep: "comma", comma: true, title: "Comma stored, the decimal comma on: drawn with the thin space, 1 428,571 428 57" },
  ] as const;
  return shots.map((g) => ({
    id: `home-groups-${g.id}`,
    group: "Digit groups (R125)",
    title: g.title,
    setup: async (p) => {
      await p.evaluate(([sep, comma]) => {
        window.n62.session.settings.groupSep = sep;
        if (comma) window.n62.session.setDecimalMark("comma");
      }, [g.sep, g.comma] as const);
      for (const [i, l] of rows.entries()) {
        await p.evaluate((x) => window.n62.session.submit(x), l);
        await p.waitForFunction((k) => document.querySelectorAll('[data-status="done"]').length >= k, i + 1);
      }
    },
  }));
}

/** R143: the ▾ on every legend that opens a menu, the keypad alone at both phone sizes (360 and 412 wide), tap layer and Shift
 *  armed (≤≠, α∞, Memory, Mode and Settings are marked), in N62 (light and dark come with every shot), with Plain keys and with High contrast. */
export function menuMarkShots(): (LookShot & { viewport: { width: number; height: number } })[] {
  const looks: [string, string, Record<string, unknown>][] = [
    ["colour", "N62", {}],
    ["plain", "Plain keys", { plain: true }],
    ["high", "High contrast", { contrast: true }],
  ];
  return ([[360, 740], [412, 915]] as const).flatMap(([width, height]) =>
    looks.flatMap(([id, title, patch]) =>
      [false, true].map((on) => ({
        id: `menumark-${id}-${width}${on ? "-shift" : ""}`,
        group: "The menu mark ▾ (R143)",
        title: `${title}, ${width} × ${height}, ${on ? "Shift armed" : "tap layer"}`,
        viewport: { width, height },
        element: ".pad",
        setup: async (p: Page) => {
          if (on) await tap(p, ["shift"]);
          if (Object.keys(patch).length > 0) await setLook(p, patch);
        },
      })),
    ),
  );
}
