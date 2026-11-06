// SPDX-License-Identifier: GPL-3.0-or-later
// A8: the release workflow stays small and pinned, and the signing key reaches one step only, after the golden gate.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const text = readFileSync(join(repo, ".github/workflows/release.yml"), "utf8");

interface Step {
  name?: string;
  if?: string;
  uses?: string;
  run?: string;
  env?: Record<string, string>;
  with?: Record<string, unknown>;
}
interface Job {
  "runs-on"?: string;
  "timeout-minutes"?: number;
  permissions?: unknown;
  env?: Record<string, string>;
  steps?: Step[];
}
interface Workflow {
  on: Record<string, unknown>;
  permissions: Record<string, string>;
  concurrency: { group?: string; "cancel-in-progress"?: boolean };
  jobs: Record<string, Job>;
}
const wf = parse(text) as Workflow;
const job = wf.jobs["release"] as Job;
const steps = job.steps ?? [];
const at = (re: RegExp): number => steps.findIndex((s) => re.test(s.run ?? ""));
const SECRETS = ["KEYSTORE_BASE64", "KEYSTORE_PASSWORD", "KEY_ALIAS", "KEY_PASSWORD"];

describe(".github/workflows/release.yml", () => {
  it("pins every action by a 40-hex commit SHA, actions/* only: checkout, setup-node, setup-java", () => {
    const uses = [...text.matchAll(/^\s*(?:-\s*)?uses:\s*(\S+)/gm)].map((m) => m[1] as string);
    expect(uses.map((u) => u.split("@")[0]).sort()).toEqual(["actions/checkout", "actions/setup-java", "actions/setup-node"]);
    for (const u of uses) expect(u).toMatch(/^actions\/[\w.-]+@[0-9a-f]{40}$/);
    expect(steps.find((s) => (s.uses ?? "").startsWith("actions/setup-java@"))?.with?.["java-version"]).toBe("21");
    expect(steps.find((s) => (s.uses ?? "").startsWith("actions/setup-node@"))?.with?.["node-version"]).toBe("22");
  });

  it("runs on a tag v* and on a dispatch with a tag input; one job on ubuntu-24.04, 120 minutes", () => {
    expect(Object.keys(wf.on).sort()).toEqual(["push", "workflow_dispatch"]);
    expect(wf.on["push"]).toEqual({ tags: ["v*"] });
    const d = wf.on["workflow_dispatch"] as { inputs?: Record<string, { required?: boolean }> };
    expect(d.inputs?.["tag"]?.required).toBe(true);
    expect(Object.keys(wf.jobs)).toEqual(["release"]);
    expect(job["runs-on"]).toBe("ubuntu-24.04");
    expect(job["timeout-minutes"]).toBe(120);
  });

  it("contents: write and nothing more; one run per tag, never cancelled", () => {
    expect(wf.permissions).toEqual({ contents: "write" });
    expect(job).not.toHaveProperty("permissions");
    expect(wf.concurrency.group).toMatch(/inputs\.tag/);
    expect(wf.concurrency.group).toMatch(/github\.ref_name/);
    expect(wf.concurrency["cancel-in-progress"]).toBe(false);
  });

  it("the checkout keeps no token and checks out the tag", () => {
    const c = steps.find((s) => (s.uses ?? "").startsWith("actions/checkout@"));
    expect(c?.with?.["persist-credentials"]).toBe(false);
    expect(String(c?.with?.["ref"])).toMatch(/^refs\/tags\//);
  });

  it("steps in order: version check, engine and qalc in the container, golden gate, signed build, release", () => {
    const ver = at(/tools\/check-version\.sh "\$TAG"/);
    const engine = at(/NO_LOCK=1 \S*\s*engine\/giac\/build-wasm-release\.sh/);
    const qalc = at(/NO_LOCK=1 \S*\s*engine\/qalc\/build-wasm\.sh release/);
    const golden = at(/npm run golden/);
    const build = at(/NO_LOCK=1 \.\/build\.sh --release --engine-dir engine\/giac\/_out\/release/);
    const release = at(/gh release create "\$TAG"/);
    for (const i of [ver, engine, qalc, golden, build, release]) expect(i).toBeGreaterThan(-1);
    expect(ver).toBeLessThan(engine);
    expect(engine).toBeLessThan(golden);
    expect(qalc).toBeLessThan(golden);
    expect(golden).toBeLessThan(build);
    expect(build).toBeLessThan(release);
    // the golden step fails unless the gate printed its pass line (absolute GIAC_OUT on the release engine)
    expect(steps[golden]?.run).toMatch(/GIAC_OUT="\$GITHUB_WORKSPACE\/engine\/giac\/_out\/release"/);
    expect(steps[golden]?.run).toMatch(/grep -qx 'GOLDEN GATE PASSED'/);
  });

  it("the secrets reach only the build step, as its env:, never a run: line or an echo; the keystore goes to RUNNER_TEMP, mode 600", () => {
    const build = at(/\.\/build\.sh --release/);
    for (const [i, s] of steps.entries()) {
      const env = JSON.stringify(s.env ?? {});
      if (i === build) for (const k of SECRETS) expect(env).toContain(`secrets.${k}`);
      else expect(env).not.toMatch(/secrets\.(?!GITHUB_TOKEN)/);
      expect(s.run ?? "").not.toMatch(/secrets\./);
    }
    expect(JSON.stringify(job.env ?? {})).not.toMatch(/secrets\./);
    const s = steps[build] as Step;
    expect(s.env?.["N62_KEYSTORE"]).toBe("${{ runner.temp }}/release.jks");
    expect(s.env?.["N62_RELEASE_TAG"]).toBe("${{ env.TAG }}");
    expect(s.run).toMatch(/umask 077/);
    expect(s.run).toMatch(/chmod 600 "\$N62_KEYSTORE"/);
    expect(s.run).not.toMatch(/\becho\b|set -x/);
  });

  it("an always() step after the build deletes the keystore", () => {
    const build = at(/\.\/build\.sh --release/);
    const del = steps.findIndex((s) => /rm -f "\$RUNNER_TEMP\/release\.jks"/.test(s.run ?? ""));
    expect(del).toBe(build + 1);
    expect(steps[del]?.if).toBe("always()");
  });

  it("publishes the versioned APK and its .sha256, a pre-release for 0.x or a tag with a -, with GITHUB_TOKEN", () => {
    const s = steps[at(/gh release create/)] as Step;
    expect(s.env?.["GH_TOKEN"]).toBe("${{ github.token }}");
    expect(s.run).toMatch(/gh release create "\$TAG" "\$apk" "\$apk\.sha256"/);
    expect(s.run).toMatch(/apk="dist\/n62-\$v\.apk"/);
    expect(s.run).toMatch(/"\$v" == 0\.\* \|\| "\$TAG" == \*-\*/);
    expect(s.run).toMatch(/--prerelease/);
    // the notes: commit, both SHA256SUMS, the certificate
    for (const f of ["git rev-parse HEAD", "engine/giac/_out/release/SHA256SUMS", "engine/qalc/_out/release/SHA256SUMS", "android/release-cert.sha256"])
      expect(s.run).toContain(f);
  });
});
