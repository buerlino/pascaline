// SPDX-License-Identifier: GPL-3.0-or-later
// R74f1: the clipboard lock excludes other workers. Headless Chromium may give each context its own clipboard, so the
// shared thing here is a file: every worker writes its own value, waits, and reads back its own; without the lock
// (useClipboardLock) a neighbour's write lands in between. The page clipboard is checked the same way.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { acquireClipboardLock, open, useClipboardLock } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
test.describe.configure({ mode: "parallel" });

const SHARED = resolve("test-results", "clipboard-lock-shared.txt");

test("a second acquire stays pending while the first holds the lock, and succeeds after the release", async () => {
  const release = await acquireClipboardLock();
  try {
    await expect(acquireClipboardLock(300)).rejects.toThrow("clipboard lock not free");
  } finally {
    release();
  }
  (await acquireClipboardLock())();
});

test.describe("workers", () => {
  useClipboardLock();
for (const v of ["alpha-1", "beta-2", "gamma-3", "delta-4"]) {
  test(`the shared clipboard holds ${v} until this test reads it`, async ({ page }) => {
    await open(page);
    mkdirSync(resolve("test-results"), { recursive: true });
    writeFileSync(SHARED, v);
    await page.evaluate((s) => navigator.clipboard.writeText(s), v);
    await page.waitForTimeout(600); // long enough for any unlocked neighbour to write
    expect(readFileSync(SHARED, "utf8")).toBe(v);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(v);
  });
}
});
