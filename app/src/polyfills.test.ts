// SPDX-License-Identifier: GPL-3.0-or-later
import { expect, test } from "vitest";
import { installPolyfills } from "./polyfills.ts";

// Regression: Chrome 101 has no Array.prototype.toSorted; JSXGraph's board init threw on the S8+.
test("installs missing ES2023 array methods", () => {
  const proto = Array.prototype as unknown as Record<string, unknown>;
  const saved = ["toSorted", "toReversed", "findLast", "findLastIndex"].map((n) => [n, proto[n]] as const);
  for (const [n] of saved) delete proto[n];
  try {
    installPolyfills();
    const a = [3, 1, 2] as unknown as { toSorted(): number[]; toReversed(): number[]; findLast(f: (v: number) => boolean): number; findLastIndex(f: (v: number) => boolean): number };
    expect(a.toSorted()).toEqual([1, 2, 3]);
    expect(a.toReversed()).toEqual([2, 1, 3]);
    expect(a.findLast((v) => v > 1)).toBe(2);
    expect(a.findLastIndex((v) => v > 1)).toBe(2);
    expect(a as unknown as number[]).toEqual([3, 1, 2]);
  } finally {
    for (const [n, f] of saved) Object.defineProperty(Array.prototype, n, { value: f, writable: true, configurable: true });
  }
});
