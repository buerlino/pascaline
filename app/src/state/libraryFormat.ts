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

/** R59: a library file with an older stamp brought up to DATA_VERSION, for the worker, which runs no migration: the
 *  stamp rewritten and the text below it migrated line for line, so every line number stays the file's. Anything else
 *  goes on as it came (not UTF-8, a missing or newer stamp, already up to date), for the worker's reader to take or
 *  refuse with its own words (engine/library.ts parseLibrary). */
export function upToDate(input: Uint8Array | string): Uint8Array | string {
  let text: string;
  try {
    text = typeof input === "string" ? input : new TextDecoder("utf-8", { fatal: true }).decode(input);
  } catch {
    return input;
  }
  text = text.replace(/^\ufeff/, "").replace(/\r\n?/g, "\n");
  const nl = text.indexOf("\n");
  const m = /^\/\/ pascaline library (\d+)$/.exec((nl < 0 ? text : text.slice(0, nl)).trim());
  const from = m ? Number(m[1]) : DATA_VERSION;
  if (from >= DATA_VERSION) return input;
  return `// pascaline library ${DATA_VERSION}\n${migratedText("library", nl < 0 ? "" : text.slice(nl + 1), from)}`;
}
