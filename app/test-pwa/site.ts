// SPDX-License-Identifier: GPL-3.0-or-later
// A static server for a build folder whose content the test can swap while the page runs: a second deploy (A49).
// `root` is the folder served now; `tamper` maps a path to bytes served instead of the file (null: not found).
import { createServer, type Server } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

export interface Site {
  readonly url: string;
  root: string;
  readonly tamper: Map<string, Buffer | null>;
  close(): Promise<void>;
}

export async function serve(root: string): Promise<Site> {
  const site: Site = { url: "", root, tamper: new Map(), close: () => new Promise((r) => server.close(() => r())) };
  const server: Server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/");
    const rel = path.endsWith("/") ? `${path}index.html` : path;
    const headers = (type: string): Record<string, string> => ({ "content-type": type, "cache-control": "no-cache" });
    const t = site.tamper.get(rel);
    if (t === null) return void res.writeHead(404).end();
    if (t) return void res.writeHead(200, headers(TYPES[extname(rel)] ?? "application/octet-stream")).end(t);
    try {
      const file = join(site.root, normalize(rel));
      if (!statSync(file).isFile()) throw new Error("not a file");
      res.writeHead(200, headers(TYPES[extname(file)] ?? "application/octet-stream")).end(readFileSync(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  site.url = `http://localhost:${typeof addr === "object" && addr ? addr.port : 0}`;
  return site;
}
