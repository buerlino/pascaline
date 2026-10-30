// SPDX-License-Identifier: GPL-3.0-or-later
// Asks the browser once to keep our storage (history, definitions, settings) out of its eviction (A49). Called after
// the first stored value; the answer is the browser's business (Chrome decides by use, Firefox asks the user), so the
// question is not repeated: a flag in localStorage keeps it to once per browser profile.
const FLAG = "pascaline.persist-asked";
let asked = false;

export function askPersistOnce(): void {
  if (asked) return;
  asked = true;
  try {
    if (localStorage.getItem(FLAG) !== null) return;
    localStorage.setItem(FLAG, "1");
    void navigator.storage?.persist?.().catch(() => {});
  } catch {
    /* no localStorage or no storage manager: nothing to ask */
  }
}
