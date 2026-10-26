#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# scripts/night.sh: the night shift's driver (docs/shifts/brief.md section 0c). It keeps the laptop
# awake and loops: a fresh, tiny henri session (Read-only, Sonnet) reads section 0c and the log's
# tail and replies with the next command; this script runs it (scripts/pipeline.sh only), then asks
# again. No session lives longer than one decision, so no context grows and nothing compacts.
#
#   scripts/night.sh [--until HH:MM] [--max-steps N] [--limit-wait SECONDS] [--dry-run [--dry-step MIN]]
#                                                       (defaults: no --until, 40 steps, 1800 s)
#
# The end (A17): from --until (the next HH:MM after the start, so 07:30 started at 23:00 is tomorrow's) or at step
# N - 2, whichever comes first, the night closes with two steps: henri is asked only for the last Opus pass (or
# NO PASS when no package finished since the last one), then night.sh runs `scripts/pipeline.sh report` and stops.
# A usage limit inside the closing steps waits and retries the same step.
# --dry-run starts no henri and runs nothing: it prints each step's kind on a simulated clock (PASCALINE_NIGHT_NOW=HH:MM,
# default now, advanced --dry-step minutes per step, default 30), the two closing steps, and writes no log.
#
# Stops on SHIFT DONE, after the closing report, after 6 usage-limit waits, or when henri answers twice with
# something that is not a pipeline command. Output: .coord/log.md (the state) and .tasks/night-<date>.log.
set -euo pipefail
orig_args=("$@")
max_steps=40; limit_wait=1800; until_hm=""; dry=0; dry_step=30
usage() { echo "usage: scripts/night.sh [--until HH:MM] [--max-steps N] [--limit-wait S] [--dry-run [--dry-step MIN]]" >&2; exit 2; }
while [[ $# -gt 0 ]]; do case "$1" in
  --max-steps) max_steps="$2"; shift 2;; --limit-wait) limit_wait="$2"; shift 2;; --until) until_hm="$2"; shift 2;;
  --dry-run) dry=1; shift;; --dry-step) dry_step="$2"; shift 2;; *) usage;; esac; done
[[ "$max_steps" =~ ^[0-9]+$ && "$max_steps" -ge 2 ]] || { echo "night.sh: --max-steps needs at least 2 (the closing steps)" >&2; exit 2; }
[[ -z "$until_hm" || "$until_hm" =~ ^([01][0-9]|2[0-3]):[0-5][0-9]$ ]] || { echo "night.sh: --until takes HH:MM" >&2; exit 2; }
self="$(readlink -f "$0")"
main="$(cd "$(git rev-parse --git-common-dir)/.." && pwd)"; cd "$main"
coord="${PASCALINE_COORD:-$main/.coord}"; tasks="$main/.tasks"
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
  say "DRY RUN: night.sh (max $max_steps steps$until_text); starts no henri, runs nothing, writes no log"
  say "header: ## $(date -d "@$(now)" +%F) night, $(hm)"
else
  mkdir -p "$tasks" "$coord"
  integ="$(git worktree list --porcelain | awk '/^worktree /{w=$2} /^branch refs\/heads\/phase-1$/{print w}')"
  [[ -n "$integ" ]] || { integ="$main/.claude/worktrees/phase-1"; git worktree add "$integ" phase-1 >/dev/null; }
  out="$tasks/night-$(date +%F).log"
  log() { [[ ! -s "$coord/log.md" || -z "$(tail -c1 "$coord/log.md")" ]] || echo >> "$coord/log.md"; printf -- '- %s %s\n' "$(date +%H:%M)" "$*" >> "$coord/log.md"; }
  say() { printf '%s %s\n' "$(date +%H:%M)" "$*" | tee -a "$out"; }
  # every start writes its own header, so a second start on the same date gets its own section (and report)
  printf '\n## %s night, %s\n' "$(date +%F)" "$(date +%H:%M)" >> "$coord/log.md"
fi
log "night.sh started (max $max_steps steps$until_text)"
export CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0
dry_rc=0; steps=0; limits=0; bad=0; closing=0; declare -A norsl=()
henri_prompt='You are henri, the night coordinator. Read docs/shifts/brief.md section 0c (the rules, the queue table and the Opus pass) and the tail of .coord/log.md on stdin. Reply with exactly one line and nothing else: the next command to run, one of
  scripts/pipeline.sh <agent> "<ID>" --model <sonnet|opus> --audit-model auto   (the next queue step not done; skip steps the table or the log marks merged or skipped)
  scripts/pipeline.sh <agent> "<FIX prompt, verbatim>" --id <IDf1> --branch <branch> --model <m> --audit-model auto   (a FIX line of the last Opus pass, one per call, in order)
  scripts/pipeline.sh pass <n> "<IDs with merge commits or unmerged branches>" "<open questions or none>"   (after every 3 finished packages since the last pass, and at the end)
  scripts/pipeline.sh report                                                     (after the last pass, its device step and its FIX packages)
  SHIFT DONE                                                                     (after the report)
A RESULT line in the log means that step is finished (MERGED, NOT MERGED or SKIPPED); never repeat a finished step. Follow the last Opus pass QUEUE line. Decide nothing else. In a FIX prompt use no backtick and no dollar sign (the command is refused with them).'
closing_prompt='You are henri, the night coordinator. The night is closing (night.sh --until or its step cap): only the last Opus pass is left, and night.sh runs the report after it. Read docs/shifts/brief.md section 0c (the Opus pass) and the tail of .coord/log.md on stdin. Reply with exactly one line and nothing else, one of
  scripts/pipeline.sh pass <n> "<IDs with merge commits or unmerged branches since the last Opus pass>" "<open questions or none>"   (n: the last pass number plus 1)
  NO PASS   (no package finished since the last Opus pass)
Start no queue step and no FIX package. Use no backtick and no dollar sign.'

ask_henri() {  # <n> <prompt>: henri's one-line reply
  if [[ $dry -eq 1 ]]; then  # stand-in: PASCALINE_NIGHT_REPLIES names a file of replies, one per ask (a line "75: <cmd>" ends with exit 75)
    local f="${PASCALINE_NIGHT_REPLIES:-}"
    if [[ -n "$f" && -f "$f" ]]; then sed -n "${1}p" "$f"; else echo "(dry run: henri not asked)"; fi
    return
  fi
  # shellcheck disable=SC2016
  local r
  r="$(tail -n 80 "$coord/log.md" | (cd "$integ" && timeout -k 60 600 claude -p --agent henri --model sonnet --effort medium --permission-mode auto --output-format text --no-session-persistence --allowedTools Read,Grep --disallowedTools Bash,Edit,Write,Agent,NotebookEdit -n "henri-$1" "$2") 2>>"$out" | grep -vE '^\s*$' | tail -n 1 | sed 's/^[` ]*//; s/[` ]*$//')" || r="(henri failed)"
  echo "$r"
}
unsafe() {  # <cmd>: shell metacharacters outside plain double quotes, or a backtick or $ anywhere
  local bare; bare="$(sed -E 's/"[^"$`]*"//g' <<<"$1")"   # text inside plain double quotes may hold ; & | < > (no expansion there)
  [[ "$bare" =~ [\;\&\|\`\$\<\>] || "$1" == *[\`\$]* ]]
}
run_cmd() {  # <cmd>: run one pipeline line; returns its exit code (75: usage limit, after the wait)
  local cmd="$1" cmdout rc
  if [[ $dry -eq 1 ]]; then say "run: $cmd"; local r=$dry_rc; dry_rc=0; return "$r"; fi
  set +e; cmdout="$(mktemp)"
  (cd "$integ" && eval "timeout -k 60 14400 $cmd") > "$cmdout" 2>&1; rc=$?
  set -e
  cat "$cmdout" >> "$out"
  say "rc=$rc: $(tail -n 1 "$cmdout")"
  if [[ $rc -ne 75 ]] && ! grep -q '^RESULT ' "$cmdout"; then
    # no RESULT line: the step counts as NOT MERGED; the same command twice is SKIPPED (brief 0c rule 8)
    norsl["$cmd"]=$(( ${norsl["$cmd"]:-0} + 1 ))
    if (( ${norsl["$cmd"]} >= 2 )); then log "RESULT -: SKIPPED ($cmd: no RESULT line twice); do not repeat it"
    else log "RESULT -: NOT MERGED ($cmd: no RESULT line, rc=$rc)"; fi
  fi
  rm -f "$cmdout"
  if [[ $rc -eq 75 ]]; then
    limits=$((limits + 1)); (( limits > 6 )) && { log "STOPPED night.sh: usage limit 6 times"; say "STOPPED night.sh: usage limit 6 times"; exit 1; }
    log "night.sh: usage limit, waiting $limit_wait s"; sleep "$limit_wait"
  fi
  return $rc
}
tick() { steps=$((steps + 1)); [[ $dry -eq 0 ]] || fake=$((fake + dry_step * 60)); }

while :; do
  n=$((steps + 1))
  if (( closing == 0 )); then
    why=""
    if [[ -n "$deadline" ]] && (( $(now) >= deadline )); then why="--until $until_hm reached"
    elif (( steps >= max_steps - 2 )); then why="step cap $max_steps minus the two closing steps"; fi
    if [[ -n "$why" ]]; then closing=1; log "night.sh: closing ($why): the last Opus pass, then the report"; say "closing ($why): the last Opus pass, then the report"; fi
  fi

  if (( closing == 1 )); then  # closing step 1: henri's last Opus pass line
    cmd="$(ask_henri "$n" "$closing_prompt")"
    [[ $dry -eq 0 ]] || cmd='scripts/pipeline.sh pass <n> "<IDs since the last pass>" "<open questions or none>"   (henri, closing prompt)'
    say "henri #$n (closing 1 of 2): $cmd"; log "henri #$n (closing 1 of 2): $cmd"
    if [[ $dry -eq 1 ]]; then :
    elif [[ "$cmd" == scripts/pipeline.sh\ pass\ * ]] && ! unsafe "$cmd"; then
      rc=0; run_cmd "$cmd" || rc=$?
      (( rc == 75 )) && continue  # waited: ask again for the same closing step
      # A33: the last device step leaves its APK installed for the owner's morning check
      pn="$(sed -E 's/^scripts\/pipeline\.sh pass ([0-9]+) .*/\1/' <<<"$cmd")"
      [[ "$pn" =~ ^[0-9]+$ ]] && { run_cmd "scripts/pipeline.sh device $pn" || true; }
    else log "night.sh: no Opus pass line in closing ($cmd); going to the report"; fi
    closing=2; tick; continue
  fi
  if (( closing == 2 )); then  # closing step 2: the report, a fixed line
    cmd="scripts/pipeline.sh report"
    say "night.sh #$n (closing 2 of 2): $cmd"; log "night.sh #$n (closing 2 of 2): $cmd"
    rc=0; run_cmd "$cmd" || rc=$?
    (( rc == 75 )) && continue
    tick; log "SHIFT DONE (night.sh, closed after $steps steps)"; say "done"; exit 0
  fi

  cmd="$(ask_henri "$n" "$henri_prompt")"
  if [[ $dry -eq 1 && -n "${PASCALINE_NIGHT_REPLIES:-}" ]]; then
    [[ "$cmd" != 75:\ * ]] || { dry_rc=75; cmd="${cmd#75: }"; }
    [[ -n "$cmd" ]] || cmd="SHIFT DONE"
  else [[ $dry -eq 0 ]] || cmd='scripts/pipeline.sh <agent> "<next step>" --model <m> --audit-model auto   (henri)'; fi
  say "henri #$n: $cmd"; log "henri #$n: $cmd"
  if [[ $dry -eq 1 && -z "${PASCALINE_NIGHT_REPLIES:-}" ]]; then tick; continue; fi
  case "$cmd" in
    "SHIFT DONE") log "SHIFT DONE (night.sh)"; say "done"; exit 0;;
    scripts/pipeline.sh\ *)
      if unsafe "$cmd"; then bad=$((bad + 1)); log "night.sh: refused command with shell metacharacters"; (( bad >= 2 )) && { log "STOPPED night.sh: henri's reply refused twice"; say "STOPPED night.sh: henri's reply refused twice"; exit 1; }; tick; continue; fi
      bad=0
      # henri's package commands audit with auto (brief 0c: the pipeline raises gorge packages and Opus workers); pass and report take no such option
      [[ "$cmd" == scripts/pipeline.sh\ pass\ * || "$cmd" == scripts/pipeline.sh\ device\ * || "$cmd" == "scripts/pipeline.sh report" || "$cmd" == *--audit-model* ]] || cmd="$cmd --audit-model auto"
      rc=0; run_cmd "$cmd" || rc=$?
      # A41: after every Opus pass but a usage limit (75: henri is asked again), the device step with the pass's number
      if [[ "$cmd" == scripts/pipeline.sh\ pass\ * && $rc -ne 75 ]]; then
        pn="$(sed -E 's/^scripts\/pipeline\.sh pass ([0-9]+) .*/\1/' <<<"$cmd")"
        [[ "$pn" =~ ^[0-9]+$ ]] && { run_cmd "scripts/pipeline.sh device $pn" || true; }
      fi;;
    *)
      bad=$((bad + 1)); (( bad >= 2 )) && { log "STOPPED night.sh: henri gave no pipeline command twice"; say "STOPPED night.sh: henri gave no pipeline command twice"; exit 1; };;
  esac
  tick
done
