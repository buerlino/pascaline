#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# scripts/night.sh: the night shift's driver (docs/shifts/brief.md section 0c). It keeps the laptop
# awake and loops: a fresh, tiny henri session (Read-only, Sonnet) reads section 0c and the log's
# tail and replies with the next command; this script runs it (scripts/pipeline.sh only), then asks
# again. No session lives longer than one decision, so no context grows and nothing compacts.
#
#   scripts/night.sh [--lane A|B] [--until HH:MM] [--max-steps N] [--limit-wait SECONDS] [--dry-run [--dry-step MIN]]
#                                                       (defaults: no lane, no --until, 40 steps, 1800 s)
#   scripts/night.sh --stop A|B|all                     (the owner's stop: logs `STOPPED night.sh (lane A): by the owner`)
#
# Lanes (A47c): --lane A|B exports PASCALINE_LANE, so every log line of the lane (night.sh's and the pipeline's) starts with [A]
# or [B] after its time; henri runs the table "### Lane X queue" and reads the last 80 lines of his lane plus the other lane's
# MERGED, NOT MERGED and SKIPPED lines since the newest night header (henri_input). Without --lane: one queue, "The queue", as before.
# The guard: one night.sh per lane, a pid file each (.coord/night-A.pid, night-B.pid; night-all.pid without --lane), checked with
# kill -0 and the command line; a lane refuses to start while it or a night without lanes runs, a night without lanes while any
# runs (exit 3, logged); a stale pid file is replaced and logged. The first of two lanes writes the night header, the second none.
# --stop writes the STOPPED line and a stop file (.coord/night-<lane>.stop), read before each step: the lane ends after its running
# step and never kills a running pipeline.
# The end (A17): from --until (the next HH:MM after the start, so 07:30 started at 23:00 is tomorrow's) or at step
# N - 2, whichever comes first, the night closes with two steps: henri is asked only for the last Opus pass (or
# NO PASS when no package finished since the last one), then night.sh runs `scripts/pipeline.sh report` and stops.
# In lanes, --until is per lane; lane B's closing runs its last pass and no report; lane A's report waits for lane B's
# night.sh to end (at most 5 h, PASCALINE_NIGHT_LANE_WAIT), so the writer reads both lanes' lines.
# After every pass night.sh runs `scripts/pipeline.sh device <p>` with p from the pass's RESULT line (A47a may move it).
# A usage limit inside the closing steps waits and retries the same step.
# --dry-run starts no henri and runs nothing: it prints each step's kind on a simulated clock (PASCALINE_NIGHT_NOW=HH:MM,
# default now, advanced --dry-step minutes per step, default 30), the two closing steps, and writes no log.
#
# Stops on SHIFT DONE, after the closing report, after 6 usage-limit waits, or when henri answers twice with
# something that is not a pipeline command. Output: .coord/log.md (the state) and .tasks/night-<date>.log.
set -euo pipefail
orig_args=("$@")
max_steps=40; limit_wait=1800; until_hm=""; dry=0; dry_step=30; lane=""; stop=""
usage() { echo "usage: scripts/night.sh [--lane A|B] [--until HH:MM] [--max-steps N] [--limit-wait S] [--dry-run [--dry-step MIN]] | --stop A|B|all" >&2; exit 2; }
while [[ $# -gt 0 ]]; do case "$1" in
  --max-steps) max_steps="$2"; shift 2;; --limit-wait) limit_wait="$2"; shift 2;; --until) until_hm="$2"; shift 2;;
  --lane) lane="${2:-}"; shift 2;; --stop) stop="${2:-}"; shift 2;;
  --dry-run) dry=1; shift;; --dry-step) dry_step="$2"; shift 2;; *) usage;; esac; done
[[ -z "$lane" || "$lane" =~ ^[AB]$ ]] || { echo "night.sh: --lane takes A or B" >&2; exit 2; }
[[ -z "$stop" || ( "$stop" =~ ^(A|B|all)$ && -z "$lane" && $dry -eq 0 ) ]] || { echo "night.sh: --stop takes A, B or all, and no other option but --until/--max-steps" >&2; exit 2; }
[[ "$max_steps" =~ ^[0-9]+$ && "$max_steps" -ge 2 ]] || { echo "night.sh: --max-steps needs at least 2 (the closing steps)" >&2; exit 2; }
[[ -z "$until_hm" || "$until_hm" =~ ^([01][0-9]|2[0-3]):[0-5][0-9]$ ]] || { echo "night.sh: --until takes HH:MM" >&2; exit 2; }
self="$(readlink -f "$0")"
main="$(cd "$(git rev-parse --git-common-dir)/.." && pwd)"; cd "$main"
coord="${PASCALINE_COORD:-$main/.coord}"; tasks="$main/.tasks"
# shellcheck source=scripts/pipeline-lib.sh
source "$(dirname "$self")/pipeline-lib.sh"
poll="${PASCALINE_NIGHT_POLL:-60}"

# A47c: the lane, its pid file, its stop file
key="${lane:-all}"; other=""; lane_text="${lane:+ (lane $lane)}"
if [[ -n "$lane" ]]; then export PASCALINE_LANE="$lane"; other="$([[ "$lane" == A ]] && echo B || echo A)"; else unset PASCALINE_LANE; fi
tag="$(lane_tag)"; pidf="$coord/night-$key.pid"; stopf="$coord/night-$key.stop"
what() { if [[ "$1" == all ]]; then echo "a night without lanes"; else echo "lane $1"; fi; }
night_alive() {  # <A|B|all>: prints the pid of a running night.sh of that lane (kill -0 and its command line), else fails
  local p; p="$(cat "$coord/night-$1.pid" 2>/dev/null || true)"
  [[ "$p" =~ ^[0-9]+$ && "$p" != "$$" ]] && kill -0 "$p" 2>/dev/null && tr '\0' ' ' < "/proc/$p/cmdline" 2>/dev/null | grep -q 'night\.sh' && echo "$p"
}
logline() {  # <tag> <text>: one line in .coord/log.md
  mkdir -p "$coord"; [[ ! -s "$coord/log.md" || -z "$(tail -c1 "$coord/log.md")" ]] || echo >> "$coord/log.md"
  printf -- '- %s %s%s\n' "$(date +%H:%M)" "$1" "$2" >> "$coord/log.md"
}
if [[ -n "$stop" ]]; then  # the owner's stop: never kills a running pipeline; percy reads the STOPPED line as the lane's end
  if [[ "$stop" == all ]]; then line="STOPPED night.sh: by the owner"; logline "" "$line"
  else line="STOPPED night.sh (lane $stop): by the owner"; logline "[$stop] " "$line"; fi
  if p="$(night_alive "$stop")"; then : > "$coord/night-$stop.stop"; echo "night.sh: $line; $(what "$stop") (pid $p) ends after its running step"
  else echo "night.sh: $line; $(what "$stop") is not running (the line keeps it from being restarted)"; fi
  exit 0
fi
if [[ $dry -eq 0 && -z "${PASCALINE_NIGHT_INHIBITED:-}" ]] && command -v systemd-inhibit >/dev/null; then
  PASCALINE_NIGHT_INHIBITED=1 exec systemd-inhibit --what=sleep:idle:handle-lid-switch --why="Pascaline night shift" "$self" "${orig_args[@]}"
fi

# The clock: real, or simulated in a dry run.
if [[ $dry -eq 1 ]]; then fake="$(date -d "today ${PASCALINE_NIGHT_NOW:-$(date +%H:%M)}" +%s)"; fi
now() { if [[ $dry -eq 1 ]]; then echo "$fake"; else date +%s; fi; }
hm() { date -d "@$(now)" +%H:%M; }
deadline=""
if [[ -n "$until_hm" ]]; then
  deadline="$(date -d "@$(now)" +%F)"; deadline="$(date -d "$deadline $until_hm" +%s)"
  (( deadline > $(now) )) || deadline=$((deadline + 86400))  # the next HH:MM after the start
fi
until_text="${deadline:+, until $(date -d "@$deadline" '+%F %H:%M')}"

if [[ $dry -eq 1 ]]; then
  out=/dev/null
  log() { :; }
  say() { printf '%s %s\n' "$(hm)" "$*"; }
  say "DRY RUN: night.sh${lane:+ --lane $lane} (max $max_steps steps$until_text); starts no henri, runs nothing, writes no log"
  if [[ -n "$other" ]] && p="$(night_alive "$other")"; then say "header: none (lane $other runs, pid $p: its night header stands)"
  else say "header: ## $(date -d "@$(now)" +%F) night, $(hm)$lane_text"; fi
else
  mkdir -p "$tasks" "$coord"
  # A47c: the guard, under a flock so two starts in the same second do not both pass
  exec {gfd}>>"$coord/night.lock"
  flock -w 60 "$gfd" || { echo "night.sh$lane_text: refused: $coord/night.lock is busy" >&2; exit 3; }
  if [[ -z "$lane" ]]; then rivals=(all A B); else rivals=("$lane" all); fi
  for k in "${rivals[@]}"; do
    if p="$(night_alive "$k")"; then
      msg="night.sh$lane_text: refused: $(what "$k") runs (pid $p, $coord/night-$k.pid)"; logline "$tag" "$msg"; echo "$msg" >&2; exit 3
    fi
  done
  stale="$(cat "$pidf" 2>/dev/null || true)"; echo $$ > "$pidf"
  first=1; if [[ -n "$other" ]] && night_alive "$other" >/dev/null; then first=0; fi
  flock -u "$gfd"; exec {gfd}>&-
  trap '[[ "$(cat "$pidf" 2>/dev/null)" != "$$" ]] || rm -f "$pidf"' EXIT
  integ="$(git worktree list --porcelain | awk '/^worktree /{w=$2} /^branch refs\/heads\/phase-1$/{print w}')"
  [[ -n "$integ" ]] || { integ="$main/.claude/worktrees/phase-1"; git worktree add "$integ" phase-1 >/dev/null; }
  out="$tasks/night-$(date +%F)${lane:+-$lane}.log"
  log() { logline "$tag" "$*"; }
  say() { printf '%s %s\n' "$(date +%H:%M)" "$*" | tee -a "$out"; }
  # every start writes its own header, so a second start on the same date gets its own section (and report); a lane started
  # while the other lane runs writes none: the night is the first lane's
  [[ $first -eq 0 ]] || printf '\n## %s night, %s%s\n' "$(date +%F)" "$(date +%H:%M)" "$lane_text" >> "$coord/log.md"
  [[ -z "$stale" ]] || log "night.sh: stale pid file night-$key.pid (pid $stale, not running) replaced"
  [[ ! -f "$stopf" ]] || { rm -f "$stopf"; log "night.sh: an old stop file night-$key.stop removed at the start"; }
fi
log "night.sh started (${lane:+lane $lane, }max $max_steps steps$until_text)"
export CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0
dry_rc=0; steps=0; limits=0; bad=0; closing=0; declare -A norsl=()
henri_prompt='You are henri, the night coordinator. Read docs/shifts/brief.md section 0c (the rules, the queue table and the Opus pass) and the tail of .coord/log.md on stdin. Reply with exactly one line and nothing else: the next command to run, one of
  scripts/pipeline.sh <agent> "<ID>" --model <sonnet|opus> --audit-model auto   (the next queue step not done; skip steps the table or the log marks merged or skipped)
  scripts/pipeline.sh <agent> "<FIX prompt, verbatim>" --id <IDf1> --branch <branch> --model <m> --audit-model auto   (a FIX line of the last Opus pass, one per call, in order)
  scripts/pipeline.sh pass <n> "<IDs with merge commits or unmerged branches>" "<open questions or none>"   (after every 3 finished packages since the last pass, and at the end)
  scripts/pipeline.sh report                                                     (after the last pass, its device step and its FIX packages)
  SHIFT DONE                                                                     (after the report)
A step whose log line says MERGED, NOT MERGED or SKIPPED (the pipeline line, or the RESULT line night.sh writes) is finished; never repeat a finished step. Follow the last Opus pass QUEUE line. Decide nothing else. In a FIX prompt use no backtick and no dollar sign (the command is refused with them).'
closing_prompt='You are henri, the night coordinator. The night is closing (night.sh --until or its step cap): only the last Opus pass is left, and night.sh runs the report after it. Read docs/shifts/brief.md section 0c (the Opus pass) and the tail of .coord/log.md on stdin. Reply with exactly one line and nothing else, one of
  scripts/pipeline.sh pass <n> "<IDs with merge commits or unmerged branches since the last Opus pass>" "<open questions or none>"   (n: the last pass number plus 1)
  NO PASS   (no package finished since the last Opus pass)
Start no queue step and no FIX package. Use no backtick and no dollar sign.'
if [[ -n "$lane" ]]; then  # A47c: henri's lane
  lane_prompt="In this night you run lane $lane: your table is \`### Lane $lane queue\` in section 0c (not \"The queue\" and not lane $other's table). The log on stdin holds your lane's lines (marked [$lane] after the time), lines without a mark, and lane $other's finished steps since the night started (marked [$other]), which an After of yours may name. Count the three packages for an Opus pass, and the IDs of a pass, in your lane only; never run a lane $other step or one of its FIX lines."
  if [[ "$lane" == B ]]; then lane_prompt+=" Lane B never runs the report: after your last pass, its device step and its FIX packages, answer SHIFT DONE (lane A's night.sh writes the report)."
  else lane_prompt+=" Before the report, night.sh waits for lane B to end."; fi
  henri_prompt+=$'\n'"$lane_prompt"
  closing_prompt="${closing_prompt/and night.sh runs the report after it/and $([[ "$lane" == A ]] && echo "night.sh runs the report after it" || echo "lane A's night.sh writes the report")}"$'\n'"$lane_prompt"
fi

ask_henri() {  # <n> <prompt>: henri's one-line reply
  if [[ $dry -eq 1 ]]; then  # stand-in: PASCALINE_NIGHT_REPLIES names a file of replies, one per ask (a line "75: <cmd>" ends with exit 75)
    local f="${PASCALINE_NIGHT_REPLIES:-}"
    if [[ -n "$f" && -f "$f" ]]; then sed -n "${1}p" "$f"; else echo "(dry run: henri not asked)"; fi
    return
  fi
  # shellcheck disable=SC2016
  local r
  r="$(henri_stdin | (cd "$integ" && timeout -k 60 600 claude -p --agent henri --model sonnet --effort medium --permission-mode auto --output-format text --no-session-persistence --allowedTools Read,Grep --disallowedTools Bash,Edit,Write,Agent,NotebookEdit -n "henri-$1" "$2") 2>>"$out" | grep -vE '^\s*$' | tail -n 1 | sed 's/^[` ]*//; s/[` ]*$//')" || r="(henri failed)"
  echo "$r"
}
henri_stdin() {  # A47c: in a lane, henri_input (pipeline-lib.sh); else the log's last 80 lines
  if [[ -n "$lane" ]]; then henri_input "$coord/log.md" "$lane"; else tail -n 80 "$coord/log.md"; fi
}
unsafe() {  # <cmd>: shell metacharacters outside plain double quotes, or a backtick or $ anywhere
  local bare; bare="$(sed -E 's/"[^"$`]*"//g' <<<"$1")"   # text inside plain double quotes may hold ; & | < > (no expansion there)
  [[ "$bare" =~ [\;\&\|\`\$\<\>] || "$1" == *[\`\$]* ]]
}
run_cmd() {  # <cmd>: run one pipeline line; returns its exit code (75: usage limit, after the wait)
  local cmd="$1" cmdout rc
  result_line=""
  if [[ $dry -eq 1 ]]; then
    say "run: $cmd"; [[ ! "$cmd" =~ ^scripts/pipeline\.sh\ pass\ ([0-9]+) ]] || result_line="RESULT pass ${BASH_REMATCH[1]}: DRY RUN"
    local r=$dry_rc; dry_rc=0; return "$r"
  fi
  set +e; cmdout="$(mktemp)"
  (cd "$integ" && eval "timeout -k 60 14400 $cmd") > "$cmdout" 2>&1; rc=$?
  set -e
  cat "$cmdout" >> "$out"
  say "rc=$rc: $(tail -n 1 "$cmdout")"
  result_line="$(grep '^RESULT ' "$cmdout" | tail -n 1 || true)"
  if [[ $rc -ne 75 && -z "$result_line" ]]; then
    # no RESULT line: the step counts as NOT MERGED; the same command twice is SKIPPED (brief 0c rule 8)
    norsl["$cmd"]=$(( ${norsl["$cmd"]:-0} + 1 ))
    if (( ${norsl["$cmd"]} >= 2 )); then log "RESULT -: SKIPPED ($cmd: no RESULT line twice); do not repeat it"
    else log "RESULT -: NOT MERGED ($cmd: no RESULT line, rc=$rc)"; fi
  fi
  rm -f "$cmdout"
  if [[ $rc -eq 75 ]]; then
    limits=$((limits + 1)); (( limits > 6 )) && { log "STOPPED night.sh$lane_text: usage limit 6 times"; say "STOPPED night.sh$lane_text: usage limit 6 times"; exit 1; }
    log "night.sh: usage limit, waiting $limit_wait s"; pause "$limit_wait"
  fi
  return $rc
}
tick() { steps=$((steps + 1)); [[ $dry -eq 0 ]] || fake=$((fake + dry_step * 60)); }
check_stop() {  # A47c: the owner's --stop, read before each step and in every wait
  [[ $dry -eq 0 && -f "$stopf" ]] || return 0
  rm -f "$stopf"; log "night.sh$lane_text: ended by the owner's stop after $steps steps"; say "stopped by the owner (--stop $key)"; exit 0
}
pause() { local end=$((SECONDS + $1)); while (( SECONDS < end )); do check_stop; sleep "$(( end - SECONDS < poll ? end - SECONDS : poll ))"; done; }
pass_device() {  # A41, A47c: the device step after a pass, numbered from the pass's RESULT line (A47a may give another number)
  local pn; pn="$(sed -nE 's/^RESULT pass ([0-9]+):.*/\1/p' <<<"$result_line")"
  if [[ -n "$pn" ]]; then run_cmd "scripts/pipeline.sh device $pn" || true
  else log "night.sh: the pass gave no RESULT pass line (${result_line:-none}); no device step"; fi
}
wait_lane() {  # <lane>: lane A's report waits for lane B's night.sh to end (both lanes' lines in the report), at most 5 h
  local l="$1" p t0=$SECONDS cap="${PASCALINE_NIGHT_LANE_WAIT:-18000}"
  if [[ $dry -eq 1 ]]; then say "the report waits for lane $l to end first (night-$l.pid; at most $cap s)"; return 0; fi
  p="$(night_alive "$l")" || return 0
  log "night.sh: waiting for lane $l to end before the report (pid $p)"
  while night_alive "$l" >/dev/null && (( SECONDS - t0 < cap )); do check_stop; sleep "$poll"; done
  if night_alive "$l" >/dev/null; then log "night.sh: lane $l still runs after $((SECONDS - t0)) s: the report now"
  else log "night.sh: lane $l ended after $((SECONDS - t0)) s"; fi
}

while :; do
  check_stop
  n=$((steps + 1))
  if (( closing == 0 )); then
    why=""
    if [[ -n "$deadline" ]] && (( $(now) >= deadline )); then why="--until $until_hm reached"
    elif (( steps >= max_steps - 2 )); then why="step cap $max_steps minus the two closing steps"; fi
    if [[ -n "$why" ]]; then
      then_what="then the report"; [[ "$lane" != B ]] || then_what="no report (lane A's)"
      closing=1; log "night.sh: closing ($why): the last Opus pass, $then_what"; say "closing ($why): the last Opus pass, $then_what"
    fi
  fi

  if (( closing == 1 )); then  # closing step 1: henri's last Opus pass line
    cmd="$(ask_henri "$n" "$closing_prompt")"
    [[ $dry -eq 0 ]] || cmd='scripts/pipeline.sh pass <n> "<IDs since the last pass>" "<open questions or none>"   (henri, closing prompt)'
    say "henri #$n (closing 1 of 2): $cmd"; log "henri #$n (closing 1 of 2): $cmd"
    if [[ $dry -eq 1 ]]; then :
    elif [[ "$cmd" == scripts/pipeline.sh\ pass\ * ]] && ! unsafe "$cmd"; then
      rc=0; run_cmd "$cmd" || rc=$?
      (( rc == 75 )) && continue  # waited: ask again for the same closing step
      pass_device  # A33: the last device step leaves its APK installed for the owner's morning check
    else log "night.sh: no Opus pass line in closing ($cmd); going to the report"; fi
    closing=2; tick; continue
  fi
  if (( closing == 2 )); then  # closing step 2: the report, a fixed line (lane B: none, lane A's closing writes it)
    if [[ "$lane" == B ]]; then
      say "night.sh #$n (closing 2 of 2): no report (lane A's closing writes it)"; log "night.sh #$n (closing 2 of 2): no report (lane A's closing writes it)"
      tick; log "SHIFT DONE (night.sh, lane B, closed after $steps steps)"; say "done"; exit 0
    fi
    cmd="scripts/pipeline.sh report"
    say "night.sh #$n (closing 2 of 2): $cmd"; log "night.sh #$n (closing 2 of 2): $cmd"
    [[ "$lane" != A ]] || wait_lane B
    rc=0; run_cmd "$cmd" || rc=$?
    (( rc == 75 )) && continue
    tick; log "SHIFT DONE (night.sh$lane_text, closed after $steps steps)"; say "done"; exit 0
  fi

  if [[ $dry -eq 1 && -n "$lane" && $steps -eq 0 ]]; then  # A47c: what henri would get, once
    say "henri prompt (lane $lane): $lane_prompt"
    say "henri input (lane $lane's last 80 lines and lane $other's finished steps since the night header; $coord/log.md):"
    [[ ! -f "$coord/log.md" ]] || henri_input "$coord/log.md" "$lane" | sed 's/^/  | /'
  fi
  cmd="$(ask_henri "$n" "$henri_prompt")"
  if [[ $dry -eq 1 && -n "${PASCALINE_NIGHT_REPLIES:-}" ]]; then
    [[ "$cmd" != 75:\ * ]] || { dry_rc=75; cmd="${cmd#75: }"; }
    [[ -n "$cmd" ]] || cmd="SHIFT DONE"
  else [[ $dry -eq 0 ]] || cmd='scripts/pipeline.sh <agent> "<next step>" --model <m> --audit-model auto   (henri)'; fi
  say "henri #$n: $cmd"; log "henri #$n: $cmd"
  if [[ $dry -eq 1 && -z "${PASCALINE_NIGHT_REPLIES:-}" ]]; then tick; continue; fi
  case "$cmd" in
    "SHIFT DONE") log "SHIFT DONE (night.sh$lane_text)"; say "done"; exit 0;;
    scripts/pipeline.sh\ *)
      if unsafe "$cmd"; then bad=$((bad + 1)); log "night.sh: refused command with shell metacharacters"; (( bad >= 2 )) && { log "STOPPED night.sh$lane_text: henri's reply refused twice"; say "STOPPED night.sh$lane_text: henri's reply refused twice"; exit 1; }; tick; continue; fi
      bad=0
      if [[ "$cmd" == "scripts/pipeline.sh report" && "$lane" == B ]]; then log "night.sh: lane B runs no report (lane A's closing writes it); not run"; tick; continue; fi
      [[ "$cmd" != "scripts/pipeline.sh report" || "$lane" != A ]] || wait_lane B
      # henri's package commands audit with auto (brief 0c: the pipeline raises gorge packages and Opus workers); pass and report take no such option
      [[ "$cmd" == scripts/pipeline.sh\ pass\ * || "$cmd" == scripts/pipeline.sh\ device\ * || "$cmd" == "scripts/pipeline.sh report" || "$cmd" == *--audit-model* ]] || cmd="$cmd --audit-model auto"
      rc=0; run_cmd "$cmd" || rc=$?
      # A41: after every Opus pass but a usage limit (75: henri is asked again), the device step with the pass's number
      if [[ "$cmd" == scripts/pipeline.sh\ pass\ * && $rc -ne 75 ]]; then pass_device; fi;;
    *)
      bad=$((bad + 1)); (( bad >= 2 )) && { log "STOPPED night.sh$lane_text: henri gave no pipeline command twice"; say "STOPPED night.sh$lane_text: henri gave no pipeline command twice"; exit 1; };;
  esac
  tick
done
