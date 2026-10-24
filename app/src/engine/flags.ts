// SPDX-License-Identifier: GPL-3.0-or-later
// G67 (H1, bug hunt N1/N2): Giac's global settings, which user text can change (`approx_mode:=1`, `angle_radian:=0`,
// `integer_format(16)`, `cas_setup(…)`, `xcas_mode(1)`) and which then leak into every later result: Home's `=` marks,
// the angle of sin(1), hex integers. G102: the host reads them after every call that ran user text through bridge-1
// (`giac_ctx_get`, bridge.ts GiacContext), compares them field by field with hostContext, and on any difference puts the
// whole context back with one `giac_ctx_set` and runs its mode setup again. The definitions log never stores one
// (host.ts defsAfter). Plain data and pure functions; only erasable TypeScript syntax, so Node runs this file directly.
import type { GiacContext } from "./bridge.ts";

/** The host's context at `digits` (the mode's Digits): a fresh engine's (giac-2.1.0, probe 2026-10-24; flags.test.ts
 *  checks it against a fresh engine), Giac in radians (the degree mode is our parser's pasdeg factor, G46). */
export function hostContext(digits: number): GiacContext {
  return {
    angle_mode: 0,
    angle_radian: true,
    approx_mode: false,
    complex_mode: false,
    complex_variables: false,
    integer_format: 0,
    scientific_format: 0,
    decimal_digits: Math.trunc(digits),
    epsilon: 1e-12,
    increasing_power: false,
    all_trig_sol: false,
    xcas_mode: 0,
    calc_mode: 0,
    python_compat: 0,
    integer_mode: true,
    withsqrt: true,
    keep_algext: false,
    auto_assume: false,
    parse_e: false,
    convert_rootof: true,
    ntl_on: true,
    step_infolevel: 0,
    proba_epsilon: 1e-15,
    eval_level: 25,
    prog_eval_level: 1,
    autosimplify: "regroup",
  };
}

/** The fields where `got` is not `want`. Giac keeps epsilon as its own float (set to 1e-12 it reads
 *  9.999999999999965e-13), so a float field compares to 1e-9 relative; autosimplify holds the text it was given
 *  (`'regroup'` after a set, `regroup` fresh: the same setting, G85), so it is the same with or without quotes. */
export function contextDiff(got: GiacContext, want: GiacContext): (keyof GiacContext)[] {
  return (Object.keys(want) as (keyof GiacContext)[]).filter((k) => {
    const g = got[k];
    const w = want[k];
    if (typeof w === "string") return g !== w && g !== `'${w}'`;
    if (typeof w === "number" && typeof g === "number" && !Number.isInteger(w)) return !(Math.abs(g - w) <= Math.abs(w) * 1e-9);
    return g !== w;
  });
}

/**
 * Giac's words that set a global setting: the `name:=value` flags of its lexer (input_lexer.cc, T_DIGITS), the setters
 * of the context bridge-1 reads, and the ones it cannot read but the mode setup puts back (`timeout`, `ckevery`). A name here is
 * never a user's variable or function in the definitions log, and a library may not use it (library.ts STATE_WORDS).
 */
export const FLAG_WORDS: readonly string[] = [
  "approx_mode", "complex_mode", "complex_variables", "angle_radian", "Digits", "DIGITS", "epsilon", "proba_epsilon",
  "scientific_format", "integer_format", "increasing_power", "all_trig_solutions", "all_trig_sol", "with_sqrt",
  "integer_mode", "xcas_mode", "maple_mode", "python_compat", "calc_mode", "keep_algext", "parse_e", "convert_rootof",
  "step_infolevel", "eval_level", "prog_eval_level", "autosimplify", "auto_assume", "ntl_on", "threads",
  "HAngle", "HComplex", "HDigits", "HFormat", "HLanguage", "set_language", "cas_setup", "timeout", "ckevery",
];

const FLAG_RE = new RegExp(`(?<![A-Za-z0-9_])(?:${FLAG_WORDS.join("|")})(?![A-Za-z0-9_])`);
/** Settings the read cannot see: an input that names one gets the mode setup again after it (timeout, ckevery). */
const UNREAD_RE = /(?<![A-Za-z0-9_])(?:timeout|ckevery)(?![A-Za-z0-9_])/;

const noStrings = (s: string): string => s.replace(/"[^"]*"/g, '""');

/** The text names a Giac setting (outside strings). */
export function namesFlag(text: string): boolean {
  return FLAG_RE.test(noStrings(text));
}

/** The first Giac setting the text names (outside strings), or null. */
export function flagIn(text: string): string | null {
  return FLAG_RE.exec(noStrings(text))?.[0] ?? null;
}

/** The text names a setting the read cannot see, which only the mode setup puts back. */
export function namesUnreadFlag(text: string): boolean {
  return UNREAD_RE.test(noStrings(text));
}

/** Whether a name is a Giac setting (a log entry by that name is never kept). */
export function isFlagName(name: string): boolean {
  return FLAG_WORDS.includes(name);
}

/**
 * The fields of Giac's context (`class global` in src/global.h of the pinned tarball) and the C globals cas_setup()
 * shows, each with how the host handles it. tests/engine/flags-canary.ts fails when the pinned source has a field not
 * listed here. "read": in bridge-1's context (bridge.ts GiacContext, hostContext), put back by giac_ctx_set; the others are left as they are, with the reason.
 */
export const CONTEXT_FIELDS: Readonly<Record<string, string>> = {
  _xcas_mode_: "read",
  _calc_mode_: "read",
  _decimal_digits_: "read",
  _scientific_format_: "read",
  _integer_format_: "read",
  _integer_mode_: "read",
  _complex_mode_: "read",
  _complex_variables_: "read",
  _increasing_power_: "read",
  _approx_mode_: "read",
  _withsqrt_: "read",
  _all_trig_sol_: "read",
  _ntl_on_: "read",
  _keep_algext_: "read",
  _auto_assume_: "read",
  _parse_e_: "read",
  _convert_rootof_: "read",
  _python_compat_: "read",
  _angle_mode_: "read",
  _step_infolevel_: "read",
  _epsilon_: "read",
  _proba_epsilon_: "read",
  _prog_eval_level_val: "read",
  _eval_level: "read",
  _autosimplify_: "read",
  // set and put back inside one Giac function (latex(), int, series, solve, desolve): no command leaves it changed
  _latex_format_: "temporary: set inside latex printing only",
  _do_lnabs_: "temporary: set inside int, solve and desolve and put back",
  _eval_abs_: "temporary: set inside int and series and put back",
  _atan_tan_no_floor_: "temporary: set inside int and put back",
  _keep_acosh_asinh_: "temporary: set inside int and put back",
  _bounded_function_no_: "temporary: series counter",
  _series_flags_: "temporary: set inside series and put back",
  _series_variable_name_: "temporary: set inside series and put back",
  _series_default_order_: "temporary: set inside series and put back",
  _max_sum_sqrt_: "temporary: set inside alg_ext and put back",
  _specialtexprint_double_: "temporary: set inside tex printing and put back",
  // no Giac command sets it in our build (a getter call returns the name unevaluated, probe 2026-10-20)
  _minchar_for_quote_as_string_: "no command",
  _expand_re_im_: "no command",
  _eval_equaltosto_: "no command",
  _escape_real_: "no command",
  _variables_are_files_: "no command",
  _local_eval_: "no command",
  _lexer_close_parenthesis_: "no command (Xcas editor only)",
  _try_parse_i_: "no command (KhiCAS display only)",
  _max_sum_add_: "no command",
  _rpn_mode_: "RPN mode of Xcas's command line; the rpn commands are not in Find and our input never reaches them",
  _language_: "set_language: changes the help path only; our build has no message catalogs (probe: same error texts)",
  _format_double_: "TI format(): not in Find; printing of our numbers is ours (format.ts)",
  // graphics, spreadsheet, turtle and Xcas session state: Pascaline draws its own plots and reads no Giac graphic
  _show_point_: "graphics",
  _io_graph_: "graphics",
  _default_color_: "graphics",
  _show_axes_: "graphics",
  _spread_Row_: "spreadsheet",
  _spread_Col_: "spreadsheet",
  _printcell_current_row_: "spreadsheet",
  _printcell_current_col_: "spreadsheet",
  _turtle_: "turtle (excluded from Find)",
  _turtle_stack_: "turtle (excluded from Find)",
  _autoname_: "Xcas session names",
  _lastprog_name_: "Xcas session names",
  // internal state, not a setting
  _logptr_: "internal: output stream",
  _debug_ptr: "internal: debugger",
  _parsed_genptr_: "internal: parser",
  _pl: "internal: parser",
  _rand_seed: "state, not a setting: rand/srand (as a stored value is)",
  _thread_param_ptr: "internal: threads",
  _mutexptr: "internal: threads",
  _mutex_eval_status_ptr: "internal: threads",
  _last_evaled_function_name_: "internal: error messages",
  _last_evaled_argptr_: "internal: error messages",
  _currently_scanned_: "internal: parser",
  _total_time_: "internal: timing",
  _evaled_table_: "internal: cache",
  _extra_ptr_: "internal",
  _bcd_decpoint_: "not in our build (BCD)",
  _bcd_mantissa_: "not in our build (BCD)",
  _bcd_flags_: "not in our build (BCD)",
  _bcd_printdouble_: "not in our build (BCD)",
};
