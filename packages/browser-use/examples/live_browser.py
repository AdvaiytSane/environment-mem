"""Real public website exercise; scripted actions by default, Agent with --agent.

Local capture is the default. --remote explicitly enables the configured service.
No local mock is ever presented as a production receipt or recalled procedure.
"""
import argparse
import asyncio
import base64
import hashlib
from importlib.metadata import version
import json
import os
import secrets
import tempfile
import uuid
from pathlib import Path

os.environ.setdefault("ANONYMIZED_TELEMETRY", "false")
os.environ.setdefault("BROWSER_USE_LOGGING_LEVEL", "error")

from browser_use import Agent, BrowserSession, Tools
from browser_use.agent.views import ActionResult
from browser_use.filesystem.file_system import FileSystem
from memorable_browser_use import BrowserMemory, CliMemory
from memorable_browser_use.collector import collect_page_snapshot
from memorable_browser_use.wire import BrowserWire

ORIGIN = "https://quotes.toscrape.com"
TASK = "Visit page two of the public quotes website and confirm there are ten quotes."


async def exercise(args):
    if args.agent and not args.provider:
        raise RuntimeError("--agent requires an explicit --provider openai or browser-use")
    key_name = "OPENAI_API_KEY" if args.provider == "openai" else "BROWSER_USE_API_KEY"
    if args.env_file:
        from dotenv import dotenv_values
        values = dotenv_values(args.env_file)
        for name in (key_name, "MEMORABLE_API_KEY", "MEMORABLE_API_URL", "MEMORABLE_HOME"):
            if values.get(name):
                os.environ[name] = values[name]
    if args.agent and not os.environ.get(key_name):
        raise RuntimeError(f"--provider {args.provider} requires {key_name}; no model request was made")
    model_name = args.model or ("gpt-4.1-mini" if args.provider == "openai" else "bu-2-0")
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True, mode=0o700)
    settings = output / "local-settings.json"
    if not settings.exists():
        settings.write_text(json.dumps({"salt": secrets.token_hex(32), "instance_id": str(uuid.uuid4())}))
        settings.chmod(0o600)
    local = json.loads(settings.read_text())
    browser_use_version = version('browser-use')
    wire = BrowserWire(label_salt=local["salt"], instance_id=local["instance_id"],
                       task_label="Find public quotes on the second page", allowed_path_segments=["page"],
                       runtime_version=browser_use_version)
    memory = CliMemory(command=[args.node, str(Path(args.cli).resolve())],
                       config={"allowedOrigins": [ORIGIN], "offline": not args.remote})
    with tempfile.TemporaryDirectory(prefix="memorable-browser-profile-") as profile:
        session = BrowserSession(headless=True, executable_path=args.chrome, user_data_dir=profile, keep_alive=True)
        capture = None
        failure = None
        observation = None
        custom_seen = []
        agent_evidence = None
        try:
            await session.start()
            tools = Tools()

            @tools.registry.action("Count quote cards on the current public page")
            async def count_quote_cards(browser_session: BrowserSession):
                page = await browser_session.must_get_current_page()
                count = int(await page.evaluate('() => document.querySelectorAll(".quote").length'))
                custom_seen.append(count)
                return ActionResult(extracted_content=f"Observed {count} quote cards")

            Action = tools.registry.create_action_model()
            # Bootstrap before capture: about:blank has no valid HTTP origin.
            await tools.act(Action(navigate={"url": ORIGIN + "/"}), browser_session=session)

            async def state():
                return wire.snapshot(await collect_page_snapshot(session))

            capture = BrowserMemory(memory=memory, task=TASK, journal_dir=output / "journal", enabled=True,
                                    state_provider=state, normalize_event=wire.normalize_event,
                                    recall_request=wire.recall_request, store_request=wire.store_request,
                                    render_recall=wire.render_recall)
            await capture.prepare()
            wrapped = capture.wrap_tools(tools)
            if args.agent:
                if args.provider == "openai":
                    from browser_use import ChatOpenAI
                    llm = ChatOpenAI(model=model_name, api_key=os.environ[key_name],
                                     base_url="https://api.openai.com/v1", timeout=60, max_retries=0)
                else:
                    from browser_use import ChatBrowserUse
                    llm = ChatBrowserUse(model=model_name, api_key=os.environ[key_name],
                                         base_url="https://llm.api.browser-use.com", timeout=60, max_retries=0)
                agent = Agent(task=capture.task_with_context, llm=llm, tools=wrapped,
                              browser_session=session, use_judge=False, max_failures=1,
                              final_response_after_failure=False)
                history = await agent.run(max_steps=8)
                agent_evidence = {
                    "provider": args.provider, "model": model_name,
                    "model_output_steps": len(history.model_outputs()),
                    "model_proposed_actions": history.action_names(),
                    "agent_reported_success": history.is_successful(),
                    "agent_error_count": sum(error is not None for error in history.errors()),
                    "reported_total_tokens": history.usage.total_tokens if history.usage else None,
                }
            else:
                # Exercise the same execution boundary used by Agent, without
                # pretending these predetermined actions were chosen by a model.
                await wrapped.act(Action(navigate={"url": ORIGIN + "/"}), browser_session=session)
                await session.get_browser_state_summary(include_screenshot=False)
                selectors = await session.get_selector_map()
                next_index = next(index for index, node in selectors.items()
                                  if node.attributes.get("href") == "/page/2/")
                await wrapped.act(Action(click={"index": next_index}), browser_session=session)
                # A returned ActionResult without an error is not necessarily OK.
                await wrapped.act(Action(input={"index": 999999, "text": "MUST_NOT_BE_RETAINED"}), browser_session=session)
                await wrapped.act(Action(count_quote_cards={}), browser_session=session)
                await wrapped.act(Action(done={"text": "Finished the public page check", "success": True}),
                                  browser_session=session, file_system=FileSystem(output / "browser-files"))
            page = await session.must_get_current_page()
            observation = json.loads(await page.evaluate(
                '() => ({url: location.href, title: document.title, quotes: document.querySelectorAll(".quote").length})'))
            verified = observation["url"] == ORIGIN + "/page/2/" and observation["quotes"] == 10
            (output / "browser.png").write_bytes(base64.b64decode(await page.screenshot()))
            await capture.finish(verification={"ok": verified, "check": "current_page_url_and_dom_card_count"})
            if not verified:
                raise AssertionError("independent page check failed")
        except BaseException as error:
            failure = type(error).__name__
            if capture:
                await capture.finish(error=error, verification={"ok": False})
            raise
        finally:
            if capture:
                journal = output / "journal" / f"{capture.record['run_id']}.jsonl"
                payloads = [path.read_bytes() for path in (output / "journal").glob("*.jsonl")]
                outbox = output / "journal" / "outbox.jsonl"
                receipts = output / "journal" / "receipts.jsonl"
                queued = {json.loads(line)["run_id"] for line in outbox.read_text().splitlines()} if outbox.exists() else set()
                acknowledged = {row["run_id"] for line in receipts.read_text().splitlines()
                                if (row := json.loads(line)).get("status") == "transport_completed"} if receipts.exists() else set()
                summary = {
                    "mode": "llm_agent" if args.agent else "scripted_browser_use_tools",
                    "agent_evidence": agent_evidence,
                    "browser_use_version": browser_use_version, "remote_enabled": args.remote,
                    "run_id": capture.record["run_id"], "events_retained": len(capture.record["events"]),
                    "verification": capture.record["verification"], "observation": observation,
                    "custom_tool_observed_counts": custom_seen,
                    "recall_result": capture.recall_result, "store_result": capture.store_result,
                    "diagnostics": capture.diagnostics, "wire_diagnostics": wire.diagnostics,
                    "pending_outbox_exists": capture.record["run_id"] in queued - acknowledged,
                    "typed_value_absent_from_journal": all(b"MUST_NOT_BE_RETAINED" not in data for data in payloads),
                    "journal_sha256": hashlib.sha256(journal.read_bytes()).hexdigest() if journal.exists() else None,
                    "failure": failure,
                }
                (output / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
                print(json.dumps(summary, indent=2))
            await session.kill()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cli", required=True, help="path to the main CLI dist/cli.js")
    parser.add_argument("--node", default="node", help="Node 24+ executable")
    parser.add_argument("--chrome", help="optional Chrome/Chromium executable; fresh profile is always used")
    parser.add_argument("--output", required=True, help="private output directory, outside version control")
    parser.add_argument("--remote", action="store_true", help="submit to configured Memorable browser service")
    parser.add_argument("--agent", action="store_true", help="run a real LLM-driven Agent with an explicitly selected provider")
    parser.add_argument("--provider", choices=["openai", "browser-use"], help="required with --agent; chooses the matching key and endpoint")
    parser.add_argument("--model", help="defaults to gpt-4.1-mini for OpenAI or bu-2-0 for Browser Use")
    parser.add_argument("--env-file", help="optional local .env path; reads only the chosen provider and Memorable settings")
    asyncio.run(exercise(parser.parse_args()))
