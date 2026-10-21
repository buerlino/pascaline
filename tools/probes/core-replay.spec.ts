// SPDX-License-Identifier: GPL-3.0-or-later
// PROBE (sandra, 2026-10-21; P23): replays tests/core/core.yaml (or CORE_YAML) and appends one line per case to CORE_OUT:
// id, PASS/FAIL, known, what the app showed, what the case wants, the error, the last row's text. CORE_TRACE=1 also logs
// the entry's LaTeX before each Enter; CORE_ONLY=c41,c42 picks cases. Cases with `needs:` are skipped. It never fails a
// test: it is a probe, not R74's harness. Run it from app/test (it imports ./helpers.ts):
//   cp tools/probes/core-replay.spec.ts app/test/ && (cd app && GIAC_OUT=<abs engine dir> PW_PORT=5277 CORE_OUT=/tmp/core.out \
//     npx playwright test test/core-replay.spec.ts --workers=6 --reporter=line); rm app/test/core-replay.spec.ts
import { expect, test, type Page } from "@playwright/test";
import { readFileSync, appendFileSync } from "node:fs";
import { parse } from "yaml";
import { flick, open, tap } from "./helpers.ts";

type Step = string | { back: true } | { tmpl: string } | { up: string } | { down: string } | { tap: string } | { relaunch: true };
interface Case { id: string; title: string; keys: Step[]; expect: { result?: string; mark?: string; entry?: string; text?: Record<string, string> }; known?: string }
const doc = parse(readFileSync(process.env["CORE_YAML"] ?? new URL("../../tests/core/core.yaml", import.meta.url), "utf8")) as { cases: Case[] };
const OUT = process.env["CORE_OUT"] ?? "/tmp/core-probe.out";
const only = process.env["CORE_ONLY"]?.split(",");

async function ready(page: Page): Promise<void> {
  await page.waitForFunction(() => window.pascaline?.session.engineState === "ready", undefined, { timeout: 20_000 });
  await page.evaluate(() => window.pascaline.entry.ready);
}

async function run(page: Page, steps: Step[]): Promise<void> {
  for (const s of steps) {
    if (typeof s === "string") {
      const before = await page.locator('[data-status="done"]').count();
      if (s === "enter" && process.env["CORE_TRACE"]) appendFileSync(OUT, `  trace before enter: ${await page.evaluate(() => window.pascaline.entry.value)}\n`);
      await tap(page, [s]);
      if (s === "enter") {
        await page.waitForTimeout(50);
        await expect.poll(async () => (await page.locator('[data-status="done"], [data-status="error"]').count()) > before || (await page.locator('[data-status="pending"],[data-status="working"]').count()) === 0, { timeout: 15_000 }).toBe(true);
      }
    } else if ("tmpl" in s) {
      await tap(page, ["tmpl"]);
      await page.getByTestId("menu").locator(`[data-id="${s.tmpl}"]`).tap();
      await expect(page.getByTestId("menu")).toBeHidden();
    } else if ("up" in s) await flick(page, s.up, "up");
    else if ("down" in s) await flick(page, s.down, "down");
    else if ("back" in s) await page.evaluate(() => history.back());
    else if ("relaunch" in s) {
      await page.waitForTimeout(900);
      await page.reload();
      await ready(page);
    } else if ("tap" in s) {
      if (s.tap === "result:last") await page.locator('[data-testid="result"]').last().locator(".result").tap();
      else await page.locator(s.tap).first().tap();
    }
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(400);
}

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
for (const c of doc.cases) {
  if (only && !only.includes(c.id)) continue;
  if ((c as { needs?: string }).needs) continue;
  test(`${c.id} ${c.title}`, async ({ page }) => {
    await open(page, "");
    await ready(page);
    let err = "";
    try { await run(page, c.keys); } catch (e) { err = String(e).split("\n")[0] ?? "error"; }
    const got: Record<string, string> = {};
    const last = page.locator('[data-testid="result"]').last();
    if (c.expect.result !== undefined) got["result"] = (await last.locator(".result").getAttribute("data-text", { timeout: 2000 }).catch(() => "<none>")) ?? "<null>";
    if (c.expect.mark !== undefined) got["mark"] = (await last.getByTestId("mark").getAttribute("data-mark", { timeout: 1500 }).catch(() => "none")) ?? "none";
    if (c.expect.entry !== undefined) got["entry"] = await page.evaluate(() => window.pascaline.entry.value);
    for (const [sel, want] of Object.entries(c.expect.text ?? {})) {
      const texts = await page.locator(sel).allTextContents().catch(() => []);
      got[`text ${sel}`] = texts.map((t) => t.trim()).join(" | ") || "<none>";
      void want;
    }
    const lastText = (await last.textContent({ timeout: 1000 }).catch(() => "")) ?? "";
    const want: Record<string, string> = { ...(c.expect.result !== undefined ? { result: c.expect.result } : {}), ...(c.expect.mark !== undefined ? { mark: c.expect.mark } : {}), ...(c.expect.entry !== undefined ? { entry: c.expect.entry } : {}) };
    for (const [sel, w] of Object.entries(c.expect.text ?? {})) want[`text ${sel}`] = w;
    const bad = Object.keys(want).filter((k) => k.startsWith("text ") ? !(got[k] ?? "").split(" | ").includes(want[k] as string) : got[k] !== want[k]);
    const line = `${c.id}\t${bad.length === 0 && !err ? "PASS" : "FAIL"}\t${c.known ?? ""}\t${JSON.stringify(got)}\twant ${JSON.stringify(want)}\t${err}\tlast: ${lastText.replace(/\s+/g, " ").slice(0, 160)}\n`;
    appendFileSync(OUT, line);
  });
}
