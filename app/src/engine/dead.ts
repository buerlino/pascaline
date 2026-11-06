// SPDX-License-Identifier: GPL-3.0-or-later
// Only erasable TypeScript syntax: host.ts imports it and runs in Node.

/**
 * The message of a stack overflow, whole and in any case: V8 (Chrome, Android WebView, Node) and JavaScriptCore (Safari)
 * throw a `RangeError` "Maximum call stack size exceeded", JavaScriptCore with a full stop; SpiderMonkey (Firefox) an
 * `InternalError` "too much recursion". Any other `RangeError` (toFixed's) is no stack overflow.
 */
const STACK_OVERFLOW = /^(?:maximum call stack size exceeded\.?|too much recursion)$/i;

/**
 * Whether a throw out of a request left the engine dead, and why (the client restarts it, G24, G183).
 * "memory" (G24): a failed allocation reaches us as a C++ exception (`WebAssembly.Exception`, from `new`) or as an abort
 * (GMP, or the heap at its cap). "crash" (G183): a wasm trap (`WebAssembly.RuntimeError`: `unreachable` F145, `memory
 * access out of bounds` G94) or a stack overflow (`STACK_OVERFLOW`, F122) unwound through Giac's frames: its stack
 * pointer and heap are not trusted after it. Null: a plain error, the engine lives on.
 */
export function deadEngine(e: unknown): "memory" | "crash" | null {
  const wasm = typeof WebAssembly !== "undefined" ? (WebAssembly as unknown as { Exception?: new () => object; RuntimeError?: new () => object }) : {};
  if (wasm.Exception && e instanceof wasm.Exception) return "memory";
  const text = e instanceof Error ? e.message : String(e);
  if (/\bOOM\b|out of memory|cannot enlarge memory|^Aborted/i.test(text)) return "memory";
  if (wasm.RuntimeError && e instanceof wasm.RuntimeError) return "crash";
  if (e instanceof Error && STACK_OVERFLOW.test(e.message)) return "crash";
  return null;
}
