// SPDX-License-Identifier: GPL-3.0-or-later
// `import("virtual:about")` (R87): the About screen's data for its lazy chunk: the app's version from package.json,
// THIRD_PARTY.md's tables as a list of parts, and the licence texts of LICENSES/, one copy per licence. Read at build
// time from the files themselves, so the list cannot drift from them; no clock, no host name, so two builds of one
// commit give the same bytes (fdroid/README.md).
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { appVersion, licenceIds, readLicences, readParts } from "../tools/third-party/parse.mts";

const ID = "virtual:about";
const ROOT = resolve(import.meta.dirname, "..");

export function aboutPlugin(): Plugin {
  return {
    name: "pascaline-about",
    resolveId: (id) => (id === ID ? `\0${ID}` : null),
    load(id) {
      if (id !== `\0${ID}`) return null;
      this.addWatchFile(resolve(ROOT, "THIRD_PARTY.md"));
      const licences = readLicences(ROOT);
      for (const lid of Object.keys(licences)) this.addWatchFile(resolve(ROOT, "LICENSES", `${lid}.txt`)); // files: a folder would count as an import
      // only what the screen reads (the Notes column and the section heading stay in the file)
      const parts = readParts(ROOT).map(({ name, version, licence, source, copyright }) => ({ name, version, licence, source: source.split(" ")[0] ?? "", copyright, ids: licenceIds(licence) }));
      return `export default ${JSON.stringify({ version: appVersion(ROOT), parts, licences })};`;
    },
  };
}
