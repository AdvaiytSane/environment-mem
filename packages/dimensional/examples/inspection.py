"""Two model-driven inspections in the bundled dimOS MuJoCo office.

Requires memorable-dimensional.inspection running locally. Actual
camera frames and measured poses verify visits; navigation prose is insufficient.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import math
import os
from pathlib import Path
import secrets
import subprocess
import time

from dotenv import dotenv_values
from dimos.agents.mcp.mcp_adapter import McpAdapter
from langchain.agents import create_agent
from langchain_core.tools import StructuredTool
from langchain_core.callbacks import UsageMetadataCallbackHandler
import httpx
from langchain_openai import ChatOpenAI
from memorable_dimensional import DIMENSIONAL_METADATA, MemorableMemory, MissionMemory, minimal_projection


async def main(args):
    key = dotenv_values(args.env_file).get("OPENAI_API_KEY")
    if key:
        os.environ["OPENAI_API_KEY"] = key
    output = Path(args.output).resolve()
    # Never silently replace the encryption key of a previous experiment.
    output.mkdir(parents=True, exist_ok=False, mode=0o700)
    os.environ["MEMORABLE_HOME"] = str(output / "memory-home")
    os.environ["MEMORABLE_BACKEND"] = "local"
    os.environ["MEMORABLE_STORE_KEY"] = secrets.token_hex(32)
    key_file = output / ".store-key"
    key_file.write_text(os.environ["MEMORABLE_STORE_KEY"])
    key_file.chmod(0o600)
    command = [args.node, str(Path(args.memorable_cli).resolve())]
    env = {k: v for k, v in os.environ.items() if k in {"PATH", "HOME", "TMPDIR", "LANG"} or k.startswith("MEMORABLE_")}
    subprocess.run([*command, "enable"], env=env, check=True, capture_output=True, timeout=15)
    client = McpAdapter("http://127.0.0.1:19991/mcp", timeout=120)
    names = {x["name"] for x in client.list_tools()}
    if not {"inspect_pose", "move_to"}.issubset(names):
        raise RuntimeError("simulation inspection blueprint is not ready")
    first = json.loads(client.call_tool_text("inspect_pose"))
    if not first.get("ok") or first.get("scene") != "upstream-mujoco-office1":
        raise RuntimeError("fresh simulation camera and odometry required")
    start = first["position"][:2]
    checkpoints = {"A": [start[0] + 0.5, start[1]], "B": start}
    report = {"schema": "memorable.dimensional.inspection.v1", "mode": "actual_mujoco_simulation",
              "scene": "bundled_office1", "simulated_body": "unitree_go1", "host_stack": "unitree_go2",
              "model": args.model, "embedding": "off", "checkpoints": checkpoints, "runs": [], "complete": False}
    for number in range(2):
        observed = []

        def projection(name, arguments, result):
            row = minimal_projection(name, arguments, result)
            if name == "inspect_pose":
                data = json.loads(result["content"][0]["text"])
                row["observation"] = data
                if data.get("ok"):
                    observed.append(data)
                row["summary"] = "Inspect measured pose and save a fresh camera evidence frame at each checkpoint."
            elif name == "move_to":
                row["input"] = {k: arguments[k] for k in ("x", "y") if k in arguments}
                row["summary"] = "Navigate to the requested checkpoint, then verify actual pose independently."
            return row

        memory = MemorableMemory(command, metadata=DIMENSIONAL_METADATA, embedding="off")
        mission = MissionMemory(memory, enabled=True, projection=projection,
            task="Inspect two nearby checkpoints and return to the starting checkpoint",
            workflow="Visit each mission checkpoint and capture pose and camera evidence",
            project="dimos-office-demo", site="mujoco-office1", map_version="mujoco-4232d61e",
            robot_capabilities="go1-simulation:camera:nav", tool_schema_version="dimos-c1c3cdc9-inspection-v1")
        recalled = await mission.prepare()
        (output / f"run-{number + 1}-context.txt").write_text(recalled)
        wrapped = mission.wrap_mcp(client)
        moves = 0
        requests = []
        usage_tracker = UsageMetadataCallbackHandler()

        async def record_request(request):
            # Record the actual provider payload, never authorization headers.
            payload = json.loads(request.content)
            messages = payload.get("messages", [])
            requests.append({"model": payload.get("model"), "messages": messages,
                             "context_present": bool(recalled) and any(
                                 recalled in str(m.get("content", "")) for m in messages
                                 if m.get("role") in {"system", "developer"})})
            (output / f"run-{number + 1}-requests.json").write_text(json.dumps(requests, indent=2) + "\n")

        def move_to(x: float, y: float) -> str:
            nonlocal moves
            if not all(math.isfinite(v) for v in (x, y)) or not any(math.dist([x, y], p) < 0.01 for p in checkpoints.values()):
                return "Only the two application-defined checkpoint coordinates are allowed."
            if moves >= 4:
                return "Four-move mission budget exhausted. Inspect pose and report any missed checkpoint."
            moves += 1
            return wrapped.call_tool_text("move_to", {"x": x, "y": y})

        def inspect_pose() -> str:
            data = json.loads(wrapped.call_tool_text("inspect_pose"))
            if data.get("ok"):
                distances = {name: math.dist(point, data["position"][:2]) for name, point in checkpoints.items()}
                data["checkpoint_distances_m"] = distances
                data["within_arrival_tolerance"] = {name: distance <= 0.20 for name, distance in distances.items()}
            return json.dumps(data)

        tools = [
            StructuredTool.from_function(move_to, description="Navigate to one of the two mission checkpoints; arrival must be checked with inspect_pose."),
            StructuredTool(name="inspect_pose", description="Read fresh actual pose and camera evidence. Call before movement and at every checkpoint.",
                           args_schema={"type": "object", "properties": {}, "additionalProperties": False},
                           func=inspect_pose),
        ]
        http_client = httpx.AsyncClient(event_hooks={"request": [record_request]})
        agent = create_agent(ChatOpenAI(model=args.model, temperature=0, max_retries=0,
                                       http_async_client=http_client), tools=tools,
                             system_prompt="You inspect the two specified coordinates in a local MuJoCo simulation. "
                             "Call only one tool at a time. Inspect once, visit A and verify it, then visit B and verify it. "
                             "Arrival requires measured distance <= 0.20 meters. Check within_arrival_tolerance. "
                             "A navigation response is not proof of arrival. Retry a missed checkpoint once, then report failure. "
                             "Never claim success when a measured arrival check fails.\n" + recalled)
        started = time.monotonic()
        agent_error = None
        state = {"messages": []}
        try:
            state = await agent.ainvoke({"messages": [{"role": "user", "content": f"Complete the checkpoint inspection. Coordinates: {json.dumps(checkpoints)}"}]},
                                       config={"recursion_limit": 32, "callbacks": [usage_tracker]})
        except Exception as exc:
            agent_error = type(exc).__name__
        finally:
            await http_client.aclose()
        final = json.loads(client.call_tool_text("inspect_pose"))
        # Require commanded A, observed A, commanded B, observed B, in that order.
        # The starting position at B cannot count as the return leg.
        visits = {"A": False, "B": False}
        phase_frames = []
        target = None
        for event in sorted(mission.events, key=lambda e: e["sequence"]):
            if event["tool"] == "move_to":
                point = [event["input"]["x"], event["input"]["y"]]
                target = next((name for name, p in checkpoints.items() if math.dist(point, p) < 0.01), None)
            observation = event.get("observation", {})
            if target and observation.get("ok") and math.dist(checkpoints[target], observation["position"][:2]) <= 0.20:
                if (target == "A" or visits["A"]) and not visits[target]:
                    visits[target] = True
                    phase_frames.append(observation["image_sequence"])
        final_at_b = final.get("ok") is True and math.dist(checkpoints["B"], final["position"][:2]) <= 0.20
        frame_checks = []
        for observation in [*observed, final] if final.get("ok") else observed:
            source = Path(args.frames) / observation["image_file"]
            valid = source.is_file() and hashlib.sha256(source.read_bytes()).hexdigest() == observation["image_sha256"]
            frame_checks.append(valid)
            if valid:
                (output / source.name).write_bytes(source.read_bytes())
        sequences = [o["image_sequence"] for o in observed]
        camera_advanced = len(phase_frames) == 2 and phase_frames[1] > phase_frames[0] > first["image_sequence"]
        verified = not agent_error and all(visits.values()) and final_at_b and camera_advanced and bool(frame_checks) and all(frame_checks)
        verification = {"ok": verified, "checkpoints": visits, "returned_to_b": final_at_b,
                        "camera_sequence_advanced": camera_advanced,
                        "camera_hashes_verified": bool(frame_checks) and all(frame_checks), "measured_final_pose": final.get("position"),
                        "agent_error": agent_error}
        await mission.finish(verification=verification)
        usages = list(usage_tracker.usage_metadata.values())
        report["runs"].append({"number": number + 1, "mission_id": mission.id,
            "context_delivered": bool(requests) and all(r["context_present"] for r in requests),
            "context_chars": len(recalled), "recall_ids": [m.get("id") for m in (mission.recall_result or {}).get("matches", [])],
            "verification": verification, "final_observation": final, "checkpoint_image_sequences": phase_frames,
            "elapsed_ms": round((time.monotonic() - started) * 1000, 2),
            "usage": {k: sum(m.get(k, 0) for m in usages) for k in ("input_tokens", "output_tokens", "total_tokens")},
            "usage_by_model": usage_tracker.usage_metadata,
            "provider_request_count": len(requests),
            "actions": mission.events, "receipt": mission.store_result, "diagnostics": mission.diagnostics})
        (output / "report.json").write_text(json.dumps(report, indent=2) + "\n")
        if not verified:
            post_store_recall = await memory.recall({"query": mission.task,
                "metadata": {**mission.filters, "outcome": "verified"}, "limit": 3})
            report["unverified_excluded_from_recall"] = not bool(post_store_recall["matches"])
            break
        mismatch = await memory.recall({"query": mission.task,
            "metadata": {**mission.filters, "map_version": "different-map", "outcome": "verified"}, "limit": 3})
        report["different_map_excluded"] = not bool(mismatch["matches"])
    report["complete"] = (len(report["runs"]) == 2 and all(x["verification"]["ok"] and x["receipt"] for x in report["runs"])
        and report["runs"][1]["context_delivered"] and report.get("different_map_excluded")
        and report["runs"][0]["mission_id"] in report["runs"][1]["recall_ids"])
    (output / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"complete": report["complete"], "runs": len(report["runs"]), "report": str(output / "report.json")}))
    if not report["complete"]:
        raise SystemExit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--node", default="node")
    parser.add_argument("--memorable-cli", required=True)
    parser.add_argument("--env-file", required=True)
    parser.add_argument("--model", default="gpt-4.1-mini")
    parser.add_argument("--output", required=True)
    parser.add_argument("--frames", default="/tmp/memorable-dimos-frames")
    asyncio.run(main(parser.parse_args()))
