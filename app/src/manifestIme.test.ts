// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// A46: Android opens the system keyboard itself when the window regains focus (SHOW_AUTO_EDITOR_FORWARD_NAV); the
// JS guards cannot stop that, so the activity must say the keyboard stays hidden.
describe("A46: the activity never auto-shows the system keyboard", () => {
  it(".MainActivity has windowSoftInputMode with state stateAlwaysHidden", () => {
    const xml = readFileSync(new URL("../../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8");
    const act = /<activity\b[^>]*android:name="\.MainActivity"[^>]*>/s.exec(xml)?.[0] ?? "";
    const mode = /android:windowSoftInputMode="([^"]*)"/.exec(act)?.[1] ?? "";
    expect(mode.split("|")).toContain("stateAlwaysHidden");
  });
});
