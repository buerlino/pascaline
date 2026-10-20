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
