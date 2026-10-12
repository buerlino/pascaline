<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# R1: F-Droid feasibility of our wasm build (sandra)

Sources: the local `../fdroiddata` checkout (recipes and `srclibs/`), `build-wasm.sh`, and Debian's source index (`sources.debian.org/api/src/emscripten/`). Nothing here was built on an F-Droid server; "likely" marks what is inferred.

## How existing recipes get toolchains and sources
- **Emscripten comes from Debian's package**, installed in the recipe's `sudo:` step (`apt-get install ... emscripten`). Recipes using it: `net.alexbarry.alexgames`, `org.codeberg.nykula.sapfir`, and five `de.tutao.*` builds. **No recipe in the checkout uses emsdk.**
- `alexgames` patches the installed Emscripten with `sed` in `sudo:` (a `preamble.js` fix for Node, and removing `FROZEN_CACHE` from `/usr/share/emscripten/.emscripten`) and notes in `MaintainerNotes` that an upstream Emscripten PR is needed for Node 18. So workarounds in the recipe are accepted, but they are fragile.
- **Third-party source tarballs** are fetched in a `sudo:` or `build:` step with `curl -L` plus `echo "<sha256> file" | sha256sum -c -` (the `de.tutao.*` Node download, the Go tarball in another recipe). Git dependencies use `srclibs/` (e.g. `gmp-unofficial-git`, `zlib@v1.3.1`, `wordfreq@v3.0.2` in `alexgames`). So our pinned, hash-checked downloads of GMP, MPFR, GSL and Giac fit the accepted pattern.
- `alexgames` builds zlib from a srclib with `emconfigure`/`emcmake` inside `build:`, the same shape as our GMP/MPFR/GSL steps.

## Which Emscripten
Debian packages (from the Debian source index): **bookworm 3.1.6**, **trixie 3.1.69**, forky/sid **6.0.5**. Which Debian release F-Droid's build VM currently uses must be checked on their side (not visible in the local checkout); recipes written in 2025 rely on the package of the VM's release, so assume trixie (3.1.69) until confirmed.

Our `engine/giac/build-wasm.sh` is developed against emsdk **6.0.12**. Flags it uses: `-fwasm-exceptions`, `-sMODULARIZE=1 -sEXPORT_ES6=1`, `-sSTACK_SIZE`, `-sENVIRONMENT=web,worker,node`, `-sALLOW_MEMORY_GROWTH`. All of these exist in 3.1.69 as far as I know (from memory, not checked against the 3.1.69 changelog), but **this is untested**. Wasm exceptions also need the browser/WebView to support the final exception-handling proposal (Chromium 95+; fine for WebView 131).

What this means for us:
1. **Test the build with Debian's Emscripten before the recipe is written**: a `debian:trixie` container (Podman is available) with `apt-get install emscripten`, then `build-wasm.sh` with `EMSDK_DIR` unset or pointing at the system toolchain. The script sources `~/emsdk/emsdk_env.sh` today, so it needs a switch ("use `emcc` from PATH"). That is a small change in gorge's file, so I leave it to gorge/Henri.
2. Keep the output reproducible enough that a newer Emscripten only changes the glue, not behaviour: the golden/bench tests (`spike/bench`) should run against both builds.
3. If 3.1.69 fails, options in order: patch flags for the older toolchain; ask F-Droid to allow a pinned emsdk download in `sudo:` (a `curl` + sha256 of the emsdk release tarball is the same pattern as the Node download above; **needs a check with the F-Droid maintainers**, since they prefer distro packages); last resort, ship Giac natively through the NDK (the plan's performance fallback), which F-Droid builds with its own NDK.

## Our other dependencies
- **Giac tarball:** the user is mirroring it under the repo's GitHub releases (`deps-giac-2.1.0-1d9536e0`). Fetching a release asset by hash with `curl` is the accepted pattern; the upstream server is slow, so the mirror is also good for the build server.
- **Pyodide** ships prebuilt wasm and wheels (built by the Pyodide project, not by us), so it cannot be built from source inside an F-Droid recipe in practice. It stays an optional download in non-F-Droid builds (as CLAUDE.md already says), not part of the APK.
- **MicroPython** (MIT) builds from the upstream tag with the same Emscripten, using `ports/webassembly` (`spike/python/build-micropython.sh`, about 1 minute). It needs `mpy-cross` built first (host C compiler). The submodules were **not** initialised in our build (all missing in the submodule status) and the `standard` variant still built, so the recipe does not need `submodules: true` for it. This variant is built with `-s ASYNCIFY` (it makes `await` on JS promises work, which our `calc.cas` bridge uses), so it is bigger and slower than a variant without it.
- **npm packages** (Capacitor, MathLive, JSXGraph, Compute Engine): the Capacitor recipes (`com.graphhopper.maps`, `com.logseq.app`) show that `npm ci` during `prebuild`/`build` is accepted, with `package-lock.json` committed.

## Open questions for the maintainers (do not send tonight)
- Which Debian release and Emscripten version does the build VM provide today, and is a hash-pinned emsdk download acceptable if it is too old?
- Is the wasm build time within their limits? Giac with GSL takes about 5 minutes on 16 cores here, so expect well over an hour on a small VM.
