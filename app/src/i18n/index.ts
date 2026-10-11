// SPDX-License-Identifier: GPL-3.0-or-later
import { en, type MessageKey } from "./en.ts";

export type { MessageKey };

/** Look up a message. Only English exists so far; other tables plug in here. */
export function t(key: MessageKey): string {
  return en[key];
}

/** Resolve a keyboard legend: "$key.shift" is a message key, anything else is shown as is. */
export function legend(label: string): string {
  if (!label.startsWith("$")) return label;
  const key = label.slice(1);
  if (key in en) return en[key as MessageKey];
  throw new Error(`missing message ${key}`);
}
