# Connect a repository to Memorable

`headstart connect` inspects a repository and gives your existing coding assistant
a concrete integration handoff. `dejado connect` is the same command. It does not
run an onboarding model, install dependencies, read `.env`, or execute the repository.

First choose **which agent should remember**:

- `coding-agent`: Claude or Devin working on this repository. Native hooks capture
  the coding assistant; these do not connect an agent application inside the repo.
- `application`: Browser Use or another agent your application runs. A developer
  or coding assistant must connect its actual lifecycle to `store()` / `recall()`.
  A metadata definition alone does not create capture or injection hooks.

```sh
headstart connect --repo /path/to/app --target application
headstart connect --repo /path/to/app --target application --json
headstart connect --repo /path/to/app --target application --write
headstart connect --repo /path/to/app --target application --prompt
```

Inspection is read-only. The bounded scan reports dependency/import evidence and
candidate locations for capture, task completion, context injection and outcome
verification. It does not certify a framework or promise every repository has an
agent loop. Source snippets and credentials are not included in its JSON.

`--write` creates `.memorable/connection.json` (`memorable.connect.v1`) and
`.agents/skills/memorable-connect/SKILL.md`. Give the generated prompt to your
coding assistant or explicitly invoke the generated skill. Existing metadata and
custom manifest fields are retained; changing target/schema requires explicit
review. An existing unowned skill, malformed configuration or symlink output is
refused. Existing agent instructions and hooks are not overwritten by setup.

## Explicit coding-assistant setup

```sh
headstart connect --repo /path/to/project --target coding-agent --agent devin \
  --write --install-hooks --backend memorable
```

Only this explicit `--install-hooks` selection merges project hooks into
`.claude/settings.json`, using the existing installer. Both Claude and Devin read
that project file in the observed versions. Unrelated hooks/settings survive.
The backend setting is written to `.headstart/config.json`; a conflicting existing
backend is refused rather than silently changed. `--backend local` explicitly
selects the separate Headstart local demo engine. It is not the Memorable metadata
backend. Codex can be inspected, but `connect` does not mutate user-global Codex
settings or assume that the installed version supports the same hook surface.

Native host trust/approval, actual hook invocation and Memorable login still need
verification. Installation is not proof that any memory was stored or retrieved.

## Observe each stage separately

The JSON report contains `repo`, `target`, `frameworks`, `seams`, metadata role
defaults, `limitations`, `nextSteps`, `handoff` and a `status` object. A seam has
`kind`, `file`, `line`, `status` and `detail`; `line: 0` means a proposed config or
missing location, not an observed source line. Runtime status fields are
`captured`, `stored`, `retrieved`, `contextDelivered`; they remain `null` because
this inspector does not execute a verification run. `installed: true` is emitted
only after explicit hook configuration. `--write` alone leaves it `null`.

An observability page should show evidence for one real run and a fresh second
run: actual captured actions/outcomes, receipt, returned memory IDs, empty or
failed recalls, and the reference delivered in model input. A green install badge
cannot substitute for those stages. This command does not upload the report;
website import is a separate, explicit action.

The [metadata SDK](METADATA-MEMORY.md) requires the companion local Memorable CLI
patch; it is not in the published npm release. That path uses the existing local
encrypted store and configured embedding service. HTTP-only/ephemeral services
need a persistent CLI worker; hosted persistence is not provided by this setup.
Private fields are locally persisted, and raw capture/outbox journals can contain
them. Developers must redact trace/metadata and keep journals outside source control.

For an existing checkout use the committed [integration skill](../skills/memorable-connect/SKILL.md)
or [one-prompt handoff](AGENT-SETUP.md). Real Browser Use round-trip evidence remains
in [the verification report](verification/2026-09-19-metadata-browser.md).
