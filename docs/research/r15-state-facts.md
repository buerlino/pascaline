<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# R15: stored names from Giac's state (S13 spike)

2026-10-20, sandra (run 106), `phase-1` at `fbad08c` (G48, G51, G55 merged). Probe: `tools/probes/state-facts.ts`. **Verified** = I ran it; **(to verify)** names who checks it and how.

## The question
G48 and G49 needed five packages (G49, f1, f3, f4, G48), and each one covered one more way to write a definition (night check 2026-10-19, 2.2). Today the host decides from the input's text which names an input stored and which stored names it read: `storeTargets`, `definedBy`, `namesIn`, `functionsIn`, `maskBound`, `bodyFacts`, `callFacts`. Can Giac tell us instead?

## Recommendation: extend, then replace the name finding
**Let Giac's state decide which names an input stored and which stored names it read. Keep the text only for what must be known before the input runs.**

Reasons:
- **Same marks on every golden case.** All 27 G48, G49 and G51 sequence cases get their expected mark either way. The only differences are three digit counts, which come from the perturbation check (see the table).
- **It catches what the text misses.** Six of the 15 extra forms show a wrong `=` or `≈` under the text rules; the state rule gives each one its ⚠. Three of them are reachable without typing Giac text.
- **The cost is small.** An ordinary Enter costs one more Giac call, 0.07–0.13 ms on the desktop (the mean Enter is 1.43 ms and 11 calls).

"Before the input runs" means the run-once test (`isStateful`, `callsStateful`): the state can only be read afterwards, and running an input twice is the very harm that test prevents.

**Alternatives, one line each:**
- **Replace everything now:** the run-once test cannot move, and without the change signal (G66, in the report) a store the text does not see would be credited to the wrong input.
- **Keep the text rules:** every new way to store (Find's `unapply`, R59's import, R38b's restore) costs another follow-up package, and the six misses stay.

## How the probe works
Each sequence runs on two engines side by side:
- **Text:** `EngineHost` as the app runs it today.
- **State:** a second `EngineHost` whose definitions log is wiped after every step, so it inherits nothing, with this model on top:
  - **Stored names:** one call, `map(VARS(),k->[k,string(eval(k))])`, before and after the input gives every user name with its stored text. A name that is new or changed takes the input's facts: the result's own facts merged with the facts of every name the input read. A purged name loses its facts. The facts are kept or dropped by host.ts's `storedFacts` rule.
  - **Read names:** Giac's parse of the input, `pasprobeq:=quote(<input>)`. For a store (`sommet` is `sto`) only the stored side is read, `lname(op(pasprobeq)[0])`; the target's own names count only for `L[k]:=`. A defined program's parameters are left out.
  - **The closure:** the read names are followed through each stored name's value, `lname(<name>)`, which covers a program's body and the names inside a symbolic value. Again a program's parameters are left out.
  - **The mark:** the result is capped by the weakest facts it read (fewest confirmed digits, strongest warn, never exact). This is `inherited()` without its perturbation check, which needs only the names and so would stay.
  - **Chips and constants:** they count as stored names with facts. A function definition gets a chip's value and its facts lent, as the host does.

Giac facts the design rests on (verified in raw mode):
- `VARS()` lists every name stored by `:=`, `[a,b]:=`, `a,b:=`, `=>`, `sto`, `unapply`, `L[k]:=`, inside an expression (`(pZ:=pA)+1`) and inside a called program (`setg(v):={gl:=v;…}`), and drops a purged name.
- `quote(...)` parses every one of these forms to a `sto` node: `=>` and `sto(v,a)` print back as `a:=v`, and the list forms as `[a,b]:=copy(…)`.
- `lname` of a program lists its parameters, its locals and its free names: `lname(h)` is `[x,t,pA]` for `h(x):={local t; t:=pA; …}`.

## Results (verified, `node tools/probes/state-facts.ts`)
F = `floor(sin(10^100)*10^12)`: Giac gives 899450126402; the oracle (mpmath at 250 digits) gives −372376123662.

| Set | Cases | Same mark | Expected mark: text / state | Where they differ |
|---|---|---|---|---|
| Golden: G48, G49, G49f1, G49f3, G49f4 sequences; G51's CAS cases are in host.test.ts only | 27 | 24 | 27 / 27 | `g49-seq-chip-romberg-cancel-12` and `-30` give text ⚠0, state ⚠11; `g49-seq-chip-romberg-x1-x1` gives ⚠9 against ⚠10. All three read the same names; the digit counts come from the perturbation check, which the probe leaves out |
| Extras: night check 2.2 and new forms | 15 | 9 | 8 / 14 | the six rows below |
| G55 corpus sequences | 6 | 6 | — / — | none (exact list elements keep `=` under both rules) |

The extras where the text rules miss:

| Steps | Text | State | Right |
|---|---|---|---|
| `sto(F,pA)`, `setg(v):={gl:=v; return 1;}`, `setg(pA)`, `gl` | = 899450126402 | ⚠ | ⚠, a wrong value |
| `sto(F,pA)`, `(pZ:=pA)+1`, `pZ` | = | ⚠ | ⚠, a wrong value |
| `sto(F,pA)`, `[sto(pA,pY),1]`, `pY` | = | ⚠ | ⚠, a wrong value |
| `S:=y+pA0`, `sto(F,pA0)`, `subst(S,y=0)` | ≈ | ⚠ | ⚠, a wrong value |
| `S2:=pA1*2`, `sto(F,pA1)`, `S2` | ≈ | ⚠ | ⚠, a wrong value |
| `S3:=y+k1`, `k1:=romberg(exp(-x^2),x,0,1)`, `subst(S3,y=0)` | ≈, 39 digits claimed | ⚠11, unaudited | ⚠11; the 12 digits shown happen to be right (oracle 0.746824132812427…) |

**How the user can reach them:**
- **The last three need no Giac text.** The Store key gives `S:=…`, and a stored name used in an expression stored earlier is ordinary keyboard work. A variable's facts are fixed when it is stored; only a function's body is read again at a call (`host.ts:570` `callFacts`). So a name that gets its value later never lends its facts through a variable that holds it.
- **The first three need Giac text** (R59's import, R38b's restore) or `sto` from Find (R4a).

**Where both rules agree:**
- **`L2[1]:=pA`, `subst(x+1,x=pA)`, a program with a `local`, `seq` stored, CAS `unapply`, and an exact redefinition or purge:** both rules give the right mark.
- **One over-read, shared by both:** with a global `t:=evalf(sqrt(2))`, `pq(x):={local t; t:=1; return x+t;}` gives `pq(1)` ≈ under both rules (right: = 2). Giac's `lname` lists locals, and `maskBound` masks only parameters. The mark is too weak, never too strong.

## Cost (verified; desktop, host-cpu lock, medians of 5, three runs)
- **Baseline today:** `tools/probes/engine-calls.ts` gives 165 Giac calls over its 15 inputs (a, b and f stored), and the medians sum to 21.5 ms. That is 11 calls and 1.43 ms per Enter.
- **The probe's own form:** +100 calls and 7.0–7.7 ms (+61 % calls). It reads the state both before and after, and makes one `lname` call per name in the closure. That is too dear.
- **The lean form a host would use:**
  - **The read call:** one call per Enter that parses the input and returns its names. It costs 0.07–0.13 ms (+9 % calls, +5–9 % time).
  - **The state call:** names, stored texts and each name's `lname` in one call. The closure is then walked in JS over a table kept in the host. It costs 0.14–0.19 ms with 3 stored names and 1.48–1.69 ms with 200 (the replay bench's mix of 150 values and 50 functions), because it prints every value. So it runs only after an input that may store: today's `isStateful`/`callsStateful` set, which is a run-once input anyway. Its result is the "before" state of the next one.
- **On the Tab One (to verify, annabell in A16's run):** about 1–4 ms per ordinary Enter, assumed from the 10–30× ratio of the night check 2.3. Measure with `engine-calls.ts` in A16's session.
- **The gate:** the gate's `calls-home` and `calls-bench` baselines (G52) rise by one call per Enter. That is the owner's decision below.

## Text helpers it would replace (file:line on `fbad08c`)
**Replaced** for the facts' names:
- `homeEval.ts:405` `storeTargets` and `homeEval.ts:434` `arrowFunction`;
- in host.ts:
  - `host.ts:229` `indexedTarget`, `:236` `definesFunction` and `:241` `isFnEntry`;
  - `:247` `mergedFacts`, which stays as the merge;
  - `:397–430`, the target cases of `defsAfter`: the changed names come from the state; `type()` gives var or fn;
  - the name finding in `:452` `inherited`;
  - `:511` `fnFacts`, `:521` `storeFacts`, `:530` `bodyFacts`, `:551` `readFacts` and `:570` `callFacts`;
- in numeric.ts, `numeric.ts:296` `complexReads`'s walk of stored names (`:344` `boundIn`), which could read the same table: a later package.

**Kept:**
- `homeEval.ts:373–380` `STATEFUL` and `isStateful`, `numeric.ts:1112` `callsStateful` and `:1127` `decidingStored`: they must be known before the run.
- `homeEval.ts:382` `simpleAssignment`, for re-running a right side.
- `homeEval.ts:388` `definedBy`, for Find's item kind.
- `host.ts:131` `QUOTING` and `:166` `maskBound`, for CAS `uses` (F28: a hint list, not a mark).
- `numeric.ts:243` `functionsIn`, for the audited-function list.

## Risks
- **A store the text does not flag** (none found: every form above matches `STATEFUL`, or `callsStateful` for `setg(3)` and a program that calls it, verified). The next state read would credit it to a later input. G66 closes this with a store counter.
- **Over-reads** from `lname` (locals, a global named like a bound variable) give a weaker mark, never a stronger one.
- **Many or large stored values** make the state call dearer (200 names: 1.7 ms desktop).
- **Restore and replay, units and Solve** also change Giac's state. They must refresh the table, which G65 tests.

## How to rerun
- Table: `node tools/probes/state-facts.ts` (`SHOW=1`: every step). Cost: its `--cost` and `engine-calls.ts`, under the host-cpu lock.
- The oracle: `tests/golden/.venv/bin/python -I -c "import mpmath as m; m.mp.dps=250; print(m.floor(m.sin(m.mpf(10)**100)*10**12))"`.
