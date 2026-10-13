// SPDX-License-Identifier: GPL-3.0-or-later
// What of spec/keyboard.yaml the built app carries (vite-plugin-yaml.ts, `vite build` only). The fields left out are
// read by tests and tools, never at run time, and they cost start-chunk bytes (R10: 4.5 kB raw, 1.2 kB gzip).
//   sample     the template filled in; the round-trip and keyboard tests read it
//   source     where a key's position was seen; keyboard.test.ts and the G2 checklist read it
//   check      a palette cell to confirm on the device; keyboard.test.ts reads it
//   unit_slot  the unit slot's layout record; tools/probes/unit-presses.mjs reads it (milestone 5 reads it at run time)
// `shipped: true` tells loadKeyboard not to ask for them.

const DROP = new Set(["sample", "source", "check"]);

function strip(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(strip);
  if (v === null || typeof v !== "object") return v;
  return Object.fromEntries(Object.entries(v).filter(([k]) => !DROP.has(k)).map(([k, x]) => [k, strip(x)]));
}

export function shippedKeyboard(doc: unknown): unknown {
  if (doc === null || typeof doc !== "object" || Array.isArray(doc)) return doc;
  const { unit_slot: _unitSlot, ...rest } = doc as Record<string, unknown>;
  return { ...(strip(rest) as Record<string, unknown>), shipped: true };
}
