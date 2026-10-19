// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (G50, deep check 2026-10-19 D9–D11): the audited functions on complex arguments, in RAD, and in DEG at 12 digits
// (G46: the input with the parser's degree factor, `sin(pasdeg*(z))`, `asin(z)/pasdeg`; mpmath reads z° = z·π/180).
//   node tools/probes/complex-audit.ts            # Home at 12, 30 and 50 digits: every shown digit right, or a gap
//   node tools/probes/complex-audit.ts --raw      # also Giac's own evalf at Digits 12, 40 and 60 (the deep check's sweep)
//   node tools/probes/complex-audit.ts --all      # print every row, not only the gaps
// Each function × 12 complex arguments goes through EngineHost.home as the app calls it, and its shown text (display)
// and its copied text (full, every confirmed digit up to P) are compared with mpmath at 100 digits
// (tests/golden/.venv; PASCALINE_VENV overrides). A row is right when every digit of both texts is the true value
// rounded; a gap is any other row (a ⚠ that shows a wrong digit is a gap too). --raw counts the right digits of
// Giac's evalf: those are Giac's routines, which Home must not trust where they are short or wrong.
// Engine: $GIAC_MJS, else $GIAC_OUT/giac.mjs, else engine/giac/_out/gsl (app/src/engine/nodeGiac.ts).
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EngineHost } from "../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings } from "../../app/src/engine/homeEval.ts";
import { ANGLE_IN, ANGLE_OUT, rewriteAngles } from "../../app/src/input/angles.ts";
import { markOf } from "../../app/src/engine/format.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const args = process.argv.slice(2);
const raw = args.includes("--raw");
const all = args.includes("--all");

/** The audited functions that are analytic (or abs, arg, sign) on ℂ: Giac name → mpmath expression of z. floor, ceil,
 *  round, frac, max and min have no complex meaning to audit; re, im and conj are exact. */
const FUNCTIONS: Record<string, string> = {
  sqrt: "sqrt(z)", exp: "exp(z)", ln: "log(z)", log: "log(z)", log10: "log10(z)",
  sin: "sin(z)", cos: "cos(z)", tan: "tan(z)", asin: "asin(z)", acos: "acos(z)", atan: "atan(z)",
  sinh: "sinh(z)", cosh: "cosh(z)", tanh: "tanh(z)", asinh: "asinh(z)", acosh: "acosh(z)", atanh: "atanh(z)",
  abs: "fabs(z)", arg: "arg(z)", sign: "z/fabs(z)",
};
/** Twelve complex arguments: Giac text → mpmath text. Imaginary axis (both sides of the inverse functions' cuts),
 *  the four quadrants, small and large parts. */
const ARGS: Record<string, string> = {
  // i is a pole of atan: no number is right there.
  "i": "mpc(0,1)", "i/2": "mpc(0,F(1,2))", "2*i": "mpc(0,2)", "-3*i": "mpc(0,-3)",
  "1+i": "mpc(1,1)", "-1+i": "mpc(-1,1)", "1/2+i/3": "mpc(F(1,2),F(1,3))", "-2-3*i": "mpc(-2,-3)",
  "3-i/2": "mpc(3,F(-1,2))", "1/10+5*i": "mpc(F(1,10),5)", "5+10*i": "mpc(5,10)", "-1/1000+i/1000": "mpc(F(-1,1000),F(1,1000))",
};
const HOME_DIGITS = [12, 30, 50];
const RAW_DIGITS = [12, 40, 60];

function python(): string {
  const env = process.env.PASCALINE_VENV;
  const tries = [env && join(env, "bin/python"), join(root, "tests/golden/.venv/bin/python")];
  // In a worktree the venv lives in the main checkout.
  try {
    const common = execFileSync("git", ["-C", root, "rev-parse", "--git-common-dir"], { encoding: "utf8" }).trim();
    tries.push(join(dirname(resolve(root, common)), "tests/golden/.venv/bin/python"));
  } catch {
    // not a git checkout
  }
  const p = tries.find((t): t is string => !!t && existsSync(t));
  if (!p) throw new Error("no oracle venv: set it up as in tests/golden/README.md, or set PASCALINE_VENV");
  return p;
}

/** One complex text to check: Giac-style (`a+b*i`, `a-b*i`, `b*i`, `a`, E exponents, `0.-000…`). */
interface Check {
  key: string;
  f: string;
  z: string;
  text: string;
  /** Digits the text claims (Home) or null (raw: count the right digits). */
  claim: boolean;
}

// The oracle and the comparison run in Python (mpmath): each text is parsed, then checked part by part.
const PY = String.raw`
import sys, json, re
import mpmath as mp
from mpmath import pi, mpf, mpc, sqrt, exp, log, log10, sin, cos, tan, asin, acos, atan, sinh, cosh, tanh, asinh, acosh, atanh, fabs, arg
mp.mp.dps = 100
def F(p, q): return mpf(p) / q
NUM = r'[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?'
def parse(t):
    t = t.replace(' ', '').replace('0.-0', '-0.0')
    m = re.fullmatch(r'([+-]?)(' + NUM.lstrip('[+-]?') + r')?\*?i', t)
    if m: return None, (m.group(1) or '') + (m.group(2) or '1')
    m = re.fullmatch(r'(' + NUM + r')([+-])(' + NUM.lstrip('[+-]?') + r')?\*?i', t)
    if m: return m.group(1), m.group(2) + (m.group(3) or '1')
    m = re.fullmatch(NUM, t)
    if m: return t, None
    return None
def sig(s):
    d = re.sub(r'[eE].*$', '', s).lstrip('+-').replace('.', '').lstrip('0')
    return len(d)
def right(s, true):
    # every digit of s is the true value rounded to that many significant digits (s as Giac or we print it)
    v = mpf(s)
    n = max(1, sig(s))
    if true == 0: return v == 0
    if v == 0: return False
    e = mp.floor(mp.log10(abs(true)))
    ulp = mpf(10) ** (e - n + 1)
    return abs(v - true) <= ulp / 2 * (1 + mpf(10)**-20) or (abs(v - true) <= ulp / 2 * 1.000001)
def digits_right(s, true):
    v = mpf(s)
    if true == 0: return 100 if v == 0 else 0
    if v == true: return 100
    return max(0, int(mp.floor(-mp.log10(abs(v - true) / abs(true)))))
out = {}
for c in json.loads(sys.stdin.read()):
    z = eval(c['zpy'])
    w = mpc(eval(c['fpy']))
    p = parse(c['text'])
    if not (mp.isfinite(w.real) and mp.isfinite(w.imag)):
        # a pole (atan(i)): right when no number is shown
        out[c['key']] = {'ok': p is None, 'why': '' if p is None else 'a number at a pole', 'digits': 100 if p is None else 0}
        continue
    if p is None:
        out[c['key']] = {'ok': False, 'why': 'unreadable', 'digits': 0}
        continue
    a, b = p
    parts = [(a or '0', w.real, a is not None), (b or '0', w.imag, b is not None)]
    if c['claim']:
        bad = [s for s, t, shown in parts if not right(s, t)]
        out[c['key']] = {'ok': not bad, 'why': ('wrong ' + ','.join(bad)) if bad else '', 'digits': 0}
    else:
        v = mpc(mpf(parts[0][0]), mpf(parts[1][0]))
        n = 100 if v == w else (0 if w == 0 else max(0, int(mp.floor(-mp.log10(abs(v - w) / abs(w))))))
        out[c['key']] = {'ok': True, 'why': '', 'digits': n}
print(json.dumps(out))
`;

const { giac } = await loadNodeGiac();
const host = new EngineHost(giac);
const checks: (Check & { fpy: string; zpy: string })[] = [];
const rows: { f: string; z: string; where: string; mark: string; display: string; keys: string[] }[] = [];

for (const [f, fpy] of Object.entries(FUNCTIONS)) {
  for (const [z, zpy] of Object.entries(ARGS)) {
    const input = `${f}(${z})`;
    const fz = fpy.replaceAll("z", "(z)");
    for (const d of HOME_DIGITS) {
      const r = host.home(input, { ...defaultHomeSettings, digits: d, angle: "rad", workDigits: Math.max(30, d + 10) }).result;
      const m = r.ok ? markOf(r, { format: "STD", digits: d }) : null;
      const mark = m ? `${m.mark}${m.n !== undefined ? ` ${m.n}` : ""}` : "-";
      // `full` is the exact text when Giac's exact result is kept (sqrt(2)/2*(1+i)); only a decimal is compared.
      const keys = [`${input}|${d}|display`, ...(r.full === r.exact ? [] : [`${input}|${d}|full`])];
      checks.push({ key: keys[0]!, f, z, text: r.display, claim: true, fpy: fz, zpy });
      if (keys[1]) checks.push({ key: keys[1], f, z, text: r.full, claim: true, fpy: fz, zpy });
      rows.push({ f, z, where: `home ${d}`, mark, display: r.display, keys });
    }
    {
      // G46: DEG, as typed (the parser's factor); an angle in is z·π/180, an angle out is over π/180 (S14's reading)
      const d = 12;
      const typed = rewriteAngles(input);
      const r = host.home(typed, { ...defaultHomeSettings, digits: d, angle: "deg", workDigits: 30 }).result;
      const m = r.ok ? markOf(r, { format: "STD", digits: d }) : null;
      const mark = m ? `${m.mark}${m.n !== undefined ? ` ${m.n}` : ""}` : "-";
      const fdeg = Object.hasOwn(ANGLE_IN, f) ? fpy.replaceAll("z", "((z)*pi/180)") : ANGLE_OUT.has(f) ? `(${fz})*180/pi` : fz;
      const keys = [`${input}|deg|display`, ...(r.full === r.exact ? [] : [`${input}|deg|full`])];
      checks.push({ key: keys[0]!, f, z, text: r.display, claim: true, fpy: fdeg, zpy });
      if (keys[1]) checks.push({ key: keys[1], f, z, text: r.full, claim: true, fpy: fdeg, zpy });
      rows.push({ f, z, where: `deg ${d}`, mark, display: r.display, keys });
    }
    if (raw) {
      for (const D of RAW_DIGITS) {
        giac.eval(`Digits:=${D}`);
        const t = giac.eval(`evalf(${input})`);
        giac.eval("Digits:=12");
        const key = `${input}|raw${D}`;
        checks.push({ key, f, z, text: t, claim: false, fpy: fz, zpy });
        rows.push({ f, z, where: `giac ${D}`, mark: "", display: t, keys: [key] });
      }
    }
  }
}

const verdict = JSON.parse(
  execFileSync(python(), ["-I", "-c", PY], { input: JSON.stringify(checks.map(({ key, text, claim, fpy, zpy }) => ({ key, text, claim, fpy, zpy }))), encoding: "utf8", maxBuffer: 64 << 20 }),
) as Record<string, { ok: boolean; why: string; digits: number }>;

let gaps = 0;
let homeRows = 0;
const short: string[] = [];
for (const row of rows) {
  const v = row.keys.map((k) => verdict[k]!);
  if (row.where.startsWith("giac")) {
    const D = Number(row.where.slice(5));
    const n = v[0]!.digits;
    if (n < Math.min(D, 100) - 2) short.push(`${row.f}(${row.z}) Digits ${D}: ${n} right digits`);
    if (all) console.log(`${row.where}  ${row.f}(${row.z})  ${n >= 100 ? "exact" : `${n} right`}  ${row.display.slice(0, 60)}`);
    continue;
  }
  homeRows++;
  const ok = v.every((x) => x.ok);
  if (!ok) gaps++;
  if (!ok || all) {
    const why = v.map((x, k) => (x.ok ? "" : `${k ? "full" : "display"} ${x.why}`)).filter(Boolean).join("; ");
    console.log(`${ok ? "ok " : "GAP"} ${row.where}  ${row.f}(${row.z})  ${row.mark}  ${row.display}${why ? `  (${why.slice(0, 120)})` : ""}`);
  }
}
if (raw) {
  console.log(`\nGiac's evalf short of Digits (more than 2 digits): ${short.length}`);
  for (const s of short) console.log(`  ${s}`);
}
console.log(`\nHome: ${homeRows} rows (${Object.keys(FUNCTIONS).length} functions × ${Object.keys(ARGS).length} arguments × digits ${HOME_DIGITS.join(", ")} in RAD, and 12 in DEG), ${gaps} gaps`);
process.exitCode = gaps ? 1 : 0;
