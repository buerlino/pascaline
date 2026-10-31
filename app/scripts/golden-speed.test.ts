// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { SPEED_KNOWN, splitSpeed } from "./golden-speed.ts";
import type { Finding } from "./golden-compare.ts";

const f = (stage: string, id: string): Finding => ({ stage, id, input: `in-${id}`, what: "mark", desktop: "≈", device: "⚠ 0" });

describe("golden speed (G82, G137)", () => {
  it("a pending case's finding is listed, never failed; once active it fails", () => {
    const all = [f("precision", "new-one"), f("precision", "g58-factorial-1e6-12"), f("precision", "pend"), f("home", "pend")];
    const r = splitSpeed(all, new Set(["precision/pend"]));
    expect(r.findings.map((x) => `${x.stage}/${x.id}`)).toEqual(["precision/new-one", "home/pend"]);
    expect(r.known.map((x) => x.id)).toEqual(["g58-factorial-1e6-12"]);
    expect(r.pending.map((x) => `${x.stage}/${x.id}`)).toEqual(["precision/pend"]);
    // the fix removes `status: pending`: the same finding is new and fails the stage
    expect(splitSpeed(all, new Set()).findings.map((x) => x.id)).toEqual(["new-one", "pend", "pend"]);
  });
  it("no SPEED_KNOWN entry names a pending case (its exemption would outlive the pending status)", () => {
    const root = fileURLToPath(new URL("../../tests/golden/", import.meta.url));
    const pending = (file: string, stage: string): string[] =>
      (parse(readFileSync(`${root}${file}`, "utf8")) as { cases: { id: string; status?: string }[] }).cases
        .filter((c) => c.status === "pending")
        .map((c) => `${stage}/${c.id}`);
    const all = new Set([...pending("home.yaml", "home"), ...pending("precision.yaml", "precision")]);
    expect(Object.keys(SPEED_KNOWN).filter((k) => all.has(k))).toEqual([]);
  });
});
