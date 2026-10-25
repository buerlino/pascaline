// SPDX-License-Identifier: GPL-3.0-or-later
// G110: the census gate's comparison (app/scripts/findcensus.ts), pure. The known file holds every input's class, one string per
// function (Home's letters, `|`, CAS's letters, in sample order; `-` for a function without a sample), and the findings, each id
// under the backlog line that holds it (`unfiled` for one that has none yet: the stage fails on it), and `deadline`: the inputs whose
// known class came from a deadline (a hang past the census's 6 s, or a time-out refusal), which a faster or a busier machine moves.
import { CLASS_OF_LETTER, FINDINGS, LETTER } from "./classify.ts";
import type { Row } from "./run.ts";

export interface CensusKnown {
  findings?: Record<string, string[]>;
  classes?: Record<string, string>;
  /** The inputs whose known class came from a deadline (hitDeadline). */
  deadline?: string[];
}

/** The input's class came from a clock: no answer before the census's deadline, or the view's own time-out refusal (Home's 2 s). */
export function hitDeadline(r: Row): boolean {
  return r.cls === "hang" || (r.cls === "refused" && /^timeout\b/.test(r.detail));
}

/** The known letter of every input, by id (`home erfc/1`); absent for a function whose input count changed. */
function knownLetters(rows: readonly Row[], known: CensusKnown): Map<string, string> {
  const out = new Map<string, string>();
  const count = new Map<string, number>();
  for (const r of rows) count.set(`${r.view} ${r.name}`, (count.get(`${r.view} ${r.name}`) ?? 0) + 1);
  const seen = new Map<string, number>();
  for (const r of rows) {
    const w = known.classes?.[r.name];
    if (w === undefined || w === "-") continue;
    const [wh = "", wc = ""] = w.split("|");
    const side = r.view === "home" ? wh : wc;
    if (side.length !== count.get(`${r.view} ${r.name}`)) continue;
    const k = seen.get(`${r.view} ${r.name}`) ?? 0;
    seen.set(`${r.view} ${r.name}`, k + 1);
    out.set(r.id, side[k]!);
  }
  return out;
}

/** The inputs to run again alone (no other worker running) before a change counts: their class moved, and the known class or this
 *  run's came from a deadline. */
export function timingSuspects(rows: readonly Row[], known: CensusKnown): Row[] {
  const was = knownLetters(rows, known);
  const dl = new Set(known.deadline ?? []);
  return rows.filter((r) => {
    const w = was.get(r.id);
    return w !== undefined && w !== LETTER[r.cls] && (dl.has(r.id) || hitDeadline(r));
  });
}

/** After the retry: an input that still differs from its known class, and whose known class or retried run came from a deadline, is
 *  a timing change (reported, not failed); `rows` holds the retried rows. */
export function timingChanges(rows: readonly Row[], retried: ReadonlySet<string>, known: CensusKnown): Set<string> {
  const was = knownLetters(rows, known);
  const dl = new Set(known.deadline ?? []);
  return new Set(rows.filter((r) => retried.has(r.id) && was.get(r.id) !== LETTER[r.cls] && (dl.has(r.id) || hitDeadline(r))).map((r) => r.id));
}

export interface StageResult {
  ok: boolean;
  lines: string[];
  summary: string;
}

/** Every function's class string of a run: Home's letters `|` CAS's letters, or `-` without a sample. */
export function classStrings(rows: readonly Row[], none: readonly string[]): Map<string, string> {
  const by = new Map<string, { home: string; cas: string }>();
  for (const r of rows) {
    const e = by.get(r.name) ?? { home: "", cas: "" };
    e[r.view] += LETTER[r.cls];
    by.set(r.name, e);
  }
  const out = new Map<string, string>();
  for (const [n, e] of by) out.set(n, `${e.home}|${e.cas}`);
  for (const n of none) out.set(n, "-");
  return out;
}

/** `timing`: the inputs whose change is a timing change (timingChanges): each gets a TIMING line and fails nothing. */
export function censusStage(rows: readonly Row[], none: readonly string[], known: CensusKnown, timing: ReadonlySet<string> = new Set()): StageResult {
  const lines: string[] = [];
  for (const r of rows) if (timing.has(r.id)) lines.push(`TIMING ${r.id}: was ${CLASS_OF_LETTER[knownLetters(rows, known).get(r.id) ?? ""] ?? "?"}, now ${r.cls} after a retry alone (a deadline, not a class change: ${r.detail})`);
  const now = classStrings(rows, none);
  const was = known.classes ?? {};
  let changed = 0;
  for (const [n, s] of now) {
    const w = was[n];
    if (w === undefined) {
      lines.push(`NEW input ${n}: ${s}`);
      changed++;
      continue;
    }
    if (w === s) continue;
    // every moved input a timing change: no class change
    const [th = "", tc = ""] = w.split("|");
    const moved = rows.filter((x) => x.name === n && (x.view === "home" ? th : tc)[rows.filter((y) => y.name === n && y.view === x.view).indexOf(x)] !== LETTER[x.cls]);
    if (th.length === s.split("|")[0]!.length && tc.length === (s.split("|")[1] ?? "").length && moved.every((x) => timing.has(x.id))) continue;
    changed++;
    if (w === "-" || s === "-") {
      lines.push(`CHANGED ${n}: was ${w}, now ${s}`);
      continue;
    }
    // name the inputs whose class moved
    const [wh = "", wc = ""] = w.split("|");
    for (const r of rows.filter((x) => x.name === n)) {
      const k = rows.filter((x) => x.name === n && x.view === r.view).indexOf(r);
      const old = (r.view === "home" ? wh : wc)[k];
      if (old !== LETTER[r.cls] && !timing.has(r.id)) lines.push(`CHANGED ${r.id}: was ${old ? CLASS_OF_LETTER[old] : "absent"}, now ${r.cls} (${r.latex}  =>  ${r.detail})`);
    }
    if (wh.length !== now.get(n)!.split("|")[0]!.length || wc.length !== now.get(n)!.split("|")[1]!.length) lines.push(`CHANGED ${n}: inputs were ${w}, now ${s}`);
  }
  for (const n of Object.keys(was)) if (!now.has(n)) {
    lines.push(`GONE ${n}: in the known file, not in this run`);
    changed++;
  }
  const filed = new Map<string, string>();
  for (const [line, ids] of Object.entries(known.findings ?? {})) for (const id of ids ?? []) if (line !== "unfiled") filed.set(id, line);
  let news = 0;
  let passing = 0;
  const findingIds = new Set<string>();
  for (const r of rows) {
    if (!FINDINGS.has(r.cls) || timing.has(r.id)) continue;
    findingIds.add(r.id);
    if (!filed.has(r.id)) {
      lines.push(`NEW finding ${r.id} [${r.cls}]: ${r.latex}  =>  ${r.detail}`);
      news++;
    }
  }
  for (const [id, line] of filed) if (!findingIds.has(id) && !timing.has(id)) {
    lines.push(`NOW PASSING ${id}: listed under ${line}, now ${rows.find((x) => x.id === id)?.cls ?? "not run"} (remove it)`);
    passing++;
  }
  const ok = changed === 0 && news === 0 && passing === 0;
  return { ok, lines, summary: `${filed.size} findings filed, ${changed} class changes, ${news} new findings, ${passing} now passing` };
}

/** The known file rewritten from a run: its header kept, the findings kept (ids that are no longer findings dropped, new ones
 *  under `unfiled`), the inputs that hit a deadline, the classes from the run. */
export function knownText(old: string, rows: readonly Row[], none: readonly string[], known: CensusKnown): string {
  const header = old.split("\n").filter((l, i, all) => l.startsWith("#") && all.slice(0, i).every((x) => x.startsWith("#"))).join("\n");
  const findingIds = new Set(rows.filter((r) => FINDINGS.has(r.cls)).map((r) => r.id));
  const groups = new Map<string, string[]>();
  const placed = new Set<string>();
  for (const [line, ids] of Object.entries(known.findings ?? {})) {
    if (line === "unfiled") continue;
    const keep = (ids ?? []).filter((id) => findingIds.has(id));
    keep.forEach((id) => placed.add(id));
    if (keep.length) groups.set(line, keep);
  }
  const unfiled = rows.filter((r) => FINDINGS.has(r.cls) && !placed.has(r.id)).map((r) => r.id);
  if (unfiled.length) groups.set("unfiled", unfiled);
  const q = (s: string): string => JSON.stringify(s);
  const out = [header, "findings:"];
  for (const [line, ids] of groups) out.push(`  ${line}: [${ids.map(q).join(", ")}]`);
  const dl = rows.filter(hitDeadline).map((r) => r.id);
  if (dl.length) out.push(`deadline: [${dl.map(q).join(", ")}]`);
  out.push("classes:");
  for (const [n, s] of [...classStrings(rows, none)].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) out.push(`  ${q(n)}: ${q(s)}`);
  return `${out.join("\n")}\n`;
}
