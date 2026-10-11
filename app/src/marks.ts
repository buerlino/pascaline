// SPDX-License-Identifier: GPL-3.0-or-later
// Timing marks for on-device runs (tools/device_run.py reads them from logcat).
// Active only in measurement builds (PASCALINE_MEASURE=1 -> VITE_MEASURE=1); otherwise the calls compile away.
// Wall-clock epoch milliseconds, so they line up with the process start MainActivity logs.
// Names the tools expect: js-start, keyboard-ready, engine-ready (+ instantiateMs, initMs), first-result.

export function mark(name: string, extra: Record<string, number | string> = {}): void {
  if (import.meta.env.VITE_MEASURE !== "1") return;
  const fields = Object.entries(extra)
    .map(([k, v]) => `${k}=${typeof v === "number" ? Math.round(v * 10) / 10 : v}`)
    .join(" ");
  console.log(`PASCALINE_T ${name} epoch=${Date.now()} perf=${Math.round(performance.now() * 10) / 10}${fields ? " " + fields : ""}`);
}
