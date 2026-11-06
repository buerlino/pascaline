// SPDX-License-Identifier: GPL-3.0-or-later
// A45: the GitHub Pages workflow stays small and pinned: commit-SHA actions, two triggers, three permissions, one build command;
// A8: a test tag (a - in its name) is never deployed by its push;
// A63: a kill run refuses any ref but a tag, in the job's first step.
import { readFileSync, readdirSync } from "node:fs";
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
  if?: string;
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

  it("A78: the comments name the web version at https://n62.dev/", () => {
    expect(text).toContain("https://n62.dev/");
    expect(text).not.toMatch(new RegExp("pascaline" + "-calc"));
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
    // no other step may mention the kill worker; the only other steps that read the input are the golden gate (A52f1) and the tag guard (A63)
    const guard = s[0] as Step;
    expect(s.filter((x) => x !== guard && /kill/.test(x.run ?? "")).length).toBe(1);
    expect(s.filter((x) => /kill/.test(x.if ?? "")).map((x) => x.name)).toEqual([guard.name, "Golden gate on the release engine", step.name]);
  });

  it("A52f1: the golden step is skipped on a kill run; the version check runs on every run", () => {
    const s = steps("build");
    const golden = s.find((x) => /npm run golden/.test(x.run ?? ""));
    expect(golden?.if).toMatch(/^\$\{\{\s*inputs\.kill\s*!=\s*true\s*\}\}$|^inputs\.kill\s*!=\s*true$/);
    const ver = s.find((x) => /check-version\.sh/.test(x.run ?? ""));
    expect(ver).toBeDefined();
    expect(ver?.if).toBeUndefined();
    expect(text).toMatch(/#.*kill run.*golden/i);
  });

  it("A63: the job's first step fails a kill run whose ref is not a tag, with the message; a normal run is untouched", () => {
    const guard = steps("build")[0] as Step;
    expect(guard.uses).toBeUndefined();
    expect(guard.run).toContain("A kill run needs the release tag: pick the tag in 'Use workflow from'");
    expect(guard.run).toMatch(/\bexit 1\b/);
    // evaluate the step's `if:` for every input/ref combination (the expression is a plain && of comparisons)
    const expr = (guard.if ?? "").replace(/^\$\{\{\s*|\s*\}\}$/g, "");
    expect(expr).toMatch(/inputs\.kill/);
    expect(expr).toMatch(/github\.ref_type/);
    const runs = (kill: boolean, refType: string): boolean =>
      new Function("inputs", "github", `return (${expr});`)({ kill }, { ref_type: refType }) as boolean;
    expect(runs(true, "branch")).toBe(true);
    expect(runs(true, "tag")).toBe(false);
    expect(runs(false, "branch")).toBe(false);
    expect(runs(false, "tag")).toBe(false);
    // a push has no inputs: the guard must not trip (inputs.kill is empty there) and the other steps stay as they were
    expect(new Function("inputs", "github", `return (${expr});`)({}, { ref_type: "tag" })).toBe(false);
    // it comes before the checkout, so a refused run costs nothing
    expect(steps("build").findIndex((x) => (x.uses ?? "").startsWith("actions/checkout@"))).toBeGreaterThan(0);
    expect(text).toMatch(/#.*A63/);
  });

  it("A8: a tag push whose name holds a - (the test tag vX.Y.Z-test) skips the build job, and so the deploy; a dispatch never skips", () => {
    expect(wf.jobs["build"]?.if).toBe("${{ github.event_name != 'push' || !contains(github.ref_name, '-') }}");
    // the deploy job runs only after a build: no if of its own that could run it past a skipped build (always(), !cancelled())
    expect(wf.jobs["deploy"]?.needs).toBe("build");
    expect(wf.jobs["deploy"]).not.toHaveProperty("if");
    expect(text).toMatch(/#.*test tag.*-/i);
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

describe("THIRD_PARTY.md", () => {
  it("A8f1: every action a workflow pins has a row there with the same commit SHA", () => {
    const third = readFileSync(join(repo, "THIRD_PARTY.md"), "utf8");
    const dir = join(repo, ".github/workflows");
    const uses = readdirSync(dir)
      .filter((f) => /\.ya?ml$/.test(f))
      .flatMap((f) => [...readFileSync(join(dir, f), "utf8").matchAll(/^\s*(?:-\s*)?uses:\s*([\w.-]+\/[\w./-]+)@([0-9a-f]{40})/gm)]);
    expect(uses.length).toBeGreaterThanOrEqual(7);
    for (const m of uses) {
      const name = (m[1] as string).replace(/\./g, "\\.");
      expect(third, `${m[1]}@${m[2]}`).toMatch(new RegExp(`^\\| ${name} \\|[^\\n]*\`${m[2]}\``, "m"));
    }
  });
});
