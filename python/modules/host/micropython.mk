# SPDX-License-Identifier: GPL-3.0-or-later
# MicroPython user C module `_host` (see host.c).
HOST_MOD_DIR := $(USERMOD_DIR)
SRC_USERMOD_C += $(HOST_MOD_DIR)/host.c
# _host suspends the whole Python call stack (exec -> compile -> user frames); the default 4 KiB
# Asyncify buffer overflows on it and on GC stack scans inside nested calls.
JSFLAGS += -s ASYNCIFY_STACK_SIZE=131072
# Upstream links without -O, i.e. at -O0: no Binaryen optimisation of the Asyncify instrumentation and
# runtime assertions left on. -O2 at link time makes Python loops several times faster (see app/src/python/README.md).
JSFLAGS += -O2
