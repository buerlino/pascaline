// SPDX-License-Identifier: GPL-3.0-or-later
// The Function app module, loaded on first use (apps/registry.ts).
import type { AppModule } from "../types.ts";
import { FunctionApp } from "./app.svelte.ts";
import Root from "./Root.svelte";

const mod: AppModule<FunctionApp> = { create: (host) => new FunctionApp(host), Root };
export default mod;
