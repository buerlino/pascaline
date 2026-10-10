// SPDX-License-Identifier: GPL-3.0-or-later
// Numerical solvers linked into the Giac wasm (spike Q5).
//  - pas_solve1: 1-D root in a bracket with Boost.Math TOMS 748.
//  - pas_solve_n: N x N system with MINPACK hybrd1 (cminpack).
// Residuals are evaluated by Giac in the same context as caseval(), so user variables apply.
#define BOOST_MATH_STANDALONE 1
#include <boost/math/tools/toms748_solve.hpp>

#include <cminpack.h>
#include <emscripten/emscripten.h>

#include <cmath>
#include <cstdint>
#include <limits>
#include <sstream>
#include <string>
#include <vector>

#include "giac.h"

extern "C" const char *caseval(const char *);

namespace {
using giac::context;
using giac::gen;

std::string g_out;

const context *shared_context() {
  return reinterpret_cast<const context *>(caseval("caseval contextptr"));
}

double eval_at(const gen &expr, const std::vector<gen> &vars, const double *x, const context *ctx) {
  giac::vecteur from, to;
  for (size_t i = 0; i < vars.size(); ++i) {
    from.push_back(vars[i]);
    to.push_back(gen(x[i]));
  }
  gen r = giac::evalf_double(giac::subst(expr, gen(from), gen(to), false, ctx), 1, ctx);
  return r.type == giac::_DOUBLE_ ? r._DOUBLE_val : std::numeric_limits<double>::quiet_NaN();
}

// Turn "lhs=rhs" into lhs-rhs.
gen as_residual(const gen &g, const context *ctx) {
  if (g.is_symb_of_sommet(giac::at_equal)) return giac::_equal2diff(g, ctx);
  return g;
}

struct SystemData {
  std::vector<gen> eqs;
  std::vector<gen> vars;
  const context *ctx;
};

int system_fcn(void *p, int n, const double *x, double *fvec, int /*iflag*/) {
  auto *d = static_cast<SystemData *>(p);
  for (int i = 0; i < n; ++i) {
    fvec[i] = eval_at(d->eqs[i], d->vars, x, d->ctx);
    if (!std::isfinite(fvec[i])) return -1;  // tell hybrd1 to stop
  }
  return 0;
}

std::string fmt(double v) {
  std::ostringstream os;
  os.precision(17);
  os << v;
  return os.str();
}
}  // namespace

extern "C" {

// Root of expr (an expression or equation in var) in [a, b]. Returns "[root,residual,iterations]"
// or "error: …".
EMSCRIPTEN_KEEPALIVE const char *pas_solve1(const char *expr, const char *var, double a, double b) {
  const context *ctx = shared_context();
  try {
    gen e = as_residual(gen(std::string(expr), ctx), ctx);
    std::vector<gen> vars{gen(std::string(var), ctx)};
    auto f = [&](double t) { return eval_at(e, vars, &t, ctx); };
    std::uintmax_t iters = 100;
    boost::math::tools::eps_tolerance<double> tol(std::numeric_limits<double>::digits - 3);
    auto r = boost::math::tools::toms748_solve(f, a, b, tol, iters);
    double root = (r.first + r.second) / 2;
    g_out = "[" + fmt(root) + "," + fmt(f(root)) + "," + std::to_string(iters) + "]";
  } catch (const std::exception &ex) {
    g_out = std::string("error: ") + ex.what();
  }
  return g_out.c_str();
}

// Solve a system. eqs and vars are Giac lists ("[x^2+y^2=4,x=y]", "[x,y]"), guess holds n doubles
// and receives the solution. Returns "[info,residual_norm]" (info 1 = converged) or "error: …".
EMSCRIPTEN_KEEPALIVE const char *pas_solve_n(const char *eqs, const char *vars, double *guess, int n) {
  const context *ctx = shared_context();
  try {
    gen ge(std::string(eqs), ctx), gv(std::string(vars), ctx);
    if (ge.type != giac::_VECT || gv.type != giac::_VECT || int(ge._VECTptr->size()) != n ||
        int(gv._VECTptr->size()) != n) {
      g_out = "error: need n equations and n variables";
      return g_out.c_str();
    }
    SystemData d{{}, {}, ctx};
    for (const gen &g : *ge._VECTptr) d.eqs.push_back(as_residual(g, ctx));
    for (const gen &g : *gv._VECTptr) d.vars.push_back(g);
    std::vector<double> fvec(n), wa(n * (3 * n + 13) / 2 + 1);
    int info = hybrd1(system_fcn, &d, n, guess, fvec.data(), 1e-12, wa.data(), int(wa.size()));
    double norm = 0;
    for (double v : fvec) norm += v * v;
    g_out = "[" + std::to_string(info) + "," + fmt(std::sqrt(norm)) + "]";
  } catch (const std::exception &ex) {
    g_out = std::string("error: ") + ex.what();
  }
  return g_out.c_str();
}

}  // extern "C"
