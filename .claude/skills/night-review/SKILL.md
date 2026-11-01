---
name: night-review
description: Pascaline's night review, run beside the night lanes. Independent hunts (sandra), each checked by its own verifier (sofia); work packages argued by an author and a reviewer until AGREED; everything written uncommitted into a review worktree; a morning summary and the owner's questions. `/night-review --dry-run` prints the computed values and the hunt list and starts nothing.
argument-hint: "[--dry-run] [--until HH:MM]"
disable-model-invocation: true
---
<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# /night-review: the night review

Arguments: `$ARGUMENTS` (if this still reads as a placeholder, take them from the prompt that started you).
- `--dry-run`: step 0a only. Print its values and the hunt list, then stop: nothing written, nothing started.
- `--until HH:MM`: the end of the run's window. Default: the end (`--until`) of the night lanes that are running.

You are the **coordinator**, Opus at effort high. Carry out steps 0 to 7 in order without asking: the owner is asleep and nobody answers before the morning. Where this skill doesn't settle something, choose the safer option, write it in `$RUN/decisions-made.md` and go on. Step 8 is with the owner.

**What the owner gets in the morning:** findings from independent hunts, each checked by a separate verifier; from the confirmed ones, work packages that two Opus xhigh agents argued over until they agreed; those packages and the review's other findings written into the docs as uncommitted changes in a review worktree; a short summary; then the questions, one by one.

**This skill's files** (read each when its step comes): `common.md` (COMMON, the rules every agent gets, pasted into every prompt), `hunts.md` (the hunts, one block each), `prompts.md` (the hunter frame, the verifier, author and reviewer prompts, the step-8 handoff).

## The coordinator's rules
- **The lanes come first.** Nothing in this run may slow the night lanes down, block them or change what they read; COMMON says how. You take one lock (`nodemods`, step 0b) until step 8's merge. You never write `.coord/log.md` before that merge.
- **Your shell stays in the main checkout.** Never `cd`, not even in a subshell: use `git -C <dir>`, full paths, and `env -C <dir> <command>` for a tool that must run in its directory. A `cd` moves the session into another worktree.
- **The CPU guard goes in the same command** as what it guards: `$DL status | grep -q '^host-cpu:' && echo 'host-cpu held: not run' || <command>`. A status checked in one command and a probe run in the next breached it in the first run.
- **Agents:** the Agent tool, in the background, `model: "opus"`; `effort: "high"` for hunters and verifiers, `effort: "xhigh"` for the author and the reviewer (the owner asked for these). `subagent_type: "sandra"` for hunters and the author, `"sofia"` for verifiers and the reviewer; a report is never verified by the agent that wrote it. Never ron, gorge, annabell, henri or percy: they belong to the pipeline. Agents that start together go in one message. Record each agent's id in `$RUN/agents.md` (for SendMessage and TaskStop).
- **Read summaries, not reports.** Never read a hunter's or verifier's full report: read its summary (the first 30 lines) and the verdict table, and grep the rest by label (`grep -n -A12 '^### bu-3' $RUN/reports/bu.md`).
- **A timer for every deadline.** You wake only when an agent or a command finishes, so a hung agent stalls you. For each deadline below start a background Bash timer (`run_in_background: true`) on the epoch seconds in `values.sh`: `until [ "$(date +%s)" -ge <epoch> ]; do sleep 60; done; echo "DEADLINE <step>"`. Never compare `HHMM`: that breaks across midnight. On a timer's wake, stop the step's stragglers (TaskStop), record them as "not finished" and go on; ignore a timer whose step is done.
- **Log** one line per event in `$RUN/log.md`: `- HH:MM step <n>: <what>` (the time from `date`).
- **If the lanes break** (no new line in `.coord/log.md` for 60 minutes, or a `STOPPED` line), don't fix them: note it for the summary and go on. Write `pgrep` patterns as `night[.]sh` and `pipeline[.]sh`, so a loop never matches its own command line.
- **Ids:** none until step 5; step 8 checks them again before the commit (rules section 9).

## Step 0a. The run's values (the dry run ends here)
Run the block below as it stands, from the main checkout, with `<SKILL>` this skill's directory (the base directory shown when it loaded; else `.claude/skills/night-review` in the main checkout), `<HH:MM>` the `--until` argument or empty, and `WRITE=` empty for a dry run:
```
sed -n '/^# >>> step 0a$/,/^# <<< step 0a$/p' <SKILL>/SKILL.md | SKILL=<SKILL> UNTIL=<HH:MM> WRITE= bash
```
It reads only (git, the log, the pid files, `devlock.sh status`): no node, no lock, nothing written unless `WRITE=1`. What it works out:
- **Date, paths:** today's run directory `.tasks/night-review-<date>`, the review worktree `.claude/worktrees/review-<MMDD>`, the branch `p1/sandra-review-<MMDD>` and the note `docs/research/night-review-<date>`, with a suffix `-2` when one of them already exists.
- **Base:** phase-1's tip now. **Since:** the base of the last review, from the newest night-review note on phase-1 (its line "on `phase-1` `<commit>`"), else the newest `.tasks/night-review-*/base.txt`, else 7 days back; and the merges since.
- **The window:** from now to `--until`, else to the latest `--until` of the running lanes (from their pid files and their `night.sh started` log lines), else 9 hours. Each step's deadline is a fixed share of the window (step 1 27 %, 2 42 %, 3 47 %, 4 77 %, 5 90 %, 6 92.5 %, 7 at the end), as in the first run (23:04 to 09:00).
- **Exclusions:** what the lanes are building: the rows of brief section 0c's lane tables, the day's packages, the pipeline runs going now and this night's NOT MERGED.
- **Budgets:** each budgeted doc against the limits in `tools/docs-check.mjs`, and the research notes' total. **FULL** = less than 1 kB free (12 kB for the research notes); **tight** = less than 2.5 kB (20 kB).
- **Next free ids** (informative; step 5 mints): the highest number per prefix over every branch's `docs/` and `.claude/`, the log and `.tasks/**/*.md`, ignoring a top number more than 5 above the next (a test placeholder or a lint code).

```bash
# >>> step 0a
# night-review: the run's values. Reads only; WRITE=1 also creates the run directory and writes values.sh.
MAIN=$(dirname "$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)")
[ -f "$MAIN/.coord/log.md" ] || { echo "STOP: start this from the Pascaline checkout (no .coord/log.md under $MAIN)"; exit 1; }
G="git -C $MAIN"; LOG=$MAIN/.coord/log.md; STOPS=
SKILL=${SKILL:-$MAIN/.claude/skills/night-review}
P1=$($G worktree list --porcelain | awk '/^worktree /{w=substr($0,10)} $0=="branch refs/heads/phase-1"{print w}')
[ -n "$P1" ] || STOPS="$STOPS no worktree has phase-1 checked out;"
DL=$MAIN/tools/devlock.sh; [ -x "$DL" ] || DL=$P1/tools/devlock.sh
NOW=$(date +%s); DATE=$(date +%F); MMDD=$(date +%m%d)
for SFX in "" -2 -3 -4 -5; do
  RUN=$MAIN/.tasks/night-review-$DATE$SFX; REVIEW=$MAIN/.claude/worktrees/review-$MMDD$SFX; BRANCH=p1/sandra-review-$MMDD$SFX
  [ -e "$RUN" ] || [ -e "$REVIEW" ] || $G show-ref -q --verify "refs/heads/$BRANCH" || break
done
TAG=review-$MMDD$SFX; NOTE=docs/research/night-review-$DATE$SFX.md
BASE=$($G rev-parse --short=9 phase-1)
# Since: the last review's base.
LAST_NOTE=$($G ls-tree -r --name-only phase-1 docs | grep -E '/night-review-[0-9]{4}-[0-9]{2}-[0-9]{2}(-[0-9])?\.md$' | awk -F'night-review-' '{print $NF" "$0}' | sort | tail -1 | cut -d' ' -f2)
SINCE=; SINCE_SRC=
if [ -n "$LAST_NOTE" ]; then
  SINCE=$($G show "phase-1:$LAST_NOTE" | grep -oE 'on `phase-1` `[0-9a-f]{7,40}`' | head -1 | sed -E 's/.*`([0-9a-f]+)`$/\1/'); SINCE_SRC=$LAST_NOTE
fi
if [ -z "$SINCE" ]; then
  B=$(ls -d "$MAIN"/.tasks/night-review-*/base.txt 2>/dev/null | sort | tail -1)
  [ -n "$B" ] && SINCE=$(grep -oE '^[0-9a-f]{7,40}' "$B" | head -1) && SINCE_SRC=${B#"$MAIN"/}
fi
if [ -z "$SINCE" ] || ! $G cat-file -e "$SINCE^{commit}" 2>/dev/null; then
  SINCE=$($G rev-list -1 --before='7 days ago' phase-1); SINCE_SRC="7 days back (no earlier review found)"
fi
SINCE=$($G rev-parse --short=9 "$SINCE"); SINCE_DATE=$($G show -s --format=%ci "$SINCE" | cut -c1-16)
MERGES=$($G log --merges --first-parent --format='%s' "$SINCE..$BASE")
N_ALL=$(printf '%s\n' "$MERGES" | grep -c '^Merge p1/')
N_RON=$(printf '%s\n' "$MERGES" | grep -c '^Merge p1/ron-')
N_OTHER=$(printf '%s\n' "$MERGES" | grep -cE '^Merge p1/(gorge|annabell|sandra)-')
# The window: --until, else the running lanes' end, else 9 hours.
LANE_END=0; LANES=
for L in A B all; do
  PF=$MAIN/.coord/night-$L.pid; [ -f "$PF" ] || continue
  ps -o args= -p "$(cat "$PF")" 2>/dev/null | grep -q 'night[.]sh' || continue
  if [ "$L" = all ]; then PAT='night\.sh started \(max'; NAME="the night without lanes"; else PAT="night\.sh started \(lane $L,"; NAME="lane $L"; fi
  T=$(grep -E "$PAT" "$LOG" | tail -1 | grep -oE 'until [0-9-]{10} [0-9:]{5}' | cut -c7-)
  TS=0; [ -n "$T" ] && TS=$(date -d "$T" +%s)
  if [ "$TS" -gt "$NOW" ]; then LANES="$LANES $NAME runs to $T;"; [ "$TS" -gt "$LANE_END" ] && LANE_END=$TS
  else LANES="$LANES $NAME is closing (its end ${T:-unknown} has passed);"; fi
done
if [ -n "$UNTIL" ]; then
  END=$(date -d "today $UNTIL" +%s 2>/dev/null) || { echo "STOP: --until $UNTIL is not a time (HH:MM)"; exit 1; }
  [ "$END" -le "$NOW" ] && END=$(date -d "tomorrow $UNTIL" +%s); END_SRC="--until $UNTIL"
elif [ "$LANE_END" -gt 0 ]; then END=$LANE_END; END_SRC="the running lanes' --until"
else END=$((NOW + 32400)); END_SRC="start + 9 h (no lane runs to a later end, and no --until)"; fi
W=$((END - NOW)); [ "$W" -lt 14400 ] && STOPS="$STOPS the window is under 4 hours (give --until);"
at() { echo $((NOW + W * $1 / 1000)); }
D1=$(at 270); D2=$(at 420); D3=$(at 470); D4=$(at 770); D5=$(at 900); D6=$(at 925)
hm() { printf '%(%a %H:%M)T' "$1"; }
# Exclusions: what the lanes are building.
BRIEF=$($G show phase-1:docs/shifts/brief.md)
sect() { printf '%s\n' "$BRIEF" | awk -v h="$1" 'index($0,h)==1{f=1;next} /^##/{f=0} f'; }
rows() { sect "$1" | sed -nE 's/^\| *([0-9]+) *\| *\[([A-Z][0-9]+[a-z0-9]*)\].*/\2 (\1)/p' | paste -sd' ' -; }
LANE_A=$(rows '### Lane A queue'); LANE_B=$(rows '### Lane B queue')
DAY=$(sect "### The day's packages" | sed -nE 's/^\| *\[([A-Z][0-9]+[a-z0-9]*)\].*/\1/p' | paste -sd' ' -)
RUNNING=$(pgrep -af 'pipeline[.]sh' | grep -oE 'pipeline\.sh [a-z]+ [A-Z][0-9]+[a-z0-9]*|--id [A-Z][0-9]+[a-z0-9]*' | awk '{print $NF}' | sort -u | paste -sd' ' -)
FROM=$(grep -nE '^## ' "$LOG" | tail -1 | cut -d: -f1)
res() { tail -n +"${FROM:-1}" "$LOG" | sed -nE "s/.*pipeline #[0-9]+ ([A-Z][0-9]+[a-z0-9]*): $1.*/\1/p" | sed -E 's/f[0-9]+$//' | sort -u; }
NOTM=$(comm -23 <(res 'NOT MERGED') <(res 'MERGED') | paste -sd' ' -)  # a later MERGED of the id or its fix clears it
EXCLUDE="lane A rows ${LANE_A:-none}; lane B rows ${LANE_B:-none}; by day ${DAY:-none}; running now ${RUNNING:-none}; not merged this night ${NOTM:-none}"
# Budgets, with the limits of tools/docs-check.mjs.
DC=$($G show phase-1:tools/docs-check.mjs)
st() { if [ "$1" -lt "$2" ]; then echo FULL; elif [ "$1" -lt "$3" ]; then echo tight; else echo ok; fi; }
BUDGETS=$(printf '%s\n' "$DC" | sed -nE 's/.*file: "([^"]+)", limit: ([0-9]+) \* kB.*/\1 \2/p' | while read -r f l; do
  b=$($G cat-file -s "phase-1:$f" 2>/dev/null || echo 0); fr=$((l * 1000 - b))
  printf '  %-26s %6d of %6d B, %6d free: %s\n' "$f" "$b" $((l * 1000)) "$fr" "$(st "$fr" 1000 2500)"; done)
NL=$(printf '%s\n' "$DC" | sed -nE 's/.*NOTES_LIMIT = ([0-9]+) \* kB.*/\1/p')
RS=$($G ls-tree -l phase-1 docs/research/ | awk '$NF ~ /\.md$/ {s += $4} END {print s + 0}'); RF=$((${NL:-150} * 1000 - RS))
BUDGETS="$BUDGETS
$(printf '  %-26s %6d of %6d B, %6d free: %s' 'docs/research/*.md' "$RS" $((${NL:-150} * 1000)) "$RF" "$(st "$RF" 12000 20000)")"
# Next free ids (informative).
REFS=$($G for-each-ref --format='%(refname)' refs/heads); IDS=
for P in R G A S F; do
  IDS="$IDS $( { $G grep -ohE "\b$P[0-9]+[a-z0-9]*\b" $REFS -- docs .claude CLAUDE.md 2>/dev/null; grep -ohE "\b$P[0-9]+[a-z0-9]*\b" "$LOG"; grep -rohE --include='*.md' "\b$P[0-9]+[a-z0-9]*\b" "$MAIN/.tasks" 2>/dev/null; } \
    | sed -E "s/^$P([0-9]+).*/\1/" | sort -rnu | awk -v p="$P" '{a[NR]=$1} END {i=1; o=""; while (i<NR && a[i]-a[i+1]>5) {o=o" "p a[i]; i++} printf "%s%d%s", p, a[i]+1, (o ? " (ignored:"o")" : "")}')"
done
MEM=$HOME/.claude/projects/$(printf %s "$MAIN" | sed 's#[^A-Za-z0-9]#-#g')/memory; [ -d "$MEM" ] || MEM=
EB=$MAIN/engine/giac/_out/gsl/giac.wasm; EBS=no; [ -f "$EB" ] && EBS="yes, built $(date -r "$EB" '+%F %H:%M')"
r() { printf %s "${1#"$MAIN"/}"; }
cat <<EOF
night-review, $(hm "$NOW"): $([ "$WRITE" = 1 ] && echo "WRITE=1, the run directory follows these values" || echo "dry run, nothing written, nothing started")
paths
  main checkout     $MAIN
  phase-1 worktree  $(r "$P1")
  skill             $(r "$SKILL")
  run directory     $(r "$RUN")
  review worktree   $(r "$REVIEW"), branch $BRANCH, lock tag $TAG
  review note       $NOTE
commits
  base              $BASE  $($G show -s --format=%s "$BASE")
  since             $SINCE ($SINCE_DATE), from $SINCE_SRC
  merges since      $N_ALL (ron $N_RON; gorge, annabell, sandra $N_OTHER)
window
  start             $(hm "$NOW")
  end               $(hm "$END") ($END_SRC)
  lanes            ${LANES:- none running}
  step 1 hunts      by $(hm "$D1") (hunters finish by $(hm $((D1 - 900))))
  step 2 verify     by $(hm "$D2")
  step 3 knowledge  by $(hm "$D3")
  step 4 packages   by $(hm "$D4") (the loop ends by $(hm $((D4 - 900))))
  step 5 docs       from $(hm "$D4") (or step 4's end, if later), by $(hm "$D5")
  step 6 cleanup    by $(hm "$D6")
  step 7 summary    at $(hm "$END"), after the lanes end or by $(hm $((END + 900)))
exclusions (the lanes are building these; hunters don't report them)
  $EXCLUDE
budgets (phase-1 now; FULL: new backlog lines and entries go into the review note)
$BUDGETS
next free ids now (step 5 mints them on the newest phase-1)
 $IDS
tools
  node_modules to link   $([ -d "$P1/app/node_modules" ] && echo yes || echo "no (vitest findings become to verify)")
  engine build (smoke)   $EBS
  oracle venv            $([ -x "$MAIN/tests/golden/.venv/bin/python" ] && echo yes || echo no)
  memory notes (lo)      $([ -n "$MEM" ] && echo found || echo "none (lo skips them)")
locks
$("$DL" status 2>&1 | sed 's/^/  /')
EOF
[ -n "$STOPS" ] && echo "STOP:$STOPS"
if [ "$WRITE" = 1 ]; then
  [ -n "$STOPS" ] && exit 1
  mkdir -p "$RUN/reports" "$RUN/verified" "$RUN/packages" "$RUN/probes"
  for v in MAIN P1 DL SKILL RUN REVIEW BRANCH TAG NOTE DATE BASE SINCE SINCE_DATE LAST_NOTE NOW END D1 D2 D3 D4 D5 D6 MEM EXCLUDE; do
    printf '%s=%q\n' "$v" "${!v}"; done > "$RUN/values.sh"
  $G rev-parse "$BASE" > "$RUN/base.txt"
  $G log --merges --first-parent --format='%h %ci %s' "$SINCE..$BASE" > "$RUN/merges.txt"
  printf '%s\n' "$BUDGETS" > "$RUN/budgets-start.txt"
  echo "written: $(r "$RUN")/values.sh, base.txt, merges.txt, budgets-start.txt"
fi
# <<< step 0a
```

**The dry run** prints the block's output as it is, then the hunt list: each `## <prefix>: <title>` heading of `hunts.md` with its "Runs when" line applied to the block's counts ("runs" or "skipped: <why>"), then `Nothing started.` Stop there: no directory, worktree, agent or timer.

**A real run stops here too** when the block prints a `STOP:` line: tell the owner why, in one message, and end.

## Step 0b. Setup (about 10 minutes)
1. Rerun the block with `WRITE=1`. It creates `$RUN/{reports,verified,packages,probes}` and writes `values.sh` (every value; start each later command that needs them with `. <RUN>/values.sh;`), `base.txt`, `merges.txt` and `budgets-start.txt`. Start `$RUN/log.md` and `$RUN/decisions-made.md`. Load SendMessage and TaskStop with ToolSearch (`select:SendMessage,TaskStop`).
2. The review worktree, on a new local branch from the base (no lock; phase-1 stays as it is): `git -C $MAIN worktree add $REVIEW -b $BRANCH $BASE`.
3. Node modules for single-file tests, as hard links, under the nodemods lock (your one lock): `$DL acquire nodemods $TAG 600 && cp -al $P1/app/node_modules $REVIEW/app/node_modules; $DL release nodemods $TAG`. If the lock isn't free within 600 s, skip this: the agents then mark vitest findings "(to verify)".
4. `$RUN/common.md`: the block of `common.md` with every `{…}` filled from `values.sh` (times as `Sun 01:45`). Every agent prompt starts with it, verbatim.
5. `$RUN/night-state.md`: the lanes now, from `grep -nE 'MERGED|NOT MERGED|OPUS PASS|CORE DEVICE|henri #' $MAIN/.coord/log.md | tail -n 60 | cut -c1-300`.
6. Log `step 0: base, since, window, the hunts that run`.

## Step 1. The hunts (sandra, Opus high, in parallel; deadline D1)
- One agent per hunt of `hunts.md` whose "Runs when" holds, all in one message, with the hunter prompt of `prompts.md`. Start a timer to D1.
- Hunters finish by D1 minus 15 minutes, so their verifiers start in time.
- **As each report arrives,** log its counts (from the agent's reply) and start its verifier at once (step 2), with at most 4 verifiers running; the rest wait for a free slot. Never after all of them.
- At D1, stop the hunters still running and log them "not finished". A report with a summary is verified as it stands; without one, the hunt counts as not done.

## Step 2. Verify every report (sofia, Opus high, at most 4 at once; deadline D2)
- One verifier per report, with the verifier prompt of `prompts.md`. Start a timer to D2 with the first one.
- At D2, stop the verifiers still running. A report without its verified file is "unverified": its findings go into the note as "to verify", never into a package.
- Log each verdict count (confirmed, refuted, unsure, new).

## Step 3. The knowledge bundle (you; deadline D3)
Write `$RUN/knowledge.md` (at most 40 kB) from the verdict tables, grepping the reports for the details of the labels you keep:
- **CONFIRMED findings only,** de-duplicated across reports (one root cause counts once and keeps every label), grouped by area: engine and maths; entry and parser; keys and views; stored data; units and uncertainty; start chunk and performance; structure and tests; pipeline, tools and the web build; docs. Per finding: labels, severity, reach, evidence pointers (file:line, command), overlap, fix shape.
- **UNSURE findings** in their own section, each with what would settle it. No packages: they go into the note as "to verify".
- **Declutter items** (`dc`) confirmed, as an action list; **leftovers** (`lo`) confirmed, with their target place and text.
- **Proposals for the owner** (a finding that conflicts with a decision), one sentence of recommendation each.
- **Counts** per report: found / confirmed / refuted / unsure, and the verifiers' new findings; the S1 root causes.

## Step 4. Work packages: author ↔ reviewer until they agree (Opus xhigh; deadline D4)
- Start the author with the author prompt of `prompts.md` and a timer to D4. Its output goes to the reviewer (the reviewer prompt); the reviewer's list goes back to **the same author** with SendMessage to its id ("Revise per this review: …"); the revision goes to **the same reviewer** ("Review the revision; your previous points were: …"). Save each review as `$RUN/packages/REVIEW-<round>.md` and log each round.
- Repeat until the reviewer replies `AGREED`, at most 5 rounds or until D4 minus 15 minutes. If they still disagree, the author's last version stands and the reviewer's open points go into `$RUN/packages/OPEN-POINTS.md` for the owner.
- If SendMessage fails, start a fresh agent of the same kind each round with the files and the last review.

## Step 5. Into the docs, uncommitted, in the review worktree (you; from D4 to D5)
**Wait for D4** (or step 4's end, if later), with a timer: the night's Opus passes commit on phase-1 and mint ids until late, and a docs worktree on an old base conflicts with them. Meanwhile draft the note in `$RUN/note.draft.md` only. All edits go into `$REVIEW`, never into `$P1`, and nothing is committed.
1. **The newest phase-1:** `git -C $REVIEW merge --ff-only phase-1` (the branch has no commits, the worktree no edits). Append `step 5 base: <commit>` to `$RUN/base.txt`. If the fast-forward fails, stop step 5, keep the drafts in `$RUN` and say so in the summary.
2. **The budgets on that base:** `wc -c` of each budgeted file in `$REVIEW` and the research notes' total, against the limits in `budgets-start.txt`. Then place by room, and record each choice in `decisions-made.md`:
   - **Backlog lines** (every S1 finding; rules section 9: label, base commit, one rerun command, reach): write them while `docs/backlog.md` stays 200 B under its limit. The rest (all of them when the backlog is FULL) go into the note's section "Backlog lines waiting for room", by label and without ids, plus one pointer line in the backlog if even that fits; step 8 asks the owner where room comes from.
   - **Decisions:** when the "Needs the user" entries don't fit, write one entry naming the questions with their recommendations and pointing to the note's section 6; the full text goes into the note.
   - **Brief rows:** only as many as fit; the rest stay in the note's queue list (section 2), from which each Opus pass moves rows in.
   - **The note:** at most 12 kB. One review note is open at a time: the new note takes over the items of the last note (`$LAST_NOTE`) that the `lo` hunt found still open, and the last note moves to `docs/archive/` with `git mv` (links fixed) in the same diff. If the research notes' total still has no room, shorten the new note and put the budget into step 8's questions.
3. **Mint the ids now,** after the newest phase-1 (rules section 9): per prefix (R, G, A, S, F), the next number above the highest used. Rerun step 0a's block with `WRITE=` empty and take its "next free ids" line (ignore its other values): it scans every branch's `docs`, `.claude` and `CLAUDE.md`, the log and `.tasks/**/*.md` (the logs are denied), and skips a top number more than 5 above the next (check each skipped one by eye). Map `NEW-<n>` to the ids in `$RUN/id-map.md`, with the time, the highest used per prefix, and one line `minted: <every new id, space-separated>` for step 8.
4. **Write:**
   - the package files `docs/shifts/packages/<ID>.md`;
   - their rows in brief section 0c's lane tables after the lanes' rows, step numbers continuing;
   - the S1 lines under backlog "Open bugs" (the rerun names its command even when the engine can't be rerun now: the engine build is a denied path, so the verifiers' results at the base stand);
   - the "Needs the user" entries in `docs/decisions.md`;
   - the confirmed docs-declutter edits (stale facts rewritten in place; decided research notes moved with `git mv` to `docs/archive/`, links fixed);
   - the probes the findings cite, in `tools/probes/review-<MMDD>/` with a README row (rules section 9);
   - the note `$NOTE`, status **open**. Its first lines after the title: the status line, then *"Written <date> by Claude (Opus, the coordinator) on `phase-1` `<base>`; ids minted and docs written on `<step 5 base>`."* Keep that wording: the next run reads its base from it. Sections: 1 the hunts (a counts table), 2 the queue it proposes (past what fits in the brief), 3 backlog lines (and those waiting for room), 4 to verify, 5 items to place, 6 questions for the owner, 7 budget options (when a budget is FULL). Link it once from `docs/README.md`.
5. **Vitest reruns** only behind the CPU guard. Engine reruns are usually impossible (the build path is denied): say so; don't wait for them.
6. Behind the CPU guard: `DOCS_CHECK_REPO=$REVIEW node $REVIEW/tools/docs-check.mjs` must print `docs ok`. Fix until it does: shorten your own text, never cut text you didn't write.
7. `git -C $REVIEW add -N <the new files>` (intent to add, not a commit), then `git -C $REVIEW status --short > $RUN/docs-status.txt` and `git -C $REVIEW diff > $RUN/docs.diff`.

## Step 6. Cleanup (you; by D6)
- Stop every agent of this run that is still running.
- No process of this run left: `pgrep -af 'vitest|smoke[.]mjs|tsx'`; stop only those whose command line names `$REVIEW` or `$RUN`.
- `$DL status` shows no lock held as `$TAG`; `git -C $P1 status --short` shows nothing of yours.
- In `$RUN/probes/`, delete only scripts no finding cites. Keep the reports, verified files, knowledge, packages, diff and log.
- Keep the review worktree, its branch and its `app/node_modules` (hard links, no space).

## Step 7. The morning summary (at the end of the window)
1. Wait in the background until the lanes have ended or 15 minutes past the end: `until ! pgrep -f 'night[.]sh' >/dev/null || [ "$(date +%s)" -ge $((END + 900)) ]; do sleep 300; done`. Never kill or restart a lane.
2. Write `$RUN/SUMMARY.md` for the owner, plain, at most 2 pages:
   - **0, only when needed:** what the owner must know first (an id taken by a pass since step 5, a failed fast-forward, a lane that broke).
   - **1, the night:** what merged since the run began, with commits; what's NOT MERGED and why; CORE on desktop and on the device; every Opus pass's "Needs the user"; the night report's path; whether the lanes ended on time, early (when, why) or still run.
   - **2, this review:** counts per hunt; the new packages with ids in queue order, one line each; the backlog lines added and those waiting for room; the decisions for the owner with recommendations; the leftovers recorded; the budget state; what didn't finish or went wrong (a guard breach, a stray `cd`).
   - **3, what the owner does now:** step 8 here, or in a new session with `$RUN/STEP8-PROMPT.md`; read the diff; answer the questions; the OK to commit; push.
3. Write `$RUN/STEP8-PROMPT.md` from the handoff prompt of `prompts.md`, values filled in.
4. Post the summary's path and three lines: merges in the night, new packages, decisions waiting. Don't end the session: wait for the owner's prompt and go on with step 8.

## Step 8. With the owner (Opus high)
1. **The night is over?** `pgrep -af 'night[.]sh --lane|pipeline[.]sh'` prints nothing and `$DL status` shows no lane lock. If a lane still runs, say so and wait. Then complete SUMMARY section 1 from the log's lines after it was written.
2. **Show the plan, short:** the night in three lines; the proposed queue per lane (id, title, agent and model, one line of why each); what goes into the docs (counts of package files, backlog lines, decisions entries, declutter edits, leftovers); where the diff is.
3. **Ask every needed input,** one by one and in detail, with AskUserQuestion: at most 4 per call, the one that unblocks the most first. Per question: the situation in two or three plain sentences with its evidence (file:line or label); 2 to 4 options; your recommendation first, marked "(Recommended)", with its reason in one line. This covers each "Needs the user" entry, each point of `OPEN-POINTS.md`, each Opus pass's "Needs the user" from the night, the budget options, and a queue order that is a judgement call.
4. **The OK to commit on the review branch** (not on phase-1): `git -C $REVIEW add -A` (only the review's files: compare with `docs-status.txt`), `git -C $REVIEW commit -s` with the Co-Authored-By line. Then bring it onto today's phase-1: `git -C $REVIEW merge phase-1`, resolving brief, backlog and decisions there and keeping both sides' text.
5. **Check every minted id again,** now (the first run's passes took R92, G138 and F139–F145 between steps 5 and 8). A hit outside the review is a collision:
   ```
   . <RUN>/values.sh; REFS=$(git -C $MAIN for-each-ref --format='%(refname)' refs/heads | grep -vx "refs/heads/$BRANCH")
   for id in $(sed -n 's/^minted: //p' $RUN/id-map.md); do
     H=$( { git -C $MAIN grep -lw "$id" $REFS -- docs .claude CLAUDE.md; grep -lw "$id" $MAIN/.coord/log.md; grep -rlw --include='*.md' "$id" $MAIN/.tasks | grep -v "^$RUN/"; } 2>/dev/null | head -3 | paste -sd' ' -)
     [ -n "$H" ] && echo "TAKEN $id: $H"; done
   ```
   Read each hit (a day prompt that only quotes the review is no collision). For a real one: give the review's copy the next free id, `git mv` its package file, replace it in the review's own text only, update `id-map.md`, and grep that no old id is left. Compare the night's new backlog lines with the review's too: one bug keeps one line.
6. **Apply the answers:** each decided question moves to "Decided proposals" with its date; the budget option; the brief rows that now fit. `DOCS_CHECK_REPO=$REVIEW node $REVIEW/tools/docs-check.mjs` (behind the guard) must print `docs ok`; shorten only the review's text.
7. **Show** `git -C $MAIN diff phase-1...$BRANCH --stat`, then the parts asked for. Only with the owner's OK: `git commit -s` on the branch; `$DL acquire integ $TAG 1800` (it waits for the merge queue, so the merge lands between two runs), `git -C $P1 merge --no-ff --signoff $BRANCH` (message `Merge <branch>: night review <date>` and the Co-Authored-By line), `$DL release integ $TAG`; one line in `$MAIN/.coord/log.md`: `- HH:MM night review <date>: merged <commit> into phase-1 (<n> packages, <ids>)`. Never push: the owner pushes.
8. **Then:** the owner's own leftovers (SUMMARY "For you only") as a short checklist; one line in `$RUN/log.md`; remove the review worktree only when the owner says so.

**Rules for step 8:** commit only with the owner's OK, always `git commit -s` (the sign-off comes from git's config; never type an address) with the Co-Authored-By line. Never push, never force, never `master`. Shared docs change only as the review's text or the owner's answers say. One recommendation with plain reasons, not option tables.
