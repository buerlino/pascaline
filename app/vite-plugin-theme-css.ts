// SPDX-License-Identifier: GPL-3.0-or-later
// R50e: the inline script of index.html links the family's and the switches' CSS before the first paint, so it needs
// those files' URLs. They are lazy chunks with hashed names in a build, so this plugin writes the map into the script's
// `/*theme-css*/{}` placeholder: the hashed names from the bundle, or the source files in the dev server.
import type { Plugin } from "vite";

export const THEME_CSS = ["pascaline", "graphite", "solarized", "gruvbox", "nord", "modes"] as const;
const PLACEHOLDER = "/*theme-css*/{}";

/** The built asset for each theme file: found by its source name, else by the `<name>-<hash>.css` pattern. */
export function themeCssMap(assets: Iterable<{ fileName: string; originalFileNames?: string[] }>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const a of assets) {
    for (const name of THEME_CSS) {
      const bySource = (a.originalFileNames ?? []).some((o) => o.endsWith(`src/theme/${name}.css`));
      if (bySource || new RegExp(`(^|/)${name}-[\\w-]+\\.css$`).test(a.fileName)) map[name] ??= a.fileName;
    }
  }
  return map;
}

export function themeCssPlugin(): Plugin {
  return {
    name: "pascaline-theme-css",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        if (!html.includes(PLACEHOLDER)) return html;
        const map = ctx.bundle
          ? themeCssMap(Object.values(ctx.bundle).filter((o) => o.type === "asset") as { fileName: string; originalFileNames?: string[] }[])
          : Object.fromEntries(THEME_CSS.map((n) => [n, `/src/theme/${n}.css`]));
        if (ctx.bundle && Object.keys(map).length !== THEME_CSS.length) throw new Error(`theme-css: the build lacks some of ${THEME_CSS.join(", ")} (found ${Object.keys(map).join(", ") || "none"})`);
        return html.replace(PLACEHOLDER, JSON.stringify(map));
      },
    },
  };
}
