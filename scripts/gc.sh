#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# scripts/gc.sh: the garbage collection of the pipeline, run by scripts/pipeline.sh after every
# 3rd finished task, or by hand. Without --apply it only lists what it would do.
#
#   scripts/gc.sh [--apply]
#
# 1. Archive: finished pipeline runs (.tasks/NNN-*/ whose branch is gone), .coord/handoff-*.md and
#    other finished notes (*.patch, *-night.md, *.txt) → .tasks/archive/<date>/.
# 2. Delete scratch: .coord/tmpbuild/*, .coord/henri_*.out older than 2 days, the agents' stray
#    *.err logs in archived runs. Nothing tracked by git, nothing in engine/giac/_downloads or spike/prebuilt.
# 3. Audit: every repo path named in CLAUDE.md and docs/README.md must exist; reports in docs/shifts/
#    older than 14 days are listed as candidates. Tracked files are never moved or deleted here: the
#    audit's findings go to .tasks/gc-<date>.md (a dry run: gc-<date>-dry.md) for the owner (or the next Opus pass).
set -euo pipefail
apply=0; [[ "${1:-}" == "--apply" ]] && apply=1
main="$(cd "$(git rev-parse --git-common-dir)/.." && pwd)"; cd "$main"
coord="${PASCALINE_COORD:-$main/.coord}"; tasks="$main/.tasks"
today="$(date +%F)"; arch="$tasks/archive/$today"; report="$tasks/gc-$today.md"
mkdir -p "$tasks/archive"
[[ $apply -eq 1 ]] || report="$tasks/gc-$today-dry.md"  # a dry run never overwrites the day's applied report
# The path audit reads CLAUDE.md, docs/ and the repo paths of phase-1, not of whatever the main checkout has out.
integ="$(git worktree list --porcelain | awk '/^worktree /{w=$2} /^branch refs\/heads\/phase-1$/{print w}')"
[[ -n "$integ" ]] || integ="$main"
act() { if [[ $apply -eq 1 ]]; then "$@"; else echo "would: $*"; fi; }
{
  echo "# GC $today ($( [[ $apply -eq 1 ]] && echo applied || echo dry run ))"
  echo; echo "## Archived"
  for d in "$tasks"/[0-9][0-9][0-9]-*/; do
    [[ -d "$d" ]] || continue
    b="$(grep -m1 -oE 'on branch [^ ]+' "$d/spec.md" 2>/dev/null | cut -d' ' -f3 || true)"
    if [[ -z "$b" ]] || ! git show-ref --verify --quiet "refs/heads/$b"; then
      rm -f "$d"/*.err; mkdir -p "$arch"; act mv "$d" "$arch/"; echo "- $d (branch ${b:-?} gone)"
    fi
  done
  for f in "$coord"/handoff-*.md "$coord"/*.patch "$coord"/*-night.md "$coord"/*-night-*.txt; do
    [[ -f "$f" ]] || continue; mkdir -p "$arch"; act mv "$f" "$arch/"; echo "- $f"
  done
  echo; echo "## Deleted"
  for f in "$coord"/tmpbuild/* $(find "$coord" -maxdepth 1 -name 'henri_*.out' -mtime +2 2>/dev/null); do
    [[ -e "$f" ]] || continue; act rm -rf "$f"; echo "- $f"
  done
  echo; echo "## Stale paths in CLAUDE.md and docs/README.md (phase-1 worktree $integ)"
  cd "$integ"
  for doc in CLAUDE.md docs/README.md; do
    [[ -f "$doc" ]] || { echo "- $doc is missing"; continue; }
    grep -oE '\b(app|docs|engine|tools|tests|spec|scripts|android|spike|find|fdroid|fastlane|logo)/[A-Za-z0-9_./-]*(\.[a-z]+|/)' "$doc" | sort -u |
    while read -r p; do
      [[ "$p" =~ (_out|_build|_work|_downloads|node_modules|\.venv|test/gallery)/ ]] && continue
      q="${p%/}"; [[ "$doc" == docs/README.md && -e "docs/$q" ]] && continue
      [[ -e "$q" ]] || echo "- $doc names $p, which does not exist"
    done
  done
  echo; echo "## Reports in docs/shifts/ older than 14 days (candidates for the owner; tracked, not moved)"
  find docs/shifts -name '*-report.md' -mtime +14 | sort | sed 's/^/- /'
  cd "$main"
  echo; echo "## Worktrees and branches"; git worktree list | sed 's/^/- /'
  echo "- merged into phase-1, deletable with git branch -d: $(git branch --merged phase-1 --format='%(refname:short)' | grep -vE '^(master|phase-1)$' | tr '\n' ' ')"
} | tee "$report"
if [[ $apply -eq 1 ]]; then
  [[ ! -s "$coord/log.md" || -z "$(tail -c1 "$coord/log.md")" ]] || echo >> "$coord/log.md"
  printf -- '- %s gc applied; report %s\n' "$(date +%H:%M)" "$report" >> "$coord/log.md"
fi
