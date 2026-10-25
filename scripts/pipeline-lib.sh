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

# A25: the paths whose change plans the golden check: the engine, the parser, units, Find, the golden cases, and every script
# the golden gate or its engine stages run (golden.ts and golden/, golden-*.ts, invariants, calls-budget, behaviour-diff, the sweeps).
GOLDEN_RE='^(engine/|app/src/engine/|app/src/input/|app/src/units/|tests/golden/|find/|tools/find-index/|app/scripts/(unit-case\.ts|golden\.ts|golden/.*\.ts|golden-[a-z-]+\.ts|invariants\.ts|calls-budget\.ts|behaviour-diff\.ts|sweep\.ts|seqsweep\.ts|casback\.ts|viewsweep\.ts|findcensus\.ts))'
# golden_selected: succeeds when a changed file (one per line, on stdin) plans the golden check.
golden_selected() { grep -qE "$GOLDEN_RE"; }

# The gate's engine stages, run after golden (A25; app/scripts/gate.ts).
ENGINE_STAGES=(sweep seqsweep casback viewsweep findcensus)
# stage_findings <log>: prints the lines naming a NEW, NOW PASSING, CHANGED or GONE entry of a stage and succeeds when there are any.
stage_findings() { grep -E '^ {2}(sweep|seq|casback|viewsweep|findcensus) (NEW|NOW PASSING|CHANGED|GONE)' "$1"; }
