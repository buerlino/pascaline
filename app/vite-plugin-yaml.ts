// SPDX-License-Identifier: GPL-3.0-or-later
// Turns `import data from "x.yaml"` into a JSON module at build time, so the shipped app carries no YAML parser.
import { parse } from "yaml";
import type { Plugin } from "vite";

export function yamlPlugin(): Plugin {
  return {
    name: "pascaline-yaml",
    transform(code, id) {
      if (!id.endsWith(".yaml")) return null;
      return { code: `export default ${JSON.stringify(parse(code))};`, map: null };
    },
  };
}
