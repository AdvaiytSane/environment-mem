# headstart

The second coding-agent session on a repo starts where the first one finished.

headstart records what a session did (files read, commands run, files changed, what verified the result), turns that into a short procedure with no model call, and hands it to the next session before its first prompt. It works under Claude Code, Devin CLI and Codex through their hook files, and writes the same procedures as `SKILL.md` files that Devin, Warp and Codex discover on their own.

It also measures the difference. `headstart eval` runs the same tasks cold and warm and prints tokens, tool calls, seconds and cost per session.

## Quick start

Needs Node 24. No install step, no dependencies.

```
git clone <this repo> ~/headstart
cd <your project>
node ~/headstart/src/cli.ts init
node ~/headstart/src/cli.ts install
```

`install` writes hooks into `.claude/settings.json`, which Claude Code and Devin CLI both read. `install --all` also writes `~/.config/devin/config.json` and `~/.codex/hooks.json`. Run your agent as usual. After the first session:

```
node ~/headstart/src/cli.ts list            # what was stored
node ~/headstart/src/cli.ts facts           # what the next session is told at start
node ~/headstart/src/cli.ts recall "task"   # the procedure a prompt would get
node ~/headstart/src/cli.ts skills          # write .agents/skills/*/SKILL.md and .claude/skills/*/SKILL.md
```

Alias it: `alias headstart='node ~/headstart/src/cli.ts'`.

## Any other agent loop

Pipe hook events as JSON on stdin. Four events, all optional except `PostToolUse` and `Stop`:

```
echo '{"session_id":"s1","cwd":"'$PWD'","prompt":"add a --json flag"}' | headstart hook UserPromptSubmit
echo '{"session_id":"s1","cwd":"'$PWD'","tool_name":"exec","tool_input":{"command":"npm test"},"tool_response":{"exit_code":0}}' | headstart hook PostToolUse
echo '{"session_id":"s1","cwd":"'$PWD'"}' | headstart hook Stop
```

`SessionStart` and `UserPromptSubmit` print `{"hookSpecificOutput":{"additionalContext":"..."}}` on stdout when there is something to say. Put that text in your system prompt.

## Backend

Procedures live in `.headstart/procedures.jsonl`.

## Eval

```
headstart eval --runner claude --model sonnet --repeats 2
headstart report results/<dir>
```

Four arms per task: `cold` (nothing), `doc` (a hand-written AGENTS.md, the control), `facts` (repo facts at session start), `full` (facts plus the matching procedure at prompt time). Warm arms never see a procedure from the same task. Runner `devin` uses `devin -p --export`. The fixture is `fixtures/repo`, tasks in `fixtures/tasks.json`, hidden checks in `fixtures/checks/`.

## Layout

```
src/hook.ts      hook entry: capture, extract on Stop, inject on SessionStart and UserPromptSubmit
src/trace.ts     tool-name map (Claude, Devin, Codex) and step builder
src/extract.ts   trace to procedure, deterministic
src/recall.ts    lexical recall and repo facts
src/inject.ts    the text a session receives
src/skills.ts    SKILL.md writer
src/install.ts   hook-file writer
src/eval.ts      cold / doc / facts / full runner
src/report.ts    table and fleet projection
```
