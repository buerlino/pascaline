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
  git -C "$1" ls-tree -r "$2" -- engine/giac/build-wasm.sh engine/giac/patches engine/giac/wasm 2>/dev/null | { grep -v 'patches/README.md' || true; } | sha256sum | cut -c1-16
}
# engine_stamp <engine dir>: the key an engine directory was built from (empty when unstamped).
engine_stamp() { cat "$1/.engine-key" 2>/dev/null || true; }
engine_sha() { sha256sum "$1/giac.wasm" 2>/dev/null | cut -c1-16; }
# engine_build <worktree holding the sources> <key> <out root> <log>: builds once per key into <root>/key-<key> under the
# host-cpu lock; a finished build with the right stamp is reused, and the stamp is read again once the lock is held, so two
# runs that want one key build it once (A47a). Fails with the build log's tail on stdout.
engine_build() {
  local src="$1" key="$2" root="$3" log="$4" dest tmp rc=0
  dest="$root/key-$key"
  if [[ -f "$dest/giac.wasm" && "$(engine_stamp "$dest")" == "$key" ]]; then return 0; fi
  host_cpu_acquire "engine-$key" "engine $key:" || { echo "host-cpu lock busy"; return 1; }
  if [[ -f "$dest/giac.wasm" && "$(engine_stamp "$dest")" == "$key" ]]; then  # built by another run while this one waited
    tools/devlock.sh release host-cpu "engine-$key" >/dev/null || true; return 0
  fi
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
# engine_ensure <worktree holding the sources> <key> <out root> <log>: <root>/key-<key> exists with its stamp (A47a: the pipeline's
# GIAC_OUT is always such an immutable directory, never gsl). A gsl stamped with the key is copied (a gsl swapped during the copy is
# noticed by its stamp and the copy dropped); otherwise engine_build builds it.
engine_ensure() {
  local src="$1" key="$2" root="$3" log="$4" dest tmp
  dest="$root/key-$key"
  if [[ -f "$dest/giac.wasm" && "$(engine_stamp "$dest")" == "$key" ]]; then return 0; fi
  if [[ -f "$root/gsl/giac.wasm" && "$(engine_stamp "$root/gsl")" == "$key" ]]; then
    tmp="$root/.copy-$key.$$"; rm -rf "$tmp"
    if cp -a "$root/gsl" "$tmp" 2>/dev/null && [[ "$(engine_stamp "$tmp")" == "$key" && "$(engine_stamp "$root/gsl")" == "$key" ]]; then
      if [[ -f "$dest/giac.wasm" && "$(engine_stamp "$dest")" == "$key" ]] || mv -T "$tmp" "$dest" 2>/dev/null; then rm -rf "$tmp"; return 0; fi
    fi
    rm -rf "$tmp"
  fi
  engine_build "$src" "$key" "$root" "$log"
}
# engine_promote <out root> <key>: <root>/gsl (a copy for people and tools outside the pipeline) becomes the build of <key>; the
# old one stays as gsl.prev. Under a flock on <root>/.promote.lock, so two runs never promote at once; a gsl already at <key> is kept.
engine_promote() {
  local root="$1" key="$2"
  (
    flock -w 600 9 || exit 1
    [[ "$(engine_stamp "$root/gsl")" != "$key" || ! -f "$root/gsl/giac.wasm" ]] || exit 0
    rm -rf "$root/gsl.new" && cp -a "$root/key-$key" "$root/gsl.new" || exit 1
    rm -rf "$root/gsl.prev"
    if [[ ! -e "$root/gsl" ]]; then mv -T "$root/gsl.new" "$root/gsl"; exit; fi
    # one atomic exchange (coreutils >= 9.5): $root/gsl never goes missing for a concurrent user of the shared engine
    if mv --exchange "$root/gsl.new" "$root/gsl" 2>/dev/null; then mv -T "$root/gsl.new" "$root/gsl.prev"
    else mv -T "$root/gsl" "$root/gsl.prev" && mv -T "$root/gsl.new" "$root/gsl"; fi
  ) 9>"$root/.promote.lock"
}

# ---- A47a: jobs apart ----
# take_number <tasks dir> [<wanted pass number>]: the next job number from <tasks>/counter, read and written in one flock hold
# (<tasks>/counter.lock), so two jobs started at once never share a number. With a wanted pass number it also takes a pass
# number from <tasks>/pass-counter in the same hold: the wanted one when it is free (above the last taken and no .tasks/pass-<n>),
# else the next free one. Prints "<job>" or "<job> <pass>".
take_number() {
  local tasks="$1" want="${2:-}" fd c n p last
  mkdir -p "$tasks"
  exec {fd}>>"$tasks/counter.lock"
  if ! flock -w 120 "$fd"; then exec {fd}>&-; return 1; fi
  c="$(cat "$tasks/counter" 2>/dev/null || true)"; [[ "$c" =~ ^[0-9]+$ ]] || c=0
  n=$((c + 1)); echo "$n" > "$tasks/counter"
  if [[ -n "$want" ]]; then
    last="$(cat "$tasks/pass-counter" 2>/dev/null || true)"; [[ "$last" =~ ^[0-9]+$ ]] || last=0
    p="$want"; (( p > last )) || p=$((last + 1))
    while [[ -e "$tasks/pass-$p" ]]; do p=$((p + 1)); done
    mkdir -p "$tasks/pass-$p"; echo "$p" > "$tasks/pass-counter"
    echo "$n $p"
  else echo "$n"; fi
  exec {fd}>&-
}
# peek_number <tasks dir>: the number the next job would take (dry runs take none).
peek_number() {
  local c; c="$(cat "$1/counter" 2>/dev/null || true)"; [[ "$c" =~ ^[0-9]+$ ]] || c=0; echo $((c + 1))
}
# job_port <job number>: every kind's dev-server port (runs, passes, censuses, device steps, reports): 5200 + n % 100.
job_port() { echo $((5200 + $1 % 100)); }
# lock_wait <resource> <owner> <log prefix> <wait s>: a devlock lock, waiting up to <wait s>; logs (with the caller's log function,
# when it has one) "waiting for <resource> (<holder>)" once, and the wait's length when it ends.
lock_wait() {
  local res="$1" owner="$2" pre="$3" wait="$4" t0=$SECONDS holder locks
  tools/devlock.sh acquire "$res" "$owner" 0 >/dev/null 2>&1 && return 0
  locks="${coord:-${PASCALINE_COORD:-$(cd "$(git rev-parse --git-common-dir)/.." && pwd)/.coord}}/locks"
  holder="$(cat "$locks/$res/owner" 2>/dev/null || echo '?')"
  _lib_log "$pre waiting for $res ($holder)"
  if tools/devlock.sh acquire "$res" "$owner" "$wait" >/dev/null 2>&1; then
    _lib_log "$pre $res taken after a wait of $((SECONDS - t0)) s"; return 0
  fi
  _lib_log "$pre $res still busy after a wait of $((SECONDS - t0)) s"; return 1
}
# host_cpu_acquire <owner> <log prefix>: the host-cpu lock, waiting up to 7200 s (PASCALINE_CPU_WAIT).
host_cpu_acquire() { lock_wait host-cpu "$1" "$2" "${PASCALINE_CPU_WAIT:-7200}"; }
# integ_acquire <owner> <log prefix>: the integ lock (the merge queue, A47b), waiting up to 7200 s (PASCALINE_INTEG_WAIT).
# Lock order: integ before host-cpu; whoever holds host-cpu never waits for integ.
integ_acquire() { lock_wait integ "$1" "$2" "${PASCALINE_INTEG_WAIT:-7200}"; }
_lib_log() { if declare -F log >/dev/null; then log "$*"; fi; }
# The shell tests (A47a): run by `pipeline.sh selftest` and by the check `shell`. PASCALINE_SELFTEST_TESTS (absolute paths) overrides.
SELFTESTS=(scripts/pipeline.test.sh scripts/gc.test.sh tools/devlock.test.sh)
# selftest_run <repo dir> <log>: runs each test (clean of the pipeline's own environment); prints "PASSED", or
# "FAILED (<test>: <first failing line>)" and fails.
selftest_run() {
  local dir="$1" log="$2" t rc line
  local -a tests
  if [[ -n "${PASCALINE_SELFTEST_TESTS:-}" ]]; then read -ra tests <<<"$PASCALINE_SELFTEST_TESTS"
  else tests=("${SELFTESTS[@]/#/$dir/}"); fi
  : > "$log"
  for t in "${tests[@]}"; do
    echo "== $t" >> "$log"; rc=0
    (cd "$dir" && env -u PASCALINE_LOCK_PID -u PASCALINE_COORD -u GIAC_OUT -u PW_PORT -u PASCALINE_SELFTEST_TESTS timeout -k 30 1800 "$t") > "$log.one" 2>&1 || rc=$?
    cat "$log.one" >> "$log"
    if [[ $rc -ne 0 ]]; then
      line="$(grep -m1 -E '^FAIL' "$log.one" || tail -n 1 "$log.one")"; [[ $rc -ne 124 ]] || line="timed out after 1800 s"
      rm -f "$log.one"; echo "FAILED (${t##*/}: $(cut -c1-200 <<<"${line:-exit $rc}"))"; return 1
    fi
  done
  rm -f "$log.one"; echo PASSED
}
# shell_selected: succeeds when a changed file (one per line, on stdin) is a pipeline script or a tool script (A47a).
shell_selected() { grep -qE '^(scripts/|tools/[^/]*\.sh$)'; }

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
    else  # red only when a detail line (two spaces, the stage, the id, a colon: golden.ts:218) names the id as a whole token; the FAIL summary line names no case
      local re
      for f in $ids; do
        re="$(sed 's/[][\.^$*+?(){}|\/-]/\\&/g' <<<"$f")"
        grep -qE "^  [A-Za-z0-9_-]+ ${re}:" "$log" && grep -q 'GOLDEN GATE FAILED' "$log" && red=1
      done
    fi
  fi
  rm -f "$scratch/app/node_modules"; git -C "$wt" worktree remove --force "$scratch" >/dev/null 2>&1 || rm -rf "$scratch"
  [[ -z "$err" ]] || { echo "$err"; return 1; }
  [[ $red -eq 1 ]] || { echo "every new test passes on phase-1"; return 1; }
}
# A25: the paths whose change plans the golden check: the engine, the parser, units, Find, the golden cases, and every script
# the golden gate or its engine stages run (golden.ts and golden/, golden-*.ts, invariants, calls-budget, behaviour-diff, the sweeps).
GOLDEN_RE='^(engine/|app/src/engine/|app/src/input/|app/src/units/|tests/golden/|find/|tools/find-index/|tools/probes/(giac-check\.mjs|giaccheck/|sweep/|casback/)|tests/engine/|app/scripts/(unit-case\.ts|golden\.ts|golden/.*\.ts|golden-[a-z-]+\.ts|invariants\.ts|calls-budget\.ts|behaviour-diff\.ts|sweep\.ts|seqsweep\.ts|casback\.ts|viewsweep\.ts|findcensus\.ts))'
# golden_selected: succeeds when a changed file (one per line, on stdin) plans the golden check.
golden_selected() { grep -qE "$GOLDEN_RE"; }

# behaviour_selected: succeeds when a changed file (one per line, on stdin) is engine, input or units code (A18).
behaviour_selected() { grep -qE '^(engine/|app/src/engine/|app/src/input/|app/src/units/)'; }
# behaviour_section <integ> <wt> <outfile>: A18, the "## Behaviour changes" section of the audit's input: G55's behaviour-diff.ts between
# the phase-1 worktree and the worker's, once per call, at most 20 minutes, never retried. PASCALINE_BEHAVIOUR_TOOL overrides the script.
behaviour_section() {
  local integ="$1" wt="$2" out="$3" tool="${PASCALINE_BEHAVIOUR_TOOL:-$1/app/scripts/behaviour-diff.ts}" body rc=0
  body="$(cd "$wt/app" && timeout -k 30 "${PASCALINE_BEHAVIOUR_SECONDS:-1200}" node "$tool" "$integ" "$wt" 2>&1)" || rc=$?
  {
    echo "## Behaviour changes (behaviour-diff.ts: phase-1 against $(basename "$wt"))"
    if [[ $rc -eq 124 || $rc -eq 137 ]]; then echo "timed out after 20 min (judge the diff without it)"
    elif [[ $rc -ne 0 ]]; then echo "failed to run (exit $rc; judge the diff without it):"; tail -n 10 <<<"$body"
    else printf '%s\n' "$body"; fi
  } > "$out"
}

# The gate's engine stages, run after golden (A25; app/scripts/gate.ts).
ENGINE_STAGES=(sweep seqsweep casback viewsweep findcensus)
# stage_findings <log>: prints the lines naming a NEW, NOW PASSING, CHANGED or GONE entry of a stage and succeeds when there are any.
stage_findings() { grep -E '^ {2}(sweep|seq|casback|viewsweep|findcensus) (NEW|NOW PASSING|CHANGED|GONE)' "$1"; }
