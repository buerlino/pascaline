<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# S4 report: the laptop connection (sandra, 2026-10-18, branch `p1/sandra-connector`)

## Recommendation (for the owner)
**A library file carries definitions only: functions and exact values, imported and exported. Settings and the user-key slots stay in the backup file** (S6, R38a/R38b).
Why: a library is written, tested and shared, while settings and key slots belong to one device; a shared file that changed someone's digits or rebound their keys on import would be a surprise (principle 3), and the backup already carries them. Cost, removal test and what would change it: decisions.md "Needs the user", "2026-10-18 S4: what a library file carries"; evidence in `docs/archive/r10-connector.md` section 5.

## Done (against "Done when")
- `docs/archive/r10-connector.md` has sections 1–5. Every claim about today's code cites `file:line` or a probe run. Nothing under `app/` or `android/` changed.
- New probe `tools/probes/library.ts` and its files in `tools/probes/library/` (`beams.txt` is accepted with 4 definitions and 5 tests passing; thirteen bad files are each refused for their one reason). Commands: `check <file>`, `replay`, `export`. There is a row in `tools/probes/README.md`.
- The backlog line is ticked ("The laptop connection"). decisions.md "Needs the user" has "2026-10-18 S4: what a library file carries".

## What I verified (dev engine, desktop, 2026-10-18)
- `//` is a Giac comment, so a library file is valid Giac as it stands. Multi-line programs with `local`/`for`/`return` define and run.
- Engine state that a definition can change without the log seeing it:
  - `r(x):=x;s:=3` also sets s.
  - Inside a body, `Digits:=5` stays set after the call.
  - Inside a body, `purge(beam)` removes beam from the engine.
  - `read("f")` aborted the wasm module.
  - `write` is refused by Giac's secure mode.
  - Giac warns about a body's global assignments.
- `type(name)` is `func` for Giac built-ins. `sq` and `Beta` are built-ins that a library would otherwise shadow without warning. Our own lazily loaded names (`sigfig`, `pasmod`) read as `identifier`, so they need their own list.
- Giac's `==` is structural on symbolic expressions (`beam_M(q,2*L) == 4*beam_M(q,L)` is false; `simplify(…-…)==0` is true). Between a float and an exact value it compares at float precision (`evalf(1/3)==1/3` is true).
- Replay of 200 definitions, desktop median of 5:
  - the `?bench=defs` mix: 12.9 ms
  - 200 one-line functions: 13.9 ms
  - 200 programs: 23.5 ms
- Today `applyDefChanges` drops the oldest entries silently past 500 (`defs.ts:65`). `validDefs` drops unknown fields (`defs.ts:87-110`).
- The parser sends `\operatorname{beam}(2,4)` as `beam(2,4)`, but letters typed one by one become `b*exp(1)*a*m*(2,4)`.
- Capacitor 8.5.3's `onShowFileChooser` opens Android's picker with no permission (`BridgeWebChromeClient.java:276-301, 375-386`).

## Top risks
1. **The replay time.** 200 library programs would take about 530 ms on the Tab One (an estimate scaled from A4a's 291 ms), so engine ready would be about 1.73 s against the 1.5 s bar. The import must wait for A4a point 2's fix. My proposed fix is to define a user function on its first use, the way `host.need()` already works; gorge needs to verify it.
2. **The state-word list is a guard, not a proof.** It stops the probed cases. The engine's cancel path and memory cap remain the backstop.
3. **The import waits on S6.** The file picker in WebView 131 has not been checked yet; S6 point 2 does that.

## Still to verify, who and how
- Tab One replay of a library seed: annabell, `?bench=defs` with 200 programs.
- Lazy definition of user functions, including functions that call each other and `expr("f(2)")`: gorge, with a probe.
- Whether the picker opens in WebView 131 and the keyboard stays closed, and whether "open with" can match by MIME: S6.
- The licence and version of `@modelcontextprotocol/sdk`: whoever builds the MCP server, before use.
