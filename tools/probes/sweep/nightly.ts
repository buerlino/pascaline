// SPDX-License-Identifier: GPL-3.0-or-later
// G116: the nightly sweep's report. For each failure not in sweep-known.yaml, the smallest subtree that still fails the same check
// (edges.ts's childrenOf: try each child, keep the smallest), then one Markdown file grouped by check. Report only.
import { latexToGiac } from "../../../app/src/input/latex-to-giac.ts";
import type { Case } from "./gen.ts";
import type { Oracle } from "./judge.ts";
import { judgeOne, oracleFor, type Judged, type Run, type Runner } from "./run.ts";

export interface Finding {
  run: Judged;
  oracle: Oracle;
  /** The smallest subtree failing the same check (the run itself when no child does). */
  smallest: Judged;
  smallestOracle: Oracle;
}

const keyOf = (r: { angle: string; digits: number; latex: string }): string => `${r.angle} ${r.digits} ${r.latex}`;
const checkOf = (j: Judged): string => j.verdict.check ?? j.verdict.kind;

/** Every subtree below the failures, so that the oracle runs once for all of them. */
function descendants(runs: readonly Run[], childrenOf: (latex: string) => Case[]): Run[] {
  const out = new Map<string, Run>();
  const walk = (latex: string, run: Run): void => {
    for (const k of childrenOf(latex)) {
      const r: Run = { latex: k.latex, mp: k.mp, angle: run.angle, digits: run.digits };
      if (!out.has(keyOf(r))) out.set(keyOf(r), r);
      walk(k.latex, run);
    }
  };
  runs.forEach((r) => walk(r.latex, r));
  return [...out.values()];
}

/** The findings with their smallest failing subtrees. One oracle batch for every subtree; children run on `runner`. */
export async function shrink(
  failed: readonly { run: Judged; oracle: Oracle }[],
  childrenOf: (latex: string) => Case[],
  runner: Runner,
  python: string,
  oraclePy: string,
): Promise<Finding[]> {
  const subs = descendants(
    failed.map((f) => f.run),
    childrenOf,
  );
  const oracles = new Map<string, Oracle>();
  if (subs.length > 0) oracleFor(subs, python, oraclePy).forEach((o, i) => oracles.set(keyOf(subs[i]!), o));
  const judgedSub = new Map<string, Judged | null>();
  const judgeSub = async (r: Run): Promise<Judged | null> => {
    const k = keyOf(r);
    if (judgedSub.has(k)) return judgedSub.get(k)!;
    let giac: string;
    try {
      giac = latexToGiac(r.latex);
    } catch {
      judgedSub.set(k, null);
      return null;
    }
    const j = await judgeOne(runner, r, giac, oracles.get(k) ?? { kind: "skip", reason: "no oracle" });
    judgedSub.set(k, j);
    return j;
  };
  const smallestOf = async (j: Judged, check: string): Promise<Judged> => {
    let best = j;
    for (const c of childrenOf(j.latex)) {
      const cj = await judgeSub({ latex: c.latex, mp: c.mp, angle: j.angle, digits: j.digits });
      if (!cj || checkOf(cj) !== check) continue;
      const s = await smallestOf(cj, check);
      if (s.latex.length < best.latex.length) best = s;
    }
    return best;
  };
  const out: Finding[] = [];
  for (const f of failed) {
    const smallest = await smallestOf(f.run, checkOf(f.run));
    out.push({ ...f, smallest, smallestOracle: smallest === f.run ? f.oracle : (oracles.get(keyOf(smallest)) ?? f.oracle) });
  }
  return out;
}

const cell = (s: string): string => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
const shownOf = (j: Judged): string => {
  const s = j.shown;
  if (!s) return "—";
  if (s.hang) return "no answer";
  const mark = s.mark ? `${s.mark}${s.n !== undefined && s.mark === "⚠" ? ` ${s.n}` : ""} ` : "";
  return `${mark}${s.display ?? ""}`.slice(0, 120);
};
const oracleText = (o: Oracle): string => {
  if (o.kind === "novalue") return "no value";
  if (o.kind === "skip") return `skip (${o.reason})`;
  const short = (t: string): string => {
    const m = /^(-?)(\d*)\.?(\d*)(?:e([+-]?\d+))?$/.exec(t);
    if (!m) return t;
    return t.length > 24 ? `${t.slice(0, 18)}…${m[4] !== undefined ? `e${m[4]}` : ""}` : t;
  };
  return o.im === "0.0" || o.im === "0" ? short(o.re) : `${short(o.re)} ${o.im.startsWith("-") ? "−" : "+"} ${short(o.im.replace(/^-/, ""))}·i`;
};

/** The Markdown report: header, counts per check, then one table per check. */
export function reportMarkdown(head: string[], findings: readonly Finding[]): string {
  const checks = [...new Set(findings.map((f) => checkOf(f.run)))].sort();
  const lines = [...head, "", `${findings.length} findings not in tests/golden/sweep-known.yaml: ${checks.map((c) => `${c} ${findings.filter((f) => checkOf(f.run) === c).length}`).join(", ") || "none"}.`, ""];
  for (const c of checks) {
    lines.push(`## ${c}`, "", "| angle digits | LaTeX | shown | oracle | smallest failing subtree | its shown | its oracle |", "|---|---|---|---|---|---|---|");
    for (const f of findings.filter((x) => checkOf(x.run) === c)) {
      const same = f.smallest === f.run;
      lines.push(
        `| ${f.run.angle} ${f.run.digits} | \`${cell(f.run.latex)}\` | ${cell(shownOf(f.run))} | ${cell(oracleText(f.oracle))} | ${same ? "(itself)" : `\`${cell(f.smallest.latex)}\``} | ${same ? "" : cell(shownOf(f.smallest))} | ${same ? "" : cell(oracleText(f.smallestOracle))} |`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}
