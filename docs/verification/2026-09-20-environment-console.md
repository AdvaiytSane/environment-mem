# Environment console verification — 2026-09-20

Site: https://memorable-workflow-studio.ahsane692499.chatgpt.site/ (existing owner-private access preserved).
Site source revision: `9712e578adf0712224c4e06a115aecc1dffa0245`.

The deployed console adopts the `src/ui/tokens.css` design language from Nikhil's dashboard: charcoal surfaces, hairline borders, compact monospace labels, blue interactions and mint result highlights. It centralizes saved environment definitions and three clearly recorded showcases.

## Actual production browser operations

- Created `Browser Use · pagination` with public repository `browser-use/browser-use`, task-complete capture, before-task recall, six default metadata roles plus `website` as a filter.
- Production returned the saved environment and showed seven fields, three eligibility filters, and awaiting-integration state.
- Reloaded the page and observed the same saved definition from the server.
- Edited the name to `Browser Use · quote pagination`; production acknowledged the update and the central overview showed it.
- Desktop layout measured viewport/body width1440; narrow-screen viewport/body width390. No horizontal document overflow in either observed layout.

## Local interaction and boundary checks

- Created another environment through the local browser, reloaded it, and observed persistence.
- Opened the Devin recording, selected `bugfix-2`, and changed projected monthly runs to2000. The dashboard showed two matched pairs, the token regression, static-document comparison, and3.6 projected agent-hours.
- Selected Browser Use's different-website control: zeroeligible, zeromatches, zerocontext, noqueryembedding, based on the checked-in recorded evidence.
- Anonymous environment API request rejected with401. Cross-origin mutation rejected with403.
- Owner-scoped SQL, fixed server timestamps, parameterized statements and optimistic updates used for environment records. Appended a schema-only D1 migration; existing workflow tables preserved.

## Boundaries

Environment creation persists configuration; it does not provision a runtime, installhooks, or open a telemetry connection. Runtime dashboard URLs open directly in the user's browser. Recorded Browser Use, Devin and dimOS evidence is separate from these new definitions. No liveagentstream is represented as connected. There is no measured dollar-savings claim. The existing Workflow Studio remains available at `/workflows`.

CLI regression checks also completed (64 checks); those verify code contracts and error handling, not production agent performance. The production persistence observations above are independent of those checks.
