<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- R59: the text Settings › Data › Library › Copy the format for your AI copies whole (views/libraryJobs.ts aiFormat):
     `{version}` becomes DATA_VERSION, and these comment lines are left out. views/aiFormat.test.ts imports the worked
     example on the real engine, so the copied text never lies. Rules: engine/library.ts, docs/archive/r10-connector.md 1. -->
# N62 file formats (text 1, for files of version {version})

You are writing a file for N62, a calculator app for engineers whose engine is Giac (the CAS of Xcas). Write only what this text allows. The app checks the whole file before it changes anything, and refuses all of it at the first problem, with the line number.

## Part 1: a library of functions and values

### The lines
- Line 1 is exactly `// n62 library {version}`.
- A definition starts at column 0 and is `name(args):=body` (a function) or `name:=value` (a named value).
- A definition goes on over the next lines while a bracket is still open, or while the next line is indented or starts with a closing bracket. So a program in `{ … }` with `local`, `for`, `if` and `return` works.
- One definition per block: nothing may follow a top-level `;`.
- Every other line is a comment (`// …`) or blank. Every line is valid Giac, so the same file runs in Xcas.

### Names
- ASCII letters, digits and `_`, starting with a letter; each name once per file.
- Not a Giac built-in (`sq`, `Beta`, `median`, …): the app refuses it and says which.
- Not one of N62's own names: the `pasc_` prefix, a name that ends in `_`, and its helpers such as `pasmod`, `sigfig` and `pasdeg`.
- A name the user already defined differently is listed, and replaced only once the user agrees.

### The description
- The comment line directly above each definition is its description: required, one line, at most 120 characters, any characters (`²`, `·`). It is what the user reads in Find.

### Test lines
- `// test: <expression>` after a definition, as many as you like. After the whole file is defined, each must give `true` (or 1), or the file is refused.
- One expression per test. A test must not assign a name or change a setting.
- Tests run on plain Giac: in radians, without N62's exact-first evaluation. Write exact values (`2+2+8/3`, `5/2`) and a tolerance where a float is involved (`abs(f(2)-1.234) < 1e-9`). A test is a guard, not a proof.
- Giac's `==` between symbolic expressions compares their form: write `simplify(a - b) == 0`, not `a == b`.

### Bodies and values
- Raw Giac in radians: `sin(x)` takes radians; the app follows the user's angle mode when the function is called.
- A decimal such as `9.81` is a Giac float. Write an exact constant as a fraction: `980665/100000`.
- A body assigns only its parameters and names declared with `local`. A value assigns nothing.
- Nothing may change the engine's state: no setting (`Digits`, `angle_radian`, …), no `purge`, `restart`, `assume`, `read`, `write`, `sto`, `=>`, and no string that Giac evaluates (`expr("…")`).

### What refuses a file
- A missing first line, or a version newer than {version}.
- Not UTF-8 text; over 256 kB; over 200 definitions; or more than 500 definitions together with the user's own.
- A line at column 0 that is not a comment, a blank line or a definition (`assume(x>0)`, `1+1`).
- A second statement after `;`; a bracket never closed; an indented line outside a definition; a test line before any definition.
- A body or value that changes the engine's state or assigns a name that is not local.
- A built-in name, one of N62's own names, the same name twice.
- A definition without its description, or a description over 120 characters.
- A test that does not give `true`.

### Worked example
```text
// n62 library {version}
// Maximum bending moment of a simply supported beam under a uniform load q over span L: q·L²/8
beam_M(q,L):=q*L^2/8
// test: beam_M(2,4) == 4
// test: simplify(beam_M(q,2*L) - 4*beam_M(q,L)) == 0

// Sum of a^k/k for k = 1..n (a program with local names and a loop)
sumpow(a,n):={
  local s,k;
  s:=0;
  for (k:=1;k<=n;k++) { s:=s+a^k/k; }
  return s;
}
// test: sumpow(2,3) == 2+2+8/3

// The middle value of a list of numbers
middle(l):=median(l)
// test: middle([1,2,3,4]) == 5/2

// Standard gravity in m/s² (exact, CGPM 1901)
g0:=980665/100000
// test: abs(g0-9.80665) < 1e-12
```

## Part 2: the backup file (keys, unit pad cells and presets)

The backup is one JSON file. It holds the app's own stored records, so you write only the three parts below and leave every other part out (`settings`, `history`, `defs` and the rest belong to the app). The user restores the file under Settings › Data › Restore from a file. The app checks the whole file first and refuses all of it at the first problem, naming the part; a restore that passes first keeps what it replaces, for one Undo.

### The envelope
- Strict JSON, UTF-8, at most 4 MB.
- `"n62-backup"`: the whole number `1`.
- `"dataVersion"` (`{version}`) and `"made"` (an ISO date-time) are information; write them.
- `"parts"`: an object with any of `userKeys`, `unitPadCells`, `presets`. A file with only one of them is a valid backup. Any other part name is accepted only if the app writes it itself; do not write one.
- Each part is `{ "@n62": {version}, "value": … }`. `"@n62"` is the version of the record: a whole number from 0 to {version}, and you write {version}. A larger number is refused.
- A ticked part replaces the app's whole part, not a piece of it: slots the file does not hold go back to their defaults. To keep what the user has, work from their own backup file (Settings › Data › Save a backup) and change only these parts; the user unticks the other parts in the restore sheet.

### Part `userKeys`: the six free keys
- `value` is an object whose keys are `u1` … `u6`. Each holds up to three slots, named by layer: `primary` (the tap), `shift` (a flick up) and `alpha` (a flick down).
- A slot is `{ "label": "…", "action": { … } }`, or `null` to empty that slot. A slot that is not written keeps its default (empty).
- `label`: non-empty text, drawn on the key; keep it to a few characters.
- `action`: an object with exactly one of these four fields (the app's own `sample`, `chip`, `units` and `line` extras are accepted but not meant for you, so do not write them):
  - `"insert"`: a LaTeX template put into the line. `#0` is the place for the main argument: what the user selected, else an empty placeholder where the cursor goes. A function you defined is `"\\operatorname{name}\\left(#0\\right)"`, never loose letters (those read as a product of letters); a built-in is as in `"\\sinh\\left(#0\\right)"`. These are JSON strings, so every backslash is doubled.
  - `"type"`: text typed as if by the keys, such as `"mol"`.
  - `"special"`: a place or sheet, one of `"home"`, `"cas"`, `"settings"`, `"mode"`, `"units"`, `"find"`, `"vars"`, `"memory"`, `"none"`.
  - `"cmd"`: an editing command of the entry field; do not write it.
- An empty tap slot is a dead key. Any other field is refused.

### Part `unitPadCells`: the unit pad's user cells
- While a unit slot is open, U1–U6 become unit cells. `value` is an object whose keys are `u1` … `u6`; each holds up to three legs: `tap`, `up` (a flick up) and `down` (a flick down).
- A leg is `{ "unit": "…" }` with an optional `"prefix": "…"` and an optional `"label": "…"`, or `null` to empty the leg. A leg that is not written keeps its default.
- `unit`: the id of the unit as the pad and Find write it, such as `N`, `Pa`, `m`, `s`, `L`, `ohm`, `oC`. `prefix`: the id of an SI prefix such as `k`, `M`, `G`, `m` (milli), `u` (micro), `n`. kN is `"unit": "N"` with `"prefix": "k"`; mm is `"unit": "m"` with `"prefix": "m"`.
- `label`: the text drawn on the cell, only where the ids would not draw what you want. All three are non-empty text. The check does not look the ids up: use only ids the pad or Find has.

### Part `presets`: named sets of settings
- `value` is `{ "presets": [ … ], "active": null, "next": N }`.
- A preset is `{ "id": n, "name": "…", "groups": { … } }`. `id`: a whole number from 1, each once. `name`: non-empty, each once (capitals and outer spaces do not tell two names apart). `next`: a whole number greater than every id. `active`: `null`, or the id of the preset to show as the last one applied.
- `groups` holds at least one of the groups below, each an object of the fields it sets. Applying a preset sets the fields it holds and leaves every other setting alone. A field with a value the app cannot read is left alone. Write only the fields listed here.
- `mode`: `angle` = "rad" or "deg"; `format` = "std", "sci", "eng" or "pfx"; `digits` = a whole number from 1 to 30; `entry` = "textbook" or "line".
- `numbers`: `decimalMark` = "point" or "comma"; `fixDecimals` = a whole number from 0 to 12; `uncertainty` = "sigma" or "muted"; `marks` = "muted", "colour" or "reason"; `groupSep` = "thin", "apos" or "comma".
- `look`: `family` = "n62", "teal" or "solarized"; `brightness` = "system", "light" or "dark"; `contrast` = true or false; `plain` = true or false.
- `vibration`: `on` = true or false; `strength` = a whole number from 0 to 100; `ms` = a whole number from 5 to 100.
- `keys`: `userKeys` and `unitPadCells`, each exactly the `value` of the part of that name above. Applying the preset puts those slots and cells on the keys.

### What refuses a file
- Not JSON, not UTF-8, over 4 MB, no `"n62-backup"`, or a format number above 1.
- A part name the app does not know, a part without `"@n62"` or `"value"`, or a stamp that is not a whole number from 0 to {version}.
- A key id other than `u1` … `u6`, a layer other than `primary`, `shift` and `alpha`, a leg other than `tap`, `up` and `down`.
- A slot with an empty label or an action the keypad does not know; a leg without a non-empty `unit`; an empty `prefix` or `label`.
- Presets: an id or name used twice, a missing or empty name, groups that are empty or not objects of objects, `active` naming no preset, `next` not greater than every id.

### Worked example of a backup
```json
{
  "n62-backup": 1,
  "dataVersion": {version},
  "made": "2026-11-05T12:00:00.000Z",
  "parts": {
    "userKeys": {
      "@n62": {version},
      "value": {
        "u1": {
          "primary": { "label": "sinh", "action": { "insert": "\\sinh\\left(#0\\right)" } },
          "shift": { "label": "mol", "action": { "type": "mol" } },
          "alpha": null
        },
        "u2": { "primary": { "label": "Home", "action": { "special": "home" } } }
      }
    },
    "unitPadCells": {
      "@n62": {version},
      "value": {
        "u1": { "tap": { "unit": "N", "prefix": "k" }, "up": { "unit": "Pa", "prefix": "M" } },
        "u2": { "tap": { "unit": "m", "prefix": "m" }, "down": null }
      }
    },
    "presets": {
      "@n62": {version},
      "value": {
        "presets": [
          {
            "id": 1,
            "name": "Lab",
            "groups": {
              "mode": { "angle": "deg", "format": "eng", "digits": 6 },
              "numbers": { "decimalMark": "comma", "marks": "reason" },
              "keys": {
                "userKeys": { "u1": { "primary": { "label": "sinh", "action": { "insert": "\\sinh\\left(#0\\right)" } } } },
                "unitPadCells": { "u1": { "tap": { "unit": "N", "prefix": "k" } } }
              }
            }
          }
        ],
        "active": null,
        "next": 2
      }
    }
  }
}
```
