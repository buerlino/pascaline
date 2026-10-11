// SPDX-License-Identifier: GPL-3.0-or-later
import { mark } from "./marks.ts";
mark("js-start");
import "mathlive/static.css";
import { mount } from "svelte";
import "./style.css";
import App from "./App.svelte";
import { createCalc } from "./calc/index.ts";
import { EntryController } from "./entry/controller.ts";
import { Session } from "./state/session.svelte.ts";

const entry = new EntryController();
const calc = createCalc();
const session = new Session(calc);
if (import.meta.env.VITE_MEASURE === "1") {
  void calc.ready().then(() => mark("engine-ready"));
  if (new URLSearchParams(location.search).has("bench")) void import("./bench.ts").then((m) => m.runBench(session));
}
void session.restore();

mount(App, { target: document.getElementById("app") as HTMLElement, props: { session, entry } });

// Test hook (desktop Playwright): read the entry line and the session without reaching into the DOM.
declare global {
  interface Window {
    pascaline: { entry: EntryController; session: Session };
  }
}
window.pascaline = { entry, session };
requestAnimationFrame(() => requestAnimationFrame(() => mark("keyboard-ready")));
