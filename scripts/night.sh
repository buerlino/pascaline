#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# scripts/night.sh: the night shift's driver (docs/shifts/brief.md section 0c). It keeps the laptop
# awake and loops: a fresh, tiny henri session (Read-only, Sonnet) reads section 0c and the log's
# tail and replies with the next command; this script runs it (scripts/pipeline.sh only), then asks
# again. No session lives longer than one decision, so no context grows and nothing compacts.
#
#   scripts/night.sh [--max-steps N] [--limit-wait SECONDS]   (defaults 40 and 1800)
#
# Stops on SHIFT DONE, on N steps, after 6 usage-limit waits, or when henri answers twice with
# something that is not a pipeline command. Output: .coord/log.md (the state) and .tasks/night-<date>.log.
set -euo pipefail
max_steps=40; limit_wait=1800
while [[ $# -gt 0 ]]; do case "$1" in --max-steps) max_steps="$2"; shift 2;; --limit-wait) limit_wait="$2"; shift 2;; *) echo "usage: scripts/night.sh [--max-steps N] [--limit-wait S]" >&2; exit 2;; esac; done
self="$(readlink -f "$0")"
main="$(cd "$(git rev-parse --git-common-dir)/.." && pwd)"; cd "$main"
coord="${PASCALINE_COORD:-$main/.coord}"; tasks="$main/.tasks"; mkdir -p "$tasks" "$coord"
if [[ -z "${PASCALINE_NIGHT_INHIBITED:-}" ]] && command -v systemd-inhibit >/dev/null; then
  PASCALINE_NIGHT_INHIBITED=1 exec systemd-inhibit --what=sleep:idle:handle-lid-switch --why="Pascaline night shift" "$self" --max-steps "$max_steps" --limit-wait "$limit_wait"
fi
integ="$(git worktree list --porcelain | awk '/^worktree /{w=$2} /^branch refs\/heads\/phase-1$/{print w}')"
[[ -n "$integ" ]] || { integ="$main/.claude/worktrees/phase-1"; git worktree add "$integ" phase-1 >/dev/null; }
out="$tasks/night-$(date +%F).log"
log() { [[ ! -s "$coord/log.md" || -z "$(tail -c1 "$coord/log.md")" ]] || echo >> "$coord/log.md"; printf -- '- %s %s\n' "$(date +%H:%M)" "$*" >> "$coord/log.md"; }
say() { printf '%s %s\n' "$(date +%H:%M)" "$*" | tee -a "$out"; }
grep -q "^## $(date +%F) night" "$coord/log.md" 2>/dev/null || printf '\n## %s night\n' "$(date +%F)" >> "$coord/log.md"
log "night.sh started (max $max_steps steps)"
export CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0
steps=0; limits=0; bad=0; declare -A norsl=()
henri_prompt='You are henri, the night coordinator. Read docs/shifts/brief.md section 0c (the rules, the queue table and the Opus pass) and the tail of .coord/log.md on stdin. Reply with exactly one line and nothing else: the next command to run, one of
  scripts/pipeline.sh <agent> "<ID>" --model <sonnet|opus> --audit-model sonnet   (the next queue step not done; skip steps the table or the log marks merged or skipped)
  scripts/pipeline.sh <agent> "<FIX prompt, verbatim>" --id <IDf1> --branch <branch> --model <m> --audit-model sonnet   (a FIX line of the last Opus pass, one per call, in order)
  scripts/pipeline.sh pass <n> "<IDs with merge commits or unmerged branches>" "<open questions or none>"   (after every 3 finished packages since the last pass, and at the end)
  scripts/pipeline.sh report                                                     (after the last pass and its FIX packages)
  SHIFT DONE                                                                     (after the report)
A RESULT line in the log means that step is finished (MERGED, NOT MERGED or SKIPPED); never repeat a finished step. Follow the last Opus pass QUEUE line. Decide nothing else.'
while (( steps < max_steps )); do
  n=$((steps + 1))
  # shellcheck disable=SC2016
  cmd="$(tail -n 80 "$coord/log.md" | (cd "$integ" && timeout 600 claude -p --agent henri --model sonnet --effort medium --permission-mode auto --output-format text --no-session-persistence --allowedTools Read,Grep --disallowedTools Bash,Edit,Write,Agent,NotebookEdit -n "henri-$n" "$henri_prompt") 2>>"$out" | grep -vE '^\s*$' | tail -n 1 | sed 's/^[` ]*//; s/[` ]*$//')" || cmd="(henri failed)"
  say "henri #$n: $cmd"; log "henri #$n: $cmd"
  case "$cmd" in
    "SHIFT DONE") log "SHIFT DONE (night.sh)"; say "done"; exit 0;;
    scripts/pipeline.sh\ *)
      bare="$(sed -E 's/"[^"$`]*"//g' <<<"$cmd")"   # text inside plain double quotes may hold ; & | < > (no expansion there)
      if [[ "$bare" =~ [\;\&\|\`\$\<\>] || "$cmd" == *[\`\$]* ]]; then bad=$((bad + 1)); log "night.sh: refused command with shell metacharacters"; (( bad >= 2 )) && exit 1; steps=$((steps + 1)); continue; fi
      bad=0; set +e
      # henri's package commands always audit with sonnet (brief 0c); pass and report take no such option
      [[ "$cmd" == scripts/pipeline.sh\ pass\ * || "$cmd" == "scripts/pipeline.sh report" || "$cmd" == *--audit-model* ]] || cmd="$cmd --audit-model sonnet"
      cmdout="$(mktemp)"
      (cd "$integ" && eval "timeout 14400 $cmd") > "$cmdout" 2>&1; rc=$?
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
        limits=$((limits + 1)); (( limits > 6 )) && { log "STOPPED night.sh: usage limit 6 times"; exit 1; }
        log "night.sh: usage limit, waiting $limit_wait s"; sleep "$limit_wait"
      fi;;
    *)
      bad=$((bad + 1)); (( bad >= 2 )) && { log "STOPPED night.sh: henri gave no pipeline command twice"; exit 1; };;
  esac
  steps=$((steps + 1))
done
log "STOPPED night.sh: $max_steps steps"; exit 1
