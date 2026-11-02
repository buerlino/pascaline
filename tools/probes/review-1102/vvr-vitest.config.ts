// SPDX-License-Identifier: GPL-3.0-or-later
// vvr (verifier, night review 2026-11-02): the app's own vite config, with the tests limited to one probe file here.
import appConfig from "../../../app/vite.config.ts";

const app = new URL("../../../app", import.meta.url).pathname;
const base = (appConfig as unknown as (e: { command: string; mode: string }) => Record<string, unknown>)({ command: "serve", mode: "test" });
export default {
  ...base,
  root: app,
  test: { environment: "node", globals: true, dir: new URL(".", import.meta.url).pathname, include: ["vvr-*.test.ts"] },
};
