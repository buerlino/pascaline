#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# scripts/pipeline-lib.sh: small helpers of scripts/pipeline.sh, sourced by it and by scripts/pipeline.test.sh (A17).

# audited_head_check <worktree> <branch> <audited sha>: succeeds when refs/heads/<branch> is the audited commit;
# otherwise prints why on stdout and fails. A worker that detached HEAD and committed there leaves the branch behind
# the commit the audit read (run 59 merged aa1fad5 while its audit had approved ee654cd).
audited_head_check() {
  local wt="$1" br="$2" sha="$3" tip
  tip="$(git -C "$wt" rev-parse -q --verify "refs/heads/$br^{commit}" 2>/dev/null || true)"
  [[ -n "$sha" ]] || { echo "no audited commit recorded"; return 1; }
  [[ -n "$tip" ]] || { echo "branch $br does not exist"; return 1; }
  [[ "$tip" == "$sha" ]] || { echo "branch $br is at ${tip:0:9}, the audit read ${sha:0:9}"; return 1; }
  return 0
}

# from_opus_pass <reply file>: the reply from its first OPUS PASS line on (a line before it breaks the brief's form;
# passes 20, 21, 24 and 27 began with one). A reply without that line is printed whole.
from_opus_pass() {
  if grep -q '^OPUS PASS' "$1"; then sed -n '/^OPUS PASS/,$p' "$1"; else cat "$1"; fi
}

# A bare missing module ('vitest', '@capacitor/clipboard') is the machine's; a relative one ('./x.ts') is the worker's own import (A34).
MACHINE_RE="command not found|node_modules (is )?missing|Cannot find module '[^./']"
# machine_failure <check log>: succeeds when the log shows the machine, not the code, failed (A24, A34).
machine_failure() {
  grep -qE "$MACHINE_RE" "$1" 2>/dev/null
}

# node_modules_stale <app dir>: succeeds when node_modules lacks a non-optional package of package-lock.json (A34): the rule is
# that every such package is in node_modules/.package-lock.json.
node_modules_stale() {
  node -e '
    const fs = require("fs"), d = process.argv[1];
    let want, have;
    try { want = JSON.parse(fs.readFileSync(d + "/package-lock.json", "utf8")).packages; have = JSON.parse(fs.readFileSync(d + "/node_modules/.package-lock.json", "utf8")).packages; } catch { process.exit(0); }
    for (const [k, v] of Object.entries(want)) {
      if (!k.startsWith("node_modules/") || v.optional || v.link) continue;
      if (!(k in have)) process.exit(0);
      let got; try { got = JSON.parse(fs.readFileSync(d + "/" + k + "/package.json", "utf8")).version; } catch { process.exit(0); }
      if (v.version && got !== v.version) process.exit(0);
    }
    process.exit(1);' "$1"
}

# integ_clean <phase-1 worktree>: succeeds when nothing is staged or changed in it (untracked files do not count) (A24).
integ_clean() {
  [[ -z "$(git -C "$1" status --porcelain --untracked-files=no)" ]]
}

# merge_failure_reason <phase-1 worktree> <merge log>: "conflict" only when git lists unmerged files, else the log's last line (A24).
merge_failure_reason() {
  if [[ -n "$(git -C "$1" diff --name-only --diff-filter=U)" ]]; then echo conflict
  else echo "merge failed: $(tail -n 1 "$2" | cut -c1-200)"; fi
}

# ---- engine builds (A28) ----
# engine_key <git dir> <rev>: a hash of the engine's inputs at <rev> (build-wasm.sh, patches/ without its README, wasm/), from the
# blob ids in the tree, so it needs no checkout and takes milliseconds.
engine_key() {
  git -C "$1" ls-tree -r "$2" -- engine/giac/build-wasm.sh engine/giac/patches engine/giac/wasm 2>/dev/null | grep -v 'patches/README.md' | sha256sum | cut -c1-16
}
# engine_stamp <engine dir>: the key an engine directory was built from (empty when unstamped).
engine_stamp() { cat "$1/.engine-key" 2>/dev/null || true; }
engine_sha() { sha256sum "$1/giac.wasm" 2>/dev/null | cut -c1-16; }
# engine_build <worktree holding the sources> <key> <out root> <log>: builds once per key into <root>/key-<key> under the
# host-cpu lock; a finished build with the right stamp is reused. Fails with the build log's tail on stdout.
engine_build() {
  local src="$1" key="$2" root="$3" log="$4" dest tmp rc=0
  dest="$root/key-$key"
  if [[ -f "$dest/giac.wasm" && "$(engine_stamp "$dest")" == "$key" ]]; then return 0; fi
  tools/devlock.sh acquire host-cpu "engine-$key" 1800 >/dev/null || { echo "host-cpu lock busy"; return 1; }
  tmp="$root/.tmp-$key.$$"; rm -rf "$tmp"; mkdir -p "$tmp"
  GIAC_BUILD_OUT="$tmp" GIAC_BUILD_DIR="$root/.build-$key" timeout 3600 "$src/engine/giac/build-wasm.sh" > "$log" 2>&1 || rc=1
  if [[ $rc -eq 0 && -f "$tmp/gsl/giac.wasm" ]]; then
    echo "$key" > "$tmp/gsl/.engine-key"
    rm -rf "$dest"; mv "$tmp/gsl" "$dest"
  else rc=1; fi
  rm -rf "$tmp" "$root/.build-$key"
  tools/devlock.sh release host-cpu "engine-$key" >/dev/null || true
  [[ $rc -eq 0 ]] || { echo "build-wasm.sh failed: $(tail -n 2 "$log" | tr '\n' ' ' | cut -c1-160)"; return 1; }
}
# engine_promote <out root> <key>: <root>/gsl becomes the build of <key>; the old one stays as gsl.prev.
engine_promote() {
  local root="$1" key="$2"
  rm -rf "$root/gsl.new" && cp -a "$root/key-$key" "$root/gsl.new" || return 1
  rm -rf "$root/gsl.prev"
  if [[ ! -e "$root/gsl" ]]; then mv -T "$root/gsl.new" "$root/gsl"; return; fi
  # one atomic exchange (coreutils >= 9.5): $root/gsl never goes missing for a concurrent user of the shared engine
  if mv --exchange "$root/gsl.new" "$root/gsl" 2>/dev/null; then mv -T "$root/gsl.new" "$root/gsl.prev"
  else mv -T "$root/gsl" "$root/gsl.prev" && mv -T "$root/gsl.new" "$root/gsl"; fi
}

# A37: the tests that failed in some of <total> runs and passed in others. Reads item files (one "file<TAB>title" per failing item,
# one file per run) and prints "<failed runs>/<total><TAB><item>" for every item that failed in fewer than all runs.
flaky_items() {  # <total> <item file>...
  local total="$1"; shift
  local f; for f in "$@"; do sort -u "$f" 2>/dev/null; done | sort | uniq -c | awk -v t="$total" '$1 < t { c = $1; sub(/^ *[0-9]+ /, ""); print c "/" t "\t" $0 }'
}
# A37: succeeds while <dir>'s HEAD is still <sha> (the census runs on one unchanged commit).
head_is() {  # <dir> <sha>
  [[ "$(git -C "$1" rev-parse HEAD 2>/dev/null)" == "$2" ]]
}

# ---- A36: a regression test must fail on the old code ----
# red_first_wanted <package spec file>: succeeds when the package says its tests fail on phase-1.
red_first_wanted() {
  grep -qiE '(fail|failing) on phase-1' "$1" 2>/dev/null
}
# red_first_stage <tests/golden/x.yaml>: the golden stage that reads the file (golden.ts); empty when none does.
red_first_stage() {
  case "$(basename "$1" .yaml)" in
    home|precision|solve|function|bench|units|parser) basename "$1" .yaml;;
  esac
}
# red_first <worktree> <spec file> <phase-1 engine dir> <log>: for a package that says its tests fail on phase-1, runs the vitest files and
# golden cases the branch adds or changes on phase-1's code (a scratch worktree with those files laid over it). Succeeds when the
# stage is skipped (also when the branch adds no vitest file or golden case) or at least one of them fails there; otherwise prints the reason on stdout and fails. PASCALINE_REDFIRST_VITEST
# (default "npx vitest run") is called with the files, PASCALINE_REDFIRST_GOLDEN (default "node scripts/golden.ts") with ONLY set.
red_first() {
  local wt="$1" spec="$2" eng="$3" log="$4" f ids="" stages="" scratch rc red=0 ran=0 err="" stage
  red_first_wanted "$spec" || { echo "red-first: skipped (the package does not say its tests fail on phase-1)" > "$log"; return 0; }
  local -a files=() gfiles=()
  mapfile -t files < <(git -C "$wt" diff --name-only --diff-filter=AMR phase-1...HEAD | grep -E '^app/.*\.test\.ts$' || true)
  mapfile -t gfiles < <(git -C "$wt" diff --name-only --diff-filter=AMR phase-1...HEAD -- 'tests/golden/*.yaml' || true)
  for f in "${gfiles[@]}"; do
    [[ -n "$f" ]] || continue
    stage="$(red_first_stage "$f")"; [[ -n "$stage" ]] || continue  # corpus, g2, *-known and calls-baseline have no stage of their own
    ids+=" $(git -C "$wt" diff -U0 phase-1...HEAD -- "$f" | grep '^+' | grep -oE '\bid: *"?[A-Za-z0-9_.-]+' | sed -E 's/id: *"?//' | tr '\n' ' ')"
    case ",$stages," in *",$stage,"*) ;; *) stages+="${stages:+,}$stage";; esac
  done
  if [[ ${#files[@]} -eq 0 && -z "${ids// /}" ]]; then echo "red-first: skipped (no new or changed vitest file or golden case; e2e is not run on phase-1)" > "$log"; return 0; fi
  scratch="$(mktemp -d)"; rmdir "$scratch"
  git -C "$wt" worktree add -q --detach "$scratch" phase-1 >/dev/null 2>&1 || { echo "could not make a scratch worktree of phase-1"; return 1; }
  : > "$log"
  for f in "${files[@]}" "${gfiles[@]}"; do
    [[ -n "$f" ]] || continue
    mkdir -p "$scratch/$(dirname "$f")"; git -C "$wt" show "HEAD:$f" > "$scratch/$f"
  done
  [[ ! -d "$wt/app/node_modules" ]] || ln -s "$wt/app/node_modules" "$scratch/app/node_modules"
  [[ ! -d "$wt/app/src/find/_gen" ]] || { mkdir -p "$scratch/app/src/find"; cp -a "$wt/app/src/find/_gen" "$scratch/app/src/find/"; }
  if [[ ${#files[@]} -gt 0 ]]; then
    ran=1; rc=0
    (cd "$scratch/app" && eval "${PASCALINE_REDFIRST_VITEST:-FORCE_COLOR=0 NO_COLOR=1 timeout 600 npx vitest run} $(printf '%q ' "${files[@]#app/}")") >> "$log" 2>&1 || rc=$?
    if [[ $rc -eq 0 ]]; then :
    elif [[ $rc -eq 124 ]]; then err="stage error: vitest timed out on phase-1"
    elif grep -qE '(Test Files|Tests) +[0-9]+ failed' "$log"; then red=1
    else err="stage error: vitest exit $rc on phase-1 without failed tests (no test files, import or environment error?)"; fi
  fi
  if [[ -n "${ids// /}" && $red -eq 0 && -z "$err" ]]; then
    ran=1; rc=0
    (cd "$scratch/app" && GIAC_OUT="$eng" ONLY="$stages" eval "${PASCALINE_REDFIRST_GOLDEN:-timeout 900 node scripts/golden.ts}") >> "$log" 2>&1 || rc=$?
    if [[ $rc -eq 0 ]]; then :
    elif [[ $rc -eq 124 ]]; then err="stage error: golden timed out on phase-1"
    elif ! grep -q 'GOLDEN GATE FAILED' "$log"; then err="stage error: golden exit $rc on phase-1 without GOLDEN GATE FAILED (engine or environment error?)"
    else  # red only when a FAIL line of the stage names the id as a whole token (PASS lines of passing cases do not count)
      local re
      for f in $ids; do
        re="$(sed 's/[][\.^$*+?(){}|\/-]/\\&/g' <<<"$f")"
        grep -qE "^FAIL [A-Za-z0-9_-]+:(.*[^A-Za-z0-9_.-])?${re}([^A-Za-z0-9_.-]|$)" "$log" && red=1
      done
    fi
  fi
  rm -f "$scratch/app/node_modules"; git -C "$wt" worktree remove --force "$scratch" >/dev/null 2>&1 || rm -rf "$scratch"
  [[ -z "$err" ]] || { echo "$err"; return 1; }
  [[ $red -eq 1 ]] || { echo "every new test passes on phase-1"; return 1; }
}
