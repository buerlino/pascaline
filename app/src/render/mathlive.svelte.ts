// SPDX-License-Identifier: GPL-3.0-or-later
// MathLive is the biggest part of the bundle, so it loads after the keypad has been drawn (dynamic import).
// `lib.mod` becomes defined once it is there; views that draw LaTeX show plain text until then.
import type * as MathLive from "mathlive";

class Lazy {
  mod = $state<typeof MathLive | undefined>(undefined);
  private promise: Promise<typeof MathLive> | undefined;

  load(): Promise<typeof MathLive> {
    this.promise ??= import("mathlive").then((m) => {
      this.mod = m;
      return m;
    });
    return this.promise;
  }
}

export const mathlive = new Lazy();

/** How many LaTeX strings have been turned into markup (tests check that Enter draws only the new entry). */
export const renderStats = { count: 0 };
