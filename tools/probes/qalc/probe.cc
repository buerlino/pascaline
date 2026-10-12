// SPDX-License-Identifier: GPL-3.0-or-later
// Probe glue over libqalculate (not shipped): one expression -> fraction form, decimal form and qalc's own
// approximation flags. Used to check exactness ("try exact"), name collisions and silent non-answers.
// Built by tools/probes/qalc/link.sh against the P3 spike's static libraries.
#include <libqalculate/qalculate.h>
#include <string>

static Calculator *calc = nullptr;
static std::string last;

extern "C" {

int qp_init() {
  if (calc) return 1;
  calc = new Calculator();
  calc->setPrecision(12);
  return calc->loadGlobalDefinitions() ? 1 : 0;
}

// mode: 0 try exact (qalc's default), 1 exact only, 2 approximate. prec: working precision in digits.
// Note: the timed overload calculate(MathStructure*, str, msecs, ...) answers "aborted" with msecs = 0 in this
// build, so the untimed calculate(str, eo) is used.
const char *qp(const char *expr, int mode, int prec) {
  calc->setPrecision(prec);
  EvaluationOptions eo;
  eo.approximation = mode == 1 ? APPROXIMATION_EXACT : mode == 2 ? APPROXIMATION_APPROXIMATE : APPROXIMATION_TRY_EXACT;
  eo.auto_post_conversion = POST_CONVERSION_OPTIMAL_SI;
  std::string str = calc->unlocalizeExpression(expr, eo.parse_options), to;
  calc->separateToExpression(str, to, eo, true);
  MathStructure m = calc->calculate(str, eo);
  if (!to.empty()) m = calc->convert(m, to, eo);
  PrintOptions po;
  po.use_unit_prefixes = false;
  po.interval_display = INTERVAL_DISPLAY_PLUSMINUS;
  po.use_unicode_signs = false;
  po.lower_case_e = true;
  bool fracApprox = false, decApprox = false;
  MathStructure a(m), b(m);
  po.number_fraction_format = FRACTION_FRACTIONAL;
  po.is_approximate = &fracApprox;
  a.format(po);
  std::string fr = a.print(po);
  po.number_fraction_format = FRACTION_DECIMAL;
  po.is_approximate = &decApprox;
  b.format(po);
  std::string de = b.print(po);
  last = fr + "  |  " + de + "  |  struct_approx=" + (m.isApproximate() ? "1" : "0") +
         " print_approx(frac)=" + (fracApprox ? "1" : "0") + " print_approx(dec)=" + (decApprox ? "1" : "0");
  return last.c_str();
}

}
