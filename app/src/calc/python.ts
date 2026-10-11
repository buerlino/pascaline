// SPDX-License-Identifier: GPL-3.0-or-later
// Where the app gets its Python engine: gorge's MicroPython worker (app/src/python/pythonEngine.ts), a
// dynamic import so it is its own chunk, loaded only when the Python app first opens. `calc` calls from
// Python reach the same Giac worker as Home and CAS.
import type { MathEngine } from "../engine/types.ts";
import type { PythonEngine } from "../python/types.ts";

export async function loadPython(math: MathEngine): Promise<PythonEngine> {
  const { loadPythonEngine } = await import("../python/pythonEngine.ts");
  return loadPythonEngine(math);
}
