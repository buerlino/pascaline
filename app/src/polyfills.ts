// SPDX-License-Identifier: GPL-3.0-or-later
// The oldest WebView we support (Chrome 101, Android 9 devices) lacks ES2023 array methods that JSXGraph uses
// (toSorted crashed the Plot view on the S8+). Installed before anything else in main.ts.
type Cmp<T> = ((a: T, b: T) => number) | undefined;
const def = (name: string, fn: unknown): void => {
  if (!(name in Array.prototype)) Object.defineProperty(Array.prototype, name, { value: fn, writable: true, configurable: true });
};

export function installPolyfills(): void {
  def("toSorted", function <T>(this: T[], cmp?: Cmp<T>): T[] {
    return Array.prototype.slice.call(this).sort(cmp);
  });
  def("toReversed", function <T>(this: T[]): T[] {
    return Array.prototype.slice.call(this).reverse();
  });
  def("findLast", function <T>(this: T[], f: (v: T, i: number, a: T[]) => unknown): T | undefined {
    for (let i = this.length - 1; i >= 0; i--) if (f(this[i] as T, i, this)) return this[i];
    return undefined;
  });
  def("findLastIndex", function <T>(this: T[], f: (v: T, i: number, a: T[]) => unknown): number {
    for (let i = this.length - 1; i >= 0; i--) if (f(this[i] as T, i, this)) return i;
    return -1;
  });
}

installPolyfills();
