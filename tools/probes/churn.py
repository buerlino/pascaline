# SPDX-License-Identifier: GPL-3.0-or-later
# Probe (structure audit, 2026-10-20): which files in app/src change most, and which carry the bug fixes.
# For every non-test file under app/src that exists at REV: lines added + removed over all non-merge commits
# reachable from REV, the number of those commits, the commits whose subject starts with "fix", and the commits
# cited as fixes in docs/research/bug-patterns.md (backquoted 7-hex ids) that touch the file, with their lines.
#   python3 -I tools/probes/churn.py [REV] [TOP]          # default HEAD, 15
# Read-only (git only); no network.
import collections, re, subprocess, sys

rev = sys.argv[1] if len(sys.argv) > 1 else "HEAD"
top = int(sys.argv[2]) if len(sys.argv) > 2 else 15

def git(*a):
    return subprocess.run(["git", *a], check=True, capture_output=True, text=True).stdout

def is_src(f):
    return f.startswith("app/src/") and ".test." not in f and not f.endswith(".spec.ts") and f.endswith((".ts", ".svelte"))

def numstat(args):
    churn, commits, cur = collections.Counter(), collections.Counter(), None
    for line in git("log", "--no-merges", "--numstat", "--format=tformat:C %h", *args).splitlines():
        if line.startswith("C "):
            cur = line[2:]
            continue
        parts = line.split("\t")
        if len(parts) != 3 or parts[0] == "-" or not is_src(parts[2]):
            continue
        churn[parts[2]] += int(parts[0]) + int(parts[1])
        commits[parts[2]] += 1
    return churn, commits

alive = {f for f in git("ls-tree", "-r", "--name-only", rev, "app/src").split() if is_src(f)}
churn, commits = numstat([rev, "--", "app/src"])
_, fixes = numstat(["-i", "-E", "--grep=^fix", rev, "--", "app/src"])
cited = sorted(set(re.findall(r"`([0-9a-f]{7})`", open("docs/research/bug-patterns.md").read())))
bug_churn, bug_commits = collections.Counter(), collections.Counter()
for h in cited:
    try:
        out = git("show", "--no-renames", "--format=", "--numstat", h, "--", "app/src")
    except subprocess.CalledProcessError:
        continue
    for line in out.splitlines():
        parts = line.split("\t")
        if len(parts) == 3 and parts[0] != "-" and is_src(parts[2]):
            bug_churn[parts[2]] += int(parts[0]) + int(parts[1])
            bug_commits[parts[2]] += 1

lines = {f: git("show", f"{rev}:{f}").count("\n") for f in alive}
print("| File | Lines now | Churn (lines) | Commits | `fix…` commits | Cited fix commits (lines) |")
print("|---|---|---|---|---|---|")
for f, c in sorted(((f, c) for f, c in churn.items() if f in alive), key=lambda t: -t[1])[:top]:
    print(f"| `{f[8:]}` | {lines[f]} | {c} | {commits[f]} | {fixes[f]} | {bug_commits[f]} ({bug_churn[f]}) |")
print(f"\nBy `fix…` commits: " + ", ".join(f"{f[8:]} {n}" for f, n in fixes.most_common(10) if f in alive))
print(f"By cited fix commits: " + ", ".join(f"{f[8:]} {n}" for f, n in bug_commits.most_common(10) if f in alive))
print(f"{len(cited)} commit ids cited in bug-patterns.md; {sum(1 for f in alive)} source files in app/src at {rev}.")
