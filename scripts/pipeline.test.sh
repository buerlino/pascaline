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

# A41: night.sh runs the device step right after each pass (same number), not after a pass that hit the usage limit
printf '%s\n' 'scripts/pipeline.sh pass 7 "A1" "none"' '75: scripts/pipeline.sh pass 8 "A2" "none"' 'scripts/pipeline.sh pass 8 "A2" "none"' 'scripts/pipeline.sh ron "R1" --model sonnet' > "$tmp/replies"
out="$(PASCALINE_NIGHT_REPLIES="$tmp/replies" PASCALINE_NIGHT_NOW=22:00 "$here/night.sh" --dry-run --max-steps 20 2>&1)"
seq="$(grep -E '^[0-9:]+ run: ' <<<"$out" | sed -E 's/^[0-9:]+ run: //')"
want=$'scripts/pipeline.sh pass 7 "A1" "none"\nscripts/pipeline.sh device 7\nscripts/pipeline.sh pass 8 "A2" "none"\nscripts/pipeline.sh pass 8 "A2" "none"\nscripts/pipeline.sh device 8\nscripts/pipeline.sh ron "R1" --model sonnet --audit-model auto'
[[ "$seq" == "$want" ]] || fail "A41: the run sequence is not pass, device, (limit: no device), pass, device: $seq"
out="$(PASCALINE_NIGHT_REPLIES="$tmp/replies" PASCALINE_NIGHT_NOW=22:00 "$here/night.sh" --dry-run --max-steps 6 2>&1)"
grep -q 'closing 1 of 2' <<<"$out" && grep -q 'closing 2 of 2' <<<"$out" || fail "A41: the closing steps are gone: $out"

# A24: each worktree gets its own node_modules (hard-link copy); a machine failure ends the run; a dirty phase-1 is not a conflict
out="$("$script" ron "$ron_pkg" --dry-run 2>&1)"
grep -q '^setup: .*cp -al' <<<"$out" || fail "A24: the dry run does not show the setup step (cp -al of node_modules)"
grep -q 'ln -s "$main/app/node_modules"' "$here/pipeline.sh" && fail "A24: pipeline.sh still links the shared node_modules"
printf 'sh: 1: svelte-check: command not found\n' > "$tmp/m1.log"; printf 'Error: Cannot find module vitest\nnode_modules missing\n' > "$tmp/m2.log"; printf 'error TS2322: x\n' > "$tmp/m3.log"
machine_failure "$tmp/m1.log" >/dev/null || fail "A24: 'command not found' is not a machine failure"
machine_failure "$tmp/m2.log" >/dev/null || fail "A24: 'node_modules missing' is not a machine failure"
printf 'Error: Cannot find module ./foo\nERR_MODULE_NOT_FOUND\n' > "$tmp/m4.log"
machine_failure "$tmp/m4.log" >/dev/null && fail "A24: the worker's own 'Cannot find module ./foo' is a machine failure"
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

# A24, behaviour: a sandbox repo with stub claude/npm runs pipeline.sh itself (no real agent)
sb="$tmp/sb"; mkdir -p "$sb/bin" "$sb/tools" "$sb/docs/shifts" "$sb/app/node_modules/x"; git init -q -b main "$sb"
printf '#!/bin/sh\nexit 0\n' > "$sb/tools/devlock.sh"; chmod +x "$sb/tools/devlock.sh"
: > "$sb/docs/shifts/brief.md"; echo t > "$sb/tracked"; echo t > "$sb/app/keep"; git -C "$sb" add -A; gc "$sb" init; git -C "$sb" branch phase-1
cat > "$sb/bin/claude" <<'STUB'
#!/bin/sh
case "$*" in
  *"--agent sofia"*) [ -z "$SB_DIRTY" ] || echo dirty >> "$SB_DIRTY/tracked"; echo APPROVED;;
  *) echo w >> w.txt; git add w.txt; git -c user.name=t -c user.email=t@t commit -qm work; echo done;;
esac
STUB
printf '#!/bin/sh\n[ "$1" = ci ] && { mkdir -p node_modules/x; exit 0; }\necho "sh: 1: svelte-check: command not found"; exit 1\n' > "$sb/bin/npm"; chmod +x "$sb/bin/claude" "$sb/bin/npm"
sbrun() { (cd "$sb" && PATH="$sb/bin:$PATH" GIAC_OUT="$sb/engine" "$@"); }  # unmanaged engine, whatever the caller exports
out="$(sbrun "$script" ron "sandbox task" --id T1 --branch p1/t1 --checks typecheck 2>&1)"
grep -q '^RESULT #1 T1: NOT MERGED (machine: typecheck: ' <<<"$out" || fail "A24: a check printing 'command not found' does not end as NOT MERGED (machine: ...): $out"
ls "$sb"/.tasks/*/fail-*.txt >/dev/null 2>&1 && [[ -n "$(cat "$sb"/.tasks/*/fail-*.txt)" ]] && fail "A24: a machine failure was handed to a fix round (fail file written)"
[[ -e "$sb"/.tasks/*/fix-1.in ]] 2>/dev/null && fail "A24: a machine failure started a fix round"
[[ -d "$sb/app/node_modules" && ! -L "$sb/app/node_modules" ]] || true
git -C "$sb" worktree remove --force "$sb"/.claude/worktrees/pl-001-t1 2>/dev/null; git -C "$sb" branch -D p1/t1 >/dev/null 2>&1
out="$(SB_DIRTY="$sb/.claude/worktrees/phase-1" sbrun "$script" ron "sandbox task" --id T2 --branch p1/t2 --checks none 2>/dev/null)"
grep -q '^RESULT #2 T2: NOT MERGED (phase-1 worktree not clean' <<<"$out" || fail "A24: a dirty phase-1 does not end as NOT MERGED (phase-1 worktree not clean): $out"
git -C "$sb" log phase-1 --format=%s | grep -q '^Merge' && fail "A24: a dirty phase-1 was merged into"
# A28, behaviour: with GIAC_OUT unset the engine is managed: a real build with a stub build-wasm.sh writes the stamp and promotes
sb2="$tmp/sb2"; mkdir -p "$sb2/bin" "$sb2/tools" "$sb2/docs/shifts" "$sb2/app/node_modules/x" "$sb2/engine/giac/patches"; git init -q -b main "$sb2"
cp "$sb/tools/devlock.sh" "$sb2/tools/"; cp "$sb/bin/claude" "$sb/bin/npm" "$sb2/bin/"; : > "$sb2/docs/shifts/brief.md"; echo t > "$sb2/tracked"; echo t > "$sb2/app/keep"
printf '#!/bin/sh\nmkdir -p "$GIAC_BUILD_OUT/gsl" && echo wasm > "$GIAC_BUILD_OUT/gsl/giac.wasm"\n' > "$sb2/engine/giac/build-wasm.sh"; chmod +x "$sb2/engine/giac/build-wasm.sh"
git -C "$sb2" add -A; gc "$sb2" init; git -C "$sb2" branch phase-1
out="$(cd "$sb2" && env -u GIAC_OUT PATH="$sb2/bin:$PATH" "$script" ron "sandbox task" --id T3 --branch p1/t3 --checks none 2>&1)"
grep -q '^RESULT #1 T3: ' <<<"$out" && ! grep -q 'engine build' <<<"$out" || fail "A28: managed sandbox run hit an engine build failure: $out"
k2="$(engine_key "$sb2" phase-1)"
[[ "$(engine_stamp "$sb2/engine/giac/_out/gsl")" == "$k2" ]] || fail "A28: the real build did not write the stamp into gsl"
[[ -f "$sb2/engine/giac/_out/key-$k2/giac.wasm" ]] || fail "A28: no per-key build directory"
# promotion keeps the old engine as gsl.prev and never leaves gsl missing
echo old > "$sb2/engine/giac/_out/gsl/marker"; cp -a "$sb2/engine/giac/_out/key-$k2" "$sb2/engine/giac/_out/key-zz"; echo zz > "$sb2/engine/giac/_out/key-zz/.engine-key"
engine_promote "$sb2/engine/giac/_out" zz
[[ "$(engine_stamp "$sb2/engine/giac/_out/gsl")" == zz && -f "$sb2/engine/giac/_out/gsl.prev/marker" && ! -e "$sb2/engine/giac/_out/gsl.new" ]] || fail "A28: engine_promote did not swap gsl and keep gsl.prev"
# setup_node_modules: a failed copy leaves no half-filled directory
grep -q 'node_modules.tmp' "$here/pipeline.sh" || fail "A24: setup_node_modules copies in place (not atomic)"

# A28: the engine is keyed by its inputs; a branch that changes them gets its own build, an unchanged key keeps the shared engine
e="$tmp/eng"; mkdir -p "$e/engine/giac/patches" "$e/engine/giac/wasm" "$e/docs/shifts" "$e/tools"; git init -q -b main "$e"
echo b > "$e/engine/giac/build-wasm.sh"; echo p > "$e/engine/giac/patches/0001.patch"; echo r > "$e/engine/giac/patches/README.md"; echo a > "$e/engine/giac/wasm/api.cc"
: > "$e/docs/shifts/brief.md"; git -C "$e" add -A; gc "$e" init; git -C "$e" branch phase-1; git -C "$e" branch p1/same
git -C "$e" checkout -q -b p1/eng; echo q > "$e/engine/giac/patches/0003.patch"; git -C "$e" add -A; gc "$e" patch; git -C "$e" checkout -q main
k0="$(engine_key "$e" phase-1)"; k1="$(engine_key "$e" p1/eng)"
[[ -n "$k0" && "$k0" != "$k1" ]] || fail "A28: a new patch does not change the engine key ($k0 $k1)"
[[ "$k0" == "$(engine_key "$e" p1/same)" ]] || fail "A28: the same inputs give another key"
echo "other readme" > "$e/engine/giac/patches/README.md"; git -C "$e" add -A; gc "$e" readme
[[ "$k0" == "$(engine_key "$e" HEAD)" ]] || fail "A28: the patches README changes the engine key"
git -C "$e" branch -f phase-1 HEAD
mkdir -p "$e/engine/giac/_out/gsl"; echo "$k0" > "$e/engine/giac/_out/gsl/.engine-key"
ed() { (cd "$e" && env -u GIAC_OUT "$script" ron "task" --id E1 --branch "$1" --dry-run 2>&1); }
out="$(ed p1/eng)"
grep -q "^engine build: key $k1 " <<<"$out" && grep -qE "^GIAC_OUT=.*/engine/giac/_out/key-$k1 \(worker, fix rounds and checks\)" <<<"$out" || fail "A28: a branch with a new patch prints no engine build with its key and GIAC_OUT: $out"
out="$(ed p1/same)"
grep -q '^engine build' <<<"$out" && fail "A28: an unchanged key prints an engine build: $out"
grep -qE "^GIAC_OUT=.*/engine/giac/_out/key-$k0 " <<<"$out" || fail "A47a: an unchanged key does not use phase-1's key directory: $out"
grep -q '^engine rebuild' <<<"$out" && fail "A28: a matching stamp prints a rebuild"
echo stale > "$e/engine/giac/_out/gsl/.engine-key"
out="$(ed p1/same)"
a="$(grep -n '^engine rebuild' <<<"$out" | head -n1 | cut -d: -f1)"; b="$(grep -n '^cat .*claude -p' <<<"$out" | head -n1 | cut -d: -f1)"
[[ -n "$a" && -n "$b" && "$a" -lt "$b" ]] || fail "A28: a stale stamp does not print the rebuild before the worker: $out"
grep -q 'engine_build' "$here/pipeline.sh" && grep -q 'gsl.prev' "$here/pipeline-lib.sh" || fail "A28: pipeline.sh/-lib.sh lack the engine build or the gsl.prev promotion"

# A34: node_modules come from the phase-1 worktree; a stale one is rebuilt; a missing bare module is a machine failure
out="$("$script" ron "$ron_pkg" --dry-run 2>&1)"
grep -q "^setup: .*cp -al $integ/app/node_modules " <<<"$out" || fail "A34: the dry run's setup line does not copy from the phase-1 worktree: $(grep '^setup' <<<"$out")"
printf "error TS2307: Cannot find module '@capacitor/clipboard' or its corresponding type declarations.\n" > "$tmp/m5.log"
printf "Error: Cannot find module 'vitest'\n" > "$tmp/m6.log"
printf "error TS2307: Cannot find module './missing.ts' or its corresponding type declarations.\n" > "$tmp/m7.log"
machine_failure "$tmp/m5.log" || fail "A34: a missing @capacitor/clipboard is not a machine failure"
machine_failure "$tmp/m6.log" || fail "A34: a missing 'vitest' is not a machine failure"
machine_failure "$tmp/m7.log" && fail "A34: a missing relative import is a machine failure"
nm="$tmp/nm"; mkdir -p "$nm/app/node_modules"
printf '{"packages":{"":{},"node_modules/a":{"version":"1"},"node_modules/b":{"version":"1","optional":true}}}' > "$nm/app/package-lock.json"
printf '{"packages":{"node_modules/a":{"version":"1"}}}' > "$nm/app/node_modules/.package-lock.json"
mkdir -p "$nm/app/node_modules/a"; printf '{"version":"1"}' > "$nm/app/node_modules/a/package.json"
node_modules_stale "$nm/app" && fail "A34: a complete node_modules counts as stale"
printf '{"packages":{"node_modules/b":{"version":"1"}}}' > "$nm/app/node_modules/.package-lock.json"
node_modules_stale "$nm/app" || fail "A34: a node_modules lacking a non-optional package is not stale"
rm "$nm/app/node_modules/.package-lock.json"
node_modules_stale "$nm/app" || fail "A34: a node_modules without a hidden lock is not stale"
# A34f1: a bumped version in the lock is stale; the same version, or a missing optional package, is not
nv="$tmp/nv"; mkdir -p "$nv/app/node_modules/foo"
printf '{"packages":{"":{},"node_modules/foo":{"version":"1.0.1"},"node_modules/opt":{"version":"1","optional":true}}}' > "$nv/app/package-lock.json"
printf '{"packages":{"node_modules/foo":{"version":"1.0.0"}}}' > "$nv/app/node_modules/.package-lock.json"
printf '{"name":"foo","version":"1.0.0"}' > "$nv/app/node_modules/foo/package.json"
node_modules_stale "$nv/app" || fail "A34f1: foo 1.0.0 installed, the lock wants 1.0.1: not stale"
printf '{"name":"foo","version":"1.0.1"}' > "$nv/app/node_modules/foo/package.json"
node_modules_stale "$nv/app" && fail "A34f1: same versions, optional package missing: counts as stale"

# A33: the night's device step
out="$(ANDROID_SERIAL=TESTSERIAL "$script" device 7 --dry-run 2>&1)"; rc=$?
[[ $rc -eq 0 ]] || fail "A33: device --dry-run: exit $rc: $out"
for want in 'host-cpu' 'tools/device-build.sh --test' 'devlock.sh acquire TESTSERIAL' 'adb -s TESTSERIAL install' 'tools/core-device.sh' 'CORE DEVICE <p>/<a> (known <k>, new <ids or none>) on <sha>' '.tasks/device-7'; do
  grep -qF -- "$want" <<<"$out" || fail "A33: device --dry-run does not print '$want': $out"
done
grep -qE 'HA24BZ2Y|4d42e62f' "$here/pipeline.sh" && fail "A33: pipeline.sh writes a device serial"
grep -q 'DEVICE SKIPPED' "$here/pipeline.sh" || fail "A33: pipeline.sh has no DEVICE SKIPPED"
grep -q 'scripts/pipeline.sh device <n>' "$here/night.sh" && fail "A41: the henri prompt still lists the device line"
grep -q 'pipeline.sh\\ device\\ \*' "$here/night.sh" || fail "A33: night.sh does not run a device line"

# A33f1: a locked screen is skipped, not failed; the build is never run
grep -qF 'screen locked' <<<"$(ANDROID_SERIAL=TESTSERIAL "$script" device 7 --dry-run 2>&1)" || fail "A33f1: the dry run does not list the lock check"
sb3="$tmp/sb3"; mkdir -p "$sb3/bin" "$sb3/tools" "$sb3/docs/shifts"; git init -q -b main "$sb3"
cp "$sb/tools/devlock.sh" "$sb3/tools/"; : > "$sb3/docs/shifts/brief.md"
printf '#!/bin/sh\ntouch "%s/built"\nexit 1\n' "$sb3" > "$sb3/tools/device-build.sh"; chmod +x "$sb3/tools/device-build.sh"
git -C "$sb3" add -A; gc "$sb3" init; git -C "$sb3" branch phase-1
cat > "$sb3/bin/adb" <<'STUB'
#!/bin/sh
case "$*" in
  *get-state*) echo device;;
  *"dumpsys battery"*) echo "  level: 80";;
  *"dumpsys window"*) seq 1 200000; echo "  isKeyguardShowing=true"; seq 1 1000;;
esac
exit 0
STUB
chmod +x "$sb3/bin/adb"
out="$(cd "$sb3" && ANDROID_SERIAL=TESTSERIAL PATH="$sb3/bin:$PATH" "$script" device 7 2>&1)"; rc=$?
[[ $rc -eq 0 ]] && grep -q 'DEVICE SKIPPED (screen locked)' <<<"$out" || fail "A33f1: a locked device is not skipped (rc $rc): $out"
[[ ! -e "$sb3/built" ]] || fail "A33f1: the build ran on a locked device"
# tools/core-device.sh alone: a locked device exits 4 with the message (a copy in a sandbox, stubbed lock and stay-awake)
cd4="$tmp/cd4"; mkdir -p "$cd4/tools" "$cd4/app"
cp "$here/../tools/core-device.sh" "$cd4/tools/"; printf '#!/bin/sh\nexit 0\n' > "$cd4/tools/devlock.sh"; cp "$cd4/tools/devlock.sh" "$cd4/tools/stay-awake.sh"
chmod +x "$cd4/tools/"*
out="$(ANDROID_SERIAL=TESTSERIAL PATH="$sb3/bin:$PATH" "$cd4/tools/core-device.sh" 2>&1)"; rc=$?
[[ $rc -eq 4 ]] && grep -q 'the device is locked' <<<"$out" || fail "A33f1: core-device.sh on a locked device: rc $rc: $out"

# A35: a step that ignores TERM is killed; Gradle never reads the terminal; core-device.sh says keep the screen on
grep -q 'timeout -k 60 1200 tools/device-build.sh' "$here/pipeline.sh" || fail "A35: the device build has no timeout -k 60 1200"
# every timeout of the three scripts (run_agent, pass, report, device, night) escalates to KILL; the adb probes use -k 5, the install -k 30
grep -qE 'timeout [0-9]+ (claude|tools/|"\$integ|adb)' "$here/pipeline.sh" && fail "A35: pipeline.sh has an agent/device timeout without -k"
grep -qE 'timeout [0-9]' "$here/night.sh" && fail "A35: night.sh has a timeout without -k"
for pat in 'timeout -k 60 10800 claude' 'timeout -k 60 7200 claude' 'timeout -k 60 1800 claude' 'timeout -k 60 14400'; do
  grep -qF "$pat" "$here/pipeline.sh" "$here/night.sh" || fail "A35: no '$pat'"
done
# build.sh, behaviour: a sandbox copy with stub npm/npx and a stub gradle that records its stdin and arguments
bs="$tmp/bs"; mkdir -p "$bs/bin" "$bs/cache/gradle-8.14.3/bin" "$bs/app" "$bs/android" "$bs/eng"; cp "$here/../build.sh" "$bs/"
printf '#!/bin/sh\nexit 0\n' > "$bs/bin/npm"; cp "$bs/bin/npm" "$bs/bin/npx"
cat > "$bs/cache/gradle-8.14.3/bin/gradle" <<'STUB'
#!/bin/sh
readlink /proc/self/fd/0 > "$GRADLE_STDIN_OUT"; echo "$*" >> "$GRADLE_STDIN_OUT"
mkdir -p app/build/outputs/apk/release; touch app/build/outputs/apk/release/app-release-unsigned.apk
STUB
chmod +x "$bs/bin/"* "$bs/cache/gradle-8.14.3/bin/gradle"
echo y | (cd "$bs" && PATH="$bs/bin:$PATH" PASCALINE_CACHE="$bs/cache" NO_LOCK=1 GRADLE_STDIN_OUT="$bs/stdin.txt" ./build.sh --unsigned --engine-dir "$bs/eng" >/dev/null 2>&1) || fail "A35: the build.sh sandbox run failed"
[[ "$(head -n1 "$bs/stdin.txt" 2>/dev/null)" == /dev/null ]] || fail "A35: build.sh's Gradle reads stdin from $(head -n1 "$bs/stdin.txt" 2>/dev/null), not /dev/null"
grep -q -- '--no-daemon' "$bs/stdin.txt" || fail "A35: build.sh's Gradle runs without --no-daemon"
grep -q 'keep its screen on while charging (brief 0c rule 2); never remove its PIN' "$here/../tools/core-device.sh" || fail "A33f2: core-device.sh lock message"

# A25 item 1+2: every script the golden gate runs selects the golden check; a diff of only such a file plans it
for f in app/scripts/golden.ts app/scripts/golden/lib.ts app/scripts/golden/home.ts app/scripts/invariants.ts app/scripts/calls-budget.ts app/scripts/behaviour-diff.ts app/scripts/golden-speed.ts app/scripts/golden-compare.ts app/scripts/sweep.ts app/scripts/seqsweep.ts app/scripts/casback.ts app/scripts/viewsweep.ts app/scripts/findcensus.ts tools/probes/giac-check.mjs tools/probes/giaccheck/lib.ts tools/probes/sweep/x.ts tools/probes/casback/x.ts tests/engine/x.test.ts; do
  printf '%s\n' "$f" | golden_selected || fail "A25: a diff touching only $f does not plan the golden check"
done
printf '%s\n' app/src/ui/foo.ts app/scripts/gate.ts docs/backlog.md | golden_selected && fail "A25: an unrelated diff plans the golden check"
grep -q 'golden_selected' "$here/pipeline.sh" || fail "A25: pipeline.sh does not use golden_selected for the golden check"
# A25 item 5: a stage line NEW / NOW PASSING / CHANGED / GONE fails the engine stages even at exit 0
printf 'x\n  sweep NOW PASSING a1: remove it\nSWEEP PASSED: 1\n' > "$tmp/st1.log"; printf '  seq known y\nSEQ PASSED: 1\n' > "$tmp/st2.log"
stage_findings "$tmp/st1.log" >/dev/null || fail "A25: a NOW PASSING stage line is not a finding"
stage_findings "$tmp/st2.log" >/dev/null && fail "A25: a known stage line is a finding"
# A25 item 5, behaviour: a sandbox whose sweep prints NOW PASSING (exit 0) fails the checks once golden runs
s5="$tmp/s5"; mkdir -p "$s5/bin" "$s5/tools" "$s5/docs/shifts" "$s5/app/scripts"; git init -q -b main "$s5"
cp "$sb/tools/devlock.sh" "$s5/tools/"; : > "$s5/docs/shifts/brief.md"; echo t > "$s5/app/keep"
for st in sweep seqsweep casback viewsweep findcensus; do echo 'console.log("fine");' > "$s5/app/scripts/$st.ts"; done
echo 'console.log("  sweep NOW PASSING g1: remove it from sweep-known.yaml"); console.log("SWEEP PASSED: 1 runs");' > "$s5/app/scripts/sweep.ts"
cp "$sb/bin/claude" "$s5/bin/"; printf '#!/bin/sh\n[ "$1" = ci ] && { mkdir -p node_modules/x; exit 0; }\nexit 0\n' > "$s5/bin/npm"; chmod +x "$s5/bin/"*
git -C "$s5" add -A; gc "$s5" init; git -C "$s5" branch phase-1
out="$(cd "$s5" && PATH="$s5/bin:$PATH" GIAC_OUT="$s5/engine" "$script" ron "sandbox task" --id T5 --branch p1/t5 --checks golden 2>&1)"
grep -q '^RESULT #1 T5: NOT MERGED' <<<"$out" || fail "A25: a NOW PASSING sweep line does not fail the pipeline's checks: $out"
grep -qs 'sweep NOW PASSING' "$s5"/.tasks/*/fail-0.txt || fail "A25: the failing stage is not in the fix round's input"

# A37: the flake census: a dry run plans it; flaky_items lists only tests that failed in some runs; head_is notices a moved HEAD
out="$("$script" flakes 3 --dry-run 2>&1)"; rc=$?
[[ $rc -eq 0 ]] || fail "A37: flakes --dry-run: exit $rc: $out"
for want in 'host-cpu' 'HEAD must still be' 'FLAKES 3: ABORTED (HEAD moved)' 'FLAKES 3: vitest <k> of 5 runs clean, e2e <k> of 5, flaky: <ids or none>' '.tasks/flakes-'; do
  grep -qF -- "$want" <<<"$out" || fail "A37: flakes --dry-run does not print '$want': $out"
done
printf 'a.test.ts\tone\nb.test.ts\ttwo\n' > "$tmp/i1"; printf 'a.test.ts\tone\n' > "$tmp/i2"; : > "$tmp/i3"
[[ "$(flaky_items 3 "$tmp/i1" "$tmp/i2" "$tmp/i3")" == $'2/3\ta.test.ts\tone\n1/3\tb.test.ts\ttwo' || "$(flaky_items 3 "$tmp/i1" "$tmp/i2" "$tmp/i3")" == $'1/3\tb.test.ts\ttwo\n2/3\ta.test.ts\tone' ]] || fail "A37: flaky_items: $(flaky_items 3 "$tmp/i1" "$tmp/i2" "$tmp/i3")"
[[ -z "$(flaky_items 2 "$tmp/i1" "$tmp/i1")" ]] || fail "A37: a test failing in every run is called flaky"
[[ -z "$(flaky_items 2 "$tmp/i3" "$tmp/i3")" ]] || fail "A37: no failures gives flaky items"
head_is "$tmp/heads-wt" "$det" || fail "A37: head_is refuses the current HEAD"
gc "$tmp/heads-wt" moved; head_is "$tmp/heads-wt" "$det" && fail "A37: head_is accepts a moved HEAD"
grep -q 'head_is "$integ" "$sha"' "$here/pipeline.sh" || fail "A37: pipeline.sh does not check HEAD between runs"

# A37, behaviour: a sandbox runs the real census with fake vitest/e2e commands (vitest fails in runs 2 and 4; e2e is clean)
fk="$tmp/fk"; mkdir -p "$fk/bin" "$fk/tools" "$fk/docs/shifts" "$fk/app/scripts" "$fk/app/node_modules/x"; git init -q -b main "$fk"
cp "$sb/tools/devlock.sh" "$fk/tools/"; cp "$sb/bin/npm" "$fk/bin/"; cp "$here/../app/scripts/pipeline-logs.ts" "$fk/app/scripts/"; : > "$fk/docs/shifts/brief.md"; echo t > "$fk/tracked"
git -C "$fk" add -A; gc "$fk" init; git -C "$fk" branch phase-1
cat > "$fk/fakev.sh" <<STUB
#!/bin/sh
k=\$(( \$(cat "$fk/cnt" 2>/dev/null || echo 0) + 1 )); echo \$k > "$fk/cnt"
[ -z "\$FAKE_MOVE" ] || { [ \$k -ne 2 ] || git -c user.name=t -c user.email=t@t commit -q --allow-empty -m move; }
if [ \$k -eq 2 ] || [ \$k -eq 4 ]; then echo " FAIL  src/a.test.ts > suite > case one"; echo " FAIL  src/a.test.ts > suite > case one"; echo " FAIL  src/b.test.ts [ src/b.test.ts ]"; exit 1; fi
exit 0
STUB
printf '#!/bin/sh\nexit 0\n' > "$fk/faked.sh"; chmod +x "$fk/fakev.sh" "$fk/faked.sh"
fkrun() { (cd "$fk" && PATH="$fk/bin:$PATH" GIAC_OUT="$fk/engine" PASCALINE_FLAKES_VITEST="$1" PASCALINE_FLAKES_E2E="$fk/faked.sh" "$script" flakes 7 2>&1); }
out="$(fkrun "$fk/fakev.sh")"
want='FLAKES 7: vitest 3 of 5 runs clean, e2e 5 of 5, flaky: src/a.test.ts: suite > case one (vitest 2/5), src/b.test.ts (vitest 2/5)'
grep -qF -- "$want" <<<"$out" || fail "A37: the census line is not '$want': $out"
grep -qF -- "$want" "$fk/.coord/log.md" || fail "A37: the log lacks the FLAKES line"
f7="$(ls "$fk"/.tasks/flakes-*.md 2>/dev/null | head -n1)"
[[ -n "$f7" ]] && grep -q "src/a.test.ts suite > case one" "$f7" && grep -q '^| 5 |' "$f7" || fail "A37: .tasks/flakes-<date>.md is missing or lacks the test and the per-run load rows"
rm -rf "$fk/.tasks"/flakes-*; echo 0 > "$fk/cnt"
out="$(FAKE_MOVE=1 fkrun "git -C $fk/.claude/worktrees/phase-1 -c user.name=t -c user.email=t@t commit -q --allow-empty -m move; true")"
grep -q 'FLAKES 7: ABORTED (HEAD moved before run 2' <<<"$out" || fail "A37: a moved HEAD does not abort the census: $out"
# one title twice in one run's file counts once; a failure in 1 of 2 runs is flaky, not always failing
printf 'a\tt\na\tt\n' > "$tmp/d1"; : > "$tmp/d2"
[[ "$(flaky_items 2 "$tmp/d1" "$tmp/d2")" == $'1/2\ta\tt' ]] || fail "A37: a duplicate line in one run counts twice"
[[ -z "$(flaky_items 2 "$tmp/d1" "$tmp/d1")" ]] || fail "A37: a duplicate line in two runs is not always failing"

# A36: red-first: a package that says its tests fail on phase-1 must have a new test that fails there
rf="$tmp/rf"; mkdir -p "$rf/app" "$rf/tests/golden"; git init -q -b phase-1 "$rf"; echo 1 > "$rf/app/code.txt"; printf -- '- id: old\n' > "$rf/tests/golden/g2.yaml"; cp "$rf/tests/golden/g2.yaml" "$rf/tests/golden/home.yaml"
git -C "$rf" add -A; gc "$rf" base
git -C "$rf" checkout -q -b p1/pass; echo 'PASSES' > "$rf/app/a.test.ts"; git -C "$rf" add -A; gc "$rf" t
git -C "$rf" checkout -q -b p1/fail phase-1; echo 'FAILS-ON-OLD' > "$rf/app/b.test.ts"; git -C "$rf" add -A; gc "$rf" t
git -C "$rf" checkout -q -b p1/none phase-1; echo 2 > "$rf/app/code.txt"; git -C "$rf" add -A; gc "$rf" t
git -C "$rf" checkout -q -b p1/crash phase-1; echo 'CRASHES' > "$rf/app/c.test.ts"; git -C "$rf" add -A; gc "$rf" t
git -C "$rf" checkout -q -b p1/g2 phase-1; printf -- '- id: old\n- id: newcase\n' > "$rf/tests/golden/g2.yaml"; git -C "$rf" add -A; gc "$rf" t
git -C "$rf" checkout -q -b p1/home phase-1; printf -- '- id: old\n- id: newcase\n' > "$rf/tests/golden/home.yaml"; git -C "$rf" add -A; gc "$rf" t; git -C "$rf" checkout -q phase-1
printf '#!/bin/sh\ngrep -q FAILS-ON-OLD "$@" && { echo " Test Files  1 failed (1)"; echo "      Tests  1 failed (1)"; exit 1; }\ngrep -q CRASHES "$@" && { echo "Error: cannot import"; exit 1; }\nexit 0\n' > "$tmp/fakevitest.sh"
printf '#!/bin/sh\n[ "$ONLY" = home ] && [ -z "$GOLDEN_PASSES" ] && { [ -n "$GOLDEN_OTHER" ] && { echo "FAIL home: 12/13 match"; echo "  home other: got 1, expect 2"; echo "GOLDEN GATE FAILED"; exit 1; }; echo "FAIL home: 12/13 match"; echo "  home other: got 1, expect 2"; echo "  home newcase: got 1, expect 2"; echo "GOLDEN GATE FAILED"; exit 1; }\necho "ran ONLY=$ONLY" > "%s/golden-ran"; exit 0\n' "$tmp" > "$tmp/fakegolden.sh"; chmod +x "$tmp/fakevitest.sh" "$tmp/fakegolden.sh"
printf 'X, A1: tests failing on phase-1\n' > "$tmp/spec-red"; printf 'X, T1: a measurement\n' > "$tmp/spec-plain"
rfwt() { git -C "$rf" worktree add -q "$tmp/rfwt-${1#p1/}" "$1" 2>/dev/null; echo "$tmp/rfwt-${1#p1/}"; }
noscratch() { [[ "$(git -C "$rf" worktree list | wc -l)" -eq "$(( $(ls -d "$tmp"/rfwt-* 2>/dev/null | wc -l) + 1 ))" ]] || fail "A36: $1: a scratch worktree is left"; }
export PASCALINE_REDFIRST_VITEST="$tmp/fakevitest.sh" PASCALINE_REDFIRST_GOLDEN="$tmp/fakegolden.sh"
w="$(rfwt p1/pass)"; out="$(red_first "$w" "$tmp/spec-red" "$tmp/eng" "$tmp/rf.log")" && fail "A36: a test passing on phase-1 passes the stage"
grep -q 'every new test passes on phase-1' <<<"$out" || fail "A36: no reason for a passing test: $out"; noscratch passing
red_first "$w" "$tmp/spec-plain" "$tmp/eng" "$tmp/rf.log" >/dev/null || fail "A36: a package without the claim does not skip"; noscratch plain
w="$(rfwt p1/fail)"; red_first "$w" "$tmp/spec-red" "$tmp/eng" "$tmp/rf.log" >/dev/null || fail "A36: a test failing on phase-1 is refused"; noscratch failing
w="$(rfwt p1/none)"; red_first "$w" "$tmp/spec-red" "$tmp/eng" "$tmp/rf.log" >/dev/null || fail "A36: a branch with no test files does not skip"; noscratch none
# a crash without failed tests is a stage error, not red
w="$(rfwt p1/crash)"; out="$(red_first "$w" "$tmp/spec-red" "$tmp/eng" "$tmp/rf.log")" && fail "A36: a vitest crash counts as red"
grep -q 'stage error' <<<"$out" || fail "A36: a vitest crash is not a stage error: $out"; noscratch crash
# golden: a case id in a stage file runs that stage (ONLY=home) and a failing id is red; g2.yaml has no stage and is skipped
w="$(rfwt p1/home)"; red_first "$w" "$tmp/spec-red" "$tmp/eng" "$tmp/rf.log" >/dev/null || fail "A36: a golden case failing on phase-1 is refused"; noscratch golden-red
out="$(GOLDEN_PASSES=1 red_first "$w" "$tmp/spec-red" "$tmp/eng" "$tmp/rf.log")" && fail "A36: a golden case passing on phase-1 passes the stage"
out="$(GOLDEN_OTHER=1 red_first "$w" "$tmp/spec-red" "$tmp/eng" "$tmp/rf.log")" && fail "A36: another case failing while the new one passes counts as red"
grep -q 'every new test passes on phase-1' <<<"$out" || fail "A36: no reason when only another golden case fails: $out"
grep -q 'ONLY=home' "$tmp/golden-ran" || fail "A36: the golden stage run is not ONLY=home"; noscratch golden-green
rm -f "$tmp/golden-ran"; w="$(rfwt p1/g2)"; red_first "$w" "$tmp/spec-red" "$tmp/eng" "$tmp/rf.log" >/dev/null || fail "A36: a g2.yaml case does not skip"
[[ ! -e "$tmp/golden-ran" ]] || fail "A36: g2.yaml ran a golden stage"; noscratch g2
unset PASCALINE_REDFIRST_VITEST PASCALINE_REDFIRST_GOLDEN
red_first_wanted "$tmp/spec-red" && ! red_first_wanted "$tmp/spec-plain" || fail "A36: red_first_wanted"
# want_checks: redfirst only when the spec says so (the real function, extracted)
eval "$(sed -n '/^want_checks() {/,/^}/p' "$here/pipeline.sh")"
changed() { echo docs/x.md; }; checks=auto
spec_file="$tmp/spec-red"; [[ ",$(want_checks)," == *,redfirst,* ]] || fail "A36: want_checks lacks redfirst for a package that says so"
spec_file="$tmp/spec-plain"; [[ ",$(want_checks)," != *,redfirst,* ]] || fail "A36: want_checks has redfirst without the claim"
# the whole run: a sandbox with a worker that adds a passing test; the failure line reaches fail-<round>.txt
sb4="$tmp/sb4"; mkdir -p "$sb4/bin" "$sb4/tools" "$sb4/docs/shifts" "$sb4/app/node_modules/x"; git init -q -b main "$sb4"
cp "$sb/tools/devlock.sh" "$sb4/tools/"; cp "$sb/bin/npm" "$sb4/bin/"; : > "$sb4/docs/shifts/brief.md"; echo t > "$sb4/app/keep"
printf '#!/bin/sh\ncase "$*" in *"--agent sofia"*) echo APPROVED;; *) echo PASSES > app/n.test.ts; git add -A; git -c user.name=t -c user.email=t@t commit -qm work; echo done;; esac\n' > "$sb4/bin/claude"; chmod +x "$sb4/bin/claude"
git -C "$sb4" add -A; gc "$sb4" init; git -C "$sb4" branch phase-1
out="$(cd "$sb4" && PATH="$sb4/bin:$PATH" GIAC_OUT="$sb4/engine" PASCALINE_REDFIRST_VITEST="$tmp/fakevitest.sh" "$script" ron "package A9: tests fail on phase-1" --id T9 --branch p1/t9 --checks redfirst 2>&1)"
grep -q 'NOT MERGED' <<<"$out" || fail "A36: a passing new test does not fail the run: $out"
grep -qs 'checks failed: red-first (every new test passes on phase-1)' "$sb4"/.tasks/*/fail-1.txt || fail "A36: fail-1.txt lacks the red-first line"

# A38: a resumed branch behind phase-1 gets phase-1 merged in before the worker starts; a conflict goes to the resolve round; a branch that has it is left alone
sb6="$tmp/sb6"; mkdir -p "$sb6/bin" "$sb6/tools" "$sb6/docs/shifts" "$sb6/app/node_modules/x"; git init -q -b main "$sb6"
cp "$sb/tools/devlock.sh" "$sb6/tools/"; cp "$sb/bin/npm" "$sb6/bin/"; : > "$sb6/docs/shifts/brief.md"; echo t > "$sb6/app/keep"; echo base > "$sb6/conf.txt"
cat > "$sb6/bin/claude" <<'STUB'
#!/bin/sh
case "$*" in
  *"--agent sofia"*) echo APPROVED;;
  *"merge of phase-1 is in progress"*) [ -z "$SB_NORESOLVE" ] || { echo unresolved; exit 0; }; echo resolved > conf.txt; git add conf.txt; git -c user.name=t -c user.email=t@t commit -qm resolve; echo resolved;;
  *) echo "worker saw $(git log --oneline | wc -l) commits, p1.txt=$(cat p1.txt 2>/dev/null)" > seen.txt; echo w >> w.txt; git add -A; git -c user.name=t -c user.email=t@t commit -qm work; echo done;;
esac
STUB
chmod +x "$sb6/bin/claude"; git -C "$sb6" add -A; gc "$sb6" init; git -C "$sb6" branch phase-1
sb6run() { (cd "$sb6" && PATH="$sb6/bin:$PATH" GIAC_OUT="$sb6/engine" "$@"); }
sb6run "$script" ron "x" --id P0 --branch p1/p0 --checks none --no-merge >/dev/null 2>&1   # creates the phase-1 worktree
p1wt="$sb6/.claude/worktrees/phase-1"
git -C "$sb6" branch p1/behind phase-1; git -C "$sb6" branch p1/conflict phase-1
echo 1 > "$p1wt/p1.txt"; git -C "$p1wt" add p1.txt; gc "$p1wt" "later merge"
git -C "$sb6" worktree add -q "$tmp/cw" p1/conflict; echo branchside > "$tmp/cw/conf.txt"; git -C "$tmp/cw" add conf.txt; gc "$tmp/cw" "branch edit"; git -C "$sb6" worktree remove --force "$tmp/cw"
echo phaseside > "$p1wt/conf.txt"; git -C "$p1wt" add conf.txt; gc "$p1wt" "phase edit"
git -C "$sb6" branch p1/uptodate2 phase-1   # after the last phase-1 commit: really up to date
out="$(sb6run "$script" ron "x" --id P1 --branch p1/behind --checks none --no-merge 2>&1)"
grep -q 'merging phase-1 into p1/behind' "$sb6/.coord/log.md" || fail "A38: a resumed branch behind phase-1: no 'merging phase-1 into' log line: $out"
git -C "$sb6" show p1/behind:seen.txt 2>/dev/null | grep -q 'p1.txt=1' || fail "A38: the worker did not start on a branch with phase-1 merged in: $out"
git -C "$sb6" merge-base --is-ancestor phase-1 p1/behind || fail "A38: the resumed branch lacks phase-1 after the run"
git -C "$sb6" merge-base --is-ancestor phase-1 p1/uptodate2 || fail "A38: fixture: p1/uptodate2 is not up to date"
out="$(sb6run "$script" ron "x" --id P2 --branch p1/uptodate2 --checks none --no-merge 2>&1)"
grep -q 'merging phase-1 into p1/uptodate2' "$sb6/.coord/log.md" && fail "A38: a branch containing phase-1 logged a merge of phase-1"
[[ "$(git -C "$sb6" log --merges --format=%s p1/uptodate2 | wc -l)" -eq 0 ]] || fail "A38: a branch containing phase-1 got a merge commit: $out"
out="$(sb6run "$script" ron "x" --id P3 --branch p1/conflict --checks none --no-merge 2>&1)"
grep -q 'conflicts with phase-1 resolved by ron' "$sb6/.coord/log.md" && [[ "$(git -C "$sb6" show p1/conflict:conf.txt)" == resolved ]] || fail "A38: a conflict on resume does not go to the resolve round: $out"

# A18: the audit sees the behaviour diff
out="$("$script" ron "$ron_pkg" --dry-run 2>&1)"
grep -q '## Behaviour changes' <<<"$out" || fail "A18: the dry run does not show the Behaviour changes section"
printf '%s\n' app/src/engine/x.ts | behaviour_selected || fail "A18: an engine diff does not select the behaviour diff"
printf '%s\n' app/src/ui/x.ts docs/a.md | behaviour_selected && fail "A18: a UI diff selects the behaviour diff"
bh="$tmp/bh"; mkdir -p "$bh/a/app" "$bh/b/app"; echo 'round=old' > "$bh/a/round"; echo 'round=new' > "$bh/b/round"
cat > "$bh/tool.mjs" <<'STUB'
import { readFileSync } from "node:fs";
const [a, b] = process.argv.slice(2);
if (process.env.STUB_SLOW) await new Promise((r) => setTimeout(r, 5000));
const x = readFileSync(a + "/round", "utf8"), y = readFileSync(b + "/round", "utf8");
console.log(x === y ? "none" : "| where | input | A | B |\n| Home | round(2.5) | 2 | 3 |\n1 difference(s)");
STUB
PASCALINE_BEHAVIOUR_TOOL="$bh/tool.mjs" behaviour_section "$bh/a" "$bh/b" "$bh/o1.md"
grep -q '^## Behaviour changes' "$bh/o1.md" && grep -q 'round(2.5)' "$bh/o1.md" || fail "A18: a branch that changes round is not listed: $(cat "$bh/o1.md")"
cp "$bh/a/round" "$bh/b/round"; PASCALINE_BEHAVIOUR_TOOL="$bh/tool.mjs" behaviour_section "$bh/a" "$bh/b" "$bh/o2.md"
grep -qx 'none' "$bh/o2.md" || fail "A18: no change does not print none"
STUB_SLOW=1 PASCALINE_BEHAVIOUR_SECONDS=1 PASCALINE_BEHAVIOUR_TOOL="$bh/tool.mjs" behaviour_section "$bh/a" "$bh/b" "$bh/o3.md"
grep -q 'timed out after 20 min' "$bh/o3.md" || fail "A18: a timeout is not reported: $(cat "$bh/o3.md")"
grep -q 'behaviour_section "$integ" "$wt"' "$here/pipeline.sh" || fail "A18: pipeline.sh does not run the stage"

# A47a: jobs apart. A sandbox with the real devlock, a managed engine (a stub build-wasm.sh that counts its builds) and a stub
# worker that commits the PW_PORT and GIAC_OUT it was given.
ja="$tmp/ja"; mkdir -p "$ja/bin" "$ja/tools" "$ja/docs/shifts" "$ja/app" "$ja/engine/giac/patches"; git init -q -b main "$ja"
cp "$here/../tools/devlock.sh" "$ja/tools/"; : > "$ja/docs/shifts/brief.md"; echo t > "$ja/app/keep"
printf '#!/bin/sh\necho b >> "%s/ja-builds"; sleep 2; mkdir -p "$GIAC_BUILD_OUT/gsl" && echo wasm > "$GIAC_BUILD_OUT/gsl/giac.wasm"\n' "$tmp" > "$ja/engine/giac/build-wasm.sh"
printf '#!/bin/sh\n[ "$1" = ci ] && mkdir -p node_modules/x\nexit 0\n' > "$ja/bin/npm"
cat > "$ja/bin/claude" <<'STUB'
#!/bin/sh
case "$*" in
  *"Opus pass "*) sleep 1; echo "OPUS PASS port=$PW_PORT";;
  *"--agent sofia"*) echo APPROVED;;
  *) if [ -n "$JA_HOLD" ]; then i=0; while [ ! -e "$JA_HOLD" ] && [ $i -lt 100 ]; do sleep 0.2; i=$((i + 1)); done; fi
     echo "$PW_PORT" > port.txt; echo "$GIAC_OUT" > giac.txt; git add -A; git -c user.name=t -c user.email=t@t commit -qm "work $$"; echo done;;
esac
STUB
chmod +x "$ja/bin/"* "$ja/engine/giac/build-wasm.sh"; git -C "$ja" add -A; gc "$ja" init; git -C "$ja" branch phase-1
git -C "$ja" worktree add -q "$ja/.claude/worktrees/phase-1" phase-1
jarun() { (cd "$ja" && unset GIAC_OUT PASCALINE_COORD PW_PORT PASCALINE_LOCK_PID && PATH="$ja/bin:$PATH" "$@"); }
# two runs started at once: different numbers, run dirs and ports; phase-1's engine built once; GIAC_OUT a key-<k> directory
jarun "$script" ron "sandbox task" --id J1 --branch p1/j1 --checks typecheck --no-merge > "$tmp/j1.out" 2>&1 & j1=$!
jarun "$script" ron "sandbox task" --id J2 --branch p1/j2 --checks typecheck --no-merge > "$tmp/j2.out" 2>&1 & j2=$!
wait "$j1" "$j2"
r1="$(grep -oE '^RESULT #[0-9]+ J1: APPROVED' "$tmp/j1.out")"; r2="$(grep -oE '^RESULT #[0-9]+ J2: APPROVED' "$tmp/j2.out")"
[[ -n "$r1" && -n "$r2" && "${r1%% J1*}" != "${r2%% J2*}" ]] || fail "A47a: two runs started at once: $(cat "$tmp/j1.out" "$tmp/j2.out")"
[[ "$(ls -d "$ja"/.tasks/[0-9][0-9][0-9]-j[12] 2>/dev/null | wc -l)" -eq 2 ]] || fail "A47a: two runs started at once share a run dir: $(ls "$ja/.tasks")"
p1="$(git -C "$ja" show p1/j1:port.txt 2>/dev/null)"; p2="$(git -C "$ja" show p1/j2:port.txt 2>/dev/null)"
[[ -n "$p1" && -n "$p2" && "$p1" != "$p2" ]] || fail "A47a: two runs started at once share a port ($p1, $p2)"
[[ "$(wc -l < "$tmp/ja-builds" 2>/dev/null)" -eq 1 ]] || fail "A47a: one engine key built $(wc -l < "$tmp/ja-builds" 2>/dev/null) times by two runs"
for b in p1/j1 p1/j2; do
  git -C "$ja" show "$b:giac.txt" 2>/dev/null | grep -qE '/engine/giac/_out/key-[0-9a-f]{16}$' || fail "A47a: the GIAC_OUT of $b is not a key-<k> directory: $(git -C "$ja" show "$b:giac.txt" 2>&1)"
done
no1="${r1#RESULT #}"; no1="${no1%% *}"; [[ -f "$ja/.tasks/$(printf '%03d' "$no1")-j1/pid" ]] || fail "A47a: the run dir has no pid file"
# two passes started at once: different pass numbers and ports
jarun "$script" pass 3 "X1" none > "$tmp/ps1.out" 2>&1 & q1=$!
jarun "$script" pass 3 "X2" none > "$tmp/ps2.out" 2>&1 & q2=$!
wait "$q1" "$q2"
pn="$(cat "$tmp/ps1.out" "$tmp/ps2.out" | grep -oE '^RESULT pass [0-9]+' | sort -u | wc -l)"; pp="$(cat "$tmp/ps1.out" "$tmp/ps2.out" | grep -oE 'port=[0-9]+' | sort -u | wc -l)"
[[ "$pn" -eq 2 && "$pp" -eq 2 ]] || fail "A47a: two passes started at once share a pass number or a port: $(cat "$tmp/ps1.out" "$tmp/ps2.out")"
grep -q 'RESULT pass 3: ' "$tmp/ps1.out" "$tmp/ps2.out" && grep -q 'RESULT pass 4: ' "$tmp/ps1.out" "$tmp/ps2.out" || fail "A47a: pass 3 twice does not give passes 3 and 4"
grep -q 'pass number 3 is taken; this pass is 4' "$ja/.coord/log.md" || fail "A47a: the moved pass number is not logged"
# a second run on a branch whose run is alive ends at once with a RESULT line
export JA_HOLD="$tmp/ja-hold"
jarun "$script" ron "sandbox task" --id J3 --branch p1/j3 --checks none --no-merge > "$tmp/j3.out" 2>&1 & j3=$!
for _ in $(seq 1 100); do git -C "$ja" show-ref --verify --quiet refs/heads/p1/j3 && break; sleep 0.1; done
t0=$SECONDS; out="$(jarun timeout -k 5 15 "$script" ron "sandbox task" --id J4 --branch p1/j3 --checks none --no-merge 2>&1)"; dt=$((SECONDS - t0))
touch "$JA_HOLD"; wait "$j3"; unset JA_HOLD
grep -q '^RESULT .*branch p1/j3 is in use by another run' <<<"$out" && [[ $dt -lt 10 ]] || fail "A47a: a second run on a live run's branch: ${dt} s: $out"
[[ "$(git -C "$ja" log --oneline phase-1..p1/j3 | wc -l)" -eq 1 ]] || fail "A47a: two workers committed on one branch"
grep -q '^RESULT #[0-9]* J3: APPROVED' "$tmp/j3.out" || fail "A47a: the first run on the branch did not finish: $(cat "$tmp/j3.out")"
# a host-cpu wait is logged once with its holder, and its length; every wait of the pipeline is 7200 s
(cd "$ja" && unset PASCALINE_COORD PASCALINE_LOCK_PID && mkdir -p .coord/locks/host-cpu && echo holder-x > .coord/locks/host-cpu/owner \
  && coord="$ja/.coord" && log() { echo "$*" >> "$tmp/ja-cpu.log"; } && PASCALINE_CPU_WAIT=1 host_cpu_acquire me "pre:") && fail "A47a: a busy host-cpu was taken"
rm -rf "$ja/.coord/locks/host-cpu"
[[ "$(grep -c '^pre: waiting for host-cpu (holder-x)$' "$tmp/ja-cpu.log" 2>/dev/null)" -eq 1 ]] && grep -q '^pre: host-cpu still busy after a wait of [0-9]* s$' "$tmp/ja-cpu.log" || fail "A47a: the host-cpu wait is not logged once with its holder and length: $(cat "$tmp/ja-cpu.log" 2>&1)"
grep -q 'PASCALINE_CPU_WAIT:-7200' "$here/pipeline-lib.sh" || fail "A47a: the host-cpu wait is not 7200 s"
grep -qE 'acquire host-cpu [^ ]+ 1800' "$here/pipeline.sh" "$here/pipeline-lib.sh" && fail "A47a: a host-cpu wait of 1800 s is left"
# effort: high for the worker, fix rounds, audit, pass and report; henri stays medium
grep -q 'effort="high"' "$here/pipeline.sh" && grep -q 'sofia "$(resolve_audit_model)" high' "$here/pipeline.sh" && grep -q 'agent sofia --model opus --effort high' "$here/pipeline.sh" && grep -q 'model sonnet --effort high "${claude_common\[@\]}" -n report' "$here/pipeline.sh" || fail "A47a: an effort is not high"
grep -q 'agent henri --model sonnet --effort medium' "$here/night.sh" || fail "A47a: henri is not medium"
# selftest: PASSED on real tests (the pipeline test itself is left out: it would run itself), FAILED with the first failing line
printf '#!/bin/sh\necho ok\n' > "$tmp/st-ok.sh"; printf '#!/bin/sh\necho noise\necho "FAIL: stub broke"\nexit 1\n' > "$tmp/st-bad.sh"; chmod +x "$tmp/st-ok.sh" "$tmp/st-bad.sh"
out="$(jarun env PASCALINE_SELFTEST_TESTS="$here/gc.test.sh $here/../tools/devlock.test.sh $tmp/st-ok.sh" "$script" selftest --audit-model auto 2>&1)"; rc=$?
[[ $rc -eq 0 ]] && grep -qx 'RESULT selftest: PASSED' <<<"$out" || fail "A47a: selftest on passing tests: rc $rc: $out"
out="$(jarun env PASCALINE_SELFTEST_TESTS="$tmp/st-ok.sh $tmp/st-bad.sh" "$script" selftest --audit-model auto 2>&1)"; rc=$?
[[ $rc -ne 0 ]] && grep -qx 'RESULT selftest: FAILED (st-bad.sh: FAIL: stub broke)' <<<"$out" || fail "A47a: selftest on a failing stub: rc $rc: $out"
grep -q 'pipeline selftest: FAILED (st-bad.sh: FAIL: stub broke)' "$ja/.coord/log.md" || fail "A47a: selftest is not logged"
# the check shell joins the auto checks for scripts/ and tools/*.sh
printf '%s\n' scripts/gc.sh | shell_selected && printf '%s\n' tools/devlock.sh | shell_selected || fail "A47a: a script diff does not select the shell check"
printf '%s\n' tools/find-index/x.mjs app/src/a.ts docs/x.md | shell_selected && fail "A47a: an unrelated diff selects the shell check"
eval "$(sed -n '/^want_checks() {/,/^}/p' "$here/pipeline.sh")"
changed() { echo scripts/gc.sh; }; checks=auto; spec_file="$tmp/spec-plain"
[[ ",$(want_checks)," == *,shell,* ]] || fail "A47a: want_checks lacks shell for a scripts/ diff"
changed() { echo docs/x.md; }; [[ ",$(want_checks)," != *,shell,* ]] || fail "A47a: want_checks has shell for a docs diff"
grep -qF '[[ "$name" != shell ]] && machine_failure "$out"' "$here/pipeline.sh" || fail "A47a: a shell check quoting 'command not found' counts as a machine failure"

# A47b: the merge queue. A sandbox with the real devlock and stub agents that write who holds integ (or "free") where it matters.
mq="$tmp/mq"; mkdir -p "$mq/bin" "$mq/tools" "$mq/docs/shifts/packages" "$mq/app"; git init -q -b main "$mq"
cp "$here/../tools/devlock.sh" "$mq/tools/"; : > "$mq/docs/shifts/brief.md"; echo t > "$mq/app/keep"; echo t > "$mq/tracked"
printf '### annabell, Z1: a package, branch `p1/z1`\n' > "$mq/docs/shifts/packages/Z1.md"
echo node_modules/ > "$mq/.gitignore"  # the stub workers commit with git add -A
cat > "$mq/bin/owner" <<STUB
#!/bin/sh
cat "$mq/.coord/locks/integ/owner" 2>/dev/null || echo free
STUB
cat > "$mq/bin/npm" <<STUB
#!/bin/sh
case "\$*" in
  ci*) owner >> "$mq/npmci-owner"; mkdir -p node_modules/x; node "$mq/fake-ci.js";;
  *typecheck*) echo "\$(git rev-parse --abbrev-ref HEAD) merges=\$(git log --merges --oneline phase-1 | wc -l) integ=\$(owner) newdep=\$(test -f node_modules/newdep/package.json && echo yes || echo no)" >> "$mq/checks";;
esac
exit 0
STUB
cat > "$mq/bin/claude" <<STUB
#!/bin/sh
br=\$(git rev-parse --abbrev-ref HEAD 2>/dev/null | tr / -)
case "\$*" in
  *"Opus pass "*) owner > "$mq/pass-start"; sleep 1; owner > "$mq/pass-end"; echo "OPUS PASS";;
  *"Write the shift report"*) owner > "$mq/report-owner"; echo abc1234;;
  *"--agent sofia"*) echo "\$br \$(owner)" >> "$mq/audits"; sleep 2
     if [ -n "\$MQ_FIX" ] && [ "\$br" = "\$MQ_FIX" ] && [ ! -e "$mq/fixed-\$br" ]; then touch "$mq/fixed-\$br"; echo FIX; echo "a.txt:1: say more"; else echo APPROVED; fi;;
  *"fix round"*) echo "\$br \$(owner)" >> "$mq/fixes"; echo more >> "\$br.txt"; git add -A; git -c user.name=t -c user.email=t@t commit -qm fix; echo fixed;;
  *) if [ -n "\$MQ_HOLD" ]; then touch "\$MQ_HOLD.started"; i=0; while [ ! -e "\$MQ_HOLD" ] && [ \$i -lt 150 ]; do sleep 0.2; i=\$((i + 1)); done; fi
     echo w > "\$br.txt"; git add -A; git -c user.name=t -c user.email=t@t commit -qm "work \$br"; echo done;;
esac
STUB
cat > "$mq/fake-ci.js" <<'STUB'
// npm ci, faked: every package of package-lock.json into node_modules, and the hidden lock node_modules_stale reads
const fs = require("fs");
let lock; try { lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8")); } catch { process.exit(0); }
for (const [k, v] of Object.entries(lock.packages || {})) {
  if (!k.startsWith("node_modules/")) continue;
  fs.mkdirSync(k, { recursive: true }); fs.writeFileSync(k + "/package.json", JSON.stringify({ version: v.version }));
}
fs.writeFileSync("node_modules/.package-lock.json", JSON.stringify(lock));
STUB
chmod +x "$mq/bin/"*; git -C "$mq" add -A; gc "$mq" init; git -C "$mq" branch phase-1
git -C "$mq" worktree add -q "$mq/.claude/worktrees/phase-1" phase-1; p1q="$mq/.claude/worktrees/phase-1"
mqrun() { (cd "$mq" && unset PASCALINE_COORD PW_PORT PASCALINE_LOCK_PID && PATH="$mq/bin:$PATH" GIAC_OUT="$mq/engine" "$@"); }
# the package is read from phase-1's commit: a changed package file in the phase-1 worktree is not what the run reads
sed -i 's/p1\/z1/p1\/zz/' "$p1q/docs/shifts/packages/Z1.md"
out="$(mqrun "$script" annabell Z1 --dry-run 2>&1)"; rc=$?
[[ $rc -eq 0 ]] && grep -q 'branch p1/z1' <<<"$out" || fail "A47b: the package is not read from phase-1's commit (dirty worktree): rc $rc: $(head -n 3 <<<"$out")"
git -C "$p1q" checkout -q docs/shifts/packages/Z1.md
# two runs whose workers finish together: the second's checks start after the first's merge; each merge's tree is its audited tree
export MQ_HOLD="$tmp/mq-hold"
mqrun "$script" ron "queue task" --id Q1 --branch p1/q1 --checks typecheck > "$tmp/q1.out" 2>&1 & q1=$!
mqrun "$script" ron "queue task" --id Q2 --branch p1/q2 --checks typecheck > "$tmp/q2.out" 2>&1 & q2=$!
for _ in $(seq 1 100); do git -C "$mq" show-ref --verify --quiet refs/heads/p1/q1 && git -C "$mq" show-ref --verify --quiet refs/heads/p1/q2 && break; sleep 0.1; done
sleep 1; touch "$MQ_HOLD"; wait "$q1" "$q2"; unset MQ_HOLD
grep -q '^RESULT #[0-9]* Q1: MERGED' "$tmp/q1.out" && grep -q '^RESULT #[0-9]* Q2: MERGED' "$tmp/q2.out" || fail "A47b: two queued runs did not both merge: $(cat "$tmp/q1.out" "$tmp/q2.out")"
[[ "$(sed -n 's/^[^ ]* merges=\([0-9]*\).*/\1/p' "$mq/checks" | tr '\n' ' ')" == "0 1 " ]] || fail "A47b: the second run's checks did not start after the first merge: $(cat "$mq/checks")"
grep -q 'integ=free' "$mq/checks" && fail "A47b: checks ran without the integ lock: $(cat "$mq/checks")"
[[ -n "$(cat "$mq/npmci-owner" 2>/dev/null)" ]] && ! grep -q free "$mq/npmci-owner" || fail "A47b: npm ci in the phase-1 worktree ran without integ: $(cat "$mq/npmci-owner" 2>&1)"
for m in $(git -C "$mq" rev-list --merges --first-parent phase-1); do
  [[ -z "$(git -C "$mq" diff "$m^2" "$m")" ]] || fail "A47b: merge ${m:0:9} differs from its audited commit: $(git -C "$mq" diff --stat "$m^2" "$m")"
done
grep -q 'free' "$mq/audits" && fail "A47b: an audit ran without integ: $(cat "$mq/audits")"
# a FIX releases integ; the fix round runs outside it; the run queues again and merges
: > "$mq/audits"
out="$(MQ_FIX=p1-q3 mqrun "$script" ron "queue task" --id Q3 --branch p1/q3 --checks typecheck 2>&1)"
grep -q '^RESULT #[0-9]* Q3: MERGED' <<<"$out" || fail "A47b: a run with one FIX did not merge: $out"
[[ "$(cat "$mq/fixes" 2>/dev/null)" == "p1-q3 free" ]] || fail "A47b: the fix round ran under integ: $(cat "$mq/fixes" 2>&1)"
[[ "$(grep -c '^p1-q3 pipeline-' "$mq/audits")" -eq 2 ]] || fail "A47b: the run did not queue again for its second audit: $(cat "$mq/audits")"
[[ "$(grep -c 'pipeline #[0-9]* Q3: in the queue' "$mq/.coord/log.md")" -eq 2 ]] || fail "A47b: the two queue entries are not logged: $(grep Q3 "$mq/.coord/log.md")"
# a start with a dirty phase-1 worktree (an interactive session holds integ) waits for integ, then merges
(cd "$mq" && unset PASCALINE_LOCK_PID && tools/devlock.sh acquire integ owner-x 0 >/dev/null)
echo edit >> "$p1q/tracked"
mqrun "$script" ron "queue task" --id Q4 --branch p1/q4 --checks typecheck > "$tmp/q4.out" 2>&1 & q4=$!
for _ in $(seq 1 150); do grep -q 'Q4: waiting for integ (owner-x)' "$mq/.coord/log.md" 2>/dev/null && break; sleep 0.2; done
grep -q 'Q4: waiting for integ (owner-x)' "$mq/.coord/log.md" || fail "A47b: a start with a dirty phase-1 worktree does not wait for integ: $(cat "$tmp/q4.out")"
git -C "$p1q" checkout -q tracked; (cd "$mq" && tools/devlock.sh release integ owner-x >/dev/null)
wait "$q4"
grep -q '^RESULT #[0-9]* Q4: MERGED' "$tmp/q4.out" || fail "A47b: the run that waited for integ did not merge: $(cat "$tmp/q4.out")"
grep -q 'Q4: integ taken after a wait of [0-9]* s' "$mq/.coord/log.md" || fail "A47b: the integ wait's length is not logged"
# phase-1 gains a dependency (a lock entry) while the worker runs: after the queue merges phase-1 in, the checks see the new module
export MQ_HOLD="$tmp/mq-hold5"
mqrun "$script" ron "queue task" --id Q5 --branch p1/q5 --checks typecheck > "$tmp/q5.out" 2>&1 & q5=$!
for _ in $(seq 1 100); do [[ -e "$MQ_HOLD.started" ]] && break; sleep 0.1; done  # the worker runs: its node_modules are copied
printf '{"packages":{"":{},"node_modules/newdep":{"version":"1.0.0"}}}' > "$p1q/app/package-lock.json"
git -C "$p1q" add app/package-lock.json; git -C "$p1q" -c user.name=t -c user.email=t@t commit -qm "dep: newdep"
touch "$MQ_HOLD"; wait "$q5"; unset MQ_HOLD
grep -q '^RESULT #[0-9]* Q5: MERGED' "$tmp/q5.out" || fail "A47b: the run after phase-1 gained a dependency did not merge: $(cat "$tmp/q5.out")"
grep -q '^p1/q5 .* newdep=yes$' "$mq/checks" || fail "A47b: the checks ran on node_modules without phase-1's new dependency: $(grep '^p1/q5 ' "$mq/checks")"
# a pass holds integ from its start to its end and releases it; its prompt no longer takes the lock; so does the report
out="$(mqrun "$script" pass 5 "Q1" none 2>&1)"
[[ "$(cat "$mq/pass-start" 2>/dev/null)" == pass-5 && "$(cat "$mq/pass-end" 2>/dev/null)" == pass-5 ]] || fail "A47b: the pass does not hold integ from start to end: $(cat "$mq/pass-start" "$mq/pass-end" 2>&1)"
[[ ! -e "$mq/.coord/locks/integ" ]] || fail "A47b: the pass left integ held: $(cat "$mq/.coord/locks/integ/owner")"
grep -q 'acquire integ' <<<"$(sed -n '/subcommand: pass/,/subcommand: device/p' "$here/pipeline.sh" | grep 'prompt=')" && fail "A47b: the pass prompt still takes integ"
out="$(mqrun "$script" report 2>&1)"
[[ "$(cat "$mq/report-owner" 2>/dev/null)" == report ]] && [[ ! -e "$mq/.coord/locks/integ" ]] || fail "A47b: the report does not hold integ for its run: $(cat "$mq/report-owner" 2>&1): $out"
grep -q 'acquire integ' <<<"$(sed -n '/subcommand: report/,/subcommand: selftest/p' "$here/pipeline.sh" | grep 'prompt=')" && fail "A47b: the report prompt still takes integ"
# the device step holds integ while it builds the APK and releases it before the device run
cat > "$mq/bin/adb" <<'STUB'
#!/bin/sh
case "$*" in *get-state*) echo device;; *"dumpsys battery"*) echo "  level: 80";; *"dumpsys window"*) echo "  isKeyguardShowing=false";; esac
exit 0
STUB
printf '#!/bin/sh\nowner > "%s/build-owner"; mkdir -p dist; echo apk > dist/pascaline.apk\n' "$mq" > "$p1q/tools/device-build.sh"
printf '#!/bin/sh\nowner > "%s/core-owner"; echo "CORE DEVICE 3/3 (known 0, needs 0)"\n' "$mq" > "$p1q/tools/core-device.sh"
chmod +x "$mq/bin/adb" "$p1q/tools/device-build.sh" "$p1q/tools/core-device.sh"
out="$(mqrun env ANDROID_SERIAL=TESTSERIAL "$script" device 6 2>&1)"
[[ "$(cat "$mq/build-owner" 2>/dev/null)" == device-6 && "$(cat "$mq/core-owner" 2>/dev/null)" == free ]] || fail "A47b: the device step does not hold integ for the build only: build $(cat "$mq/build-owner" 2>&1), core $(cat "$mq/core-owner" 2>&1): $out"
# A47bf1: a start copies the phase-1 node_modules under nodemods only; a stale one takes integ, then nodemods, then host-cpu (npm ci);
# an npm ci of the phase-1 worktree (the queue's, the device build's) and a copy never overlap
node_modules_stale "$p1q/app" && fail "A47bf1: precondition: the phase-1 node_modules are stale after Q5"
(cd "$mq" && unset PASCALINE_LOCK_PID && tools/devlock.sh acquire integ owner-y 0 >/dev/null)
out="$(mqrun env PASCALINE_INTEG_WAIT=2 "$script" ron "queue task" --id N1 --branch p1/n1 --checks typecheck 2>&1)"
git -C "$mq" log p1/n1 --format=%s 2>/dev/null | grep -q '^work p1-n1$' || fail "A47bf1: a start with fresh phase-1 node_modules does not start its worker while integ is held: $out"
[[ -f "$mq/.claude/worktrees/pl-$(sed -n 's/^RESULT #\([0-9]*\) .*/\1/p' <<<"$out" | xargs printf '%03d')-n1/app/node_modules/newdep/package.json" ]] || fail "A47bf1: the fresh start did not copy phase-1's node_modules: $out"
grep -q 'N1: waiting for integ (owner-y)' "$mq/.coord/log.md" && ! grep -q 'NOT MERGED (integ lock busy for 7200 s (node_modules))' <<<"$out" || fail "A47bf1: the fresh start did not reach the queue: $out"
(cd "$mq" && tools/devlock.sh release integ owner-y >/dev/null)
grep -q 'N1: waiting for nodemods' "$mq/.coord/log.md" && fail "A47bf1: a free nodemods lock was waited for"
# nodemods held by another: a fresh start waits for it (logged) and copies nothing meanwhile
(cd "$mq" && unset PASCALINE_LOCK_PID && tools/devlock.sh acquire nodemods owner-z 0 >/dev/null)
out="$(mqrun env PASCALINE_NODEMODS_WAIT=2 "$script" ron "queue task" --id N2 --branch p1/n2 --checks typecheck 2>&1)"
git -C "$mq" log --all --format=%s | grep -q "^work p1-n2$" && fail "A47bf1: a start copied node_modules while another held nodemods: $out"
grep -q 'N2: waiting for nodemods (owner-z)' "$mq/.coord/log.md" && grep -q 'nodemods lock busy' <<<"$out" || fail "A47bf1: the nodemods wait is not logged or not named: $out"
(cd "$mq" && tools/devlock.sh release nodemods owner-z >/dev/null)
# the device step's build (build.sh runs npm ci in the phase-1 worktree) and a start's copy: one after the other
ev="$tmp/nm-events"; : > "$ev"; realcp="$(command -v cp)"
printf '#!/bin/sh\ncat "%s/.coord/locks/nodemods/owner" > "%s/build-nodemods" 2>/dev/null || echo free > "%s/build-nodemods"\necho ci-start >> "%s"; sleep 3; echo ci-end >> "%s"\nmkdir -p dist; echo apk > dist/pascaline.apk\n' "$mq" "$mq" "$mq" "$ev" "$ev" > "$p1q/tools/device-build.sh"
printf '#!/bin/sh\n[ "$1" = -al ] || exec "%s" "$@"\necho copy-start >> "%s"; "%s" "$@"; rc=$?; echo copy-end >> "%s"; exit $rc\n' "$realcp" "$ev" "$realcp" "$ev" > "$mq/bin/cp"; chmod +x "$mq/bin/cp"
mqrun env ANDROID_SERIAL=TESTSERIAL "$script" device 7 > "$tmp/d7.out" 2>&1 & d7=$!
for _ in $(seq 1 150); do grep -q ci-start "$ev" && break; sleep 0.2; done
mqrun "$script" ron "queue task" --id N3 --branch p1/n3 --checks typecheck > "$tmp/n3.out" 2>&1
wait "$d7"; rm -f "$mq/bin/cp"
[[ "$(paste -sd' ' "$ev")" == "ci-start ci-end copy-start copy-end" ]] || fail "A47bf1: the device build's npm ci and a start's copy overlap: $(paste -sd' ' "$ev"): $(cat "$tmp/d7.out" "$tmp/n3.out")"
[[ "$(cat "$mq/build-nodemods" 2>/dev/null)" == device-7 ]] || fail "A47bf1: the device build runs without nodemods: $(cat "$mq/build-nodemods" 2>&1)"
grep -q '^RESULT #[0-9]* N3: MERGED' "$tmp/n3.out" || fail "A47bf1: the start that waited for the device build did not merge: $(cat "$tmp/n3.out")"
# stale phase-1 node_modules: the start waits for integ (the npm ci path), not just nodemods
rm -f "$p1q/app/node_modules/.package-lock.json"
(cd "$mq" && unset PASCALINE_LOCK_PID && tools/devlock.sh acquire integ owner-y 0 >/dev/null)
n0="$(wc -l < "$mq/npmci-owner")"
out="$(mqrun env PASCALINE_INTEG_WAIT=2 "$script" ron "queue task" --id N4 --branch p1/n4 --checks typecheck 2>&1)"
git -C "$mq" log --all --format=%s | grep -q "^work p1-n4$" && fail "A47bf1: a start with stale phase-1 node_modules started its worker without integ: $out"
grep -q 'N4: waiting for integ (owner-y)' "$mq/.coord/log.md" && grep -q 'integ lock busy' <<<"$out" || fail "A47bf1: a stale start does not wait for integ: $out"
(cd "$mq" && tools/devlock.sh release integ owner-y >/dev/null)
[[ "$(wc -l < "$mq/npmci-owner")" -eq "$n0" ]] || fail "A47bf1: npm ci ran in the phase-1 worktree without integ"
# stale, integ free, nodemods held by a copy: the npm ci waits for nodemods; it never runs under another's copy
(cd "$mq" && unset PASCALINE_LOCK_PID && tools/devlock.sh acquire nodemods owner-z 0 >/dev/null)
out="$(mqrun env PASCALINE_NODEMODS_WAIT=2 "$script" ron "queue task" --id N5 --branch p1/n5 --checks typecheck 2>&1)"
[[ "$(wc -l < "$mq/npmci-owner")" -eq "$n0" ]] || fail "A47bf1: npm ci in the phase-1 worktree ran while another held nodemods: $out"
grep -q 'N5: waiting for nodemods (owner-z)' "$mq/.coord/log.md" && grep -q 'nodemods lock busy' <<<"$out" || fail "A47bf1: the npm ci path does not wait for nodemods: $out"
(cd "$mq" && tools/devlock.sh release nodemods owner-z >/dev/null)
[[ ! -e "$mq/.coord/locks/nodemods" && ! -e "$mq/.coord/locks/integ" ]] || fail "A47bf1: a run left nodemods or integ held"
# the copy checks for nodemods; the order is in the header and the dry run's setup line
grep -q 'copy_node_modules without the nodemods lock' "$here/pipeline.sh" || fail "A47bf1: copy_node_modules does not check for nodemods"
grep -q '^# Lock order: integ, then nodemods, then host-cpu' "$here/pipeline.sh" || fail "A47bf1: the header does not state the lock order integ, nodemods, host-cpu"
grep -q '^setup: .*under nodemods.*integ, then nodemods, then host-cpu' <<<"$("$script" ron "$ron_pkg" --dry-run 2>&1)" || fail "A47bf1: the dry run's setup line does not state the nodemods lock and the order"
# the lock order is stated in the header; the serial time (queue entry to release) of each run is logged
grep -oE 'Q[1-4]: integ released after [0-9]+ s in the queue' "$mq/.coord/log.md" > "$tmp/serial" || true
[[ "$(wc -l < "$tmp/serial")" -eq 5 ]] || fail "A47b: not every queue entry logs its serial time: $(cat "$tmp/serial")"
echo "A47b serial times: $(sed 's/: integ released after / /; s/ s in the queue/ s/' "$tmp/serial" | paste -sd, - | sed 's/,/, /g')"

[[ $fails -eq 0 ]] || { echo "pipeline.test.sh: $fails failure(s) in $count packages" >&2; exit 1; }
echo "pipeline.test.sh: ok ($count packages)"
