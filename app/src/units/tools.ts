// SPDX-License-Identifier: GPL-3.0-or-later
// R92: the units menu's Tools (spec/units-menu.yaml `tools`, docs/04 4.3). The G2's six unit tools are places of the
// unit view, so each row runs that place's own action: the end slot (CONVERT and UFACTOR, one place, one row), the SI
// form (MKSA: the row's SI chip), the alternatives (USIMPLIFY: the row), the unit alone (UPART: a tap on the result's
// unit, not built yet) and the number into Home (UVAL: the result as Home's chip, the way back). No new key, no new
// command. A row whose place has nothing to act on is drawn disabled with its reason. Loaded with the unit view.
import { unitText } from "../i18n/enUnits.ts";
import type { Alternative } from "./alternatives.ts";
import type { Shown } from "./result.ts";

export type ToolId = "end" | "si" | "alts" | "unit" | "number";

export interface UnitTool {
  readonly id: ToolId;
  /** Absent: the row is disabled, with `reason`. */
  readonly run?: () => void;
  readonly reason?: string;
}

/** What the rows do in the unit view (units/open.ts). */
export interface ToolActs {
  /** The end slot becomes the active slot. */
  end(): void;
  /** A chip of the result's row is picked (the SI form's). */
  alt(a: Alternative): void;
  /** Into the result's row (▼). */
  alts(): void;
  /** Leave the view with the result on Home's line as its chip. */
  home(): void;
}

/** The rows for the view as it stands (`shown`): built on each Math press, so they never go stale. */
export function unitTools(shown: Shown, act: ToolActs): UnitTool[] {
  const need = unitText("units.tool.needsResult");
  const off = (id: ToolId, reason: string): UnitTool => ({ id, reason });
  const end: UnitTool = { id: "end", run: () => act.end() };
  const unit = off("unit", unitText("units.tool.notBuilt"));
  if (shown.kind !== "result") return [end, off("si", need), off("alts", need), unit, off("number", need)];
  const pure = shown.dimension === "";
  const noUnit = unitText("units.tool.needsUnit");
  const si = shown.alts.find((a) => a.kind === "si");
  return [
    end,
    pure ? off("si", noUnit) : si ? { id: "si", run: () => act.alt(si) } : off("si", unitText("units.tool.isSI")),
    pure ? off("alts", noUnit) : { id: "alts", run: () => act.alts() },
    unit,
    { id: "number", run: () => act.home() },
  ];
}
