// SPDX-License-Identifier: GPL-3.0-or-later
// A20: compares two golden runs of the Home and precision stages (the desktop's and the WebView's) case by case:
// display, mark and copy text. A difference is a finding with its input.
//   node scripts/golden-compare.ts desktop.json device.log   # JSON array, or logcat text with PASCALINE_BENCH golden lines
// Exit 0 only when no case differs and none is missing on either side.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import type { GoldenRecord } from "../src/goldenRun.ts";

export interface Finding {
  stage: string;
  id: string;
  input: string;
  what: "display" | "mark" | "full" | "uses" | "missing";
  desktop?: string;
  device?: string;
}

const key = (r: GoldenRecord): string => `${r.stage}/${r.id}`;

export function compareGolden(desktop: GoldenRecord[], device: GoldenRecord[]): Finding[] {
  const out: Finding[] = [];
  const dev = new Map(device.map((r) => [key(r), r]));
  const seen = new Set<string>();
  for (const a of desktop) {
    seen.add(key(a));
    const b = dev.get(key(a));
    if (!b) {
      out.push({ stage: a.stage, id: a.id, input: a.input, what: "missing", desktop: a.display });
      continue;
    }
    for (const what of ["display", "mark", "full", "uses"] as const) {
      if ((a[what] ?? "") !== (b[what] ?? "")) out.push({ stage: a.stage, id: a.id, input: a.input, what, desktop: a[what] ?? "", device: b[what] ?? "" });
    }
  }
  for (const b of device) if (!seen.has(key(b))) out.push({ stage: b.stage, id: b.id, input: b.input, what: "missing", device: b.display });
  return out;
}

/** Records from a JSON array, or from logcat text: every `PASCALINE_BENCH golden {json}` line (a repeated case keeps its last). */
export function readRecords(text: string): GoldenRecord[] {
  const t = text.trim();
  if (t.startsWith("[")) return JSON.parse(t) as GoldenRecord[];
  const byKey = new Map<string, GoldenRecord>();
  for (const line of text.split("\n")) {
    const m = /PASCALINE_BENCH golden (\{.*\})/.exec(line);
    if (!m) continue;
    const r = JSON.parse(m[1]!) as GoldenRecord;
    if (r.stage && r.id) byKey.set(key(r), r);
  }
  return [...byKey.values()];
}

export function describe(f: Finding): string {
  return `${f.stage} ${f.id} [${f.what}] input ${f.input}: desktop ${JSON.stringify(f.desktop)}, device ${JSON.stringify(f.device)}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [a, b] = process.argv.slice(2);
  if (!a || !b) throw new Error("usage: golden-compare.ts desktop.json device.(json|log)");
  const da = readRecords(readFileSync(a, "utf8"));
  const db = readRecords(readFileSync(b, "utf8"));
  const fs = compareGolden(da, db);
  for (const f of fs) console.log(describe(f));
  console.log(`${fs.length === 0 ? "SAME" : "DIFFERENT"}: ${da.length} desktop, ${db.length} device records, ${fs.length} findings`);
  process.exit(fs.length === 0 ? 0 : 1);
}
