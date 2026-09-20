"""Native Memorable CLI transport. No dimOS or browser dependencies."""
from __future__ import annotations

import asyncio
import json
import os
import signal
from typing import Any, Mapping, Sequence


class MemoryError(RuntimeError):
    def __init__(self, code: str):
        self.code = code if code.replace("_", "").isalnum() and len(code) < 80 else "memory_error"
        super().__init__(self.code)


class MemorableMemory:
    def __init__(self, command: Sequence[str] = ("memorable",), *, metadata: Mapping[str, Any],
                 embedding: str = "required", timeout: float = 15,
                 max_output_bytes: int = 2_000_000):
        if not command or isinstance(command, str) or any(not isinstance(x, str) or not x for x in command):
            raise ValueError("command must be a nonempty argv list")
        if embedding not in {"required", "optional", "off"} or timeout <= 0 or max_output_bytes <= 0:
            raise ValueError("invalid memory configuration")
        self.command = list(command)
        self.config = json.loads(json.dumps({"metadata": metadata, "embedding": embedding}))
        self.timeout = timeout
        self.max_output_bytes = max_output_bytes

    async def recall(self, request: Mapping[str, Any]) -> dict[str, Any]:
        return await self._call("recall", request)

    async def store(self, request: Mapping[str, Any]) -> dict[str, Any]:
        return await self._call("store", request)

    async def _call(self, operation: str, request: Mapping[str, Any]) -> dict[str, Any]:
        payload = json.dumps({"request": request, "config": self.config}, allow_nan=False).encode()
        if len(payload) > 2_000_000:
            raise MemoryError("request_too_large")
        # The memory subprocess must not inherit the host model's API keys.
        system = {"PATH", "HOME", "USERPROFILE", "SYSTEMROOT", "WINDIR", "TMP", "TEMP",
                  "TMPDIR", "LANG", "LC_ALL", "SSL_CERT_FILE", "SSL_CERT_DIR", "NODE_EXTRA_CA_CERTS"}
        env = {k: v for k, v in os.environ.items() if k in system or k.startswith("MEMORABLE_")}
        try:
            process = await asyncio.create_subprocess_exec(
                *self.command, "memory", operation, "-", stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
                env=env, start_new_session=os.name == "posix")
        except (OSError, ValueError) as exc:
            raise MemoryError("cli_unavailable") from exc
        size = 0

        async def read(stream: asyncio.StreamReader) -> bytes:
            nonlocal size
            chunks = []
            while chunk := await stream.read(65536):
                size += len(chunk)
                if size > self.max_output_bytes:
                    raise MemoryError("output_too_large")
                chunks.append(chunk)
            return b"".join(chunks)

        async def exchange() -> bytes:
            assert process.stdin and process.stdout and process.stderr
            async def write() -> None:
                try:
                    process.stdin.write(payload)
                    await process.stdin.drain()
                except (BrokenPipeError, ConnectionResetError):
                    pass
                finally:
                    process.stdin.close()
            _, stdout, _ = await asyncio.gather(write(), read(process.stdout), read(process.stderr))
            await process.wait()
            return stdout

        try:
            stdout = await asyncio.wait_for(exchange(), self.timeout)
        except BaseException as exc:
            try:
                if os.name == "posix":
                    os.killpg(process.pid, signal.SIGKILL)
                elif process.returncode is None:
                    process.kill()
            except ProcessLookupError:
                pass
            try:
                await asyncio.wait_for(process.wait(), 1)
            except (asyncio.TimeoutError, ProcessLookupError):
                pass
            if isinstance(exc, asyncio.TimeoutError):
                raise MemoryError("cli_timeout_store_may_have_committed") from exc
            raise
        try:
            envelope = json.loads(stdout)
        except (ValueError, UnicodeDecodeError) as exc:
            raise MemoryError("invalid_cli_json") from exc
        if process.returncode != 0:
            error = envelope.get("error", {}) if isinstance(envelope, dict) else {}
            raise MemoryError(str(error.get("code", "cli_error")) if isinstance(error, dict) else "cli_error")
        if not isinstance(envelope, dict) or envelope.get("schema") != "memorable.memory.v1" or envelope.get("operation") != operation:
            raise MemoryError("incompatible_cli")
        result = envelope.get("result")
        if not isinstance(result, dict):
            raise MemoryError("invalid_result")
        if operation == "store" and (result.get("status") != "stored" or result.get("storage") != "local"):
            raise MemoryError("missing_local_storage_receipt")
        if operation == "recall" and not isinstance(result.get("matches"), list):
            raise MemoryError("missing_matches")
        return result
