"""Bounded JSON subprocess client; transport extensions stay in separate packages."""

from __future__ import annotations

import asyncio
import json
import os
import signal
from pathlib import Path
from typing import Any, Mapping, Sequence


class MemoryError(RuntimeError):
    """An optional memory transport failed; the browser task may continue."""

    def __init__(self, message: str, *, code: str = "memory_error"):
        super().__init__(message)
        self.code = code if code.replace("_", "").isalnum() and len(code) < 80 else "memory_error"


class CliMemory:
    def __init__(
        self,
        command: Sequence[str],
        *,
        adapter: str | Path | None = None,
        config: Mapping[str, Any] | None = None,
        timeout: float = 30,
        max_output_bytes: int = 2_000_000,
    ):
        if not command or any(not isinstance(arg, str) or not arg for arg in command):
            raise ValueError("command must be a nonempty argv list")
        if timeout <= 0 or max_output_bytes <= 0:
            raise ValueError("timeout and max_output_bytes must be positive")
        self.native = False
        self.command = list(command)
        self.adapter = str(adapter or Path(__file__).with_name("driver.mjs"))
        self.config = dict(config or {})
        self.timeout = timeout
        self.max_output_bytes = max_output_bytes

    async def recall(self, request: Mapping[str, Any]) -> dict[str, Any]:
        return await self._call("recall", request)

    async def store(self, request: Mapping[str, Any]) -> dict[str, Any]:
        return await self._call("store", request)

    async def _call(self, operation: str, request: Mapping[str, Any]) -> dict[str, Any]:
        payload = json.dumps({"request": request, "config": self.config}, allow_nan=False).encode()
        max_input = 2_000_000 if self.native else 8_000_000
        if len(payload) > max_input:
            raise MemoryError(f"memory request exceeds {max_input // 1_000_000} MB")
        # A browser agent can carry several unrelated provider credentials. Only
        # system process configuration and Memorable's own variables cross here.
        system_keys = {
            "PATH", "HOME", "USERPROFILE", "SYSTEMROOT", "WINDIR", "TMP", "TEMP",
            "TMPDIR", "LANG", "LC_ALL", "SSL_CERT_FILE", "SSL_CERT_DIR",
            "NODE_EXTRA_CA_CERTS", "MEMORABLE_HOME",
        }
        env = {key: value for key, value in os.environ.items()
               if key in system_keys or key.startswith("MEMORABLE_")}
        try:
            process = await asyncio.create_subprocess_exec(
                *self.command, "memory", operation, *(["-"] if self.native else ["--adapter", self.adapter]),
                stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE, env=env,
                start_new_session=os.name == "posix",
            )
        except (OSError, ValueError) as error:
            raise MemoryError(f"could not start memory CLI: {type(error).__name__}") from error

        size = 0

        async def read(stream: asyncio.StreamReader) -> bytes:
            nonlocal size
            chunks = []
            while chunk := await stream.read(65536):
                size += len(chunk)
                if size > self.max_output_bytes:
                    raise MemoryError("memory CLI exceeded output limit")
                chunks.append(chunk)
            return b"".join(chunks)

        async def exchange() -> tuple[bytes, bytes]:
            assert process.stdin and process.stdout and process.stderr
            async def write() -> None:
                try:
                    process.stdin.write(payload)
                    await process.stdin.drain()
                except (BrokenPipeError, ConnectionResetError):
                    pass
                finally:
                    process.stdin.close()
            _, stdout, stderr = await asyncio.gather(write(), read(process.stdout), read(process.stderr))
            await process.wait()
            return stdout, stderr

        try:
            stdout, _stderr = await asyncio.wait_for(exchange(), timeout=self.timeout)
        except BaseException as error:
            # Kill descendants as well: their inherited pipes can otherwise keep
            # an optional memory request alive after the caller's deadline.
            try:
                if os.name == "posix":
                    os.killpg(process.pid, signal.SIGKILL)
                elif process.returncode is None:
                    process.kill()
            except ProcessLookupError:
                pass
            try:
                await asyncio.wait_for(process.wait(), timeout=1)
            except (asyncio.TimeoutError, ProcessLookupError):
                pass
            if isinstance(error, asyncio.TimeoutError):
                raise MemoryError("memory CLI timed out; a store may already have reached the service") from error
            raise
        try:
            envelope = json.loads(stdout)
        except (ValueError, UnicodeDecodeError) as error:
            raise MemoryError(f"memory CLI returned invalid JSON (exit {process.returncode})") from error
        if process.returncode != 0:
            # Do not reflect arbitrary transport output or credentials into logs.
            detail = envelope.get("error") if isinstance(envelope, dict) else None
            code = detail.get("code", "transport_error") if isinstance(detail, dict) else "transport_error"
            safe_code = str(code) if str(code).replace("_", "").isalnum() and len(str(code)) < 80 else "transport_error"
            raise MemoryError(f"memory CLI failed: {safe_code} (exit {process.returncode})", code=safe_code)
        if not isinstance(envelope, dict) or envelope.get("schema") != ("memorable.memory.v1" if self.native else "memorable.adapter.v1") or envelope.get("operation") != operation:
            raise MemoryError("memory CLI returned an incompatible adapter envelope")
        result = envelope.get("result")
        if not isinstance(result, dict):
            raise MemoryError("memory adapter result must be an object")
        if self.native:
            if operation == "store" and (result.get("status") != "stored" or result.get("storage") != "local"):
                raise MemoryError("missing local storage receipt")
            if operation == "recall" and not isinstance(result.get("matches"), list):
                raise MemoryError("missing recall matches")
        return result


class MemorableMemory(CliMemory):
    """Generic metadata store/recall via the extended native Memorable CLI.

    Requires the metadata CLI patch; published older builds are not compatible.
    Fields marked private stay in the local store and are excluded from recall.
    """
    def __init__(self, command: Sequence[str] = ("memorable",), *, metadata: Mapping[str, Any],
                 embedding: str = "required", timeout: float = 30, max_output_bytes: int = 2_000_000):
        if embedding not in {"required", "optional", "off"}:
            raise ValueError("embedding must be required, optional, or off")
        super().__init__(command, config=json.loads(json.dumps({"metadata": metadata, "embedding": embedding})),
                         timeout=timeout, max_output_bytes=max_output_bytes)
        self.native = True
