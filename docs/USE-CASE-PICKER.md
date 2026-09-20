# Use case picker

Note for whoever picks this up next. The console currently says "Devin" under the DejaDo wordmark. This is where that lives and how to turn it into a picker.

## Where the name is

- `apps/dashboard/app/enterprise/layout.tsx`, line 20. The value is `org`: it reads the env var `NEXT_PUBLIC_DEMO_ORG_NAME`, then falls back to "Devin" in demo mode, then to the workspace name from the database (that is where "Northwind Platform" came from).
- It is rendered by `SideNav` in `apps/dashboard/app/enterprise/nav.tsx`, line 43: the small uppercase line under the wordmark.
- The live site (Vercel project `headstart-demo`) sets `NEXT_PUBLIC_DEMO_ORG_NAME=Devin`. Change it with `vercel env` and redeploy.

## What to build

Replace that line with a dropdown that picks the use case. Each choice is an environment: which agent produced the sessions, which tasks show in the Run panel, which setup steps the tour shows.

1. New client component `apps/dashboard/app/enterprise/use-case.tsx` on shadcn `Select` (`components/ui/select.tsx`, already installed). Render it in `nav.tsx` in place of the `org` line.
2. Options, in this order: Devin, Claude Code, Cursor, Browser use, Computer use, Search agents. Put the list in one file, `apps/dashboard/lib/enterprise/use-cases.ts`, as `{ id, name, harness, tasks, setup }` so pages read it instead of hardcoding names.
3. Store the choice in a cookie named `dejado_use_case`. Read it in `layout.tsx` and pass it down as a prop. A URL param is fine too if you want links to carry it.
4. Filter the data by it. Every session row has a `harness` column (see `lib/enterprise/types.ts`, `harnessName`) that says which agent recorded it: `devin`, `devin-cloud`, `claude`, `codex`, `cursor`, `browser` (the full map is `HARNESS_NAME` in that file). Pass the chosen harness into the readers in `lib/enterprise/*.ts` the same way `used=month` is passed today (`app/api/enterprise/procedures/route.ts`).
5. Browser use, Computer use and Search agents have no recorded sessions yet. For those, render the existing `Empty` component (`app/enterprise/parts.tsx`) with one line: "Connect this agent to start recording" and a link to `/enterprise/extraction` (How it runs).
6. The CLI already takes the agent as a flag: `headstart demo --agent devin|claude --task <id>` and `headstart run --agent claude|devin`. When the picker changes, the Run panel should pass the matching `--agent`.

## Later: question flow instead of a dropdown

The dropdown is the fast path. The friendlier version is a short question flow on first visit: "What do you want to set up?" then one screen per answer (Devin: install the hooks; Claude Code: add the plugin; Cursor: add the rules file; browser or computer use: point the recorder at the agent's action log). Same list from `use-cases.ts`, so both stay in sync. Keep the dropdown in the sidebar so people can switch without redoing the flow.
