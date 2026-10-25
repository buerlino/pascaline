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
