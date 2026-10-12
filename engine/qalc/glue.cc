// SPDX-License-Identifier: GPL-3.0-or-later
// The smallest C API over libqalculate for wasm. Runs on the calling thread (msecs = 0): no control thread;
// cancel = terminate the worker.
//   qalc_init, qalc_calc: one calculation -> text (the P3 spike API; smoke tests and engine/qalc/cases.yaml).
//   qalc_set_precision, qalc_parse, qalc_print, qalc_eval: JSON for tools (the Find index generator, tools/find-index/, docs/04
//   section 3.3): what qalc's parser makes of a name, and a value as an exact fraction or a decimal with its
//   uncertainty and units, optionally in SI base units. The Units worker (milestone 5) builds on the same calls.
#include <libqalculate/qalculate.h>
#include <string>

static Calculator *calc = nullptr;
static std::string last;

static void jstr(std::string &o, const std::string &s) {
  o += '"';
  for (unsigned char ch : s) {
    if (ch == '"' || ch == '\\') { o += '\\'; o += (char)ch; }
    else if (ch < 0x20) { char b[8]; snprintf(b, sizeof b, "\\u%04x", ch); o += b; }
    else o += (char)ch;
  }
  o += '"';
}

// Exact integer text, never in E notation.
static std::string intText(const Number &n) {
  PrintOptions po;
  po.min_exp = EXP_NONE;
  po.use_unicode_signs = false;
  po.digit_grouping = DIGIT_GROUPING_NONE;
  return n.print(po);
}

// A number: {"t":"num","p":..,"q":..} when exact rational; else {"t":"num","dec":..,"unc":..} at the working precision
// (the midpoint and half-width of an interval; "unc" absent for a plain float). "approx": qalc's own flag.
static void dumpNumber(const Number &n0, std::string &o) {
  o += "{\"t\":\"num\",\"approx\":";
  o += n0.isApproximate() ? "true" : "false";
  if (n0.isRational() && !n0.isApproximate()) {
    o += ",\"p\":"; jstr(o, intText(n0.numerator()));
    o += ",\"q\":"; jstr(o, intText(n0.denominator()));
  } else if (n0.isComplex()) {
    o += ",\"complex\":true";
  } else {
    PrintOptions po;
    po.use_unicode_signs = false;
    po.lower_case_e = true;
    po.digit_grouping = DIGIT_GROUPING_NONE;
    po.interval_display = INTERVAL_DISPLAY_MIDPOINT;
    po.min_exp = EXP_PRECISION;
    Number mid(n0), unc;
    bool interval = n0.isInterval();
    if (interval) { unc = n0.uncertainty(); mid.intervalToMidValue(); }
    o += ",\"dec\":"; jstr(o, mid.print(po));
    if (interval) { o += ",\"unc\":"; jstr(o, unc.print(po)); }
  }
  o += '}';
}

static void dump(const MathStructure &m, std::string &o) {
  static const char *names[] = {"mul", "inv", "div", "add", "neg", "pow", "num", "unit", "sym", "fn", "var", "vec"};
  switch (m.type()) {
    case STRUCT_NUMBER: dumpNumber(m.number(), o); return;
    case STRUCT_UNIT:
      o += "{\"t\":\"unit\",\"u\":"; jstr(o, m.unit()->referenceName());
      if (m.prefix()) { o += ",\"pfx\":"; jstr(o, m.prefix()->shortName(true, false)); }
      o += '}';
      return;
    case STRUCT_VARIABLE: o += "{\"t\":\"var\",\"v\":"; jstr(o, m.variable()->referenceName()); o += '}'; return;
    case STRUCT_SYMBOLIC: o += "{\"t\":\"sym\",\"s\":"; jstr(o, m.symbol()); o += '}'; return;
    default: break;
  }
  o += "{\"t\":";
  if ((int)m.type() < (int)(sizeof names / sizeof *names)) jstr(o, names[m.type()]);
  else jstr(o, std::to_string((int)m.type()));
  if (m.isFunction()) { o += ",\"f\":"; jstr(o, m.function()->referenceName()); }
  o += ",\"c\":[";
  for (size_t i = 0; i < m.size(); i++) { if (i) o += ','; dump(m[i], o); }
  o += "]}";
}

extern "C" {

// Returns 1 when the compiled-in definitions (units, constants, functions) loaded.
int qalc_init() {
  if (calc) return 1;
  calc = new Calculator();
  calc->setPrecision(12);  // the Home default: 12 significant digits
  return calc->loadGlobalDefinitions() ? 1 : 0;
}

// Evaluates one expression in qalc syntax ("5 km/h to m/s", "c", "(3±0.1)*(2±0.2)").
const char *qalc_calc(const char *expr) {
  EvaluationOptions eo;
  eo.auto_post_conversion = POST_CONVERSION_OPTIMAL_SI;  // like the qalc CLI default
  PrintOptions po;
  po.use_unit_prefixes = false;
  po.number_fraction_format = FRACTION_DECIMAL;
  po.interval_display = INTERVAL_DISPLAY_PLUSMINUS;
  po.use_unicode_signs = false;  // ASCII output: easy to compare in the spike cases
  po.lower_case_e = true;
  last = calc->calculateAndPrint(calc->unlocalizeExpression(expr, eo.parse_options), 0, eo, po);
  return last.c_str();
}

// Working precision in significant digits (qalc_init sets 12).
void qalc_set_precision(int digits) { calc->setPrecision(digits); }

// What qalc's parser makes of `expr`, not evaluated, as a JSON tree: {"t":"unit","u":<reference name>,"pfx":..},
// {"t":"var","v":..}, {"t":"num",..}, {"t":"sym","s":..}, {"t":"mul"|"pow"|"div"|..,"c":[..]} (functions add "f").
const char *qalc_parse(const char *expr) {
  last.clear();
  dump(calc->parse(calc->unlocalizeExpression(expr, default_parse_options), default_parse_options), last);
  return last.c_str();
}

// How qalc writes `expr` as parsed, not evaluated: abbreviated names and Unicode signs ("km/h", "Ω", "°C", "µm").
const char *qalc_print(const char *expr) {
  MathStructure m = calc->parse(calc->unlocalizeExpression(expr, default_parse_options), default_parse_options);
  PrintOptions po;
  po.abbreviate_names = true;
  po.use_unicode_signs = true;
  po.use_unit_prefixes = false;
  po.digit_grouping = DIGIT_GROUPING_NONE;
  m.format(po);
  last = m.print(po);
  return last.c_str();
}

// Evaluates `expr` and returns {"tree":<result tree as in qalc_parse>,"approx":<qalc's flag>}.
// flags: 1 = exact only (APPROXIMATION_EXACT; π stays a variable), else qalc's default "try exact";
//        2 = convert the result to SI base units (no automatic conversion otherwise).
const char *qalc_eval(const char *expr, int flags) {
  EvaluationOptions eo;
  eo.approximation = (flags & 1) ? APPROXIMATION_EXACT : APPROXIMATION_TRY_EXACT;
  eo.auto_post_conversion = POST_CONVERSION_NONE;
  MathStructure m = calc->calculate(calc->unlocalizeExpression(expr, eo.parse_options), eo);
  if (flags & 2) m = calc->convertToBaseUnits(m, eo);
  last = "{\"approx\":";
  last += m.isApproximate() ? "true" : "false";
  last += ",\"tree\":";
  dump(m, last);
  last += '}';
  return last.c_str();
}

}
