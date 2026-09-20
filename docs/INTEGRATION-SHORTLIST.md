# Integrations that do not require Browser Use

Researched against primary documentation on September 19, 2026. These are integration candidates, not integrations we have executed or verified. Friction ratings below are our engineering assessment, assuming the host already has a working tool-using agent.

## Where the existing CLI fits

Keep one Memorable CLI and the general `store()` / `recall()` SDK. Framework packages should only connect lifecycle events, map traces, and insert returned reference material. Browser Use is one optional adapter; none of the candidates below depends on it.

A website can use this through its agent backend. Its frontend cannot run the local CLI. The current route needs a Node process that can spawn subprocesses, an installed Memorable CLI, and persistent storage accessible to subsequent runs. An ephemeral or edge-only deployment needs a persistent worker/sidecar or a future deployed HTTP retrieval API. Importing the SDK does not remove those requirements.

| Priority | Platform | Add-on shape | Friction | Concrete first demo |
| --- | --- | --- | --- | --- |
| 1 | Vercel AI SDK | Node SDK plus tool-execution wrappers and a run wrapper | Low for a Node worker | Fix a failing date-parser test, then fix a related input case in a fresh run using recalled steps. |
| 2 | LangChain | JavaScript middleware using the SDK; Python middleware using the shared CLI bridge | Low–medium | Diagnose a failing GitHub Actions job using API/log tools and local tests, then repeat for another failure of the same type. |
| 3 | Mastra | Node SDK plus input processor and completed-tool capture | Low–medium | Maintain a documentation website: find a broken internal link, edit the source, run its actual link checker, repeat on another page. |
| 4 | Pydantic AI | Python toolset wrapper plus run wrapper and the shared CLI bridge | Medium | Repair a CSV import mapping against a real parser, independently validate the resulting rows, then handle another file with the same schema problem. |

These are developer integrations in the agent application, not connectors to arbitrary websites. The examples use actual files, commands, or APIs; none requires browser automation. We should build AI SDK next if the objective is the smallest demonstration outside Browser Use.

## The actual connection points

**Vercel AI SDK.** `ToolLoopAgent.prepareCall` accepts asynchronous request preparation, so recall can run once before a task and contribute bounded reference context. Wrap each locally executed tool's `execute` function to record arguments, returned outcomes, and thrown errors. The documented `experimental_onToolCallFinish` can provide tool IDs and a success/error union, but it is explicitly experimental; pin a version if adopting it. Store after the surrounding `generate()` operation and independent verification finish; keep an outer error/finalization path for interrupted runs. A model-emitted call without execution is not a completed action. [Call options](https://ai-sdk.dev/docs/agents/configuring-call-options), [ToolLoopAgent reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent).

**LangChain.** JavaScript provides `beforeAgent`, `wrapModelCall`, `wrapToolCall`, and `afterAgent`. Recall in `beforeAgent`; use `wrapModelCall` to add cached reference material without mutating the original task. In `wrapToolCall`, record each actual handler invocation and its result/exception. Submit on a completed invocation, with an outer finalizer for thrown errors. Capture inside retry middleware so actual attempts remain observable, and give resumed tasks a stable logical run identity to avoid duplicate submissions. Python exposes the corresponding `before_agent`, `wrap_model_call`, `wrap_tool_call`, and `after_agent` hooks. This is a reusable middleware package, not a fork of LangChain. [JavaScript middleware](https://docs.langchain.com/oss/javascript/langchain/middleware/custom), [Python middleware](https://docs.langchain.com/oss/python/langchain/middleware/custom).

**Mastra.** `processInput()` runs before the loop; use it to insert recalled reference material once. `processInputStep()` is available if a later version needs state-sensitive resurfacing. For capture, the documented `generate()` result contains `steps`, `toolCalls`, and `toolResults`; join entries by `payload.toolCallId`, and read the actual arguments/results from `payload`. Add a local tool-execution wrapper if failed or interrupted attempts are not retained in those results. The run wrapper performs verification and store after completion. A return with `finishReason: 'suspended'` is waiting for approval, not a successful completed workflow. Its existing conversational memory can remain in place. [Processors](https://mastra.ai/docs/agents/processors), [Generate reference](https://mastra.ai/reference/agents/generate).

**Pydantic AI.** `WrapperToolset.call_tool()` is a documented execution wrapper with access to the tool name, arguments, run context, and actual returned result or exception. Use it around the host's function toolset. An outer run wrapper recalls before `agent.run()` and submits after a real terminal result and verification; `WrapperAgent` is a documented extension point for packaging this behavior. Python invokes the same CLI transport through a small bridge, rather than reimplementing retrieval. Deferred external tools need their eventual results joined before capture is complete; a `DeferredToolRequests` return is not proof that an external operation ran. [Toolset execution wrappers and deferred results](https://pydantic.dev/docs/ai/tools-toolsets/toolsets/), [Agent extension points](https://pydantic.dev/docs/ai/guides/extensibility/).

## Shared contract and proof required

Every adapter should accept the following developer configuration. These are **adapter settings**, not claims that every field already exists in the core SDK:

| Setting | How the adapter uses it |
| --- | --- |
| CLI executable, arguments, store location | Connect to the same configured Memorable installation and memory store across runs. |
| Original task | Becomes `task_description` on store and the main recall query. Do not replace it with the recalled procedure. |
| Session and invocation IDs | Map to `session_id` and optional `workflow_id`; keep distinct from a reusable workflow category. Preserve logical identity across retries. |
| Tool capture mapping | Preserve actual tool names and allowlisted arguments; derive `result.ok` / `result.exit_code` only from explicit host outcomes. |
| Completion verifier | Evaluate actual files, commands, or service responses. Keep agent-declared success separate from verified success. |
| Enable/consent setting and limits | Bound recall latency/context, minimize trace fields, and let the agent continue when memory is unavailable. |
| Applicability rules | Locally check project, tool availability, and preconditions before using a recalled procedure. Current query text is not an authorization or tenancy boundary. |

Today `store()` sends the CLI's documented envelope: `session_id`, optional `workflow_id` / `prompt`, `task_description`, `harness`, and `tool_calls[{name,input,result?}]`. The result object only exposes `ok` and `exit_code`. There is no general metadata filter, rich outcome schema, full-trace return, or typed recall-match list in this SDK. Keep richer framework metadata in the adapter's journal until an upstream contract supports it. In particular, custom non-shell tools may be reduced by the CLI's allowlisting/harness normalization; a working subprocess call alone does not establish useful capture. Do not label an unfamiliar tool schema as Claude Code just to bypass that limitation. See [the SDK implementation](../src/sdk/index.ts) and [the SDK plan](SDK-PLAN.md).

The general call sequence stays `recall({query})` → host task → `store(trace)`. A known procedure can be rendered with `recall({procedureId})`. The query path currently returns CLI text, so an adapter must not pretend it has structured candidates or automatically interpret that text as executable actions. A zero exit reports command completion, not a durable storage receipt.

For each candidate, proof requires two real agent runs: capture completed calls from the first; independently read back a stored procedure and compare its steps/outcomes with the actual work; start a fresh invocation against the same store; inspect the exact context delivered before the model acts; and verify the second task's result independently. Include a paraphrased query and an unrelated query, retain retrieval misses, and repeat with the CLI absent and the feature disabled. The [existing evidence report](verification/2026-09-19.md) already records a paraphrase miss; no candidate here should be advertised as verified until its own real run closes that gap.
