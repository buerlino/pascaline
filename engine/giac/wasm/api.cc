// SPDX-License-Identifier: GPL-3.0-or-later
// Minimal C API exported from the Giac wasm module. The worker talks only to these.
// G85 (structured bridge spike, docs/research/structure-hindsight.md 2.1): giac_ctx_get/giac_ctx_set, giac_parse and
// giac_value answer as JSON on the context caseval uses. They change no Giac behaviour (no patch); giac_eval stays.
#include <emscripten/emscripten.h>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <set>
#include <string>
#include <vector>

#include "giac.h"

using giac::gen;

// Giac's EMCC/EMCC2 builds expect the host to provide gettext() (see giacintl.h).
// Engine messages stay in English; the UI translates its own strings.
const char *gettext(const char *s) { return s; }

namespace {
std::string g_last;

const giac::context *ctx() { return (const giac::context *)giac::caseval("caseval contextptr"); }

// ---- JSON output ---------------------------------------------------------------------------------------------------
void jstr(std::string &o, const std::string &s) {
  o += '"';
  for (unsigned char c : s) {
    switch (c) {
      case '"': o += "\\\""; break;
      case '\\': o += "\\\\"; break;
      case '\n': o += "\\n"; break;
      case '\r': o += "\\r"; break;
      case '\t': o += "\\t"; break;
      default:
        if (c < 0x20) {
          char b[8];
          snprintf(b, sizeof b, "\\u%04x", c);
          o += b;
        } else
          o += (char)c;
    }
  }
  o += '"';
}
void jkey(std::string &o, const char *k) {
  if (o.back() != '{') o += ',';
  jstr(o, k);
  o += ':';
}
void jlist(std::string &o, const std::vector<std::string> &v) {
  o += '[';
  for (size_t k = 0; k < v.size(); ++k) {
    if (k) o += ',';
    jstr(o, v[k]);
  }
  o += ']';
}
std::string jnum(double d) {
  char b[40];
  snprintf(b, sizeof b, "%.17g", d);
  return b;
}

// Interrupt state as caseval sets it before an evaluation (gen.cc near 17005, patch 0002): the sub-second timeout counts
// from here and `ctrl_c` from a previous interrupt is cleared.
void startClock() {
  giac::ctrl_c = giac::interrupted = false;
#ifdef TIMEOUT
  giac::caseval_begin = time(0);
  giac::caseval_begin_ms = emscripten_get_now();
#endif
}

// Parses as caseval does (gen(s, ctx)) but without its top-level `=` → `:=` (equaltosto): the host never hands Giac a
// bare input, it evaluates `pasans:=(input)`, where an `=` stays an equation. `err`: Giac's parser reported an error.
gen parseInput(const char *s, const giac::context *c, bool &err) {
  giac::first_error_line(0, c);
  gen g(std::string(s), c);
  err = giac::first_error_line(c) != 0;
  return g;
}

// ---- bridge-2: the walk ----------------------------------------------------------------------------------------------
struct Walk {
  std::vector<std::string> heads, reads, targets, bound;
  std::set<std::string> seenH, seenR, seenT, seenB;
  std::vector<std::string> scope;  // names bound where the walk is (parameters, locals, a quoting command's variable)
  bool flt = false, str = false;
  int nodes = 0;
  void add(std::vector<std::string> &v, std::set<std::string> &s, const std::string &x) {
    if (s.insert(x).second) v.push_back(x);
  }
  bool inScope(const std::string &x) const {
    for (const std::string &n : scope)
      if (n == x) return true;
    return false;
  }
};

std::string headOf(const gen &g) { return g._SYMBptr->sommet.ptr()->s; }

const char *const STORE_HEADS[] = {"sto", "array_sto", "increment", "decrement", "multcrement", "divcrement", "purge", "DelVar"};
bool among(const std::string &h, const char *const *list, size_t n) {
  for (size_t k = 0; k < n; ++k)
    if (h == list[k]) return true;
  return false;
}
// The commands that quote their variable argument (G28, tools/probes/bound.ts; the one table since G99): {command,
// minimum arguments}. The variable is argument 1 and is bound in arguments 0 and 1; with fewer arguments it is read
// (int(x^2,x) evaluates the integrand with a stored x). The definite forms (minimum 4) also take it as `x=a..b`
// (sum(x^2,x=1..3)): x is bound in argument 0 and the bounds are read (G99; after x:=3, sum(x^2,x=1..3) = 14,
// product(x,x=1..4) = 24, int(x^2,x=0..1) = 1/3).
struct Quoting {
  const char *cmd;
  size_t min;
};
const Quoting QUOTING[] = {{"diff", 2}, {"solve", 2}, {"csolve", 2}, {"fsolve", 2}, {"linsolve", 2}, {"limit", 3},
                           {"sum", 4},  {"product", 4}, {"seq", 4},  {"int", 4},    {"integrate", 4}};

void walk(const gen &g, Walk &w);

// A store target: a name, `L[k]` (L stored, L and k read), or a list of targets. A name bound here (a local, a parameter)
// is not a target: the store does not outlive the call.
void walkTarget(const gen &t, Walk &w) {
  if (t.type == giac::_IDNT) {
    if (!w.inScope(t._IDNTptr->id_name)) w.add(w.targets, w.seenT, t._IDNTptr->id_name);
    return;
  }
  if (t.type == giac::_VECT) {
    for (const gen &x : *t._VECTptr) walkTarget(x, w);
    return;
  }
  if (t.type == giac::_SYMB && headOf(t) == "at" && t._SYMBptr->feuille.type == giac::_VECT && !t._SYMBptr->feuille._VECTptr->empty()) {
    const giac::vecteur &v = *t._SYMBptr->feuille._VECTptr;
    walkTarget(v[0], w);
    walk(v[0], w);  // L[k]:= keeps L's other elements: it reads L
    for (size_t k = 1; k < v.size(); ++k) walk(v[k], w);
    return;
  }
  walk(t, w);
}

// Pushes the names of a parameter list, a local list or a variable argument onto the scope; returns how many.
size_t bind(const gen &p, Walk &w) {
  if (p.type == giac::_IDNT) {
    w.add(w.bound, w.seenB, p._IDNTptr->id_name);
    w.scope.push_back(p._IDNTptr->id_name);
    return 1;
  }
  size_t n = 0;
  if (p.type == giac::_VECT)
    for (const gen &x : *p._VECTptr) n += bind(x, w);
  else if (p.type == giac::_SYMB && p._SYMBptr->feuille.type == giac::_VECT && !p._SYMBptr->feuille._VECTptr->empty())
    n += bind(p._SYMBptr->feuille._VECTptr->front(), w);  // x=default, a typed parameter: the name
  return n;
}
void unbind(size_t n, Walk &w) { w.scope.resize(w.scope.size() - n); }

void walk(const gen &g, Walk &w) {
  ++w.nodes;
  switch (g.type) {
    case giac::_DOUBLE_:
    case giac::_REAL:
    case giac::_FLOAT_:
      w.flt = true;
      return;
    case giac::_CPLX:
      walk(g._CPLXptr[0], w);
      walk(g._CPLXptr[1], w);
      return;
    case giac::_STRNG:
      w.str = true;  // a leaf: a := inside a string is never a store
      return;
    case giac::_IDNT: {
      if (g == giac::cst_pi || g == giac::cst_euler_gamma) return;  // as lname
      if (!w.inScope(g._IDNTptr->id_name)) w.add(w.reads, w.seenR, g._IDNTptr->id_name);
      return;
    }
    case giac::_FUNC:
      w.add(w.heads, w.seenH, g._FUNCptr->ptr()->s);  // a function passed as a value: (tanh)(1+i), map(L,f)
      return;
    case giac::_VECT:
      for (const gen &x : *g._VECTptr) walk(x, w);
      return;
    case giac::_FRAC:
      walk(g._FRACptr->num, w);
      walk(g._FRACptr->den, w);
      return;
    case giac::_SYMB:
      break;
    default:
      return;
  }
  const std::string h = headOf(g);
  w.add(w.heads, w.seenH, h);
  const gen &f = g._SYMBptr->feuille;
  const giac::vecteur *v = f.type == giac::_VECT ? f._VECTptr : nullptr;
  // G100: `for k in L` is for(1, for(k, L), 1, body) in Giac's tree; the loop stores k (Giac leaves L's last element in
  // it, probed), L is read. A two-argument `for` with a name first is only that form.
  if (h == "for" && v && v->size() == 2 && (*v)[0].type == giac::_IDNT) {
    walkTarget((*v)[0], w);
    walk((*v)[1], w);
    return;
  }
  if (among(h, STORE_HEADS, sizeof STORE_HEADS / sizeof *STORE_HEADS)) {
    if (h == "sto" || h == "array_sto") {
      if (v && v->size() == 2) {
        walk((*v)[0], w);
        walkTarget((*v)[1], w);
        return;
      }
    } else if (h == "purge" || h == "DelVar") {
      walkTarget(f, w);
      return;
    } else {  // increment(a[,k]) and the others (a+=k …): a is stored and read
      const gen &t = v && !v->empty() ? (*v)[0] : f;
      walkTarget(t, w);
      walk(t, w);
      if (v)
        for (size_t k = 1; k < v->size(); ++k) walk((*v)[k], w);
      return;
    }
  }
  if (h == "program" && v && v->size() == 3) {  // (parameters, defaults, body): the parameters are bound in the body
    walk((*v)[1], w);
    size_t n = bind((*v)[0], w);
    walk((*v)[2], w);
    unbind(n, w);
    return;
  }
  if (h == "local" && v && v->size() == 2) {  // local [names, initial values] body
    const gen &names = (*v)[0];
    size_t n = bind(names.type == giac::_VECT && !names._VECTptr->empty() && names._VECTptr->front().type == giac::_VECT ? names._VECTptr->front() : names, w);
    if (names.type == giac::_VECT && names._VECTptr->size() == 2 && names._VECTptr->front().type == giac::_VECT) walk(names._VECTptr->back(), w);
    walk((*v)[1], w);
    unbind(n, w);
    return;
  }
  for (const Quoting &q : QUOTING) {
    if (h != q.cmd || !v || v->size() < 2) continue;
    const gen &a = (*v)[1];
    if (q.min == 4 && a.is_symb_of_sommet(giac::at_equal) && a._SYMBptr->feuille.type == giac::_VECT &&
        a._SYMBptr->feuille._VECTptr->size() == 2 && a._SYMBptr->feuille._VECTptr->front().type == giac::_IDNT &&
        a._SYMBptr->feuille._VECTptr->back().is_symb_of_sommet(giac::at_interval)) {
      w.add(w.heads, w.seenH, headOf(a));
      size_t n = bind(a._SYMBptr->feuille._VECTptr->front(), w);
      walk((*v)[0], w);
      unbind(n, w);
      walk(a._SYMBptr->feuille._VECTptr->back(), w);  // the bounds: outside the binding
      for (size_t k = 2; k < v->size(); ++k) walk((*v)[k], w);
      return;
    }
    if (v->size() < q.min || a.type != giac::_IDNT) continue;
    size_t n = bind((*v)[1], w);
    walk((*v)[0], w);
    unbind(n, w);
    for (size_t k = 2; k < v->size(); ++k) walk((*v)[k], w);  // a limit's point, a sum's bounds: outside the binding
    return;
  }
  walk(f, w);
}

// ---- bridge-3: kinds and parts -------------------------------------------------------------------------------------
const size_t CUT = 2048;

bool isBoolean(const gen &g) { return g.type == giac::_INT_ && g.subtype == giac::_INT_BOOLEAN; }
// A real number with a value: an integer, a rational, a finite float (never a boolean, an infinity or a NaN).
bool isNumber(const gen &x, const giac::context *c) {
  switch (x.type) {
    case giac::_INT_:
      return !isBoolean(x);
    case giac::_ZINT:
      return true;
    case giac::_FRAC:
      return x._FRACptr->num.type <= giac::_ZINT && x._FRACptr->den.type <= giac::_ZINT;
    case giac::_DOUBLE_:
      return std::isfinite(x._DOUBLE_val);
    case giac::_REAL:
      return !giac::is_inf(x) && !giac::is_undef(x) && x.print(c).find_first_of("ni") == std::string::npos;  // inf, nan
    default:
      return false;
  }
}
bool nonFinite(const gen &g, const giac::context *c) {
  if (g.type == giac::_CPLX) return nonFinite(g._CPLXptr[0], c) || nonFinite(g._CPLXptr[1], c);
  if (g.type == giac::_DOUBLE_) return !std::isfinite(g._DOUBLE_val);
  if (g.type == giac::_REAL) return !isNumber(g, c);
  return giac::is_inf(g);
}

// S: Giac's print of g. A NaN part (an MPFR one has no type of its own) prints as undef.
const char *kindOf(const gen &g, bool error, const giac::context *c, const std::string &S) {
  if (error) return "error";
  if (giac::is_undef(g) || (g.type == giac::_DOUBLE_ && std::isnan(g._DOUBLE_val))) return "undef";
  if (nonFinite(g, c)) return S.find("undef") != std::string::npos ? "undef" : "infinity";
  switch (g.type) {
    case giac::_INT_:
      return isBoolean(g) ? "boolean" : "integer";
    case giac::_ZINT:
      return "integer";
    case giac::_FRAC:
      return isNumber(g, c) ? "rational" : "symbolic";
    case giac::_DOUBLE_:
    case giac::_REAL:
    case giac::_FLOAT_:
      return "float";
    case giac::_CPLX:
      return "complex";
    case giac::_VECT:
      if (g.subtype == giac::_SEQ__VECT) return "sequence";
      if (g.subtype == giac::_SET__VECT) return "set";
      return giac::ckmatrix(g) ? "matrix" : "list";
    case giac::_STRNG:
      return "string";
    case giac::_IDNT:
    case giac::_SYMB:
      return "symbolic";
    case giac::_FUNC:
      return "function";
    default:
      return "other";
  }
}

// An exact integer in base 10, whatever integer_format says (hex, octal); "" when it has more than CUT digits.
std::string decimal(const gen &x) {
  if (x.type == giac::_INT_) return std::to_string(x.val);
  if (x.type != giac::_ZINT || mpz_sizeinbase(*x._ZINTptr, 10) > CUT) return "";
  char *s = mpz_get_str(nullptr, 10, *x._ZINTptr);
  std::string r(s);
  free(s);
  return r;
}
// A part printed for the host: integers and rationals in base 10, a float as Giac prints it.
std::string partText(const gen &x, const giac::context *c) {
  if (x.type == giac::_INT_ || x.type == giac::_ZINT) return decimal(x);
  if (x.type == giac::_FRAC) return decimal(x._FRACptr->num) + "/" + decimal(x._FRACptr->den);
  return x.print(c);
}

// Real and imaginary part of an evaluated number, printed; false when it is not a finite number.
bool partsOf(const gen &x, const giac::context *c, std::string &o) {
  // evalf at P <= 14 can give a symbolic form (-(1.5), 2.0*i) that re() and im() turn into numbers, as today's
  // `(pasz->[re(pasz),im(pasz)])(evalf(…,P))` does; a value that is not a number keeps symbolic parts and is refused.
  gen a = giac::re(x, c), b = giac::im(x, c);
  if (!isNumber(a, c) || !isNumber(b, c)) return false;
  std::string ta = partText(a, c), tb = partText(b, c);
  if (ta.empty() || tb.empty() || ta.find('/') == 0 || tb.find('/') == 0) return false;
  o += '[';
  jstr(o, ta);
  o += ',';
  jstr(o, tb);
  o += ']';
  return true;
}

void elementsOf(const gen &r, std::vector<gen> &out) {
  if (r.type == giac::_VECT && r.subtype != giac::_SEQ__VECT && r.subtype != giac::_SET__VECT) {
    for (const gen &x : *r._VECTptr) {
      if (x.type == giac::_VECT) elementsOf(x, out);
      else out.push_back(x);
    }
  } else
    out.push_back(r);
}
}  // namespace

extern "C" {

// Initialise Giac's default context. Safe to call more than once.
EMSCRIPTEN_KEEPALIVE int giac_init() {
  giac::caseval("0");
  return 1;
}

// Evaluate one input. The returned pointer stays valid until the next call.
EMSCRIPTEN_KEEPALIVE const char *giac_eval(const char *input) {
  g_last = giac::caseval(input);
  return g_last.c_str();
}

// LaTeX for an input (evaluated first). Same lifetime rule as giac_eval.
EMSCRIPTEN_KEEPALIVE const char *giac_latex(const char *input) {
  std::string s = "latex(";
  s += input;
  s += ")";
  g_last = giac::caseval(s.c_str());
  return g_last.c_str();
}

// Set a Giac setting by name, e.g. ("Digits", "12") or ("angle_radian", "0").
EMSCRIPTEN_KEEPALIVE const char *giac_set_setting(const char *name, const char *value) {
  std::string s = name;
  s += ":=";
  s += value;
  g_last = giac::caseval(s.c_str());
  return g_last.c_str();
}

// Size guard for exact integer powers: b^n with |n*ln(b)| > limit gives an "Exponent overflow" error
// at once instead of computing a huge integer (a single GMP call that the timeout can't interrupt).
// Giac's default is 1e8. Returns the previous limit.
EMSCRIPTEN_KEEPALIVE double giac_set_pow_limit(double limit) {
  double prev = giac::powlog2float;
  giac::powlog2float = limit;
  return prev;
}

// bridge-1: every setting of caseval's context as one JSON object (global.h accessors): the hindsight note's eleven, calc_mode and
// angle_mode (0 rad, 1 deg, 2 grad), and every other field today's settings check reads (flags.ts CONTEXT_FIELDS "read").
EMSCRIPTEN_KEEPALIVE const char *giac_ctx_get() {
  const giac::context *c = ctx();
  std::string o = "{";
  jkey(o, "angle_mode"), o += std::to_string(giac::angle_mode(c));
  jkey(o, "angle_radian"), o += giac::angle_radian(c) ? "true" : "false";
  jkey(o, "approx_mode"), o += giac::approx_mode(c) ? "true" : "false";
  jkey(o, "complex_mode"), o += giac::complex_mode(c) ? "true" : "false";
  jkey(o, "complex_variables"), o += giac::complex_variables(c) ? "true" : "false";
  jkey(o, "integer_format"), o += std::to_string(giac::integer_format(c));
  jkey(o, "scientific_format"), o += std::to_string(giac::scientific_format(c));
  jkey(o, "decimal_digits"), o += std::to_string(giac::decimal_digits(c));
  jkey(o, "epsilon"), o += jnum(giac::epsilon(c));
  jkey(o, "increasing_power"), o += giac::increasing_power(c) ? "true" : "false";
  jkey(o, "all_trig_sol"), o += giac::all_trig_sol(c) ? "true" : "false";
  jkey(o, "xcas_mode"), o += std::to_string(giac::xcas_mode(c));
  jkey(o, "calc_mode"), o += std::to_string(giac::calc_mode(c));
  // The other fields today's settings check reads (app/src/engine/flags.ts CONTEXT_FIELDS "read", FLAGS_READ).
  jkey(o, "python_compat"), o += std::to_string(giac::python_compat(c));
  jkey(o, "integer_mode"), o += giac::integer_mode(c) ? "true" : "false";
  jkey(o, "withsqrt"), o += giac::withsqrt(c) ? "true" : "false";
  jkey(o, "keep_algext"), o += giac::keep_algext(c) ? "true" : "false";
  jkey(o, "auto_assume"), o += giac::auto_assume(c) ? "true" : "false";
  jkey(o, "parse_e"), o += giac::parse_e(c) ? "true" : "false";
  jkey(o, "convert_rootof"), o += giac::convert_rootof(c) ? "true" : "false";
  jkey(o, "ntl_on"), o += giac::ntl_on(c) ? "true" : "false";
  jkey(o, "step_infolevel"), o += std::to_string(giac::step_infolevel(c));
  jkey(o, "proba_epsilon"), o += jnum(giac::proba_epsilon(c));
  jkey(o, "eval_level"), o += std::to_string(giac::eval_level(c));
  jkey(o, "prog_eval_level"), o += std::to_string(giac::prog_eval_level_val(c));
  jkey(o, "autosimplify"), jstr(o, giac::autosimplify(c));
  o += '}';
  g_last = o;
  return g_last.c_str();
}

// bridge-1: sets the fields of a flat JSON object ({"decimal_digits":20,"angle_radian":false}) through the same command
// functions `name:=value` reaches (prog.cc: _Digits, _angle_radian …), then returns giac_ctx_get(). An unknown key or a
// value that is not a number or a boolean returns {"error":…} and sets nothing after it.
EMSCRIPTEN_KEEPALIVE const char *giac_ctx_set(const char *json) {
  const giac::context *c = ctx();
  const char *p = json;
  auto skip = [&]() { while (*p == ' ' || *p == '\n' || *p == '\t' || *p == '\r' || *p == ',' || *p == '{') ++p; };
  auto fail = [&](const std::string &why) {
    g_last = "{";
    jkey(g_last, "error");
    jstr(g_last, why);
    g_last += '}';
    return g_last.c_str();
  };
  for (skip(); *p && *p != '}'; skip()) {
    if (*p != '"') return fail(std::string("expected a key at ") + p);
    const char *k0 = ++p;
    while (*p && *p != '"') ++p;
    std::string key(k0, p);
    if (*p) ++p;
    while (*p == ' ' || *p == ':') ++p;
    double v = 0;
    std::string str;
    bool isStr = *p == '"';
    if (isStr) {
      const char *s0 = ++p;
      while (*p && *p != '"') ++p;
      str.assign(s0, p);
      if (*p) ++p;
    } else if (!strncmp(p, "true", 4)) v = 1, p += 4;
    else if (!strncmp(p, "false", 5)) v = 0, p += 5;
    else {
      char *e;
      v = strtod(p, &e);
      if (e == p) return fail("not a number or boolean: " + key);
      p = e;
    }
    gen a((int)v);
    if (isStr != (key == "autosimplify")) return fail("wrong type of value: " + key);
    if (key == "autosimplify") giac::_autosimplify(gen(str, c), c);
    else if (key == "decimal_digits") giac::_Digits(a, c);
    else if (key == "angle_radian") giac::_angle_radian(gen(v != 0 ? 1 : 0), c);
    else if (key == "angle_mode") giac::_angle_radian(gen(v == 1 ? 0 : v == 2 ? 2 : 1), c);  // _angle_radian: 0 deg, 2 grad
    else if (key == "approx_mode") giac::_approx_mode(a, c);
    else if (key == "complex_mode") giac::_complex_mode(a, c);
    else if (key == "complex_variables") giac::_complex_variables(a, c);
    else if (key == "integer_format") giac::_integer_format(a, c);
    else if (key == "scientific_format") giac::_scientific_format(a, c);
    else if (key == "epsilon") giac::_epsilon(gen(v), c);
    else if (key == "increasing_power") giac::_increasing_power(a, c);
    else if (key == "all_trig_sol") giac::_all_trig_solutions(a, c);
    else if (key == "xcas_mode") giac::_xcas_mode(a, c);
    else if (key == "proba_epsilon") giac::_proba_epsilon(gen(v), c);
    else if (key == "keep_algext") giac::_keep_algext(a, c);
    else if (key == "ntl_on") giac::_ntl_on(a, c);
    else if (key == "withsqrt") giac::_with_sqrt(a, c);
    else if (key == "prog_eval_level") giac::_prog_eval_level(a, c);
    // No command declared in Giac's headers for these: the accessor, as the command sets it (prog.cc).
    else if (key == "python_compat") giac::python_compat((int)v, c);
    else if (key == "integer_mode") giac::integer_mode((int)v != 0, c);
    else if (key == "auto_assume") giac::auto_assume((int)v != 0, c);
    else if (key == "parse_e") giac::parse_e((int)v != 0, c);
    else if (key == "convert_rootof") giac::convert_rootof((int)v != 0, c);
    else if (key == "step_infolevel") giac::step_infolevel((int)v, c);
    else if (key == "eval_level") giac::eval_level(c) = (int)v;
    else if (key == "calc_mode") giac::calc_mode((int)v, c);
    else return fail("unknown setting: " + key);
  }
  return giac_ctx_get();
}

// bridge-2: Giac's tree of `text`, not evaluated, as JSON: {"ok","heads","reads","targets","bound","top","program",
// "value","form","callee","float","string","nodes"}. heads: every function node (and a function passed as a value); reads: free names (pi and euler_gamma left
// out, as lname does; bound names and pure store targets left out); targets: names a store sets (sto, =>, :=, L[k]:=,
// increment and the other +=, purge); bound: program parameters, locals and the variable of sum/int/seq …; top: the
// targets of the top-level store alone (a name, L of L[k]:=, a list's names; [] when the text is not one store, G99);
// program: that store's value is a program (f(x):=…, f:=x->…); float: a float literal occurs. Strings are leaves. ok false: Giac's parser reported an error.
// G100: value: the targets of the top-level store's value alone (a body storing into its own name, f(x):={f:=0;…},
// keeps f there, which targets lists once); form: how that store's target is written: "name" (f:=…, and f(x):=…,
// which Giac's tree holds as f:=(x)->… and prints so for a block body), "indexed" (L[k]:=…), "list" ([a,b]:=…), "call"
// (a call that names no new function, Beta(x):= on a built-in; callee: its head), "other", or "" when the text is not
// one store.
EMSCRIPTEN_KEEPALIVE const char *giac_parse(const char *text) {
  const giac::context *c = ctx();
  bool err = false;
  Walk w;
  Walk top;    // the top-level store's targets alone
  Walk value;  // the top-level store's value alone
  bool program = false;
  std::string form, callee;
  try {
    gen g = parseInput(text, c, err);
    walk(g, w);
    if (g.is_symb_of_sommet(giac::at_sto) && g._SYMBptr->feuille.type == giac::_VECT && g._SYMBptr->feuille._VECTptr->size() == 2) {
      const giac::vecteur &v = *g._SYMBptr->feuille._VECTptr;
      program = v[0].is_symb_of_sommet(giac::at_program);
      walkTarget(v[1], top);
      walk(v[0], value);
      const gen &t = v[1];
      if (t.type == giac::_IDNT)
        form = "name";
      else if (t.type == giac::_VECT)
        form = "list";
      else if (t.type == giac::_SYMB && headOf(t) == "at")
        form = "indexed";
      else if (t.type == giac::_SYMB) {
        form = "call";
        callee = headOf(t);
      } else
        form = "other";
    }
  } catch (std::runtime_error &e) {
    err = true;
  }
  std::string o = "{";
  jkey(o, "ok"), o += err ? "false" : "true";
  jkey(o, "heads"), jlist(o, w.heads);
  jkey(o, "reads"), jlist(o, w.reads);
  jkey(o, "targets"), jlist(o, w.targets);
  jkey(o, "bound"), jlist(o, w.bound);
  jkey(o, "top"), jlist(o, top.targets);
  jkey(o, "program"), o += program ? "true" : "false";
  jkey(o, "value"), jlist(o, value.targets);
  jkey(o, "form"), jstr(o, form);
  jkey(o, "callee"), jstr(o, callee);
  jkey(o, "float"), o += w.flt ? "true" : "false";
  jkey(o, "string"), o += w.str ? "true" : "false";
  jkey(o, "nodes"), o += std::to_string(w.nodes);
  o += '}';
  g_last = o;
  return g_last.c_str();
}

// bridge-3: evaluates `text` once, as caseval does (parse, history, protecteval under the same timeout and interrupt
// state; no equaltosto, see parseInput), and returns {"kind","text","cut","num","den","shape","elements","at"}.
// kind: integer, rational, float, complex, boolean, infinity, undef, list, matrix, sequence, set, symbolic, string,
// function, error, other. text: Giac's print (an error as caseval prints it, "GIAC_ERROR: …"), cut to 2 kB with
// "cut":true. num/den: an integer's or rational's, in base 10 whatever integer_format says, left out past 2048 digits.
// elements: a list's or matrix's printed elements (rows flattened; left out when the text is cut), with shape [n] or
// [rows, cols]. at: for each precision P in `precisions` ("12,32"), [re, im] of every element of evalf(value, P), each
// part in base 10, or null when an element is not a finite number; kept when the text is cut (2^10000 still has digits).
EMSCRIPTEN_KEEPALIVE const char *giac_value(const char *text, const char *precisions) {
  const giac::context *c = ctx();
  giac::context *C = const_cast<giac::context *>(c);
  startClock();
  gen r;
  bool err = false;
  std::string S;
  try {
    bool perr = false;
    gen g = parseInput(text, c, perr);
    if (perr) {
      // Never evaluate the partial tree the parser leaves after a syntax error (2*/3 would give a number).
      err = true;
      S = "GIAC_ERROR: syntax error";
    } else {
      giac::history_in(C).push_back(g);  // as caseval: ans() and the history see this input
      r = giac::protecteval(g, 1, C);
      giac::history_out(C).push_back(r);
      err = giac::has_undef_stringerr(r, S);
      S = err ? "GIAC_ERROR: " + S : r.print(c);
    }
  } catch (std::runtime_error &e) {
    err = true;
    S = std::string("GIAC_ERROR: ") + e.what();
  }
  const bool cut = S.size() > CUT;
  std::string o = "{";
  jkey(o, "kind"), jstr(o, kindOf(r, err, c, S));
  jkey(o, "text"), jstr(o, cut ? S.substr(0, CUT) : S);
  if (cut) jkey(o, "cut"), o += "true";
  if (err) {
    o += '}';
    g_last = o;
    return g_last.c_str();
  }
  if ((r.type == giac::_INT_ && !isBoolean(r)) || r.type == giac::_ZINT || (r.type == giac::_FRAC && isNumber(r, c))) {
    std::string n = decimal(r.type == giac::_FRAC ? r._FRACptr->num : r), d = r.type == giac::_FRAC ? decimal(r._FRACptr->den) : "1";
    if (!n.empty() && !d.empty()) {
      jkey(o, "num"), jstr(o, n);
      jkey(o, "den"), jstr(o, d);
    }
  }
  std::vector<gen> els;
  elementsOf(r, els);
  const bool vect = r.type == giac::_VECT && r.subtype != giac::_SEQ__VECT && r.subtype != giac::_SET__VECT;
  if (vect) {
    jkey(o, "shape");
    if (giac::ckmatrix(r)) o += "[" + std::to_string(r._VECTptr->size()) + "," + std::to_string(r._VECTptr->front()._VECTptr->size()) + "]";
    else o += "[" + std::to_string(r._VECTptr->size()) + "]";
    if (!cut) {
      jkey(o, "elements"), o += '[';
      for (size_t k = 0; k < els.size(); ++k) {
        if (k) o += ',';
        jstr(o, els[k].print(c));
      }
      o += ']';
    }
  }
  jkey(o, "at"), o += '{';
  bool first = true;
  for (const char *p = precisions; p && *p;) {
    char *e;
    long n = strtol(p, &e, 10);
    if (e == p) break;
    p = *e == ',' ? e + 1 : e;
    if (n < 1 || n > 1000) continue;
    if (!first) o += ',';
    first = false;
    jstr(o, std::to_string(n));
    o += ':';
    std::string parts = "[";
    bool ok = !giac::ctrl_c && !giac::interrupted && els.size() <= 400;  // MAX_ITEMS (numeric.ts)
    for (size_t k = 0; ok && k < els.size(); ++k) {
      gen x;
      std::string e;
      try {
        // Through protecteval, as caseval runs `evalf(…,P)`: an evalf that throws (BesselJ(1,2) at 50 digits) must not
        // leave Digits at P, which a bare _evalf does.
        x = giac::protecteval(gen(giac::symbolic(giac::at_evalf, giac::makesequence(els[k], gen((int)n)))), 1, C);
        if (k) parts += ',';
        ok = !giac::ctrl_c && !giac::interrupted && !giac::has_undef_stringerr(x, e) && partsOf(x, c, parts);
      } catch (std::runtime_error &) {
        ok = false;
      }
    }
    o += ok ? parts + "]" : "null";
  }
  o += "}}";
  g_last = o;
  return g_last.c_str();
}

}  // extern "C"
