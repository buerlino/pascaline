// SPDX-License-Identifier: GPL-3.0-or-later
// A32: one JSON line per case to .coord/device-runs.jsonl (kind "core") and the closing `CORE DEVICE` line.
import { appendFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";
import { caseRecord, deviceLine } from "./core-plan.ts";

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
    const r = caseRecord({ title: test.title, expectedStatus: test.expectedStatus, status: result.status, duration: result.duration, error: result.error?.message }, new Date().toISOString().slice(0, 19), process.env["ANDROID_SERIAL"] ?? "");
    if (!r) return;
    this.seen++;
    this[r.counts]++;
    if (r.passed) this.passed++;
    const rec = r.rec;
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
