// SPDX-License-Identifier: GPL-3.0-or-later
// Desktop sanity run of the device pages in Chromium: prints the PASCALINE_T marks each page logs.
import { chromium } from "@playwright/test";
import { preview } from "vite";

const server = await preview({ preview: { port: 4174, strictPort: true } });
const browser = await chromium.launch();
for (const [url, until] of [["index.html?autorun=3", "plot-fps"], ["python.html", "py-ready"], ["pyodide.html?pkgs=numpy", "pyo-ready"], ["pyodide.html?pkgs=numpy,sympy", "pyo-ready"]]) {
  const page = await browser.newPage();
  const marks = [];
  page.on("console", (m) => { if (m.text().startsWith("PASCALINE_T")) marks.push(m.text()); });
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  await page.goto("http://localhost:4174/" + url);
  for (let i = 0; i < 600 && !marks.some((m) => m.includes(until)); i++) await page.waitForTimeout(100);
  console.log(url, "\n  " + marks.join("\n  "));
  await page.close();
}
await browser.close();
server.httpServer.close();
