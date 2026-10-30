#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# One version (A48): exit 0 only when app/package.json's version, build.gradle's literal versionName and versionCode, and the
# F-Droid recipe's newest build entry (highest versionCode) and CurrentVersion / CurrentVersionCode agree; with a tag argument
# (vX.Y.Z) they also equal the tag. F-Droid's update check reads the Gradle file as text, so a computed value is refused.
#   tools/check-version.sh [vX.Y.Z]        # CHECK_VERSION_ROOT=<dir> reads another tree (tools/check-version.test.sh)
# Exit: 0 agree, 1 mismatch or unreadable, 2 usage.
set -uo pipefail
ROOT="${CHECK_VERSION_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
tag=""
if (( $# > 1 )); then echo "usage: check-version.sh [vX.Y.Z]" >&2; exit 2; fi
if (( $# == 1 )); then
  [[ "$1" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "usage: check-version.sh [vX.Y.Z] (got '$1')" >&2; exit 2; }
  tag="${1#v}"
fi

PKG="$ROOT/app/package.json" GRADLE="$ROOT/android/app/build.gradle" RECIPE="$ROOT/fdroid/io.github.buerlino.pascaline.yml"
errs=0; bad() { echo "check-version: $*" >&2; errs=$((errs + 1)); }
for f in "$PKG" "$GRADLE" "$RECIPE"; do [[ -f "$f" ]] || { echo "check-version: missing $f" >&2; exit 1; }; done

# app/package.json: the top-level "version" (two-space indent)
v_pkg="$(sed -n 's/^  "version": *"\([^"]*\)".*/\1/p' "$PKG" | head -n1)"

# build.gradle: exactly one versionName and one versionCode line, each a plain literal (a comment line is not a line)
literal() {   # literal <keyword> <value regex>
  local kw="$1" re="$2" lines n
  lines="$(grep -E "^[[:space:]]*$kw([[:space:]=]|\$)" "$GRADLE" || true)"
  n="$(grep -c . <<<"$lines" || true)"
  if [[ "$n" != 1 ]]; then echo "check-version: build.gradle has $n $kw lines (one literal wanted)" >&2; return 1; fi
  if [[ "$lines" =~ ^[[:space:]]*$kw[[:space:]]*=?[[:space:]]*$re[[:space:]]*(//.*)?$ ]]; then printf '%s' "${BASH_REMATCH[1]}"
  else echo "check-version: build.gradle $kw is not a plain literal: $(sed 's/^[[:space:]]*//' <<<"$lines")" >&2; return 1; fi
}
v_name="$(literal versionName "[\"']([^\"'\$()?:]+)[\"']")" || errs=$((errs + 1))   # (the message came from the subshell)
v_code="$(literal versionCode "([0-9]+)")" || errs=$((errs + 1))

# the recipe: the build entry with the highest versionCode, and the Current* lines
read -r r_name r_code r_commit < <(awk '
  /^  - versionName:/ { n = $3; c = ""; m = ""; inb = 1; next }
  inb && /^    versionCode:/ { c = $2 }
  inb && /^    commit:/ { m = $2 }
  inb && /^    commit:/ || inb && /^    versionCode:/ { if (c != "" && (best == "" || c + 0 >= best + 0)) { best = c; bn = n; bm = m } }
  /^[^ -]/ { inb = 0 }
  END { print bn, best, bm }' "$RECIPE")
r_cur="$(sed -n 's/^CurrentVersion: *\([^ #]*\).*/\1/p' "$RECIPE" | head -n1)"
r_curcode="$(sed -n 's/^CurrentVersionCode: *\([0-9]*\).*/\1/p' "$RECIPE" | head -n1)"

[[ -n "$v_pkg" ]] || bad "no version in app/package.json"
[[ -n "$r_name" && -n "$r_code" ]] || bad "no build entry in the recipe"
same() {   # same <what> <got> <want>
  [[ "$2" == "$3" ]] || bad "$1 is '$2', package.json says '$3'"
}
if [[ -n "$v_pkg" ]]; then
  [[ -z "$tag" ]] || same "tag" "$tag" "$v_pkg"
  [[ -z "$v_name" ]] || same "build.gradle versionName" "$v_name" "$v_pkg"
  [[ -z "$r_name" ]] || same "recipe newest build versionName" "$r_name" "$v_pkg"
  same "recipe CurrentVersion" "$r_cur" "$v_pkg"
  [[ -z "$r_commit" ]] || same "recipe newest build commit" "$r_commit" "v$v_pkg"
fi
[[ -z "$v_code" || -z "$r_code" ]] || same "recipe newest build versionCode" "$r_code" "$v_code"
[[ -z "$v_code" ]] || same "recipe CurrentVersionCode" "$r_curcode" "$v_code"

if (( errs )); then exit 1; fi
echo "check-version: ok $v_pkg ($v_code)${tag:+, tag v$tag}"
