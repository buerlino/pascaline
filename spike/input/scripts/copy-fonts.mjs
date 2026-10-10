// SPDX-License-Identifier: GPL-3.0-or-later
// Copy MathLive's (KaTeX-derived) fonts into public/fonts/ (ignored by git) so nothing loads from a CDN.
import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = join(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(here, "public/fonts"), { recursive: true });
cpSync(join(here, "node_modules/mathlive/fonts"), join(here, "public/fonts"), { recursive: true });
console.log("fonts copied");
