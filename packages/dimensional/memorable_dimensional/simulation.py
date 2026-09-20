"""Opt-in dimOS blueprint for the bundled office MuJoCo simulation only.

Launch with activated dimOS environment:
  dimos --simulation mujoco --viewer none --mcp-port 19991 run memorable-dimensional.inspection

This module imports dimOS only when explicitly selected. It is not imported by
the adapter package and cannot connect to physical robot hardware.
"""
from __future__ import annotations

import hashlib
import io
import json
import math
import os
from pathlib import Path
import time

from PIL import Image as PillowImage
from dimos.agents.annotation import skill
from dimos.agents.mcp.mcp_server import McpServer
from dimos.core.coordination.blueprints import autoconnect
from dimos.core.global_config import global_config
from dimos.navigation.replanning_a_star.module import ReplanningAStarPlanner
from dimos.robot.unitree.go2.connection import GO2Connection
from dimos.robot.unitree.go2.blueprints.smart.unitree_go2 import unitree_go2
from dimos.robot.unitree.unitree_skill_container import UnitreeSkillContainer


class InspectionPlanner(ReplanningAStarPlanner):
    """Pinned simulation controller: aim inside the independent 20 cm verifier.

    Upstream c1c3cdc9 otherwise treats a replan within 50 cm as arrival.
    These private attributes are deliberately confined to this demo blueprint.
    """
    def __init__(self, **kwargs):
        if kwargs.get("g", global_config).simulation != "mujoco":
            raise RuntimeError("Inspection planner requires MuJoCo simulation")
        super().__init__(**kwargs)
        self._planner._goal_tolerance = 0.10
        self._planner._replan_goal_tolerance = 0.10
        self._planner._local_planner._goal_tolerance = 0.10


class InspectionConnection(GO2Connection):
    """Read simulator measurements independently of planner text or image transport."""
    def __init__(self, **kwargs):
        config = kwargs.get("g", global_config)
        if config.simulation != "mujoco":
            raise RuntimeError("Select this blueprint only with --simulation mujoco")
        super().__init__(**kwargs)

    @skill
    def inspect_pose(self) -> str:
        """Read current measured pose and fresh camera evidence; does not move anything."""
        if global_config.simulation != "mujoco":
            raise RuntimeError("Inspection demo requires MuJoCo simulation")
        shm = self.connection.shm_data
        if shm is None:
            return json.dumps({"ok": False, "reason": "simulation_not_ready"})
        previous = getattr(self, "_inspection_image_sequence", 0)
        deadline = time.monotonic() + 3
        while True:
            odom, odom_sequence = shm.read_odom()
            frame, image_sequence = shm.read_video()
            if image_sequence > previous or time.monotonic() >= deadline:
                break
            time.sleep(0.02)
        if odom is None or frame is None or not odom_sequence or not image_sequence:
            return json.dumps({"ok": False, "reason": "fresh_pose_and_camera_required"})
        if image_sequence <= previous:
            return json.dumps({"ok": False, "reason": "camera_not_advancing"})
        self._inspection_image_sequence = image_sequence
        position, quaternion, timestamp = odom
        coords = [float(x) for x in position]
        if not all(math.isfinite(x) for x in coords) or time.time() - timestamp > 3:
            return json.dumps({"ok": False, "reason": "nonfinite_pose"})
        buffer = io.BytesIO()
        PillowImage.fromarray(frame).save(buffer, format="JPEG")
        payload = buffer.getvalue()
        digest = hashlib.sha256(payload).hexdigest()
        directory = Path(os.environ.get("MEMORABLE_DIMENSIONAL_EVIDENCE_DIR", "/tmp/memorable-dimos-frames"))
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        target = directory / f"{digest}.jpg"
        target.write_bytes(payload)
        target.chmod(0o600)
        return json.dumps({"ok": True, "position": coords, "quaternion_wxyz": quaternion.tolist(),
                           "pose_age_seconds": round(time.time() - timestamp, 4),
                           "image_sequence": int(image_sequence), "odom_sequence": int(odom_sequence),
                           "image_sha256": digest, "image_file": target.name,
                           "scene": "upstream-mujoco-office1"})


inspection = autoconnect(unitree_go2.disabled_modules(GO2Connection, ReplanningAStarPlanner),
                         InspectionPlanner.blueprint(),
                         InspectionConnection.blueprint(), UnitreeSkillContainer.blueprint(),
                         McpServer.blueprint()).global_config(
                             n_workers=10, zenoh_scout_addr="224.0.0.225:7446")
