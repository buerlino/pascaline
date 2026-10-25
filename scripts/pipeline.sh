#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# scripts/pipeline.sh: one work package, end to end, with fresh headless agents and a small context
# (docs/shifts/rules.md section 4; docs/shifts/brief.md section 0c).
#
#   scripts/pipeline.sh <ron|gorge|annabell|sandra> "<package ID or task text>" [options]
#       --branch B          branch (default: the package heading's branch, or p1/<agent>-<slug>)
#       --id ID             the package ID when the task is free text (a FIX package: G17f1)
#       --model M           worker model: sonnet (default) or opus;  --effort E (default medium)
#       --audit-model M     sofia's model for the diff audit: auto (default: opus when --model opus or the diff
#                           touches app/src/input/, app/src/engine/, app/src/units/, engine/ or spec/keyboard.yaml, else
#                           sonnet), sonnet or opus. auto is a floor: a gorge package, or such a diff, gets opus even
#                           when sonnet is named (logged: "audit model raised to opus: <why>")
#       --no-worker         review-only: the branch must exist; phase-1 is merged into it first (a conflict is a
#                           fix round for <agent>), then the checks, the audit and the merge as usual
#       --checks LIST       auto (default), none, or a comma list of typecheck,vitest,e2e,golden,size,docs
#       --no-merge          stop after the audit; print the merge command instead
#       --dry-run           print the bundle and the commands; start no agent, make no worktree
#   scripts/pipeline.sh pass <n> "<IDs with merge commits or unmerged branches>" ["<open questions>"] [--dry-run]
#                           an Opus pass by sofia on phase-1 (brief section 0c "Opus pass")
#   scripts/pipeline.sh device <n> [--dry-run]
#                           A33: the core list on the night's device ($ANDROID_SERIAL): test APK of phase-1's HEAD, install, tools/core-device.sh;
#                           logs `CORE DEVICE <p>/<a> (known <k>, new <ids or none>) on <sha>`; skips (DEVICE SKIPPED), never fails
#   scripts/pipeline.sh flakes <n> [--dry-run]
#                           A37: the flake census: vitest and e2e five times on phase-1's HEAD (host-cpu lock); .tasks/flakes-<date>.md and
#                           the log line `FLAKES <n>: vitest <k> of 5 runs clean, e2e <k> of 5, flaky: <ids or none>`; stops if HEAD moves
#   scripts/pipeline.sh report
#                           the night's shift report, written and committed on phase-1 by a fresh agent
#
# Lifecycle: bundle → worker (own worktree from phase-1) → deterministic checks, at most two fix
# rounds fed only the failing output → sofia audits `git diff -U5 phase-1...<branch>` plus the
# acceptance criteria → `git merge --no-ff --signoff <the audited sha>` into phase-1 (NOT MERGED when the branch is
# not at that sha) → worktree and branch removed.
# Progress goes to .tasks/<n>-<id>/run.log and one line per step to .coord/log.md; stdout gets
# only the final RESULT line, on every exit (die too: "RESULT #n ID: NOT MERGED (why)", or
# "RESULT -: NOT STARTED (why)" before a run number exists). Exit 0 merged, 1 not merged, 2 not started
# or failed early, 75 usage limit (henri stops, night.sh waits).
# Environment: PASCALINE_DL_DIR and PASCALINE_QALC_DL_DIR (tarball caches, default: the main checkout's
# engine/giac/_downloads and engine/qalc/_downloads), GIAC_OUT, QALC_OUT; PW_PORT=$((5200 + n % 100)) (a pass: 5290 + n) is
# exported to the worker, the fix rounds and the checks, so parallel runs never share a dev server.
# Locks: host-cpu around the checks, integ (600 s) around the merge into phase-1.
set -euo pipefail
export PASCALINE_LOCK_PID=$$   # A35: locks taken here (and by the agents it starts) record this pid
# shellcheck source=scripts/pipeline-lib.sh
source "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/pipeline-lib.sh"

main="$(cd "$(git rev-parse --git-common-dir)/.." && pwd)"
cd "$main"
coord="${PASCALINE_COORD:-$main/.coord}"
tasks="$main/.tasks"
mkdir -p "$tasks/archive" "$coord"
export PASCALINE_DL_DIR="${PASCALINE_DL_DIR:-$main/engine/giac/_downloads}"
export PASCALINE_QALC_DL_DIR="${PASCALINE_QALC_DL_DIR:-$main/engine/qalc/_downloads}"
# A28: unless the caller sets GIAC_OUT, the engine is managed: the shared build is $engine_root/gsl, a branch that changes the
# engine's inputs is built once per key into $engine_root/key-<key>.
engine_root="$main/engine/giac/_out"; engine_managed=1; [[ -z "${GIAC_OUT:-}" ]] || engine_managed=0
export GIAC_OUT="${GIAC_OUT:-$engine_root/gsl}"
[[ -n "${QALC_OUT:-}" ]] || { [[ -n "$(ls -A "$main/engine/qalc/_out/dev" 2>/dev/null)" ]] && export QALC_OUT="$main/engine/qalc/_out/dev"; } || true
export CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0
claude_common=(--permission-mode auto --output-format text --no-session-persistence)
worker_tools=(--disallowedTools Agent)
# shellcheck disable=SC2054  # one comma-separated argument for --allowedTools
audit_tools=(--allowedTools Read,Grep,Glob --disallowedTools Bash,Edit,Write,Agent,NotebookEdit)

log() { [[ ! -s "$coord/log.md" || -z "$(tail -c1 "$coord/log.md")" ]] || echo >> "$coord/log.md"; printf -- '- %s %s\n' "$(date +%H:%M)" "$*" >> "$coord/log.md"; }
runlog() { printf '%s %s\n' "$(date +%H:%M:%S)" "$*" >> "$run/run.log"; }
# Every exit prints one RESULT line; runno and id are set once the run has a number and an ID.
runno=""; id=""
die() {
  echo "pipeline: $*" >&2
  if [[ -n "$runno" ]]; then
    [[ "${dry:-0}" -eq 1 ]] || log "pipeline #$runno $id: NOT MERGED ($*)"; echo "RESULT #$runno $id: NOT MERGED ($*)"
  else
    [[ "${dry:-0}" -eq 1 ]] || log "pipeline: NOT STARTED ($*)"; echo "RESULT -: NOT STARTED ($*)"
  fi
  exit 2
}

# The worktree where phase-1 is checked out (never switch branches in the main checkout).
integ_dir() {
  git worktree list --porcelain | awk '/^worktree /{w=$2} /^branch refs\/heads\/phase-1$/{print w}'
}
ensure_integ() {
  integ="$(integ_dir)"
  if [[ -z "$integ" ]]; then
    integ="$main/.claude/worktrees/phase-1"
    git worktree add "$integ" phase-1 >/dev/null
  fi
  [[ -z "$(git -C "$integ" status --porcelain --untracked-files=no)" ]] || die "phase-1 worktree $integ is not clean"
}

# Node modules: every worktree gets its own hard-link copy of the phase-1 worktree's, so an npm ci in one never empties another's
# (A24); the main checkout may sit on an old branch (A34). A phase-1 copy that lacks a package of its lock is rebuilt first, under
# the host-cpu lock; a failing npm ci ends the run as a machine failure. A symlink left by an older run is replaced.
refresh_integ_node_modules() {
  [[ ! -e "$integ/app/node_modules" ]] || node_modules_stale "$integ/app" || return 0
  runlog "node_modules of $integ/app are missing or stale: npm ci"
  tools/devlock.sh acquire host-cpu "pipeline-$n" 1800 >/dev/null || die "host-cpu lock busy"
  local rc=0; (cd "$integ/app" && timeout 1800 npm ci --prefer-offline) > "$run/npm-ci.log" 2>&1 || rc=1
  tools/devlock.sh release host-cpu "pipeline-$n" >/dev/null || true
  if [[ $rc -ne 0 ]]; then
    log "pipeline #$n $id: NOT MERGED (machine: npm ci in phase-1 failed); see $run/npm-ci.log"
    echo "RESULT #$n $id: NOT MERGED (machine: npm ci in the phase-1 worktree failed; see $run/npm-ci.log)"; exit 1
  fi
}
setup_node_modules() {
  local wt="$1" t0=$SECONDS
  [[ ! -L "$wt/app/node_modules" ]] || rm -f "$wt/app/node_modules"
  [[ -e "$wt/app/node_modules" ]] && return 0
  refresh_integ_node_modules
  # copy aside, then rename: an interrupted copy never leaves a half-filled node_modules that the guard above would keep
  rm -rf "$wt/app/node_modules.tmp.$$"
  if cp -al "$integ/app/node_modules" "$wt/app/node_modules.tmp.$$"; then mv "$wt/app/node_modules.tmp.$$" "$wt/app/node_modules"
  else rm -rf "$wt/app/node_modules.tmp.$$"; die "could not copy node_modules into $wt"; fi
  runlog "node_modules copied from $integ/app ($((SECONDS - t0)) s)"
}

# ---------- subcommand: pass ----------
if [[ "${1:-}" == "pass" ]]; then
  [[ $# -ge 3 ]] || die "usage: pipeline.sh pass <n> \"<IDs>\" [\"<open questions>\"]"
  n="$2"; ids="$3"; open="${4:-none}"
  export PW_PORT=$((5290 + n))  # a pass's e2e never meets a dev server of another checkout
  if [[ "${5:-}" == "--dry-run" || "${4:-}" == "--dry-run" ]]; then
    [[ "$open" == "--dry-run" ]] && open=none
    integ="$(integ_dir)"; : "${integ:=$main/.claude/worktrees/phase-1}"  # shown, never created
    echo "DRY RUN: Opus pass $n on: $ids; open questions: $open; PW_PORT=$PW_PORT; worktree $integ; starts nothing"; echo "RESULT pass $n: DRY RUN"; exit 0
  fi
  ensure_integ; run="$tasks/pass-$n"; mkdir -p "$run"
  log "Opus pass $n: spawned sofia (opus) on: $ids; waiting."
  prompt="Opus pass $n of the night shift: follow \"Opus pass (instructions for the Opus agent)\" in docs/shifts/brief.md section 0c for packages $ids. Open questions from the log: $open. You run in the phase-1 worktree $integ. Run any e2e with PW_PORT=$PW_PORT (exported; do not change it). Take the integration lock around the doc commit: tools/devlock.sh acquire integ pass-$n 600 before it, tools/devlock.sh release integ pass-$n right after. Reply in exactly the form the section gives (OPUS PASS, VERDICT, FIX lines, QUEUE, NOTES)."
  set +e
  (cd "$integ" && timeout -k 60 7200 claude -p --agent sofia --model opus --effort medium "${claude_common[@]}" -n "pass-$n" "$prompt") > "$run/reply.md" 2> "$run/stderr.log"
  rc=$?; set -e
  if [[ $rc -ne 0 ]] && grep -qiE 'usage limit|rate limit|429|overloaded' "$run/stderr.log" "$run/reply.md"; then
    log "Opus pass $n: LIMIT (claude exit $rc)"; echo "RESULT pass $n: LIMIT"; exit 75
  fi
  # the reply from its OPUS PASS line on (A17); reply.md keeps it whole
  { echo "- $(date +%H:%M) Opus pass $n reply:"; from_opus_pass "$run/reply.md" | sed 's/^/    /'; } >> "$coord/log.md"
  from_opus_pass "$run/reply.md"; echo "RESULT pass $n: done (exit $rc)"; exit 0
fi

# ---------- subcommand: device ----------
# A33: the core list on the night's device ($ANDROID_SERIAL) after an Opus pass; never stops the night (exit 0 always).
if [[ "${1:-}" == "device" ]]; then
  [[ $# -ge 2 && "$2" =~ ^[0-9]+$ ]] || die "usage: pipeline.sh device <n> [--dry-run]"
  n="$2"; dev="${ANDROID_SERIAL:-}"; run="$tasks/device-$n"
  if [[ "${3:-}" == "--dry-run" ]]; then
    integ="$(integ_dir)"; : "${integ:=$main/.claude/worktrees/phase-1}"
    echo "DRY RUN: device step $n on ${dev:-<ANDROID_SERIAL unset: DEVICE SKIPPED>}; output in $run; at most 30 minutes"
    echo "1. (cd $integ && tools/device-build.sh --test) = the test APK of phase-1's HEAD, built under the host-cpu lock (build.sh takes it)"
    echo "2. tools/devlock.sh acquire ${dev:-<serial>} device-$n-install 600; adb -s ${dev:-<serial>} install -r $integ/dist/pascaline.apk (our app only); release"
    echo "3. ANDROID_SERIAL=${dev:-<serial>} tools/core-device.sh   (A32's runner; holds the device lock, stay-awake and restore)"
    echo "4. log: - HH:MM pipeline device $n: CORE DEVICE <p>/<a> (known <k>, new <ids or none>) on <sha>"
    echo "skipped, never failed (exit 0): no device or unauthorized, battery under 10 %, screen locked (KEYCODE_WAKEUP, dumpsys window isKeyguardShowing=true; checked before the build and again before the runner), a build failure -> DEVICE SKIPPED (<why>)"
    echo "RESULT device $n: DRY RUN"; exit 0
  fi
  ensure_integ; mkdir -p "$run"
  skip() { log "pipeline device $n: DEVICE SKIPPED ($*)"; echo "RESULT device $n: DEVICE SKIPPED ($*)"; exit 0; }
  [[ -n "$dev" ]] || skip "ANDROID_SERIAL not set"
  st="$(timeout -k 5 20 adb -s "$dev" get-state 2>&1 | tr -d '\r' | tail -n1 || true)"
  [[ "$st" == device ]] || skip "device $st"
  bat="$(timeout -k 5 20 adb -s "$dev" shell dumpsys battery 2>/dev/null | tr -d '\r' | awk '/^ *level:/{print $2}')"
  [[ -z "$bat" || "$bat" -ge 10 ]] || skip "battery $bat %"
  locked() {  # wake does not unlock: a PIN or pattern keeps isKeyguardShowing=true
    timeout -k 5 20 adb -s "$dev" shell input keyevent KEYCODE_WAKEUP >/dev/null 2>&1 || true; sleep 1
    local w; w="$(timeout -k 5 20 adb -s "$dev" shell dumpsys window 2>/dev/null | tr -d '\r' || true)"  # captured first: grep -q would SIGPIPE adb
    grep -q 'isKeyguardShowing=true' <<<"$w"
  }
  locked && skip "screen locked"
  sha="$(git -C "$integ" rev-parse --short HEAD)"
  t0=$SECONDS
  # build.sh takes the host-cpu lock itself (waiting for it): do not hold it here
  rc=0; (cd "$integ" && timeout -k 60 1200 tools/device-build.sh --test) > "$run/build.log" 2>&1 || rc=$?
  [[ $rc -eq 0 && -f "$integ/dist/pascaline.apk" ]] || skip "build failed, rc=$rc; see $run/build.log"
  "$integ/tools/devlock.sh" acquire "$dev" "device-$n-install" 600 >/dev/null || skip "device lock busy"
  rc=0; timeout -k 30 300 adb -s "$dev" install -r "$integ/dist/pascaline.apk" > "$run/install.log" 2>&1 || rc=$?
  "$integ/tools/devlock.sh" release "$dev" "device-$n-install" >/dev/null || true
  [[ $rc -eq 0 ]] || skip "install failed, rc=$rc; see $run/install.log"
  before=0; [[ -f "$coord/device-runs.jsonl" ]] && before="$(wc -l < "$coord/device-runs.jsonl")"
  left=$((1800 - (SECONDS - t0))); (( left > 120 )) || skip "no time left after the build"
  locked && skip "screen locked (after the build)"
  rc=0; ANDROID_SERIAL="$dev" PASCALINE_COORD="$coord" timeout -k 60 "$left" "$integ/tools/core-device.sh" > "$run/core.log" 2>&1 || rc=$?
  line="$(grep -E '^CORE DEVICE ' "$run/core.log" | tail -n1 || true)"
  [[ -n "$line" ]] || skip "runner gave no CORE DEVICE line, rc=$rc; see $run/core.log"
  new="$(tail -n +"$((before + 1))" "$coord/device-runs.jsonl" 2>/dev/null | grep '"kind":"core"' | grep '"ok":false' | grep -o '"case":"c[0-9]*"' | cut -d'"' -f4 | sort -u | paste -sd, - || true)"
  known="$(grep -oE 'known [0-9]+' <<<"$line" | cut -d' ' -f2)"; needs="$(grep -oE 'needs [0-9]+' <<<"$line" | cut -d' ' -f2)"
  counts="$(grep -oE '[0-9]+/[0-9]+' <<<"$line" | head -n1)"
  log "pipeline device $n: CORE DEVICE $counts (known $known, new ${new:-none}) on $sha"
  echo "RESULT device $n: CORE DEVICE $counts (known $known, needs $needs, new ${new:-none}) on $sha ($((SECONDS - t0)) s)"; exit 0
fi

# ---------- subcommand: flakes ----------
# A37: the flake census: vitest and e2e five times each on phase-1's HEAD (host-cpu lock held throughout); a test that failed in some
# runs and passed in others is a flake. Output: .tasks/flakes-<date>.md and one log line. Refuses to go on when HEAD moves.
if [[ "${1:-}" == "flakes" ]]; then
  [[ $# -ge 2 && "$2" =~ ^[0-9]+$ ]] || die "usage: pipeline.sh flakes <n> [--dry-run]"
  n="$2"; runs="${PASCALINE_FLAKES_RUNS:-5}"; run="$tasks/flakes-$n"; out_md="$tasks/flakes-$(date +%F).md"
  export PW_PORT=$((5300 + n % 100))
  if [[ "${3:-}" == "--dry-run" ]]; then
    integ="$(integ_dir)"; : "${integ:=$main/.claude/worktrees/phase-1}"
    echo "DRY RUN: flake census $n on the HEAD of $integ; $runs runs each of vitest (npm test) and e2e (npm run test:e2e); PW_PORT=$PW_PORT"
    echo "1. tools/devlock.sh acquire host-cpu flakes-$n 1800, held until the end; npm run index once"
    echo "2. before every run: HEAD must still be the first run's sha, else FLAKES $n: ABORTED (HEAD moved); load average noted per run"
    echo "3. logs in $run; a test failing in some runs and passing in others is flaky (always failing is not)"
    echo "4. output $out_md; log: - HH:MM pipeline flakes $n: FLAKES $n: vitest <k> of $runs runs clean, e2e <k> of $runs, flaky: <ids or none>"
    echo "RESULT flakes $n: DRY RUN"; exit 0
  fi
  ensure_integ; mkdir -p "$run"; t0=$SECONDS
  sha="$(git -C "$integ" rev-parse HEAD)"
  tools/devlock.sh acquire host-cpu "flakes-$n" 1800 >/dev/null || { log "pipeline flakes $n: FLAKES SKIPPED (host-cpu lock busy)"; echo "RESULT flakes $n: SKIPPED (host-cpu lock busy)"; exit 0; }
  trap 'tools/devlock.sh release host-cpu "flakes-$n" >/dev/null 2>&1 || true' EXIT
  logs_tool="$integ/app/scripts/pipeline-logs.ts"
  vcmd="${PASCALINE_FLAKES_VITEST:-FORCE_COLOR=0 NO_COLOR=1 FIND_INDEX=required timeout 1800 npm run -s test}"
  ecmd="${PASCALINE_FLAKES_E2E:-FORCE_COLOR=0 timeout 2700 npm run -s test:e2e}"
  (cd "$integ/app" && timeout 1800 npm run -s index) > "$run/index.log" 2>&1 || true
  clean_v=0; clean_e=0; ran=0; aborted=""; loads=""
  for i in $(seq 1 "$runs"); do
    head_is "$integ" "$sha" || { aborted="HEAD moved before run $i ($(git -C "$integ" rev-parse --short HEAD), not ${sha:0:9})"; break; }
    la="$(cut -d' ' -f1-3 /proc/loadavg 2>/dev/null || echo '?')"
    rv=0; (cd "$integ/app" && eval "$vcmd") > "$run/vitest-$i.log" 2>&1 || rv=$?
    re=0; (cd "$integ/app" && eval "$ecmd") > "$run/e2e-$i.log" 2>&1 || re=$?
    la2="$(cut -d' ' -f1-3 /proc/loadavg 2>/dev/null || echo '?')"
    loads+="| $i | $la | $la2 | $([[ $rv -eq 0 ]] && echo clean || echo "failed ($rv)") | $([[ $re -eq 0 ]] && echo clean || echo "failed ($re)") |"$'\n'
    [[ $rv -ne 0 ]] || clean_v=$((clean_v + 1)); [[ $re -ne 0 ]] || clean_e=$((clean_e + 1))
    for c in vitest e2e; do node "$logs_tool" items "$c" "$run/$c-$i.log" > "$run/$c-$i.items" 2>/dev/null || : > "$run/$c-$i.items"; done
    ran=$i
  done
  flaky_v="$(flaky_items "$ran" "$run"/vitest-*.items | sed 's/^/vitest /')"; flaky_e="$(flaky_items "$ran" "$run"/e2e-*.items | sed 's/^/e2e /')"
  [[ $ran -gt 0 ]] || { flaky_v=""; flaky_e=""; }
  ids="$(printf '%s\n%s\n' "$flaky_v" "$flaky_e" | awk -F'\t' 'NF >= 3 { print ($3 == "" ? $2 : $2 ": " $3) " (" $1 ")" } NF == 2 { print $2 " (" $1 ")" }' | paste -sd, - | sed 's/,/, /g')"
  {
    echo "# Flake census $n, $(date +%F) $(date +%H:%M)"
    echo; echo "Commit ${sha:0:9}; $ran of $runs runs; vitest $clean_v clean, e2e $clean_e clean.${aborted:+ ABORTED: $aborted.}"
    echo; echo "## Flaky (failed in some runs, passed in others)"
    if [[ -n "$flaky_v$flaky_e" ]]; then printf '%s\n%s\n' "$flaky_v" "$flaky_e" | awk 'NF' | tr '\t' ' ' | sed 's/^/- /; s/ *$//'; else echo "none"; fi
    echo; echo "## Load average and result per run (1/5/15 min before and after)"
    echo "| run | load before | load after | vitest | e2e |"; echo "|---|---|---|---|---|"; printf '%s' "$loads"
  } > "$out_md"
  if [[ -n "$aborted" ]]; then line="FLAKES $n: ABORTED ($aborted) after $ran runs: vitest $clean_v of $runs runs clean, e2e $clean_e of $runs, flaky: ${ids:-none}"
  else line="FLAKES $n: vitest $clean_v of $runs runs clean, e2e $clean_e of $runs, flaky: ${ids:-none}"; fi
  log "pipeline flakes $n: $line (file $out_md)"
  echo "RESULT flakes $n: $line ($((SECONDS - t0)) s; $out_md)"; exit 0
fi

# ---------- subcommand: report ----------
if [[ "${1:-}" == "report" ]]; then
  ensure_integ; run="$tasks/report-$(date +%F)"; mkdir -p "$run"
  log "Shift report: spawned sonnet writer; waiting."
  prompt="Write the shift report of docs/shifts/brief.md section 0c (\"Shift report\") for the night section of .coord/log.md (the log is on stdin). You run in the phase-1 worktree $integ: commit the report there with git commit -s and the Sonnet trailer, holding the integration lock around the commit (tools/devlock.sh acquire integ report 600 before, tools/devlock.sh release integ report after). Never push. Reply with the commit hash only."
  tail -n 400 "$coord/log.md" | (cd "$integ" && timeout -k 60 1800 claude -p --model sonnet --effort medium "${claude_common[@]}" -n report "$prompt") > "$run/reply.md" 2> "$run/stderr.log" || true
  log "Shift report: $(tail -n1 "$run/reply.md")"; echo "RESULT report: $(tail -n1 "$run/reply.md")"; exit 0
fi

# ---------- a package ----------
[[ $# -ge 2 ]] || die "usage: pipeline.sh <ron|gorge|annabell|sandra> \"<ID or task>\" [options]"
agent="$1"; task="$2"; shift 2
case "$agent" in ron|gorge|annabell|sandra) ;; *) die "unknown agent $agent";; esac
branch=""; id=""; model="sonnet"; effort="medium"; audit_model="auto"; checks="auto"; merge=1; dry=0; nowork=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch) branch="$2"; shift 2;; --id) id="$2"; shift 2;; --model) model="$2"; shift 2;;
    --effort) effort="$2"; shift 2;; --audit-model) audit_model="$2"; shift 2;; --checks) checks="$2"; shift 2;;
    --no-merge) merge=0; shift;; --no-worker) nowork=1; shift;; --dry-run) dry=1; shift;; *) die "unknown option $1";;
  esac
done

ensure_integ
brief="$integ/docs/shifts/brief.md"

# The spec: the package file docs/shifts/packages/<ID>.md (its first line is the heading with the branch), or the task text itself.
spec_file="$(mktemp)"; trap 'rm -f "$spec_file"' EXIT
if [[ "$task" =~ ^[A-Z][0-9]+[a-z0-9]*$ ]]; then
  id="${id:-$task}"
  pkg="$integ/docs/shifts/packages/$task.md"
  [[ -f "$pkg" ]] || die "package $task has no package file $pkg"
  cp "$pkg" "$spec_file"
  heading="$(head -n1 "$pkg")"
  # shellcheck disable=SC2016
  if [[ -z "$branch" ]]; then
    branch="$(grep -oE 'branch `[^`]+`' <<<"$heading" | head -n1 | sed 's/branch `//; s/`$//' || true)"
    [[ -n "$branch" ]] || die "package $task: the first line of $pkg has no branch \`...\`: $heading"
  fi
else
  printf '%s\n' "$task" > "$spec_file"
  id="${id:-task}"
fi
slug="$(tr -cs 'a-z0-9' '-' <<<"${id,,}" | sed 's/^-//; s/-$//')"
[[ -n "$branch" ]] || branch="p1/$agent-$slug"

# The run directory and its number.
counter="$tasks/counter"; [[ -f "$counter" ]] || echo 0 > "$counter"
n=$(( $(cat "$counter") + 1 ))
run="$tasks/$(printf '%03d' "$n")-$slug"
if [[ $dry -eq 1 ]]; then run="$(mktemp -d)"; fi
mkdir -p "$run"
export PW_PORT=$((5200 + n % 100))  # a dev-server port per run (app/playwright.config.ts)

# The bundle: spec, the files it names (capped), the report format and the definition of done.
bundle="$run/spec.md"
{
  echo "# Pipeline run $n: $id for $agent on branch $branch"
  echo; echo "## Task"; cat "$spec_file"
  echo; echo "## Files the task names (first 400 lines each; read more yourself if you need it)"
  total=0
  { grep -oE '\b[A-Za-z0-9_][A-Za-z0-9_./-]*\.(ts|svelte|yaml|yml|md|mjs|js|sh|py|cc|json|css|html)\b' "$spec_file" || true; } | sort -u |
  while read -r f; do
    [[ "$f" == docs/shifts/* || "$f" == *package-lock.json ]] && continue
    [[ -f "$integ/$f" ]] || continue
    [[ $total -ge 2000 ]] && { echo "(more files omitted: bundle cap reached)"; break; }
    lines=$(wc -l < "$integ/$f"); echo; echo "### $f ($lines lines)"; echo '```'; head -n 400 "$integ/$f"; echo '```'
    total=$((total + (lines < 400 ? lines : 400)))
  done
  echo; echo "## Your report (brief section 2)"
  awk '/^### Your report/{p=1} /^## 8\./{p=0} p' "$brief"
  echo; echo "## Definition of done (brief section 8, each branch)"
  awk '/^## 8\. Definition of done/{p=1;next} /^## 8a/{p=0} p' "$brief" | head -n 3
} > "$bundle"
# Acceptance criteria for the auditor: the task text and the per-branch definition of done.
{ echo "## Acceptance criteria"; cat "$spec_file"; echo; awk '/^## 8\. Definition of done/{p=1;next} /^## 8a/{p=0} p' "$brief" | head -n 3; } > "$run/criteria.md"

no_wait="Never start a background loop that waits on a process: pgrep -f matches the loop's own command line, so it never ends (run 58 held its session open 39 minutes); run every check in the foreground with a timeout."
worker_prompt="You are $agent in pipeline run $n for package $id. The task bundle is on stdin (also at $bundle). You run in your own worktree on branch $branch from phase-1; never switch branches or commit elsewhere. Read docs/shifts/rules.md sections 3 and 5 for the standing rules, then work only from the bundle: read further files when the task needs them, by section. Keep your context small. Run typecheck and the unit tests you touch while you work; the pipeline runs the full checks afterwards. Tick your backlog line in docs/backlog.md and put open decisions under \"Needs the user\" in docs/decisions.md on this branch; change no other shared file. Commit small with git commit -s and the Co-Authored-By trailer of your model; end with the report commit from the bundle. $no_wait Reply in at most five lines: last commit, done or not done, open questions."

wt="$main/.claude/worktrees/pl-$(printf '%03d' "$n")-$slug"
if [[ $dry -eq 1 ]]; then
  echo "DRY RUN: pipeline run $n, package $id, agent $agent ($model, $effort), branch $branch"
  echo "PASCALINE_QALC_DL_DIR=$PASCALINE_QALC_DL_DIR PASCALINE_DL_DIR=$PASCALINE_DL_DIR PW_PORT=$PW_PORT"
  echo "integration worktree: $integ"; echo "worker worktree: $wt"
  echo "setup: cp -al $integ/app/node_modules $wt/app/node_modules   (own copy per worktree, from the phase-1 worktree; npm ci there first when it lacks a package of its lock; a symlink is replaced)"
  echo "machine failure: a check log with 'command not found', a missing node_modules or a missing bare module ends the run as NOT MERGED (machine: ...), no fix round"
  if [[ $engine_managed -eq 0 ]]; then echo "engine: GIAC_OUT=$GIAC_OUT set by the caller; no engine build"
  else
    p1key="$(engine_key "$main" phase-1)"; stamp="$(engine_stamp "$engine_root/gsl")"
    echo "engine: phase-1 key $p1key, shared engine stamp ${stamp:-none}"
    [[ "$stamp" == "$p1key" ]] || echo "engine rebuild (shared engine lacks phase-1; before the worker starts): engine/giac/build-wasm.sh under tools/devlock.sh acquire host-cpu -> $engine_root/key-$p1key, then $engine_root/gsl"
    bkey="$p1key"; git show-ref --verify --quiet "refs/heads/$branch" && bkey="$(engine_key "$main" "$branch")"
    if [[ "$bkey" != "$p1key" ]]; then
      echo "engine build: key $bkey (branch $branch changes the engine inputs): engine/giac/build-wasm.sh under tools/devlock.sh acquire host-cpu -> $engine_root/key-$bkey"
      echo "GIAC_OUT=$engine_root/key-$bkey (worker, fix rounds and checks)"
    else
      echo "GIAC_OUT=$engine_root/gsl (shared engine; the branch keeps the engine inputs; a build follows the worker when its key changes)"
    fi
  fi
  echo "checks: $checks; merge: $merge; audit model: $audit_model; no-worker: $nowork"
  echo "checks run: typecheck, vitest, docs always; size when app/ changed; e2e when app/ changed; golden when engine or parser changed"
  echo "checks: typecheck,vitest,docs (+ size, e2e when app/ changed; + golden when engine or parser changed)"
  [[ "$audit_model" == auto || "$audit_model" == opus ]] || { [[ "$agent" == gorge ]] && echo "audit model raised to opus: gorge package (--audit-model $audit_model is a floor)"; }
  echo "audit model: $audit_model$([[ "$audit_model" == auto ]] && { [[ "$model" == opus ]] && echo " (opus: --model opus; else opus when the diff touches app/src/input/, app/src/engine/, app/src/units/, engine/ or spec/keyboard.yaml, else sonnet)" || echo " (opus when the diff touches app/src/input/, app/src/engine/, app/src/units/, engine/ or spec/keyboard.yaml, else sonnet)"; })"
  echo "--- bundle ($bundle, $(wc -l < "$bundle") lines) ---"; cat "$bundle"
  echo "--- commands ---"
  echo "git worktree add $wt -b $branch phase-1   (or: git worktree add $wt $branch, when the branch exists)"
  if [[ $nowork -eq 1 ]]; then
    echo "(--no-worker: no worker; git -C $wt merge phase-1 first, a conflict is a fix round for $agent)"
  else
    echo "cat $bundle | claude -p --agent $agent --model $model --effort $effort ${claude_common[*]} ${worker_tools[*]} -n pl-$n-$agent \"<worker prompt>\""
  fi
  echo "checks in $wt/app: typecheck; npm run index && FIND_INDEX=required npm test; e2e when app/ changed; golden when engine or parser changed"
  echo "git -C $wt diff -U5 phase-1...<audited sha> | claude -p --agent sofia --model ${audit_model/auto/<auto: opus for --model opus or app/src/input/, app/src/engine/, engine/, spec/keyboard.yaml; else sonnet>} ${audit_tools[*]} \"AUDIT ...\""
  echo "audited=\$(git -C $wt rev-parse HEAD) at each audit; the merge takes that sha, or stops with NOT MERGED (the branch is not the audited HEAD) when $branch is not at it"
  echo "git -C $integ merge --no-ff --signoff <audited sha>; git worktree remove $wt; git branch -d $branch   (under: tools/devlock.sh acquire integ pipeline-$n 600)"
  echo "environment for the worker, the fix rounds and the checks: PASCALINE_QALC_DL_DIR, PASCALINE_DL_DIR, PW_PORT=$PW_PORT"
  rm -rf "$run"; echo "RESULT #$n $id: DRY RUN (nothing started)"; exit 0
fi

if [[ $nowork -eq 1 ]]; then git show-ref --verify --quiet "refs/heads/$branch" || die "--no-worker: branch $branch does not exist"; fi
echo "$n" > "$counter"; runno="$n"
log "pipeline #$n $id ($agent, $model) on $branch: started; bundle $bundle"
runlog "start $id $agent $model $branch"

# A28: no run checks against an engine that phase-1 lacks.
engine_log="$run/engine-build.log"
if [[ $engine_managed -eq 1 ]]; then
  p1key="$(engine_key "$main" phase-1)"
  if [[ "$(engine_stamp "$engine_root/gsl")" != "$p1key" ]]; then
    log "pipeline #$n $id: shared engine is not phase-1's ($p1key); rebuilding first"
    t0=$SECONDS
    why="$(engine_build "$integ" "$p1key" "$engine_root" "$engine_log")" && engine_promote "$engine_root" "$p1key" || die "engine build: ${why:-promote failed}"
    log "pipeline #$n $id: shared engine rebuilt: key $p1key, giac.wasm sha256 $(engine_sha "$engine_root/gsl") ($((SECONDS - t0)) s)"
  fi
fi

# The worker's worktree, fresh from phase-1 or resumed from the branch's last commit.
if git show-ref --verify --quiet "refs/heads/$branch"; then
  existing="$(git worktree list --porcelain | awk -v b="refs/heads/$branch" '/^worktree /{w=$2} $0=="branch "b{print w}')"
  if [[ -n "$existing" ]]; then wt="$existing"; else git worktree add "$wt" "$branch" >/dev/null; fi
  runlog "resume $branch in $wt"
else
  git worktree add "$wt" -b "$branch" phase-1 >/dev/null
fi
setup_node_modules "$wt"

# A28: GIAC_OUT for the worker, the fix rounds and the checks: the shared engine, or the build of the branch's own key.
select_engine() {
  [[ $engine_managed -eq 1 ]] || return 0
  local k t0=$SECONDS why; k="$(engine_key "$wt" HEAD)"
  if [[ "$k" == "$p1key" ]]; then export GIAC_OUT="$engine_root/gsl"; return 0; fi
  if [[ "$(engine_stamp "$engine_root/key-$k")" != "$k" ]]; then log "pipeline #$n $id: building the branch's engine, key $k (phase-1: $p1key)"; fi
  why="$(engine_build "$wt" "$k" "$engine_root" "$engine_log")" || die "engine build: $why"
  export GIAC_OUT="$engine_root/key-$k"
  runlog "engine: key $k, GIAC_OUT=$GIAC_OUT ($((SECONDS - t0)) s)"
}
select_engine

# Run one headless agent; exit 75 on a usage limit.
run_agent() {  # <name> <log> <agent> <model> <effort> <stdin file> <prompt> [tool options...]
  local name="$1" out="$2" ag="$3" mdl="$4" eff="$5" input="$6" prompt="$7"; shift 7
  local rc
  set +e
  (cd "$wt" && timeout -k 60 10800 claude -p --agent "$ag" --model "$mdl" --effort "$eff" "${claude_common[@]}" "$@" -n "$name" "$prompt") < "$input" > "$out" 2> "$out.err"
  rc=$?; set -e
  if [[ $rc -ne 0 ]] && grep -qiE 'usage limit|rate limit|429|overloaded' "$out" "$out.err"; then
    log "pipeline #$n $id: LIMIT during $name (claude exit $rc)"; echo "RESULT #$n $id: LIMIT"; exit 75
  fi
  runlog "$name: claude exit $rc; reply: $(tail -n 3 "$out" | tr '\n' ' ' | cut -c1-200)"
  return 0
}

# The deterministic checks; the failing excerpt goes to $run/fail-<round>.txt.
changed() { git -C "$wt" diff --name-only "phase-1...HEAD"; }
want_checks() {
  case "$checks" in
    none) echo "";;
    auto)
      local list="typecheck,vitest"
      changed | grep -q '^app/' && list="$list,e2e,size"
      changed | grep -qE '^(engine/|app/src/engine/|app/src/input/|app/src/units/|app/scripts/unit-case\.ts|tests/golden/|find/|tools/find-index/)' && list="$list,golden"
      list="$list,docs"; red_first_wanted "$spec_file" && list="$list,redfirst"
      echo "$list";;
    *) echo "$checks";;
  esac
}
excerpt() {  # the failing lines of a check log, capped
  grep -nE 'FAIL|Error|error TS|✘|×|✗|AssertionError|Expected|Received|expected|Timed out|not ok|GOLDEN GATE FAILED' -A4 "$1" | head -n 150
  [[ -s "$1" ]] && { echo "--- tail ---"; tail -n 30 "$1"; }
}
# Wall-clock tests: the Find 16 ms/key test, the golden units p95 bar, the solve.spec.ts persistence test, the clipboard
# poll of copy.spec.ts (the patterns are in app/scripts/pipeline-logs.ts). When every failing item of a check is one of
# them the check runs once more; a second failure is a fix round.
TIMING_CHECKS=(vitest e2e golden)
timing_only() {  # <check> <log>
  local c; for c in "${TIMING_CHECKS[@]}"; do [[ "$c" == "$1" ]] && node "$wt/app/scripts/pipeline-logs.ts" timing "$1" "$2" && return 0; done
  return 1
}
rerun_timing() {  # <check> <log>: only the failing files, output appended to the log
  local files; mapfile -t files < <(node "$wt/app/scripts/pipeline-logs.ts" files "$1" "$2")
  case "$1" in
    vitest) (cd "$wt/app" && FORCE_COLOR=0 NO_COLOR=1 FIND_INDEX=required timeout 900 npx vitest run "${files[@]}") >> "$2" 2>&1;;
    e2e)    (cd "$wt/app" && FORCE_COLOR=0 timeout 1800 npx playwright test "${files[@]}") >> "$2" 2>&1;;
    golden) (cd "$wt/app" && timeout 2700 npm run -s golden) >> "$2" 2>&1;;
  esac
}
run_checks() {  # <round>; returns 1 and writes fail-<round>.txt on failure
  local round="$1" list name rc=0 why p1_engine="${PASCALINE_P1_ENGINE:-$GIAC_OUT}"
  [[ $engine_managed -eq 0 ]] || p1_engine="$engine_root/gsl"
  list="$(want_checks)"; [[ -n "$list" ]] || { runlog "checks: none"; return 0; }
  tools/devlock.sh acquire host-cpu "pipeline-$n" 1800 >/dev/null || die "host-cpu lock busy"
  : > "$run/fail-$round.txt"
  for name in ${list//,/ }; do
    local out="$run/check-$round-$name.log"
    case "$name" in
      typecheck) (cd "$wt/app" && timeout 900 npm run -s typecheck) > "$out" 2>&1 || rc=1;;
      vitest)    (cd "$wt/app" && timeout 1800 npm run -s index && FORCE_COLOR=0 NO_COLOR=1 FIND_INDEX=required timeout 1800 npm run -s test) > "$out" 2>&1 || rc=1;;
      e2e)       (cd "$wt/app" && FORCE_COLOR=0 timeout 2700 npm run -s test:e2e) > "$out" 2>&1 || rc=1;;
      golden)    (cd "$wt/app" && timeout 2700 npm run -s golden) > "$out" 2>&1 || rc=1;;
      size)      (cd "$wt/app" && timeout 1800 npm run -s build && timeout 300 npm run -s size) > "$out" 2>&1 || rc=1;;
      docs)      (cd "$wt" && timeout 300 node tools/docs-check.mjs) > "$out" 2>&1 || rc=1;;
      redfirst)  why="$(red_first "$wt" "$spec_file" "${p1_engine}" "$out")" || { rc=1; echo "red-first: $why" >> "$out"; };;
      *) die "unknown check $name";;
    esac
    if [[ $rc -eq 1 && ( "$name" == e2e || "$name" == vitest ) ]] && mm="$(node "$wt/app/scripts/pipeline-logs.ts" mismatch "$name" "$out")"; then
      # the parsed failures differ from the runner's own count: no timing re-run can be trusted; a failure for the fix round
      runlog "check $name: count mismatch: $mm"; echo "count mismatch: $mm" >> "$out"
    elif [[ $rc -eq 1 ]] && timing_only "$name" "$out"; then
      # every failing item is a wall-clock test: run the check once more (not a fix round)
      runlog "check $name: re-run (timing): $(node "$wt/app/scripts/pipeline-logs.ts" files "$name" "$out" | tr '\n' ' ')"
      rc=0; rerun_timing "$name" "$out" || rc=1
      [[ $rc -eq 0 ]] && runlog "check $name: re-run (timing) passed" || runlog "check $name: re-run (timing) failed"
    fi
    if [[ $rc -eq 1 ]]; then
      if machine_failure "$out"; then
        tools/devlock.sh release host-cpu "pipeline-$n" >/dev/null
        mline="$(grep -m1 -E "$MACHINE_RE" "$out" | cut -c1-160)"
        log "pipeline #$n $id: NOT MERGED (machine: $name: $mline); branch $branch kept"
        echo "RESULT #$n $id: NOT MERGED (machine: $name: $mline; worktree $wt kept; see $out)"; exit 1
      fi
      { [[ "$name" != redfirst ]] || echo "checks failed: red-first (every new test passes on phase-1)"; echo "## $name failed (full log: $out)"; excerpt "$out"; echo; } >> "$run/fail-$round.txt"
      runlog "check $name: FAILED"; tools/devlock.sh release host-cpu "pipeline-$n" >/dev/null; return 1
    fi
    runlog "check $name: ok"
  done
  tools/devlock.sh release host-cpu "pipeline-$n" >/dev/null
  return 0
}

# sofia's model: auto = opus for --model opus or a diff in the input, engine client, units, engine or key layout.
# auto is a floor (A15): a gorge package or such a diff is audited by opus even when sonnet is named; the raise is logged.
resolve_audit_model() {
  local why=""
  if [[ "$model" == "opus" ]]; then why="worker model is opus"
  elif [[ "$agent" == "gorge" ]]; then why="gorge package"
  elif changed | grep -qE '^(app/src/input/|app/src/engine/|app/src/units/|engine/|spec/keyboard\.yaml)'; then why="diff touches input, engine, units or the key layout"
  fi
  if [[ "$audit_model" == "opus" ]]; then echo opus
  elif [[ -n "$why" ]]; then
    [[ "$audit_model" == "auto" ]] || { log "pipeline #$n $id: audit model raised to opus: $why (line said $audit_model)"; runlog "audit model raised to opus: $why"; }
    echo opus
  else echo sonnet; fi
}

# Round 0: the worker (or, with --no-worker, the merge of phase-1 into the branch).
rounds=0
if [[ $nowork -eq 0 ]]; then
  run_agent "pl-$n-$agent" "$run/worker-0.log" "$agent" "$model" "$effort" "$bundle" "$worker_prompt" "${worker_tools[@]}"
  log "pipeline #$n $id: worker done, $(git -C "$wt" log -1 --format=%h) — $(tail -n 1 "$run/worker-0.log" | cut -c1-120)"
else
  # Review-only: bring phase-1 into the branch first; a conflict is a fix round for the agent.
  log "pipeline #$n $id: review-only (--no-worker); merging phase-1 into $branch"
  if ! git -C "$wt" merge --no-edit --signoff phase-1 > "$run/premerge.log" 2>&1; then
    conflicts="$(git -C "$wt" diff --name-only --diff-filter=U)"
    if [[ -z "$conflicts" ]]; then
      git -C "$wt" merge --abort >/dev/null 2>&1 || true
      die "merge of phase-1 into $branch failed without conflicts: $(tail -n 1 "$run/premerge.log")"
    fi
    { echo "## merging phase-1 into $branch conflicts in:"; echo "$conflicts"; echo
      while IFS= read -r f; do echo "### $f"; grep -nE '^(<<<<<<<|=======|>>>>>>>)' "$wt/$f" | head -n 40; done <<<"$conflicts"; } > "$run/fail-1.txt"
    rounds=1
    run_agent "fix-$n-1" "$run/fix-1.log" "$agent" "$model" "$effort" "$run/fail-1.txt" "You are $agent on branch $branch in your own worktree, a merge of phase-1 is in progress with conflicts (files and conflict markers on stdin) for package $id. Resolve every conflict keeping both sides' intent, git add the files and finish the merge with git commit -s (and your model's trailer). Run the typecheck. Reply in at most three lines." "${worker_tools[@]}"
    if git -C "$wt" rev-parse -q --verify MERGE_HEAD >/dev/null || [[ -n "$(git -C "$wt" diff --name-only --diff-filter=U)" ]]; then
      git -C "$wt" merge --abort >/dev/null 2>&1 || true
      die "conflicts merging phase-1 into $branch not resolved (files: $(tr '\n' ' ' <<<"$conflicts"); worktree $wt kept)"
    fi
    log "pipeline #$n $id: conflicts with phase-1 resolved by $agent"
  fi
fi
if [[ -z "$(git -C "$wt" log --oneline "phase-1..HEAD")" ]]; then
  log "pipeline #$n $id: NOT MERGED (no commits on $branch)"; echo "RESULT #$n $id: NOT MERGED (no commits; worktree $wt kept)"; exit 1
fi

# Fix rounds: the checks and the audit share at most two rounds.
verdict=""; audited=""
while :; do
  select_engine
  if ! run_checks "$rounds"; then
    log "pipeline #$n $id: checks failed (round $rounds): $(head -n 1 "$run/fail-$rounds.txt")"
    reason="the checks failed"; feedback="$run/fail-$rounds.txt"
  else
    log "pipeline #$n $id: checks passed (round $rounds)"
    # the commit this audit reads; only that sha is merged (A17)
    audited="$(git -C "$wt" rev-parse HEAD)"; runlog "audit $rounds reads $audited"
    git -C "$wt" diff -U5 "phase-1...$audited" > "$run/audit-$rounds.diff"
    { cat "$run/criteria.md"; echo; echo "## Diff (git diff -U5 phase-1...$audited, the HEAD of $branch, $(wc -l < "$run/audit-$rounds.diff") lines)"; cat "$run/audit-$rounds.diff"; } > "$run/audit-$rounds.in"
    audit_prompt="AUDIT pipeline run $n, package $id, branch $branch. On stdin: the acceptance criteria, then the diff against phase-1 (the deterministic checks passed). Judge the diff against the criteria and docs/rules-core.md only; read other files only to check a claim in the diff. Look for: a criterion not met; expected values without a trustworthy source; a new parser token without its round-trip case; a fixed bug without a regression test; files outside the task's scope; keys that move; missing SPDX lines; a dependency missing from THIRD_PARTY.md. Reply with the single word APPROVED on the first line, or FIX on the first line followed by at most five findings, each with file:line, the concrete failure and the fix. Nothing else."
    run_agent "audit-$n-$rounds" "$run/audit-$rounds.log" sofia "$(resolve_audit_model)" medium "$run/audit-$rounds.in" "$audit_prompt" "${audit_tools[@]}"
    verdict="$(grep -m1 -oE '^(APPROVED|FIX)' "$run/audit-$rounds.log" || true)"
    if [[ "$verdict" == "APPROVED" ]]; then log "pipeline #$n $id: audit APPROVED (round $rounds)"; break; fi
    log "pipeline #$n $id: audit ${verdict:-unclear} (round $rounds): $(grep -vE '^(FIX|APPROVED)?$' "$run/audit-$rounds.log" | head -n 1 | cut -c1-120)"
    reason="the audit asked for fixes"; feedback="$run/audit-$rounds.log"
  fi
  if [[ $rounds -ge 2 ]]; then
    log "pipeline #$n $id: NOT MERGED after two fix rounds; branch $branch kept at $(git -C "$wt" log -1 --format=%h)"
    echo "RESULT #$n $id: NOT MERGED ($reason twice; branch $branch, worktree $wt kept; see $run)"; exit 1
  fi
  rounds=$((rounds + 1))
  { echo "# Fix round $rounds for pipeline run $n ($id): $reason"; echo; cat "$feedback"; echo; echo "# The task bundle"; cat "$bundle"; } > "$run/fix-$rounds.in"
  fix_prompt="You are $agent on branch $branch in your own worktree, fix round $rounds of 2 for package $id: $reason. On stdin: the failing output or the audit findings, then the task bundle. Fix the cause (not the test), add the regression test where one is missing, run the failing check yourself, commit with git commit -s and your model's trailer, and amend nothing. $no_wait Reply in at most five lines: last commit, what you fixed, anything you could not fix."
  run_agent "fix-$n-$rounds" "$run/fix-$rounds.log" "$agent" "$model" "$effort" "$run/fix-$rounds.in" "$fix_prompt" "${worker_tools[@]}"
  log "pipeline #$n $id: fix round $rounds done, $(git -C "$wt" log -1 --format=%h)"
done

# Merge into phase-1 in its worktree; on a conflict keep the branch.
# Only the audited commit is merged, and only when the branch points at it (A17).
if ! why="$(audited_head_check "$wt" "$branch" "$audited")"; then
  log "pipeline #$n $id: NOT MERGED (the branch is not the audited HEAD): $why; branch $branch kept"
  echo "RESULT #$n $id: NOT MERGED (the branch is not the audited HEAD; $why; worktree $wt kept)"; exit 1
fi
if [[ $merge -eq 0 ]]; then
  echo "RESULT #$n $id: APPROVED, not merged (--no-merge); merge: git -C $integ merge --no-ff --signoff $audited"; exit 0
fi
tools/devlock.sh acquire integ "pipeline-$n" 600 >/dev/null || die "integ lock busy; approved branch $branch kept at ${audited:0:9}"
if ! why="$(audited_head_check "$wt" "$branch" "$audited")"; then  # again under the lock
  tools/devlock.sh release integ "pipeline-$n" >/dev/null || true
  log "pipeline #$n $id: NOT MERGED (the branch is not the audited HEAD): $why; branch $branch kept"
  echo "RESULT #$n $id: NOT MERGED (the branch is not the audited HEAD; $why; worktree $wt kept)"; exit 1
fi
if ! integ_clean "$integ"; then  # ensure_integ checked only at the start (A24)
  tools/devlock.sh release integ "pipeline-$n" >/dev/null || true
  log "pipeline #$n $id: NOT MERGED (phase-1 worktree not clean); branch $branch kept"
  echo "RESULT #$n $id: NOT MERGED (phase-1 worktree not clean; branch $branch, worktree $wt kept)"; exit 1
fi
merge_key_before="$(engine_key "$main" phase-1)"
if git -C "$integ" merge --no-ff --signoff -m "Merge $branch: $id (pipeline run $n)" "$audited" > "$run/merge.log" 2>&1; then
  mc="$(git -C "$integ" rev-parse --short HEAD)"
  git worktree remove --force "$wt" >/dev/null 2>&1 || true
  git -C "$integ" branch -d "$branch" >/dev/null 2>&1 || true
  log "pipeline #$n $id: MERGED $mc (audited ${audited:0:9})"
  result="RESULT #$n $id: MERGED $mc"
  rc=0
else
  why="$(merge_failure_reason "$integ" "$run/merge.log")"
  git -C "$integ" merge --abort >/dev/null 2>&1 || true
  [[ "$why" == conflict ]] && why="merge conflict"
  log "pipeline #$n $id: NOT MERGED ($why); branch $branch kept"
  result="RESULT #$n $id: NOT MERGED ($why; branch $branch, worktree $wt kept)"
  rc=1
fi
tools/devlock.sh release integ "pipeline-$n" >/dev/null || true
# A28: a merge that changed the engine's key moves the shared engine to that build (old one kept as gsl.prev).
if [[ $rc -eq 0 && $engine_managed -eq 1 ]]; then
  mkey="$(engine_key "$main" phase-1)"
  if [[ "$mkey" != "$merge_key_before" ]]; then
    if [[ "$(engine_key "$integ" HEAD)" == "$mkey" ]] && why="$(engine_build "$integ" "$mkey" "$engine_root" "$engine_log")" && engine_promote "$engine_root" "$mkey"; then
      log "pipeline #$n $id: shared engine is now key $mkey, giac.wasm sha256 $(sha256sum "$engine_root/gsl/giac.wasm" | cut -d' ' -f1) (old kept as gsl.prev)"
    else
      log "pipeline #$n $id: engine promotion FAILED for key $mkey (${why:-promote failed}); the next start rebuilds it"
    fi
  fi
fi
# Garbage collection every 3rd finished task.
if (( n % 3 == 0 )); then "$integ/scripts/gc.sh" --apply >> "$run/run.log" 2>&1 || log "pipeline #$n: gc failed (see $run/run.log)"; fi
echo "$result"; exit $rc
