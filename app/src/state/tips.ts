// SPDX-License-Identifier: GPL-3.0-or-later
// R15c4: the first-start tips are shown once. The flag is in the kv store; the overlay itself (views/Tips.svelte) is a
// lazy chunk that only this decision loads. A store that cannot be read shows nothing (it may hold the flag).
import { kvGet, kvSet, type KvRead } from "./storage.ts";

export const TIPS_SEEN = "tipsSeen";

/** True on a profile that has never shown the tips and was not asked to hide them (`?tips=off`: the e2e tests, a deep link). */
export async function tipsDue(search: string, read: (key: string) => Promise<KvRead<unknown>> = kvGet): Promise<boolean> {
  return !/[?&]tips=off(&|$)/.test(search) && (await read(TIPS_SEEN)).kind === "none";
}

/** Remember that the tips were shown. */
export function markTipsSeen(): void {
  void kvSet(TIPS_SEEN, true);
}
