"""Optional, conservative mapping to Memorable's browser wire contract.

This module is independent of Browser Use and performs no I/O. Supply observed
DOM/accessibility nodes to ``snapshot``; do not substitute a URL-only fixture.
The caller owns consent, salt persistence, task-label selection, and verification.
Only closed UI labels may remain readable. Page text, typed values, selectors,
full URLs, and error text never enter the returned service bodies.

This normalizer uses a stricter label/path gate than other Memorable adapters.
Use the same normalizer and stable salt across runs; cross-adapter fingerprint
equivalence is not promised. The server can refuse a different salt_id. Never
silently regenerate a salt or treat a salt mismatch as an empty recall result.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
import unicodedata
import uuid
from collections import Counter
from datetime import datetime, timezone
from typing import Any, Callable, Mapping, Sequence
from urllib.parse import unquote, urljoin, urlsplit


ROLES = frozenset("button link textbox searchbox combobox listbox option checkbox radio switch slider spinbutton menuitem menuitemcheckbox menuitemradio tab tabpanel dialog alertdialog alert status progressbar table row cell columnheader rowheader grid gridcell list listitem tree treeitem heading img form navigation main banner contentinfo complementary region article group toolbar tooltip separator generic unknown".split())
INTERACTIVE = frozenset("button link textbox searchbox combobox listbox option checkbox radio switch slider spinbutton menuitem menuitemcheckbox menuitemradio tab".split())
LANDMARKS = frozenset("banner navigation main contentinfo complementary region form dialog alertdialog table grid list tree toolbar".split())
# An exact vocabulary gate, not a guess that arbitrary short page text is safe.
UI_WORDS = frozenset("add remove delete save cancel submit send confirm close open edit update create new next previous back continue search filter sort apply clear reset refresh download upload import export copy paste print share invite sign log in out up to from the a an and or of for all more less show hide view select choose pick set start stop pause resume retry approve reject decline accept archive restore duplicate move rename settings account profile help menu home cart checkout order refund reason amount quantity date name email address phone note".split())
SENSITIVE = ("password", "passwd", "passphrase", "pin", "otp", "onetimecode", "verificationcode", "securitycode", "cvv", "cvc", "cardnumber", "creditcard", "debitcard", "expiry", "expiration", "ssn", "socialsecurity", "taxid", "routingnumber", "accountnumber", "iban", "swift", "sortcode", "apikey", "accesstoken", "secretkey", "privatekey", "recoverykey", "seedphrase", "mnemonic", "dateofbirth", "dob")
INPUT_TYPES = frozenset("text email url tel number search date datetime-local month week time range color file checkbox radio submit button hidden password unknown".split())
ACTION_VERBS = {"navigate": "navigate", "go_to_url": "navigate", "click": "click", "click_element": "click", "input": "fill", "input_text": "fill", "scroll": "scroll", "read": "read", "extract": "extract", "extract_content": "extract", "done": "end"}


def _role(value: Any) -> str:
    text = str(value or "").lower()
    return text if text in ROLES else "unknown"


def _name(value: Any) -> str:
    text = unicodedata.normalize("NFKC", str(value or ""))
    text = re.sub("[\u200b-\u200d\ufeff]", "", text)
    text = re.sub("[\u2190-\u21ff\u2700-\u27bf\U0001f000-\U0001faff]", " ", text)
    text = " ".join(text.split())
    while text and (text[0].isspace() or unicodedata.category(text[0]).startswith("P")):
        text = text[1:]
    while text and (text[-1].isspace() or unicodedata.category(text[-1]).startswith("P")):
        text = text[:-1]
    return text.lower()[:200]


def _depth(value: Any) -> int:
    number = _number(value, 0)
    return 0 if number < 8 else 1 if number < 16 else 2 if number < 32 else 3


def _number(value: Any, default: float = 0) -> float:
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) else default


def _time(value: Any) -> str:
    if not isinstance(value, str):
        raise ValueError("observed_timestamp_required")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("timestamp_timezone_required")
    return parsed.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _verified(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    if isinstance(value, Mapping):
        if isinstance(value.get("ok"), bool):
            return value["ok"]
        if value.get("status") in {"passed", "verified", "succeeded"}:
            return True
        if value.get("status") in {"failed", "error"}:
            return False
    return None


class BrowserWire:
    """Mapping callbacks accepted by ``BrowserMemory``.

    ``task_label`` is a developer-selected description of the workflow, without
    end-user values. ``verify_action`` must inspect real execution evidence and
    return True/False/None; returning None means the outcome remains unknown.
    A complete tool return, nonempty text, or agent success claim is insufficient.

    ``snapshot`` requires an HTTP(S) URL, a positive viewport width, and a list
    of observed nodes. Each node has role/name/depth; optional ref or index maps
    Browser Use's numeric target to a semantic descriptor. Optional href is used
    locally to verify link navigation. All raw strings are discarded afterwards.
    """

    def __init__(self, *, label_salt: str | bytes, task_label: str, instance_id: str,
                 allowed_path_segments: Sequence[str] = (),
                 verify_action: Callable[[dict[str, Any]], bool | None] | None = None,
                 runtime_version: str = "unknown"):
        if isinstance(label_salt, str):
            if not label_salt:
                raise ValueError("stable_label_salt_required")
            self._salt = hashlib.sha256(label_salt.encode()).digest()
        elif isinstance(label_salt, bytes) and len(label_salt) >= 16:
            self._salt = label_salt
        else:
            raise ValueError("label_salt_must_be_secret_text_or_at_least_16_bytes")
        self.salt_id = hashlib.sha256(self._salt).hexdigest()[:8]
        if not isinstance(task_label, str) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9 ,.'()_-]{0,199}", task_label):
            raise ValueError("task_label_requires_a_short_developer_selected_description")
        if re.search(r"\d{4,}|[a-f0-9]{16,}", task_label, re.I) or any(word in task_label.lower().replace("_", "").replace("-", "") for word in ("password", "secret", "token", "apikey")):
            raise ValueError("task_label_may_contain_sensitive_data")
        self.task_label = task_label
        self.instance_id = str(uuid.UUID(instance_id))
        if not isinstance(runtime_version, str) or not re.fullmatch(r"[A-Za-z0-9.+_-]{1,40}", runtime_version):
            raise ValueError("invalid_runtime_version")
        self.runtime_version = runtime_version
        self.allowed_path_segments = frozenset(str(part).lower() for part in allowed_path_segments)
        if any(not re.fullmatch(r"[a-z][a-z._-]{0,31}", part) for part in self.allowed_path_segments):
            raise ValueError("route_allowlist_must_contain_static_words")
        for part in self.allowed_path_segments:
            compact = re.sub(r"[._-]", "", part)
            if any(word in compact for word in SENSITIVE + ("secret", "token", "bearer", "credential")):
                raise ValueError("route_allowlist_may_contain_sensitive_data")
        self.verify_action = verify_action
        self.diagnostics: list[dict[str, Any]] = []

    def _hash(self, value: str) -> str:
        return hashlib.sha256(self._salt + value.encode()).hexdigest()[:16]

    def _label(self, value: Any) -> tuple[str, list[str], str]:
        normalized = _name(value)
        if not normalized:
            return "empty", [], ""
        digest = self._hash(" " + normalized)
        compact = re.sub(r"[\s_-]", "", normalized)
        if any(word in compact for word in SENSITIVE):
            return "sensitive", [], digest
        tokens = normalized.split()
        if len(normalized) <= 64 and len(tokens) <= 6 and all(token in UI_WORDS for token in tokens):
            return "chrome_safe", tokens, digest
        return "content_like", [], digest

    def _url(self, url: str) -> tuple[str, str, str]:
        parsed = urlsplit(url)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError("http_origin_required")
        host = parsed.hostname.lower()
        port = parsed.port
        origin = f"{parsed.scheme}://{host}" + (f":{port}" if port and (parsed.scheme, port) not in {("http", 80), ("https", 443)} else "")
        if len(origin) > 253 or not re.fullmatch(r"https?://[a-z0-9.-]+(?::\d+)?", origin):
            raise ValueError("unsupported_origin")
        segments = [unquote(part).lower() for part in parsed.path.split("/") if part]
        path = "/" + "/".join(part if part in self.allowed_path_segments else ":seg" for part in segments[:12])
        if len(segments) > 12:
            # :more is not a fixed point of the deployed validator's templater.
            raise ValueError("path_exceeds_twelve_segments")
        if len(path) > 200:
            raise ValueError("path_shape_too_long")
        canonical = origin + (parsed.path or "/") + ("?" + parsed.query if parsed.query else "") + ("#" + parsed.fragment if parsed.fragment else "")
        return origin, path, self._hash(canonical)

    def snapshot(self, raw: Mapping[str, Any]) -> dict[str, Any]:
        """Reduce real observations to a journal-safe fingerprint and local refs."""
        if not isinstance(raw, Mapping) or not isinstance(raw.get("nodes"), list):
            raise ValueError("observed_nodes_required")
        width = _number(raw.get("viewport_width"))
        if width <= 0:
            raise ValueError("observed_viewport_required")
        nodes = raw["nodes"]
        if any(not isinstance(node, Mapping) for node in nodes):
            raise ValueError("nodes_must_be_objects")
        # Accept the ready-made collector's HTML attribute observations without
        # carrying the free-form attribute dictionary into retained state.
        converted = []
        for source in nodes:
            node = dict(source)
            attrs = source.get("attrs", {})
            if isinstance(attrs, Mapping):
                for source_key, target_key in {"aria-disabled": "disabled", "aria-required": "required", "aria-readonly": "readonly", "aria-checked": "checked", "aria-expanded": "expanded", "aria-selected": "selected", "aria-busy": "busy"}.items():
                    if target_key not in node and attrs.get(source_key) in {"true", "false", True, False}:
                        node[target_key] = attrs[source_key] in {"true", True}
                if "inputType" not in node and attrs.get("type") in INPUT_TYPES:
                    node["inputType"] = attrs["type"]
            converted.append(node)
        nodes = converted
        origin, path, url_sha = self._url(str(raw.get("url", "")))
        histogram: Counter[str] = Counter()
        shingles: Counter[str] = Counter()
        landmarks: list[str] = []
        targets: dict[str, Any] = {}
        roles = [_role(node.get("role")) for node in nodes]
        for node, role in zip(nodes, roles):
            if role not in {"unknown", "generic"}:
                histogram[role] += 1
            if role in LANDMARKS and len(landmarks) < 16:
                landmarks.append(role)
            disposition, tokens, digest = self._label(node.get("name"))
            container = _role(node["containerRole"]) if node.get("containerRole") else None
            if role in INTERACTIVE | LANDMARKS:
                name_key = " ".join(tokens) if disposition == "chrome_safe" else digest
                shingles[role + name_key + ("0" if node.get("disabled") is True else "1") + str(_depth(node.get("depth"))) + (container or "-")] += 1
            ref = node.get("ref", node.get("index"))
            if ref is None or not re.fullmatch(r"[0-9]{1,10}", str(ref)):
                continue
            attrs = {key: node[key] for key in ("disabled", "required", "readonly", "checked", "expanded", "selected", "multiple") if isinstance(node.get(key), bool)}
            if isinstance(node.get("inViewport"), bool):
                attrs["in_viewport"] = node["inViewport"]
            if node.get("inputType"):
                attrs["input_type"] = node["inputType"] if node["inputType"] in INPUT_TYPES else "unknown"
            target = {"role": role, "name_tokens": tokens, "name_sha": digest, "name_disposition": disposition,
                      "selector_shape": "css_structural", "test_id": None, "depth_bucket": _depth(node.get("depth")),
                      "ordinal": min(63, max(0, int(_number(node.get("ordinal"))))),
                      "sibling_count": min(63, max(0, int(_number(node.get("sibling_count"))))),
                      "container_role": container, "container_name_sha": self._label(node.get("containerName"))[2] or None,
                      "attrs": attrs}
            entry: dict[str, Any] = {"target": target}
            if node.get("href"):
                try:
                    entry["href_sha"] = self._url(urljoin(str(raw["url"]), str(node["href"])))[2]
                except ValueError:
                    pass
            targets[str(ref)] = entry
        accumulator = [0.0] * 64
        for shingle, count in shingles.items():
            digest = int.from_bytes(hashlib.sha256(self._salt + shingle.encode()).digest()[:8], "big")
            weight = 1 + math.log2(count)
            for index in range(64):
                accumulator[index] += weight if digest & (1 << (63 - index)) else -weight
        simhash = sum(1 << (63 - index) for index, weight in enumerate(accumulator) if weight > 0)
        names = [str(node.get("name") or "").lower() for node in nodes]
        def named(role_set: set[str], needles: tuple[str, ...]) -> bool:
            return any(role in role_set and any(needle in name for needle in needles) for role, name in zip(roles, names))
        flags = {"modal_open": any(role in {"dialog", "alertdialog"} for role in roles),
                 "form_present": any(role in {"form", "textbox", "searchbox", "combobox"} for role in roles),
                 "auth_wall": any(node.get("inputType") == "password" for node in nodes) or named({"alert", "heading"}, ("sign in", "log in", "session expired")),
                 "error_banner": named({"alert", "status"}, ("error", "failed", "invalid", "problem", "wrong")),
                 "empty_state": bool(set(roles) & {"list", "grid", "table", "tree"}) and not bool(set(roles) & {"listitem", "row", "gridcell", "treeitem", "option"}),
                 "loading": "progressbar" in roles or any(node.get("busy") is True for node in nodes),
                 "captcha": any(any(word in name for word in ("captcha", "verify you are human", "are you a robot")) for name in names)}
        state = {"fingerprint": {"v": 1, "origin": origin, "path_shape": path,
                 "affordance_simhash": f"{simhash:016x}", "skeleton_hash": self._hash("".join(sorted(shingles))),
                 "role_histogram": {role: min(count, 999) for role, count in sorted(histogram.items(), key=lambda item: (-item[1], item[0]))[:24]},
                 "landmarks": landmarks, "flags": flags,
                 "viewport": "xs" if width < 480 else "sm" if width < 768 else "md" if width < 1024 else "lg" if width < 1440 else "xl",
                 "affordance_count": sum(shingles.values()), "salt_id": self.salt_id},
                 "targets": targets, "url_sha": url_sha, "settled": raw.get("settled") is True}
        for key in ("scroll_x", "scroll_y"):
            if isinstance(raw.get(key), (int, float)) and not isinstance(raw[key], bool) and math.isfinite(raw[key]):
                state[key] = raw[key]
        return state

    def _fingerprint(self, state: Any) -> dict[str, Any]:
        if not isinstance(state, Mapping) or not isinstance(state.get("fingerprint"), dict):
            raise ValueError("observed_fingerprint_required")
        fingerprint = state["fingerprint"]
        expected = {"v", "origin", "path_shape", "affordance_simhash", "skeleton_hash", "role_histogram", "landmarks", "flags", "viewport", "affordance_count", "salt_id"}
        if set(fingerprint) != expected:
            raise ValueError("unexpected_fingerprint_fields")
        if fingerprint.get("salt_id") != self.salt_id:
            raise ValueError("salt_mismatch")
        return fingerprint

    def normalize_event(self, raw: dict[str, Any]) -> dict[str, Any]:
        """Do not retain raw action arguments, output text, or exception text."""
        if raw.get("phase") != "finished":
            return {"wire_phase": "attempted"}
        action = raw.get("action")
        if not isinstance(action, Mapping) or len(action) != 1:
            return {"dropped_reason": "unsupported_action_shape"}
        name, arguments = next(iter(action.items()))
        verb = ACTION_VERBS.get(name)
        if verb is None:
            return {"dropped_reason": "unsupported_verb"}
        arguments = arguments if isinstance(arguments, Mapping) else {}
        if verb == "fill" and arguments.get("text") == "" and arguments.get("clear", True) is True:
            verb = "clear"
        before = raw.get("before_state")
        after = raw.get("after_state")
        try:
            before_fp = self._fingerprint(before)
            after_fp = self._fingerprint(after) if after else None
        except ValueError as error:
            return {"dropped_reason": str(error)}
        result = raw.get("result") if isinstance(raw.get("result"), Mapping) else {}
        error_class = None
        status = None
        if raw.get("status") in {"raised", "cancelled"} or result.get("error"):
            status, error_class = "error", "cancelled" if raw.get("status") == "cancelled" else "unknown"
        target_entry = before.get("targets", {}).get(str(arguments.get("index")), {})
        targeted = verb in {"click", "fill", "clear"}
        target = target_entry.get("target") if targeted else None
        if targeted and target is None and status is None:
            return {"dropped_reason": "target_not_observed"}
        value = None
        if verb in {"fill", "clear"}:
            sensitive = bool(target and (target.get("name_disposition") == "sensitive"
                                        or target.get("attrs", {}).get("input_type") == "password"))
            # Without a known target, an explicit failed input may have been
            # aimed at a secret field. Do not classify it as ordinary text.
            value = ({"kind": "secret", "from_parameter": None} if sensitive or target is None
                     else {"kind": "text", "pattern": None, "from_parameter": None})
        if status is None and raw.get("status") == "returned":
            verified = self.verify_action(raw) if self.verify_action else None
            if verified is not None and not isinstance(verified, bool):
                raise ValueError("verify_action_must_return_boolean_or_none")
            if verified is None and verb == "navigate" and after:
                try:
                    verified = self._url(str(arguments.get("url", "")))[2] == after.get("url_sha") or None
                except ValueError:
                    pass
            if verified is None and verb == "click" and after and before.get("url_sha") != after.get("url_sha"):
                verified = target_entry.get("href_sha") == after.get("url_sha") or None
            if verified is None and verb == "scroll" and after:
                changed = any(key in before and key in after and before[key] != after[key] for key in ("scroll_x", "scroll_y"))
                verified = True if changed else None
            if verified is True:
                status = "ok"
            elif verified is False:
                status, error_class = "error", "assertion_failed"
        if status is None and verb != "end":
            return {"dropped_reason": "outcome_unknown"}
        # Completion requires the run-level independent verifier, applied later.
        started, finished = _time(raw["started_at"]), _time(raw["finished_at"])
        latency = max(0, (datetime.fromisoformat(finished.replace("Z", "+00:00")) - datetime.fromisoformat(started.replace("Z", "+00:00"))).total_seconds() * 1000)
        navigated = bool(after and before.get("url_sha") != after.get("url_sha"))
        event = {"schema_version": "1.0.0", "event_id": str(uuid.UUID(raw["call_id"])),
                 "seq": raw["sequence"], "at": started, "actor": "agent", "verb": verb,
                 "target": target, "value": value, "result": {"status": status, "error_class": error_class,
                 "settled": bool(after and after.get("settled") is True), "navigations": int(navigated), "http_status_class": None},
                 "before": before_fp, "after": after_fp if after and after.get("settled") is True else None,
                 "expected_after": None, "validation": "not_validated", "origin": before_fp["origin"],
                 "path_shape": before_fp["path_shape"], "frame_depth": 0, "frame_origin": None,
                 "latency_ms": latency, "retry_index": 0,
                 "policy": {"decision": "evaluate", "rules_hit": [], "approved_by_human": False},
                 "redaction": {"fields_redacted": len(arguments) + len(result), "rules_fired": ["closed_fields"], "salt_id": self.salt_id}}
        return {"browser_event": event, "needs_run_verification": status is None}

    def _runtime(self) -> dict[str, Any]:
        return {"runtime": "browser_use", "sdk_version": self.runtime_version, "adapter_version": "0.1.0",
                "instance_id": self.instance_id, "program_versions": ["1.0.0"],
                # No deterministic executor is implemented by this capture add-on.
                "capabilities": [], "limits": {}, "policy_enforcement": []}

    def recall_request(self, record: dict[str, Any]) -> dict[str, Any]:
        fingerprint = self._fingerprint(record.get("initial_state"))
        return {"task": self.task_label, "origin": fingerprint["origin"], "state": fingerprint,
                "recent_states": [], "runtime": self._runtime(), "parameters": {"known": [], "unavailable": []},
                "constraints": {"min_confidence": 0.7, "resume_from": None},
                "client_run_id": str(uuid.UUID(record["run_id"]))}

    def store_request(self, record: dict[str, Any]) -> dict[str, Any] | None:
        fingerprint = self._fingerprint(record.get("initial_state"))
        run_id = str(uuid.UUID(record["run_id"]))
        success = _verified(record.get("verification"))
        events, dropped = [], []
        for retained in record.get("events", []):
            if not isinstance(retained, Mapping) or "browser_event" not in retained:
                dropped.append(str(retained.get("dropped_reason", "normalization_missing")) if isinstance(retained, Mapping) else "normalization_missing")
                continue
            event = {**retained["browser_event"], "run_id": run_id}
            if retained.get("needs_run_verification"):
                if success is None:
                    dropped.append("outcome_unknown")
                    continue
                event["result"] = {**event["result"], "status": "ok" if success else "error", "error_class": None if success else "assertion_failed"}
            # Refuse a broken/mixed normalizer rather than hiding salt mismatch.
            if event["before"]["salt_id"] != self.salt_id:
                raise ValueError("salt_mismatch")
            if len(json.dumps(event, separators=(",", ":")).encode()) > 8192:
                dropped.append("event_oversize")
                continue
            events.append(event)
        if len(events) > 1000:
            raise ValueError("single_batch_limit_exceeded")
        if dropped:
            self.diagnostics.append({"stage": "wire", "dropped": len(dropped), "reasons": dict(Counter(dropped))})
        if not events:
            self.diagnostics.append({"stage": "wire", "reason": "no_verified_events"})
            return None
        run = {"client_run_id": run_id, "task_label": self.task_label, "runtime": self._runtime(),
               "execution_mode": "agent", "resolve_id": None, "origin": fingerprint["origin"],
               "started_at": _time(record["started_at"])}
        if success is not None:
            run["outcome"] = "succeeded" if success else "failed"
        body: dict[str, Any] = {"run": run, "events": events, "final": True}
        if dropped:
            # The wire has no outcome_unknown reason. Use the documented coarse
            # bucket and retain the precise reason in local diagnostics above.
            body["dropped"] = {"count": len(dropped), "since": run["started_at"], "reason": "policy_filtered"}
        return body

    def render_recall(self, response: dict[str, Any]) -> str:
        """Render a server program as reference only; never execute its steps."""
        if response.get("error"):
            raise ValueError("salt_mismatch" if response.get("error") == "salt_mismatch" else "browser_recall_refused")
        body = response.get("body", response)
        if isinstance(body, Mapping) and body.get("error") == "salt_mismatch":
            raise ValueError("salt_mismatch")
        if not isinstance(body, Mapping) or body.get("decision") not in {"complete", "partial"}:
            return ""
        program = body.get("program")
        if not isinstance(program, Mapping) or not isinstance(program.get("steps"), list):
            return ""
        # Only closed action/role/name tokens and checked URL shapes are rendered;
        # never task strings, parameter values, selector literals or error text.
        lines = []
        for step in program["steps"][:50]:
            if not isinstance(step, Mapping):
                continue
            verb = step.get("op", step.get("verb"))
            if verb not in set(ACTION_VERBS.values()) | {"clear", "scroll_to", "assert", "wait_for"}:
                continue
            label = verb
            selector = step.get("target")
            if isinstance(selector, Mapping) and isinstance(selector.get("strategies"), list):
                for strategy in selector["strategies"]:
                    if not isinstance(strategy, Mapping):
                        continue
                    role = strategy.get("role")
                    if role in ROLES:
                        label += " " + role
                    matcher = strategy.get("name")
                    tokens = matcher.get("tokens", []) if isinstance(matcher, Mapping) else []
                    if isinstance(tokens, list) and tokens and len(tokens) <= 6 and all(isinstance(token, str) and token in UI_WORDS for token in tokens):
                        label += ' "' + " ".join(tokens) + '"'
                    if role in ROLES:
                        break
            postcondition = step.get("postcondition")
            if isinstance(postcondition, Mapping) and postcondition.get("p") == "url_shape":
                origin, path = postcondition.get("origin"), postcondition.get("path_shape")
                if isinstance(origin, str) and re.fullmatch(r"https?://[a-z0-9.-]+(?::\d+)?", origin) and isinstance(path, str) and len(path) <= 200 and re.fullmatch(r"/[a-z0-9._:/-]*", path):
                    # Even a server-returned path must cross this adapter's
                    # static-route gate before reaching a model's context.
                    try:
                        safe_origin, safe_path, _ = self._url(origin + path)
                    except ValueError:
                        pass
                    else:
                        label += " (expected page shape: " + safe_origin + safe_path + ")"
            lines.append(f"{len(lines) + 1}. {label}")
        return "Historical reference only; these are not executable replay instructions.\n" + "\n".join(lines) if lines else ""
