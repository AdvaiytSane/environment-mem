# Demo, 6 minutes

Two terminals side by side, console.html on the second screen.

## 0:00 One sentence

"The first agent session on a repo spends most of its tool calls finding out how the repo works. headstart gives the second session that answer before its first prompt, and here is what it saves."

## 0:20 Cold run, live

Fixture repo, a task the judge picks from the list. Devin CLI:

    devin -p "Add a --limit flag to the list command" --permission-mode dangerous --respect-workspace-trust false

Point at the transcript: `ls`, `cat package.json`, `grep FLAGS`, reads `args.js`, reads `flags.js`, tries `npm test`, fails, finds `ops/check.sh`. Count the calls before the first edit out loud.

## 1:30 What headstart kept

    headstart list
    headstart facts
    headstart recall "add a --format flag to the users command"

Show that the procedure is a list of files and commands, no prose, no model call. Show the injection wrapper: reference data, not instructions.

## 2:15 Warm run, live, different task

Same repo copy, hooks installed, new task of the same shape:

    devin -p "Add a --format flag to the users command that accepts csv or table" ...

Point at the transcript: first tool call is a read of `src/cli/flags.js`. Verify command is `bash ops/check.sh` on the first try. Count the calls before the first edit.

## 3:15 Skills, for Cognition

    headstart skills
    devin skills list | grep -i flag

The same procedure is now a SKILL.md that Devin, Warp and Codex discover on their own. Devin auto-suggests skills after its own sessions; headstart writes them from any harness's session, no button.

## 4:00 The table

console.html from results/claude-sonnet-r3. Say the numbers once: about 10% fewer tool calls, 7 to 12% cheaper, tests pass, nothing written by hand. Then point at the hand-written doc row without being asked: a person's four lines do 25%. That row is what makes the rest believable.

## 5:00 Fleet row

Mean delta times 9,000 sessions, with the 95% interval next to it. Say the interval out loud. Devin bills in ACU; the minutes column is the one to read at their table.

## 5:30 What is prior work

New repo, written this weekend. Devin CLI, Claude Code, Codex are the harnesses under test. memorable-cli is an optional backend, off by default, pre-existing, disclosed.

## Backup

If the live run dies: `results/<dir>/work/<task>-cold-1/.headstart/sessions/*.jsonl` and the matching `full` run are on disk. Show the two traces side by side.
