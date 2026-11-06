// SPDX-License-Identifier: GPL-3.0-or-later
// R137: the one in-memory Kv the Vitest files share (before: 17 copies). `data` is the store itself, which tests read and
// seed; `writes` lists the key of every set, in order. Values are cloned on the way in, so a later change to the object
// a test passed does not reach the store; `cloneReads` clones them on the way out too.
import type { Kv } from "./storage.ts";

export interface FakeKv extends Kv {
  readonly data: Map<string, unknown>;
  readonly writes: string[];
}

export function fakeKv(init: Iterable<[string, unknown]> = [], opts: { cloneReads?: boolean } = {}): FakeKv {
  const data = new Map<string, unknown>(init);
  const writes: string[] = [];
  return {
    data,
    writes,
    get: <T>(k: string) => Promise.resolve((opts.cloneReads ? structuredClone(data.get(k)) : data.get(k)) as T | undefined),
    set: (k, v) => {
      writes.push(k);
      data.set(k, structuredClone(v));
      return Promise.resolve();
    },
  };
}
