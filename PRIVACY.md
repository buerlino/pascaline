<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Privacy

Pascaline is a calculator. It has **no analytics, no accounts, no advertising and no tracking**, and it sends nothing about you or your calculations anywhere.

## What it stores

Everything lives on your device, in the browser's or the WebView's **IndexedDB** (database `pascaline`, store `kv`):

- your settings (for example the mode, the number format, the theme and the keys you assigned),
- the history of your calculations and their results,
- the variables, functions and library text you defined,
- the state of each app.

Nothing leaves the device. You can delete it all by clearing the app's data (Android: Settings › Apps › Pascaline › Storage › Clear data; browser: clear the site's data). Uninstalling the app removes it too. The Android app switches Android's cloud backup off (`allowBackup="false"`), so Android does not copy this data to Google either.

The web version also keeps its own program files in the browser's cache (a service worker), so that it works offline. That cache holds the app, not your data.

## What it sends

**Nothing.** The calculations run on your device (the maths engine is part of the app).

- **Web version:** the page and its files are loaded from `pascaline-calc.org`. Like any web server, the one behind that address may log the request itself (time, address of the file, your IP address) under its provider's terms; the app sends nothing else, and the page contains no third-party scripts, fonts or trackers.
- **Android app:** everything is inside the APK. The app does not ask for the `INTERNET` permission, so it cannot reach the network at all.

## Android permissions

| Permission | Why |
|---|---|
| `VIBRATE` | A short vibration when you press a key (a normal permission, granted at install, no prompt). |

That is the only permission the app asks for. It has no access to your contacts, location, camera, microphone, photos or files. Two things use Android's own system dialogs and only when you ask: **paste** reads the clipboard when you press the paste key, and **share** opens Android's share sheet (you choose where the text goes). (The merged manifest also lists a signature-level permission of the form `<application id>.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`, added by AndroidX: only this app can hold it, and Android shows nothing to you for it.)

## Contact

Questions: open an issue at https://github.com/buerlino/pascaline/issues. This statement changes only with a release, and its history is in the repository.
