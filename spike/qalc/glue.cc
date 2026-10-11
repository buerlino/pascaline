// SPDX-License-Identifier: GPL-3.0-or-later
// P3 spike: the smallest C API over libqalculate for wasm (init + one calculation -> text).
// Runs on the calling thread (msecs = 0): no control thread; cancel = terminate the worker.
#include <libqalculate/qalculate.h>
#include <string>

static Calculator *calc = nullptr;
static std::string last;

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

}
