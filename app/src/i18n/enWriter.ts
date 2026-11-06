// SPDX-License-Identifier: GPL-3.0-or-later
// R95: the words of the line a tab shows while another tab holds the store. A table of its own, loaded with the
// hand-over's chunk (state/handOver.ts), so the start chunk does not carry it. English only so far.
export const enWriter = {
  "writer.elsewhere": "N62 is open in another tab",
  "writer.notKept": "Nothing done in this tab is kept",
  "writer.useHere": "Use here",
} as const;

export type WriterKey = keyof typeof enWriter;

export const writerText = (key: WriterKey): string => enWriter[key];
