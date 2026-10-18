// SPDX-License-Identifier: GPL-3.0-or-later
// The message for a unit-view refusal (docs/04 4.3), from the i18n table. Plain TS.
import { unitText } from "../i18n/enUnits.ts";
import { dimensionText } from "./dims.ts";
import type { UnitError } from "./types.ts";

export function unitErrorMessage(e: UnitError): string {
  switch (e.error) {
    case "dimension":
      return unitText("units.mismatch", { dims: e.dims.map(dimensionText).join(unitText("units.mismatchSep")) });
    case "cycle":
      return unitText(e.unit === "rpm" ? "units.cycle.rpm" : "units.cycle.rev", { unit: e.unit });
    case "temperature":
      return unitText("units.temperature");
    case "logarithmic":
      return unitText("units.logarithmic", { unit: e.unit });
    case "nofactor":
      return unitText("units.nofactor", { unit: e.unit });
    case "level":
      return unitText("units.level");
    case "belowzero":
      return unitText("units.belowzero");
    case "function":
      return unitText("units.function");
    case "symbolic":
      return unitText("units.symbolic", { detail: e.detail });
    case "engine":
      return unitText("units.engine");
  }
}
