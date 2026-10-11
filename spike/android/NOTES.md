<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Android shell and device service (spike step 3)

Capacitor **8.5.3** (`@capacitor/core`, `/android`, `/cli`, MIT; pinned exactly). It needs Android API 24+
(so API 26/28 old tablets are fine), compileSdk/targetSdk 36 (installed via `sdkmanager "platforms;android-36"`),
AGP 8.13, Gradle 8.14.3 (downloaded by the wrapper), Java 21, Node 22+. The app ID is the placeholder
`org.pascaline.app`. The generated `spike/app/android/` is gitignored; `spike/android/overlay/` holds what we change.

## Build and install (anyone can build, only annabell installs)
```bash
tools/device-build.sh [--app DIR] [--debug|--release] [--install]   # prints the APK path
```
Builds the web app (engine from the main checkout's `engine/giac/_out/gsl`), runs `cap add android` once, copies
the overlay, `cap sync`, then Gradle under the `host-cpu` lock. Release is signed with a throwaway key
(`spike/android/_keys/`, gitignored). `DIR` can be any Vite project set up like `spike/app` (ron's, sandra's).

## Timing marks
- Java, logcat tag `PASCALINE_T`: `proc-start`, `activity-created` (ms since process start).
- JS (`src/marks.ts`, `console.log`, tag `Capacitor/Console`, text prefix `PASCALINE_T`): `js-start`,
  `engine-ready` (with `instantiateMs` = fetch+compile+instantiate, `initMs`), `first-result`. Release builds
  need `loggingBehavior: 'production'` in `capacitor.config.ts` or the console output is dropped.
- All marks carry device epoch ms; the tools subtract `proc-start`.

## Running things on the tablet
```bash
tools/devlock.sh acquire HA24BZ2Y annabell
tools/device_run.py status
tools/device_run.py start --mode first|cold|warm --runs 7
tools/device_run.py bench --runs 5          # 55 cases/launch from spike/bench/cases.yaml
tools/device_run.py page "/other.html?x=1" --wait <mark> --timeout 60   # another page of the same app
tools/runs_summary.py                       # medians from .coord/device-runs.jsonl
```
`start`: `first` = reinstall (no WebView code cache), `cold` = `am force-stop` then `am start -W`,
`warm` = app sent to background (see also the keyboard-page section at the end) and brought back (process alive). Other apps' pages ride in the same APK:
put the page in `public/`, and `page` opens it through the `--es path` extra handled by `MainActivity`.

## Keyboard page on the tablet (ron, `night/ron@7ead564`, `spike/input`)
Built with its own `npm run build`, copied into `spike/app/public/input/` (gitignored) so the shell serves it at
`/input/index.html`. Taps with `tools/tap-seq.py` (`adb input tap`), cold starts with `tools/shots.py`
(numbers that only exist on screen are read from screenshots). Release build, WebView 131.0.6778.260, battery 70-71%, 29 C:
`mInputShown=false` after the field tap and after each of 1, a/b, 2, right, +, 3; field shows 1/2+3, Giac line `1/2+3`.
Status line over 5 cold starts: ready 301/291/298/324/296 ms (median 298), serializer 1241/1223/1214/1236/1223 ms
(median 1223); first launch after install 355/1267. Raw record: `.coord/device-runs.jsonl`, kind `keyboard-page`.
Second run with ron's own parser (`night/ron-parser@a58e65a`, wasm uncompressed build): same checks pass; ready 314/299/296/309/317 ms
(median 309), serializer 370/359/369/377/384 ms (median 370, vs 1223 with Compute Engine); battery 80%, 30 C.
