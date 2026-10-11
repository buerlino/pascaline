// SPDX-License-Identifier: GPL-3.0-or-later
// The Solve app module (loaded lazily by the registry).
import type { AppModule } from "../types.ts";
import { SolveApp } from "./app.svelte.ts";
import Root from "./Root.svelte";

export { SolveApp };

const mod: AppModule<SolveApp> = { create: (host) => new SolveApp(host), Root };
export default mod;
