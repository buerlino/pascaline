# SPDX-License-Identifier: GPL-3.0-or-later
# Pascaline's MicroPython variant (python/build-micropython.sh passes VARIANT_DIR); see mpconfigvariant.h.
# Asyncify as in upstream's standard variant: the GC scans the stack with it, and our _host module
# (python/modules/host) suspends Python on it for synchronous calc calls.
JSFLAGS += -s ASYNCIFY
# _host suspends the whole Python call stack (exec -> compile -> user frames); the default 4 KiB
# Asyncify buffer overflows on it and on GC stack scans inside nested calls.
JSFLAGS += -s ASYNCIFY_STACK_SIZE=131072
# Upstream links without -O, i.e. at -O0: no Binaryen optimisation of the Asyncify code and runtime
# assertions left on. -O2 at link time halves the wasm and makes loops about twice as fast.
JSFLAGS += -O2
