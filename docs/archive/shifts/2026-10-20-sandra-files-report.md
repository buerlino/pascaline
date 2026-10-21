<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# S6 report: files in and out without INTERNET, the backup (sandra, 2026-10-20, pipeline run 109)

## Done
- **[docs/archive/r11-files.md](../../archive/r11-files.md)** answers the three questions with their evidence. **Out** (section 1): WebView 131 has no Web Share (A4a), and Capacitor 8.5.3 sets no `DownloadListener`, so neither a shared file nor `<a download>` works in the APK. The recommendation is our own `save` method (Android's `ACTION_CREATE_DOCUMENT`; no permission, no dependency) plus `<a download>` in the PWA. `@capacitor/filesystem` costs 1.6 MB of unshrunk jars plus a Kotlin build step. **In** (section 2): `<input type="file">` works through Capacitor's file chooser with no plugin, and no text field takes focus; use it with no `accept` filter. "Open with" waits, and the File System Access API is not needed. **The file** (section 3): the format, the keys, the sizes, the refusals, and replace by part with one Undo.
- **Probe** `tools/probes/backup-file.mjs` (README row added).
- **S4's open point** (R10 section 2: the picker in the WebView and the keyboard): the code path is confirmed and Chromium keeps focus off text fields. The device check is now point 2 of r11 section 5, for annabell in A11.
- Nothing under `app/` or `android/` changed.

## Verified (how)
- Capacitor sources, from `npm pack` into scratch: `BridgeWebChromeClient.java:276-301, 375-406` (the picker, permission only for camera capture); no `DownloadListener` anywhere in `@capacitor/android` 8.5.3; `SharePlugin.java:167-188` (`file://` only, `packageName + ".fileprovider"`, which matches our manifest's provider); empty plugin manifests; `FilesystemPlugin.kt:40-48` (storage permissions only for public folders).
- Sizes from Maven Central: `ionfilesystem-android` 1.1.1 is a 172 kB aar; `kotlinx-coroutines-core-jvm` 1.10.2 is a 1.48 MB jar, `-android` 18 kB. `minifyEnabled false` is at `android/app/build.gradle:39`.
- Probe run (Chromium 156, headless, `https://localhost`): `share`/`canShare` undefined; `showSaveFilePicker`/`showOpenFilePicker` are functions; `<a download>` gives `pascaline-backup-2026-10-20.json` with 194 307 bytes, the same bytes; `<input type=file>` opens the chooser and reads back the same bytes, and focus stays on the button (not editable).
- File size at the limits (caps read from the sources): typical 190 kB, worst 1.98 MB. Every bad file is refused with its reason.

## Numbers
| | typical | worst |
|---|---|---|
| backup file (compact JSON) | 190 kB | 1.98 MB |
| history part (200 + 200) | 111 kB | 1.71 MB |
| defs part (500) | 78 kB | 275 kB |
| restore size cap | 4 MB | |

Tests: no code under `app/` changed. `node tools/docs-check.mjs`: docs ok (backlog 19 990 B / 20 kB, decisions 39 998 B / 40 kB).

## For shared files
- **decisions.md "Needs the user"** (on this branch): the S6 entry below. To make room I tightened my own S4, S5 (P14 arrangement) and S13 entries; no fact was dropped.
  > **2026-10-20 S6: the backup (OPEN).** R11. Recommendation: out by Android's "Save to" screen (a ~50-line `save` in our plugin, A11; no permission or dependency), in by `<input type="file">`; restore checks the whole file, replaces the ticked parts, keeps one Undo. Else: Share + `@capacitor/filesystem` (+1.6 MB).

  The full proposal for the owner: **recommendation:** the above. **Why:** WebView 131 can neither share a file nor download one. The system "Save to" screen puts the backup where the user picks (Downloads, Drive, Nextcloud) with no permission, no dependency and no FileProvider, and the same picker reads it back. Replace by part is exactly "this phone again / the new phone" with no merge rule that could lose rows silently, and the library (S4) already adds definitions. **Cost:** about 0.25 d for annabell in A11 (the method plus the device checks of r11 section 5), then R38a about 0.5 d and R38b about 0.5 d (ron). **Alternatives:** `@capacitor/share` + `@capacitor/filesystem` (MIT, no permission, but +1.6 MB unshrunk and a Kotlin build step for F-Droid; the share sheet sends rather than saves); merge instead of replace (needs order, cap and conflict rules, each a silent loss). **Would change it:** the owner wants "send the backup to someone" (then Share joins with a 10-line write-to-cache in the same plugin, still without Filesystem); the device check finds that the Tab One's "Save to" screen is missing or broken (then Share + cache).
- **backlog.md:** my line now reads `**S6** (done, R11)`, and "Needs the user" 1 lists "S6: the backup". Point 4 (the new application id) is unchanged, but the owner should know (r11 section 3.6): **the backup cannot rescue that move**, because the old app has no export. Proposed text for point 4: append "The backup (R38) protects later moves only."
- **docs/04 6.2** (for the next Opus pass): append after the stamp paragraph: "**The backup** (R11, `archive/r11-files.md`): one JSON file, each key's record as stored with its stamp (`defsStarts` left out); a restore checks the whole file, refuses it on the first fault (newer format or part, broken stamp, unknown part, a validator fault), then replaces the ticked keys in one transaction, keeps the replaced records in `backup.undo`, and reloads."
- **docs/04 2.6 / 8.2** (Mechanics line, `docs/04-architecture.md:139`): append "Files go out through the native `save` (`ACTION_CREATE_DOCUMENT`) in the APK and `<a download>` in the PWA, and come in through `<input type=\"file\">` (R11)."
- **THIRD_PARTY.md:** no new dependency.
- **Package A11** (annabell), add one bullet and one Done-when line:
  - **The file port:** `PascalineFiles.save({ name, mime, text })` in our local plugin (`android/`, registered like `PascalineHapticsPlugin`): `ACTION_CREATE_DOCUMENT` + `CATEGORY_OPENABLE`, `setType(mime)`, `EXTRA_TITLE` name; on the result, `getContentResolver().openOutputStream(uri, "wt")` writes the UTF-8 text; resolves `{ result: "saved" | "cancelled" }`, rejects on an I/O error. No manifest change.
  - Done when: on the Tab One, r11 section 5 points 1–4 are checked and reported (median of 5 for point 4), and `dumpsys package … | grep permission` still lists VIBRATE only.
- **Package R38a** (ron), completed steps (Starts when: S6 merged, the owner's yes, **A11 merged**):
  1. `storage.ts`: `kvGetRaw(key)` returns the record as stored, with no `unstamp` and no write-back, and wraps an unstamped value as `{ "@pascaline": 0, value }`. Unit test: a version-0 value, a current one and a newer one (`DATA_VERSION + 1`) each come back with their true stamp.
  2. `app/src/state/backup.ts`: `BACKUP_KEYS` (r11 section 3.2: `settings`, `view`, `place`, `entry`, `history`, `defs`, `userKeys`, `taps`, `app.function`, `app.solve`, `units.targets`, `units.history`; `defsStarts` and `backup.undo` left out) and `makeBackup(kv, now)` → `{ "pascaline-backup": 1, dataVersion, made, parts }` holding only the keys that are present. Unit test: every key of docs/04 6.2 is either in `BACKUP_KEYS` or on the left-out list.
  3. The file port `saveFile(name, mime, text): Promise<"saved" | "cancelled" | "failed">`: native `PascalineFiles.save` when available, else `<a download>` of a Blob (revoke the URL afterwards). It loads lazily and stays out of the start chunk.
  4. Settings › Backup › "Save backup" (i18n strings): the name is `pascaline-backup-YYYY-MM-DD.json`, and the message on the status line is "saved", "cancelled" or "could not save".
  5. e2e (Playwright, `?engine=fake` or the real engine): fill history, a definition, a setting and a user key; Save; catch the download; check the envelope, every present key with its `@pascaline` equal to `DATA_VERSION`, and print the file's size.
  - Done when: as in the package, plus the start chunk is unchanged (size test).
- **Package R38b** (ron, Opus), completed steps:
  1. `backup.ts` `checkBackup(bytes)`, which mirrors the probe's `check` and adds step 5 of r11 section 3.4. In order: over 4 MB; not UTF-8; not JSON ("not a backup; a library is imported under Library"); no `pascaline-backup` field, or one that is not an integer ≥ 1; a newer format; `parts` missing; an unknown part; no stamp or `value`; a broken stamp (not an integer ≥ 0); a part newer than `DATA_VERSION`; then for each part `unstamp(key, record)` and the key's validator (settings `migrateSettings`; history the `restoreHistory` filter, where a dropped row counts as a fault; `userKeys` its load check; `defs` the log's load check; the rest by type; a key with no validator gets one). Each refusal returns its message and the part's name. Unit tests: the probe's bad files, one per refusal, plus a validator fault.
  2. Settings › Backup › "Restore from file": a hidden `<input type="file">` with no `accept`, clicked from the row, so focus never goes to a text field (the R22 return path holds). Then a sheet with the summary (made, version, rows per view, definitions, which settings and keys), one tick per part (all ticked), and Restore / Cancel (keys and Esc/back through `backLayer.ts`).
  3. Restore: in one IndexedDB transaction (`kvSetMany` in `storage.ts`), write the current raw records of the ticked keys to `backup.undo` (`{ time, records }`), write the ticked parts stamped `DATA_VERSION`, set `defsStarts` to 0; then `location.reload()`.
  4. "Undo restore (time)" in Settings › Backup while `backup.undo` exists: it writes the records back as stored, in one transaction, deletes `backup.undo`, and reloads.
  5. e2e: export → clear the store → restore all → the same history, definitions (a variable's value after the replay), settings and user keys; a file with `defs` stamped `DATA_VERSION + 1` is refused with its message and nothing changes; restore then Undo gives the state from before.

## Needs a decision
- The S6 entry above (the way out; replace by part with one Undo). Nothing else.

## Not done (to verify)
- Every device behaviour, which is annabell's in A11 (r11 section 5): `save` on the Tab One; the picker with the keyboard closed and no focus on return; greyed-out files with and without `accept`; the `save` time at 1.98 MB; `<a download>` and `showSaveFilePicker` in Chrome for Android; `pathPattern` on `content://` (only if "open with" is opened).
- The typical size is built from the field shapes, not from a real export. R38a's e2e prints the real one.

## Top risks
1. **The picker's return refocuses the entry line** (the F9/F11 family) and the system keyboard rises. R38b's e2e and A11's device check both cover it.
2. **A validator that drops rows silently on restore.** R38b treats a dropped row as a fault; keys without a validator need one first.
3. **The 1.98 MB worst case through the Capacitor bridge** on the Tab One (one JSON string): measure it in A11 before R38a relies on it.
