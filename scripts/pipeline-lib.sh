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

# machine_failure <check log>: succeeds when the log shows the machine, not the code, failed (A24): a missing tool or node_modules (a bare "Cannot find module" can be the worker's own wrong import path, so it is not matched).
machine_failure() {
  grep -qE 'command not found|node_modules (is )?missing' "$1" 2>/dev/null
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
