// SPDX-License-Identifier: GPL-3.0-or-later
// The item picked last, per sheet and level (`<sheet id>/<item id>/…`): reopening highlights it (Menu + Enter repeats).
// Its own module so a test clears it with `lastPicks.clear()` (G145: no export only for tests in sheet.svelte.ts).
export const lastPicks = new Map<string, string>();
