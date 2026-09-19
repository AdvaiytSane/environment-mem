"""Local privacy/outcome regressions; these do not prove service retrieval."""

import json
import unittest
import uuid

from memorable_browser_use.wire import BrowserWire


class BrowserWireTests(unittest.TestCase):
    def reference(self, steps, **overrides):
        return {"mode": "context", "decision": "partial", "context": {
            "kind": "workflow_reference", "executable": False, "steps": [{"approval_required": False, **step} for step in steps],
            **overrides}}

    def wire(self, **overrides):
        return BrowserWire(label_salt=b"0123456789abcdef0123456789abcdef",
                           task_label="Search documentation", instance_id=str(uuid.uuid4()),
                           allowed_path_segments=overrides.pop("allowed_path_segments", ["docs"]),
                           **overrides)

    def state(self, wire, *, url="https://example.com/docs", kind="search", label="Search"):
        return wire.snapshot({"url": url, "viewport_width": 1200, "settled": True,
                              "nodes": [{"role": "main", "name": "Private page contents", "depth": 1},
                                        {"role": "textbox", "name": label, "depth": 2,
                                         "ref": "7", "attrs": {"type": kind}}]})

    def event(self, before, after, action, result=None):
        return {"call_id": str(uuid.uuid4()), "sequence": 1, "phase": "finished", "status": "returned",
                "started_at": "2026-09-19T20:00:00.000Z", "finished_at": "2026-09-19T20:00:00.075Z",
                "action": action, "before_state": before, "after_state": after,
                "result": result if result is not None else {"error": "", "success": None}}

    def test_input_values_are_minimized_only_after_independent_verification(self):
        private = "person@example.com PRIVATE typed value"
        wire = self.wire(verify_action=lambda raw: raw["result"].get("observed_value_matches"))
        state = self.state(wire)
        raw = self.event(state, state, {"input": {"index": 7, "text": private}},
                         {"observed_value_matches": True, "extracted_content": private})
        retained = wire.normalize_event(raw)
        event = retained["browser_event"]
        self.assertEqual(event["verb"], "fill")
        self.assertEqual(event["value"], {"kind": "text", "pattern": None, "from_parameter": None})
        self.assertEqual(event["result"]["status"], "ok")
        self.assertEqual(event["target"]["role"], "textbox")
        self.assertNotIn(private, json.dumps(retained))
        self.assertNotIn("Private page contents", json.dumps(retained))

    def test_password_and_sensitive_labels_disclose_no_value_shape(self):
        for kind, label in [("password", "Search"), ("text", "One time code")]:
            with self.subTest(kind=kind, label=label):
                wire = self.wire(verify_action=lambda raw: True)
                state = self.state(wire, kind=kind, label=label)
                private = "SENTINEL-secret-839401"
                event = wire.normalize_event(self.event(state, state, {"input_text": {"index": 7, "text": private}}))["browser_event"]
                self.assertEqual(event["value"], {"kind": "secret", "from_parameter": None})
                self.assertNotIn(private, json.dumps(event))
                self.assertNotIn("length_bucket", event["value"])
                self.assertNotIn("charset", event["value"])

    def test_clear_requires_independent_outcome_and_contains_no_previous_value(self):
        wire = self.wire(verify_action=lambda raw: True)
        state = self.state(wire)
        event = wire.normalize_event(self.event(state, state, {"input": {"index": 7, "text": ""}}))["browser_event"]
        self.assertEqual(event["verb"], "clear")
        self.assertEqual(event["value"], {"kind": "text", "pattern": None, "from_parameter": None})
        # Browser Use explicitly distinguishes clearing from appending nothing.
        no_clear = wire.normalize_event(self.event(state, state, {"input": {"index": 7, "text": "", "clear": False}}))["browser_event"]
        self.assertEqual(no_clear["verb"], "fill")

    def test_empty_error_or_agent_success_does_not_prove_input_success(self):
        wire = self.wire()
        state = self.state(wire)
        for result in [{"error": ""}, {"error": None}, {"success": True}, {"extracted_content": "Typed successfully"}]:
            with self.subTest(result=result):
                retained = wire.normalize_event(self.event(state, state, {"input": {"index": 7, "text": "do not store"}}, result))
                self.assertEqual(retained, {"dropped_reason": "outcome_unknown"})
        self.assertEqual(wire.normalize_event(self.event(state, state, {"input": {"index": 99, "text": "do not store"}})),
                         {"dropped_reason": "target_not_observed"})

    def test_explicit_failed_input_survives_unknown_target_without_error_text(self):
        wire = self.wire()
        state = self.state(wire)
        private = "input rejected: PRIVATE typed value"
        event = wire.normalize_event(self.event(state, state, {"input_text": {"index": 99, "text": private}}, {"error": private}))["browser_event"]
        self.assertEqual(event["result"]["status"], "error")
        self.assertEqual(event["result"]["error_class"], "unknown")
        self.assertIsNone(event["target"])
        self.assertEqual(event["value"], {"kind": "secret", "from_parameter": None})
        self.assertNotIn(private, json.dumps(event))

    def test_navigation_requires_observed_destination(self):
        wire = self.wire()
        before = self.state(wire)
        destination = "https://example.com/docs/results?query=PRIVATE_VALUE"
        after = self.state(wire, url=destination)
        action = {"navigate": {"url": destination}}
        self.assertEqual(wire.normalize_event(self.event(before, before, action)), {"dropped_reason": "outcome_unknown"})
        event = wire.normalize_event(self.event(before, after, action))["browser_event"]
        self.assertEqual(event["result"]["status"], "ok")
        self.assertEqual(event["result"]["navigations"], 1)
        self.assertEqual(event["latency_ms"], 75)
        self.assertNotIn("PRIVATE_VALUE", json.dumps(event))

    def test_unknown_custom_action_has_explicit_marker(self):
        wire = self.wire()
        state = self.state(wire)
        self.assertEqual(wire.normalize_event(self.event(state, state, {"custom_tool": {"secret": "private"}})),
                         {"dropped_reason": "unsupported_verb"})

    def test_recalled_paths_cannot_reintroduce_non_allowlisted_labels(self):
        wire = self.wire()
        private = "customer-private-label"
        state = self.state(wire, url="https://example.com/docs/" + private)
        self.assertEqual(state["fingerprint"]["path_shape"], "/docs/:seg")
        response = self.reference([{"op": "navigate", "postcondition": {
            "p": "url_shape", "origin": "https://example.com", "path_shape": "/docs/" + private}}])
        rendered = wire.render_recall(response)
        self.assertIn("https://example.com/docs/:seg", rendered)
        self.assertNotIn(private, rendered)
        with self.assertRaisesRegex(ValueError, "sensitive"):
            self.wire(allowed_path_segments=["api_access_token"])

    def test_recall_requests_context_without_claiming_execution_capabilities(self):
        wire = self.wire()
        request = wire.recall_request({"run_id": str(uuid.uuid4()), "initial_state": self.state(wire)})
        self.assertEqual(request["mode"], "context")
        self.assertEqual(request["runtime"]["capabilities"], [])

    def test_reference_keeps_conditions_and_approval_but_never_literal_values(self):
        wire = self.wire()
        target = {"strategies": [{"by": "role", "role": "button", "name": {"kind": "exact", "tokens": ["submit"]}}]}
        response = self.reference([{
            "op": "click", "target": target, "approval_required": True,
            "precondition": {"p": "element_enabled", "target": target},
            "postcondition": {"p": "role_count", "role": "listitem", "min": 10},
            "value": {"literal": "PRIVATE_SECRET"},
        }], boundary={"reason": "policy", "detail": "PRIVATE_SECRET"})
        rendered = wire.render_recall(response)
        self.assertIn('click button "submit"', rendered)
        self.assertIn('check before: button "submit" enabled', rendered)
        self.assertIn('verify after: listitem count: min 10', rendered)
        self.assertIn('Human approval required', rendered)
        self.assertIn('Partial reference', rendered)
        self.assertIn('policy restriction', rendered)
        self.assertNotIn('PRIVATE_SECRET', rendered)

    def test_reference_refuses_program_fallback_and_stops_at_unknown_actions(self):
        wire = self.wire()
        with self.assertRaisesRegex(ValueError, "context_unsupported"):
            wire.render_recall({"decision": "complete", "program": {"steps": [{"op": "click"}]}})
        with self.assertRaisesRegex(ValueError, "invalid_context_response"):
            wire.render_recall(self.reference([{"op": "click"}], executable=True))
        self.assertEqual(wire.render_recall({"mode": "context", "decision": "no_match"}), "")
        rendered = wire.render_recall(self.reference([{"op": "click"}, {"op": "unknown"}, {"op": "fill"}]))
        self.assertIn("click", rendered)
        self.assertNotIn("fill", rendered)

    def test_hashed_identity_is_never_reduced_to_an_unqualified_role(self):
        wire = self.wire()
        target = {"strategies": [{"by": "role", "role": "button", "name": {
            "kind": "sha", "sha": "0123456789abcdef", "salt_id": "12345678"}}]}
        rendered = wire.render_recall(self.reference([{"op": "click", "target": target,
            "precondition": {"p": "element_enabled", "target": target}}]))
        self.assertIn("specific identity requires independent verification", rendered)
        self.assertIn("Some target or condition details could not be rendered", rendered)
        self.assertNotIn("0123456789abcdef", rendered)
        with self.assertRaisesRegex(ValueError, "invalid_context_approval"):
            wire.render_recall(self.reference([{"op": "click", "approval_required": "true"}]))


if __name__ == "__main__":
    unittest.main()
