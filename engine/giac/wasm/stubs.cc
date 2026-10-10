// SPDX-License-Identifier: GPL-3.0-or-later
// Link-time stand-ins for symbols Giac references but our wasm build never reaches.
#include <errno.h>
#include <signal.h>

// Used only by the Xcas desktop GUI's forked child processes (global.cc). No processes in wasm.
extern "C" int sigsuspend(const sigset_t *) {
  errno = EINTR;
  return -1;
}

namespace giac {
class gen;
class context;
// Parisse's WebGL 3D renderer (not built). The worker sets UI.disable3d = -1, so caseval
// answers "gl3d_not_supported" before it would call this.
int giac_gen_renderer(const gen &, const context *) { return -1; }
}  // namespace giac
