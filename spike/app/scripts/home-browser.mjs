// SPDX-License-Identifier: GPL-3.0-or-later
// Desktop browser check of the on-device Home run: opens /?home=1 on a running `vite preview`
// (port 4173) in Playwright's Chromium and/or Firefox and prints the PASCALINE_HOME summary.
//   npm run build && npm run preview &   node scripts/home-browser.mjs [chromium|firefox ...]
import { chromium, firefox } from "@playwright/test";

const browsers = { chromium, firefox };
for (const name of process.argv.slice(2).length ? process.argv.slice(2) : ["chromium"]) {
  const browser = await browsers[name].launch();
  const page = await browser.newPage();
  const lines = [];
  const done = new Promise((resolve) =>
    page.on("console", (m) => {
      const t = m.text();
      if (t.startsWith("PASCALINE_HOME")) lines.push(t);
      if (t.includes("home-done")) resolve();
    }),
  );
  await page.goto("http://localhost:4173/?home=1");
  await Promise.race([done, new Promise((r) => setTimeout(r, 120000))]);
  const cases = lines.filter((l) => l.startsWith("PASCALINE_HOME case")).map((l) => JSON.parse(l.slice(20)));
  const summary = lines.find((l) => l.startsWith("PASCALINE_HOME summary"));
  const slow = cases.filter((c) => c.totalMs > 50).map((c) => `${c.id} ${c.totalMs} ms (${c.path})`);
  console.log(`${name} ${browser.version()}: ${summary ?? "no summary"}\n  slow: ${slow.join(", ")}`);
  await browser.close();
}
