// SPDX-License-Identifier: GPL-3.0-or-later
// The Python app module (loaded lazily by the registry, with CodeMirror in the same chunk).
import type { AppModule } from "../types.ts";
import { PythonApp } from "./app.svelte.ts";
import Root from "./Root.svelte";

export { PythonApp };

const mod: AppModule<PythonApp> = { create: (host) => new PythonApp(host), Root };
export default mod;
