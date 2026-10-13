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
