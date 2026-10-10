// SPDX-License-Identifier: GPL-3.0-or-later
// Minimal C API exported from the Giac wasm module. The worker talks only to these.
#include <emscripten/emscripten.h>
#include <string>

extern "C" const char *caseval(const char *);

namespace {
std::string g_last;
}

// Giac's EMCC/EMCC2 builds expect the host to provide gettext() (see giacintl.h).
// Engine messages stay in English; the UI translates its own strings.
const char *gettext(const char *s) { return s; }

extern "C" {

// Initialise Giac's default context. Safe to call more than once.
EMSCRIPTEN_KEEPALIVE int giac_init() {
  caseval("0");
  return 1;
}

// Evaluate one input. The returned pointer stays valid until the next call.
EMSCRIPTEN_KEEPALIVE const char *giac_eval(const char *input) {
  g_last = caseval(input);
  return g_last.c_str();
}

// LaTeX for an input (evaluated first). Same lifetime rule as giac_eval.
EMSCRIPTEN_KEEPALIVE const char *giac_latex(const char *input) {
  std::string s = "latex(";
  s += input;
  s += ")";
  g_last = caseval(s.c_str());
  return g_last.c_str();
}

// Set a Giac setting by name, e.g. ("Digits", "12") or ("angle_radian", "0").
EMSCRIPTEN_KEEPALIVE const char *giac_set_setting(const char *name, const char *value) {
  std::string s = name;
  s += ":=";
  s += value;
  g_last = caseval(s.c_str());
  return g_last.c_str();
}

}  // extern "C"
