#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Tests of tools/docs-check.mjs (A22): each rule that must fail has a fixture repo that breaks it; a clean fixture passes.
//   node tools/docs-check.test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const check = join(dirname(fileURLToPath(import.meta.url)), "docs-check.mjs");

/** A fixture repo with `files` committed (tracked); returns the docs check's exit code and output. */
function run(files) {
  const dir = mkdtempSync(join(tmpdir(), "docs-check-"));
  try {
    execFileSync("git", ["init", "-q"], { cwd: dir });
    for (const [name, text] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, name)), { recursive: true });
      writeFileSync(join(dir, name), text);
    }
    execFileSync("git", ["add", "-A"], { cwd: dir });
    const r = spawnSync("node", [check], { cwd: dir, encoding: "utf8", env: { ...process.env, DOCS_CHECK_REPO: dir } });
    return { code: r.status, out: r.stdout + r.stderr };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const pkg = (id) => `### annabell, ${id}: a task, branch \`p1/x\`\nbody\n`;
const note = "<!-- SPDX -->\n# R9: a note\n\n**Status (2026-10-27): reference.** Nothing to decide.\n";
const lines = (n) => "x\n".repeat(n);
const base = {
  "docs/shifts/packages/A1.md": pkg("A1"),
  "docs/backlog.md": "- **F1.** one\n- **F2.** two\n",
  "docs/research/r9.md": note,
  "tools/line-baseline.yaml": "# baseline\napp/src/big.ts: 900\n",
  "app/src/big.ts": lines(900),
};

test("the clean fixture passes", () => {
  const r = run(base);
  assert.equal(r.code, 0, r.out);
});

test("two package files with one id fail", () => {
  const r = run({ ...base, "docs/shifts/packages/A1b.md": pkg("A1") });
  assert.equal(r.code, 1);
  assert.match(r.out, /duplicate id A1/);
});

test("two backlog bug lines with one id fail", () => {
  const r = run({ ...base, "docs/backlog.md": "- **F1.** one\n- **F1.** again\n" });
  assert.equal(r.code, 1);
  assert.match(r.out, /duplicate id F1/);
});

test("a research note with no status line fails", () => {
  const r = run({ ...base, "docs/research/r10.md": "# R10: no status\n\ntext\n" });
  assert.equal(r.code, 1);
  assert.match(r.out, /r10\.md.*status/);
});

test("research notes over 150 kB fail", () => {
  const r = run({ ...base, "docs/research/big.md": note + "x".repeat(151_000) });
  assert.equal(r.code, 1);
  assert.match(r.out, /docs\/research.*150 kB/);
});

test("a source file past its line fails", () => {
  const r = run({ ...base, "app/src/big.ts": lines(901) });
  assert.equal(r.code, 1);
  assert.match(r.out, /app\/src\/big\.ts.*901.*900/);
});

test("a new source file past 800 lines fails", () => {
  const r = run({ ...base, "app/src/new.ts": lines(801) });
  assert.equal(r.code, 1);
  assert.match(r.out, /app\/src\/new\.ts.*801/);
});

test("a split file under its line passes", () => {
  const r = run({ ...base, "app/src/big.ts": lines(700) });
  assert.equal(r.code, 0, r.out);
});
