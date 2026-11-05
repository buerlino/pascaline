// SPDX-License-Identifier: GPL-3.0-or-later
// Find ranking (docs/04 section 3.5): plain code over the generated index, on the main thread, synchronous.
// Order: (2) exact name, (3) name prefix, shorter first, (4) word prefix inside a name, (5) word prefix in the
// title or description, (6) one edit away (queries of 4+ characters). No usage boost (P11: the same query always
// gives the same order, docs/03 rule 8), so there is no (1).
// G161: a gauge pressure (psig, barg, kPag, MPag) is not fuzzy: one edit away is the absolute unit (psi, bar), the trap
// G17 closes for °C, so it finds nothing rather than a wrong unit.
// Ties: tier 0 first, then the context's kinds, then the shorter matched name, then the id.
// Matching is in lower case; "_" counts as a space, and a name also matches without its spaces and "_" ("kb" finds
// k_B, "g0" finds g_0).
import type { FindContext, FindHit, FindItem, IndexItem } from "./types.ts";

const EXACT = 900;
const PREFIX = 800; // minus the letters still missing, at most 50
const NAME_WORD = 600;
const TITLE_WORD = 500;
const DESC_WORD = 450;
const FUZZY = 300;
/** G161: gauge readings, in the compact lower case of a query: the fuzzy step skips them. */
const GAUGE = new Set(["psig", "barg", "kpag", "mpag"]);

interface PreparedName { raw: string; norm: string; compact: string; cased: string; words: string[] }
interface Prepared { item: FindItem; names: PreparedName[]; title: string[]; desc: string[] }
export interface PreparedIndex { items: Prepared[] }

const norm = (s: string): string => s.toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ").trim();
const compact = (s: string): string => s.replace(/[\s_]/g, "");
const words = (s: string): string[] => s.split(/[^\p{L}\p{N}°]+/u).filter(Boolean);

function prepareItem(item: FindItem): Prepared {
  const names = item.names.map((raw) => {
    const n = norm(raw);
    return { raw, norm: n, compact: compact(n), cased: compact(raw), words: words(n) };
  });
  return { item, names, title: words(norm(item.title)), desc: words(norm(item.desc ?? "")) };
}

/** The insert of a Giac function from its id (`fn:normald_cdf`): `\operatorname{normald\_cdf}\left(#0\right)`. #0, not #?:
 *  a selected expression becomes the argument, as for sin (R17). */
export function functionInsert(id: string): string {
  return `\\operatorname{${id.slice(id.indexOf(":") + 1).replace(/_/g, "\\_")}}\\left(#0\\right)`;
}

/** The index ready to search: every item with its insert (a tier-1 function's is filled in here). */
export function prepare(items: readonly IndexItem[]): PreparedIndex {
  return { items: items.map((it) => prepareItem(it.insert === undefined ? { ...it, insert: functionInsert(it.id) } : (it as FindItem))) };
}

/** Edit distance ≤ 1: one insertion, deletion, substitution or adjacent transposition. */
export function oneEdit(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) {
    return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
  }
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/** Every query word is a prefix of a different word of `ws`. */
function wordsPrefix(qw: readonly string[], ws: readonly string[]): boolean {
  if (!qw.length || qw.length > ws.length) return false;
  if (qw.length === 1) { const q = qw[0] as string; return ws.some((w) => w.startsWith(q)); }
  const used = new Set<number>();
  for (const q of qw) {
    const k = ws.findIndex((w, j) => !used.has(j) && w.startsWith(q));
    if (k < 0) return false;
    used.add(k);
  }
  return true;
}

/** The best match level of one item, with the name that gave it; 0 when nothing matches. */
function level(p: Prepared, q: string, qc: string, qw: readonly string[], rawc: string): { score: number; matched: string } {
  let score = 0;
  let matched = "";
  const take = (s: number, m: string): void => {
    if (s > score || (s === score && m.length < matched.length)) { score = s; matched = m; }
  };
  for (const n of p.names) {
    if (n.norm === q || n.compact === qc) take(EXACT + (n.cased === rawc ? 1 : 0), n.raw);
    else if (n.norm.startsWith(q) || n.compact.startsWith(qc)) take(PREFIX - Math.min(50, n.compact.length - qc.length), n.raw);
    else if (wordsPrefix(qw, n.words)) take(NAME_WORD, n.raw);
  }
  if (score) return { score, matched };
  if (wordsPrefix(qw, p.title)) return { score: TITLE_WORD, matched: "title" };
  if (wordsPrefix(qw, p.desc)) return { score: DESC_WORD, matched: "desc" };
  if (qc.length >= 4 && !GAUGE.has(qc)) {
    for (const n of p.names) {
      if (qc[0] !== n.compact[0] && qc[1] !== n.compact[1]) continue; // a typo in both first letters: too far
      if (oneEdit(qc, n.compact)) take(FUZZY + 1, n.raw);
      else if (n.compact.length > qc.length && [-1, 0, 1].some((d) => oneEdit(qc, n.compact.slice(0, qc.length + d)))) take(FUZZY, n.raw);
    }
  }
  return { score, matched };
}

const cache = new WeakMap<readonly FindItem[], Prepared[]>();
function preparedLive(live: readonly FindItem[] | undefined): Prepared[] {
  if (!live?.length) return [];
  let p = cache.get(live);
  if (!p) { p = live.map(prepareItem); cache.set(live, p); }
  return p;
}

/** a[ai…] is a prefix of b[bi…]. */
function startsAt(a: string, ai: number, b: string, bi: number): boolean {
  if (b.length - bi < a.length - ai) return false;
  for (let j = ai; j < a.length; j++) if (a.charCodeAt(j) !== b.charCodeAt(bi + j - ai)) return false;
  return true;
}

/** A name a longer query could still reach, though this one may not match it: `qc` is a prefix of it, or one edit
 *  (as oneEdit counts them) from one of its prefixes, without the fuzzy step's guards (query length, gauge, longer
 *  name). With a match of `qc` it holds every item a one-letter extension of `qc` matches (search's narrowing below). */
function nearAny(p: Prepared, qc: string): boolean {
  for (const n of p.names) {
    const c = n.compact;
    if (qc.charCodeAt(0) !== c.charCodeAt(0) && qc.charCodeAt(1) !== c.charCodeAt(1)) continue;
    let i = 0;
    while (i < qc.length && i < c.length && qc.charCodeAt(i) === c.charCodeAt(i)) i++;
    if (i >= qc.length - 1) return true; // a prefix, or the last letter is the edit
    if (startsAt(qc, i + 1, c, i + 1) || startsAt(qc, i, c, i + 1) || startsAt(qc, i + 1, c, i)) return true;
    if (qc.charCodeAt(i) === c.charCodeAt(i + 1) && qc.charCodeAt(i + 1) === c.charCodeAt(i) && startsAt(qc, i + 2, c, i + 2)) return true;
  }
  return false;
}

/** The last search's candidates (R132, E3): every item that matched it or is `nearAny` it. When the next query only
 *  adds a letter (its words the same but the last one longer, or a new word), each level only narrows: an exact or
 *  prefix name still starts with the shorter query, a word prefix of the longer word is one of the shorter, and a
 *  one-edit name of the longer query starts with the shorter one or is `nearAny` it. So the next search reads only the
 *  candidates, and its hits and order are those of a search over every item (rank.test.ts checks it). */
interface Narrow { index: PreparedIndex; live: readonly FindItem[] | undefined; filter: string; q: string; qc: string; qw: readonly string[]; cands: Prepared[] }
let last: Narrow | undefined;

function narrows(n: Narrow, q: string, qc: string, qw: readonly string[]): boolean {
  if (n.qc.length < 2 || !q.startsWith(n.q) || !qc.startsWith(n.qc) || qc.length > n.qc.length + 1) return false;
  if (qw.length < n.qw.length) return false;
  const k = n.qw.length - 1;
  for (let i = 0; i < k; i++) if (qw[i] !== n.qw[i]) return false;
  return k < 0 || (qw[k] as string).startsWith(n.qw[k] as string);
}

export function search(index: PreparedIndex, query: string, ctx: FindContext = {}): FindHit[] {
  const raw = query.trim();
  const rawc = compact(raw);
  const q = norm(raw);
  const qc = compact(q);
  const qw = words(q);
  const filter = ctx.filter ? new Set(ctx.filter) : undefined;
  const filterKey = ctx.filter ? [...ctx.filter].join(" ") : "";
  const prefer = new Set(ctx.prefer ?? []);
  const hits: FindHit[] = [];
  const prev = last !== undefined && last.index === index && last.live === ctx.live && last.filter === filterKey && narrows(last, q, qc, qw) ? last : undefined;
  const lists = prev ? [prev.cands] : [preparedLive(ctx.live), index.items];
  const cands: Prepared[] = [];
  for (const list of lists) for (const p of list) {
    if (filter && !filter.has(p.item.kind)) continue;
    const { score, matched } = q ? level(p, q, qc, qw, rawc) : { score: 1, matched: p.item.names[0] ?? "" };
    if (!score) {
      if (q && qc.length >= 2 && nearAny(p, qc)) cands.push(p);
      continue;
    }
    cands.push(p);
    hits.push({ item: p.item, score, matched });
  }
  last = q && qc.length >= 2 ? { index, live: ctx.live, filter: filterKey, q, qc, qw, cands } : undefined;
  hits.sort((a, b) =>
    b.score - a.score
    || a.item.tier - b.item.tier
    || Number(prefer.has(b.item.kind)) - Number(prefer.has(a.item.kind))
    || a.matched.length - b.matched.length
    || (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0));
  return hits.slice(0, ctx.limit ?? 50);
}

/** Forget the last search's candidates: the next search reads every item (rank.test.ts compares the two). */
export function forgetLastSearch(): void {
  last = undefined;
}
