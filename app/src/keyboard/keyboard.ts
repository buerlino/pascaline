// SPDX-License-Identifier: GPL-3.0-or-later
// Keyboard model: types, validation and lookup for spec/keyboard.yaml (turned into JSON at build time).
import raw from "../../../spec/keyboard.yaml";

export type Special =
  | "shift" | "alpha" | "enter" | "clear" | "esc" | "settings" | "mode" | "fmt" | "copy" | "paste" | "tmpl"
  /** The status line's controls (R15c1; no key since R15c2), and what a user key may hold: the Apps sheet, the views
   *  of the current app, the view's or the picked row's menu. */
  | "apps" | "symb" | "plot" | "num" | "menu"
  /** Places (R15b): Home, CAS (from an app too), and the status line's switch: Home ↔ CAS, or back from an app. */
  | "home" | "cas" | "switch"
  /** The Shift palettes (R18): Shift + 6 relations and logic, Shift + 9 symbols and Greek. */
  | "relations" | "symbols"
  /** A key whose function we don't have yet (it keeps its alpha letter): does nothing. */
  | "none";
export const SPECIALS: readonly Special[] = [
  "shift", "alpha", "enter", "clear", "esc", "settings", "mode", "apps", "symb", "plot", "num", "menu", "fmt", "copy", "paste", "tmpl",
  "home", "cas", "switch", "relations", "symbols", "none",
];

/** The first of the maths rows (3–9): a pick sheet is drawn over them, never over the top cluster (rows 0–2), whose
 *  keys move, go back and close (decisions.md "R21"). */
export const MATHS_ROW = 3;

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
  /** Handled by the app (shift, alpha, enter, clear, esc, Home/CAS, settings, mode, apps and their views, menu). */
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
  /** A free key (U1–U6, R15b, R15c): its layers are defaults the user can replace (userKeys.svelte.ts). */
  readonly user?: true;
}

/** A template action (and its one-line form, if any). */
export type InsertAction = Extract<ActionBody, { kind: "insert" }> & { readonly line?: ActionBody };

/** One cell of a palette (the Tmpl key, `templates:`; Shift + 6, `relations:`; Shift + 9, `symbols:`). */
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
  /** The key at the cell's place, shown on the cell, that picks it (Shift + 6, R18). */
  readonly pick?: string;
  /** The parser refuses this cell's insert with a message (a meaning not settled yet). */
  readonly refused: boolean;
}

export interface Palette {
  readonly columns: number;
  /** In reading order (row by row). */
  readonly items: readonly PaletteItem[];
}

/** The palettes by the yaml section that holds them; the template `keyId` of an own cell is `<prefix>:<id>`. */
export const PALETTES = { palette: "templates", relations: "relations", symbols: "symbols" } as const;
const PREFIX: Readonly<Record<keyof typeof PALETTES, string>> = { palette: "tmpl", relations: "rel", symbols: "sym" };

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
  /** Shift + 6, relations and logic (R18); empty when the spec has none, and in the built app's copy (the app reads the
   *  Shift palettes from their own lazy chunk, keyboard/shiftPalettes.ts). */
  readonly relations: Palette;
  /** Shift + 9, symbols and Greek (R18); as `relations`. */
  readonly symbols: Palette;
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

/** An action in the yaml form of spec/keyboard.yaml (`{ insert: … }`, `{ special: … }`, …); throws KeyboardSpecError. */
export function parseAction(v: unknown, where: string): Action {
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
    const user = item["user"] === true;
    if (user && (actions.alpha !== undefined || row >= MATHS_ROW)) throw new KeyboardSpecError(`${where}: a user key sits in the top cluster and has no alpha layer`);
    const key: Key = { id, row, col, span, cls, label, actions, ...(source ? { source } : {}), ...(user ? { user: true as const } : {}) };
    keys.push(key);
    byId.set(id, key);
  }
  const rows = keys.reduce((m, k) => Math.max(m, k.row + 1), 0);
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const units = [columns, ...rowColumns.values()].reduce((a, b) => (a * b) / gcd(a, b), 1);
  const pal = (k: keyof typeof PALETTES): Palette => loadPalette(doc[PALETTES[k]], PALETTES[k], byId, shipped);
  return { columns, rowColumns, units, rows, keys, byId, palette: pal("palette"), relations: pal("relations"), symbols: pal("symbols") };
}

/** A palette section (`templates:`, `relations:`, `symbols:`): a grid of cells, each the template of a key or its own
 *  insert action with a sample. */
export function loadPalette(v: unknown, section: string, byId: ReadonlyMap<string, Key>, shipped: boolean): Palette {
  if (v === undefined) return { columns: 1, items: [] };
  if (!isObj(v)) throw new KeyboardSpecError(`${section}: must be a mapping`);
  const columns = int(v, "columns", section);
  const list = v["items"];
  if (!Array.isArray(list)) throw new KeyboardSpecError(`${section}: 'items' must be a list`);
  const picks = new Set<string>();
  const items: PaletteItem[] = [];
  const ids = new Set<string>();
  const cells = new Set<string>();
  for (const it of list) {
    if (!isObj(it)) throw new KeyboardSpecError(`${section}: every item must be a mapping`);
    const id = str(it, "id", section);
    const where = `${section} '${id}'`;
    if (ids.has(id)) throw new KeyboardSpecError(`${where}: duplicate id`);
    ids.add(id);
    const row = int(it, "row", where);
    const col = int(it, "col", where);
    if (col >= columns) throw new KeyboardSpecError(`${where}: col ${col} is outside ${columns} columns`);
    if (cells.has(`${row},${col}`)) throw new KeyboardSpecError(`${where}: position ${row},${col} is taken`);
    cells.add(`${row},${col}`);
    const check = it["check"] === true;
    const refused = it["refused"] === true;
    let pick: string | undefined;
    if (it["pick"] !== undefined) {
      pick = str(it, "pick", where);
      if (!byId.has(pick)) throw new KeyboardSpecError(`${where}: pick '${pick}' is not a key`);
      if (picks.has(pick)) throw new KeyboardSpecError(`${where}: pick '${pick}' picks two cells`);
      picks.add(pick);
    }
    const extra = { check, refused, ...(pick ? { pick } : {}) };
    if (it["key"] !== undefined) {
      if (it["insert"] !== undefined) throw new KeyboardSpecError(`${where}: either 'key' or 'insert', not both`);
      const keyId = str(it, "key", where);
      const layer = str(it, "layer", where) as Layer;
      if (!LAYERS.includes(layer)) throw new KeyboardSpecError(`${where}: unknown layer '${layer}'`);
      const action = byId.get(keyId)?.actions[layer];
      if (action?.kind !== "insert") throw new KeyboardSpecError(`${where}: key '${keyId}' has no template in its ${layer} layer`);
      items.push({ id, row, col, key: keyId, layer, action: action as InsertAction, ...extra });
    } else {
      const action = parseAction({ insert: it["insert"], sample: it["sample"] }, where);
      if (action.kind !== "insert" || (!action.sample && !shipped)) throw new KeyboardSpecError(`${where}: needs 'insert' and 'sample'`);
      items.push({ id, row, col, action: action as InsertAction, ...extra });
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
export function actionFor(key: Key, shift: boolean, alpha: boolean, oneLine = false, cas = false): ActionBody | undefined {
  const a = layerAction(key, shift, alpha, cas);
  return oneLine && a?.line ? a.line : a;
}

/** Shift + Alpha on a key whose Alpha action is its own letter: lower case; in the CAS view (`cas`, R58) the case is
 *  swapped: Alpha alone is lower case, Shift + Alpha the capital. Shared by the action and the legend. */
const lowerCase = (key: Key, shift: boolean, alpha: boolean, cas: boolean): boolean =>
  alpha && shift !== cas && key.actions.alpha?.kind === "type";

function layerAction(key: Key, shift: boolean, alpha: boolean, cas: boolean): Action | undefined {
  if (alpha) {
    const a = key.actions.alpha ?? key.actions.primary;
    if (lowerCase(key, shift, alpha, cas) && a?.kind === "type") return { kind: "type", text: a.text.toLowerCase() };
    return a;
  }
  if (shift) return key.actions.shift;
  return key.actions.primary;
}

/** The legend shown on the key face for a modifier state. */
export function labelFor(key: Key, shift: boolean, alpha: boolean, cas = false): string {
  if (alpha) {
    const l = key.label.alpha;
    if (l === undefined) return key.label.primary ?? "";
    return lowerCase(key, shift, alpha, cas) ? l.toLowerCase() : l;
  }
  if (shift) return key.label.shift ?? "";
  return key.label.primary ?? "";
}

export interface Template {
  readonly keyId: string;
  readonly layer: Layer;
  readonly variant: "normal" | "line";
  readonly latex: string;
  readonly sample?: readonly [string, string];
  /** The parser must refuse the sample (a palette cell whose meaning is not settled). */
  readonly refused?: boolean;
}

/** Every LaTeX template on the keyboard, including the one-line variants and the palettes' own templates (keyId
 *  `tmpl:<id>`, `rel:<id>`, `sym:<id>`); each needs a parser case. */
export function templates(kb: Keyboard): Template[] {
  const out: Template[] = [];
  for (const k of Object.keys(PALETTES) as (keyof typeof PALETTES)[])
    for (const p of kb[k].items)
      if (p.key === undefined)
        out.push({
          keyId: `${PREFIX[k]}:${p.id}`, layer: "primary", variant: "normal", latex: p.action.latex,
          ...(p.action.sample ? { sample: p.action.sample } : {}), ...(p.refused ? { refused: true } : {}),
        });
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
