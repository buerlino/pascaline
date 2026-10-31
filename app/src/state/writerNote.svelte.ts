// SPDX-License-Identifier: GPL-3.0-or-later
// R95: the line a tab shows while another tab holds the store (state/writer.ts). handOver.ts (a lazy chunk) sets
// `view` to the note's component, so its code stays out of the start chunk; App.svelte draws it while it is set.
// `take` is the note's Use here: it hands the store to this tab (null while a hand-over is under way).
import type { Component } from "svelte";

export const writerNote = $state<{ view: Component | null; take: (() => void) | null }>({ view: null, take: null });
