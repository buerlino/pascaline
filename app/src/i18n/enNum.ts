// SPDX-License-Identifier: GPL-3.0-or-later
// R99: why the Num entry of Solve and Function refused a value. A table of its own, loaded with the apps' chunks, so the
// start chunk does not carry it (R91's pin, docs/04 section 8.3). English only so far.
export const enNum = {
  "num.notNumber": "Not a number",
  "num.zeroStep": "The step cannot be 0",
} as const;

export type NumKey = keyof typeof enNum;

export const numText = (key: NumKey): string => enNum[key];
