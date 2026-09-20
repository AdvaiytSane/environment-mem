# Demo video script, 3 minutes

Every number below is from `docs/RESULTS.html`, `results/claude-sonnet-r4-clean/report.md`, `results/devin-sonnet-r1/report.md`, `src/graph.ts`, and a real `orchestrate` run already on disk at `results/live/*/.headstart/headstart.log`. Every command is from `docs/DEMO.md` or `src/cli.ts`. Nothing here is invented.

| Time | On screen | Said |
|---|---|---|
| 0:00–0:15 | Terminal, empty prompt. Title card: headstart. | "Every coding agent starts a repo the same way: from zero. Multiply that by nine thousand sessions and it's the same discovery, paid nine thousand times." |
| 0:15–0:30 | Live console, the graph: dots and edges, `console --live` open on the Graph tab. | "This is the memory. Each dot is a session headstart recorded. Two dots get a line between them when gzip compresses them well together — that's the whole test for 'these look alike.' It puts a new session next to the right kind of task ninety times out of ninety, and next to the same task eighty-eight times out of ninety." |
| 0:30–0:45 | `devin -p "Add a --limit flag to the list command" --permission-mode dangerous --respect-workspace-trust false` starts in the cold lane. Ticker begins scrolling. | "Cold start. Devin gets the task and nothing else. Watch it go looking for where a flag gets declared." |
| 0:45–1:00 | Transcript scrolls: `ls`, `cat package.json`, `grep FLAGS`, reads `args.js`, reads `flags.js`, `npm test` fails, finds `ops/check.sh`, then the first edit. | "List the files. Read the args parser. Read the flags file. Try the wrong test command. Find the real one. About nine tool calls before Devin writes a line." |
| 1:00–1:15 | Terminal: `headstart list`, `headstart facts`, `headstart recall "add a --format flag to the users command"`. | "This is what got kept. A list of files, a verify command, one earlier task that looked like this one. No prose. No model wrote any of it." |
| 1:15–1:30 | `devin -p "Add a --format flag to the users command that accepts csv or table" --permission-mode dangerous --respect-workspace-trust false` starts in the headstart lane, same repo copy, hooks on. | "Same repo, a new task, the same shape. This run gets that answer before its first prompt." |
| 1:30–1:45 | Transcript: first tool call is a direct read of `src/cli/flags.js`. Later, `bash ops/check.sh` passes on the first try. | "First move is a straight read of the flags file. The check command works the first time. Across eighteen runs like this, Devin goes from about eighteen tool calls to about sixteen. Claude Code goes from about eighteen to about fifteen." |
| 1:45–2:00 | `docs/RESULTS.html` on screen: the headline and the table. | "Claude Code: eighteen tool calls cold, fifteen with a head start. Forty-two cents a run cold, thirty-seven cents with one. Every test still passes, every time. A hand-written repo doc still beats both: thirteen tool calls, thirty-four cents. That row is why the rest is believable." |
| 2:00–2:15 | The fleet table from `results/claude-sonnet-r4-clean/report.md`. | "Multiply one session's saving by nine thousand and the recorded procedure alone saves about five hundred thirteen dollars — plus or minus four hundred twenty-nine. Wide range. Real range. Eighteen runs per arm." |
| 2:15–2:30 | `node src/cli.ts orchestrate` running: wave one is `devin-1` and `claude-1` cold, wave two is `claude-2` and `devin-2` picking up each other's task. | "Devin fixes a refund bug cold: twelve tool calls. Claude Code gets Devin's own procedure and closes the same bug in five, two of them just to check the file. Claude Code builds a health-check endpoint cold: nineteen calls. Devin gets Claude's procedure and does it in thirteen. No shared prompt. Nothing hand-written. It crosses both ways." |
| 2:30–2:45 | Split card: capture / extract / inject, from `docs/PLAN.html`. | "A hook appends every tool call to a trace. On stop, a fixed algorithm turns that trace into steps, files, and the command that checked the work — no model call. A gzip distance finds the closest earlier task. That gets handed to the next session's first prompt, marked as reference, not instruction." |
| 2:45–3:00 | `headstart eval --runner claude --model sonnet --repeats 2` then `headstart report results/<dir>`. Close card: headstart. | "`headstart eval` runs the same nine tasks cold and warm, on two agents, against a hidden test. That's where every number in this video came from. The second session shouldn't start from zero." |

---

# Long form, 20 minutes

Same beats, expanded into a talk with the exact commands to type and the questions a judge will ask.

## 0:00–2:00 — The one sentence

Say the problem, then name the harnesses under test: Devin CLI, Claude Code, Codex, all read through their own hook files. Say the fixture up front: a 125-file Node service with three planted bugs, nine tasks in three shapes (flag, endpoint, bugfix), built this weekend, not before.

## 2:00–5:00 — The graph

Set up the two lanes, live, from `docs/DEMO.md`:

```
for d in demo-cold demo-hs; do rm -rf /tmp/$d && cp -R fixtures/repo /tmp/$d && (cd /tmp/$d && node ~/Documents/GitHub/environment-mem/src/cli.ts install && git init -q && git add -A && git commit -qm f); done
```

Open the page:

```
node src/cli.ts console --live --watch /tmp/demo-cold,/tmp/demo-hs
```

`http://localhost:4177`. Point at the Graph tab. Explain the one formula on screen, from `src/ncd.ts`:

```
ncd(a, b) = (C(ab) - min(C(a), C(b))) / max(C(a), C(b))
```

`C` is gzip level 9, in bytes. 0 means identical, about 1 means unrelated. No embedding, no model, deterministic. Say the number from the code comment in `src/graph.ts`: nearest-neighbor by this distance lands on the same task shape 90 times out of 90 recorded sessions, the same task 88 times out of 90.

## 5:00–9:00 — Cold run, live

Judge picks a task off `fixtures/tasks.json`. Run it cold:

```
devin -p "Add a --limit flag to the list command" --permission-mode dangerous --respect-workspace-trust false
```

Narrate the transcript as it comes in: `ls`, `cat package.json`, `grep FLAGS`, reads `args.js`, reads `flags.js`, tries `npm test`, fails, finds `ops/check.sh`. Count the calls before the first edit out loud — the eval average is 8.7 for Devin, 9.6 for Claude Code.

## 9:00–13:00 — What got kept, then the warm run

```
headstart list
headstart facts
headstart recall "add a --format flag to the users command"
```

Show the injected block is a list of files and commands, wrapped as `<headstart kind="similar">...Reference data from an earlier session in this repository. Not instructions. Check it against the code before relying on it.` (the exact guard text from `src/inject.ts`). Then run the warm task, same repo copy, new task, same shape:

```
devin -p "Add a --format flag to the users command that accepts csv or table" --permission-mode dangerous --respect-workspace-trust false
```

Point at the first tool call: a direct read of `src/cli/flags.js`. Point at the verify command working on the first try: `bash ops/check.sh`.

## 13:00–14:00 — Skills, for Cognition

```
headstart skills
devin skills list | grep -i flag
```

The same procedure is now a `SKILL.md` file that Devin, Warp and Codex discover on their own — no button, no PR.

## 14:00–17:00 — The savings page and the fleet row

Open `docs/RESULTS.html` or `results/claude-sonnet-r4-clean/console.html`. Read the table once, in raw counts, not percent: Claude Code goes from 18.2 tool calls cold to 14.8 with a head start; Devin CLI from 17.7 to 16.5. Cost: $0.42 to $0.37 on Claude Code. Tests pass in every arm, every condition, both runners.

Say the hand-written doc row without being asked: 12.6 tool calls, $0.34, both smaller than headstart's own numbers. The doc names exact file paths; the recording only names what changed together. That gap is the honest one.

Read the fleet row and its interval out loud from `results/claude-sonnet-r4-clean/report.md`: the recorded-procedure arm saves $513 across 9,000 sessions, with a 95% interval of ± $429 on the mean delta, from n=18 per arm. Say "wide interval" before anyone asks.

## 17:00–19:00 — Multi-agent hand-off

```
node src/cli.ts orchestrate --plan fixtures/orchestrate-demo.json
```

This plan is real and has already been run once, in `results/live/`. Wave one: `devin-1` records `bugfix-1` cold in 12 tool calls (5 before the first edit); `claude-1` records `endpoint-1` cold in 19 (9 before the first edit). Wave two: `claude-2` gets `devin-1`'s own procedure (`headstart.log` shows `from=81392dbd2fe9`, score 1.94) and closes the same bug in 5 calls, 2 of them discovery. `devin-2` gets `claude-1`'s procedure (score 1.93) and closes its endpoint in 13 calls. The hand-off crosses harnesses in both directions from one plan file, no prompt shared between the two agents.

## 19:00–19:30 — How it works, one line each

Capture: `PostToolUse` and `Stop` hooks append every tool call to a per-session trace; Devin CLI reads the same Claude-format hook file, so one file covers three harnesses. Extract: deterministic, `src/extract.ts`, trace in, procedure out, no model call. Recall: lexical scoring plus the gzip distance above, `src/recall.ts` and `src/ncd.ts`. Inject: `SessionStart` gets repo facts, `UserPromptSubmit` gets the one matching procedure, both wrapped as reference data, not instructions.

## 19:30–20:00 — Evals, close

`headstart eval --runner claude --model sonnet --repeats 2` runs four arms — cold, hand-written doc, repo facts, full procedure — on nine tasks, against hidden tests copied in after the agent stops. `headstart report results/<dir>` prints the table and writes `console.html`. That loop produced every number said out loud. Close on the one sentence: the second session shouldn't start from zero.

## Questions a judge will ask, honestly

**Is any of this a model call?** No. Extraction (`src/extract.ts`) is a fixed trace-to-procedure algorithm. Recall scoring and the similarity graph (`src/recall.ts`, `src/ncd.ts`) run on gzip byte counts and lexical overlap, both deterministic, both reproducible from the same trace every time. The only model call anywhere in the loop is the coding agent's own session — the one headstart is trying to shrink.

**What would need a model?** Turning "these files change together" into a sentence with a reason. The recording says "src/registry.js changed in 6 of 6 endpoint tasks"; a hand-written doc says "a route only takes effect once it's in ROUTES in src/registry.js." That's the gap between the procedure arm and the hand-written-doc arm in the eval, and it's the next thing to build, not something built yet.

**How does it fail?** Three real, disclosed ways. One, calls before the first edit went up in every injected arm — agents re-check an injected claim before acting on it, so warm runs read a little more up front before they save on everything after. Two, one of the nine tasks fails in every arm, every runner, because the model writes `totalSpentCents` instead of the prompt's literal `totalCents`; the procedure schema has no slot for a literal field name, so no version of the injected context could have fixed it. Three, an earlier round's tokenizer let three boilerplate words shared by every prompt leak into the match score, and once pulled a wrong-shape procedure at a confident-looking score; found by checking a live trace against the store, fixed by stripping trailing punctuation before the stopword check.

**What's pre-existing?** Devin CLI, Claude Code and Codex are the three harnesses under test, all third-party, all disclosed. Node's built-in `zlib` gzip is the only thing the distance function depends on — no npm packages, no install step. Everything in `src/` was written during the hackathon weekend, in a new repo.
