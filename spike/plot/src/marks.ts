// SPDX-License-Identifier: GPL-3.0-or-later
// Timing marks for on-device runs. In the Android shell these show up in logcat (tag
// "Capacitor/Console", since console.log is bridged) with the text prefix PASCALINE_T; the Java side
// logs its own marks under the tag PASCALINE_T. All marks carry wall-clock epoch milliseconds so
// they can be lined up with the process start logged by MainActivity.

export function mark(name: string, extra: Record<string, number | string> = {}): void {
  const fields = Object.entries(extra)
    .map(([k, v]) => `${k}=${typeof v === "number" ? Math.round(v * 10) / 10 : v}`)
    .join(" ");
  console.log(`PASCALINE_T ${name} epoch=${Date.now()} perf=${Math.round(performance.now() * 10) / 10}${fields ? " " + fields : ""}`);
}
