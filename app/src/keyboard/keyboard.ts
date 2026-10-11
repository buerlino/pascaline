// SPDX-License-Identifier: GPL-3.0-or-later
// Keyboard model: types, validation and lookup for spec/keyboard.yaml (turned into JSON at build time).
import raw from "../../../spec/keyboard.yaml";

export type Special =
  | "shift" | "alpha" | "enter" | "clear" | "cancel" | "esc" | "app" | "cas" | "settings" | "apps" | "symb" | "plot" | "num" | "menu"
  /** A key whose function we don't have yet (it keeps its alpha letter): does nothing. */
  | "none";
export const SPECIALS: readonly Special[] = [
  "shift", "alpha", "enter", "clear", "cancel", "esc", "app", "cas", "settings", "apps", "symb", "plot", "num", "menu", "none",
];

export type Action = ActionBody & {
  /** Replacement in one-line entry mode (settings): used instead of this action when entry is linear. */
  readonly line?: ActionBody;
};

export type ActionBody =
  /** Type characters as a physical keyboard would (smart fences, auto-subscript rules apply). */
  | { kind: "type"; text: string }
  /** Insert a LaTeX template; #? marks a placeholder, #@ the selection or what is before the cursor. */
  | { kind: "insert"; latex: string; sample?: readonly [string, string] }
  /** A MathLive editing command. */
  | { kind: "cmd"; name: string }
  /** Handled by the app (shift, alpha, enter, clear, cancel, Home/CAS, settings, apps and their views, menu). */
  | { kind: "special"; name: Special };

export type Layer = "primary" | "shift" | "alpha";
export type KeyClass = "num" | "op" | "fn" | "ctl" | "enter" | "nav";
export type Source = "assumed" | "device" | "virtual-calc" | "derived";

export interface Key {
  readonly id: string;
  readonly row: number;
  /** Cell index within its row (the row has `cellsIn(row)` cells). */
  readonly col: number;
  /** Width in cells of its row (default 1). */
  readonly span: number;
  readonly cls: KeyClass;
  /** Legends per layer; a string starting with "$" is an i18n key. */
  readonly label: Readonly<Partial<Record<Layer, string>>>;
  readonly actions: Readonly<Partial<Record<Layer, Action>>>;
  readonly source: Source;
}

export interface Keyboard {
  /** Cells in a row unless `rowColumns` says otherwise. */
  readonly columns: number;
  readonly rowColumns: ReadonlyMap<number, number>;
  /** Grid units across: a multiple of every row's cell count, so all rows share one CSS grid. */
  readonly units: number;
  readonly rows: number;
  readonly keys: readonly Key[];
  readonly byId: ReadonlyMap<string, Key>;
  /** The Python layer (keyboard.yaml `python:`): what keys type in the Python app's editor and shell. */
  readonly python: ReadonlyMap<string, PythonKey>;
}

/** A key in the Python layer: plain text per layer (primary, shift) and the legends shown for it. */
export interface PythonKey {
  readonly text: Readonly<Partial<Record<"primary" | "shift", string>>>;
  readonly label: Readonly<Partial<Record<"primary" | "shift", string>>>;
}

export class KeyboardSpecError extends Error {}

const CLASSES: readonly KeyClass[] = ["num", "op", "fn", "ctl", "enter", "nav"];
const SOURCES: readonly Source[] = ["assumed", "device", "virtual-calc", "derived"];
const LAYERS: readonly Layer[] = ["primary", "shift", "alpha"];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

function str(o: Obj, k: string, where: string): string {
  const v = o[k];
  if (typeof v !== "string") throw new KeyboardSpecError(`${where}: '${k}' must be a string`);
  return v;
}
function int(o: Obj, k: string, where: string): number {
  const v = o[k];
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0) throw new KeyboardSpecError(`${where}: '${k}' must be a non-negative integer`);
  return v;
}

function parseAction(v: unknown, where: string): Action {
  const { line, ...rest } = isObj(v) ? v : ({} as Obj);
  const body = parseBody(isObj(v) ? rest : v, where);
  if (line === undefined) return body;
  const lineBody = parseBody(line, `${where} line`);
  return { ...body, line: lineBody };
}

function parseBody(v: unknown, where: string): ActionBody {
  if (!isObj(v)) throw new KeyboardSpecError(`${where}: an action must be a mapping`);
  const names = Object.keys(v).filter((k) => k !== "sample");
  if (names.length !== 1) throw new KeyboardSpecError(`${where}: an action has exactly one of type/insert/cmd/special`);
  const name = names[0] as string;
  switch (name) {
    case "type":
      return { kind: "type", text: str(v, "type", where) };
    case "cmd":
      return { kind: "cmd", name: str(v, "cmd", where) };
    case "special": {
      const s = str(v, "special", where);
      if (!(SPECIALS as readonly string[]).includes(s)) throw new KeyboardSpecError(`${where}: unknown special '${s}'`);
      return { kind: "special", name: s as Special };
    }
    case "insert": {
      const latex = str(v, "insert", where);
      const sample = v["sample"];
      if (sample === undefined) return { kind: "insert", latex };
      if (!Array.isArray(sample) || sample.length !== 2 || sample.some((s) => typeof s !== "string"))
        throw new KeyboardSpecError(`${where}: 'sample' must be [latex, giac]`);
      return { kind: "insert", latex, sample: [sample[0] as string, sample[1] as string] };
    }
    default:
      throw new KeyboardSpecError(`${where}: unknown action '${name}'`);
  }
}

/** Validate the parsed YAML and build the lookup tables. Throws KeyboardSpecError with the position of the problem. */
export function loadKeyboard(doc: unknown): Keyboard {
  if (!isObj(doc) || doc["schema"] !== 1) throw new KeyboardSpecError("keyboard.yaml: schema must be 1");
  const columns = int(doc, "columns", "keyboard.yaml");
  const rowColumns = new Map<number, number>();
  const rc = doc["row_columns"];
  if (rc !== undefined) {
    if (!isObj(rc)) throw new KeyboardSpecError("keyboard.yaml: 'row_columns' must be a mapping");
    for (const [r, n] of Object.entries(rc)) {
      if (!/^\d+$/.test(r) || typeof n !== "number" || !Number.isInteger(n) || n < 1)
        throw new KeyboardSpecError(`keyboard.yaml: row_columns ${r} must be a positive integer`);
      rowColumns.set(Number(r), n);
    }
  }
  const cellsOf = (row: number): number => rowColumns.get(row) ?? columns;
  const list = doc["keys"];
  if (!Array.isArray(list)) throw new KeyboardSpecError("keyboard.yaml: 'keys' must be a list");
  const keys: Key[] = [];
  const byId = new Map<string, Key>();
  const cells = new Set<string>();
  for (const item of list) {
    if (!isObj(item)) throw new KeyboardSpecError("keyboard.yaml: every key must be a mapping");
    const id = str(item, "id", "key");
    const where = `key '${id}'`;
    if (byId.has(id)) throw new KeyboardSpecError(`${where}: duplicate id`);
    const row = int(item, "row", where);
    const col = int(item, "col", where);
    const span = item["span"] === undefined ? 1 : int(item, "span", where);
    if (span < 1) throw new KeyboardSpecError(`${where}: span must be at least 1`);
    if (col + span > cellsOf(row)) throw new KeyboardSpecError(`${where}: col ${col} is outside ${cellsOf(row)} columns`);
    for (let c = col; c < col + span; c++) {
      if (cells.has(`${row},${c}`)) throw new KeyboardSpecError(`${where}: position ${row},${c} is taken`);
      cells.add(`${row},${c}`);
    }
    const cls = str(item, "cls", where) as KeyClass;
    if (!CLASSES.includes(cls)) throw new KeyboardSpecError(`${where}: unknown cls '${cls}'`);
    const source = str(item, "source", where) as Source;
    if (!SOURCES.includes(source)) throw new KeyboardSpecError(`${where}: unknown source '${source}'`);
    const labelRaw = item["label"];
    if (!isObj(labelRaw)) throw new KeyboardSpecError(`${where}: 'label' must be a mapping`);
    const label: Partial<Record<Layer, string>> = {};
    const actions: Partial<Record<Layer, Action>> = {};
    for (const layer of LAYERS) {
      const l = labelRaw[layer];
      if (l !== undefined) label[layer] = String(l);
      const a = item[layer];
      if (a !== undefined) actions[layer] = parseAction(a, `${where} ${layer}`);
    }
    if (!label.primary || !actions.primary) throw new KeyboardSpecError(`${where}: needs a primary label and action`);
    for (const layer of ["shift", "alpha"] as const)
      if ((label[layer] !== undefined) !== (actions[layer] !== undefined))
        throw new KeyboardSpecError(`${where}: ${layer} needs both a label and an action`);
    const key: Key = { id, row, col, span, cls, label, actions, source };
    keys.push(key);
    byId.set(id, key);
  }
  const rows = keys.reduce((m, k) => Math.max(m, k.row + 1), 0);
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const units = [columns, ...rowColumns.values()].reduce((a, b) => (a * b) / gcd(a, b), 1);
  return { columns, rowColumns, units, rows, keys, byId, python: loadPython(doc["python"], byId) };
}

/** Number of cells in a row. */
export function cellsIn(kb: Keyboard, row: number): number {
  return kb.rowColumns.get(row) ?? kb.columns;
}

/** Where a key sits on the shared CSS grid: first grid column (1-based) and how many grid units it spans. */
export function gridPlace(kb: Keyboard, key: Key): { start: number; span: number } {
  const unit = kb.units / cellsIn(kb, key.row);
  return { start: key.col * unit + 1, span: key.span * unit };
}

function loadPython(list: unknown, byId: ReadonlyMap<string, Key>): Map<string, PythonKey> {
  const out = new Map<string, PythonKey>();
  if (list === undefined) return out;
  if (!Array.isArray(list)) throw new KeyboardSpecError("keyboard.yaml: 'python' must be a list");
  for (const item of list) {
    if (!isObj(item)) throw new KeyboardSpecError("python layer: every entry must be a mapping");
    const id = str(item, "key", "python layer");
    const where = `python key '${id}'`;
    if (!byId.has(id)) throw new KeyboardSpecError(`${where}: no such key`);
    if (out.has(id)) throw new KeyboardSpecError(`${where}: duplicate`);
    const text: Partial<Record<"primary" | "shift", string>> = {};
    const label: Partial<Record<"primary" | "shift", string>> = {};
    const labels = isObj(item["label"]) ? item["label"] : {};
    for (const layer of ["primary", "shift"] as const) {
      if (item[layer] === undefined) continue;
      text[layer] = str(item, layer, where);
      label[layer] = typeof labels[layer] === "string" ? (labels[layer] as string) : (text[layer] as string).trim();
    }
    if (!text.primary && !text.shift) throw new KeyboardSpecError(`${where}: needs primary or shift text`);
    if (!SOURCES.includes(str(item, "source", where) as Source)) throw new KeyboardSpecError(`${where}: unknown source`);
    out.set(id, { text, label });
  }
  return out;
}

/** What a key types in the Python layer, or undefined to fall back to its normal action. Alpha keeps letters. */
export function pythonText(kb: Keyboard, key: Key, shift: boolean, alpha: boolean): string | undefined {
  if (alpha) return undefined;
  const p = kb.python.get(key.id);
  return shift ? p?.text.shift : p?.text.primary;
}

/** The legend of a key in the Python layer (undefined: the normal legend). */
export function pythonLabel(kb: Keyboard, key: Key, layer: "primary" | "shift"): string | undefined {
  return kb.python.get(key.id)?.label[layer];
}

/** The shipped layout. */
export const keyboard: Keyboard = loadKeyboard(raw);

/** The action a key triggers in the given modifier state (alpha falls back to primary; shift never does).
 *  Alpha types the capital letter, shift + alpha its lower case (as on the reference, P4). */
export function actionFor(key: Key, shift: boolean, alpha: boolean, oneLine = false): ActionBody | undefined {
  const a = layerAction(key, shift, alpha);
  return oneLine && a?.line ? a.line : a;
}

function layerAction(key: Key, shift: boolean, alpha: boolean): Action | undefined {
  if (alpha) {
    const a = key.actions.alpha ?? key.actions.primary;
    if (shift && a?.kind === "type" && a === key.actions.alpha) return { kind: "type", text: a.text.toLowerCase() };
    return a;
  }
  if (shift) return key.actions.shift;
  return key.actions.primary;
}

/** The legend shown on the key face for a modifier state. */
export function labelFor(key: Key, shift: boolean, alpha: boolean): string {
  if (alpha) return key.label.alpha ?? key.label.primary ?? "";
  if (shift) return key.label.shift ?? "";
  return key.label.primary ?? "";
}

export interface Template {
  readonly keyId: string;
  readonly layer: Layer;
  readonly variant: "normal" | "line";
  readonly latex: string;
  readonly sample?: readonly [string, string];
}

/** Every LaTeX template on the keyboard, including the one-line variants (each needs a parser case). */
export function templates(kb: Keyboard): Template[] {
  const out: Template[] = [];
  for (const key of kb.keys)
    for (const layer of LAYERS) {
      const a = key.actions[layer];
      if (!a) continue;
      for (const [variant, body] of [["normal", a], ["line", a.line]] as const)
        if (body?.kind === "insert")
          out.push({ keyId: key.id, layer, variant, latex: body.latex, ...(body.sample ? { sample: body.sample } : {}) });
    }
  return out;
}
