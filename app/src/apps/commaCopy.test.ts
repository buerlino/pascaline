// SPDX-License-Identifier: GPL-3.0-or-later
// R100 (vr-1, be-3's CSV half): an app's Copy in comma mode writes what Paste in comma mode reads back: Function's readout
// and Num cells with the mark, its CSV with `;` between the fields, Solve's root with the mark; also through the Copy key
// (ClipActions.copyKey, the shell's copyText). Point mode as before. Values derived: 3/2 = 1.5, (3/2)² = 2.25.
import { describe, expect, it, vi } from "vitest";
import type { AppHost, ViewId } from "./types.ts";
vi.mock("../theme.svelte.ts", () => ({ brightness: () => "dark" }));
import { FunctionApp } from "./function/app.svelte.ts";
import type { Cell } from "./function/engineApi.ts";
import { SolveApp } from "./solve/app.svelte.ts";
import { decimalFromString, ZERO_VALUE } from "../engine/format.ts";
import { ClipActions } from "../clipboard/actions.svelte.ts";
import { parsePastedNumber } from "../clipboard/paste.ts";
import type { AppShell } from "./shell.svelte.ts";
import type { EntryController } from "../entry/controller.ts";
import type { Session } from "../state/session.svelte.ts";

const host = (comma: boolean): AppHost =>
  ({
    settings: { digits: 12, angle: "rad", format: "std", decimalMark: comma ? "comma" : "point" },
    calc: { ready: async () => undefined },
    kv: { get: async () => undefined, set: async () => undefined },
    userNames: [],
    setEntry: () => undefined,
    copy: () => undefined,
    notice: () => undefined,
  }) as unknown as AppHost;

const cell = (s: string): Cell => ({ ok: true, display: s, full: s, value: { re: decimalFromString(s) ?? ZERO_VALUE, im: ZERO_VALUE }, facts: { reliableDigits: 40, exact: false } as Cell["facts"] });

function fn(comma: boolean): FunctionApp {
  const app = new FunctionApp(host(comma));
  app.readout = { lines: [{ primary: true, value: "1.5", cell: cell("1.5") }] } as unknown as FunctionApp["readout"];
  app.numSlots = [0];
  app.numXs = ["0", "0.5"];
  app.numCache = new Map([["0", [cell("1.5")]], ["0.5", [cell("2.25")]]]);
  return app;
}
function solve(comma: boolean): SolveApp {
  const app = new SolveApp(host(comma));
  app.selected = "x";
  app.values = { x: "1.5" };
  app.copies = { x: "1.5" };
  return app;
}

/** The Copy key in an app: what ClipActions writes to the clipboard. */
async function copyKey(app: { copyText(v: ViewId): unknown }, view: ViewId, comma: boolean): Promise<string> {
  let clip = "";
  const port = { writeText: async (t: string) => ((clip = t), true), readText: async () => clip, share: async () => false };
  const shell = { app: "x", showsEntry: true, copyText: () => app.copyText(view) } as unknown as AppShell;
  const session = { items: [], decimalComma: comma } as unknown as Session;
  const c = new ClipActions(session, shell, {} as EntryController, { insert() {}, recall() {} }, port);
  await c.copyKey();
  return clip;
}

describe("R100: an app's Copy in comma mode", () => {
  it("Function: the readout's root 1.5 copies as 1,5, and pastes back as 1.5", async () => {
    expect(await copyKey(fn(true), "plot", true)).toBe("1,5");
    expect(parsePastedNumber("1,5", { decimalComma: true })?.latex).toBe("1{,}5");
  });
  it("Function: the CSV has ; between the fields and the mark in the numbers", async () => {
    expect(await copyKey(fn(true), "num", true)).toBe("x;F1\r\n0;1,5\r\n0,5;2,25\r\n");
  });
  it("Solve: the root 1.5 copies as 1,5", async () => {
    expect(await copyKey(solve(true), "num", true)).toBe("1,5");
  });
  it("point mode: as before", async () => {
    expect(await copyKey(fn(false), "plot", false)).toBe("1.5");
    expect(await copyKey(fn(false), "num", false)).toBe("x,F1\r\n0,1.5\r\n0.5,2.25\r\n");
    expect(await copyKey(solve(false), "num", false)).toBe("1.5");
  });
});
