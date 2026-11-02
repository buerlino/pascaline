// SPDX-License-Identifier: GPL-3.0-or-later
// Asks the browser once to keep our storage (history, definitions, settings) out of its eviction (A49). Called after
// the first stored value; the answer is the browser's business (Chrome decides by use, Firefox asks the user), so the
// question is not repeated: a flag in localStorage keeps it to once per browser profile. The answer is kept for
// Settings › Data (R96), which also asks `persisted()` once per open of its level.
const FLAG = "pascaline.persist-asked";
let asked = false;
/** Whether the browser keeps the store out of its eviction: the last answer of `persist()` or `persisted()` in this
 *  session; undefined before one came (or without a storage manager). */
let answer: boolean | undefined;

export function askPersistOnce(): void {
  if (asked) return;
  asked = true;
  try {
    if (localStorage.getItem(FLAG) !== null) return;
    localStorage.setItem(FLAG, "1");
    void navigator.storage?.persist?.().then(
      (a) => (answer = a),
      () => {},
    );
  } catch {
    /* no localStorage or no storage manager: nothing to ask */
  }
}

/** The answer kept so far (R96). */
export const persistAnswer = (): boolean | undefined => answer;

/** R96: asks `persisted()` (Settings › Data, once per open of its level), keeps its answer and gives it; a browser
 *  without it gives the answer kept so far. */
export async function askPersisted(): Promise<boolean | undefined> {
  try {
    const a = await navigator.storage?.persisted?.();
    if (typeof a === "boolean") answer = a;
  } catch {
    /* no storage manager: the answer stays as it was */
  }
  return answer;
}
