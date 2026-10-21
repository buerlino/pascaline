// SPDX-License-Identifier: GPL-3.0-or-later
// R74: prints one `CORE <passed>/<active> (known <k>, needs <n>)` line at the end of a run (onEnd runs once, in the
// runner process; afterAll would run per worker and split the line).
import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";

export default class CoreReporter implements Reporter {
  private passed = 0;
  private active = 0;
  private known = 0;
  private needs = 0;
  private seen = new Set<string>();

  onTestEnd(test: TestCase, result: TestResult): void {
    if (!test.location.file.endsWith("core.spec.ts") || !/^c\d\d /.test(test.title)) return;
    const final = result.status === "skipped" || result.retry >= test.retries || result.status === "passed";
    if (!final) return;
    if (this.seen.has(test.id)) return;
    this.seen.add(test.id);
    if (result.status === "skipped") this.needs++;
    else if (test.expectedStatus === "failed") this.known++;
    else {
      this.active++;
      if (result.status === "passed") this.passed++;
    }
  }

  onEnd(_r: FullResult): void {
    if (this.seen.size === 0) return;
    console.log(`CORE ${this.passed}/${this.active} (known ${this.known}, needs ${this.needs})`);
  }
}
