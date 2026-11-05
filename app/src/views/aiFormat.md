<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- R59: the text Settings › Data › Library › Copy the format for your AI copies whole (views/libraryJobs.ts aiFormat):
     `{version}` becomes DATA_VERSION, and these comment lines are left out. views/aiFormat.test.ts imports the worked
     example on the real engine, so the copied text never lies. Rules: engine/library.ts, docs/archive/r10-connector.md 1. -->
# Pascaline file formats (text 1, for files of version {version})

You are writing a file for Pascaline, a calculator app for engineers whose engine is Giac (the CAS of Xcas). Write only what this text allows. The app checks the whole file before it changes anything, and refuses all of it at the first problem, with the line number.

## Part 1: a library of functions and values

### The lines
- Line 1 is exactly `// pascaline library {version}`.
- A definition starts at column 0 and is `name(args):=body` (a function) or `name:=value` (a named value).
- A definition goes on over the next lines while a bracket is still open, or while the next line is indented or starts with a closing bracket. So a program in `{ … }` with `local`, `for`, `if` and `return` works.
- One definition per block: nothing may follow a top-level `;`.
- Every other line is a comment (`// …`) or blank. Every line is valid Giac, so the same file runs in Xcas.

### Names
- ASCII letters, digits and `_`, starting with a letter; each name once per file.
- Not a Giac built-in (`sq`, `Beta`, `median`, …): the app refuses it and says which.
- Not one of Pascaline's own names: the `pasc_` prefix, a name that ends in `_`, and its helpers such as `pasmod`, `sigfig` and `pasdeg`.
- A name the user already defined differently is listed, and replaced only once the user agrees.

### The description
- The comment line directly above each definition is its description: required, one line, at most 120 characters, any characters (`²`, `·`). It is what the user reads in Find.

### Test lines
- `// test: <expression>` after a definition, as many as you like. After the whole file is defined, each must give `true` (or 1), or the file is refused.
- One expression per test. A test must not assign a name or change a setting.
- Tests run on plain Giac: in radians, without Pascaline's exact-first evaluation. Write exact values (`2+2+8/3`, `5/2`) and a tolerance where a float is involved (`abs(f(2)-1.234) < 1e-9`). A test is a guard, not a proof.
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
- A built-in name, one of Pascaline's own names, the same name twice.
- A definition without its description, or a description over 120 characters.
- A test that does not give `true`.

### Worked example
```text
// pascaline library {version}
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
// test: g0 == 9.80665
```
<!-- Part 2, the backup file: R126 writes it here. -->
