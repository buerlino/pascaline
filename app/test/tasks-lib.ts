// SPDX-License-Identifier: GPL-3.0-or-later
// EN0 task benchmark: loading tests/tasks/tasks.yaml, the press-counting rule of docs/04 section 5.2, the checks.
import { readFileSync } from "node:fs";
import { parse } from "yaml";

/** One step of a sequence: a key id, or a screen tap, a held key or a drag gesture (each counts 1). */
export type Step = string | { tap: string } | { hold: string } | { drag: string };

export interface Baseline {
  note?: string;
  keys: Step[];
  text: string;
}

export interface Task {
  id: string;
  title: string;
  milestone: number;
  status: "active" | "pending";
  needs?: string;
  budget: number | null;
  keys: Step[] | null;
  expect: { value: string | string[]; text?: string; [other: string]: unknown };
  source: string;
  baseline: Baseline | null;
  compare: { g2_virtual_calc: number | null; phone_calculator: number | null };
}

const file = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8");

export function loadTasks(): Task[] {
  const doc = parse(file("../../tests/tasks/tasks.yaml")) as { schema: number; tasks: Task[] };
  return doc.tasks;
}

/** Every key id of spec/keyboard.yaml (the ids a `keys:` list may use). */
export function keyIds(): Set<string> {
  const doc = parse(file("../../spec/keyboard.yaml")) as { keys: { id: string }[] };
  return new Set(doc.keys.map((k) => k.id));
}

/**
 * Presses of a sequence by §5.2: every press counts 1, Shift and Alpha included, Enter included; a held key that
 * auto-repeats, a hold-and-drag gesture and a tap on the screen count 1 each. Nothing is free.
 */
export const countPresses = (steps: readonly Step[]): number => steps.length;

export const withinBudget = (steps: readonly Step[], budget: number): boolean => countPresses(steps) <= budget;

/** The step's key id, or null when it is not a key press. */
export const keyOf = (s: Step): string | null => (typeof s === "string" ? s : "hold" in s ? s.hold : null);

/** Problems with the task list itself (empty = fine). Needs no browser. */
export function validate(tasks: readonly Task[], keys: ReadonlySet<string>): string[] {
  const bad: string[] = [];
  const seen = new Set<string>();
  const sources = ["oracle", "derived", "device", "virtual-calc", "assumed"];
  for (const t of tasks) {
    const at = (m: string): number => bad.push(`${t.id}: ${m}`);
    if (!/^t\d\d$/.test(t.id) || seen.has(t.id)) at("id missing, malformed or repeated");
    seen.add(t.id);
    if (t.status !== "active" && t.status !== "pending") at(`status is ${String(t.status)}`);
    if (!sources.includes(t.source)) at(`source is ${String(t.source)}`);
    if (t.expect?.value === undefined) at("no expect.value");
    if (t.compare === undefined) at("no compare column");
    if (t.status === "pending" && !t.needs) at("pending without `needs`");
    if (t.status === "active" && (t.budget === null || t.keys === null)) at("active needs a budget and keys");
    if (t.status === "active" && t.expect?.text === undefined) at("active needs expect.text");
    if (t.keys !== null && t.budget === null) at("keys without a budget");
    if (t.keys !== null && t.budget !== null && countPresses(t.keys) > t.budget)
      at(`${countPresses(t.keys)} presses in keys, budget ${t.budget}`);
    for (const [what, steps] of [["keys", t.keys], ["baseline", t.baseline?.keys ?? null]] as const) {
      for (const s of steps ?? []) {
        const id = keyOf(s);
        if (id !== null && !keys.has(id)) at(`${what}: no key "${id}" in spec/keyboard.yaml`);
        if (typeof s === "object" && ("tap" in s ? s.tap : "drag" in s ? s.drag : "x") === "") at(`${what}: empty target`);
      }
    }
    if (t.baseline && typeof t.expect.value === "string") {
      const rel = Math.abs((Number(t.baseline.text) - Number(t.expect.value)) / Number(t.expect.value));
      if (!(rel < 1e-11)) at(`baseline text ${t.baseline.text} is not expect.value ${t.expect.value} to 12 digits`);
    }
  }
  return bad;
}
