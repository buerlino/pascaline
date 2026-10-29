#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Test for scripts/gc.sh (A27): a scratch git repo with its own .tasks/ and .coord/ (PASCALINE_COORD); nothing real is touched.
#   scripts/gc.test.sh [path/to/gc.sh]
set -uo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
gc="${1:-$here/gc.sh}"; lib="$(dirname "$gc")/pipeline-lib.sh"
fails=0
fail() { echo "FAIL: $*" >&2; fails=$((fails + 1)); }
ok() { [[ "$2" == "$3" ]] || fail "$1: got '$2', wanted '$3'"; }
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
r="$tmp/repo"; mkdir -p "$r/scripts" "$r/engine/giac/patches" "$r/docs/research"; cd "$r"
cp "$gc" scripts/gc.sh; cp "$lib" scripts/pipeline-lib.sh
git init -q -b phase-1 . ; git config user.email t@t; git config user.name t
echo b > engine/giac/build-wasm.sh; echo "# c" > CLAUDE.md; echo "# d" > docs/README.md
printf '# n\n**Status (2026-10-20): decided.** x\n' > docs/research/done.md
printf '# n\n**Status (2026-10-20): open.** x\n' > docs/research/open.md
git add -A; git commit -qm init
# a branch with other engine inputs (keeps its key), a merged branch checked out in a worktree
git branch -q p1/x; git checkout -q p1/x; echo b2 > engine/giac/build-wasm.sh; git commit -qam x; git checkout -q phase-1
git branch -q p1/merged; git worktree add -q "$tmp/wt" p1/merged
. ./scripts/pipeline-lib.sh
kp="$(engine_key "$r" phase-1)"; kx="$(engine_key "$r" p1/x)"
old() { touch -d '5 days ago' "$@"; }
T=.tasks; C="$tmp/coord"; mkdir -p "$T" "$C/locks" "$C/devices" "$C/tmpbuild"
export PASCALINE_COORD="$C"
mkdir "$T/pass-7" "$T/report-2026-01-01" "$T/pass-9"; old "$T/pass-7" "$T/report-2026-01-01"
echo l > "$T/night-1.log"; old "$T/night-1.log"; echo l > "$T/night-2.log"
echo p > "$C/a.png"; echo p > "$C/new.png"; echo p > "$C/a.apk"; old "$C/a.png" "$C/a.apk"
echo keep > "$C/log.md"; echo j > "$C/device-runs.jsonl"; old "$C/log.md" "$C/device-runs.jsonl"
mkdir -p "$T/archive/2026-01-01" "$T/archive/$(date -d "5 days ago" +%F)"
head -c 20000 /dev/zero | tr '\0' a > "$T/archive/$(date -d "5 days ago" +%F)/big.log"; old "$T/archive/$(date -d "5 days ago" +%F)/big.log"; touch -d '5 days ago' "$T/archive/$(date -d "5 days ago" +%F)"
mkdir -p engine/giac/_out/gsl engine/giac/_out/base "engine/giac/_out/key-$kp" "engine/giac/_out/key-$kx" engine/giac/_out/key-dead
head -c 3000000 /dev/zero > engine/giac/_out/key-dead/giac.wasm
touch -d '40 days ago' "$T/archive/2026-01-01"
# a finished run with an .err (dry run must keep it)
mkdir "$T/001-old"; echo "### x on branch p1/gone" > "$T/001-old/spec.md"; echo e > "$T/001-old/w.err"
# A47a: a run whose branch does not exist yet but whose pid is alive is kept; one with a dead pid is archived
sleep 300 & live=$!; trap 'kill "$live" 2>/dev/null; rm -rf "$tmp"' EXIT
mkdir "$T/002-live" "$T/003-dead"; echo "### y on branch p1/notyet" > "$T/002-live/spec.md"; echo "$live" > "$T/002-live/pid"
echo "### z on branch p1/gone2" > "$T/003-dead/spec.md"; echo 999999 > "$T/003-dead/pid"

snap() { { find "$T" "$C" engine -type f -printf '%p %s %T@\n'; find "$T" "$C" engine -type d -printf 'd %p\n'; } | grep -v 'gc-.*-dry.md' | sort | md5sum; }
before="$(snap)"
out="$(bash scripts/gc.sh 2>&1)"; echo "$out" > "${GC_TEST_OUT:-/dev/null}"
ok "dry run changes nothing" "$(snap)" "$before"
[[ -f "$T/001-old/w.err" ]] || fail "dry run deleted *.err"
[[ ! -e "$T/archive/$(date +%F)" ]] || fail "dry run made today's archive folder"
[[ ! -d "$T/archive/$(date +%F)/001-old" ]] || fail "dry run moved a run"
for w in pass-7 report-2026-01-01 night-1.log a.png a.apk "key-dead" "archive/2026-01-01" "big.log" "done.md" "checked out in $tmp/wt"; do grep -qF "$w" <<<"$out" || fail "dry run does not list $w"; done
grep -qF "key-$kx" <<<"$out" && fail "dry run lists a used key"
grep -qF open.md <<<"$out" && fail "lists an open note"
grep -qE 'space freed' <<<"$out" || fail "no space freed line"
grep -qE 'saving' <<<"$out" || fail "no gzip saving line"
grep -q 'git branch -d: .*p1/merged' <<<"$out" && fail "checked-out branch listed as deletable"

# an unreadable engine key (git ls-tree fails for p1/x) prunes no key-* build
mkdir -p "$tmp/shim"; printf '#!/bin/sh\ncase "$*" in *ls-tree*p1/x*) exit 128;; esac\nexec %s "$@"\n' "$(command -v git)" > "$tmp/shim/git"; chmod +x "$tmp/shim/git"
sout="$(PATH="$tmp/shim:$PATH" bash scripts/gc.sh 2>&1)"
grep -qF "key-dead" <<<"$sout" && fail "unreadable key: key-dead still listed for pruning"
grep -qF "NOT pruned" <<<"$sout" || fail "unreadable key: no NOT pruned line"
bash scripts/gc.sh --apply >/dev/null 2>&1
d="$T/archive/$(date +%F)"
[[ -d "$d/pass-7" && -d "$d/report-2026-01-01" && ( -f "$d/night-1.log.gz" || -f "$d/night-1.log" ) ]] || fail "old clutter not archived"
[[ -d "$T/pass-9" && -f "$T/night-2.log" && -f "$C/new.png" ]] || fail "new clutter moved"
[[ -f "$d/a.png" && -f "$d/a.apk" && ! -f "$C/a.png" ]] || fail "coord png/apk not archived"
[[ -f "$C/log.md" && -f "$C/device-runs.jsonl" && -d "$C/locks" && -d "$C/devices" ]] || fail "protected coord files touched"
[[ -f "$T/archive/$(date -d "5 days ago" +%F)/big.log.gz" && ! -f "$T/archive/$(date -d "5 days ago" +%F)/big.log" ]] || fail "old archive log not gzipped"
[[ ! -d engine/giac/_out/key-dead && -d "engine/giac/_out/key-$kp" && -d "engine/giac/_out/key-$kx" && -d engine/giac/_out/gsl && -d engine/giac/_out/base ]] || fail "engine prune wrong"
[[ ! -d "$T/archive/2026-01-01" ]] || fail "old archive folder kept"
[[ -d "$T/002-live" && ! -d "$d/002-live" ]] || fail "A47a: gc --apply archived a run dir whose pid is alive"
[[ -d "$d/003-dead" && ! -d "$T/003-dead" ]] || fail "A47a: gc --apply kept a run dir whose pid is gone"
first="$(wc -l < "$T/gc-$(date +%F).md")"
bash scripts/gc.sh --apply >/dev/null 2>&1
[[ "$(wc -l < "$T/gc-$(date +%F).md")" -gt "$first" ]] || fail "second apply overwrote the report"
grep -q '^# GC' "$T/gc-$(date +%F).md" || fail "no report"
[[ $(grep -c '^# GC' "$T/gc-$(date +%F).md") -eq 2 ]] || fail "second apply not appended"
[[ $fails -eq 0 ]] && echo "gc.test.sh: all passed" || { echo "gc.test.sh: $fails failed" >&2; exit 1; }
