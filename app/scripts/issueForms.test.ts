// SPDX-License-Identifier: GPL-3.0-or-later
// A81: the GitHub issue forms ask for what a calculator bug needs (mode, settings, exact input).
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dir = join(repo, ".github/ISSUE_TEMPLATE");

interface Field {
  type: string;
  id?: string;
  attributes?: { label?: string; options?: string[] };
  validations?: { required?: boolean };
}
interface Form {
  name?: string;
  description?: string;
  title?: string;
  labels?: string[];
  body?: Field[];
  blank_issues_enabled?: boolean;
  contact_links?: { name: string; url: string; about?: string }[];
}

const load = (f: string): Form => parse(readFileSync(join(dir, f), "utf8")) as Form;
const fields = (f: Form): Field[] => (f.body ?? []).filter((b) => b.type !== "markdown");
const required = (f: Form): string[] => fields(f).filter((b) => b.validations?.required).map((b) => b.id ?? "");

describe("issue forms (A81)", () => {
  it("every file parses", () => {
    const files = readdirSync(dir).filter((f) => f.endsWith(".yml"));
    expect(files.sort()).toEqual(["bug.yml", "config.yml", "feature.yml"]);
    for (const f of files) expect(load(f)).toBeTypeOf("object");
  });

  it("bug.yml asks for version, where, view, input, result and expectation", () => {
    const f = load("bug.yml");
    expect(f.name).toBeTruthy();
    expect(f.description).toBeTruthy();
    expect(f.labels).toEqual(["bug"]);
    expect(f.title).toBe("Bug: ");
    const ids = fields(f).map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((i) => typeof i === "string" && i.length > 0)).toBe(true);
    expect(required(f).sort()).toEqual(["expected", "input", "result", "version", "view", "where"]);
    expect(ids).toEqual(expect.arrayContaining(["settings", "screenshot", "device"]));
    const view = fields(f).find((b) => b.id === "view");
    expect(view?.type).toBe("dropdown");
    expect(view?.attributes?.options).toEqual(["Home", "CAS", "Plot", "Units", "Find", "Settings", "Other"]);
    const where = fields(f).find((b) => b.id === "where");
    expect(where?.attributes?.options).toEqual(["Android app", "Web app (n62.dev)", "Other"]);
    for (const b of fields(f)) expect(b.attributes?.label).toBeTruthy();
  });

  it("feature.yml is an enhancement form with one required field", () => {
    const f = load("feature.yml");
    expect(f.labels).toEqual(["enhancement"]);
    expect(f.title).toBe("Idea: ");
    const ids = fields(f).map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(required(f)).toEqual(["want"]);
  });

  it("config.yml closes blank issues and links the website", () => {
    const c = load("config.yml");
    expect(c.blank_issues_enabled).toBe(false);
    expect(c.contact_links).toHaveLength(1);
    expect(c.contact_links?.[0]).toMatchObject({ name: "Website", url: "https://n62.dev/" });
  });

  it("CONTRIBUTING.md and README.md point to the issue chooser", () => {
    const url = "https://github.com/n62-dev/n62/issues/new/choose";
    expect(readFileSync(join(repo, "CONTRIBUTING.md"), "utf8")).toContain(url);
    expect(readFileSync(join(repo, "README.md"), "utf8")).toContain(url);
  });
});
