// SPDX-License-Identifier: GPL-3.0-or-later
// R18: the Shift palettes (spec/keyboard.yaml `relations:` and `symbols:`) with their names, as a chunk of their own.
// They are needed only once something can be entered, so they load with MathLive (keyboard/palettes.ts), and the start
// chunk carries neither their cells nor their names. In the build, `?palettes` gives just these two sections, slimmed
// like the rest of the spec (vite-plugin-yaml.ts, shipped.ts); in dev and tests it is the whole file.
import raw from "../../../spec/keyboard.yaml?palettes";
import { enPalettes, paletteText } from "../i18n/enPalettes.ts";
import { keyboard, loadPalette, type Palette } from "./keyboard.ts";

const doc = raw as Record<string, unknown>;
const shipped = doc["shipped"] === true;

export const relations: Palette = loadPalette(doc["relations"], "relations", keyboard.byId, shipped);
export const symbols: Palette = loadPalette(doc["symbols"], "symbols", keyboard.byId, shipped);
export { enPalettes, paletteText };
