// SPDX-License-Identifier: GPL-3.0-or-later
// A45: the GitHub Pages workflow stays small and pinned: commit-SHA actions, two triggers, three permissions, one build command.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const text = readFileSync(join(repo, ".github/workflows/pages.yml"), "utf8");

interface Step {
  uses?: string;
  run?: string;
}
interface Workflow {
  on: Record<string, unknown>;
  permissions: Record<string, string>;
  jobs: Record<string, { needs?: string; environment?: unknown; steps?: Step[] }>;
}
const wf = parse(text) as Workflow;
const steps = (job: string): Step[] => wf.jobs[job]?.steps ?? [];

describe(".github/workflows/pages.yml", () => {
  it("pins every action by a 40-hex commit SHA", () => {
    const uses = [...text.matchAll(/^\s*(?:-\s*)?uses:\s*(\S+)/gm)].map((m) => m[1] as string);
    expect(uses.length).toBeGreaterThanOrEqual(3);
    for (const u of uses) expect(u).toMatch(/^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/);
  });

  it("runs only on a manual dispatch and on tags v*", () => {
    expect(Object.keys(wf.on).sort()).toEqual(["push", "workflow_dispatch"]);
    expect(wf.on["push"]).toEqual({ tags: ["v*"] });
  });

  it("asks for contents: read, pages: write, id-token: write and nothing else", () => {
    expect(wf.permissions).toEqual({ contents: "read", pages: "write", "id-token": "write" });
    for (const j of Object.values(wf.jobs)) expect(j).not.toHaveProperty("permissions");
  });

  it("builds with ./build.sh --web, uploads app/dist and deploys in the github-pages environment", () => {
    expect(steps("build").some((s) => (s.run ?? "").split("\n").some((l) => /^(NO_LOCK=1 )?\.\/build\.sh --web\s*$/.test(l.trim())))).toBe(true);
    expect(steps("build").some((s) => (s.uses ?? "").startsWith("actions/upload-pages-artifact@"))).toBe(true);
    expect(text).toMatch(/path:\s*app\/dist\b/);
    expect(wf.jobs["deploy"]?.needs).toBe("build");
    expect(JSON.stringify(wf.jobs["deploy"]?.environment)).toContain("github-pages");
    expect(steps("deploy").some((s) => (s.uses ?? "").startsWith("actions/deploy-pages@"))).toBe(true);
  });
});
