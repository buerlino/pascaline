// SPDX-License-Identifier: GPL-3.0-or-later
// Pascaline's MicroPython variant: upstream's "standard" webassembly variant without the JS hook.
// The hook polls for Ctrl-C every 10 bytecodes (under Node it reads process.stdin, which fails in a
// worker thread). We never need it: Cancel terminates the worker.
#define MICROPY_VARIANT_ENABLE_JS_HOOK (0)
