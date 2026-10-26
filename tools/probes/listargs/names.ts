// SPDX-License-Identifier: GPL-3.0-or-later
// G112: the names list-args.ts asks, in order: every name of every function of Find's index (app/src/find/_gen/find-index.json,
// all tiers, aliases included), then the census's left-out functions (find/functions.yaml `census` groups, G111), once each,
// with whether Giac's help gives the name a list as its first argument (sweep.ts signatureTakesList).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { censusEntries } from "../findcensus/run.ts";
import { helpSignatures, signatureTakesList } from "./sweep.ts";

export interface ListArgName {
  name: string;
  takesList: boolean;
}

const IDENT = /^[A-Za-z][A-Za-z0-9_]*$/;

export function listArgNames(repo: string, aide: string): ListArgName[] {
  const index = join(repo, "app/src/find/_gen/find-index.json");
  if (!existsSync(index)) throw new Error("no Find index: run `npm run index` in app/ first");
  const items = JSON.parse(readFileSync(index, "utf8")) as { kind: string; names: string[] }[];
  const sig = helpSignatures(aide);
  const seen = new Set<string>();
  const out: ListArgName[] = [];
  const add = (n: string): void => {
    if (seen.has(n) || !IDENT.test(n)) return;
    seen.add(n);
    out.push({ name: n, takesList: signatureTakesList(sig.get(n) ?? "") });
  };
  for (const i of items) if (i.kind === "fn") i.names.forEach(add);
  for (const e of censusEntries(repo, aide)) if (e.leftOut) e.names.forEach(add);
  return out;
}
