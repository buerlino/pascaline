// SPDX-License-Identifier: GPL-3.0-or-later
// A32: one JSON line per case to .coord/device-runs.jsonl (kind "core") and the closing `CORE DEVICE` line.
import { appendFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";
import { deviceLine } from "./core-plan.ts";

const coord = (): string => {
  if (process.env["PASCALINE_COORD"]) return process.env["PASCALINE_COORD"];
  const common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" }).trim();
  return resolve(dirname(common), ".coord");
};

export default class DeviceReporter implements Reporter {
  private passed = 0;
  private active = 0;
  private known = 0;
  private needs = 0;
  private seen = 0;

  onTestEnd(test: TestCase, result: TestResult): void {
    const m = /^(c\d\d) /.exec(test.title);
    if (!m) return;
    this.seen++;
    const skipped = result.status === "skipped";
    if (skipped) this.needs++;
    else if (test.expectedStatus === "failed") this.known++;
    else {
      this.active++;
      if (result.status === "passed") this.passed++;
    }
    const ok = skipped ? null : result.status === "passed" || test.expectedStatus === "failed" ? true : false;
    const rec = { t: new Date().toISOString().slice(0, 19), kind: "core", case: m[1], ok, ms: Math.round(result.duration), serial: process.env["ANDROID_SERIAL"] ?? "", ...(skipped ? { skipped: true } : {}), ...(test.expectedStatus === "failed" ? { known: true } : {}), ...(ok === false ? { error: (result.error?.message ?? "").split("\n")[0]?.slice(0, 200) } : {}) };
    const dir = coord();
    mkdirSync(dir, { recursive: true });
    appendFileSync(resolve(dir, "device-runs.jsonl"), JSON.stringify(rec) + "\n");
  }

  onEnd(_r: FullResult): void {
    if (this.seen === 0) return;
    const mk = (n: number): never[] => new Array<never>(n);
    console.log(deviceLine(this.passed, { active: mk(this.active), known: mk(this.known), needs: mk(this.needs) }));
  }
}
