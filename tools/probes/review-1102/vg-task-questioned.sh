#!/usr/bin/env bash
# vg hunter probe: feeds ordinary worker replies to A55's task_questioned (scripts/pipeline-lib.sh at ff37a93f6).
# Usage: bash vg-task-questioned.sh [checkout]
set -uo pipefail
W="${1:-$(git -C "$(dirname "$0")" rev-parse --show-toplevel)}"
# take only the A55 definitions (TASK_SUBJECT .. task_questioned) out of the lib, so nothing else of it runs
eval "$(sed -n '/^TASK_SUBJECT=/,/^}/p' "$W/scripts/pipeline-lib.sh"; sed -n '/^open_question_lines()/,/^}/p;/^task_questioned()/,/^}/p' "$W/scripts/pipeline-lib.sh")"
t() { local f; f="$(mktemp)"; printf '%s\n' "$@" > "$f"; if task_questioned "$f"; then echo "FIRES  : ${*: -1}"; else echo "silent : ${*: -1}"; fi; rm -f "$f"; }
t "Last commit 1a2b3c4, done." "Open questions: none"
t "Last commit 1a2b3c4, done." "Open questions: the spec block is wrong about the cap (600 s; the code has 1200 s); I followed the code"
t "Last commit 1a2b3c4, done." "Open questions: the package file is missing a test name for c63; I used core-c63"
t "Last commit 1a2b3c4, done." "Open questions: none" "Note: the task text was incomplete on the label wording; I took the brief's"
t "Last commit 1a2b3c4, NOT done." "Open questions: my task block is missing (bundle has no A46 section)"
