# Grok agent example

A small tool-using agent on Grok, through xAI's OpenAI-compatible chat
completions API. No dependencies: `examples/grok-agent.mjs` runs on Node 24
alone.

## Run it

```sh
XAI_API_KEY=sk-... node examples/grok-agent.mjs "Add a --json flag to the stats command"
```

Runs in the current directory. Set `XAI_MODEL` to use a model other than the
default, `grok-4`.

To post the finished session to the hosted store, also set
`HEADSTART_API_URL` and `HEADSTART_API_KEY` (or put them in this repo's
`.env`; `loadDotEnv` in `src/cli.ts` picks them up).

## What it does

- Gives the model three tools: `read_file`, `list_files`, `run_command` (a
  shell command, 60 second timeout), all scoped to the current directory.
- Before the first call to the model, it runs `headstart recall "<task>"
  --json` against this repo's own store (spawned by resolving `src/cli.ts`
  relative to this file, so it works from any checkout). If a procedure comes
  back, its steps are prepended to the system prompt as "A procedure that
  worked for a similar task". A failed or empty recall is ignored; it is a
  bonus, not a requirement.
- Loops on the model's tool calls until it replies with plain text, or 25
  turns pass.

## What is recorded

Every tool call, as `{ name, input, result }`, where `result` is `{ ok: true
}` for `read_file` and `list_files`, and `{ exit_code }` for `run_command`.
At the end it writes an `ExtractPayload` (session id, the task prompt,
`harness: 'grok'`, the tool calls, and `cost` built from the API's own
`usage.prompt_tokens` / `usage.completion_tokens`, the model name, and wall
time) to `.headstart/extract-<session>.json`, then runs `node src/cli.ts push
<that file>` if the API is configured.

## What is not recorded

The model's own reasoning or plain-text replies are not stored, only the
tool calls. Nothing is sent anywhere unless `HEADSTART_API_URL` and
`HEADSTART_API_KEY` are set; without them the payload is written to disk and
left there.

## Test

`test/grok-agent.test.js` imports the exported `buildExtractPayload` helper
and checks the payload shape. It makes no network call and does not need an
API key.
