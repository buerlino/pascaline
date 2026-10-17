// SPDX-License-Identifier: GPL-3.0-or-later
import { en, type MessageKey } from "./en.ts";

export type { MessageKey };

/** Look up a message; `{name}` placeholders are filled from `vars`. Only English exists so far. */
export function t(key: MessageKey, vars?: Readonly<Record<string, string>>): string {
  const m: string = en[key];
  return vars ? m.replace(/\{(\w+)\}/g, (all, k: string) => vars[k] ?? all) : m;
}

/** Resolve a keyboard legend: "$key.shift" is a message key, "$$…" a text that starts with "$" (a user key's own
 *  label, R15b), anything else is shown as is. */
export function legend(label: string): string {
  if (!label.startsWith("$")) return label;
  if (label.startsWith("$$")) return label.slice(1);
  const key = label.slice(1);
  if (key in en) return en[key as MessageKey];
  throw new Error(`missing message ${key}`);
}
