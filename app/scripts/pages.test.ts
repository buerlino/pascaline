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
  name?: string;
  if?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
}
interface Job {
  needs?: string;
  environment?: unknown;
  permissions?: Record<string, string>;
  steps?: Step[];
}
interface Workflow {
  on: Record<string, unknown>;
  permissions: Record<string, string>;
  jobs: Record<string, Job>;
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

  it("A52: the kill switch is a boolean dispatch input, default false", () => {
    const d = wf.on["workflow_dispatch"] as { inputs?: Record<string, { type?: string; default?: unknown; required?: boolean }> } | null;
    const kill = d?.inputs?.["kill"];
    expect(kill?.type).toBe("boolean");
    expect(kill?.default).toBe(false);
  });

  it("A52: a step after the build copies the kill worker over dist/sw.js, only when kill is true, before the upload", () => {
    const s = steps("build");
    const i = s.findIndex((x) => (x.run ?? "").includes("app/pwa/kill/sw.js"));
    expect(i).toBeGreaterThan(-1);
    const step = s[i] as Step;
    expect(step.run).toMatch(/cp\s+app\/pwa\/kill\/sw\.js\s+app\/dist\/sw\.js/);
    expect(step.if).toMatch(/inputs\.kill/);
    expect(step.if).toMatch(/true/);
    const build = s.findIndex((x) => /\.\/build\.sh --web/.test(x.run ?? ""));
    const upload = s.findIndex((x) => (x.uses ?? "").startsWith("actions/upload-pages-artifact@"));
    expect(build).toBeGreaterThan(-1);
    expect(i).toBeGreaterThan(build);
    expect(i).toBeLessThan(upload);
    // no other step may mention the kill worker or the input
    expect(s.filter((x) => /kill/.test(`${x.run ?? ""}${x.if ?? ""}`)).length).toBe(1);
  });

  it("A52: top-level permissions are contents: read only; only the deploy job has pages: write and id-token: write", () => {
    expect(wf.permissions).toEqual({ contents: "read" });
    expect(wf.jobs["build"]).not.toHaveProperty("permissions");
    expect(wf.jobs["deploy"]?.permissions).toEqual({ pages: "write", "id-token": "write" });
    expect(Object.keys(wf.jobs).sort()).toEqual(["build", "deploy"]);
  });

  it("A52: every checkout drops its token (persist-credentials: false)", () => {
    const checkouts = Object.values(wf.jobs).flatMap((j) => j.steps ?? []).filter((s) => (s.uses ?? "").startsWith("actions/checkout@"));
    expect(checkouts.length).toBeGreaterThanOrEqual(1);
    for (const c of checkouts) expect(c.with?.["persist-credentials"]).toBe(false);
  });

  it("A52: check-version and the golden gate run in the build job after the build, before the upload", () => {
    const s = steps("build");
    const build = s.findIndex((x) => /\.\/build\.sh --web/.test(x.run ?? ""));
    const upload = s.findIndex((x) => (x.uses ?? "").startsWith("actions/upload-pages-artifact@"));
    const ver = s.findIndex((x) => (x.run ?? "").includes("tools/check-version.sh"));
    const gold = s.findIndex((x) => /npm run golden/.test(x.run ?? ""));
    for (const i of [ver, gold]) {
      expect(i).toBeGreaterThan(build);
      expect(i).toBeLessThan(upload);
    }
    expect(s[gold]?.run).toMatch(/GIAC_OUT=\S*engine\/giac\/_out\/release/);
    // a tag run also checks the tag against the version
    expect(s[ver]?.run).toMatch(/GITHUB_REF_TYPE/);
    expect(s[ver]?.run).toMatch(/GITHUB_REF_NAME/);
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
