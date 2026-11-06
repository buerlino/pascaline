// SPDX-License-Identifier: GPL-3.0-or-later
// The library file's stamp line and size limit (r10 section 1.2), in one place for the worker's reader (library.ts) and
// the main thread's migration of an older file (state/libraryFormat.ts upToDate). Imports nothing, so the main thread
// gets these few bytes and not the reader.

/** r10 section 1.2: the most bytes one file may hold. */
export const LIB_MAX_BYTES = 256 * 1024;

/** The stamp line, `// n62 library <version>` (trimmed); its group is the version. A file whose first line has the name
 *  before N62, `// pascaline library <version>` (R138), reads the same; the app writes only the new line. */
export const HEADER = /^\/\/ (?:n62|pascaline) library (\d+)$/;
