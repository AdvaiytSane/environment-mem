# DejaDo console

The hosted console at https://headstart-demo.vercel.app/dash/enterprise. Next.js 16 app router pages, shadcn/ui on Tailwind 4, React Flow for the map, recharts for the savings chart. Every number on screen comes from a recorded agent session in the org's database.

## Layout

- `app/enterprise/` pages: overview, procedures (list and detail), graph (the map), agents, savings, evals (head to head), people, policy, audit, extraction (how it runs). `layout.tsx` is the shell, `nav.tsx` the sidebar, `parts.tsx` the shared pieces, `tour.tsx` the guided cards, `tw.css` the Tailwind theme scoped to `.ent`.
- `app/api/enterprise/` the JSON routes the pages and the CLI read.
- `lib/enterprise/` one reader per page (`*.ts`) and its pure math (`*-math.ts`). `scope.ts` holds the caller gate, the demo login, the 60 second per org cache and the demo rename pass.
- `components/ui/` shadcn components. `components.json`, `lib/utils.ts`, `hooks/use-mobile.ts`, `postcss.config.mjs` are their support files.
- `test/` unit tests for the math files, `bun test test/enterprise-*.test.ts`.
- `docs/ENTERPRISE-API.md` every response shape.

## Packages

```
radix-ui ^1.6.7, lucide-react ^1.47.0, class-variance-authority ^0.7.1, clsx ^2.1.1, tailwind-merge ^3.7.0
tailwindcss 4, @tailwindcss/postcss ^4.3.3
@xyflow/react ^12.11.6, @dagrejs/dagre ^3.1.1, recharts ^3.10.1
```

## Demo mode

`DEMO_MODE=1` signs every visitor into one seeded org server side with `DEMO_EMAIL` and `DEMO_PASSWORD`; writes answer 403. `NEXT_PUBLIC_DEMO_MODE=1` shows the read-only banner, `NEXT_PUBLIC_BRAND`, `NEXT_PUBLIC_BADGE` and `NEXT_PUBLIC_DEMO_ORG_NAME` set the wordmark, the badge and the line under it. See `docs/USE-CASE-PICKER.md` for turning that line into a picker.
