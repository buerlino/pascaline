// SPDX-License-Identifier: GPL-3.0-or-later
// `_host`: a synchronous call from Python into the worker's JavaScript (MicroPython user C module).
// `_host.call(request: str) -> str` suspends the wasm stack with Asyncify (EM_ASYNC_JS) until the
// worker's `Module.pascalineHost(request)` promise resolves. This is what makes `calc.cas(...)`
// a plain function call: no `await`, no SharedArrayBuffer, no COOP/COEP.
// The caller must enter Python through an async ccall (see app/src/python/pyHost.ts).
#include <string.h>
#include <stdlib.h>
#include <emscripten.h>
#include "py/runtime.h"
#include "py/objstr.h"

EM_ASYNC_JS(char *, pascaline_host_call, (const char *req, size_t len), {
    const host = Module.pascalineHost;
    let out;
    try {
        out = host ? String(await host(UTF8ToString(req, len))) : "E:no host";
    } catch (e) {
        out = "E:" + String(e && e.message ? e.message : e);
    }
    // stringToNewUTF8 isn't linked into this port; the runtime methods below are exported.
    const n = Module.lengthBytesUTF8(out) + 1;
    const p = Module._malloc(n);
    Module.stringToUTF8(out, p, n);
    return p;
});

static mp_obj_t host_call(mp_obj_t req_in) {
    size_t len;
    const char *req = mp_obj_str_get_data(req_in, &len);
    char *res = pascaline_host_call(req, len);
    mp_obj_t ret = mp_obj_new_str(res, strlen(res));
    free(res);
    return ret;
}
static MP_DEFINE_CONST_FUN_OBJ_1(host_call_obj, host_call);

static const mp_rom_map_elem_t host_module_globals_table[] = {
    { MP_ROM_QSTR(MP_QSTR___name__), MP_ROM_QSTR(MP_QSTR__host) },
    { MP_ROM_QSTR(MP_QSTR_call), MP_ROM_PTR(&host_call_obj) },
};
static MP_DEFINE_CONST_DICT(host_module_globals, host_module_globals_table);

const mp_obj_module_t host_user_cmodule = {
    .base = { &mp_type_module },
    .globals = (mp_obj_dict_t *)&host_module_globals,
};

MP_REGISTER_MODULE(MP_QSTR__host, host_user_cmodule);
