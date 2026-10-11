// SPDX-License-Identifier: GPL-3.0-or-later
/// <reference types="svelte" />
/// <reference types="vite/client" />
declare module "*.yaml" {
  const data: unknown;
  export default data;
}
