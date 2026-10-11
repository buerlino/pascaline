import { test } from "@playwright/test";
test("timing", async ({ page }) => {
  const client = await page.context().newCDPSession(page);
  for (const rate of [1, 4, 6]) {
    await client.send("Emulation.setCPUThrottlingRate", { rate });
    const rows: number[][] = [];
    for (let i = 0; i < 7; i++) {
      await page.goto("http://localhost:4181/");
      await page.waitForFunction(() => window.pascalineInput?.timing.serializerReadyMs !== undefined);
      const t = await page.evaluate(() => window.pascalineInput.timing);
      rows.push([t.entryReadyMs, t.serializerReadyMs ?? -1]);
    }
    const med = (k: number) => rows.map((r) => r[k] as number).sort((a, b) => a - b)[3];
    console.log(`cpu x${rate}: median entry ${med(0)} ms, serializer ${med(1)} ms  (${rows.map((r) => r.join("/")).join(" ")})`);
  }
});
