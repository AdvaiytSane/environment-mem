# Use case picker

Built. The sidebar of the hosted console (https://headstart-demo.vercel.app/dash/enterprise) has a picker under the wordmark: Devin, Claude Code, Codex, Browser Use, Dimensional, Custom agent. Every page shows that use case's sessions. Environments lists its recorded environments (with a replay player for Browser Use and Dimensional) and lets a visitor define a new one.

## Where it lives (apps/dashboard in the console source)

- `lib/enterprise/use-cases.ts`: the list. One entry per use case: `harnesses` (the ids sessions carry), `connection` (how it connects, the command, the doc path in this repo), `evidence` (which recording ships), `sampleTasks`. Add a use case here and it appears in the picker, on Environments and on How it runs.
- `app/enterprise/use-case.tsx`: the picker. Writes the cookie `dejado_use_case` through `POST /api/enterprise/use-case`, then refreshes.
- `lib/enterprise/scope.ts`: `enterprisePage()` and `enterprise()` return `useCase`; every reader takes `harnesses?: string[]` and filters sessions before any math; every API route takes `?use_case=<id>`.
- `app/enterprise/environments/`: the page, the replay player (`player.tsx`), the add dialog (`add.tsx`, saved in the browser; connecting is done from the CLI). Recordings come from `public/evidence/` (copied from `apps/workflow-studio/public/evidence` in this repo).
- `app/enterprise/extraction/page.tsx`: "Ways to connect", every path in the merged CLI and SDK.

## Adding a use case

1. Add the entry to `USE_CASES` with its harness ids and connect command.
2. Record sessions with that harness id (hooks, SDK `store()`, or `POST /v1/extract`); they show up under that use case within a minute.
3. Optional: drop a `memorable.replay.v1` recording under `public/evidence/replays/<id>/replay.json` with its frames and set `evidence.replay` on the entry.
