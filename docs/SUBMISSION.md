# Plume write-up (draft, numbers filled in after the eval)

Project: headstart
Track: none
Sponsor challenges: Cognition (Best Use of Devin), OpenAI, The Token Company, Warp

## Inspiration

Every coding-agent session on a repo starts by rediscovering the same things: how to run the tests, where routes get registered, which table a CLI flag has to be declared in. On a fleet of sessions that discovery is paid for every time.

## What it does

headstart records what a session actually did through the agent's own hook file (Claude Code, Devin CLI and Codex all read it), turns the tool calls into a short procedure with no model in the loop, and hands the procedure to the next session on the same repo before its first prompt. It also writes the same procedures as SKILL.md files that Devin, Warp and Codex discover on their own. `headstart eval` measures the difference on nine tasks, four arms, two runners.

## How we built it

Node 24, no dependencies. Claude Code built the CLI and the eval fixture (a 125-file Node service with seeded bugs and hidden tests).

TODO before submitting, and only if true: the Cognition and OpenAI challenges judge how Devin and Codex helped build the project. Give Devin and Codex real pieces on Sunday morning (candidates: the console page, the Devin cloud adapter, a second fixture) and name them here with the session links.

## Numbers

Claude Code runner, sonnet, 9 tasks, 18 runs per arm, three rounds (results/claude-sonnet-r1, r2, r3). Every arm passes every hidden test.

| arm | context tokens | tool calls | cost per session |
|---|---|---|---|
| cold | 937,931 | 16.6 | $0.394 |
| procedure injection | -18% (round 2), -21% (round 1) | -9% (r2), -13% (r1) | -7% (r2), -12% (r1) |
| hand-written AGENTS.md, control | -25% | -26% | -13% |
| generated AGENTS.md from procedures | -11% | -8% | -2% |

A recorded procedure handed to the next session saves about a tenth of the tool calls and 7 to 12% of the cost with nothing written by hand. A person's four-line repo doc still saves twice that; the doc states the mechanism, the recording states what changed together. At n=18 the 95% interval on the cost delta is about the size of the effect. Devin CLI runs (free model, 66 clean) point the same way at -10% context tokens but with high variance; not on the slide.

## Challenges

Devin bills in ACU, not tokens, so the report shows minutes and ACU next to tokens. "Warm start" is Cognition's term for sandbox pools, so the project was renamed on Saturday afternoon. A hand-written AGENTS.md is the honest baseline, so it is an arm in the eval, not a footnote.

## What we learned

Discovery calls are the part of a trace that repeats, and a recording of them helps the next session, but less than a person's explanation of why. Injected context is checked before it is trusted: calls before the first edit went up in every injected arm. The next thing to build is the sentence a person would write, derived from the recording.

## Prior work, disclosed

Everything in the headstart repo was written during HackMIT 2026. Devin CLI, Claude Code and Codex are the harnesses under test.
