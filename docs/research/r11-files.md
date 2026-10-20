<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# R11: files in and out without INTERNET, and the backup (package S6, 2026-10-20)

sandra, for the owner and for packages R38a, R38b (and R59, which sends a library out the same way). It also closes S4's open point (R10 section 2: does the file picker open in the WebView, and does the system keyboard stay closed). The frame: the app has no INTERNET permission and must stay 100 % offline (`docs/rules-core.md`, F-Droid); the manifest holds VIBRATE only (`android/app/src/main/AndroidManifest.xml:41`), and A11 keeps it that way.

**Probe:** `node tools/probes/backup-file.mjs [--size]`: the file's size at the limits (caps read from the sources), the restore checks on a good file and one bad file per refusal, and Playwright's Chromium 156 (headless, desktop Linux, page served from `https://localhost` like Capacitor's) for `<a download>`, `<input type="file">`, Web Share and the File System Access pickers. **Source reading:** `@capacitor/android` 8.5.3, `@capacitor/share` 8.0.3 and `@capacitor/filesystem` 8.1.5, unpacked from `npm pack` into scratch; the filesystem plugin's native dependencies from Maven Central.

## 0. Answer

1. **Out:** one small native method, `save(name, mime, text)`, on our local plugin (next to `PascalineHapticsPlugin`): it opens Android's own "Save to" screen (`ACTION_CREATE_DOCUMENT`, the system file picker in save mode) and writes the text where the user picked. **No permission, no new dependency, no FileProvider.** The PWA uses `<a download>` of a Blob. Web Share with a file and a WebView download do not work today; `@capacitor/filesystem` would work but costs about 1.6 MB of unshrunk jars and a Kotlin build step.
2. **In:** `<input type="file">`, on both platforms, as R10 already found for libraries. Capacitor opens Android's picker for it with no plugin and no permission. In Chromium the focus never reaches a text field. **"Open with" waits** (manifest plus native code, and every JSON file on the phone would offer Pascaline). The File System Access API is not needed.
3. **The file:** JSON, `pascaline-backup-YYYY-MM-DD.json`, one part per stored key, each **as stored, with its stamp**. Typical size at the limits is 190 kB; the worst case is 1.98 MB. A restore checks the whole file before it writes anything and refuses all of it on the first fault (a newer version, a broken or missing stamp, an unknown part, a part its key's validator rejects). It then **replaces** the parts the user ticks, all in one transaction. The replaced records are kept for one Undo, and the app reloads.

## 1. Out: a file leaves the app

| Way | Works? | Evidence | Cost |
|---|---|---|---|
| **Web Share with a file** (`navigator.share({ files })`) | **no**, in the APK | the Tab One's WebView 131 has no `navigator.share` at all (A4a, docs/04 2.6), so `canShare({ files })` cannot be asked; headless desktop Chromium 156 has neither (probe: `share: undefined, canShare: undefined`) | none, but no way |
| **`<a download>`** of a Blob in the **WebView** | **no** | Capacitor 8.5.3's bridge sets no `DownloadListener` (`grep -rn DownloadListener` over `@capacitor/android/capacitor/src/main/java`: no hit), so the WebView drops the download; a `blob:` URL lives only inside the page, so a listener could not hand it to Android's download manager anyway | none, but no way |
| **`<a download>`** in the **PWA** | **yes** (desktop Chromium); Chrome for Android **(to verify, annabell)** | probe: a click starts a download named `pascaline-backup-2026-10-20.json`, 194 307 bytes, the same bytes | none |
| **`@capacitor/share` 8.0.3 + `@capacitor/filesystem` 8.1.5** (write the file to the cache folder, then share it) | yes | Share takes `file://` URLs only (`SharePlugin.java:167-188`, "only file urls are supported") and wraps them with `FileProvider.getUriForFile(…, packageName + ".fileprovider", …)`; our manifest already has that provider with a `cache-path` (`AndroidManifest.xml:27-35`, `res/xml/file_paths.xml`). Neither plugin's manifest adds a permission (both are empty). The filesystem plugin asks for storage permissions only for the public Documents and external folders (`FilesystemPlugin.kt:40-48`, `LegacyFilesystemImplementation.kt:47-53`), not for the cache. | share: 108 kB unpacked, Java, A11 adds it anyway. filesystem: 520 kB unpacked plus `ionfilesystem-android` 1.1.1 (172 kB aar) and `kotlinx-coroutines` 1.10.2 (1.48 MB + 18 kB jars), and the Kotlin Gradle plugin in our build (`build.gradle:7-30` of the plugin). Our release has `minifyEnabled false` (`android/app/build.gradle:39`), so all of it ships. Also, the share sheet offers apps to *send* to; whether it offers "save into a folder" depends on the phone **(to verify, annabell)** |
| **Our `save` method: `ACTION_CREATE_DOCUMENT`** (recommended) | yes **(to verify on the Tab One, annabell, in A11)** | the system "Save to" screen (Downloads, and Drive or Nextcloud when they are installed) returns a URI that the app may write once (`ContentResolver.openOutputStream(uri, "wt")`): the storage access framework, no permission. Capacitor plugins have `startActivityForResult(call, intent, "callback")`, as `SharePlugin.java:161` uses | about 50 lines of Java in `android/` (annabell); APK growth a few kB; no FileProvider, no dependency |

**Recommendation: our `save` method in the APK, `<a download>` in the PWA, behind one port.** It needs no new permission, no dependency, and a backup ends up where the user chose, under a name they can see. The share sheet answers a different question ("send this to someone"). For a backup it is a detour, and with Filesystem it costs 1.6 MB. A11 already brings `@capacitor/share` for text. If the owner later wants "send the backup", Share plus a 10-line write-to-cache in the same plugin gives it without Filesystem.

The port (web side, `app/src/clipboard/` or a new `app/src/files/`): `saveFile(name: string, mime: string, text: string): Promise<"saved" | "cancelled" | "failed">`. Native when `Capacitor.isPluginAvailable("PascalineFiles")`, else the download. It is loaded lazily like the clipboard chunk (never in the start chunk). R59 (library export) uses the same port with `text/plain`.

## 2. In: a file comes into the app

- **`<input type="file">`: yes, with no plugin.** Capacitor's `BridgeWebChromeClient.onShowFileChooser` (`:276-301`) goes to `showFilePicker` (`:375-406`), which launches `fileChooserParams.createIntent()` (Android's picker, a one-time read grant). It asks for the camera only for an image or video capture, so no storage permission is involved. With more than one accept type, or an extension, it maps them to MIME types (`getValidTypes`, `:380-386, 408ff`): `.json` becomes `application/json`. R10 section 2 read the same lines. Probe (Chromium): a hidden input opened by `click()` from a button opens the chooser, the bytes come back unchanged (194 307), and afterwards `document.activeElement` is the button (not editable). The input is `display:none`, so it never takes focus.
- **The system keyboard:** Android shows it only for an editable focused node, and none is focused here (probe). The picker is a second activity, though, so the app goes away and comes back. That is the same return path as F9/F11 (the field must not take focus again on return; decisions "Nothing takes focus while the app is away", R22). **(to verify on the Tab One, annabell, in A11: open the picker, cancel; open it, pick a file; the system keyboard stays closed both times and the entry line does not take focus.)**
- **The accept filter:** use no `accept` at all and let the check (section 3.4) refuse what is not a backup. A file that came via a laptop or a cloud app is often labelled `application/octet-stream`, and a MIME filter would grey it out with no reason given **(to verify, annabell: the same file from Downloads and from Drive, with and without `accept`)**. A file our `save` wrote has the type `application/json`, so a filter would only help for files we wrote ourselves.
- **"Open with" (tap the file in a file manager): not now.** It needs an `intent-filter` (`VIEW`, `DEFAULT`, `mimeType="application/json"`) on `MainActivity`, which makes Pascaline offer itself for every JSON file on the phone. An extension filter (`pathPattern=".*\\.json"`) does not match the `content://` URIs that file managers send **(to verify, annabell)**. On the native side it needs `handleOnNewIntent` in our plugin (Capacitor passes new intents to plugins, `Bridge.java:1312-1318`; the first intent at start too, `BridgeActivity.java:51`), a `ContentResolver.openInputStream` read, and an event the page picks up once it listens, kept until then for a cold start. That is about 0.5 d for annabell, and no e2e can cover it. Open it when the owner misses it after use (the same rule as R10's).
- **The File System Access API in the PWA: not needed.** Desktop Chromium has `showSaveFilePicker` and `showOpenFilePicker` in a secure context (probe). Firefox and Safari do not, nor the Android WebView; Chrome for Android **(to verify)**. `<a download>` and `<input type="file">` cover every browser with one code path, so the API would only add a second path.

## 3. The file

### 3.1 Format
```json
{
  "pascaline-backup": 1,
  "dataVersion": 3,
  "made": "2026-10-20T02:00:00Z",
  "parts": {
    "settings": { "@pascaline": 3, "value": { "schema": 2, "digits": 12, "format": "std", "…": "…" } },
    "history":  { "@pascaline": 3, "value": { "home": [ … ], "cas": [ … ] } },
    "defs":     { "@pascaline": 3, "value": [ … ] }
  }
}
```
- `pascaline-backup` is the file format's own number (1). It changes only if the envelope changes; the parts carry their own stamps.
- `dataVersion` is the exporting app's `DATA_VERSION` (`storage.ts:25`) and `made` is the time. Both are for the summary only; the parts' stamps decide.
- **Each part is the record as stored**, read raw from IndexedDB without `unstamp`. A record with no stamp (version 0, before 2026-10-14) is exported as `{ "@pascaline": 0, value }`. A record from a newer version (the app was downgraded, `storage.ts:49-50`) keeps its own stamp, so the file never claims a version it does not have. That needs a raw read in `storage.ts` (R38a): `kvGet` migrates on read and would hide the true version.
- Compact JSON, UTF-8, no BOM; the name is `pascaline-backup-YYYY-MM-DD.json`.

### 3.2 What it holds
Every key of docs/04 6.2 that is the user's state: `settings`, `view`, `place`, `entry`, `history`, `defs`, `userKeys`, `taps`, `app.function`, `app.solve`, and `units.targets` and `units.history` once milestone 5 has them. The unit pad's user cells join as their key is created (R9). **Left out:** `defsStarts`, the per-install count of starts that never got ready (G19); restored, it could make the engine skip the replay. A new key joins the backup by being added to the list. The probe's `KEYS` is the reference, and R38a's e2e fails when a key in docs/04 6.2 is in neither the list nor the left-out line.

### 3.3 Size at the limits (probe, compact JSON)
| Case | File | history | defs | the rest |
|---|---|---|---|---|
| typical (everyday rows as the app writes them, 200 + 200 history, 500 definitions) | **190 kB** | 111 kB | 78 kB | < 1 kB |
| worst (every text at its cap: `full` 2048, `preview` 200, `desc` 120, long LaTeX) | **1.98 MB** | 1.71 MB | 275 kB | < 1 kB |

The caps come from the sources (`HISTORY_LIMIT` 200, `FULL_LIMIT` 2048, `MAX_DEFS` 500, `PREVIEW_MAX` 200, `DESC_MAX` 120). The typical rows are built from `HistoryItem`'s fields (`session.svelte.ts:75-111`), not taken from a real phone (to verify: R38a's e2e prints the size of a real export). **Limit: a restore refuses a file over 4 MB** (twice the worst case). A file over 4 MB cannot be one we wrote, and a limit keeps a wrong pick, such as a video, from being read into memory. Through the Capacitor bridge, 2 MB is one JSON string (to verify, annabell: the `save` time for the worst case on the Tab One, median of 5).

### 3.4 What a restore refuses (all or nothing)
In order. The first fault refuses the whole file with a message naming the part, and nothing is written (probe: one bad file per line, each refused with this reason):
1. over 4 MB; not UTF-8; not JSON (a library file is refused here: "not a backup, import it as a library");
2. no `pascaline-backup` field, or not a whole number ≥ 1; **a newer format** than this app reads ("made by a newer Pascaline");
3. `parts` missing or not an object; **a part this version does not know** (from a newer app, or a broken file);
4. a part without `@pascaline` or `value`; **a broken stamp** (not a whole number ≥ 0, or text such as `"3"`); **a part newer than `DATA_VERSION`** ("made by a newer Pascaline (version 4; this one reads up to 3)"). The whole file is refused, not just that part, because history chips and definitions must come from the same state;
5. after `unstamp(key, record)` (the same migration steps as a stored value, `storage.ts:50-59`), **the key's own validator**, which is the one the app runs when it reads that key at start: `migrateSettings` for settings (`session.svelte.ts:197`), `restoreHistory`'s filter for history (`session.svelte.ts:757-760`), `userKeys.svelte.ts`'s check for the slots, and the defs log's load check. A key that has no validator yet gets one in R38b (to verify per key in R38b). Then a part whose rows the validator would drop counts as a fault, so a restore never loses rows silently.

A part missing from the file is not a fault. A file made before `units.history` existed simply has no such part, and the stored key stays as it is.

### 3.5 Replace, by part
- **Replace, not merge.** The sheet shows what the file holds ("made 2026-10-20 by version 3: Home 143 and CAS 37 rows, 212 definitions, settings, 3 user keys") with one tick per part, all ticked. Restore replaces the ticked keys in **one IndexedDB transaction** (a `kvSetMany`, stamped `DATA_VERSION`), sets `defsStarts` to 0, and reloads the page. The engine then replays the restored log and the views read the restored state, through the paths the app already starts with, so no live state needs patching.
- **Why not merge:** merged history needs an order and a cap, and merged definitions need a rule for two different `a` (the later wins? the file's?). Each rule is a way to lose something without saying so. Definitions that should be *added* to what is there already have their own file: the library (S4, R59, functions and exact values). The backup is for "this phone again" or "the new phone", and replace is exactly that.
- **One Undo:** before it writes, the restore keeps the raw records it will replace under one key, `backup.undo` (time plus records; never exported, kept until the next restore). Settings › Backup then offers "Undo restore" with that time. A restore overwrites the user's data, and principle 3 allows no silent loss. Keeping the old records costs one more key, at most the file's size.

### 3.6 The move to the new application id (backlog "Needs the user" 4)
The backup does not rescue that move. The old app (`org.pascaline.app`) has no export, and its IndexedDB belongs to it. Only what the owner copies by hand comes across. R38a protects every later move (a new phone, a reinstall, the next id change) **once it is in the installed app before the move**.

## 4. Steps for the packages (the report gives them as package text)
- **A11** (annabell) gains the native `save` method (section 1) and the device checks of sections 1 and 2.
- **R38a** (ron): the raw read, the export, the port, Settings › Backup › Save.
- **R38b** (ron, Opus): the check, the summary, replace by part, Undo.

## 5. Still to verify (annabell, on the Tab One and the owner's phone, in A11)
1. `save` opens the system "Save to" screen; the file lands in Downloads with its name and its bytes. Cancel returns "cancelled".
2. `<input type="file">` opens the picker; cancel, then pick: the system keyboard stays closed and the entry line does not take focus on return.
3. Without `accept`, a backup from Downloads and the same file from Drive can be picked; with `accept="application/json"`, which of them is greyed out.
4. The `save` time of the worst-case file (1.98 MB), median of 5.
5. In the PWA in Chrome for Android: `<a download>` saves into Downloads; whether `showSaveFilePicker` exists.
6. (Only if "open with" is ever opened) whether `pathPattern` matches the `content://` URIs of the Files app.
