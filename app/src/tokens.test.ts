// SPDX-License-Identifier: GPL-3.0-or-later
// R12b (docs/05 3.10): no colour or size is written directly in a component. Colours come from the theme files
// (style.css and src/theme/*.css, R50b–R50d), sizes, type, radii and motion from the tokens in style.css. This test
// reads every src/**/*.svelte and lists each literal it finds: a length or duration with a unit (px, em, rem, vh, vw,
// pt, ms, s), a #hex, rgb() or hsl() colour, or a named colour in a style. Allowed: 0, unitless numbers (line-height,
// flex, opacity), percentages, fr and ch, a value built from tokens, and a media query's condition (CSS cannot read a
// custom property there).
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL(".", import.meta.url));

function svelteFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? svelteFiles(join(dir, e.name)) : e.name.endsWith(".svelte") ? [join(dir, e.name)] : [],
  );
}

// a minus sign counts (-8px); a number inside a name (--sp-2, translate-x-4px) does not
const LENGTH = /(?<![\w.#]|\w-)-?\d*\.?\d+(?:px|r?em|vh|vw|pt|m?s)\b/g;
const COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/g;
const NAMED = /:\s*(?:[^;{}]*?[\s,(])?(black|white|red|green|blue|gray|grey|yellow|orange|purple|silver|navy|maroon)\b/g;

/** Comments blanked, line breaks kept, so the line numbers stay. */
function stripComments(src: string): string {
  const blank = (m: string): string => m.replace(/[^\n]/g, " ");
  return src.replace(/<!--[\s\S]*?-->/g, blank).replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|[^:"'`])\/\/[^\n]*/g, (m, p: string) => p + blank(m.slice(p.length)));
}

/** Every literal colour or size in a component: `file:line: literal`. */
export function hardCoded(file: string, source: string): string[] {
  const src = stripComments(source);
  const styleLine = src.slice(0, Math.max(0, src.indexOf("<style"))).split("\n").length - 1;
  const out: string[] = [];
  src.split("\n").forEach((line, i) => {
    if (/^\s*@media\b/.test(line)) return;
    const inStyle = src.includes("<style") && i >= styleLine;
    const named = inStyle ? [...line.matchAll(NAMED)].map((m) => m[1] as string) : [];
    const found = [...[...line.matchAll(LENGTH), ...line.matchAll(COLOUR)].map((m) => m[0]), ...named];
    for (const f of found) out.push(`${file}:${i + 1}: ${f}`);
  });
  return out;
}

describe("design tokens (R12b)", () => {
  it("the scanner finds what it should and nothing else", () => {
    const sample = [
      "<script>const a = 3; // 12px in a comment", "const t = `${n}px`;</script>",
      "<div style:width={`${w}px`} style:height=\"12px\"></div>",
      "<style>", "  .a { padding: 0 var(--sp-2); width: 50%; flex: 1 1 0; line-height: 1.1; }", "  /* 8px here is a comment */",
      "  .b { margin: 4px; color: #fff; background: rgb(0 0 0); border-color: black; }", "  @media (max-height: 700px) {", "  .c { animation: x 100ms; font-size: 0.94em; }",
      "  .d { margin: 0 -8px; transform: translate(-50%, calc(-100% - 6px)); gap: var(--sp-2); }", "</style>",
    ].join("\n");
    expect(hardCoded("x.svelte", sample)).toEqual([
      "x.svelte:3: 12px", "x.svelte:7: 4px", "x.svelte:7: #fff", "x.svelte:7: rgb(", "x.svelte:7: black", "x.svelte:9: 100ms", "x.svelte:9: 0.94em",
      "x.svelte:10: -8px", "x.svelte:10: 6px",
    ]);
  });
  it("no colour or size is written directly in any .svelte file", () => {
    const hits = svelteFiles(SRC).flatMap((f) => hardCoded(f.slice(SRC.length), readFileSync(f, "utf8")));
    expect(hits, `${hits.length} hard-coded values:\n${hits.join("\n")}`).toEqual([]);
  });
});
