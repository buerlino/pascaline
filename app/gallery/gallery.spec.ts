// SPDX-License-Identifier: GPL-3.0-or-later
// The UI gallery (docs/05 section 4, U0): one screenshot per screen state, in light and dark, at phone size, then
// test/gallery/index.html with every state side by side. Needs the real engine (GIAC_OUT when not built here).
// Run: npm run gallery   (PW_PORT=<port> to avoid a server of another checkout)
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "../test/helpers.ts";

const OUT = new URL("../test/gallery/", import.meta.url).pathname;
const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];

interface Shot {
  readonly id: string;
  readonly group: string;
  readonly title: string;
  /** Sets the screen up from a fresh Home. */
  readonly setup: (page: Page) => Promise<void>;
}

const ready = async (page: Page): Promise<void> => {
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 30_000 });
};
const settle = (page: Page): Promise<void> => page.waitForTimeout(250);
const doneCount = (page: Page, n: number) => page.waitForFunction((k) => document.querySelectorAll('[data-status="done"]').length >= k, n);

/** A few calculations in the history: a fraction, a decimal, an exact root, an error. */
async function someHistory(page: Page): Promise<void> {
  await tap(page, ["d1", "div", "d3", "enter"]);
  await doneCount(page, 1);
  await tap(page, ["d2", "mul", "d3", "dot", "d5", "add", "d1", "enter"]);
  await doneCount(page, 2);
  await tap(page, ["shift", "sq", "d2", "d0", "enter"]);
  await doneCount(page, 3);
  await tap(page, ["d1", "div", "d0", "enter"]);
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="result"]').length >= 4);
  await settle(page);
}

async function defineTwo(page: Page): Promise<void> {
  await tap(page, ["symb"]);
  await page.getByTestId("entry-label").waitFor();
  await tap(page, ["sin", "x", "enter", "down", "x", "pow", "d3", "right", "sub", "d2", "x", "enter"]);
  await settle(page);
}

/** A 14-item list on the sheet, as Find and the template list will use it (no such list is built in yet). */
async function longList(page: Page): Promise<void> {
  await page.evaluate(() => {
    const units = ["hour", "hertz", "henry", "gauss", "coulomb", "candela", "kelvin", "kilogram", "joule", "lux", "lumen", "newton", "ohm", "pascal"];
    window.pascaline.shell.showMenu("Units (sample)", units.map((u) => ({ id: u, label: u, run: () => {} })));
  });
  await settle(page);
}

const shots: Shot[] = [
  // ---- keypad layers (on an empty Home)
  { id: "home-empty", group: "Home", title: "Home, empty", setup: async () => {} },
  { id: "layer-shift", group: "Keypad layers", title: "Shift layer", setup: (p) => tap(p, ["shift"]) },
  { id: "layer-alpha", group: "Keypad layers", title: "Alpha layer", setup: (p) => tap(p, ["alpha"]) },
  { id: "layer-alpha-lock", group: "Keypad layers", title: "Alpha lock (capitals)", setup: (p) => tap(p, ["alpha", "alpha"]) },
  { id: "layer-lower-lock", group: "Keypad layers", title: "Lower-case lock", setup: (p) => tap(p, ["alpha", "alpha", "alpha"]) },
  { id: "layer-shift-alpha", group: "Keypad layers", title: "Shift then Alpha (lower case)", setup: (p) => tap(p, ["shift", "alpha"]) },
  // ---- Home
  { id: "home-history", group: "Home", title: "Home with history", setup: someHistory },
  {
    id: "home-typing",
    group: "Home",
    title: "Home, typing a fraction",
    setup: async (p) => {
      await someHistory(p);
      await tap(p, ["d1", "d2", "div", "d5", "right", "add", "d2"]);
      await settle(p);
    },
  },
  {
    id: "home-picked",
    group: "Home",
    title: "Home, a history row picked",
    setup: async (p) => {
      await someHistory(p);
      await tap(p, ["up", "up"]);
    },
  },
  {
    id: "home-menu",
    group: "Home",
    title: "Home, Menu open",
    setup: async (p) => {
      await someHistory(p);
      await tap(p, ["menu"]);
      await p.getByTestId("menu").waitFor();
    },
  },
  {
    id: "home-apps",
    group: "Home",
    title: "Apps list",
    setup: async (p) => {
      await someHistory(p);
      await tap(p, ["apps"]);
    },
  },
  {
    id: "home-sheet-long",
    group: "Home",
    title: "A long list on the sheet (scroll cue, item count)",
    setup: async (p) => {
      await someHistory(p);
      await longList(p);
    },
  },
  {
    id: "home-sheet-filter",
    group: "Home",
    title: "A long list filtered by letters (H, E)",
    setup: async (p) => {
      await someHistory(p);
      await longList(p);
      await tap(p, ["cos", "frac"]);
    },
  },
  {
    id: "home-mode",
    group: "Home",
    title: "Mode sheet (Shift + CAS): angle, format, digits, decimals, entry",
    setup: async (p) => {
      await someHistory(p);
      await tap(p, ["shift", "cas"]);
    },
  },
  {
    id: "home-mode-digits",
    group: "Home",
    title: "Mode sheet, Significant digits (current value marked)",
    setup: async (p) => {
      await someHistory(p);
      await tap(p, ["shift", "cas", "d3"]);
    },
  },
  {
    id: "home-settings",
    group: "Home",
    title: "Settings (Shift + Home/CAS)",
    setup: async (p) => {
      await someHistory(p);
      await tap(p, ["shift", "app", "down", "right"]);
    },
  },
  {
    id: "home-settings-cycle",
    group: "Home",
    title: "Settings, Format key cycle",
    setup: async (p) => {
      await someHistory(p);
      await tap(p, ["shift", "app", "enter"]);
    },
  },
  {
    id: "home-tmpl",
    group: "Home",
    title: "Tmpl palette (R10): the 6 × 3 grid, its name on the hint line",
    setup: async (p) => {
      await someHistory(p);
      await tap(p, ["tmpl", "down", "down", "down", "right", "right"]);
    },
  },
  // ---- CAS
  {
    id: "cas",
    group: "CAS",
    title: "CAS with exact results",
    setup: async (p) => {
      await tap(p, ["cas", "d1", "frac", "d3", "right", "add", "d1", "frac", "d6", "enter"]);
      await doneCount(p, 1);
      await tap(p, ["shift", "sq", "d8", "enter"]);
      await doneCount(p, 2);
      await settle(p);
    },
  },
  // ---- Function
  { id: "fn-symb", group: "Function", title: "Function, Symb", setup: defineTwo },
  {
    id: "fn-plot",
    group: "Function",
    title: "Function, Plot",
    setup: async (p) => {
      await defineTwo(p);
      await tap(p, ["plot"]);
      await p.waitForFunction(() => window.pascaline.plot.board !== undefined);
      await settle(p);
    },
  },
  {
    id: "fn-plot-empty",
    group: "Function",
    title: "Function, Plot with no function",
    setup: async (p) => {
      await tap(p, ["symb", "plot"]);
      await p.waitForFunction(() => window.pascaline.plot.board !== undefined);
      await settle(p);
    },
  },
  {
    id: "fn-plot-menu",
    group: "Function",
    title: "Function, Plot menu",
    setup: async (p) => {
      await defineTwo(p);
      await tap(p, ["plot", "menu"]);
      await settle(p);
    },
  },
  {
    id: "fn-plot-intersection",
    group: "Function",
    title: "Function, Plot menu › Intersection (a submenu)",
    setup: async (p) => {
      await defineTwo(p);
      await tap(p, ["plot", "menu", "d3"]);
      await settle(p);
    },
  },
  {
    id: "fn-plot-menu-disabled",
    group: "Function",
    title: "Function, Plot menu with no function (disabled rows say why)",
    setup: async (p) => {
      await tap(p, ["symb", "plot"]);
      await p.waitForFunction(() => window.pascaline.plot.board !== undefined);
      await tap(p, ["menu"]);
      await settle(p);
    },
  },
  {
    id: "fn-num",
    group: "Function",
    title: "Function, Num table",
    setup: async (p) => {
      await defineTwo(p);
      await tap(p, ["num"]);
      await settle(p);
    },
  },
  // ---- Solve
  {
    id: "solve-symb",
    group: "Solve",
    title: "Solve, Symb",
    setup: async (p) => {
      await tap(p, ["apps", "d2", "symb", "x", "shift", "ln", "x", "right", "shift", "dot", "d5", "enter"]);
      await settle(p);
    },
  },
  {
    id: "solve-num",
    group: "Solve",
    title: "Solve, Num",
    setup: async (p) => {
      await tap(p, ["apps", "d2", "symb", "x", "shift", "ln", "x", "right", "shift", "dot", "d5", "enter", "num"]);
      await settle(p);
    },
  },
  {
    id: "solve-menu",
    group: "Solve",
    title: "Solve, menu",
    setup: async (p) => {
      await tap(p, ["apps", "d2", "symb", "x", "shift", "ln", "x", "right", "shift", "dot", "d5", "enter", "num", "menu"]);
      await settle(p);
    },
  },
];

const done: { shot: Shot; files: Partial<Record<Theme, string>> }[] = [];

test.beforeAll(() => {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
});

for (const shot of shots)
  test(shot.id, async ({ browser }) => {
    const files: Partial<Record<Theme, string>> = {};
    for (const theme of THEMES) {
      const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: theme });
      const page = await context.newPage();
      try {
        await open(page, "");
        await ready(page);
        await shot.setup(page);
        await settle(page);
        const file = `${shot.id}.${theme}.png`;
        await page.screenshot({ path: OUT + file });
        files[theme] = file;
      } finally {
        await context.close();
      }
    }
    done.push({ shot, files });
  });

test.afterAll(() => {
  const groups = [...new Set(shots.map((s) => s.group))];
  const body = groups
    .map((g) => {
      const cells = done
        .filter((d) => d.shot.group === g)
        .map(
          (d) => `<figure><figcaption>${d.shot.title}</figcaption><div class="pair">${THEMES.map((t) =>
            d.files[t] ? `<a href="${d.files[t]}"><img loading="lazy" src="${d.files[t]}" alt="${d.shot.title} (${t})"></a>` : "",
          ).join("")}</div></figure>`,
        )
        .join("\n");
      return `<section><h2>${g}</h2><div class="row">${cells}</div></section>`;
    })
    .join("\n");
  writeFileSync(
    OUT + "index.html",
    `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pascaline UI gallery</title>
<style>
body{font:15px/1.4 system-ui,sans-serif;margin:16px;background:#f4f5f7;color:#1a1d22}
h1{font-size:20px}h2{font-size:17px;margin:28px 0 8px}
.row{display:flex;flex-wrap:wrap;gap:20px}
figure{margin:0}figcaption{font-weight:600;margin-bottom:4px}
.pair{display:flex;gap:8px}
img{width:240px;height:auto;border:1px solid #b9c0cc;border-radius:6px;display:block}
@media (prefers-color-scheme:dark){body{background:#14161a;color:#e8ebef}img{border-color:#3a4250}}
</style></head><body>
<h1>Pascaline UI gallery</h1>
<p>Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} by <code>npm run gallery</code>. Each state: light (left), dark (right). Click an image for full size.</p>
${body}
</body></html>
`,
  );
});

// (entryValue is kept for ad-hoc debugging of a setup step)
void entryValue;
