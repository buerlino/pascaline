// SPDX-License-Identifier: GPL-3.0-or-later
// Turns `import data from "x.yaml"` into a JSON module at build time, so the shipped app carries no YAML parser.
// In `vite build`, spec/keyboard.yaml loses its test-only fields (src/keyboard/shipped.ts); dev and tests see it whole.
import { parse } from "yaml";
import type { Plugin } from "vite";
import { shippedKeyboard } from "./src/keyboard/shipped.ts";

export function yamlPlugin(): Plugin {
  let build = false;
  return {
    name: "pascaline-yaml",
    configResolved(c) {
      build = c.command === "build";
    },
    transform(code, id) {
      if (!id.endsWith(".yaml")) return null;
      const data: unknown = parse(code);
      const out = build && id.endsWith("/spec/keyboard.yaml") ? shippedKeyboard(data) : data;
      return { code: `export default ${JSON.stringify(out)};`, map: null };
    },
  };
}
