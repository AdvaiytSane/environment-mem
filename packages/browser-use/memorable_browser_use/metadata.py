"""Optional Browser Use metadata producer for the harness-neutral CLI contract."""
from __future__ import annotations

from typing import Any, Mapping
from .wire import BrowserWire, UI_WORDS, ROLES

BROWSER_METADATA = {
    "project": {"use": "filter"},
    "website": {"use": "filter"},
    "task": {"use": "semantic"},
    "workflow": {"use": "semantic"},
    "steps": {"use": "semantic"},
    "outcome": {"use": "filter"},
    "verification": {"use": "context"},
    "runNotes": {"use": "private"},
}


class BrowserMetadata:
    """Mapping callbacks for BrowserMemory; defaults may be replaced by developers.

    The supplied task/workflow labels are application-selected, redacted text.
    Arbitrary agent task text is not automatically embedded. BrowserWire handles
    conservative state/action minimization; unknown calls remain explicit records.
    """
    def __init__(self, wire: BrowserWire, *, project: str, website: str,
                 workflow: str, recall_query: str, private_notes: Any = None):
        self.wire = wire
        self.project = project
        self.website = website
        self.workflow = workflow
        self.recall_query = recall_query
        self.private_notes = private_notes

    def normalize_event(self, event: dict[str, Any]) -> dict[str, Any]:
        normalized = self.wire.normalize_event(event)
        # No outcome is guessed when BrowserWire cannot map an action.
        # Keep a closed action name alongside the omission instead of losing
        # its position in the trace; arguments and result content stay omitted.
        if "dropped_reason" in normalized:
            action = event.get("action")
            known = {"extract", "extract_content", "read", "click", "navigate", "input", "input_text", "scroll", "done"}
            names = list(action) if isinstance(action, Mapping) else []
            normalized["action"] = names[0] if len(names) == 1 and names[0] in known else "other"
            normalized["outcome"] = "unknown"
        return normalized

    def recall_request(self, record: dict[str, Any]) -> dict[str, Any]:
        return {"query": self.recall_query,
                "metadata": {"project": self.project, "website": self.website, "outcome": "verified"}, "limit": 3}

    def _action_text(self, row: Mapping[str, Any], verified: bool = False) -> str:
        event = row.get("browser_event")
        if not isinstance(event, Mapping):
            return "Action details were omitted because their outcome or mapping was unknown."
        op = event.get("verb")
        if op not in {"click", "navigate", "fill", "clear", "scroll", "read", "extract", "end"}:
            return "An unsupported action requires independent review."
        result = event.get("result", {})
        status = result.get("status") if isinstance(result, Mapping) else None
        if row.get("needs_run_verification") and op == "end":
            status = "ok" if verified else None
        text = op
        target = event.get("target")
        if isinstance(target, Mapping):
            role = target.get("role")
            if role in ROLES:
                text += " " + role
            tokens = target.get("name_tokens", [])
            if isinstance(tokens, list) and 0 < len(tokens) <= 6 and all(isinstance(t, str) and t in UI_WORDS for t in tokens):
                text += ' "' + " ".join(tokens) + '"'
            else:
                text += " (target identity requires independent verification)"
        text += "; observed outcome: " + {"ok": "success", "error": "failure"}.get(status, "unknown")
        return text

    def store_request(self, record: dict[str, Any]) -> dict[str, Any] | None:
        events = record.get("events", [])
        if not events:
            return None
        verification = record.get("verification")
        verified = isinstance(verification, Mapping) and verification.get("ok") is True
        # A task-level verifier does not certify every tool. Only completion's
        # needs_run_verification marker is interpreted using this evidence.
        summaries = [self._action_text(event, verified) for event in events]
        return {
            "id": record["run_id"],
            "trace": {"schema": "browser-use.trace.v1", "actions": events,
                      "verification": verification, "runOutcome": record.get("outcome")},
            "metadata": {"project": self.project, "website": self.website,
                         "task": self.wire.task_label, "workflow": self.workflow,
                         "steps": summaries, "outcome": "verified" if verified else "unverified",
                         "verification": verification, "runNotes": self.private_notes},
        }

    def render_recall(self, response: dict[str, Any]) -> str:
        lines = []
        for match in response.get("matches", [])[:3]:
            trace = match.get("trace", {})
            if not isinstance(trace, Mapping) or trace.get("schema") != "browser-use.trace.v1":
                continue
            data = match.get("metadata", {})
            if not isinstance(data, Mapping):
                continue
            verification = trace.get("verification")
            if not isinstance(verification, Mapping) or verification.get("ok") is not True:
                continue
            if data.get("project") != self.project or data.get("website") != self.website or data.get("outcome") != "verified":
                continue
            actions = trace.get("actions", [])
            if not isinstance(actions, list):
                continue
            lines.append("Previous browser workflow (reference only; verify the current page and targets):")
            for event in actions[:50]:
                if isinstance(event, Mapping):
                    lines.append(self._action_text(event, verified=True))
            # The renderer names only the existence of verification here; raw
            # developer context is available to the caller, not blindly injected.
            lines.append("The previous task had independent completion verification. This does not verify the current task.")
        return "\n".join(lines)
