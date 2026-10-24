// SPDX-License-Identifier: GPL-3.0-or-later
// G103: a Giac (numeric.ts) for tests that answer evals with fixed texts: it has no bridge, so its value throws (a test that reaches them needs a real engine). Never bundled into the app.
import type { Giac } from "./numeric.ts";

export function fakeGiac(evaluate: (text: string) => string, more: Partial<Giac> = {}): Giac {
  const none = (what: string) => (): never => {
    throw new Error(`fakeGiac: no ${what} in this test's engine`);
  };
  return { eval: evaluate, value: none("giac_value"), ...more };
}
