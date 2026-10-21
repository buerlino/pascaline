// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (structure audit, 2026-10-20): what each merged package added to the text glue. For every merge on the first
// parent of a commit (default HEAD) since a date, the diff merge^1..merge in app/src (tests excluded) is read and
// counted:
//   regex+   added lines that read text with a pattern (a regex literal, .match/.replace/.test/.exec/.split(/…/), new RegExp)
//   regex-   the same, removed (the totals also give both for app/src/engine alone)
//   list+    added string entries in the name lists that steer the engine by name (STATEFUL, QUOTING, DECISION_FUNCTIONS,
//            AUDITED_FUNCTIONS, RATIONAL_FUNCTIONS, COMPLEX_DEFINITIONS, ENGINE_DEFINITIONS, STATE_WORDS, CALL_NAME,
//            CONSTANT_NAMES, ANGLE_IN, ANGLE_OUT): lines inside such a list, or lines naming the list, that add a quoted word
//   pas+     new helper names of ours sent to Giac (`pas…:=` or a `pas…` key in a definitions table)
//   engine   net lines in app/src/engine; other: net lines elsewhere in app/src
// Output: one row per package, then totals and the rows with the most regex+.
//   node tools/probes/glue-growth.mjs [--since 2026-10-06] [--rev HEAD] [--md]
// Read-only (git only); no network.
import { execFileSync } from "node:child_process";

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const since = arg("--since", "2026-10-06");
const rev = arg("--rev", "HEAD");
const md = process.argv.includes("--md");
const git = (...a) => execFileSync("git", a, { encoding: "utf8", maxBuffer: 1 << 28 });

const REGEX_LINE = /(\/(?![/*])(?:\\.|\[[^\]]*\]|[^/\n\\])+\/[dgimsuyv]*\s*[.,;)\]]|\.(?:match|matchAll|replace|replaceAll|test|exec|search)\(|\.split\(\s*\/|new RegExp\()/;
const LISTS = /\b(STATEFUL|QUOTING|DECISION_FUNCTIONS|AUDITED_FUNCTIONS|RATIONAL_FUNCTIONS|COMPLEX_DEFINITIONS|ENGINE_DEFINITIONS|STATE_WORDS|CALL_NAME|CONSTANT_NAMES|ANGLE_IN|ANGLE_OUT)\b/;
const PAS = /\bpas[a-z_0-9]*\s*(?::=|":|\(x\):=)|["']pas[a-z0-9]+["']\s*:/;

const merges = git("log", "--first-parent", "--merges", `--since=${since}`, "--format=%H%x09%ad%x09%s", "--date=short", rev)
  .trim()
  .split("\n")
  .filter(Boolean)
  .reverse();

const rows = [];
for (const line of merges) {
  const [h, date, subject] = line.split("\t");
  const id = (/:\s*([A-Z][A-Za-z0-9]+(?:f\d)?)\b/.exec(subject) ?? [, subject.slice(0, 30)])[1];
  const diff = git("diff", "--unified=3", `${h}^1`, h, "--", "app/src", ":(exclude)app/src/**/*.test.ts", ":(exclude)app/src/**/*.spec.ts");
  let file = "";
  let inList = false;
  const r = { id, date, h: h.slice(0, 7), regexAdd: 0, regexDel: 0, engRegexAdd: 0, engRegexDel: 0, listAdd: 0, pasAdd: 0, engine: 0, other: 0 };
  for (const l of diff.split("\n")) {
    if (l.startsWith("+++ ")) {
      file = l.slice(6);
      inList = false;
      continue;
    }
    if (l.startsWith("--- ") || l.startsWith("diff ") || l.startsWith("index ")) continue;
    if (l.startsWith("@@")) {
      inList = LISTS.test(l);
      continue;
    }
    const body = l.slice(1);
    if (LISTS.test(body)) inList = true;
    if (/^\s*(\]|\}|\);?)\s*;?\s*$/.test(body) && !l.startsWith("+")) inList = false;
    const add = l.startsWith("+");
    const del = l.startsWith("-");
    if (!add && !del) continue;
    const sign = add ? 1 : -1;
    if (file.startsWith("app/src/engine/")) r.engine += sign;
    else r.other += sign;
    if (/^\s*(\/\/|\*|\/\*)/.test(body)) continue; // comments
    if (REGEX_LINE.test(body)) {
      add ? r.regexAdd++ : r.regexDel++;
      if (file.startsWith("app/src/engine/")) add ? r.engRegexAdd++ : r.engRegexDel++;
    }
    if (add && (inList || LISTS.test(body)) && /["'][A-Za-z_][A-Za-z0-9_]*["']/.test(body)) r.listAdd += (body.match(/["'][A-Za-z_][A-Za-z0-9_]*["']/g) ?? []).length;
    if (add && PAS.test(body)) r.pasAdd++;
  }
  rows.push(r);
}

const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
const touched = rows.filter((r) => r.engine || r.other);
if (md) {
  console.log("| Package | Merge | Date | regex+ | regex− | list+ | pas+ | net engine | net other |");
  console.log("|---|---|---|---|---|---|---|---|---|");
  for (const r of touched) console.log(`| ${r.id} | ${r.h} | ${r.date} | ${r.regexAdd} | ${r.regexDel} | ${r.listAdd} | ${r.pasAdd} | ${r.engine} | ${r.other} |`);
} else {
  for (const r of touched) console.log(`${r.date} ${r.h} ${r.id.padEnd(10)} regex +${r.regexAdd} -${r.regexDel}  list +${r.listAdd}  pas +${r.pasAdd}  net engine ${r.engine} other ${r.other}`);
}
const fixLike = touched.filter((r) => /f\d$/.test(r.id));
console.log(`\n${merges.length} merges since ${since}; ${touched.length} touch app/src. Totals: regex +${sum("regexAdd")} -${sum("regexDel")}, list +${sum("listAdd")}, pas +${sum("pasAdd")}, net engine ${sum("engine")}, net other ${sum("other")}.`);
console.log(`In app/src/engine: regex +${sum("engRegexAdd")} -${sum("engRegexDel")}; packages that added engine regex lines: ${touched.filter((r) => r.engRegexAdd > 0).length}; that removed more than they added: ${touched.filter((r) => r.engRegexDel > r.engRegexAdd).map((r) => r.id).join(", ") || "none"}.`);
console.log(`Packages that removed more regex lines than they added: ${touched.filter((r) => r.regexDel > r.regexAdd).map((r) => r.id).join(", ") || "none"}.`);
console.log(`Fix packages (id ending f<n>): ${fixLike.length}; their regex +${fixLike.reduce((a, r) => a + r.regexAdd, 0)}.`);
