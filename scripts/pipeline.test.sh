#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Test for scripts/pipeline.sh (A10): no agent is started, every call is a --dry-run or fails before a run.
# For every file of docs/shifts/packages/ in the phase-1 worktree (first line "### <agent>, <ID>: ... branch `B`"), the dry run
# exits 0 and names B; a made-up ID exits 2 and names the ID; the tarball dir is printed even when unset.
#   scripts/pipeline.test.sh [path/to/pipeline.sh]      (default: the script next to this test)
set -uo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script="${1:-$here/pipeline.sh}"
integ="$(git worktree list --porcelain | awk '/^worktree /{w=$2} /^branch refs\/heads\/phase-1$/{print w}')"
[[ -n "$integ" ]] || { echo "no phase-1 worktree" >&2; exit 1; }
fails=0; count=0
fail() { echo "FAIL: $*" >&2; fails=$((fails + 1)); }
re='^### (ron|gorge|annabell|sandra), ([A-Z][0-9]+[a-z0-9]*):.*branch `([^`]+)`'
while IFS= read -r line; do
  [[ "$line" =~ $re ]] || { fail "heading without agent, ID and branch: $line"; continue; }
  agent="${BASH_REMATCH[1]}"; pid="${BASH_REMATCH[2]}"; br="${BASH_REMATCH[3]}"
  count=$((count + 1))
  out="$("$script" "$agent" "$pid" --dry-run 2>&1)"; rc=$?
  [[ $rc -eq 0 ]] || { fail "$agent $pid: exit $rc: $(tail -n 1 <<<"$out")"; continue; }
  grep -qF "branch $br" <<<"$out" || fail "$agent $pid: dry run does not print branch $br"
done < <(for f in "$integ"/docs/shifts/packages/*.md; do head -n1 "$f"; done | grep -v '^### sofia, ')
ron_pkg="$(basename "$(ls "$integ"/docs/shifts/packages/R*.md | head -n1)" .md)"
[[ $count -gt 0 ]] || fail "no package headings found"

out="$("$script" ron R9999x --dry-run 2>&1)"; rc=$?
[[ $rc -eq 2 ]] || fail "made-up ID: exit $rc, expected 2"
grep -q 'R9999x' <<<"$out" || fail "made-up ID: message does not name it: $out"

out="$(env -u PASCALINE_QALC_DL_DIR "$script" ron "$ron_pkg" --dry-run 2>&1)"
grep -qE 'PASCALINE_QALC_DL_DIR=[^ ]*engine/qalc/_downloads' <<<"$out" || fail "dry run does not print the tarball dir to export"

# A15 point 2: a gorge package is audited by Opus even when the line says sonnet; the raise is printed.
out="$("$script" gorge "$(basename "$(ls "$integ"/docs/shifts/packages/G*.md | head -n1)" .md)" --dry-run --audit-model sonnet 2>&1)"
grep -q 'audit model raised to opus: gorge' <<<"$out" || fail "gorge with --audit-model sonnet: no 'audit model raised to opus' line"
out="$("$script" ron "$ron_pkg" --dry-run --audit-model sonnet 2>&1)"
grep -q 'audit model raised' <<<"$out" && fail "ron with --audit-model sonnet is raised without a reason"
# point 3: the checks the dry run plans
out="$("$script" ron "$ron_pkg" --dry-run 2>&1)"
grep -qE '^checks: .*docs' <<<"$out" || fail "dry run: the docs check is not planned"
grep -qE '^checks: .*size' <<<"$out" || fail "dry run: the size check is not planned"
grep -q 'mismatch' "$here/pipeline.sh" || fail "pipeline.sh does not compare the e2e count with Playwright's summary"
# point 4: no reused dev server
grep -qE 'reuseExistingServer: *false' "$here/../app/playwright.config.ts" || fail "playwright.config.ts reuses an existing server"
# point 3: a stale dist fails with a message
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/dist"; touch -d '2000-01-01' "$tmp/dist/index.html"
out="$(node "$here/../app/scripts/size-check.ts" "$tmp/dist" 2>&1)"; rc=$?
[[ $rc -eq 1 ]] && grep -q 'older than' <<<"$out" || fail "size-check on a stale dist: exit $rc: $out"
# point 5: docs-check counts tracked Markdown only
r="$tmp/repo"; mkdir -p "$r/docs/shifts/packages" "$r/tools"; cp "$here/../tools/docs-check.mjs" "$r/tools/"
git -C "$r" init -q; for f in docs/shifts/brief.md docs/backlog.md docs/decisions.md docs/04-architecture.md; do echo ok > "$r/$f"; done
git -C "$r" add -A; git -C "$r" -c user.name=t -c user.email=t@t commit -qm init
echo '[x](nowhere.md)' > "$r/note.md"
out="$(cd "$r" && node tools/docs-check.mjs 2>&1)"; rc=$?
[[ $rc -eq 0 ]] && grep -q 'warning.*note.md' <<<"$out" || fail "docs-check: untracked broken link: exit $rc: $out"
git -C "$r" add note.md
(cd "$r" && node tools/docs-check.mjs >/dev/null 2>&1) && fail "docs-check: a tracked broken link passes"

# A17 point 1: only the audited commit is merged; a branch left behind a detached HEAD stops the merge
# shellcheck source=scripts/pipeline-lib.sh
source "$here/pipeline-lib.sh"
g="$tmp/heads"; mkdir -p "$g"; git -C "$g" init -q -b main
gc() { git -C "$1" -c user.name=t -c user.email=t@t commit -q --allow-empty -m "$2"; }
gc "$g" base; git -C "$g" branch p1/x; git -C "$g" worktree add -q "$tmp/heads-wt" p1/x
gc "$tmp/heads-wt" on-branch; tip="$(git -C "$tmp/heads-wt" rev-parse HEAD)"
audited_head_check "$tmp/heads-wt" p1/x "$tip" >/dev/null || fail "audited_head_check: the branch at the audited sha is refused"
git -C "$tmp/heads-wt" checkout -q --detach; gc "$tmp/heads-wt" detached
det="$(git -C "$tmp/heads-wt" rev-parse HEAD)"
out="$(audited_head_check "$tmp/heads-wt" p1/x "$det")" && fail "audited_head_check: a detached HEAD the branch is not at passes"
grep -q "p1/x is at ${tip:0:9}, the audit read ${det:0:9}" <<<"$out" || fail "audited_head_check: no reason for the detached HEAD: $out"
audited_head_check "$tmp/heads-wt" p1/x "" >/dev/null && fail "audited_head_check: an empty audited sha passes"
grep -q 'merge --no-ff --signoff -m "[^"]*" "$audited"' "$here/pipeline.sh" || fail "pipeline.sh does not merge the audited sha"
grep -q 'NOT MERGED (the branch is not the audited HEAD' "$here/pipeline.sh" || fail "pipeline.sh has no NOT MERGED (the branch is not the audited HEAD)"
grep -q 'audited="$(git -C "$wt" rev-parse HEAD)"' "$here/pipeline.sh" || fail "pipeline.sh does not record the audited HEAD"
# point 3: a pass reply is logged from its OPUS PASS line on
printf 'Here is my reply.\n\nOPUS PASS 9\nVERDICT ok\n' > "$tmp/reply.md"
[[ "$(from_opus_pass "$tmp/reply.md" | head -n1)" == "OPUS PASS 9" ]] || fail "from_opus_pass keeps the line before OPUS PASS"
printf 'no form\nat all\n' > "$tmp/reply2.md"
[[ "$(from_opus_pass "$tmp/reply2.md")" == $'no form\nat all' ]] || fail "from_opus_pass drops a reply without OPUS PASS"
grep -q 'from_opus_pass "$run/reply.md" | sed' "$here/pipeline.sh" || fail "pipeline.sh logs the pass reply whole"
# point 4: no stray waits in the worker prompt
grep -q 'no_wait="Never start a background loop that waits on a process: pgrep -f' "$here/pipeline.sh" && grep -q '$no_wait Reply in at most five lines: last commit, done' "$here/pipeline.sh" || fail "the worker prompt does not forbid a background wait loop"
# point 2: night.sh closes with the last pass and the report, at --until (across midnight) and at the cap - 2
out="$(PASCALINE_NIGHT_NOW=23:00 "$here/night.sh" --dry-run --until 01:00 2>&1)"; rc=$?
[[ $rc -eq 0 ]] || fail "night.sh --dry-run --until: exit $rc: $out"
grep -q '^01:00 closing (--until 01:00 reached)' <<<"$out" || fail "night.sh --until 01:00 from 23:00 does not close at 01:00: $out"
grep -q '^01:00 henri #5 (closing 1 of 2): scripts/pipeline.sh pass ' <<<"$out" || fail "night.sh --until: no last Opus pass as closing step 1: $out"
grep -q '^01:30 night.sh #6 (closing 2 of 2): scripts/pipeline.sh report$' <<<"$out" || fail "night.sh --until: no report as closing step 2: $out"
[[ "$(grep -c 'henri #' <<<"$out")" -eq 5 ]] || fail "night.sh --until: henri asked a queue step after the deadline: $out"
grep -q 'header: ## [0-9-]* night, 23:00$' <<<"$out" || fail "night.sh: the header has no start time: $out"
out="$(PASCALINE_NIGHT_NOW=22:00 "$here/night.sh" --dry-run --max-steps 5 2>&1)"; rc=$?
[[ $rc -eq 0 ]] || fail "night.sh --dry-run --max-steps 5: exit $rc: $out"
grep -q 'henri #3: ' <<<"$out" && grep -q 'henri #4 (closing 1 of 2): scripts/pipeline.sh pass ' <<<"$out" && grep -q 'night.sh #5 (closing 2 of 2): scripts/pipeline.sh report$' <<<"$out" || fail "night.sh --max-steps 5: no closing at step 4 and 5: $out"
grep -q '#6' <<<"$out" && fail "night.sh --max-steps 5 runs a sixth step: $out"
grep -q 'audit-model sonnet' "$here/night.sh" && fail "night.sh still names --audit-model sonnet (brief 0c says auto)"
grep -q '"^## $(date +%F) night"' "$here/night.sh" && fail "night.sh writes the header only once per date"

# A24: each worktree gets its own node_modules (hard-link copy); a machine failure ends the run; a dirty phase-1 is not a conflict
out="$("$script" ron "$ron_pkg" --dry-run 2>&1)"
grep -q '^setup: .*cp -al' <<<"$out" || fail "A24: the dry run does not show the setup step (cp -al of node_modules)"
grep -q 'ln -s "$main/app/node_modules"' "$here/pipeline.sh" && fail "A24: pipeline.sh still links the shared node_modules"
printf 'sh: 1: svelte-check: command not found\n' > "$tmp/m1.log"; printf 'Error: Cannot find module vitest\nnode_modules missing\n' > "$tmp/m2.log"; printf 'error TS2322: x\n' > "$tmp/m3.log"
machine_failure "$tmp/m1.log" >/dev/null || fail "A24: 'command not found' is not a machine failure"
machine_failure "$tmp/m3.log" >/dev/null && fail "A24: a type error is a machine failure"
grep -q 'NOT MERGED (machine: ' "$here/pipeline.sh" || fail "A24: pipeline.sh has no NOT MERGED (machine: ...)"
grep -q 'NOT MERGED (phase-1 worktree not clean)' "$here/pipeline.sh" || fail "A24: pipeline.sh has no NOT MERGED (phase-1 worktree not clean)"
cl="$tmp/clean"; git init -q -b main "$cl"; gc "$cl" base; echo a > "$cl/f"; git -C "$cl" add f
integ_clean "$cl" && fail "A24: a staged file counts as clean"
gc "$cl" two; integ_clean "$cl" || fail "A24: a clean worktree is refused"
echo b >> "$cl/f"; git -C "$cl" add f; gc "$cl" three; echo c >> "$cl/f"; integ_clean "$cl" && fail "A24: an uncommitted change counts as clean"
git -C "$cl" checkout -q f
git -C "$cl" branch other; git -C "$cl" checkout -q other; echo x > "$cl/g"; git -C "$cl" add g; gc "$cl" og; git -C "$cl" checkout -q main
echo y > "$cl/g"; git -C "$cl" add g; gc "$cl" mg
git -C "$cl" merge other >/dev/null 2>&1; merge_failure_reason "$cl" "$tmp/m1.log" | grep -q '^conflict' || fail "A24: unmerged files are not a conflict"
git -C "$cl" merge --abort >/dev/null 2>&1
merge_failure_reason "$cl" "$tmp/m3.log" | grep -q '^conflict' && fail "A24: a failure without unmerged files is called a conflict"

[[ $fails -eq 0 ]] || { echo "pipeline.test.sh: $fails failure(s) in $count packages" >&2; exit 1; }
echo "pipeline.test.sh: ok ($count packages)"
