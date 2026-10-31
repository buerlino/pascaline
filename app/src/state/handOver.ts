// SPDX-License-Identifier: GPL-3.0-or-later
// R95: the hand-over of the store between tabs (state/writer.ts holds the lock; this lazy chunk is loaded once the
// answer is in). The writer listens on a BroadcastChannel; a tab without the lock shows the note (views/WriterNote.svelte)
// above the stage. Its Use here asks the writer to let go: the writer flushes what it holds, writes nothing more, lets
// go of the lock once its writes are in, and shows the note itself. The new tab, granted the lock, reloads: it reads
// every key again before its first write (the reload asks for the lock at its start, as every tab does).
import { mount } from "svelte";
import WriterNote from "../views/WriterNote.svelte";
import { locksOf, WRITER_LOCK, yieldWriter } from "./writer.ts";

const TAKE = "take";

/** `writer`: this tab holds the lock. `flush` writes what the page holds (main.ts: the history, the apps, the line). */
export function startHandOver(writer: boolean, flush: () => void, reload: () => void = () => location.reload()): void {
  const channel = typeof BroadcastChannel === "function" ? new BroadcastChannel(WRITER_LOCK) : undefined;
  const locks = locksOf(globalThis);
  let writing = writer;
  const take = (): void => {
    // asked again each second: a writer that has not loaded this chunk yet has no listener and would miss it
    const ask = setInterval(() => channel?.postMessage(TAKE), 1000);
    // granted once the writer has let go (or closed); the reload then claims the lock again at its start
    void locks?.request(WRITER_LOCK, {}, () => {
      clearInterval(ask);
      reload();
    });
    channel?.postMessage(TAKE);
  };
  const showNote = (): void => {
    const screen = document.querySelector(".screen");
    if (screen) mount(WriterNote, { target: screen, anchor: screen.firstChild ?? undefined, props: { take: channel && locks ? take : null } });
  };
  channel?.addEventListener("message", (ev: MessageEvent) => {
    if (ev.data !== TAKE || !writing) return;
    writing = false;
    flush();
    void yieldWriter().then(showNote);
  });
  if (!writer) showNote();
}
