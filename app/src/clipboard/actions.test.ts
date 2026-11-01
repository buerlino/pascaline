// SPDX-License-Identifier: GPL-3.0-or-later
// F100: a Copy then a Paste, started without waiting, act in that order even when the write is slower than the read.
import { describe, expect, it } from "vitest";
import type { EntryController } from "../entry/controller.ts";
import type { AppShell } from "../apps/shell.svelte.ts";
import type { Session } from "../state/session.svelte.ts";
import { ClipActions } from "./actions.svelte.ts";
import type { ClipboardPort } from "./port.ts";

describe("ClipActions order", () => {
  it("pastes the value a just-started copy wrote, not the old clipboard", async () => {
    let clip = "7";
    const port: ClipboardPort = {
      writeText: async (t) => {
        await new Promise((r) => setTimeout(r, 30));
        clip = t;
        return true;
      },
      readText: async () => clip,
      share: async () => false,
    };
    const item = { status: "done", latex: "2", facts: {} };
    const session = { items: [item], display: () => ({ text: "2", latex: "2" }), displayContext: () => ({}) } as unknown as Session;
    const inserted: string[] = [];
    const shell = { app: null, showsEntry: true } as unknown as AppShell;
    const entry = { insert: (l: string) => void inserted.push(l) } as unknown as EntryController;
    const c = new ClipActions(session, shell, entry, { insert() {}, recall() {} }, port);
    const copied = c.copyShown();
    const pasted = c.paste();
    await Promise.all([copied, pasted]);
    expect(clip).toBe("2");
    expect(inserted).toEqual(["2"]);
  });
});

// R100 fix 1: Copy exact follows the comma rule Copy follows: an exact list separates its elements by `;`.
describe("ClipActions Copy exact with the decimal comma", () => {
  const run = async (item: object, comma: boolean): Promise<{ clip: string; inserted: string[] }> => {
    let clip = "";
    const port: ClipboardPort = { writeText: async (t) => ((clip = t), true), readText: async () => clip, share: async () => false };
    const session = { items: [item] } as unknown as Session;
    const inserted: string[] = [];
    const shell = { app: null, showsEntry: true } as unknown as AppShell;
    const entry = { insert: (l: string) => void inserted.push(l) } as unknown as EntryController;
    const c = new ClipActions(session, shell, entry, { insert() {}, recall() {} }, port, () => comma);
    await c.copyExact();
    await c.paste();
    return { clip, inserted };
  };
  const list = (drawn: string, full: string) => ({ status: "done", latex: drawn, full, fullExact: true, drawn });

  it("an exact list {3/2,2} copies as {3/2;2} in comma mode, {3/2,2} in point mode", async () => {
    expect((await run(list("{3/2,2}", "list[3/2,2]"), true)).clip).toBe("{3/2;2}");
    expect((await run(list("{3/2,2}", "list[3/2,2]"), false)).clip).toBe("{3/2,2}");
  });
  it("an exact list of integers copied in comma mode pastes back as the same list", async () => {
    expect(await run(list("{3,2}", "list[3,2]"), true)).toEqual({ clip: "{3;2}", inserted: ["\\left\\{3;2\\right\\}"] });
  });
  it("a rational is unchanged by the rule", async () => {
    expect((await run({ status: "done", latex: "3/2", rational: { n: "3", d: "2" }, full: "3/2", fullExact: true }, true)).clip).toBe("3/2");
  });
});
