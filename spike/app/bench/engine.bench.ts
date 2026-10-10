// SPDX-License-Identifier: GPL-3.0-or-later
// Spike Q1 (desktop): engine startup, per-case latency and cancel/restart through MathEngine.
import { test, expect, type Browser, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

interface Case { id: string; cat: string; input: string; expect?: string; source?: string }
const here = dirname(fileURLToPath(import.meta.url));
const cases = (parse(readFileSync(join(here, "../../bench/cases.yaml"), "utf8")) as { cases: Case[] }).cases;
const RUNS = 7;
const ENGINES = (process.env.ENGINES ?? "source,prebuilt").split(",");

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]!;
};
const r1 = (x: number) => Math.round(x * 10) / 10;

async function openReady(browser: Browser, engine: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`/?engine=${engine}`);
  await page.waitForFunction(() => window.spike !== undefined);
  const t = await page.evaluate(async () => {
    const t = await window.spike.engine.ready();
    return { ...t, sinceNavMs: performance.now() };
  });
  return { ctx, page, t };
}

async function setup(page: Page) {
  await page.evaluate(() => window.spike.engine.setSettings({ digits: 12, angle: "rad" }));
}

for (const engine of ENGINES) {
  test(`engine=${engine}`, async ({ browser, browserName }) => {
    const out: Record<string, unknown> = { browser: browserName, version: browser.version(), engine, runs: RUNS };

    // 1. startup, fresh context each run
    type Startup = Awaited<ReturnType<typeof openReady>>["t"];
    const startups: Startup[] = [];
    for (let i = 0; i < RUNS; i++) {
      const { ctx, t } = await openReady(browser, engine);
      startups.push(t);
      await ctx.close();
    }
    // warm: same context reloaded, so HTTP cache and compiled-wasm code cache can be reused
    const warmStarts: Startup[] = [];
    {
      const { ctx, page } = await openReady(browser, engine);
      for (let i = 0; i < RUNS; i++) {
        await page.reload();
        await page.waitForFunction(() => window.spike !== undefined);
        warmStarts.push(await page.evaluate(async () => ({ ...(await window.spike.engine.ready()), sinceNavMs: performance.now() })));
      }
      await ctx.close();
    }
    const startupStats = (xs: Startup[]) => ({
      readyMs: r1(median(xs.map((s) => s.readyMs))),
      instantiateMs: r1(median(xs.map((s) => s.instantiateMs))),
      initMs: r1(median(xs.map((s) => s.initMs))),
      navToReadyMs: r1(median(xs.map((s) => s.sinceNavMs))),
    });
    out.startup = startupStats(startups);
    out.startupWarm = startupStats(warmStarts);

    // 2. per-case latency. Each of RUNS fresh sessions evaluates every case once ("first call",
    //    what a user sees) and then REPEATS more times ("warm"). Per case we keep the median over sessions.
    const REPEATS = 3;
    const perCase = new Map<string, { first: number[]; warm: number[]; rt: number[]; output: string; ok: boolean }>();
    let page!: Page, ctx!: Awaited<ReturnType<typeof openReady>>["ctx"];
    for (let run = 0; run < RUNS; run++) {
      if (run > 0) await ctx.close();
      ({ ctx, page } = await openReady(browser, engine));
      await setup(page);
      for (const c of cases) {
        const r = await page.evaluate(
          async ({ input, repeats }) => {
            const eng = window.spike.engine;
            const t0 = performance.now();
            const first = await eng.eval(input);
            const firstRt = performance.now() - t0;
            const warm: number[] = [];
            for (let i = 0; i < repeats; i++) warm.push((await eng.eval(input)).engineMs);
            return { output: first.output, ok: first.ok, first: first.engineMs, firstRt, warm };
          },
          { input: c.input, repeats: REPEATS },
        );
        const e = perCase.get(c.id) ?? { first: [], warm: [], rt: [], output: r.output, ok: r.ok };
        e.first.push(r.first);
        e.rt.push(r.firstRt);
        e.warm.push(...r.warm);
        if (e.output !== r.output) e.output += ` | run${run}: ${r.output}`;
        perCase.set(c.id, e);
      }
    }
    const rows = cases.map((c) => {
      const e = perCase.get(c.id)!;
      return {
        id: c.id, cat: c.cat, input: c.input, output: e.output, ok: e.ok,
        expect: c.expect, match: c.expect === undefined ? null : e.output === c.expect,
        firstMs: r1(median(e.first)), roundTripMs: r1(median(e.rt)), warmMs: r1(median(e.warm)),
      };
    });
    const first = rows.map((r) => r.firstMs), warm = rows.map((r) => r.warmMs), rt = rows.map((r) => r.roundTripMs);
    const byCat: Record<string, number> = {};
    for (const cat of new Set(rows.map((r) => r.cat))) byCat[cat] = r1(median(rows.filter((r) => r.cat === cat).map((r) => r.firstMs)));
    out.cases = rows;
    out.summary = {
      n: rows.length,
      firstP50: r1(pct(first, 50)), firstP95: r1(pct(first, 95)), firstMax: r1(Math.max(...first)),
      roundTripP50: r1(pct(rt, 50)), roundTripP95: r1(pct(rt, 95)),
      warmP50: r1(pct(warm, 50)), warmP95: r1(pct(warm, 95)),
      firstMedianByCategory: byCat,
      slowest: [...rows].sort((a, b) => b.firstMs - a.firstMs).slice(0, 5).map((r) => `${r.id} ${r.firstMs}ms`),
      errors: rows.filter((r) => !r.ok).map((r) => r.id),
      mismatches: rows.filter((r) => r.match === false).map((r) => `${r.id}: got ${r.output}`),
    };

    // 3. cancel: define a variable, start a long job, cancel, check the variable survived
    const cancels = [];
    for (let i = 0; i < 5; i++) {
      const res = await page.evaluate(async () => {
        const eng = window.spike.engine;
        await eng.eval("pasvar:=7");
        const long = eng.eval("ifactor(nextprime(10^45)*nextprime(10^46))").then(
          () => "finished",
          (e: unknown) => (e instanceof Error ? e.name : String(e)),
        );
        await new Promise((r) => setTimeout(r, 300));
        const t0 = performance.now();
        const t = await eng.cancel();
        const cancelToReady = performance.now() - t0;
        const after = await eng.eval("pasvar*6");
        return { longJob: await long, cancelToReady, replayMs: t.replayMs, after: after.output };
      });
      cancels.push(res);
    }
    out.cancel = {
      cancelToReadyMs: r1(median(cancels.map((c) => c.cancelToReady))),
      replayMs: r1(median(cancels.map((c) => c.replayMs))),
      longJob: [...new Set(cancels.map((c) => c.longJob))],
      varAfterReplay: [...new Set(cancels.map((c) => c.after))],
    };
    await ctx.close();

    const dir = join(here, "results");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${browserName}-${engine}.json`), JSON.stringify(out, null, 2));
    console.log(JSON.stringify({ browser: browserName, engine, startup: out.startup, startupWarm: out.startupWarm, summary: out.summary, cancel: out.cancel }));
    expect(out.cancel).toBeTruthy();
  });
}
