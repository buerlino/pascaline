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
grep -qE '^GIAC_OUT=.*/engine/giac/_out/gsl ' <<<"$out" || fail "A28: an unchanged key does not keep the shared engine: $out"
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
git -C "$sb6" branch p1/behind phase-1; git -C "$sb6" branch p1/uptodate phase-1; git -C "$sb6" branch p1/conflict phase-1
echo 1 > "$p1wt/p1.txt"; git -C "$p1wt" add p1.txt; gc "$p1wt" "later merge"
git -C "$sb6" branch p1/uptodate2 phase-1
echo phaseside > "$p1wt/conf.txt"; git -C "$p1wt" add conf.txt; gc "$p1wt" "phase edit"
out="$(sb6run "$script" ron "x" --id P1 --branch p1/behind --checks none --no-merge 2>&1)"
grep -q 'merging phase-1 into p1/behind' "$sb6/.coord/log.md" || fail "A38: a resumed branch behind phase-1: no 'merging phase-1 into' log line: $out"
git -C "$sb6" show p1/behind:seen.txt 2>/dev/null | grep -q 'p1.txt=1' || fail "A38: the worker did not start on a branch with phase-1 merged in: $out"
git -C "$sb6" merge-base --is-ancestor phase-1 p1/behind || fail "A38: the resumed branch lacks phase-1 after the run"
out="$(sb6run "$script" ron "x" --id P2 --branch p1/uptodate2 --checks none --no-merge 2>&1)"
[[ "$(git -C "$sb6" log --merges --format=%s p1/uptodate2 | wc -l)" -eq 0 ]] || fail "A38: a branch containing phase-1 got a merge commit: $out"
out="$(sb6run "$script" ron "x" --id P3 --branch p1/conflict --checks none --no-merge 2>&1)"
grep -q 'conflicts with phase-1 resolved by ron' "$sb6/.coord/log.md" && [[ "$(git -C "$sb6" show p1/conflict:conf.txt)" == resolved ]] || fail "A38: a conflict on resume does not go to the resolve round: $out"

[[ $fails -eq 0 ]] || { echo "pipeline.test.sh: $fails failure(s) in $count packages" >&2; exit 1; }
echo "pipeline.test.sh: ok ($count packages)"
