// SPDX-License-Identifier: GPL-3.0-or-later
import "./polyfills.ts";
import { mark } from "./marks.ts";
mark("js-start");
import "mathlive/static.css";
import { mount } from "svelte";
import "./style.css";
import App from "./App.svelte";
import { createCalc } from "./calc/index.ts";
import type { Calc } from "./calc/port.ts";
import { loadSheetView } from "./views/sheetView.svelte.ts";
import { EntryController } from "./entry/controller.ts";
import { lineKeeper, lineRecord } from "./entry/keep.ts";
import { renderStats } from "./render/mathlive.svelte.ts";
import { loadTidy, Session } from "./state/session.svelte.ts";
import { AppShell } from "./apps/shell.svelte.ts";
import { idbKv } from "./state/storage.ts";
import { UserKeys } from "./keyboard/userKeys.svelte.ts";
import { loadNative } from "./input/haptics.ts";
import { plotHook } from "./apps/function/plotHook.ts";
import { reloadOnMissingChunk } from "./state/chunkReload.ts";

// A lazy chunk missing after a deploy (A49): reload once for the new index.html; the half-typed line is kept on pagehide.
addEventListener("vite:preloadError", () => void reloadOnMissingChunk(sessionStorage, Date.now(), () => location.reload()));

const entry = new EntryController();
// The engine worker starts at launch (D2): it compiles the wasm on another thread while the page paints.
const calc = createCalc();
const session = new Session(calc);
if (import.meta.env.VITE_MEASURE === "1") {
  void calc.ready().then(() => mark("engine-ready"));
  if (new URLSearchParams(location.search).get("bench") === "plot")
    void import("./plotBench.ts").then((m) => m.runPlotBench(shell, new URLSearchParams(location.search).has("manual")));
  else if (new URLSearchParams(location.search).get("bench") === "defs") void import("./bench.ts").then((m) => m.runDefsBench(session));
  else if (new URLSearchParams(location.search).get("bench") === "library") void import("./bench.ts").then((m) => m.runLibraryBench(session));
  else if (new URLSearchParams(location.search).get("bench") === "keypad") void import("./keypadBench.ts").then((m) => m.runKeypadBench());
  else if (new URLSearchParams(location.search).get("bench") === "probe") void import("./deviceProbe.ts").then((m) => m.runDeviceProbe());
  else if (new URLSearchParams(location.search).get("bench") === "solve") void import("./solveBench.ts").then((m) => m.runSolveBench(calc));
  else if (new URLSearchParams(location.search).get("bench") === "find") void import("./findBench.ts").then((m) => m.runFindBench(shell, entry));
  else if (new URLSearchParams(location.search).get("bench") === "golden") void import("./goldenBench.ts").then((m) => m.runGoldenBench());
  else if (new URLSearchParams(location.search).has("bench")) void import("./bench.ts").then((m) => m.runBench(session));
}
session.saveDelayMs = 400;
// Settings › Appearance (R50e): the stored look goes on the page once the settings are read, and on every change; the
// inline script of index.html has already shown it (lazy chunk, off the start).
session.onLook = (look) => void import("./theme/lookApply.ts").then((m) => m.applyLook(look)).catch(() => {});
const shell = new AppShell(calc, idbKv, entry, () => session.settings, () => session.userNames);
const place = shell.restorePlace();
const settingsRead = session.restoreSettings();
// the free keys U1–U3 (R15b): their defaults are drawn first, the user's slots replace them when read
const userKeys = new UserKeys(idbKv);
void userKeys.restore();
// R34 (F30): the half-typed Home/CAS line survives a kill (an app's line belongs to the app, which keeps its slots).
const keeper = lineKeeper(idbKv);
entry.onClear = () => keeper.save(null);
const flush = (): void => {
  session.flushHistory();
  shell.flush();
  // before the kept line is on the field (or the line was typed or cleared) the stored line stays as it is
  if (entry.settled) keeper.save(shell.app === null ? lineRecord(session.view, entry.value, entry.chips) : null);
};
// Leaving the app (a swipe, the app switcher): drop the focus. Android restores focus to the focused element when
// the app comes back and opens the system keyboard on it, inputmode=none or not (K0, user 2026-10-13). The next key
// press focuses the entry again. The native layer is android:windowSoftInputMode="stateAlwaysHidden" in the manifest (A46): Android's own auto show on a return is out of reach of this code. Window blur only on touch screens: a desktop keeps its focus across windows.
const dropFocus = (): void => {
  let el = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  if (el instanceof HTMLElement) el.blur();
};
addEventListener("pagehide", flush);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) return;
  flush();
  dropFocus();
});
addEventListener("blur", () => matchMedia("(pointer: coarse)").matches && dropFocus());
// A focus can also arrive while the app is away: MathLive focuses its keyboard sink 60 ms after mf.focus(), in a
// timer dropFocus cannot cancel, and a repeat timer or an insert after an await does the same (F11, F13). Drop any
// focus that lands while the page is hidden, or while a touch screen's window is blurred. focusin is composed, so
// it reaches document from inside MathLive's shadow root.
const away = (): boolean => document.hidden || (matchMedia("(pointer: coarse)").matches && !document.hasFocus());
document.addEventListener("focusin", () => away() && dropFocus(), true);
// F99 (R81): a focus() called while the window is blurred fires no focusin then; the browser keeps the element as the
// focused one and hands it the focus when the window comes back, after the window's focus event, when away() is false
// again. So a touch screen's return itself drops the focus: nothing is focused after a return until a key is pressed.
addEventListener("focus", () => matchMedia("(pointer: coarse)").matches && dropFocus());

mount(App, { target: document.getElementById("app") as HTMLElement, props: { session, entry, shell, userKeys } });

// Test hook (desktop Playwright): read the entry line and the session without reaching into the DOM.
declare global {
  interface Window {
    pascaline: { entry: EntryController; session: Session; shell: AppShell; userKeys: UserKeys; calc: Calc; plot: typeof plotHook; renderStats: { count: number } };
  }
}
window.pascaline = { entry, session, shell, userKeys, calc, plot: plotHook, renderStats };

// Offline support (web build only): after the engine is up and the browser is idle, so the install's downloads
// (the whole build, ~10 MB with both wasm files) never compete with the first paint or the engine's own load.
void calc.ready().then(() => {
  const register = (): void => void import("./pwa.ts").then((m) => m.registerServiceWorker());
  if ("requestIdleCallback" in window) requestIdleCallback(register, { timeout: 5000 });
  else setTimeout(register, 2000);
});

// Keypad first: MathLive (the biggest chunk) is fetched and parsed only after the keypad has been painted.
// Keys pressed before it is ready are queued by the entry controller.
requestAnimationFrame(() =>
  requestAnimationFrame(() => {
    mark("keyboard-ready");
    // Key vibration with strength needs @capacitor/core, which stays out of the start chunk (R35): load it when idle.
    const idle = (f: () => void): void => (typeof requestIdleCallback === "function" ? void requestIdleCallback(f) : void setTimeout(f, 200));
    idle(() => void loadNative());
    idle(() => void import("./views/modeSheet.ts")); // fetched when idle, so the first Mode or Settings open is not slower
    idle(() => void loadSheetView().catch(() => {})); // the sheet's view, likewise (R46)
    idle(() => void loadTidy().catch(() => {})); // the result tidy-up (R91), likewise
    // The history is read after the keypad is up, so it does not compete with the first paint. The kept line comes
    // after it (an Ans on it is the restored last result) and only into the view it was typed in.
    const history = session.restoreHistory();
    void entry.load(Promise.all([settingsRead, history]).then(() => keeper.read(session.view)));
    // An app that was open at the last exit comes back once the keypad is up (its code loads lazily).
    void place.then((app) => app && shell.open(app));
  }),
);
