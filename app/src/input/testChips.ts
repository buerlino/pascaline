// SPDX-License-Identifier: GPL-3.0-or-later
// Test helper: the chip table the keyboard template samples are parsed with.
import { ANS_KEY, type ChipTable } from "./chips.ts";

/** The chip table keyboard template samples are parsed with (spec/keyboard.yaml: Shift + `+` = Ans, sample Ans = 7). */
export const SAMPLE_CHIPS: ChipTable = { [ANS_KEY]: { value: "7", exact: true } };
