// SPDX-License-Identifier: GPL-3.0-or-later
// What the library file's reader needs of the stored data (G147): the version it accepts and the migration steps for a
// file's text. engine/library.ts takes it as an argument, so the engine imports nothing from state/ (the direction is
// state/ -> engine/ only). Loaded with the library import, never at start (migrations.ts is a lazy chunk, R103).
import type { LibraryFormat } from "../engine/library.ts";
import { migratedText } from "./migrations.ts";
import { DATA_VERSION } from "./storage.ts";

export const LIBRARY_FORMAT: LibraryFormat = {
  version: DATA_VERSION,
  migrate: (text, from) => migratedText("library", text, from),
};
