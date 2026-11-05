// SPDX-License-Identifier: GPL-3.0-or-later
// Settings › Data › Library (R59, decisions.md S4, archive/r10-connector.md 2-3): import a library from a picked file or
// from the clipboard (the text an AI chat gave), both through the same whole-file check in the engine (Calc port
// importLibrary); export the definitions as a library file through the save port of the backup (R11 section 1); copy the
// format for your AI. Every outcome is one notice: what came in, or why nothing did, with the lines. A clash with the
// user's own names changes nothing and opens a sheet that lists them, with Replace and import / Cancel (r10 section 3.1,
// principle 3). Loaded on the press only (ClipActions.library), never at start.
import type { MenuItem } from "../apps/types.ts";
import type { Calc, LibraryJobs, LibraryReply } from "../calc/port.ts";
import { jobs as engineJobs } from "../calc/library.ts";
import { dataText, type DataKey } from "../i18n/enData.ts";
import { DATA_VERSION } from "../state/storage.ts";
import raw from "./aiFormat.md?raw";

export interface LibraryHost {
  /** The engine's import and export (jobsFor); undefined where there are none (the fake engine). */
  jobs(): LibraryJobs | undefined;
  /** A notice; `long`: one that names lines and reasons, which stays up longer. */
  say(message: string, long?: boolean): void;
  readText(): Promise<string | null>;
  writeText(text: string): Promise<boolean>;
  /** Read the user's names again (Vars, Find's live items). */
  refresh(): Promise<void>;
  showMenu(title: string, items: MenuItem[]): void;
  saveFile(name: string, mime: string, text: string): Promise<"saved" | "offered" | "cancelled" | "failed">;
}

/** The format for your AI as copied: `{version}` is DATA_VERSION, the file's own comment lines are left out. */
export function aiFormat(text: string = raw, version: number = DATA_VERSION): string {
  return text
    .replace(/<!--[\s\S]*?-->\n?/g, "")
    .replaceAll("{version}", String(version))
    .trim()
    .concat("\n");
}

/** The worked example of the format (the first ```text block after its heading), as copied. */
export function formatExample(format: string = aiFormat()): string {
  const m = /### Worked example\n```text\n([\s\S]*?)```/.exec(format);
  if (!m) throw new Error("the format has no worked example");
  return m[1]!;
}

const guard = (): string => dataText("library.guard");

/** The notice of a result: what came in, or the reason nothing did, with its lines. */
export function importNotice(reply: LibraryReply): string {
  const r = reply.result;
  if (r.ok) {
    const n = { added: r.plan.added.length, replaced: r.plan.replaced.length, same: r.plan.same.length, tests: r.tests };
    return `${dataText("library.imported", n)}. ${guard()}`;
  }
  if (r.clashes?.length) {
    const lineOf = new Map(reply.lines.map((l) => [l.name, l.line]));
    const list = r.clashes.map((c) => (lineOf.has(c) ? `${c} (line ${lineOf.get(c)})` : c)).join(", ");
    return dataText("library.clash", { n: r.clashes.length, list });
  }
  if (r.failures?.length) {
    const list = r.failures.map((f) => `line ${f.line}: ${f.expr} gave ${f.got || "an error"}`).join("; ");
    return `${dataText("library.refused", { why: dataText("library.testsFailed", { list }) })}. ${guard()}`;
  }
  return dataText("library.refused", { why: r.error });
}

/** One import of `input` (a file's bytes or a text); a clash opens the sheet that may import it again with replace. */
/** The jobs on the port's engine; undefined where there is none, or no worker behind it (the fake engine). */
export function jobsFor(calc: Pick<Calc, "engine">): LibraryJobs | undefined {
  try {
    return calc.engine ? engineJobs(calc.engine) : undefined;
  } catch {
    return undefined;
  }
}

/** The host's jobs, or undefined, said. */
function jobsOf(host: LibraryHost): LibraryJobs | undefined {
  const jobs = host.jobs();
  if (!jobs) host.say(dataText("library.noEngine"));
  return jobs;
}

export async function importInput(host: LibraryHost, input: Uint8Array | string, replace = false): Promise<void> {
  const jobs = jobsOf(host);
  if (!jobs) return;
  let reply: LibraryReply;
  try {
    reply = await jobs.importLibrary(input, replace);
  } catch {
    await host.refresh();
    return host.say(dataText("library.failed"));
  }
  host.say(importNotice(reply), true);
  if (reply.result.ok) await host.refresh();
  else if (reply.result.clashes?.length && !replace) host.showMenu(dataText("library.clashTitle"), clashItems(host, input, importNotice(reply)));
}

/** The sheet of a clash: the list (a line of its own), Replace and import, Cancel. */
export function clashItems(host: LibraryHost, input: Uint8Array | string, notice: string): MenuItem[] {
  return [
    { id: "clash", label: notice, keep: true },
    { id: "replace", label: dataText("library.replace"), run: () => void importInput(host, input, true) },
    { id: "cancel", label: dataText("library.cancel"), run: () => {} },
  ];
}

/** One byte past a library's limit (engine/library.ts LIB_MAX_BYTES, 256 kB, r10 1.2): a bigger pick (a video by
 *  mistake) is never read whole, and the engine's reader refuses what it got as over the limit, in its own words. */
export const READ_CAP = 256 * 1024 + 1;

/** Import a library: the picked file, read up to READ_CAP. */
export async function importFile(host: LibraryHost, file: File): Promise<void> {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.slice(0, READ_CAP).arrayBuffer());
  } catch {
    return host.say(dataText("library.unreadable"));
  }
  await importInput(host, bytes);
}

/** Import from the clipboard: the text an AI chat gave, through the same check as a file. */
export async function importClipboard(host: LibraryHost): Promise<void> {
  const text = await host.readText();
  if (text === null) return host.say(dataText("library.noClip"));
  if (text.trim() === "") return host.say(dataText("library.emptyClip"));
  await importInput(host, text);
}

/** The file's name: `pascaline-library-YYYY-MM-DD.txt`, the local date. */
export function libraryName(now: Date = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, "0");
  return `pascaline-library-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.txt`;
}

const SAVED: Record<"saved" | "offered" | "cancelled" | "failed", DataKey> = {
  saved: "library.saved",
  offered: "library.offered",
  cancelled: "library.cancelled",
  failed: "library.saveFailed",
};

/** Export the library: the log's functions and exact values; what was left out is said after the result. */
export async function exportLib(host: LibraryHost): Promise<void> {
  const jobs = jobsOf(host);
  if (!jobs) return;
  let out: Awaited<ReturnType<LibraryJobs["exportLibrary"]>>;
  try {
    out = await jobs.exportLibrary();
  } catch {
    return host.say(dataText("library.saveFailed"));
  }
  if (out.text.trim().split("\n").length <= 1) return host.say(dataText("library.nothing"));
  const result = await host.saveFile(libraryName(), "text/plain", out.text);
  const left = out.skipped.length ? `. ${dataText("library.left", { n: out.skipped.length, list: out.skipped.map((s) => s.name).join(", ") })}` : "";
  host.say(`${dataText(SAVED[result])}${result === "saved" || result === "offered" ? left : ""}`, left !== "");
}

/** Copy the format for your AI: the whole text, on the clipboard. */
export async function copyFormat(host: LibraryHost): Promise<void> {
  host.say((await host.writeText(aiFormat())) ? dataText("library.formatCopied") : dataText("library.copyFailed"));
}
