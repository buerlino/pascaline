#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// tools/docs-check.mjs: the docs' own gate (S7, the docs diet). Run from anywhere in the repo:
//
//   node tools/docs-check.mjs
//
// 1. Links: every relative Markdown link in every Markdown file of the repo resolves to a file or directory
//    (anchors are not checked), and every `docs/….md` path a live doc names exists.
// 2. Budgets: the whole brief (28 kB; owner, 2026-10-19), backlog.md, decisions.md, docs/04 and every package file in docs/shifts/packages/ stay within their size.
// One line per failure, then one summary line; exit 1 on any failure. `npm run gate` runs it (step "docs").
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const repo = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
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
const mdFiles = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "*.md"], { cwd: repo, encoding: "utf8" })
  .split("\n")
  .filter((f) => f && !f.includes("node_modules/") && existsSync(join(repo, f)));

// 1. Links. Code spans and fenced blocks are skipped, so a link written as an example is not read.
const stripCode = (text) => text.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
let links = 0;
for (const f of mdFiles) {
  const text = stripCode(read(f));
  for (const m of text.matchAll(/\[[^\]\n]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = m[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const path = decodeURI(target.replace(/#.*$/, ""));
    if (!path) continue;
    links++;
    const abs = resolve(join(repo, dirname(f)), path);
    if (!existsSync(abs)) failures.push(`link: ${f} → ${target} (no ${relative(repo, abs)})`);
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

for (const f of failures) console.log(f);
console.log(`docs ${failures.length === 0 ? "ok" : `FAILED (${failures.length})`}: ${links} links and paths; ${sizes.join(", ")}`);
process.exit(failures.length === 0 ? 0 : 1);
