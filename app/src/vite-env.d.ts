// SPDX-License-Identifier: GPL-3.0-or-later
/// <reference types="svelte" />
/// <reference types="vite/client" />
declare module "*.yaml" {
  const data: unknown;
  export default data;
}
/** spec/keyboard.yaml's Shift palettes alone, for their lazy chunk (vite-plugin-yaml.ts). */
declare module "*.yaml?palettes" {
  const data: unknown;
  export default data;
}
/** The About screen's data, built from package.json, THIRD_PARTY.md and LICENSES/ (vite-plugin-about.ts). */
declare module "virtual:about" {
  interface AboutPart {
    readonly name: string;
    readonly version: string;
    readonly licence: string;
    readonly source: string;
    readonly note: string;
    readonly copyright: string;
    readonly group: string;
    /** The licence ids the Licence column names ("A OR B": two). */
    readonly ids: readonly string[];
  }
  const data: { readonly version: string; readonly parts: readonly AboutPart[]; readonly licences: Readonly<Record<string, string>> };
  export default data;
}
