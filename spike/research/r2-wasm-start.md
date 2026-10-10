<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# R2: fast wasm start on Android WebView

Measured on the Lenovo Tab One (Android 15, WebView 131.0.6778.260, release build, plugged in, 29-30 C), cold start =
`am force-stop` then `am start -W`, 7-8 runs per series, medians, time counted from process start. Giac wasm is 9.75 MB.
Raw data: `.coord/device-runs.jsonl`. Tools: `spike/tools/device_run.py`, `spike/tools/probe-wasm.py`
(probe page `spike/app/public/wasmstart.html`).

## Result: one change kept, three checked

| Series | wasm instantiate | engine ready | first result |
|---|---|---|---|
| Baseline: wasm deflated in the APK | 366 ms | 975 ms | 1071 ms |
| **Kept: wasm stored uncompressed (`noCompress 'wasm'`)** | **286-300 ms** | **898-905 ms** | **1004-1009 ms** |
| Rejected: stored + Cache API copy of the wasm | 257 ms | 967 ms | 1064 ms |

- **(a) MIME and streaming: already fine.** Capacitor's local server maps `.wasm` to `application/wasm`
  (`WebViewLocalServer.java`), and Emscripten's glue calls `WebAssembly.instantiateStreaming` first. The probe page's
  `compileStreaming(fetch(...))` works, which it would not with a wrong type. Nothing to change.
- **(b) Uncompressed in the APK: keep.** Compiling the module alone (probe, in a worker): 184 ms deflated, 110 ms stored. Whole cold start
  drops about 75-80 ms (975 to ~900 ms ready). Cost: the APK grows from 6.6 MB to 14.3 MB. Set in `spike/android/overlay/init.gradle`;
  the real build needs `android { androidResources { noCompress 'wasm' } }` in `app/build.gradle`. Note that an APK-level
  compression only matters for install size, not for F-Droid rules.
- **(c) Making V8 cache the compiled code: no gain in the full app.** Capacitor serves the files through `shouldInterceptRequest`, and every
  launch recompiles (instantiate time is the same on the first launch after install and the later ones). Putting a copy into the Cache API and
  compiling from that response looked good in isolation (probe: 184 to 92 ms), but in the real engine (`instantiateWasm` hook with
  `instantiateStreaming(cacheResponse)`) the end-to-end numbers did not improve (ready 967 vs 883-978 ms for the same build without it, within noise,
  first result 1064 vs 975-1075 ms). Not kept, code removed. Compiling on the main thread instead of a worker is slower (224 vs 184 ms) and
  would block the UI, so the worker stays.

## What is left of the 900 ms
Activity creation 370 ms (Capacitor/WebView start, not ours), JS start at 560 ms, then about 340 ms to engine ready (fetch + compile + instantiate
~290 ms, `giac_init` under 1 ms). Further ideas, not tried: a smaller wasm (`-Oz`, dropping unused Giac parts), a splash screen that hides
the wait, starting the worker before the JS bundle finishes, and a Capacitor plugin that hands WebView a code-cached module (high effort).
Measurements are noisy at the 50-100 ms level (single runs of 1100-1200 ms appear in every series).

## Links
- WebAssembly streaming compilation and code caching in V8: https://v8.dev/blog/wasm-compilation-pipeline
- Emscripten `instantiateWasm` hook: https://emscripten.org/docs/api_reference/module.html
- Android `noCompress` (AAPT2): https://developer.android.com/reference/tools/gradle-api/8.13/com/android/build/api/dsl/AndroidResources
