// SPDX-License-Identifier: GPL-3.0-or-later
// R95: one writer per browser profile (docs/04 6.2). Every store key is written whole from a tab's memory, so two tabs
// (or the installed PWA and a tab) would drop each other's rows and definitions. The tab that holds the Web Lock
// `pascaline-writer` writes; any other tab computes as usual and writes nothing (the store layer asks `guardWrite`,
// storage.ts and storageRaw.ts). The note and the hand-over over a BroadcastChannel are a lazy chunk (handOver.ts).
// Without `navigator.locks` (and in the Android app, one WebView: launchMode singleTask) every tab writes, as before.

export const WRITER_LOCK = "pascaline-writer";

/** May this tab write, as of now? Settles once the lock was asked for; every store write waits for it. Replaced (not
 *  changed) when the tab hands the store over, so a write asked for before the hand-over keeps its answer. */
let allowed: Promise<boolean> = Promise.resolve(true);
let release: (() => void) | undefined;
/** Writes this tab has begun and not finished: a hand-over lets go of the lock only once they are in. */
const inflight = new Set<Promise<unknown>>();

/** One store write: run when this tab is the writer at the time of the call, else dropped (undefined).
 *  `refused` is what a dropped write gives instead (kvSetMany's caller is told; kvSet's are not). */
export function guardWrite<T>(write: () => Promise<T>, refused: () => T): Promise<T> {
  const p = allowed.then((ok) => (ok ? write() : refused()));
  inflight.add(p);
  const done = (): void => void inflight.delete(p);
  p.then(done, done);
  return p;
}

type Locks = { request(name: string, opts: { ifAvailable?: boolean }, cb: (lock: unknown) => Promise<void> | void): Promise<unknown> };
type Native = { Capacitor?: { isNativePlatform?: () => boolean } };

/** The Web Locks API where a second tab can exist: not in the Android app (one WebView, no reach). */
export function locksOf(g: typeof globalThis): Locks | undefined {
  if ((g as Native).Capacitor?.isNativePlatform?.() === true) return undefined;
  return (g.navigator as Navigator & { locks?: Locks } | undefined)?.locks;
}

/**
 * At start (main.ts): ask for the lock without waiting for it, and hold it for the page's life. `then` gets the answer:
 * true for the writer, false for a second tab. Without the lock API it is never called: the tab writes as before.
 */
export function claimWriter(then: (writer: boolean) => void, locks = locksOf(globalThis)): void {
  if (!locks) return;
  allowed = new Promise<boolean>((resolve) => {
    locks
      .request(WRITER_LOCK, { ifAvailable: true }, (lock) => {
        resolve(lock !== null);
        return lock === null ? undefined : new Promise<void>((r) => (release = r));
      })
      .catch(() => resolve(true)); // a lock manager that refuses (an opaque origin): write as before
  });
  void allowed.then(then);
}

/** The hand-over (handOver.ts) and a test's kill: write nothing more, let the writes in flight land, then let go of
 *  the lock. */
export async function yieldWriter(): Promise<void> {
  allowed = Promise.resolve(false);
  await Promise.allSettled([...inflight]);
  release?.();
  release = undefined;
}
