// SPDX-License-Identifier: GPL-3.0-or-later
// A line that scrolls sideways (a long history input or result, docs/05 3.5) is never cut without a sign: this action
// sets `data-cut` to "start", "end" or "both" on the node while content lies past that edge, and the component's CSS
// fades the edge (a mask). The node is measured when its size changes (ResizeObserver: after layout, no forced reflow)
// and when it scrolls.

/** Which edges of a box hide content: `scrollLeft` from the start edge, a pixel of rounding allowed. */
export function cutEdges(scrollLeft: number, clientWidth: number, scrollWidth: number): "start" | "end" | "both" | undefined {
  const start = Math.abs(scrollLeft) > 1;
  const end = Math.abs(scrollLeft) + clientWidth < scrollWidth - 1;
  return start && end ? "both" : start ? "start" : end ? "end" : undefined;
}

/** `what` is anything that changes with the content (the text drawn): a change measures the node again. */
export function edgeFade(node: HTMLElement, what?: unknown): { update: (what?: unknown) => void; destroy: () => void } {
  void what;
  const update = (): void => {
    const cut = cutEdges(node.scrollLeft, node.clientWidth, node.scrollWidth);
    if (cut === undefined) delete node.dataset["cut"];
    else if (node.dataset["cut"] !== cut) node.dataset["cut"] = cut;
  };
  node.addEventListener("scroll", update, { passive: true });
  const ro = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(update);
  // the content may grow inside a box of the same size (MathLive's markup arrives after the row): watch the children too.
  // Observing again after a disconnect gives a first notification after the next layout, so a change is measured once.
  const watch = (): void => {
    if (!ro) return;
    ro.disconnect();
    ro.observe(node);
    for (const child of node.children) ro.observe(child);
  };
  watch();
  return {
    update: watch,
    destroy: () => {
      node.removeEventListener("scroll", update);
      ro?.disconnect();
    },
  };
}
