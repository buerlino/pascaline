// SPDX-License-Identifier: GPL-3.0-or-later
// G77 (P21): build-wasm.sh fetches Giac's numbered Debian archive only when its SHA-256 is the pin and the pin is the
// line of the archive's `.dsc`. Runs `fetch_giac` from the sourced script on file:// URLs in a temporary directory with
// a stand-in tarball (no network, no engine): a tarball that differs from its `.dsc` line fails, a `.dsc` that names
// another hash than the pin fails, a cached tarball that differs fails, and the consistent set is fetched.
//   node tests/engine/fetch-test.mjs
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../../engine/giac/build-wasm.sh", import.meta.url));
const NAME = "giac_9.9.9-1.tar.gz";
const sha = (s) => createHash("sha256").update(s).digest("hex");
const dsc = (hash) => `Format: 1.0\nSource: giac\nVersion: 9.9.9-1\nChecksums-Sha1:\n 0000000000000000000000000000000000000000 4 ${NAME}\nChecksums-Sha256:\n ${hash} 4 ${NAME}\nFiles:\n 00000000000000000000000000000000 4 ${NAME}\n`;
const GOOD = "good";

const root = mkdtempSync(join(tmpdir(), "pascaline-fetch-"));
/** One fetch: the server holds `served` and a `.dsc` with `line`; the script pins `pin`; `cached` is put in the cache first. */
function fetch(name, { served, line, pin, cached }) {
  const srv = join(root, name, "srv");
  const dl = join(root, name, "dl");
  mkdirSync(srv, { recursive: true });
  mkdirSync(dl, { recursive: true });
  writeFileSync(join(srv, NAME), served);
  writeFileSync(join(srv, NAME.replace(/\.tar\.gz$/, ".dsc")), dsc(line));
  if (cached !== undefined) writeFileSync(join(dl, NAME), cached);
  const sh = `source "$1"; GIAC_TARBALL=${NAME}; GIAC_SHA256=${pin}; GIAC_URLS=("file://${srv}/${NAME}"); GIAC_DSC_URLS=("file://${srv}/${NAME.replace(/\.tar\.gz$/, ".dsc")}"); fetch_giac`;
  const r = spawnSync("bash", ["-c", sh, "fetch-test", script], { env: { ...process.env, PASCALINE_DL_DIR: dl }, encoding: "utf8", timeout: 60_000 });
  return { ok: r.status === 0, kept: existsSync(join(dl, NAME)), out: `${r.stdout}${r.stderr}`.trim().split("\n").slice(-2).join(" | ") };
}

const failures = [];
const expect = (what, r, ok) => {
  if (r.ok !== ok || (!ok && r.kept && what !== "cached")) failures.push(`${what}: ${ok ? "should fetch" : "should fail"}, got exit ${r.ok ? 0 : "≠0"}${r.kept ? " (tarball in the cache)" : ""}: ${r.out}`);
};
expect("consistent", fetch("consistent", { served: GOOD, line: sha(GOOD), pin: sha(GOOD) }), true);
expect("tarball differs from its .dsc line", fetch("tarball", { served: "evil", line: sha(GOOD), pin: sha(GOOD) }), false);
expect(".dsc line differs from the pin", fetch("dsc", { served: GOOD, line: sha("other"), pin: sha(GOOD) }), false);
expect("cached", fetch("cached", { served: GOOD, line: sha(GOOD), pin: sha(GOOD), cached: "stale" }), false);
rmSync(root, { recursive: true, force: true });

if (failures.length) {
  console.log(`FAIL fetch-test\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log("PASS fetch-test: 4 fetches, the tarball checked against the pin and its .dsc line");
