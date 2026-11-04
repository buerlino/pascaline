// SPDX-License-Identifier: GPL-3.0-or-later
// The tidy chunk's load for the session (split from state/session.svelte.ts, R40): load, prefetch and a tidy that never
// fails a finished result.
/** R91: the tidy-up of Giac's latex (render/tidy.ts) is only needed once a result is in, so it is a chunk of its own: it
 *  loads beside the first job (and when idle, main.ts), and a failed load is tried again by the next job. */
let tidyChunk: Promise<typeof import("../render/tidy.ts")> | undefined;
export const loadTidy = (): Promise<typeof import("../render/tidy.ts")> =>
  (tidyChunk ??= import("../render/tidy.ts").catch((e: unknown) => {
    tidyChunk = undefined;
    throw e;
  }));
/** Start the tidy chunk's load beside a job; a failure here is dealt with where the result is drawn (tidyOr). */
export const prefetchTidy = (): Promise<typeof import("../render/tidy.ts")> => {
  const p = loadTidy();
  p.catch(() => {});
  return p;
};
/** Tidy `raw`; a chunk that will not load (a tab open across a redeploy: the old hashed file is gone) never turns the
 *  finished result into an error: one more try, then `fallback` is drawn. */
export async function tidyOr(load: Promise<typeof import("../render/tidy.ts")>, raw: string, fallback: string): Promise<string> {
  try {
    return (await load).tidyGiacLatex(raw);
  } catch {
    try {
      return (await loadTidy()).tidyGiacLatex(raw);
    } catch {
      return fallback;
    }
  }
}
