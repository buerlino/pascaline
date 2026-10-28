#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// tools/docs-check.mjs: the docs' own gate (S7, the docs diet). Run from anywhere in the repo:
//
//   node tools/docs-check.mjs
//
// 1. Links: every relative Markdown link in every Markdown file of the repo resolves to a file or directory
//    (anchors are not checked), and every `docs/….md` path a live doc names exists.
// 2. Budgets: the whole brief (28 kB; owner, 2026-10-19), backlog.md, decisions.md, docs/04 and every package file in docs/shifts/packages/ stay within their size.
// 3. Ids (A22): no two package files share the id of their heading, no two backlog bug lines (`- **F<n>.**`) share one.
// 4. Live research notes (A22): docs/research/*.md (not the archive) hold at most 150 kB together, and each opens with a
//    status line (**Status … open, decided or reference**) in its first lines.
// 5. Source size (A22): tools/line-baseline.yaml lists every source file over 800 lines at its size; a file past its line,
//    or a new file past 800, fails. Raising a line is an edit of that file in the same diff, with the reason; a split lowers it.
// 6. Index (A26): every tracked file under docs/ (not docs/archive, docs/shifts/packages, dated docs/shifts/*-report.md, docs/shifts/reports/,
//    nor docs/README.md) appears in exactly one link of docs/README.md.
// One line per failure, then one summary line; exit 1 on any failure. `npm run gate` runs it (step "docs").
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

// DOCS_CHECK_REPO: the root to check (the tests' fixture repos); else the repo this runs in.
const repo = process.env.DOCS_CHECK_REPO ?? execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const kB = 1000;
/** The budgets of the docs diet (brief package S7): bytes. */
const BUDGETS = [
  { file: "docs/shifts/brief.md", limit: 28 * kB },
  { file: "docs/backlog.md", limit: 20 * kB },
  { file: "docs/decisions.md", limit: 40 * kB },
  { file: "docs/04-architecture.md", limit: 70 * kB },
];
const PACKAGE_LIMIT = 6 * kB;
const PACKAGES = "docs/shifts/packages";

const failures = [];
const read = (f) => readFileSync(join(repo, f), "utf8");
const lsMd = (args) =>
  execFileSync("git", ["ls-files", ...args, "*.md"], { cwd: repo, encoding: "utf8" })
    .split("\n")
    .filter((f) => f && !f.includes("node_modules/") && existsSync(join(repo, f)));
// Only tracked Markdown counts; untracked files (a stray local note) are checked for links but only warn.
const mdFiles = lsMd([]);
const untracked = lsMd(["-o", "--exclude-standard"]);
const warnings = [];

// 1. Links. Code spans and fenced blocks are skipped, so a link written as an example is not read.
const stripCode = (text) => text.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
let links = 0;
for (const f of [...mdFiles, ...untracked]) {
  const bad = untracked.includes(f) ? warnings : failures;
  const text = stripCode(read(f));
  for (const m of text.matchAll(/\[[^\]\n]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = m[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const path = decodeURI(target.replace(/#.*$/, ""));
    if (!path) continue;
    links++;
    const abs = resolve(join(repo, dirname(f)), path);
    if (!existsSync(abs)) bad.push(`link: ${f} → ${target} (no ${relative(repo, abs)})`);
  }
}
// Bare docs paths (`docs/shifts/rules.md`) in the live docs and the agents' files. Not checked: the archive (its
// history) and the package texts (docs/shifts/packages/), which name the files they create.
const live = mdFiles.filter((f) => !/^(docs\/archive|spike|docs\/shifts\/packages)\//.test(f));
for (const f of live) {
  for (const m of read(f).matchAll(/(?<![\w./-])docs\/[\w./-]+\.md\b/g)) {
    links++;
    if (!existsSync(join(repo, m[0]))) failures.push(`path: ${f} names ${m[0]}, which does not exist`);
  }
}

// 2. Budgets.
const sizes = [];
for (const b of BUDGETS) {
  if (!existsSync(join(repo, b.file))) continue;
  const text = read(b.file);
  const note = "";
  const bytes = Buffer.byteLength(text, "utf8");
  sizes.push(`${b.file.replace(/^docs\//, "")} ${(bytes / kB).toFixed(1)}/${b.limit / kB} kB${note}`);
  if (bytes > b.limit) failures.push(`budget: ${b.file}${note} is ${(bytes / kB).toFixed(1)} kB, over ${b.limit / kB} kB`);
}
const pkgDir = join(repo, PACKAGES);
const pkgFiles = existsSync(pkgDir) ? readdirSync(pkgDir).filter((n) => n.endsWith(".md")).sort() : [];
let largest = 0;
for (const n of pkgFiles) {
  const bytes = statSync(join(pkgDir, n)).size;
  largest = Math.max(largest, bytes);
  if (bytes > PACKAGE_LIMIT) failures.push(`budget: ${PACKAGES}/${n} is ${(bytes / kB).toFixed(1)} kB, over ${PACKAGE_LIMIT / kB} kB`);
}
sizes.push(`${pkgFiles.length} package files ≤ ${(largest / kB).toFixed(1)}/${PACKAGE_LIMIT / kB} kB`);

// 3. Ids.
const seen = new Map();
const dupe = (kind, id, where) => {
  const key = `${kind}:${id}`;
  if (seen.has(key)) failures.push(`ids: duplicate id ${id} (${kind}) in ${seen.get(key)} and ${where}`);
  else seen.set(key, where);
};
for (const n of pkgFiles) {
  const m = /^###\s+[\w-]+,\s+([A-Za-z]+\d+[A-Za-z0-9]*)\b/m.exec(read(`${PACKAGES}/${n}`));
  if (m) dupe("package", m[1], `${PACKAGES}/${n}`);
}
if (existsSync(join(repo, "docs/backlog.md"))) {
  for (const m of read("docs/backlog.md").matchAll(/^- \*\*(F\d+[a-z0-9]*)\.\*\*/gm)) dupe("backlog", m[1], "docs/backlog.md");
}

// 4. Live research notes.
const NOTES_LIMIT = 150 * kB;
const notes = mdFiles.filter((f) => /^docs\/research\/[^/]+\.md$/.test(f));
let notesBytes = 0;
for (const f of notes) {
  const text = read(f);
  notesBytes += Buffer.byteLength(text, "utf8");
  if (!/\*\*Status[^*\n]*\b(open|decided|reference)\b/i.test(text.split("\n").slice(0, 12).join("\n")))
    failures.push(`research: ${f} has no status line (open, decided or reference) in its first lines`);
}
sizes.push(`${notes.length} research notes ${(notesBytes / kB).toFixed(1)}/${NOTES_LIMIT / kB} kB`);
if (notesBytes > NOTES_LIMIT) failures.push(`budget: docs/research is ${(notesBytes / kB).toFixed(1)} kB, over ${NOTES_LIMIT / kB} kB`);

// 5. Source size.
const LINE_MAX = 800;
const baseline = new Map();
if (existsSync(join(repo, "tools/line-baseline.yaml"))) {
  for (const l of read("tools/line-baseline.yaml").split("\n")) {
    const m = /^([^#\s][^:]*):\s*(\d+)/.exec(l);
    if (m) baseline.set(m[1].trim(), Number(m[2]));
  }
}
const SOURCE = /\.(ts|tsx|svelte|mjs|js|cjs|py|sh|cc|cpp|h|kt|java)$/;
const sources = execFileSync("git", ["ls-files"], { cwd: repo, encoding: "utf8" })
  .split("\n")
  .filter((f) => SOURCE.test(f) && !/(^|\/)(node_modules|_gen)\//.test(f) && !/^(docs|spike)\//.test(f) && existsSync(join(repo, f)));
let big = 0;
for (const f of sources) {
  const n = read(f).split("\n").length - (read(f).endsWith("\n") ? 1 : 0);
  const line = baseline.get(f) ?? LINE_MAX;
  if (n > LINE_MAX) big++;
  if (n > line) failures.push(`lines: ${f} has ${n} lines, over its line ${line}${baseline.has(f) ? " in tools/line-baseline.yaml (a split lowers it; raising it needs a reason in the diff)" : " (no source file passes 800 unless tools/line-baseline.yaml lists it with a reason)"}`);
}
sizes.push(`${big} source files over ${LINE_MAX} lines`);

// 6. Index.
if (existsSync(join(repo, "docs/README.md"))) {
  const indexed = new Map();
  for (const m of stripCode(read("docs/README.md")).matchAll(/\[[^\]\n]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const t = decodeURI(m[1].replace(/#.*$/, ""));
    if (t && !/^(https?:|mailto:)/.test(t)) {
      const rel = relative(repo, resolve(join(repo, "docs"), t));
      indexed.set(rel, (indexed.get(rel) ?? 0) + 1);
    }
  }
  const tracked = execFileSync("git", ["ls-files", "docs"], { cwd: repo, encoding: "utf8" }).split("\n")
    .filter((f) => f && f !== "docs/README.md" && existsSync(join(repo, f)) && !/^docs\/(archive|shifts\/(packages|reports))\//.test(f) && !/^docs\/shifts\/[^/]*-report\.md$/.test(f));
  for (const f of tracked) {
    const n = indexed.get(f) ?? 0;
    if (n !== 1) failures.push(`index: ${f} is linked ${n} times in docs/README.md (must be exactly once)`);
  }
}

for (const w of warnings) console.log(`warning (untracked, not counted): ${w}`);
for (const f of failures) console.log(f);
console.log(`docs ${failures.length === 0 ? "ok" : `FAILED (${failures.length})`}: ${links} links and paths; ${sizes.join(", ")}`);
process.exit(failures.length === 0 ? 0 : 1);
