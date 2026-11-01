// SPDX-License-Identifier: GPL-3.0-or-later
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { keyboard } from "../keyboard/keyboard.ts";
import { paletteText } from "./enPalettes.ts";
import { legend, t } from "./index.ts";

describe("i18n", () => {
  it("resolves every $-legend used by the keyboard", () => {
    for (const k of keyboard.keys) for (const l of Object.values(k.label)) expect(() => legend(l)).not.toThrow();
  });
  it("names every palette cell and title (Tmpl, Shift + 6, Shift + 9)", () => {
    // R18, R91: the palettes' names live in their own table, loaded with them
    for (const [prefix, p] of [["tmpl", keyboard.palette], ["rel", keyboard.relations], ["sym", keyboard.symbols]] as const) {
      expect(() => paletteText(`${prefix}.title`)).not.toThrow();
      for (const it of p.items) expect(() => paletteText(`${prefix}.${it.id}`), `${prefix}.${it.id}`).not.toThrow();
    }
    expect(() => paletteText("rel.nope")).toThrow(/missing message/);
  });
  it("passes plain legends through", () => {
    expect(legend("sin⁻¹")).toBe("sin⁻¹");
    expect(legend("$key.enter")).toBe(t("key.enter"));
  });
  it("throws on an unknown message", () => {
    expect(() => legend("$nope")).toThrow(/missing message/);
  });
});

// R102: a message no source file uses is dead text (and may be a string that lost its place, as `status.busy` did in R82f2).
// A key counts as used when its quoted text is in a source file (or a `$key.` legend in spec/keyboard.yaml). A key built at run
// time (`t(`angle.${v}`)`) is covered by a family below: the prefix, the suffixes it takes, and the file that builds it. The test
// checks that file still builds the prefix, so a family cannot outlive its template.
const SRC = join(import.meta.dirname, "..");
const FAMILIES: readonly { prefix: string; suffixes: readonly string[] | "any"; file: string }[] = [
  { prefix: "view.", suffixes: ["home", "cas", "symb", "plot", "num"], file: "apps/shell.svelte.ts" },
  { prefix: "angle.", suffixes: ["rad", "deg"], file: "views/StatusLine.svelte" },
  { prefix: "format.", suffixes: ["std", "sci", "eng", "pfx"], file: "views/StatusLine.svelte" },
  { prefix: "entry.", suffixes: ["textbook", "line"], file: "views/modeSheet.ts" },
  { prefix: "settings.fmt.", suffixes: ["std", "sci", "eng", "pfx", "fix"], file: "views/modeSheet.ts" },
  { prefix: "settings.decimalMark.", suffixes: ["point", "comma"], file: "views/modeSheet.ts" },
  { prefix: "appearance.brightness.", suffixes: ["system", "light", "dark"], file: "views/modeSheet.ts" },
  { prefix: "mark.", suffixes: ["exact", "approx", "warn"], file: "views/History.svelte" },
  { prefix: "fcn.", suffixes: ["min", "max", "flat"], file: "apps/function/app.svelte.ts" },
  // every CalcError code (calc/port.ts, engine/converge.ts Refusal), shown by errorText
  {
    prefix: "error.",
    suffixes: ["syntax", "timeout", "engine", "integralDiverges", "seriesDiverges", "noLimit", "undecided", "divisionByZero", "overflow", "underflow", "noValue", "notSquare", "listPlusNumber", "listAsArguments", "listInArgument"],
    file: "state/session.svelte.ts",
  },
  { prefix: "part.", suffixes: "any", file: "state/backup.ts" }, // a backup part's name, from the part's key
  { prefix: "units.cat.", suffixes: "any", file: "units/menu.ts" }, // a category of the unit tables
  { prefix: "units.cell.", suffixes: ["tap", "up", "down"], file: "units/find.ts" },
];

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return sources(p);
    return /\.(ts|svelte)$/.test(e.name) && !/\.test\.ts$/.test(e.name) ? [p] : [];
  });
}

describe("message tables", () => {
  // enPalettes.ts: its keys are built from the keyboard's palette items (`${id}.${cell}`); "names every palette cell and title" above checks each one
  const tables = readdirSync(join(SRC, "i18n")).filter((f) => /^en[A-Za-z]*\.ts$/.test(f));
  const checked = tables.filter((f) => f !== "enPalettes.ts");
  const files = sources(SRC).filter((f) => !tables.some((t) => f === join(SRC, "i18n", t)));
  const text = files.map((f) => readFileSync(f, "utf8")).join("\n") + "\n" + readFileSync(join(SRC, "../../spec/keyboard.yaml"), "utf8");
  const familyOf = (key: string) => FAMILIES.find((f) => key.startsWith(f.prefix) && (f.suffixes === "any" || f.suffixes.includes(key.slice(f.prefix.length))));

  it("has a source file that builds each dynamic family's keys", () => {
    for (const f of FAMILIES) expect(readFileSync(join(SRC, f.file), "utf8"), `${f.prefix} in ${f.file}`).toContain(`${f.prefix}\${`);
  });
  for (const table of checked) {
    it(`${table}: every key is used by a source file or a dynamic family`, () => {
      const keys = [...readFileSync(join(SRC, "i18n", table), "utf8").matchAll(/^\s*"([^"]+)":/gm)].map((m) => m[1] as string);
      expect(keys.length).toBeGreaterThan(0);
      const unused = keys.filter((k) => !familyOf(k) && !/["'`$]/.test(k) && !text.includes(`"${k}"`) && !text.includes(`'${k}'`) && !text.includes(`\`${k}\``) && !text.includes(`$${k}`));
      expect(unused).toEqual([]);
    });
  }
});
