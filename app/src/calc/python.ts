// SPDX-License-Identifier: GPL-3.0-or-later
// Where the app gets its Python engine. gorge's worker (app/src/python/pythonEngine.ts) plugs in here
// with a dynamic import, so it is a separate chunk loaded only when the Python app first runs.
import type { MathEngine } from "../engine/types.ts";
import type { PythonEngine } from "../python/types.ts";

export function loadPython(_math: MathEngine): Promise<PythonEngine> {
  return Promise.reject(new Error("The Python engine is not built into this version yet."));
}
