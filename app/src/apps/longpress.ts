// SPDX-License-Identifier: GPL-3.0-or-later
// A long press (500 ms, as on a history row) on a value in an app view: it copies the value (docs/04 section 2.6).
// A Svelte action; the click that follows the lift is swallowed so the press does not also select or edit.
const LONG_PRESS_MS = 500;

export function longpress(node: HTMLElement, run: (() => void) | undefined): { update(r: (() => void) | undefined): void; destroy(): void } {
  let act = run;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let fired = false;
  const stop = (): void => {
    clearTimeout(timer);
    timer = undefined;
  };
  const down = (e: PointerEvent): void => {
    stop();
    fired = false;
    if (!act || e.button > 0) return;
    timer = setTimeout(() => {
      timer = undefined;
      fired = true;
      act?.();
    }, LONG_PRESS_MS);
  };
  const click = (e: MouseEvent): void => {
    if (!fired) return;
    fired = false;
    e.stopPropagation();
    e.preventDefault();
  };
  const menu = (e: Event): void => {
    if (act) e.preventDefault(); // the browser's own long-press menu would cover ours
  };
  node.addEventListener("pointerdown", down);
  node.addEventListener("pointerup", stop);
  node.addEventListener("pointercancel", stop);
  node.addEventListener("pointerleave", stop);
  node.addEventListener("click", click, true);
  node.addEventListener("contextmenu", menu);
  return {
    update(r) {
      act = r;
    },
    destroy() {
      stop();
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointerup", stop);
      node.removeEventListener("pointercancel", stop);
      node.removeEventListener("pointerleave", stop);
      node.removeEventListener("click", click, true);
      node.removeEventListener("contextmenu", menu);
    },
  };
}
