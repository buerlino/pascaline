<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# S35: every live doc says N62 (sandra, 2026-11-06)

**Status:** reference (dated report; ages out as rules section 10 says).

## What changed
- **Agents and skill:** the description and first line of all seven `.claude/agents/*.md`; `night-review/SKILL.md:3`, `:48` (STOP text), `common.md:4`, `:8`. percy finds the main checkout as SKILL.md does (`MAIN=$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")` with the `.coord/log.md` guard) and its resume command sets `MAIN` itself (a Bash call keeps no variable), then `cd "$MAIN/.claude/worktrees/phase-1"`; `:21` already grepped `N62_LANE` (A80).
- **rules.md:** `:4` N62; section 5's `MAIN=` is the git line plus the guard; `:54-58` already named A80's variables, `:31` already `dev.n62.calc`. CLAUDE.md and the brief needed nothing more (A78, A80 and 64e6b738 had done them; the package's brief line numbers were older than the brief).
- **Spelling rule** once, in `docs/rules-core.md` (where the name's origin sentence was): N62 where a person reads it or it means the app; lowercase n62 in addresses, ids and file names; a name in code exactly as the code has it (`window.n62`, the IndexedDB `n62`, but `N62_*` variables and `N62Files`); dated history keeps Pascaline.
- **Follow the code** (each name checked with `git grep` in `app/src`, `android/`, `build.sh`): IndexedDB `n62` (`state/storage.ts:19`), stamp `@n62` (`storageRaw.ts:9`, the old `@pascaline` read as it, `:11`), Web Lock `n62-writer` (`state/writer.ts:8`), `window.n62` (`main.ts:102`), `dist/n62.apk` (`build.sh:24`), `N62FilesPlugin`, `N62HapticsPlugin` (`android/.../dev/n62/calc/`), `n62-backup` (`backup.ts:45`), the look `n62` named `N62` (`theme/lookView.ts:9`), `~/.cache/n62/` (`build.sh:15`).
- **Files:** docs/01-05 (titles, `02:3` points to decisions "The name N62", `03:27`, `04:134`, `:335`, `:350`, `05:133`), `r6-pipelines.md:36`, `:94-95`, `r18-outside-test.md:12`, `:94`, `:97`, `:108`, `:117`, `release.md:1`, the three mockups, open packages A65, A66, G174, R128, R130, `THIRD_PARTY.md:40`, `tools/probes/README.md:43`. decisions.md: the id and web entry folded into "The name N62" (one place), `:45` and `:202` say N62. backlog.md `:25`: the new id and the old app by its label (A77's `scripts/app-id.test.ts` forbids the old id outside the archive, decisions and A77).

## What stays Pascaline, and why
Every hit of `git grep -n -i pascaline -- docs CLAUDE.md .claude THIRD_PARTY.md '*.md' ':!docs/archive' ':!app'` after this package:
- `README.md:76` "Copyright © 2026 Pascaline contributors": pinned by `app/scripts/legal.test.ts:112-115` (with package.json's author), as the patch notices are; README is A77/A78's.
- `android/NOTES.md:5`, `engine/giac/README.md:36`, `docs/shifts/rules.md:28`: the old cache `~/.cache/pascaline/` the key is copied from (A80, `build.sh:98`) and the sibling folder `../pascaline-deps/`.
- `engine/giac/patches/README.md:6`: the dated GPL notice `# Changed by Pascaline contributors`, pinned by `legal.test.ts`.
- `docs/02:3` (the first name, as history), `02:124` (the 2026-10-10 name), `04:350` (the old stamp the code still reads), `backlog.md:25` (the old app to uninstall), `decisions.md:17` (the entry itself), `release-0.1.0.md:18`, `:20` (done rows of 11-02 and 11-05, when the domain was the old one), `rules-core.md:6` (the rule names the old name once).
- `docs/shifts/brief.md:57`: tonight's dated plan, which names the old folder as the fallback start.
- Dated reports in `docs/shifts/`; `spec/mapping/vc-2026-10-11/`; the package texts of the merged rename packages (A77-A80, R138, R139) and S35, R140 (owner quotes); the Opus pass archives them.
`git grep -n -e 'source99/pascaline' -e 'PASCALINE_' -- docs CLAUDE.md .claude '*.md' ':!docs/archive'`: only `brief.md:57` (dated plan) and the merged packages A80, R138 and S35 itself.

## The owner's steps after the move (not done here)
1. No lane runs (`ls .coord/night-*.pid` empty) and no pipeline runs.
2. `mv ~/Documents/source99/pascaline ~/Documents/source99/n62`, then from the new folder `git worktree repair .claude/worktrees/*` (each worktree's `.git` file and the main `.git/worktrees/*/gitdir` hold the old absolute path); `git worktree list` then shows nothing prunable.
3. `.claude/settings.local.json` holds no old path (checked: 0 hits today); Claude Code keys its per-project state by folder, so its permissions and history start fresh there **(to verify, owner: first start in the new folder)**.
4. The memory folder: copy `~/.claude/projects/-home-nordmu-Documents-source99-pascaline/` to `…-source99-n62/` (its notes name old paths in history; nothing to edit).
5. `git config --list` holds no old path (checked; origin is `n62-dev/n62`). No script under `scripts/` or `tools/` names the absolute path (checked).

## Checks
`node tools/docs-check.mjs` ok (brief 31.9/32, backlog 19.8/20, decisions 39.9/40, all smaller than before); `npm run gate -- --quick` passed (typecheck 0, vitest 3801); percy's and rules.md's `MAIN=` line, run in this worktree, printed `/home/nordmu/Documents/source99/pascaline`.

## Risks
- percy's resume line is the one command a night depends on; it was run in parts here, not as a real resume.
- The copyright holder "Pascaline contributors" (README, package.json, patch notices) is pinned by `legal.test.ts`; renaming it is the owner's call (a new line for new work, the dated notices kept), not a docs edit.
