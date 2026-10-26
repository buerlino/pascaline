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
# 3. Clutter (A27): .tasks/pass-*, report-* and night-*.log, .coord/*.png and *.apk older than 2 days → the archive; *.log in
#    the archive older than 2 days are gzipped; engine/giac/_out/key-<k> that no local branch (nor phase-1) uses and archive
#    folders older than 14 days are deleted (never gsl, gsl.prev, base, release). The report gives the space freed.
# 4. Audit: every repo path named in CLAUDE.md and docs/README.md must exist; reports in docs/shifts/
#    older than 14 days are listed as candidates. Tracked files are never moved or deleted here: the
#    audit's findings go to .tasks/gc-<date>.md (a dry run: gc-<date>-dry.md) for the owner (or the next Opus pass).
set -euo pipefail
apply=0; [[ "${1:-}" == "--apply" ]] && apply=1
main="$(cd "$(git rev-parse --git-common-dir)/.." && pwd)"; cd "$main"
coord="${PASCALINE_COORD:-$main/.coord}"; tasks="$main/.tasks"
today="$(date +%F)"; arch="$tasks/archive/$today"; report="$tasks/gc-$today.md"
mkdir -p "$tasks"
[[ $apply -eq 1 ]] || report="$tasks/gc-$today-dry.md"  # a dry run never overwrites the day's applied report
# The path audit reads CLAUDE.md, docs/ and the repo paths of phase-1, not of whatever the main checkout has out.
integ="$(git worktree list --porcelain | awk '/^worktree /{w=$2} /^branch refs\/heads\/phase-1$/{print w}')"
[[ -n "$integ" ]] || integ="$main"
# shellcheck source=scripts/pipeline-lib.sh
source "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/pipeline-lib.sh"
kb() { du -sk "$@" 2>/dev/null | awk '{s+=$1} END{print s+0}'; }
freed=0
act() { if [[ $apply -eq 1 ]]; then "$@"; else echo "would: $*"; fi; }
{
  echo "# GC $today ($( [[ $apply -eq 1 ]] && echo applied || echo dry run ))"
  echo; echo "## Archived"
  for d in "$tasks"/[0-9][0-9][0-9]-*/; do
    [[ -d "$d" ]] || continue
    b="$(grep -m1 -oE 'on branch [^ ]+' "$d/spec.md" 2>/dev/null | cut -d' ' -f3 || true)"
    if [[ -z "$b" ]] || ! git show-ref --verify --quiet "refs/heads/$b"; then
      act rm -f "$d"/*.err; act mkdir -p "$arch"; act mv "$d" "$arch/"; echo "- $d (branch ${b:-?} gone)"
    fi
  done
  for f in "$coord"/handoff-*.md "$coord"/*.patch "$coord"/*-night.md "$coord"/*-night-*.txt; do
    [[ -f "$f" ]] || continue; act mkdir -p "$arch"; act mv "$f" "$arch/"; echo "- $f"
  done
  while IFS= read -r f; do
    [[ -n "$f" ]] || continue; act mkdir -p "$arch"; act mv "$f" "$arch/"; echo "- $f (older than 2 days)"
  done < <({ find "$tasks" -maxdepth 1 \( -name 'pass-*' -o -name 'report-*' -o -name 'night-*.log' \) -mtime +2
             find "$coord" -maxdepth 1 \( -name '*.png' -o -name '*.apk' \) -type f -mtime +2; } 2>/dev/null | sort)
  echo; echo "## Gzipped (*.log in the archive older than 2 days)"
  gz_before=0; gz_after=0
  while IFS= read -r f; do
    [[ -n "$f" ]] || continue
    sz=$(( $(wc -c < "$f") )); gz_before=$((gz_before + sz))
    gz_after=$((gz_after + $(gzip -c "$f" | wc -c)))
    act gzip -f "$f"; echo "- $f"
  done < <(find "$tasks/archive" -name '*.log' -type f -mtime +2 2>/dev/null | sort)
  echo "- saving: $(( (gz_before - gz_after) / 1024 )) kB ($((gz_before / 1024)) kB → $((gz_after / 1024)) kB)"
  echo; echo "## Deleted"
  for f in "$coord"/tmpbuild/* $(find "$coord" -maxdepth 1 -name 'henri_*.out' -mtime +2 2>/dev/null); do
    [[ -e "$f" ]] || continue; act rm -rf "$f"; echo "- $f"
  done
  echo; echo "## Pruned (engine builds no branch uses; archive folders older than 14 days)"
  keep=" $(engine_key "$main" phase-1)"
  while read -r br; do keep+=" $(engine_key "$main" "$br")"; done < <(git for-each-ref --format='%(refname:short)' refs/heads)
  for e in "$main"/engine/giac/_out/key-*; do
    [[ -d "$e" ]] || continue
    k="${e##*/key-}"; [[ "$keep" == *" $k"* ]] && continue
    freed=$((freed + $(kb "$e"))); act rm -rf "$e"; echo "- $e (key of no branch)"
  done
  cutoff="$(date -d '14 days ago' +%F)"
  for d in "$tasks"/archive/[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]; do
    [[ -d "$d" && "${d##*/}" < "$cutoff" ]] || continue
    freed=$((freed + $(kb "$d"))); act rm -rf "$d"; echo "- $d (older than 14 days)"
  done
  echo "- space freed: $((freed / 1024)) MB ($freed kB)"
  echo; echo "## Decided research notes (move to docs/archive/ in the next docs commit)"
  grep -liE '^\*\*status[^*]*decided' "$integ"/docs/research/*.md 2>/dev/null | sed "s|^$integ/|- |" || true
  echo; echo "## Stale paths in CLAUDE.md and docs/README.md (phase-1 worktree $integ)"
  cd "$integ"
  for doc in CLAUDE.md docs/README.md; do
    [[ -f "$doc" ]] || { echo "- $doc is missing"; continue; }
    { grep -oE '\b(app|docs|engine|tools|tests|spec|scripts|android|spike|find|fdroid|fastlane|logo)/[A-Za-z0-9_./-]*(\.[a-z]+|/)' "$doc" || true; } | sort -u |
    while read -r p; do
      [[ "$p" =~ (_out|_build|_work|_downloads|node_modules|\.venv|test/gallery)/ ]] && continue
      q="${p%/}"; [[ "$doc" == docs/README.md && -e "docs/$q" ]] && continue
      [[ -e "$q" ]] || echo "- $doc names $p, which does not exist"
    done
  done
  echo; echo "## Reports in docs/shifts/ older than 14 days (candidates for the owner; tracked, not moved)"
  find docs/shifts -name '*-report.md' -mtime +14 2>/dev/null | sort | sed 's/^/- /' || true
  cd "$main"
  echo; echo "## Worktrees and branches"; git worktree list | sed 's/^/- /'
  del=""
  while read -r br; do
    [[ -n "$br" ]] || continue
    w="$(git worktree list --porcelain | awk -v b="refs/heads/$br" '/^worktree /{w=$2} $0=="branch "b{print w}')"
    if [[ -n "$w" ]]; then echo "- merged into phase-1, checked out in $w: $br"; else del+="$br "; fi
  done < <(git branch --merged phase-1 --format='%(refname:short)' | grep -vE '^(master|phase-1)$')
  echo "- merged into phase-1, deletable with git branch -d: $del"
} | if [[ $apply -eq 1 && -s "$report" ]]; then { printf '\n---\n\n' >> "$report"; tee -a "$report"; }; else tee "$report"; fi
if [[ $apply -eq 1 ]]; then
  [[ ! -s "$coord/log.md" || -z "$(tail -c1 "$coord/log.md")" ]] || echo >> "$coord/log.md"
  printf -- '- %s gc applied; report %s\n' "$(date +%H:%M)" "$report" >> "$coord/log.md"
fi
