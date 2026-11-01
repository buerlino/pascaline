// SPDX-License-Identifier: GPL-3.0-or-later
// The DATA_VERSION steps (state/storage.ts): a lazy chunk (R103). kvGet loads it only for a record stamped below
// DATA_VERSION whose key has a step (STEP_KEYS); the backup's check, the presets and the library import (engine side)
// import it as they are loaded later anyway.
import { migrateAngleDefs, migrateAngleText } from "../engine/angleMigration.ts";
import { stamp, unstamp, type Migrations } from "./storage.ts";

export const MIGRATIONS: Migrations = {
  // 0 → 1: only the stamp is new.
  0: {},
  // 1 → 2: a definitions entry may carry `desc` (G33); nothing to rewrite.
  1: {},
  // 2 → 3 (G46): Giac runs in radians and the degree mode lives in the text (`pasdeg`); pasexp goes
  // (engine/angleMigration.ts).
  2: { defs: migrateAngleDefs, library: migrateAngleText },
  // 3 → 4 (R94): nothing to rewrite; the stamp guards settings schema 4 from builds that would drop its fields.
  3: {},
};

/** Plain text (a library file, G33) written in `from`, brought up to DATA_VERSION by the same steps as the stored `defs`. */
export function migratedText(key: string, text: string, from: number, steps: Migrations = MIGRATIONS): string {
  return String(unstamp(key, stamp(text, from), steps).value);
}
