// SPDX-License-Identifier: GPL-3.0-or-later
// Keyboard model: types, validation and lookup for spec/keyboard.yaml (turned into JSON at build time).
import raw from "../../../spec/keyboard.yaml";

export type Special =
  | "shift" | "alpha" | "enter" | "clear" | "cancel" | "esc" | "app" | "cas" | "settings" | "mode" | "apps" | "symb" | "plot" | "num" | "menu" | "fmt" | "copy" | "paste" | "tmpl"
  /** A key whose function we don't have yet (it keeps its alpha letter): does nothing. */
  | "none";
export const SPECIALS: readonly Special[] = [
  "shift", "alpha", "enter", "clear", "cancel", "esc", "app", "cas", "settings", "mode", "apps", "symb", "plot", "num", "menu", "fmt", "copy", "paste", "tmpl", "none",
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
  /** Handled by the app (shift, alpha, enter, clear, cancel, Home/CAS, settings, mode, apps and their views, menu). */
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
  /** Absent in the built app (src/keyboard/shipped.ts). */
  readonly source?: Source;
}

/** A template action (and its one-line form, if any). */
export type InsertAction = Extract<ActionBody, { kind: "insert" }> & { readonly line?: ActionBody };

/** One cell of the template palette (the Tmpl key; spec/keyboard.yaml `templates:`). */
export interface PaletteItem {
  readonly id: string;
  readonly row: number;
  readonly col: number;
  /** The template of a key (`key`, `layer`: the same action, one-line form included) or its own insert action. */
  readonly key?: string;
  readonly layer?: Layer;
  readonly action: InsertAction;
  /** Our reading of the reference, to confirm on the device (false in the built app). */
  readonly check: boolean;
}

export interface Palette {
  readonly columns: number;
  /** In reading order (row by row). */
  readonly items: readonly PaletteItem[];
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
  /** The Tmpl palette; empty when the spec has none. */
  readonly palette: Palette;
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
  // the built app's copy has no `source` and no `sample` (src/keyboard/shipped.ts); tests load the whole file
  const shipped = doc["shipped"] === true;
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
    const source = shipped ? undefined : (str(item, "source", where) as Source);
    if (source !== undefined && !SOURCES.includes(source)) throw new KeyboardSpecError(`${where}: unknown source '${source}'`);
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
    for (const layer of ["shift", "alpha"] as const) {
      const a = actions[layer];
      // a layer made dead on purpose (`special: none`) has no legend; alpha then does not fall back to the primary
      if (a?.kind === "special" && a.name === "none" && label[layer] === undefined) continue;
      if ((label[layer] !== undefined) !== (a !== undefined))
        throw new KeyboardSpecError(`${where}: ${layer} needs both a label and an action`);
    }
    const key: Key = { id, row, col, span, cls, label, actions, ...(source ? { source } : {}) };
    keys.push(key);
    byId.set(id, key);
  }
  const rows = keys.reduce((m, k) => Math.max(m, k.row + 1), 0);
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const units = [columns, ...rowColumns.values()].reduce((a, b) => (a * b) / gcd(a, b), 1);
  const palette = loadPalette(doc["templates"], byId, shipped);
  return { columns, rowColumns, units, rows, keys, byId, palette };
}

/** The `templates:` section: a grid of cells, each the template of a key or its own insert action with a sample. */
function loadPalette(v: unknown, byId: ReadonlyMap<string, Key>, shipped: boolean): Palette {
  if (v === undefined) return { columns: 1, items: [] };
  if (!isObj(v)) throw new KeyboardSpecError("templates: must be a mapping");
  const columns = int(v, "columns", "templates");
  const list = v["items"];
  if (!Array.isArray(list)) throw new KeyboardSpecError("templates: 'items' must be a list");
  const items: PaletteItem[] = [];
  const ids = new Set<string>();
  const cells = new Set<string>();
  for (const it of list) {
    if (!isObj(it)) throw new KeyboardSpecError("templates: every item must be a mapping");
    const id = str(it, "id", "template");
    const where = `template '${id}'`;
    if (ids.has(id)) throw new KeyboardSpecError(`${where}: duplicate id`);
    ids.add(id);
    const row = int(it, "row", where);
    const col = int(it, "col", where);
    if (col >= columns) throw new KeyboardSpecError(`${where}: col ${col} is outside ${columns} columns`);
    if (cells.has(`${row},${col}`)) throw new KeyboardSpecError(`${where}: position ${row},${col} is taken`);
    cells.add(`${row},${col}`);
    const check = it["check"] === true;
    if (it["key"] !== undefined) {
      if (it["insert"] !== undefined) throw new KeyboardSpecError(`${where}: either 'key' or 'insert', not both`);
      const keyId = str(it, "key", where);
      const layer = str(it, "layer", where) as Layer;
      if (!LAYERS.includes(layer)) throw new KeyboardSpecError(`${where}: unknown layer '${layer}'`);
      const action = byId.get(keyId)?.actions[layer];
      if (action?.kind !== "insert") throw new KeyboardSpecError(`${where}: key '${keyId}' has no template in its ${layer} layer`);
      items.push({ id, row, col, key: keyId, layer, action: action as InsertAction, check });
    } else {
      const action = parseAction({ insert: it["insert"], sample: it["sample"] }, where);
      if (action.kind !== "insert" || (!action.sample && !shipped)) throw new KeyboardSpecError(`${where}: needs 'insert' and 'sample'`);
      items.push({ id, row, col, action: action as InsertAction, check });
    }
  }
  items.sort((a, b) => a.row - b.row || a.col - b.col);
  return { columns, items };
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

/** Every LaTeX template on the keyboard, including the one-line variants and the palette's own templates (keyId
 *  `tmpl:<id>`); each needs a parser case. */
export function templates(kb: Keyboard): Template[] {
  const out: Template[] = [];
  for (const p of kb.palette.items)
    if (p.key === undefined)
      out.push({ keyId: `tmpl:${p.id}`, layer: "primary", variant: "normal", latex: p.action.latex, ...(p.action.sample ? { sample: p.action.sample } : {}) });
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
