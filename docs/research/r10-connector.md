<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# R10: the laptop connection (S4, sandra, 2026-10-18)

**Question** (feedback #5b, #17, #40; backlog "Parked ideas"): how does an engineer program Pascaline from a laptop, with no Python on the phone, no INTERNET permission, and no typing through the Alpha keys? The idea from 2026-10-14: a plain-text library of Giac definitions, written and tried on the laptop, imported on the phone into the `defs` log, found in Find and Vars, and put on a user key.

**Answer in one line:** a UTF-8 text file of Giac definitions, each with a one-line description and optional test lines, checked as a whole and refused as a whole; it reaches the phone through the system file picker (no manifest change); the import goes into the `defs` log through the same host path as a typed CAS definition; the laptop side is the desktop web app plus a small Node command. **Blocker found:** the replay of 200 library programs would cost about 530 ms on the Tab One (estimate), so the import waits for the replay fix of A4a point 2, and the cheapest fix is to define functions lazily (section 3.2).

Evidence: `tools/probes/library.ts` (the rules below as a runnable prototype) with the files in `tools/probes/library/` (one good library, thirteen bad ones, each refused for one reason). Run from the repo root with `GIAC_OUT` set: `node tools/probes/library.ts check tools/probes/library/beams.txt`, `… replay`, `… export`. All runs 2026-10-18, dev engine (`engine/giac/_out/gsl`), desktop Ryzen 7 PRO 4750U, Node 22.

## 1. The file

### 1.1 Format
```
// pascaline library 1
// Maximum bending moment of a simply supported beam under a uniform load q over span L: q·L²/8
beam_M(q,L):=q*L^2/8
// test: beam_M(2,4) == 4
// test: simplify(beam_M(q,2*L) - 4*beam_M(q,L)) == 0

// Sum of a^k/k for k = 1..n
sumpow(a,n):={
  local s,k;
  s:=0;
  for (k:=1;k<=n;k++) { s:=s+a^k/k; }
  return s;
}
// test: sumpow(2,3) == 2+2+8/3

// Standard gravity in m/s² (exact, CGPM 1901)
g0:=980665/100000
```
- **Line 1 is the version stamp** `// pascaline library <n>`, where n is `DATA_VERSION` (`app/src/state/storage.ts:23`). One number for both: the file holds Giac text that may contain our internal names (`Phi_`, `pasc_G`), and a rename of those raises `DATA_VERSION` with a migration step (storage.ts:18-21), which must rewrite library text the same way. A missing stamp is refused (one line to add; a guess would be a silent assumption). A newer number is refused ("made by a newer Pascaline"), as R38b refuses a newer backup.
- **Every line is valid Giac.** `//` is a Giac comment: `"// a comment\nbeam(q,L):=q*L^2/8"` evaluates to `(q,L)->q*L^2/8` (probe, raw mode). So the same file can be pasted into Xcas or the CAS view.
- **A definition** starts at column 0 and is `name(args):=body` (a function) or `name:=value` (a named value), the two forms `definedBy` already recognises (`app/src/engine/homeEval.ts:329-337`). It continues on the next lines while a bracket is open or the line is indented or starts with a closing bracket, so multi-line programs with `local`, `for` and `return` work (probe: `sumpow` defines and gives `sumpow(2,3)` = 20/3).
- **The description** is the comment line directly above the definition, required, at most 120 characters. It becomes the Find line (`FindItem.desc`, `app/src/find/types.ts:16`). Required because a function with no line in Find is one the user cannot pick among others; the check costs the author one line.
- **Test lines** `// test: <expr>` follow a definition. Each must evaluate to `true` (or 1) after the whole file is defined, or the import is refused. So a library carries its own golden cases, in the same `derived` spirit as ours (the author states a provable value). Two engine facts the author must know, both from the probe:
  - Giac's `==` on symbolic expressions is structural: `beam_M(q,2*L) == 4*beam_M(q,L)` gives `false`, `simplify(beam_M(q,2*L) - 4*beam_M(q,L)) == 0` gives `true` (the same structural `==` as F35).
  - `==` between a float and an exact value compares at float precision: `evalf(1/3)==1/3` is `true`, `g0==9.80665` is `true`, `g0==9.806650000001` is `false`. A test that needs a tolerance writes it: `abs(f(2)-1.234) < 1e-9`.
- **Decimals in a library are Giac floats** (raw Giac text, as in the CAS view), not the exact decimals our parser makes of typed numbers. Exact constants are written as fractions (`980665/100000`). A float stays honest on the phone: Home marks a float result ≈ by its own path.

### 1.2 Encoding and size
- UTF-8, read with a fatal decoder (Latin-1 bytes are refused: `bad-encoding.txt`); a BOM is dropped; CRLF and CR become LF. Names are ASCII (`[A-Za-z][A-Za-z0-9_]*`, the rule `validDefs` already applies at `app/src/engine/defs.ts:97`); descriptions and comments may hold any character (`²`, `·`, `⁴` in the sample pass).
- **≤ 256 kB and ≤ 200 definitions per file.** 200 is the size the replay budget is written for (docs/04 6.2); the sample file with its four definitions and five tests is 768 bytes, so 200 programs are about 40 kB and 256 kB leaves room for long descriptions and tests.
- **The log stays within `MAX_DEFS` = 500** (`defs.ts:43`). Today `applyDefChanges` drops the oldest entries without a word when the log passes 500 (`defs.ts:65`). An import that would push the log past 500 is refused with the numbers ("now 380, new 150"), never trimmed.

### 1.3 What an import refuses
All or nothing: the first problem refuses the whole file, with its line number and plain words. Each rule has a bad sample in `tools/probes/library/` and the probe's message:

| Refused | Why (evidence) | Sample |
|---|---|---|
| anything at top level that is not a comment, a blank line or a definition (`assume(x>0)`, `purge(f)`, `Digits:=20`, a bare `1+1`) | it changes engine state with no name the log can hold | `bad-assume.txt` |
| a second statement after `;` on a definition | `r(x):=x;s:=3` defines r and sets s=3, but `definedBy` only sees r, so the log would not know s (probe) | `bad-semicolon.txt` |
| a body that changes engine state when called: `Digits`, `angle_radian`, `purge`, `restart`, `reset`, `assume`, `read`, `write`, `sto`, `=>`, … | `h(x):={Digits:=5; x}`: after `h(1)`, `Digits` is 5 (probe); `k(x):={purge(beam); x}`: after `k(1)`, `beam` is gone from the engine while Vars still lists it; `read("f")` aborted the wasm module (probe, raw mode); `write` is refused by Giac's secure mode | `bad-digits.txt`, `bad-purge.txt`, `bad-read.txt` |
| a body that assigns a name that is not a parameter or `local` | Giac warns "a, declared as global variable(s)" for `m(x):={a:=x; a}`: a call would set a user variable behind the log's back | `bad-global.txt` |
| a name that is a Giac built-in | `sin(x):=x` is refused by Giac, but `type(Beta)` and `type(sq)` are `func` and a test file's innocent `sq(x):=x^2` shadows Giac's `sq` (probe). The check is `type(name) == func` in an engine where the name is not a user definition | `bad-builtin.txt` |
| one of our names: `ENGINE_DEFINITIONS` (`pasmod`, `sigfig`, `homeEval.ts:130`), the `pasc_` prefix, a trailing `_` (`Phi_`, `Psi_`, `app/src/input/parse.ts:175`) | they are loaded lazily (`host.ts:247-252`), so `type(sigfig)` is `identifier` until first use and the built-in check would miss them | `bad-ours.txt` |
| the same name twice; a definition without its description; a description over 120 characters | | `bad-nodesc.txt` |
| a failing test | `sqq(3) == 10` → "test failed: sqq(3) == 10 gave false" | `bad-test.txt` |
| no stamp, a newer stamp, not UTF-8, over 256 kB, over 200 definitions, over `MAX_DEFS` in total | 1.1, 1.2 | `bad-header.txt`, `bad-newer.txt`, `bad-encoding.txt` |

The word list is a guard, not a proof: a body can still loop forever or run out of memory. Those already have their answers (the Cancel key; G24's memory cap and restart, backlog trust item 9), and the import's own run of the tests goes through the same cancellable worker.

## 2. Onto the phone without the INTERNET permission

S6's answer (its note r11, files, in docs/research/) does not exist yet (S6 starts after S7); this section lists the candidates and what each needs, and S6 settles them on WebView 131. Today's manifest: one activity with the launcher filter only, a `FileProvider` (from the Capacitor template), and `VIBRATE` as the only permission (`android/app/src/main/AndroidManifest.xml:20-23, 27-35, 41`). The file itself reaches the phone the user's way (USB cable into Downloads, a sync app the user already runs): the app never touches the network.

| Way in | Manifest | Code | Note |
|---|---|---|---|
| **`<input type="file" accept=".txt,text/plain">`** (recommended) | nothing | the web layer only; the same code in the PWA and the desktop app | Capacitor's `BridgeWebChromeClient.onShowFileChooser` opens `fileChooserParams.createIntent()` (Android's picker, a one-time read grant, no storage permission); the camera permission is asked only for a capture of images or video (`@capacitor/android` 8.5.3, `BridgeWebChromeClient.java:276-301, 375-386`). **(to verify, S6 point 2: that the picker opens on WebView 131 and the system keyboard stays closed)** |
| "Open with" from a file manager | an `intent-filter` for `VIEW` with `mimeType="text/plain"` on `MainActivity` | native: read the `content://` URI in `onNewIntent` (the activity is `singleTask`, manifest:17) and hand the text to the web layer; no Capacitor core plugin reads a content URI to text | Pascaline would then show up for every text file; a custom extension cannot be matched reliably by MIME type (to verify, S6) |
| Share to Pascaline | an `intent-filter` for `SEND` with `text/plain` | native, as above, plus the text extra | the same cost as "open with"; it lets an editor app on the phone send a library straight in |
| Paste | nothing | the clipboard plugin of decisions.md A4a point 5 | `readText` is denied in WebView 131 today; a library over the clipboard has no stamp check problem, but getting laptop text onto the phone's clipboard needs a network tool on the user's side |

**Recommendation:** the file picker first (no manifest change, no native code, one code path in three places); "open with" and share only if the owner misses them after use. The way out (export) is S6's answer for the backup file, unchanged: the library is one more text file.

## 3. Import and export

### 3.1 Into the `defs` log
- **The path:** each definition goes through `host.cas()` as if typed in the CAS view (the file is raw Giac text, as the CAS view is), so the log entry, its replay commands, its preview and, for a value, its snapshot come from the existing code (`host.ts:300-327` `defsAfter`). No second way to write the log. The probe's `defineLibrary` does exactly that: `beams.txt` gives 4 entries in 33 ms on the desktop, with its 5 tests passing.
- **The order:** (1) read and check the whole file (1.3) before anything reaches the engine; (2) the built-in check, then define, then run every test; (3) on any failure the engine is restarted from the unchanged log (`WorkerEngine.cancel()`, `workerEngine.ts:253`, the path Cancel already takes), so a half-imported file never stays in the engine and the stored log is never written; (4) on success the changes are kept (`keep`, which stores the log).
- **The name-clash rule:** a name already in the log with the same commands is unchanged (listed as "same"); with different commands it is listed as "replaces", and the user confirms the import once with that list in front of them (Enter imports, Esc cancels). Principle 3: nothing the user defined changes without being shown. A replaced name moves to the end of the log, as any redefinition does (`applyDefChanges`, `defs.ts:53-66`).
- **The stamp:** the file's version runs through the same migration steps as the stored `defs` (storage.ts:28-31 has none yet; a future rename step must take plain Giac text so the library can use it).
- **A new field:** `DefEntry` has no description, and `validDefs` rebuilds each entry field by field, so an unknown field would be dropped on the next read (`defs.ts:87-110`). The import adds `desc?: string` to `DefEntry` and `UserName` (`defs.ts:114-129`), and raises `DATA_VERSION` to 2 with an empty step, as storage.ts:18-21 asks for a shape change.

### 3.2 Replay time at 200 definitions
Desktop, median of 5 fresh engines, `host.restore()` of a log built through `cas()` (`node tools/probes/library.ts replay`, host-cpu lock held):

| Log of 200 | Desktop median (runs) | Tab One |
|---|---|---|
| the `?bench=defs` mix: 150 values, 50 one-line functions (`app/src/bench.ts:38-39`) | 12.9 ms (12.9 24.4 11.1 9.0 18.5); G3 measured 10.8 | **291 ms** (A4a, decisions.md "A4a" point 2) |
| 200 one-line functions | 13.9 ms | ≈ 310 ms (estimate) |
| 200 library programs (`local`, a `for` loop, `return`) | 23.5 ms (23.5 26.4 22.3 26.0 22.3) | **≈ 530 ms (estimate:** the Tab One/desktop ratio of the mix, 291/12.9 ≈ 23, times 23.5; to verify, annabell, with a library seed in `?bench=defs`) |

The bar is ≤ 50 ms for the replay inside engine ready < 1.5 s; with the mix, engine ready was 1489 ms. A full library would push engine ready to about 1.73 s. **So the import must not ship before A4a point 2's replay fix.** The cheapest fix for functions, for gorge to verify: **define a user function on first use**, the way our own definitions already load (`host.need()`, `host.ts:247-252`, scans each input for the names it mentions). A function's body is not evaluated when it is defined (defs.ts header, lines 6-8), so deferring the definition changes no value; the start replays values only. Open points for gorge: a function another one calls (scan the body when it is defined, as `restore` already calls `need` per command, `host.ts:276`), and a name reached only through a string (`expr("f(2)")`), which the scan cannot see (to verify, gorge, with a probe).

### 3.3 Vars, Find and a user key
- **Vars and Find:** `userNamesOf` (`defs.ts:123`) → `Calc.names()` (`app/src/calc/engine.ts:81-82`) → `session.userNames` (`app/src/state/session.svelte.ts:244, 290`). No view reads `userNames` yet (no `.svelte` file does; Find is R4a/R4b). Find already has the kind `userfn` and merges live items at query time (`app/src/find/types.ts:5, 55`; `app/src/find/rank.ts:95`). An imported function becomes a live item `{ id: "userfn:beam_M", kind: "userfn", names: ["beam_M"], title: "beam_M(q,L)", desc: <the comment>, syntax: "beam_M(q,L)", insert: "\\operatorname{beam_M}\\left(#0\\right)" }`; Vars filters on `["var", "userfn"]` (types.ts:50). R4b builds this; the only new input is `desc`.
- **The insert must be `\operatorname`:** our parser sends `\operatorname{beam}\left(2,4\right)` as `beam(2,4)`, but the letters typed one by one, `beam\left(2,4\right)`, as `b*exp(1)*a*m*(2,4)` (`node tools/probes/parse.ts`). So Find and the user key are the way to call a library function on the phone, not the Alpha keys: the point of the whole idea.
- **A user key:** a slot holds `{ label, action }` in the yaml form of `spec/keyboard.yaml` (`app/src/keyboard/userKeys.svelte.ts:15-18`), and `{ insert: … }` is a keyboard action already (`app/src/keyboard/keyboard.ts:150`). So `{ label: "M", action: { insert: "\\operatorname{beam_M}\\left(#0\\right)" } }` puts a library function on U1 with no new action type; setting a slot from Find is R4b's.

### 3.4 Export
- The log's functions and exact values are written as a library file: the stamp, then per entry its description (the imported one; for a function typed on the phone, its name and arguments, since there is none) and its commands (`exportLibrary` in the probe). Round trip probe (`… export`): `beam`, `A:=5`, `B:=A*2`, a multi-line `f`, `assume(x>0)` and `C:=evalf(sqrt(2))` typed in CAS export as `beam(q,L):=q*L^2/8`, `A:=(5)`, `B:=(10)` (values, not commands, as the log keeps them, docs/04 6.2), the program as typed, and `C:=(evalf((14142135623731/10^13),15))`; the `assume` entry is left out; the re-import gives `beam(2,4)=4`, `B=10`, `f(3)=10`.
- **A value that holds a float is not exported to a library.** Its mark facts (confirmed digits, decisions M4-7) live in `DefEntry.facts`, and a library has no place for them, so on re-import the value would show more digits than it earned. The backup file (S6, R38a) carries them. The export lists what it left out ("C: a measured value, in the backup only").
- Test lines are not kept on the phone: the laptop file is the source; an export carries definitions and descriptions only.

## 4. The laptop side

| Part | What | Cost | Licence |
|---|---|---|---|
| **The desktop web app as the test bench** | the PWA (or `npm run dev`) in a laptop browser: the same Giac wasm, the same `EngineHost`, so the same values and the same marks; the import and export rows are the phone's, with the file picker and a download | no extra code once the import exists; the engine must be the release build the phone runs (decisions "Bit-reproducible release engine"), which the PWA is | ours, GPL-3.0 |
| **A Node command** `check | run | export` around `app/src/engine/nodeGiac.ts` (which loads the engine in Node and is never bundled, nodeGiac.ts:2) and `EngineHost` | prints each function, its description and its test results, and refuses as the phone would; `tools/probes/library.ts` is the prototype (≈ 200 lines); the real one shares the check code with the app so the two never disagree | ≈ 0.25 d (gorge) once the check code is a module; it needs a built engine (`giac.mjs` + wasm, 9.75 MB, docs/04 6.3), so it runs from a repo checkout; a packaged command for people without one is later (to verify how: an npm tarball built by `build.sh`) | ours, GPL-3.0; the engine it loads is Giac GPL-3.0-or-later, GMP and MPFR LGPL-3.0-or-later, GSL GPL-3.0-or-later (THIRD_PARTY.md:10-13) |
| **An MCP server** (feedback #5b) | the same command as an MCP stdio server: tools `check_library`, `eval`, `cas`, so an AI assistant on the laptop writes a library and runs its tests on the real engine | ≈ 0.5 d; not on the phone, no network (stdio) | the MCP TypeScript SDK `@modelcontextprotocol/sdk`, MIT (to verify: version and licence on npm before use; a new dev dependency with its THIRD_PARTY.md line) |

## 5. The scope question for the owner

**Recommendation: the library carries definitions only (functions and exact values, in and out); settings and the user-key slots travel only in the backup file (S6, R38a/R38b).**
- **Why:** a library is something one writes, reads, tests and shares: plain Giac text with descriptions and tests. Settings and key slots are one device's state; in a shared file they would change someone's digits or rebind their keys on import, which is the surprise principle 3 rules out. The backup is already planned to hold history, definitions, settings and user keys (brief R38a), so nothing is lost: a new phone gets everything from the backup, a colleague gets functions from the library. It also keeps the file format to one concern, and keeps the import's check (section 1.3) the whole safety story.
- **Removal test:** if in the four weeks after it ships the owner has imported a library fewer than twice, the import and export rows go and the backup alone stays (the code is the check module and two rows; the Node command stays as the laptop's test bench).
- **Cost per worker** (after A4a point 2's replay fix, which this needs either way): gorge ≈ 1 d in two packages (the check module and the import through `cas()` with the clash list and the restart on failure; `desc` and `DATA_VERSION` 2; then the Node command); ron ≈ 0.5 d (the import and export rows, the clash confirmation, `desc` in Find's live items inside R4b); annabell ≈ 0 for the picker (S6 decides), ≈ 0.5 d only if "open with" is wanted later. The MCP server is not scheduled.
- **Alternative:** the library may also carry settings and the user-key slots (a `// key: U1 beam_M` line). One line: it saves one manual key assignment per function, at the cost of a second format concern and a confirmation for every setting a file changes.
- **What would change it:** the owner wants to share a whole keyboard set-up with others (then a `// key:` line, still never settings); or S6 finds the file picker unusable in the WebView (then "open with" comes first and annabell's share grows); or the lazy definition of 3.2 fails, so 200 programs cannot replay within the bar (then the per-file limit drops to what the Tab One replays in the budget).
