// SPDX-License-Identifier: GPL-3.0-or-later
// G62: sequences and state in the sweep (r16 section 3.2). Random action sequences over carriers (a store by :=, ▶ or sto, Ans and a chip, a function
// body, the definitions log and a relaunch, Copy, a Solve root used as a known, a bound variable named as a stored one) × facts (an exact value, a
// symbolic one, an ≈, an unaudited ⚠). The invariant: a value read later carries the facts it had when it left the line; a case breaks it when its
// mark or digits differ from the same value typed fresh (the line it left, or the same line on an engine that never stored the name).
import { latexToGiac } from "../../../app/src/input/latex-to-giac.ts";
import { copyFull } from "../../../app/src/clipboard/text.ts";
import { parsePastedNumber } from "../../../app/src/clipboard/paste.ts";
import { EngineHost } from "../../../app/src/engine/host.ts";
import { defaultHomeSettings, precisionFacts, type HomeResult } from "../../../app/src/engine/homeEval.ts";
import { markOf } from "../../../app/src/engine/format.ts";
import { applyDefChanges, type DefEntry } from "../../../app/src/engine/defs.ts";
import type { ChipEntry } from "../../../app/src/engine/chipFacts.ts";
import type { KnownValue } from "../../../app/src/engine/types.ts";
import { knownDigits } from "../../../app/src/engine/solve.ts";
import { chipFactsOf, chipOf as itemChip, homeItem } from "../../../app/src/state/results.ts";
import { checkCopy, copySourceOf, type InvariantFailure } from "../../../app/scripts/invariants.ts";
import { lcg } from "./gen.ts";

/** What a line showed: the display text and the mark with its count (`=`, `≈`, `⚠12`). */
export interface Seen {
  display: string;
  mark: string;
}

export const seenOf = (r: HomeResult, digits: number): Seen => {
  const m = r.ok && r.value ? markOf(precisionFacts(r), { format: "STD", digits }) : null;
  return { display: r.ok ? r.display : `ERR ${r.error ?? ""}`, mark: m ? `${m.mark}${m.n ?? ""}` : "" };
};

/** The invariant of r16 3.2: a value read later shows the text and the mark it had when it left the line. */
export function checkRead(id: string, carrier: string, left: Seen, read: Seen): InvariantFailure | null {
  return left.display !== read.display || left.mark !== read.mark
    ? { id, check: carrier, detail: `left the line as ${left.mark || "-"} ${left.display}, read later as ${read.mark || "-"} ${read.display}` }
    : null;
}

/** Facts the generator draws from: exact, symbolic, ≈, a float typed, and an unaudited function (⚠ through its inherited facts). */
/** (evalf(pi,30) is not here: a line that asks for 30 digits shows them, and the chip shows 12 again, as it should.) */
export const SOURCES = ["1/3", "sqrt(2)", "sin(1)", "0.1+0.2", "BesselJ(1,2)", "7/3.0", "2^100"];
const NAMES = ["x", "y", "a"];
/** Lines with a bound variable; each reads the stored name only as the thing it binds, so a stored value must not change the answer (diff is left out: Home does read it). */
const BOUND = ["sum(N^2,N,1,10)", "int(N^2,N,0,1)", "seq(N^2,N,1,3)", "product(N,N,1,4)"];
const FORMS = ["assign", "arrow", "sto"] as const;
const STORE = (form: (typeof FORMS)[number], name: string, src: string): string => (form === "assign" ? `${name}:=(${src})` : form === "arrow" ? `(${src})=>${name}` : `sto(${src},${name})`);

type Step = { kind: "store"; form: (typeof FORMS)[number]; name: string; src: string } | { kind: "read"; name: string } | { kind: "ans"; src: string; keep: string | null }
  | { kind: "fn"; name: string } | { kind: "relaunch" } | { kind: "copy"; src: string } | { kind: "solve"; c: number } | { kind: "bound"; name: string; line: string };

export interface Sequence {
  digits: 12 | 30;
  steps: Step[];
}

const text = (s: Step): string => {
  switch (s.kind) {
    case "store": return STORE(s.form, s.name, s.src);
    case "read": return s.name;
    case "ans": return s.keep ? `[Ans of ${s.src}] ${s.keep}:=Ans` : `[Ans of ${s.src}]`;
    case "fn": return `f(t):=t; f(${s.name})`;
    case "relaunch": return "[relaunch]";
    case "copy": return `[Copy of ${s.src}]`;
    case "solve": return `[solve u^2=${s.c}, then v=u^2 with u known]`;
    case "bound": return s.line.replace(/N/g, s.name);
  }
};

/** The sequences of a seed: 2 to 5 steps each, a name stored before it is read. Pure. */
export function sequencesOf(seed: number, count: number): Sequence[] {
  const rnd = lcg(seed);
  const pick = <T>(l: readonly T[]): T => l[Math.floor(rnd() * l.length)]!;
  const out: Sequence[] = [];
  for (let n = 0; n < count; n++) {
    const steps: Step[] = [];
    const stored: string[] = [];
    const len = 2 + Math.floor(rnd() * 4);
    // every sequence starts with a store so the later steps have something to carry
    for (let k = 0; k < len; k++) {
      const r = rnd();
      if (k === 0 || r < 0.22 || stored.length === 0) {
        const name = pick(NAMES);
        steps.push({ kind: "store", form: pick(FORMS), name, src: pick(SOURCES) });
        if (!stored.includes(name)) stored.push(name);
      } else if (r < 0.4) steps.push({ kind: "read", name: pick(stored) });
      else if (r < 0.52) steps.push({ kind: "ans", src: pick(SOURCES), keep: rnd() < 0.5 ? pick(NAMES) : null });
      else if (r < 0.62) steps.push({ kind: "fn", name: pick(stored) });
      else if (r < 0.72) steps.push({ kind: "relaunch" });
      else if (r < 0.8) steps.push({ kind: "copy", src: pick(SOURCES) });
      else if (r < 0.86) steps.push({ kind: "solve", c: pick([2, 3, 5, 7]) });
      else steps.push({ kind: "bound", name: pick(stored), line: pick(BOUND) });
      const last = steps[steps.length - 1]!;
      if (last.kind === "ans" && last.keep && !stored.includes(last.keep)) stored.push(last.keep);
    }
    out.push({ digits: n % 2 === 0 ? 12 : 30, steps });
  }
  return out;
}

export interface SeqRun {
  failures: InvariantFailure[];
  /** Reads compared with what they left. */
  checked: number;
  relaunches: number;
}

/** The chip the session makes of a result, by its own rule (state/results.ts, G86), as the engine takes it by name. */
export function chipOf(r: HomeResult): ChipEntry | null {
  const c = itemChip({ status: r.ok ? "done" : "error", ...homeItem(r, false) });
  return c ? chipFactsOf({ c })["c"]! : null;
}

const give = (e: unknown): string => (e instanceof Error ? e.message : String(e)).slice(0, 80);

/** Runs sequences on one live host (names purged after each) and a clean host that never stores. `fresh` makes the engine for a relaunch. */
export async function runSequences(seqs: readonly Sequence[], fresh: () => Promise<EngineHost>): Promise<SeqRun> {
  let live = await fresh();
  const clean = await fresh();
  const run: SeqRun = { failures: [], checked: 0, relaunches: 0 };
  for (const q of seqs) {
    const s = { ...defaultHomeSettings, digits: q.digits, workDigits: Math.max(30, q.digits + 10) };
    const vars = new Map<string, { seen: Seen; src: string }>();
    const seq = q.steps.map(text).join(" | ");
    const fns = new Set<string>();
    let log: DefEntry[] = [];
    let last: { r: HomeResult; chip: ChipEntry | null } | null = null;
    const home = (h: EngineHost, line: string, chips?: Record<string, ChipEntry>): HomeResult => {
      const { result, defs } = h.home(line, s, undefined, chips);
      if (h === live) log = applyDefChanges(log, defs);
      return result;
    };
    // The failure's id names the class (digits, carrier, source and read), not the sequence that met it; the sequence is in the detail.
    const verify = (carrier: string, desc: string, left: Seen, read: Seen): void => {
      run.checked++;
      const f = checkRead(`${q.digits} ${carrier}: ${desc}`, carrier, left, read);
      if (f) run.failures.push({ ...f, detail: `${f.detail} [${seq}]` });
    };
    try {
      for (const st of q.steps) {
        switch (st.kind) {
          case "store": {
            const r = home(live, STORE(st.form, st.name, st.src));
            if (r.ok && r.value) vars.set(st.name, { seen: seenOf(r, q.digits), src: st.src });
            else vars.delete(st.name);
            break;
          }
          case "read": {
            const v = vars.get(st.name);
            if (v) verify("store", `${v.src} stored, read by its name`, v.seen, seenOf(home(live, st.name), q.digits));
            break;
          }
          case "ans": {
            const r = home(live, st.src);
            const chip = chipOf(r);
            last = { r, chip };
            if (!chip || !r.ok) break;
            const left = seenOf(r, q.digits);
            const chips = { "1": chip };
            verify("chip", `${st.src} as a chip`, left, seenOf(home(live, "pasr_1", chips), q.digits));
            if (st.keep) {
              const stored = home(live, `${st.keep}:=pasr_1`, chips);
              if (stored.ok && stored.value) {
                verify("chip", `${st.src} as a chip, stored`, left, seenOf(stored, q.digits));
                vars.set(st.keep, { seen: seenOf(stored, q.digits), src: st.src });
              } else vars.delete(st.keep);
            }
            break;
          }
          case "fn": {
            if (!fns.has("f")) home(live, "f(t):=t");
            fns.add("f");
            const v = vars.get(st.name);
            if (v) verify("fn", `${v.src} stored, read through f(t):=t`, v.seen, seenOf(home(live, `f(${st.name})`), q.digits));
            break;
          }
          case "relaunch": {
            live = await fresh();
            live.restore(log);
            run.relaunches++;
            for (const [name, v] of vars) verify("relaunch", `${v.src} stored, read after a relaunch`, v.seen, seenOf(live.home(name, s).result, q.digits));
            break;
          }
          case "copy": {
            const s12 = { ...s, digits: 12 };
            const r = live.home(st.src, s12).result;
            const copy = r.ok && r.value ? copyFull(copySourceOf(r)) : undefined;
            const pasted = copy === undefined ? null : parsePastedNumber(copy);
            if (copy !== undefined && pasted) {
              run.checked++;
              const f = checkCopy(`${q.digits} copy: ${st.src}`, r, copy, clean.home(latexToGiac(pasted.latex), s12).result);
              if (f) run.failures.push({ ...f, id: `${q.digits} copy: ${st.src}`, check: "copy", detail: `${f.detail} [${seq}]` });
            }
            break;
          }
          case "solve": {
            // A root used as a known, as the Solve app sends it (full value, confirmed digits, warn), against the same value typed in full.
            const root = live.solve({ kind: "equations", equations: [`u^2=${st.c}`], unknowns: ["u"], guesses: ["1"] }, s).roots[0]?.result;
            if (!root?.ok || !root.value) break;
            const known: KnownValue = { name: "u", value: root.full.replace("E", "e"), facts: root.facts };
            const kd = knownDigits(known);
            const req = { kind: "equations" as const, equations: ["v=u^2"], unknowns: ["v"], guesses: ["0"] };
            const withFacts = live.solve({ ...req, knowns: [known] }, s).roots[0]?.result;
            const typed = clean.solve({ ...req, knowns: [{ name: "u", value: known.value }] }, s).roots[0]?.result;
            if (withFacts?.ok && withFacts.value && typed?.ok && typed.value) {
              const a = seenOf(withFacts, q.digits);
              const b = seenOf(typed, q.digits);
              // the app's known carries facts the typed one does not: only the digits shown must agree (the mark may be weaker, never the text different)
              run.checked++;
              // …and it carries the known's confirmed digits: a value of a known confirmed to n digits is not confirmed to more (G68)
              const over = kd !== undefined && withFacts.facts.reliableDigits !== null && withFacts.facts.reliableDigits > kd;
              if (over) run.failures.push({ id: `${q.digits} solve: u^2=${st.c}, digits`, check: "solve", detail: `[${seq}] u confirmed to ${kd} digits gave v confirmed to ${withFacts.facts.reliableDigits}` });
              if (a.display !== b.display) run.failures.push({ id: `${q.digits} solve: u^2=${st.c}`, check: "solve", detail: `[${seq}] u=${known.value} as the app sends it gave v ${a.mark || "-"} ${a.display}, typed in full ${b.mark || "-"} ${b.display}` });
            }
            break;
          }
          case "bound": {
            const line = st.line.replace(/N/g, st.name);
            const v = vars.get(st.name);
            if (v) verify("bound", `${st.line.replace(/N/g, "x")} with ${v.src} stored under that name`, seenOf(clean.home(line, s).result, q.digits), seenOf(home(live, line), q.digits));
            break;
          }
        }
      }
    } catch (e) {
      run.failures.push({ id: `${q.digits} throw`, check: "throw", detail: `${give(e)} [${seq}]` });
    }
    // leave the live engine clean for the next sequence (names and the function)
    live.home(`purge(${[...NAMES, "f"].join(",")})`, s);
  }
  return run;
}
