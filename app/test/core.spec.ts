// SPDX-License-Identifier: GPL-3.0-or-later
// R74: replays tests/core/core.yaml (the core list, decisions.md "P23") on the real engine, one fresh page per case.
// `known:` cases are expected failures (a ratchet); `needs:` cases are skipped with the reason.
import { expect, test } from "@playwright/test";
import { keyIds } from "./tasks-lib.ts";
import { check, loadCore, morningIds, openBugIds, replay, start, templateIds, validate, type CoreCase } from "./core-lib.ts";

const cases = loadCore();

test.describe("core list file", () => {
  const ok = (): CoreCase => ({ ...(cases[0] as CoreCase) });
  const run = (cs: CoreCase[], morning = morningIds()) => validate(cs, keyIds(), templateIds(), morning, openBugIds());

  test("core.yaml is well formed", () => {
    expect(run(cases)).toEqual([]);
  });
  test("validate() rejects what is wrong", () => {
    const m = morningIds();
    expect(run([{ ...ok(), keys: ["zz"] }]).join()).toContain('no key "zz"');
    expect(run([{ ...ok(), keys: [{ tmpl: "nope" }] }]).join()).toContain('no template cell "nope"');
    expect(run([{ ...ok(), source: "memory" }]).join()).toContain("source is memory");
    expect(run([{ ...ok(), expect: {} }]).join()).toContain("empty expect");
    expect(run([ok(), ok()]).join()).toContain("id repeated");
    expect(run([{ ...ok(), id: "c98", hand: true }]).join()).toContain("not in MORNING.md");
    expect(run([{ ...ok(), id: "c99", hand: false }], new Set([...m, "c99"])).join()).toContain("without hand: true");
    expect(run([{ ...ok(), known: "F999" }]).join()).toContain("not an open bug line");
  });
});

test.describe("core list", () => {
  test.describe.configure({ mode: "parallel" });
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });
  for (const c of cases) {
    const title = `${c.id} ${c.title}${c.known ? ` [known ${c.known}]` : ""}${c.needs ? ` [needs ${c.needs}]` : ""}`;
    test(title, async ({ page }) => {
      test.skip(c.needs !== undefined, `needs ${c.needs}`);
      if (c.known !== undefined) test.fail(true, `known ${c.known}`);
      await start(page);
      await replay(page, c.keys);
      await check(page, c.expect);
    });
  }
});
