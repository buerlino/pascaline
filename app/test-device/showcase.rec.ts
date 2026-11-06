// SPDX-License-Identifier: GPL-3.0-or-later
// The showcase recorder (tests/core/SHOWCASE.md "Next", step 1): each clip of tests/core/showcase.yaml pressed on the
// phone at the song's beat times (tests/core/showcase-timeline.json) while `adb shell screenrecord` records the screen.
// Per clip: a fresh app (pm clear), the setup untimed, then the recorder starts, a full-screen white flash (the sync mark),
// a clean screen, the presses on the beats, a hold after the result, the recorder stops, the file is pulled.
// A press is a real touch over CDP: down on the beat, held SHOWCASE_HOLD_MS, lifted (a key acts on the lift, its
// highlight shows while it is down). The page logs its own times (the flash, each pointerdown, the result's frame) in
// <out>/<id>.json for tools/showcase/stitch.py. Run by tools/showcase/record.sh only (device lock, demo mode, stay-awake).
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { _android as android, expect, test, type AndroidDevice, type CDPSession, type Page } from "@playwright/test";
import { parse } from "yaml";
import { check, engineReady, replay, type CoreExpect, type CoreStep } from "../test/core-lib.ts";
import { installTouchTap } from "./touch-tap.ts";

const PKG = "dev.n62.calc"; // our app only (docs/shifts/rules.md section 3)

type Step = CoreStep | { cell: string } | { row: string };
interface Clip {
  id: string;
  blocks: (number | string)[];
  title: string;
  setup?: Step[];
  after?: string;
  presses: Step[];
  eval: Step;
  expect: CoreExpect & { unit?: { text: string; unit: string; has?: string } };
}
interface Beat { t: number; block: number | string; beat: number; kind: string }

const env = (k: string, d?: string): string => {
  const v = process.env[k] ?? d;
  if (v === undefined) throw new Error(`${k} is not set (tools/showcase/record.sh sets it)`);
  return v;
};
const SERIAL = env("ANDROID_SERIAL", "");
const OUT = env("SHOWCASE_OUT", "");
const HOLD_MS = Number(env("SHOWCASE_HOLD_MS", "70")); // finger down per press
const LEAD_MS = Number(env("SHOWCASE_LEAD_MS", "2000")); // clean screen from the flash's end to the first press
const AFTER_MS = Number(env("SHOWCASE_AFTER_MS", "1000")); // hold after the result
const ONLY = env("SHOWCASE_CLIPS", "").split(",").filter(Boolean);
const MIN_GAP_MS = 220; // the eval's lookup and result watch after the press before it
// per clip, ms the eval is pressed before beat 7 (a result that shows late, measured by stitch.py's report)
const ADVANCE = ((): Record<string, number> => {
  const f = process.env["SHOWCASE_EVAL_ADVANCE"];
  return f ? (JSON.parse(readFileSync(f, "utf8")) as Record<string, number>) : {};
})();

const file = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8");
const all = (parse(file("../../tests/core/showcase.yaml")) as { clips: Clip[] }).clips;
const beats = JSON.parse(file("../../tests/core/showcase-timeline.json")) as Beat[];
const clips = ONLY.length ? ONLY.map((id) => all.find((c) => c.id === id) ?? (() => { throw new Error(`no clip ${id}`); })()) : all;

/** A clip's beat times: its blocks' beats 1-7 in order (as test/showcase.spec.ts). */
const timesOf = (c: Clip): number[] => c.blocks.flatMap((b) => beats.filter((e) => e.block === b && e.kind !== "gap").map((e) => e.t));

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, Math.max(0, ms)));
const label = (s: Step): string => (typeof s === "string" ? s : JSON.stringify(s));

let device: AndroidDevice;

async function launch(): Promise<Page> {
  await device.shell(`am start -n ${PKG}/.MainActivity`);
  const view = await device.webView({ pkg: PKG }, { timeout: 30_000 });
  const page = await view.page();
  installTouchTap(page);
  await page.waitForFunction(() => customElements.get("math-field") !== undefined && window.n62 !== undefined, undefined, { timeout: 30_000 });
  await engineReady(page);
  return page;
}

/** As core.device.spec.ts: our app's data cleared, a cold start, the first-start tips closed. */
async function fresh(): Promise<Page> {
  await device.shell(`pm clear ${PKG}`);
  const page = await launch();
  const tips = page.getByTestId("tips");
  await tips.waitFor({ state: "visible", timeout: 15_000 });
  await page.getByTestId("tips-got-it").tap();
  await tips.waitFor({ state: "detached", timeout: 10_000 });
  return page;
}

/** Untimed, with the replay's waits (setup, and a clip this one continues). */
async function untimed(page: Page, steps: Step[]): Promise<void> {
  for (const s of steps) {
    if (typeof s === "object" && "cell" in s) await page.getByTestId("menu").locator(`[data-id="${s.cell}"]`).tap();
    else if (typeof s === "object" && "row" in s) await page.getByTestId("find").locator(`[role="menuitem"][data-id="${s.row}"]`).tap();
    else await replay(page, [s as CoreStep]);
  }
}

/**
 * A sheet's code loads on its first opening (Tmpl, Find: 200-800 ms on the Fairphone 6), which in the take would show a
 * beat late: each sheet the clip opens is opened once before the recording and closed with the real Back key.
 */
async function warm(page: Page, presses: Step[]): Promise<void> {
  const SHEETS = '[data-testid="menu"], [data-testid="find"], [data-testid="apps"]';
  for (const k of ["tmpl", "math", "@menu"]) {
    if (!presses.includes(k)) continue;
    await replay(page, [k]);
    await page.locator(SHEETS).first().waitFor({ state: "visible", timeout: 5000 });
    await sleep(300);
    await device.shell("input keyevent KEYCODE_BACK");
    await page.locator(SHEETS).first().waitFor({ state: "hidden", timeout: 5000 });
  }
}

interface Box { x: number; y: number; width: number; height: number }
interface Target { what: string; box: Box; dy: number } // dy: a flick's slide (0 = a tap)

const SHEET_OPENERS = new Set(["@menu", "@place"]);

/**
 * The target's box, in one round trip (each CDP call over adb costs tens of ms, a beat is 300-450 ms): wait until it is
 * there and has a size, bring it into view, then wait until it stops moving (a sheet slides in: two frames agree).
 * `digit`: a digit key whose key lies under an open menu sheet becomes the sheet's row with that number (what the eye
 * sees; the replay presses such a key by its code, test/helpers.ts `tap`); `sheet`: the step before opened one, wait for it.
 */
const locate = (page: Page, sel: string, digit: string, sheet: boolean): Promise<{ sel: string; box: Box } | string> =>
  page.evaluate(
    async ({ sel, digit, sheet }) => {
      const frame = (): Promise<number> => new Promise((r) => requestAnimationFrame(r));
      const SHEETS = '[data-testid="menu"], [data-testid="apps"]';
      const end = performance.now() + 4000;
      if (sheet) while (!document.querySelector(SHEETS) && performance.now() < end) await frame();
      if (digit) {
        const k = document.querySelector(sel);
        if (k) {
          const r = k.getBoundingClientRect();
          const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          const over = el && !k.contains(el) ? el.closest(SHEETS) : null;
          const hit = over ? [...over.querySelectorAll<HTMLElement>(".row[data-id]")].find((x) => x.querySelector(".n")?.textContent?.trim() === digit) : undefined;
          if (over && hit) sel = `[data-testid="${over.getAttribute("data-testid")}"] .row[data-id="${hit.dataset["id"]}"]`;
        }
      }
      let el: Element | null = null;
      while (performance.now() < end) {
        el = document.querySelector(sel);
        const r = el?.getBoundingClientRect();
        if (r && r.width > 0 && r.height > 0) break;
        el = null;
        await frame();
      }
      if (!el) return `${sel}: not there after 4 s`;
      const r0 = el.getBoundingClientRect();
      if (r0.top < 0 || r0.bottom > innerHeight) el.scrollIntoView({ block: "nearest" });
      let prev = "";
      while (performance.now() < end + 2000) {
        const r = el.getBoundingClientRect();
        const now = `${r.x},${r.y},${r.width},${r.height}`;
        if (now === prev) return { sel, box: { x: r.x, y: r.y, width: r.width, height: r.height } };
        prev = now;
        await frame();
      }
      return `${sel}: kept moving`;
    },
    { sel, digit, sheet },
  );

/** Where the step's finger goes. */
async function prepare(page: Page, s: Step, prev: Step | undefined): Promise<Target> {
  let sel: string;
  let dy = 0;
  let digit = "";
  if (typeof s === "string") {
    if (s.startsWith("@")) {
      const id = s === "@menu" ? "menu-button" : s === "@place" ? "place" : /^@(symb|plot|num)$/.test(s) ? `tab-${s.slice(1)}` : null;
      if (!id) throw new Error(`${s} is not a timed step (put it in the setup)`);
      sel = `[data-testid="${id}"]`;
    } else {
      sel = `[data-key="${s}"]`;
      if (/^d\d$/.test(s)) digit = s.slice(1);
    }
  } else if ("cell" in s) sel = `[data-testid="menu"] [data-id="${s.cell}"]`;
  else if ("row" in s) sel = `[data-testid="find"] [role="menuitem"][data-id="${s.row}"]`;
  else if ("up" in s) [sel, dy] = [`[data-key="${s.up}"]`, -40];
  else if ("down" in s) [sel, dy] = [`[data-key="${s.down}"]`, 40];
  else throw new Error(`${label(s)} is not a timed step`);
  const got = await locate(page, sel, digit, typeof prev === "string" && SHEET_OPENERS.has(prev));
  if (typeof got === "string") throw new Error(`step ${label(s)}: ${got}`);
  return { what: got.sel, box: got.box, dy };
}

/** The finger: down at the centre, held HOLD_MS (a flick slides 40 px over that time, FlickTracker arms at 20), up. */
async function fire(cdp: CDPSession, t: Target): Promise<void> {
  const x = Math.round(t.box.x + t.box.width / 2);
  const y = Math.round(t.box.y + t.box.height / 2);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
  const t0 = Date.now();
  if (t.dy !== 0) {
    for (let i = 1; i <= 6; i++) {
      await sleep(t0 + (HOLD_MS * i) / 7 - Date.now());
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: Math.round(y + (t.dy * i) / 6), id: 1 }] });
    }
  }
  await sleep(t0 + HOLD_MS - Date.now());
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

/** The page's own clock: every pointerdown, and later the flash and the result frame. */
const instrument = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const w = window as unknown as { __sc: { downs: number[]; flash?: number; flashOff?: number; result?: number } };
    w.__sc = { downs: [] };
    addEventListener("pointerdown", (e) => w.__sc.downs.push(e.timeStamp), { capture: true });
  });

/** A white sheet over the whole page for ~100 ms; logs the frames it came and went (rAF times). */
const flash = (page: Page): Promise<void> =>
  page.evaluate(
    () =>
      new Promise<void>((done) => {
        const w = window as unknown as { __sc: { flash?: number; flashOff?: number } };
        const d = document.createElement("div");
        d.style.cssText = "position:fixed;inset:0;background:#fff;z-index:2147483647;pointer-events:none";
        document.body.appendChild(d);
        requestAnimationFrame((t) => {
          w.__sc.flash = t;
          setTimeout(() => {
            d.remove();
            requestAnimationFrame((t2) => {
              w.__sc.flashOff = t2;
              done();
            });
          }, 100);
        });
      }),
  );

/**
 * Once nothing is pending (a row an Enter just made has finished: clip C is Enter, then a b/c), the first frame whose
 * result differs from now is the result's frame. One round trip: the eval may follow its press closely.
 */
const watchResult = (page: Page, sels: string[]): Promise<void> =>
  page.evaluate(async (sels) => {
    const end = performance.now() + 15_000;
    while (document.querySelector('article.item[data-status="pending"]') && performance.now() < end) await new Promise((r) => requestAnimationFrame(r));
    const w = window as unknown as { __sc: { result?: number; resultBox?: { x: number; y: number; width: number; height: number } } };
    const sig = (): string => {
      const rows = document.querySelectorAll("article.item[data-status]");
      const r = rows[rows.length - 1];
      const u = document.querySelector('[data-testid="unit-result"]');
      return [
        rows.length,
        r?.getAttribute("data-status") ?? "",
        r?.querySelector(".result")?.getAttribute("data-text") ?? "",
        u?.getAttribute("data-text") ?? "",
        ...sels.map((q) => [...document.querySelectorAll(q)].map((e) => e.textContent?.trim()).join("|")),
      ].join("¦");
    };
    const s0 = sig();
    const u0 = document.querySelector('[data-testid="unit-result"]')?.getAttribute("data-text");
    // where the result shows: the unit view's result, the expected texts, or the last row's result
    const where = (): DOMRect[] => {
      const u = document.querySelector('[data-testid="unit-result"]');
      if (u && u.getAttribute("data-text") !== u0) return [u.getBoundingClientRect()];
      const t = sels.flatMap((q) => [...document.querySelectorAll(q)].map((e) => e.getBoundingClientRect()));
      if (t.length) return t;
      const rows = document.querySelectorAll("article.item[data-status]");
      const r = rows[rows.length - 1];
      const el = r?.querySelector(".result") ?? r;
      return el ? [el.getBoundingClientRect()] : [];
    };
    const loop = (t: number): void => {
      const s = sig();
      if (s !== s0 && !s.includes("pending")) {
        w.__sc.result = t;
        const rs = where().filter((b) => b.width > 0 && b.height > 0);
        if (rs.length) {
          const x = Math.min(...rs.map((b) => b.left));
          const y = Math.min(...rs.map((b) => b.top));
          w.__sc.resultBox = { x, y, width: Math.max(...rs.map((b) => b.right)) - x, height: Math.max(...rs.map((b) => b.bottom)) - y };
        }
      } else requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }, sels);

/** `adb shell screenrecord` in the background; stop() sends SIGINT on the phone (the mp4 is finished) and pulls it. */
function record(id: string): { stop: () => Promise<string> } {
  const remote = `/sdcard/n62-showcase-${id}.mp4`;
  const proc: ChildProcess = spawn("adb", ["-s", SERIAL, "shell", "screenrecord", "--bit-rate", "20000000", remote], { stdio: "ignore" });
  const exited = new Promise<void>((r) => proc.on("exit", () => r()));
  return {
    async stop() {
      await device.shell("pkill -INT screenrecord");
      await Promise.race([exited, sleep(10_000).then(() => { throw new Error("screenrecord did not stop"); })]);
      await sleep(300); // the moov atom is written as the process ends
      const local = `${OUT}/${id}.mp4`;
      await new Promise<void>((ok, bad) => spawn("adb", ["-s", SERIAL, "pull", remote, local], { stdio: "ignore" }).on("exit", (c) => (c === 0 ? ok() : bad(new Error(`adb pull ${remote}: ${c}`)))));
      await device.shell(`rm -f ${remote}`);
      if (!existsSync(local)) throw new Error(`${local} missing after the pull`);
      return local;
    },
  };
}

test.beforeAll(async () => {
  if (!SERIAL) throw new Error("ANDROID_SERIAL is not set");
  if (!OUT) throw new Error("SHOWCASE_OUT is not set");
  mkdirSync(OUT, { recursive: true });
  const found = (await android.devices()).find((d) => d.serial() === SERIAL);
  if (!found) throw new Error(`device ${SERIAL} not attached`);
  device = found;
});
test.afterAll(async () => {
  await device?.shell(`am force-stop ${PKG}`).catch(() => undefined);
  await device?.close().catch(() => undefined);
});

test.describe("showcase recorder", () => {
  for (const c of clips) {
    test(`${c.id} ${c.title}`, async () => {
      const times = timesOf(c);
      expect(times.length, `beats for blocks ${c.blocks.join("+")}`).toBe(c.presses.length + 1);
      const page = await fresh();
      if (c.after) {
        const prev = all.find((p) => p.id === c.after) as Clip;
        await untimed(page, [...(prev.setup ?? []), ...prev.presses, prev.eval]);
      }
      await untimed(page, c.setup ?? []);
      await warm(page, c.presses);
      await page.waitForFunction(() => !document.querySelector('article.item[data-status="pending"]'), undefined, { timeout: 15_000 });
      await sleep(500); // the setup's last sheet has closed, the keys are still
      await instrument(page);
      const cdp = await page.context().newCDPSession(page);
      const steps = [...c.presses, c.eval];
      const advance = ADVANCE[c.id] ?? 0;
      const sels = Object.keys(c.expect.text ?? {});

      const rec = record(c.id);
      await sleep(1200); // screenrecord is up
      await flash(page);
      const t0 = Date.now() + LEAD_MS;
      const log: { step: string; what: string; box: Box; late: number; prepared: number }[] = [];
      let used = 0; // ms the eval was pressed early
      const at = (i: number): number => t0 + ((times[i] as number) - (times[0] as number)) * 1000;
      for (const [i, s] of steps.entries()) {
        const last = i === steps.length - 1;
        // an early eval keeps MIN_GAP_MS after the press before it (the stitch puts the result on beat 7 either way)
        const due = last ? Math.max(at(i) - advance, at(i - 1) + MIN_GAP_MS) : at(i);
        if (last) await watchResult(page, sels);
        if (last) used = Math.round(at(i) - due);
        const target = await prepare(page, s, steps[i - 1]);
        const prepared = due - Date.now();
        await sleep(due - Date.now());
        log.push({ step: label(s), what: target.what, box: target.box, late: Date.now() - due, prepared });
        await fire(cdp, target);
      }
      const u = c.expect.unit;
      if (u) await expect(page.getByTestId("unit-result")).toBeVisible({ timeout: 15_000 });
      else await page.waitForFunction(() => !document.querySelector('article.item[data-status="pending"]'), undefined, { timeout: 15_000 });
      await page.waitForFunction(() => (window as unknown as { __sc: { result?: number } }).__sc.result !== undefined, undefined, { timeout: 5000 }).catch(() => undefined);
      await sleep(AFTER_MS);
      const mp4 = await rec.stop();

      const sc = await page.evaluate(() => (window as unknown as { __sc: unknown }).__sc);
      const view = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio }));
      const report = { id: c.id, title: c.title, blocks: c.blocks, beats: times, advance: used, asked: advance, hold: HOLD_MS, lead: LEAD_MS, view, page: sc, steps: log, mp4 };
      writeFileSync(`${OUT}/${c.id}.json`, JSON.stringify(report, null, 1));
      const lates = log.map((l) => l.late);
      console.log(`RECORD ${c.id}: ${steps.length} presses; late max ${Math.max(...lates)} ms; least prepared ${Math.round(Math.min(...log.map((l) => l.prepared)))} ms; ${mp4}`);

      if (u) {
        const r = page.getByTestId("unit-result");
        await expect(r).toHaveAttribute("data-text", u.text);
        await expect(r).toHaveAttribute("data-unit", u.unit);
        if (u.has) await expect(r).toContainText(u.has);
      } else await check(page, c.expect, c.id);
      expect((sc as { downs: number[] }).downs.length, "one pointerdown per press").toBe(steps.length);
      expect(Math.max(...lates), "a press came later than 30 ms after its beat").toBeLessThan(30);
    });
  }
});
