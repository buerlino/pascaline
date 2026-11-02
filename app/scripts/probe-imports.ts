// SPDX-License-Identifier: GPL-3.0-or-later
// G144: the probes' import check, part of `npm run typecheck`. tools/probes is outside the app's strict tsconfig, so a probe could import
// a name its module no longer exports (tools/probes/bridge.ts imported splitList from numeric.ts for four weeks) and nobody noticed until
// Node said `SyntaxError: The requested module ... does not provide an export named ...`. This checks only that class: every relative
// import of a tools/probes/**/*.{ts,mts,mjs,js} file names a module that exists and, for each value name (not `type`), exports it as a
// value. It reads exports with the compiler's checker (re-exports, `export *`) and reports no other type error.
//   node scripts/probe-imports.ts            # exit 1 on a failing import not in KNOWN
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/** Probe files whose imports are known to fail until their package fixes them: "<path from the repo root>" -> why. A listed file that now passes fails the check ("now passing"). */
export const KNOWN: Readonly<Record<string, string>> = {};

export interface ImportFailure {
  file: string;
  line: number;
  spec: string;
  problem: string;
}

/** The failing relative imports of `files` (absolute paths). */
export function checkImports(files: readonly string[]): ImportFailure[] {
  const program = ts.createProgram([...files], {
    allowJs: true,
    noEmit: true,
    noLib: true,
    types: [],
    skipLibCheck: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowImportingTsExtensions: true,
  });
  const checker = program.getTypeChecker();
  const out: ImportFailure[] = [];
  for (const file of files) {
    const sf = program.getSourceFile(file);
    if (!sf) continue;
    for (const st of sf.statements) {
      if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier)) continue;
      const spec = st.moduleSpecifier.text;
      if (!spec.startsWith(".")) continue;
      const line = sf.getLineAndCharacterOfPosition(st.getStart()).line + 1;
      const fail = (problem: string): void => void out.push({ file, line, spec, problem });
      const target = resolve(dirname(file), spec);
      if (!existsSync(target)) {
        fail("no such file");
        continue;
      }
      const mod = checker.getSymbolAtLocation(st.moduleSpecifier);
      if (!mod) continue; // a file TypeScript does not read as a module (.svelte, .json, .yaml)
      const clause = st.importClause;
      if (!clause || clause.isTypeOnly) continue;
      const exported = new Map(checker.getExportsOfModule(mod).map((s) => [s.name, s]));
      const names: string[] = [];
      if (clause.name) names.push("default");
      if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const el of clause.namedBindings.elements) if (!el.isTypeOnly) names.push((el.propertyName ?? el.name).text);
      }
      for (const name of names) {
        const sym = exported.get(name);
        if (!sym) {
          fail(`${spec} does not export ${name}`);
          continue;
        }
        const real = sym.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(sym) : sym;
        // a type has no value to import under Node (an interface or type alias); an unresolvable alias is not judged here
        if (real.flags !== ts.SymbolFlags.None && !(real.flags & ts.SymbolFlags.Value) && real.name !== "unknown") fail(`${spec} exports ${name} as a type only`);
      }
    }
  }
  return out;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const files = execFileSync("git", ["ls-files", "tools/probes"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter((f) => /\.(ts|mts|mjs|js)$/.test(f))
    .map((f) => resolve(root, f));
  const failures = checkImports(files);
  const rel = (f: string): string => relative(root, f);
  const bad = failures.filter((f) => !(rel(f.file) in KNOWN));
  for (const f of bad) console.log(`probe import: ${rel(f.file)}:${f.line}: ${f.problem}`);
  const failing = new Set(failures.map((f) => rel(f.file)));
  const passing = Object.keys(KNOWN).filter((k) => !failing.has(k));
  for (const k of passing) console.log(`probe import: ${k} now passes: remove it from KNOWN in app/scripts/probe-imports.ts`);
  const known = failing.size - new Set(bad.map((f) => rel(f.file))).size;
  console.log(`probe imports: ${files.length} files, ${bad.length} failing imports, ${known} known files, ${passing.length} now passing`);
  process.exit(bad.length || passing.length ? 1 : 0);
}
