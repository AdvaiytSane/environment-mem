# Demo

Three terminals. Everything below is a real agent session; nothing is replayed.

Terminal 1, the console. One lane per run appears as it starts.

    node src/cli.ts console --live
    open http://localhost:4177

Terminal 2, a cold run. Devin CLI in a fresh copy of the fixture repo, hooks on, nothing handed to it.

    node src/cli.ts run --agent devin --lane devin-cold --task bugfix-1 --inject 0

Terminal 3, the same task with memory on. The hook finds the procedure the cold run stored and hands it over before the first tool call. The lane shows the receipt, the head shows the saving against the cold lane.

    node src/cli.ts run --agent claude --lane claude-warm --task bugfix-1

A judge can pick any task id from fixtures/tasks.json or fixtures/tasks-live.json, or type a task in quotes:

    node src/cli.ts run --agent devin --lane judge --task "Add a --limit flag to the list command"

## Many agents at once

    node src/cli.ts orchestrate --fresh

fixtures/orchestrate-demo.json: three waves of two. Wave one runs cold (Devin on bugfix-1, Claude Code on endpoint-1). Wave two runs the same two tasks with the agents swapped: Claude Code is handed Devin's procedure and Devin is handed Claude's. Wave three runs two neighbouring tasks and is handed both. Measured on Sep 19:

    devin-1    devin  bugfix-1     12 calls  5 before first edit   40s  cold
    claude-1   claude endpoint-1   19 calls  9 before first edit   51s  cold
    claude-2   claude bugfix-1      5 calls  2 before first edit   25s  handed 1 (devin bugfix-1)
    devin-2    devin  endpoint-1   13 calls  8 before first edit   36s  handed 1 (claude endpoint-1)
    devin-3    devin  bugfix-2     12 calls  8 before first edit   54s  handed 1 (devin bugfix-1)
    claude-3   claude endpoint-2   27 calls 12 before first edit  112s  handed 2 (claude endpoint-1, devin bugfix-1)

`--plan fixtures/orchestrate-populate.json` is the 36-run version over the Devin-style task set.

## The hosted store

With HEADSTART_API_URL and HEADSTART_API_KEY set (`.env`, not committed), every finished session is also posted to POST /v1/extract with its tool calls, cost and what it was handed, and the dashboard's overview, procedures, graph, agents, savings and evals pages fill from those rows. Recall stays local; the hook maps local procedure ids to hosted ones so hand-offs link.

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

New repo, written this weekend. Devin CLI, Claude Code, Codex are the harnesses under test.

## Backup

If the live run dies: `results/<dir>/work/<task>-cold-1/.headstart/sessions/*.jsonl` and the matching `full` run are on disk. Show the two traces side by side.
