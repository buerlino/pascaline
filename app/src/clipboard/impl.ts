// SPDX-License-Identifier: GPL-3.0-or-later
// Everything Copy and Paste need that is not needed at start: loaded on the first use (docs/04 section 8.3, start chunk).
export { parsePastedNumber } from "./paste.ts";
export { webClipboard, type ClipboardPort } from "./port.ts";
export { choosePort } from "./native.ts";
export { saveFile, type SaveResult } from "./files.ts";
export { copyFull, sessionText, tableCsv, withoutMark } from "./text.ts";
