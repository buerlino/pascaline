// SPDX-License-Identifier: GPL-3.0-or-later
// Minimal C API exported from the Giac wasm module. The worker talks only to these.
// G85 (structured bridge spike, docs/research/structure-hindsight.md 2.1): giac_ctx_get/giac_ctx_set, giac_parse and
// giac_value answer as JSON on the context caseval uses. They change no Giac behaviour (no patch); giac_eval stays.
#include <emscripten/emscripten.h>
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

// Parses like caseval (gen(s, ctx), then equaltosto). `err` is set when Giac's parser reported an error.
gen parseLikeCaseval(const char *s, const giac::context *c, bool &err) {
  giac::first_error_line(0, c);
  gen g(std::string(s), c);
  err = giac::first_error_line(c) != 0;
  return giac::equaltosto(g, c);
}

// ---- bridge-2: the walk ----------------------------------------------------------------------------------------------
struct Walk {
  std::vector<std::string> heads, reads, targets, bound;
  std::set<std::string> seenH, seenR, seenT, seenB;
  bool flt = false, str = false;
  int nodes = 0;
  void add(std::vector<std::string> &v, std::set<std::string> &s, const std::string &x) {
    if (s.insert(x).second) v.push_back(x);
  }
};

std::string headOf(const gen &g) { return g._SYMBptr->sommet.ptr()->s; }

const char *const STORE_HEADS[] = {"sto", "array_sto", "increment", "decrement", "multcrement", "divcrement", "purge", "DelVar"};
// Commands whose second argument is a variable they bind (not a read): sum(f,k,a,b), int(f,x,a,b), seq(f,k=a..b) …
// Giac's own lname binds int, integrate and sum (prog.cc lidnt); the others are ours.
const char *const BINDERS[] = {"sum", "product", "seq", "int", "integrate", "romberg", "gaussquad", "diff", "derive", "limit",
                               "solve", "fsolve", "csolve", "series", "taylor", "fMax", "fMin", "nSolve", "fminbnd"};
bool among(const std::string &h, const char *const *list, size_t n) {
  for (size_t k = 0; k < n; ++k)
    if (h == list[k]) return true;
  return false;
}

void walk(const gen &g, Walk &w, bool target);

// A store target: a name, `L[k]` (L stored, k read), or a list of targets.
void walkTarget(const gen &t, Walk &w) {
  if (t.type == giac::_IDNT) {
    w.add(w.targets, w.seenT, t._IDNTptr->id_name);
    return;
  }
  if (t.type == giac::_VECT) {
    for (const gen &x : *t._VECTptr) walkTarget(x, w);
    return;
  }
  if (t.type == giac::_SYMB && headOf(t) == "at" && t._SYMBptr->feuille.type == giac::_VECT && !t._SYMBptr->feuille._VECTptr->empty()) {
    const giac::vecteur &v = *t._SYMBptr->feuille._VECTptr;
    walkTarget(v[0], w);
    walk(v[0], w, false);  // L[k]:= keeps L's other elements: it reads L
    for (size_t k = 1; k < v.size(); ++k) walk(v[k], w, false);
    return;
  }
  walk(t, w, false);
}

void bindAll(const gen &p, Walk &w) {
  if (p.type == giac::_IDNT) w.add(w.bound, w.seenB, p._IDNTptr->id_name);
  else if (p.type == giac::_VECT)
    for (const gen &x : *p._VECTptr) bindAll(x, w);
  else if (p.type == giac::_SYMB && p._SYMBptr->feuille.type == giac::_VECT && !p._SYMBptr->feuille._VECTptr->empty())
    bindAll(p._SYMBptr->feuille._VECTptr->front(), w);  // x=a..b, x=default: the name
}

void walk(const gen &g, Walk &w, bool) {
  ++w.nodes;
  switch (g.type) {
    case giac::_DOUBLE_:
    case giac::_REAL:
    case giac::_FLOAT_:
      w.flt = true;
      return;
    case giac::_CPLX:
      walk(g._CPLXptr[0], w, false);
      walk(g._CPLXptr[1], w, false);
      return;
    case giac::_STRNG:
      w.str = true;  // a leaf: a := inside a string is never a store
      return;
    case giac::_IDNT: {
      if (g == giac::cst_pi || g == giac::cst_euler_gamma) return;  // as lname
      w.add(w.reads, w.seenR, g._IDNTptr->id_name);
      return;
    }
    case giac::_FUNC:
      w.add(w.heads, w.seenH, g._FUNCptr->ptr()->s);  // a function passed as a value: (tanh)(1+i), map(L,f)
      return;
    case giac::_VECT:
      for (const gen &x : *g._VECTptr) walk(x, w, false);
      return;
    case giac::_FRAC:
      walk(g._FRACptr->num, w, false);
      walk(g._FRACptr->den, w, false);
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
  if (among(h, STORE_HEADS, sizeof STORE_HEADS / sizeof *STORE_HEADS)) {
    if (h == "sto" || h == "array_sto") {
      if (v && v->size() == 2) {
        walk((*v)[0], w, false);
        walkTarget((*v)[1], w);
        return;
      }
    } else if (h == "purge" || h == "DelVar") {
      walkTarget(f, w);
      return;
    } else {  // increment(a[,k]) and the others: a is stored and read
      const gen &t = v && !v->empty() ? (*v)[0] : f;
      walkTarget(t, w);
      walk(t, w, false);
      if (v)
        for (size_t k = 1; k < v->size(); ++k) walk((*v)[k], w, false);
      return;
    }
  }
  if (h == "program" && v && v->size() == 3) {  // (params, defaults, body)
    bindAll((*v)[0], w);
    walk((*v)[1], w, false);
    walk((*v)[2], w, false);
    return;
  }
  if (h == "local" && v && v->size() == 2) {  // local [names] body
    bindAll((*v)[0], w);
    walk((*v)[1], w, false);
    return;
  }
  if (among(h, BINDERS, sizeof BINDERS / sizeof *BINDERS) && v && v->size() >= 2) {
    bindAll((*v)[1], w);
    for (size_t k = 0; k < v->size(); ++k)
      if (k == 1 && (*v)[1].type != giac::_IDNT && (*v)[1].type == giac::_SYMB)
        walk((*v)[1]._SYMBptr->feuille.type == giac::_VECT && (*v)[1]._SYMBptr->feuille._VECTptr->size() == 2
                 ? (*v)[1]._SYMBptr->feuille._VECTptr->back()
                 : gen(0),
             w, false);  // k=a..b: the bounds are read
      else if (k != 1)
        walk((*v)[k], w, false);
    return;
  }
  walk(f, w, false);
}

// ---- bridge-3: kinds and parts -------------------------------------------------------------------------------------
const size_t CUT = 2048;

const char *kindOf(const gen &g, bool error) {
  if (error) return "error";
  if (giac::is_undef(g)) return "undef";
  switch (g.type) {
    case giac::_INT_:
    case giac::_ZINT:
      return "integer";
    case giac::_FRAC:
      return g._FRACptr->num.type <= giac::_ZINT && g._FRACptr->den.type <= giac::_ZINT ? "rational" : "symbolic";
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

bool isNumber(const gen &x) { return x.type == giac::_INT_ || x.type == giac::_ZINT || x.type == giac::_DOUBLE_ || x.type == giac::_REAL || x.type == giac::_FRAC; }

// Real and imaginary part of an evaluated number, printed; false when it is not a number.
bool partsOf(const gen &x, const giac::context *c, std::string &o) {
  gen a = giac::re(x, c), b = giac::im(x, c);
  if (!isNumber(a) || !isNumber(b)) return false;
  o += '[';
  jstr(o, a.print(c));
  o += ',';
  jstr(o, b.print(c));
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

// bridge-1: every setting of caseval's context as one JSON object (global.h accessors). angle_mode: 0 rad, 1 deg, 2 grad.
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
    double v;
    if (!strncmp(p, "true", 4)) v = 1, p += 4;
    else if (!strncmp(p, "false", 5)) v = 0, p += 5;
    else {
      char *e;
      v = strtod(p, &e);
      if (e == p) return fail("not a number or boolean: " + key);
      p = e;
    }
    gen a((int)v);
    if (key == "decimal_digits") giac::_Digits(a, c);
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
    else return fail("unknown setting: " + key);
  }
  return giac_ctx_get();
}

// bridge-2: Giac's tree of `text`, not evaluated, as JSON: {"ok","heads","reads","targets","bound","float","string",
// "nodes"}. heads: every function node (and a function passed as a value); reads: free names (pi and euler_gamma left
// out, as lname does; bound names and pure store targets left out); targets: names a store sets (sto, =>, :=, L[k]:=,
// increment and the other +=, purge); bound: program parameters, locals and the variable of sum/int/seq …; float: a
// float literal occurs. Strings are leaves. ok false: Giac's parser reported an error.
EMSCRIPTEN_KEEPALIVE const char *giac_parse(const char *text) {
  const giac::context *c = ctx();
  bool err = false;
  Walk w;
  try {
    gen g = parseLikeCaseval(text, c, err);
    walk(g, w, false);
  } catch (std::runtime_error &e) {
    err = true;
  }
  std::vector<std::string> reads;
  for (const std::string &n : w.reads)
    if (!w.seenB.count(n) && !(w.seenT.count(n) && !w.seenR.count(n))) reads.push_back(n);
  std::string o = "{";
  jkey(o, "ok"), o += err ? "false" : "true";
  jkey(o, "heads"), jlist(o, w.heads);
  jkey(o, "reads"), jlist(o, reads);
  jkey(o, "targets"), jlist(o, w.targets);
  jkey(o, "bound"), jlist(o, w.bound);
  jkey(o, "float"), o += w.flt ? "true" : "false";
  jkey(o, "string"), o += w.str ? "true" : "false";
  jkey(o, "nodes"), o += std::to_string(w.nodes);
  o += '}';
  g_last = o;
  return g_last.c_str();
}

// bridge-3: evaluates `text` once, as caseval does (parse, equaltosto, history, protecteval under the same timeout and
// interrupt state), and returns {"kind","text","num","den","shape","elements","at":{"P":[[re,im]…]},"cut"}.
// text: Giac's print (an error as caseval prints it, "GIAC_ERROR: …"); num/den: an integer's or rational's; elements: a
// list's or matrix's printed elements (rows flattened), with shape [n] or [rows, cols]; at: for each precision in
// `precisions` ("12,32"), the real and imaginary part of every element of evalf(value, P), or null when it is not a
// number. A text over 2 kB gives only kind, a cut text and "cut":true.
EMSCRIPTEN_KEEPALIVE const char *giac_value(const char *text, const char *precisions) {
  const giac::context *c = ctx();
  giac::context *C = const_cast<giac::context *>(c);
  startClock();
  gen r;
  bool err = false;
  std::string S;
  try {
    bool perr = false;
    gen g = parseLikeCaseval(text, c, perr);
    giac::history_in(C).push_back(g);  // as caseval: ans() and the history see this input
    r = giac::protecteval(g, 1, C);
    giac::history_out(C).push_back(r);
    err = giac::has_undef_stringerr(r, S);
    S = err ? "GIAC_ERROR: " + S : r.print(c);
  } catch (std::runtime_error &e) {
    err = true;
    S = std::string("GIAC_ERROR: ") + e.what();
  }
  std::string o = "{";
  jkey(o, "kind"), jstr(o, kindOf(r, err));
  if (S.size() > CUT) {
    jkey(o, "text"), jstr(o, S.substr(0, CUT));
    jkey(o, "cut"), o += "true";
    o += '}';
    g_last = o;
    return g_last.c_str();
  }
  jkey(o, "text"), jstr(o, S);
  if (err) {
    o += '}';
    g_last = o;
    return g_last.c_str();
  }
  if (r.type == giac::_INT_ || r.type == giac::_ZINT) {
    jkey(o, "num"), jstr(o, S);
    jkey(o, "den"), jstr(o, "1");
  } else if (r.type == giac::_FRAC && r._FRACptr->num.type <= giac::_ZINT && r._FRACptr->den.type <= giac::_ZINT) {
    jkey(o, "num"), jstr(o, r._FRACptr->num.print(c));
    jkey(o, "den"), jstr(o, r._FRACptr->den.print(c));
  }
  std::vector<gen> els;
  elementsOf(r, els);
  bool vect = r.type == giac::_VECT && r.subtype != giac::_SEQ__VECT && r.subtype != giac::_SET__VECT;
  if (vect) {
    jkey(o, "shape");
    if (giac::ckmatrix(r)) o += "[" + std::to_string(r._VECTptr->size()) + "," + std::to_string(r._VECTptr->front()._VECTptr->size()) + "]";
    else o += "[" + std::to_string(r._VECTptr->size()) + "]";
    jkey(o, "elements"), o += '[';
    for (size_t k = 0; k < els.size(); ++k) {
      if (k) o += ',';
      jstr(o, els[k].print(c));
    }
    o += ']';
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
    bool ok = !giac::ctrl_c && !giac::interrupted;
    for (size_t k = 0; ok && k < els.size(); ++k) {
      gen x;
      try {
        x = giac::_evalf(giac::makesequence(els[k], gen((int)n)), c);
      } catch (std::runtime_error &) {
        ok = false;
        break;
      }
      if (k) parts += ',';
      ok = !giac::ctrl_c && !giac::interrupted && partsOf(x, c, parts);
    }
    o += ok ? parts + "]" : "null";
  }
  o += '}';
  o += '}';
  g_last = o;
  return g_last.c_str();
}

}  // extern "C"
