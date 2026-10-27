// SPDX-License-Identifier: GPL-3.0-or-later
// R74: the core list (tests/core/core.yaml): loading, the file check and the replay by keys. Types from
// @playwright/test only, so A32's device spec reuses it on a page attached over adb.
import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { parse } from "yaml";
import { flick, open, tap } from "./helpers.ts";

export type CoreStep =
  | string
  | { tmpl: string }
  | { up: string }
  | { down: string }
  | { tap: string }
  | { back: true }
  | { wait: number }
  | { relaunch: true };

export interface RowCheck {
  result?: string;
  mark?: string;
  status?: string;
}

export interface CoreExpect {
  result?: string;
  mark?: string;
  rows?: RowCheck[];
  clipboard?: string;
  entry?: string;
  text?: Record<string, string | string[]>;
}

export interface CoreCase {
  id: string;
  area: string;
  title: string;
  keys: CoreStep[];
  expect: CoreExpect;
  value?: string;
  source: string;
  hand?: boolean;
  known?: string;
  needs?: string;
}

const file = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8");

export function loadCore(): CoreCase[] {
  return (parse(file("../../tests/core/core.yaml")) as { cases: CoreCase[] }).cases;
}

/** The cell ids of spec/keyboard.yaml's `templates:`. */
export function templateIds(): Set<string> {
  const doc = parse(file("../../spec/keyboard.yaml")) as { templates: { items: { id: string }[] } };
  return new Set(doc.templates.items.map((t) => t.id));
}

/** The case ids MORNING.md lists (its table rows). */
export function morningIds(): Set<string> {
  return new Set([...file("../../tests/core/MORNING.md").matchAll(/^\|\s*(c\d\d)\s*\|/gm)].map((m) => m[1] as string));
}

/** The bug ids named by the lines of docs/backlog.md's "Open bugs in the freeze" section. */
export function openBugIds(): Set<string> {
  const md = file("../../docs/backlog.md");
  const from = md.indexOf("### Open bugs in the freeze");
  const rest = md.slice(from + 1);
  const to = rest.search(/\n###? /);
  const ids = new Set<string>();
  for (const line of rest.slice(0, to < 0 ? undefined : to).split("\n"))
    if (line.startsWith("- **")) for (const m of (/^- \*\*([^*]*)\*\*/.exec(line)?.[1] ?? "").matchAll(/[A-Z]\d+/g)) ids.add(m[0]);
  return ids;
}

const SOURCES = ["oracle", "derived"];

/** Problems with the list itself (empty = fine). Needs no browser. */
export function validate(
  cases: readonly CoreCase[],
  keys: ReadonlySet<string>,
  templates: ReadonlySet<string>,
  morning: ReadonlySet<string>,
  openBugs?: ReadonlySet<string>,
): string[] {
  const bad: string[] = [];
  const seen = new Set<string>();
  for (const c of cases) {
    const at = (m: string): number => bad.push(`${c.id}: ${m}`);
    if (!/^c\d\d$/.test(c.id)) at("id malformed");
    if (seen.has(c.id)) at("id repeated");
    seen.add(c.id);
    if (!SOURCES.includes(c.source)) at(`source is ${String(c.source)}`);
    if (c.expect === undefined || c.expect === null || Object.keys(c.expect).length === 0) at("empty expect");
    for (const s of c.keys ?? []) {
      if (typeof s === "string") {
        if (!s.startsWith("@") && !keys.has(s)) at(`no key "${s}" in spec/keyboard.yaml`);
      } else if ("tmpl" in s) {
        if (!templates.has(s.tmpl)) at(`no template cell "${s.tmpl}" in spec/keyboard.yaml`);
      } else if ("up" in s || "down" in s) {
        const id = "up" in s ? s.up : s.down;
        if (!keys.has(id)) at(`no key "${id}" in spec/keyboard.yaml`);
      }
    }
    if (c.hand === true && !morning.has(c.id)) at("hand: true but not in MORNING.md");
    if (c.hand !== true && morning.has(c.id)) at("in MORNING.md without hand: true");
    if (c.known !== undefined && openBugs && !openBugs.has(c.known)) at(`known: ${c.known} is not an open bug line of docs/backlog.md`);
  }
  for (const id of morning) if (!seen.has(id)) bad.push(`${id}: in MORNING.md but not in core.yaml`);
  return bad;
}

const rowsOf = (page: Page) => page.locator("article.item[data-status]");
const lastRow = (page: Page) => page.locator('[data-testid="result"]').last();

/** Every row's status is settled (nothing pending). */
async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => !document.querySelector('article.item[data-status="pending"]'), undefined, { timeout: 15_000 });
}

export async function engineReady(page: Page): Promise<void> {
  await page.waitForFunction(() => window.pascaline?.session.engineState === "ready", undefined, { timeout: 20_000 });
  await page.evaluate(() => window.pascaline.entry.ready);
}

/** A fresh page at the app, engine ready. */
export async function start(page: Page): Promise<void> {
  await open(page, "");
  await engineReady(page);
}

/** What differs when the page is a phone's WebView (A32): the real Back key and a real stop-and-start of the app. */
export interface ReplayHooks {
  back?: () => Promise<void>;
  /** Stops and starts the app, returns the page of the new process. */
  relaunch?: () => Promise<Page>;
}

/** Press the steps in order. After Enter, wait until the row it made has finished. Returns the page to check (a new
 *  one when a hook relaunched the app). */
export async function replay(page: Page, steps: readonly CoreStep[], hooks: ReplayHooks = {}): Promise<Page> {
  for (const [i, s] of steps.entries()) {
    if (typeof s === "string") {
      await tap(page, [s]);
      // a new row appears at once as pending (some views, Solve, add none); a {wait} next means the job is to be
      // interrupted, so do not wait for it
      const next = steps[i + 1];
      if (s === "enter" && !(typeof next === "object" && "wait" in next)) {
        await page.waitForTimeout(60);
        await settled(page);
      }
    } else if ("tmpl" in s) {
      await tap(page, ["tmpl"]);
      const sheet = page.getByTestId("menu");
      await sheet.locator(`[data-id="${s.tmpl}"]`).tap();
      await expect(sheet).toBeHidden();
    } else if ("up" in s) await flick(page, s.up, "up");
    else if ("down" in s) await flick(page, s.down, "down");
    else if ("tap" in s) {
      if (s.tap === "result:last") await lastRow(page).locator(".result").tap();
      else await page.locator(s.tap).first().tap();
    } else if ("back" in s) await (hooks.back ? hooks.back() : page.evaluate(() => history.back()));
    else if ("wait" in s) await page.waitForTimeout(s.wait);
    else {
      await page.evaluate(() => window.pascaline.shell.flush());
      await page.waitForTimeout(800); // the stores' writes are debounced and asynchronous (persist.spec)
      if (hooks.relaunch) page = await hooks.relaunch();
      else await page.reload();
      await engineReady(page);
    }
  }
  return page;
}

async function rowState(row: import("@playwright/test").Locator): Promise<Required<RowCheck>> {
  const status = (await row.getAttribute("data-status")) ?? "";
  const res = row.locator(".result");
  const result = (await res.count()) > 0 ? ((await res.first().getAttribute("data-text")) ?? "") : ((await row.locator(".error, .note").first().textContent().catch(() => null)) ?? "");
  const m = row.locator('[data-testid="mark"]');
  const mark = (await m.count()) > 0 ? ((await m.first().getAttribute("data-mark")) ?? "none") : "none";
  return { result, mark, status };
}

/** Assert the case's `expect` against the page (`id`: the case, for the messages). */
export async function check(page: Page, e: CoreExpect, id = ""): Promise<void> {
  if (e.result !== undefined || e.mark !== undefined) {
    // polled: a b/c to polar asks the engine twice after the key (abs, arg; S24's c63), so the row changes later
    const want = { ...(e.result !== undefined && { result: e.result }), ...(e.mark !== undefined && { mark: e.mark }) };
    await expect
      .poll(async () => {
        const last = await rowState(rowsOf(page).last());
        return { ...(e.result !== undefined && { result: last.result }), ...(e.mark !== undefined && { mark: last.mark }) };
      }, { message: "last row" })
      .toEqual(want);
  }
  if (e.rows !== undefined) {
    const all = rowsOf(page);
    const n = await all.count();
    const got: Required<RowCheck>[] = [];
    for (let i = 0; i < n; i++) got.push(await rowState(all.nth(i)));
    const want = e.rows;
    expect(got.length, "row count").toBe(want.length);
    want.forEach((w, i) => {
      if (w.result !== undefined) expect(got[i]?.result, `row ${i} result`).toBe(w.result);
      if (w.mark !== undefined) expect(got[i]?.mark, `row ${i} mark`).toBe(w.mark);
      if (w.status !== undefined) expect(got[i]?.status, `row ${i} status`).toBe(w.status);
    });
  }
  if (e.clipboard !== undefined) await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain(e.clipboard); // the copy code loads on first use
  if (e.entry !== undefined) expect(await page.evaluate(() => window.pascaline.entry.value), "entry").toBe(e.entry);
  for (const [sel, want] of Object.entries(e.text ?? {})) {
    const loc = page.locator(sel);
    if (Array.isArray(want)) await expect(loc).toHaveText(want);
    else await expect.poll(async () => (await loc.allTextContents()).map((t) => t.trim()), { message: sel }).toContain(want);
    // R82 (F110): the text is also there for the eye: on screen and not under another element
    await expect.poll(() => seen(page, sel), { message: `${id} ${sel} on screen and uncovered`.trim(), timeout: 2000 }).toBe("");
  }
}

/** Why the first match of `sel` cannot be read ("" = it can): hidden, outside the viewport, or covered at its centre
 *  or an edge's middle (what `elementFromPoint` finds there, with the layout boxes, so a device log names the cause). */
export function seen(page: Page, sel: string): Promise<string> {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return "no match";
    const r = el.getBoundingClientRect();
    const box = (b: DOMRect): string => `${Math.round(b.left)},${Math.round(b.top)} ${Math.round(b.width)}×${Math.round(b.height)}`;
    const where = (): string =>
      ` (viewport ${innerWidth}×${innerHeight} dpr ${devicePixelRatio}; ` +
      ["header", ".screen", ".keys"].map((q) => { const b = document.querySelector(q)?.getBoundingClientRect(); return `${q} ${b ? box(b) : "-"}`; }).join("; ") + ")";
    if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === "hidden") return `hidden, box ${box(r)}${where()}`;
    if (r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight) return `outside the viewport, box ${box(r)}${where()}`;
    // the centre and the middle of each edge, 2 px in: a text half under the keypad cannot be read either
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2, i = Math.min(2, r.width / 4, r.height / 4);
    const points: [string, number, number][] = [["centre", cx, cy], ["top", cx, r.top + i], ["bottom", cx, r.bottom - i], ["left", r.left + i, cy], ["right", r.right - i, cy]];
    let top: Element | null = null, at = "";
    for (const [p, x, y] of points) {
      const hit = document.elementFromPoint(x, y);
      if (!hit || (hit !== el && !el.contains(hit))) {
        top = hit;
        at = p;
        break;
      }
    }
    if (at === "") return "";
    const name = (n: Element | null): string => n ? `${n.tagName.toLowerCase()}${n.id ? `#${n.id}` : ""}${n.className && typeof n.className === "string" ? `.${n.className.trim().split(/\s+/).join(".")}` : ""}` : "nothing";
    const owner = top?.closest("[data-testid], header, .keys, [data-key]");
    return `covered at its ${at} by ${name(top)}${owner && owner !== top ? ` in ${name(owner)}` : ""}, box ${box(r)}${where()}`;
  }, sel);
}
