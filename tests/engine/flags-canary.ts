// SPDX-License-Identifier: GPL-3.0-or-later
// G67 canary: every field of Giac's context (`class global` in src/global.h of the pinned tarball) must be listed in
// app/src/engine/flags.ts CONTEXT_FIELDS, as read and restored by the host's settings check or with the reason it is
// not. A Giac update that adds a field fails here until someone decides about it; a listed field the source no longer
// has fails too (the list stays true). Reads the tarball only; no engine, no network.
//   node tests/engine/flags-canary.ts        # PASCALINE_DL_DIR: the tarball cache (default engine/giac/_downloads)
import { SOURCES, member, tarball } from "../../tools/find-index/state.mjs";
import { CONTEXT_FIELDS } from "../../app/src/engine/flags.ts";

const header = member(tarball(SOURCES.giac), "giac-2.1.0/src/global.h");
const start = header.indexOf("  class global {");
const end = header.indexOf("\n  };", start);
if (start < 0 || end < 0) {
  console.log("FAIL: class global not found in src/global.h");
  process.exit(1);
}
// The declarations, comments and preprocessor lines left out: `int _spread_Row_,_spread_Col_;`, `std::ostream * _logptr_;`.
const body = header
  .slice(start, end)
  .split("\n")
  .map((l) => l.replace(/\/\/.*$/, ""))
  .filter((l) => !/^\s*#/.test(l))
  .join("\n");
const fields = new Set<string>();
for (const decl of body.split(";")) {
  if (/\(/.test(decl)) continue; // constructor, destructor, operator=
  const m = /^\s*(?:public:\s*)?(?:class global \{\s*)?(?:public:\s*)?[A-Za-z_][\w:<>,\s*]*?\s*\*?\s*(_\w+(?:\s*,\s*\*?\s*_\w+)*)\s*$/.exec(decl);
  if (!m) continue;
  for (const n of m[1]!.split(",")) fields.add(n.replace(/[\s*]/g, ""));
}
const listed = new Set(Object.keys(CONTEXT_FIELDS));
const missing = [...fields].filter((f) => !listed.has(f));
const stale = [...listed].filter((f) => !fields.has(f));
const read = [...fields].filter((f) => CONTEXT_FIELDS[f] === "read").length;
if (fields.size < 50) {
  console.log(`FAIL: only ${fields.size} fields parsed from class global (the parse broke)`);
  process.exit(1);
}
if (missing.length || stale.length) {
  if (missing.length) console.log(`FAIL: fields of Giac's context not in flags.ts CONTEXT_FIELDS: ${missing.join(", ")}`);
  if (stale.length) console.log(`FAIL: CONTEXT_FIELDS lists fields the pinned source does not have: ${stale.join(", ")}`);
  process.exit(1);
}
console.log(`PASS: ${fields.size} context fields, ${read} read and restored by the host, ${fields.size - read} listed with the reason`);
