"""Run read-only checks against an actual dimOS MCP server, then store/recall.

This is connection evidence, not a robot inspection demo. With --model, an
actual tool-using agent chooses the two diagnostic calls. No motion is exposed.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
from pathlib import Path
import secrets
import subprocess
import time
from urllib.parse import urlparse

from dimos.agents.mcp.mcp_adapter import McpAdapter
from memorable_dimensional import DIMENSIONAL_METADATA, MemorableMemory, MissionMemory, minimal_projection


def projection(name, arguments, result):
    row = minimal_projection(name, arguments, result)
    if name in {"server_status", "list_modules"}:
        # Descriptive procedure text is application-authored, not arbitrary MCP prose.
        row["summary"] = {
            "server_status": "Read server_status to discover the current runtime and available skills.",
            "list_modules": "Read list_modules and compare its skill inventory with the server status.",
        }[name]
    return row


async def main(args):
    if urlparse(args.mcp_url).hostname not in {"localhost", "127.0.0.1", "::1"}:
        raise ValueError("readiness example is restricted to a local dimOS server")
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True, mode=0o700)
    # A separate store prevents mixing connection checks into product workflows.
    os.environ["MEMORABLE_HOME"] = str(output / "memory-home")
    os.environ["MEMORABLE_BACKEND"] = "local"
    os.environ["MEMORABLE_STORE_KEY"] = secrets.token_hex(32)
    command = [args.node, str(Path(args.memorable_cli).resolve())]
    env = {k: v for k, v in os.environ.items() if k in {"PATH", "HOME", "TMPDIR", "LANG"} or k.startswith("MEMORABLE_")}
    consent = subprocess.run([*command, "enable"], env=env, capture_output=True, timeout=15)
    if consent.returncode:
        raise RuntimeError("isolated local memory consent could not be enabled")
    client = McpAdapter(args.mcp_url, timeout=10)
    client.initialize()
    discovered = client.list_tools()
    names = sorted(x["name"] for x in discovered)
    if not {"server_status", "list_modules"}.issubset(names):
        raise RuntimeError("server does not expose dimOS readiness tools")
    if args.env_file:
        from dotenv import dotenv_values
        value = dotenv_values(args.env_file).get("OPENAI_API_KEY")
        if value:
            os.environ["OPENAI_API_KEY"] = value
    report = {"schema": "memorable.dimensional.evidence.v1", "mode": "live_local_mcp_readiness",
              "robot_simulation": False, "autonomous_agent": bool(args.model), "model": args.model,
              "embedding": "off",
              "tool_names": names, "runs": [], "controls": [], "complete": False}
    base = dict(task="Check dimOS runtime readiness", workflow="Verify deployed module skill inventory",
                project="dimos-connection-demo", site="local-mcp", map_version="no-map",
                robot_capabilities="read-only-runtime-diagnostics", tool_schema_version="dimos-c1c3cdc9",
                projection=projection)
    for case in ("first", "recall", "disabled", "kill_switch", "missing_cli", "no_consent", "wrong_map"):
        os.environ["MEMORABLE_DIMENSIONAL_DISABLED"] = "1" if case == "kill_switch" else "0"
        if case == "no_consent":
            os.environ["MEMORABLE_HOME"] = str(output / "no-consent-home")
        else:
            os.environ["MEMORABLE_HOME"] = str(output / "memory-home")
        memory = MemorableMemory([str(output / "not-installed")] if case == "missing_cli" else command,
                                 metadata=DIMENSIONAL_METADATA, embedding="off")
        parameters = {**base, "map_version": "changed-map" if case == "wrong_map" else "no-map"}
        mission = MissionMemory(memory, enabled=case != "disabled", **parameters)
        context = await mission.prepare()
        wrapped = mission.wrap_mcp(client)
        token_usage = None
        started = time.monotonic()
        if args.model and case in {"first", "recall"}:
            from langchain.agents import create_agent
            from langchain_core.tools import StructuredTool
            from langchain_openai import ChatOpenAI
            agent = create_agent(model=ChatOpenAI(model=args.model, temperature=0), tools=[
                StructuredTool(name="server_status", description="Read actual dimOS process and skill status.",
                               args_schema={"type": "object", "properties": {}, "additionalProperties": False},
                               func=lambda: wrapped.call_tool_text("server_status")),
                StructuredTool(name="list_modules", description="Read actual dimOS deployed modules and their skills.",
                               args_schema={"type": "object", "properties": {}, "additionalProperties": False},
                               func=lambda: wrapped.call_tool_text("list_modules")),
            ], system_prompt="You inspect dimOS runtime readiness using the available read-only tools. "
                             "Read the live server status and module inventory, compare them, and report readiness.\n" + context)
            result = await agent.ainvoke({"messages": [{"role": "user", "content": base["task"]}]},
                                        config={"recursion_limit": 8})
            usage = [m.usage_metadata for m in result["messages"] if getattr(m, "usage_metadata", None)]
            token_usage = {k: sum(x.get(k, 0) for x in usage) for k in ("input_tokens", "output_tokens", "total_tokens")}
            # Verify with fresh direct calls, outside the captured agent trace.
            status = json.loads(client.call_tool_text("server_status"))
            modules = json.loads(client.call_tool_text("list_modules"))
        else:
            status = json.loads(wrapped.call_tool_text("server_status"))
            modules = json.loads(wrapped.call_tool_text("list_modules"))
        elapsed_ms = round((time.monotonic() - started) * 1000, 2)
        modules_match = sorted(status["modules"]) == sorted(modules["modules"])
        inventory_match = sorted(status["skills"]) == names
        os.kill(status["pid"], 0)  # Independent operating-system process liveness check.
        verified = modules_match and inventory_match
        verification = {"ok": verified, "kind": "runtime_readiness", "checks": {
            "module_inventory_matches": modules_match, "skill_inventory_matches": inventory_match,
            "reported_process_alive": True}, "robot_arrival_verified": False}
        if case != "wrong_map":
            await mission.finish(verification=verification)
        item = {"case": case, "mission_id": mission.id, "verified": verified,
                "execution": "agent" if args.model and case in {"first", "recall"} else "scripted",
                "elapsed_ms": elapsed_ms, "token_usage": token_usage,
                "context_received_by_runner": bool(context), "context_chars": len(context),
                "context_delivered_to_model": bool(context) and bool(args.model) and case == "recall",
                "captured_calls": len(mission.events), "stored": mission.store_result is not None,
                "receipt": mission.store_result, "diagnostics": mission.diagnostics,
                "pending_store_retained": mission.pending_store is not None,
                "matched_ids": [x.get("id") for x in (mission.recall_result or {}).get("matches", [])]}
        if not verified:
            raise RuntimeError("actual MCP status and module inventory disagree")
        if case == "first":
            assert not context and mission.store_result and len(mission.events) == 2
        elif case == "recall":
            assert context and mission.store_result and len(mission.events) == 2
        elif case in {"disabled", "kill_switch"}:
            assert not context and not mission.events and mission.store_result is None
        elif case in {"missing_cli", "no_consent"}:
            assert not context and mission.store_result is None and mission.pending_store
            assert {d["stage"] for d in mission.diagnostics} == {"recall", "store"}
        elif case == "wrong_map":
            assert not context and not item["matched_ids"]
        report["runs" if case in {"first", "recall"} else "controls"].append(item)
    report["complete"] = True
    path = output / "report.json"
    path.write_text(json.dumps(report, indent=2) + "\n")
    path.chmod(0o600)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mcp-url", default="http://127.0.0.1:19990/mcp")
    parser.add_argument("--node", default="node")
    parser.add_argument("--memorable-cli", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", help="Optional actual OpenAI-backed LangChain agent, e.g. gpt-4.1-mini")
    parser.add_argument("--env-file", help="Read only OPENAI_API_KEY from this file; never prints its contents")
    asyncio.run(main(parser.parse_args()))
