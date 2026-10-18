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
done < <(for f in "$integ"/docs/shifts/packages/*.md; do head -n1 "$f"; done)
[[ $count -gt 0 ]] || fail "no package headings found"

out="$("$script" ron R9999x --dry-run 2>&1)"; rc=$?
[[ $rc -eq 2 ]] || fail "made-up ID: exit $rc, expected 2"
grep -q 'R9999x' <<<"$out" || fail "made-up ID: message does not name it: $out"

out="$(env -u PASCALINE_QALC_DL_DIR "$script" ron R15c1 --dry-run 2>&1)"
grep -qE 'PASCALINE_QALC_DL_DIR=[^ ]*engine/qalc/_downloads' <<<"$out" || fail "dry run does not print the tarball dir to export"

# A15 point 2: a gorge package is audited by Opus even when the line says sonnet; the raise is printed.
out="$("$script" gorge "$(basename "$(ls "$integ"/docs/shifts/packages/G*.md | head -n1)" .md)" --dry-run --audit-model sonnet 2>&1)"
grep -q 'audit model raised to opus: gorge' <<<"$out" || fail "gorge with --audit-model sonnet: no 'audit model raised to opus' line"
out="$("$script" ron R15c1 --dry-run --audit-model sonnet 2>&1)"
grep -q 'audit model raised' <<<"$out" && fail "ron with --audit-model sonnet is raised without a reason"
# point 3: the checks the dry run plans
out="$("$script" ron R15c1 --dry-run 2>&1)"
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

[[ $fails -eq 0 ]] || { echo "pipeline.test.sh: $fails failure(s) in $count packages" >&2; exit 1; }
echo "pipeline.test.sh: ok ($count packages)"
