# fixtures

This directory holds one evaluation fixture for coding agents plus the
task list the runner drives them with.

## Layout

- repo/ is the pristine fixture codebase. Treat it as read-only source:
  never edit it in place to try a task.
- tasks.json lists the tasks a runner can give to an agent, one prompt
  per task, in three shapes: flag, endpoint, bugfix.
- checks/ holds one hidden node:test file per task. The agent never
  sees these while it works.
- static-doc/AGENTS.md is a short, human-written doc used as a control
  arm: some runs can drop a copy of it into the working copy before
  the agent starts, to measure how much a hand-written pointer helps
  versus letting the agent discover the layout on its own. It does not
  mention any task.

## Running a task

1. Make a fresh working copy of repo/ (a plain directory copy, or a git
   clone/checkout). Never hand the agent the original repo/ directory.
2. Give the agent the prompt from the matching entry in tasks.json.
   Nothing else: no mention of ops/check.sh, the registry, or the
   FLAGS table. Discovering those is part of the task.
3. When the agent reports it is done, copy the file named by
   hidden_test into the working copy's test/ directory, keeping its
   filename.
4. Run `bash ops/check.sh` inside the working copy.
5. The task passes only if the hidden test passes. For a bugfix task,
   also confirm the file named by visible_failing_test now passes
   (it fails on the clean fixture, before any fix).

## Resetting

The working copy is disposable. Delete it and make a new copy of
repo/ for the next task or the next run. Do not try to undo an
agent's edits in place; repo/ itself is never touched by a run, so
there is nothing in it to restore.

## Clean-fixture baseline

Running `bash ops/check.sh` in repo/ as shipped fails exactly two
tests: test/orders-total.test.js and test/cli-export.test.js. Every
other test passes. Those two failures are the seeded bugs behind
bugfix-1 and bugfix-2. A third seeded bug, behind bugfix-3, lives in
test/dates-range.test.js.
