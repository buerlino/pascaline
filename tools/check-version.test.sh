#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Test for tools/check-version.sh (A48): a match passes, each mismatch fails, and a computed versionName is refused.
# Works on fixture trees in a temp dir (CHECK_VERSION_ROOT), starts nothing. Run: tools/check-version.test.sh
set -uo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script="$here/check-version.sh"
fails=0; fail() { echo "FAIL: $*" >&2; fails=$((fails + 1)); }
[[ -x "$script" ]] || { echo "FAIL: no executable $script" >&2; exit 1; }
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

# fixture: tree <dir> <pkgVersion> <gradleName> <gradleCode> <recipeName> <recipeCode> <commit> <curName> <curCode>
tree() {
  local d="$1"; mkdir -p "$d/app" "$d/android/app" "$d/fdroid"
  cat > "$d/app/package.json" <<JSON
{
  "name": "pascaline-app",
  "version": "$2",
  "dependencies": {
    "version": "9.9.9"
  }
}
JSON
  cat > "$d/android/app/build.gradle" <<GRADLE
android {
    defaultConfig {
        versionCode $4
        // a comment that says versionName "9.9.9" and versionCode 77
        versionName "$3"
    }
}
GRADLE
  cat > "$d/fdroid/io.github.buerlino.pascaline.yml" <<YML
Builds:
  - versionName: 0.0.1
    versionCode: 0
    commit: v0.0.1
    subdir: android/app
  - versionName: $5
    versionCode: $6
    commit: $7
    subdir: android/app

AutoUpdateMode: Version
UpdateCheckMode: Tags
CurrentVersion: $8
CurrentVersionCode: $9
YML
}
# expect <label> <want-rc> <dir> [tag]
expect() {
  local label="$1" want="$2" d="$3"; shift 3
  local out rc; out="$(CHECK_VERSION_ROOT="$d" "$script" "$@" 2>&1)"; rc=$?
  [[ $rc -eq $want ]] || fail "$label: exit $rc, wanted $want: $out"
}

tree "$tmp/ok" 0.1.0 0.1.0 1 0.1.0 1 v0.1.0 0.1.0 1
expect "match" 0 "$tmp/ok"
expect "match with the tag" 0 "$tmp/ok" v0.1.0
expect "wrong tag" 1 "$tmp/ok" v0.1.1
expect "tag without v" 2 "$tmp/ok" 0.1.0
expect "a second argument" 2 "$tmp/ok" v0.1.0 extra

tree "$tmp/m1" 0.0.0 0.1.0 1 0.1.0 1 v0.1.0 0.1.0 1;  expect "package.json differs" 1 "$tmp/m1"
tree "$tmp/m2" 0.1.0 1.0 1 0.1.0 1 v0.1.0 0.1.0 1;    expect "gradle versionName differs" 1 "$tmp/m2"
tree "$tmp/m3" 0.1.0 0.1.0 2 0.1.0 1 v0.1.0 0.1.0 1;  expect "gradle versionCode differs" 1 "$tmp/m3"
tree "$tmp/m4" 0.1.0 0.1.0 1 0.2.0 1 v0.2.0 0.1.0 1;  expect "recipe build versionName differs" 1 "$tmp/m4"
tree "$tmp/m5" 0.1.0 0.1.0 1 0.1.0 2 v0.1.0 0.1.0 1;  expect "recipe build versionCode differs" 1 "$tmp/m5"
tree "$tmp/m6" 0.1.0 0.1.0 1 0.1.0 1 v0.0.9 0.1.0 1;  expect "recipe commit is not the tag of its version" 1 "$tmp/m6"
tree "$tmp/m7" 0.1.0 0.1.0 1 0.1.0 1 v0.1.0 0.2.0 1;  expect "CurrentVersion differs" 1 "$tmp/m7"
tree "$tmp/m8" 0.1.0 0.1.0 1 0.1.0 1 v0.1.0 0.1.0 2;  expect "CurrentVersionCode differs" 1 "$tmp/m8"

# a computed versionName is read wrong by F-Droid's update check: refused even when it would evaluate to the right value
tree "$tmp/c1" 0.1.0 0.1.0 1 0.1.0 1 v0.1.0 0.1.0 1
sed -i 's|^        versionName .*|        versionName = (System.getenv("X") == "1") ? "0.1.0-m" : "0.1.0"|' "$tmp/c1/android/app/build.gradle"
expect "computed versionName" 1 "$tmp/c1"
tree "$tmp/c2" 0.1.0 0.1.0 1 0.1.0 1 v0.1.0 0.1.0 1
sed -i 's|^        versionCode .*|        versionCode rootProject.ext.code|' "$tmp/c2/android/app/build.gradle"
expect "computed versionCode" 1 "$tmp/c2"

# the "= literal" form and single quotes are literals too
tree "$tmp/l1" 0.1.0 0.1.0 1 0.1.0 1 v0.1.0 0.1.0 1
sed -i "s|^        versionName .*|        versionName = '0.1.0'|; s|^        versionCode .*|        versionCode = 1|" "$tmp/l1/android/app/build.gradle"
expect "literal with = and single quotes" 0 "$tmp/l1" v0.1.0

# a missing file is an error
rm "$tmp/ok/fdroid/io.github.buerlino.pascaline.yml"; expect "no recipe" 1 "$tmp/ok"

# the newest build entry counts, wherever it stands in the list
tree "$tmp/n1" 0.1.0 0.1.0 1 0.1.0 1 v0.1.0 0.1.0 1
sed -i 's|^  - versionName: 0.0.1|  - versionName: 0.5.0|; s|^    versionCode: 0$|    versionCode: 5|; s|commit: v0.0.1|commit: v0.5.0|' "$tmp/n1/fdroid/io.github.buerlino.pascaline.yml"
expect "an older entry listed first, a newer one (code 5) elsewhere" 1 "$tmp/n1"

[[ $fails -eq 0 ]] || { echo "check-version.test.sh: $fails failure(s)" >&2; exit 1; }
echo "check-version.test.sh: ok"
