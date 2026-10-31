// SPDX-License-Identifier: GPL-3.0-or-later
// R95: the hand-over of the store between tabs (state/writer.ts holds the lock; this lazy chunk is loaded once the
// answer is in). The writer listens on a BroadcastChannel; a tab without the lock shows the note (views/WriterNote.svelte).
// Its Use here asks the writer to let go: the writer flushes what it holds, writes nothing more, lets go of the lock
// once its writes are in, and shows the note itself. The new tab, granted the lock, reloads: it reads every key again
// before its first write (the reload asks for the lock at its start, as every tab does).
import WriterNote from "../views/WriterNote.svelte";
import { locksOf, WRITER_LOCK, yieldWriter } from "./writer.ts";
import { writerNote } from "./writerNote.svelte.ts";

const TAKE = "take";

/** `writer`: this tab holds the lock. `flush` writes what the page holds (main.ts: the history, the apps, the line). */
export function startHandOver(writer: boolean, flush: () => void, reload: () => void = () => location.reload()): void {
  const channel = typeof BroadcastChannel === "function" ? new BroadcastChannel(WRITER_LOCK) : undefined;
  let writing = writer;
  const showNote = (): void => {
    writerNote.take = channel ? take : null;
    writerNote.view = WriterNote;
  };
  function take(): void {
    const locks = locksOf(globalThis);
    if (!channel || !locks) return;
    writerNote.take = null; // one hand-over at a time
    // the lock is granted once the writer has let go; the reload then claims it again at its start
    void locks.request(WRITER_LOCK, {}, () => void reload());
    channel.postMessage(TAKE);
  }
  channel?.addEventListener("message", (ev: MessageEvent) => {
    if (ev.data !== TAKE || !writing) return;
    writing = false;
    flush();
    void yieldWriter().then(showNote);
  });
  if (!writer) showNote();
}
