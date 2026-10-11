// SPDX-License-Identifier: GPL-3.0-or-later
// Loads MicroPython in Node (tests and the golden runner). Never bundled into the app.
// Finds micropython.mjs in $PYTHON_OUT, else <repo>/python/_out/dev.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PyHost, type LoadMicroPython, type PyHostHooks } from "./pyHost.ts";

export function micropythonMjsPath(): string {
  if (process.env.PYTHON_OUT) return `${process.env.PYTHON_OUT}/micropython.mjs`;
  return fileURLToPath(new URL("../../../python/_out/dev/micropython.mjs", import.meta.url));
}

export function micropythonAvailable(): boolean {
  return existsSync(micropythonMjsPath());
}

export async function loadNodePyHost(hooks: PyHostHooks, mjs: string = micropythonMjsPath()): Promise<PyHost> {
  const { loadMicroPython } = (await import(pathToFileURL(mjs).href)) as { loadMicroPython: LoadMicroPython };
  return PyHost.load(loadMicroPython, hooks);
}
