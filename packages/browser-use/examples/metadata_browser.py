"""Two real Browser Use runs with metadata-driven native Memorable CLI memory.

Requires a CLI build with memorable.memory.v1, OPENAI_API_KEY and configured
Memorable embedding access. Uses an isolated local store and fresh Chrome profiles.
The explicit --enable-local-store flag opts this demonstration into local writes.
"""
import argparse
import asyncio
import base64
import hashlib
import json
import os
import secrets
import tempfile
import uuid
from pathlib import Path

os.environ.setdefault('ANONYMIZED_TELEMETRY', 'false')
os.environ.setdefault('BROWSER_USE_LOGGING_LEVEL', 'error')
from browser_use import Agent, BrowserSession, ChatOpenAI, Tools
from memorable_browser_use import BrowserMemory, MemorableMemory, BrowserMetadata, BROWSER_METADATA, collect_page_snapshot
from memorable_browser_use.wire import BrowserWire

ORIGIN = 'https://quotes.toscrape.com'
TASKS = [
    'Visit page two of the public quotes website and confirm there are ten quotes.',
    'Move to the next page of the quote listing and check that it contains ten entries.',
]


def private_json(path, body):
    path.write_text(json.dumps(body, indent=2) + '\n')
    path.chmod(0o600)


async def exercise(args):
    if args.env_file:
        from dotenv import dotenv_values
        values = dotenv_values(args.env_file)
        for name in ('OPENAI_API_KEY', 'MEMORABLE_API_KEY', 'MEMORABLE_API_URL'):
            if values.get(name): os.environ[name] = values[name]
    if not os.environ.get('OPENAI_API_KEY'):
        raise RuntimeError('OPENAI_API_KEY required')
    # Resolve the user's existing Memorable embedding configuration before
    # selecting the isolated local store. Values never enter reports or argv.
    configured_home = Path(os.environ.get('MEMORABLE_HOME', str(Path.home())))
    try: configured = json.loads((configured_home / '.memorable/config.json').read_text())
    except (OSError, ValueError): configured = {}
    for name, field in [('MEMORABLE_API_KEY', 'api_key'), ('MEMORABLE_API_URL', 'api_url')]:
        if not os.environ.get(name) and configured.get(field): os.environ[name] = configured[field]
    out = Path(args.output).resolve()
    out.mkdir(parents=True, exist_ok=True, mode=0o700)
    settings = out / 'private-settings.json'
    if settings.exists(): local = json.loads(settings.read_text())
    else:
        local = {'salt': secrets.token_hex(32), 'instance_id': str(uuid.uuid4()), 'store_key': secrets.token_hex(32)}
        private_json(settings, local)
    os.environ['MEMORABLE_HOME'] = str(out / 'memory-home')
    os.environ['MEMORABLE_BACKEND'] = 'local'
    os.environ['MEMORABLE_STORE_KEY'] = local['store_key']
    command = [args.node, str(Path(args.memorable_cli).resolve())]
    if args.enable_local_store:
        allowed = {'PATH', 'HOME', 'TMPDIR', 'LANG'}
        child_env = {k:v for k,v in os.environ.items() if k in allowed or k.startswith('MEMORABLE_')}
        p = await asyncio.create_subprocess_exec(*command, 'enable', env=child_env,
                    stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        await asyncio.wait_for(p.communicate(), 15)
        if p.returncode: raise RuntimeError('local consent setup failed')
    memory = MemorableMemory(command, metadata=BROWSER_METADATA, embedding=args.embedding)
    report = {'storage': 'existing Memorable local procedure store', 'embedding_mode': args.embedding,
              'browser_use': '0.13.10', 'runs': [], 'complete': False}
    try:
        for i, task in enumerate(TASKS):
            folder = out / f'run-{i+1}'
            folder.mkdir(exist_ok=True, mode=0o700)
            wire = BrowserWire(label_salt=local['salt'], instance_id=local['instance_id'],
                               task_label=task, allowed_path_segments=['page'], runtime_version='0.13.10')
            mapper = BrowserMetadata(wire, project='quotes-demo', website='quotes.toscrape.com',
                        workflow='Navigate paginated quote listings', recall_query=task,
                        private_notes='PRIVATE_DEMO_SENTINEL')
            with tempfile.TemporaryDirectory(prefix='memorable-metadata-chrome-') as profile:
                browser = BrowserSession(headless=True, executable_path=args.chrome, user_data_dir=profile, keep_alive=True)
                capture = None
                row = {'run': i+1}
                try:
                    await browser.start()
                    tools = Tools()
                    Action = tools.registry.create_action_model()
                    await tools.act(Action(navigate={'url':ORIGIN+'/'}), browser_session=browser)
                    async def state(): return wire.snapshot(await collect_page_snapshot(browser))
                    capture = BrowserMemory(memory=memory, task=task, journal_dir=folder/'journal', enabled=True,
                              state_provider=state, normalize_event=mapper.normalize_event,
                              recall_request=mapper.recall_request, store_request=mapper.store_request,
                              render_recall=mapper.render_recall, recall_timeout=20)
                    await capture.prepare()
                    if capture.diagnostics: raise RuntimeError('recall failed; see diagnostics')
                    hits = capture.recall_result['matches']
                    if i == 1 and not any(m['id']==report['runs'][0]['id'] for m in hits):
                        raise RuntimeError('paraphrased recall did not retrieve the first run')
                    if i == 0 and hits: raise RuntimeError('first run requires an empty isolated store')
                    llm = ChatOpenAI(model='gpt-4.1-mini', api_key=os.environ['OPENAI_API_KEY'],
                                     base_url='https://api.openai.com/v1', timeout=60, max_retries=0)
                    agent = Agent(task=capture.task_with_context, llm=llm, tools=capture.wrap_tools(tools),
                                  browser_session=browser, use_judge=False, max_failures=1, final_response_after_failure=False)
                    history = await agent.run(max_steps=8)
                    page = await browser.must_get_current_page()
                    observation = json.loads(await page.evaluate('() => ({url:location.href,quotes:document.querySelectorAll(".quote").length})'))
                    verified = observation['url']==ORIGIN+'/page/2/' and observation['quotes']==10
                    verification = {'ok':verified, 'method':'independent DOM URL and card count', **observation}
                    await capture.finish(verification=verification)
                    (folder/'browser.png').write_bytes(base64.b64decode(await page.screenshot()))
                    rendered = capture.context
                    private_json(folder/'recalled.json',capture.recall_result)
                    (folder/'reference.txt').write_text(rendered)
                    (folder/'reference.txt').chmod(0o600)
                    # Inspect the actual message list supplied to the model. Keep
                    # only a boolean, not screenshots or model/provider payloads.
                    messages = agent._message_manager.last_input_messages
                    sent = json.dumps([m.model_dump(mode='json') for m in messages], ensure_ascii=False)
                    row.update(id=capture.record['run_id'], observation=observation, independently_verified=verified,
                        agent_actions=history.action_names(), agent_errors=sum(e is not None for e in history.errors()),
                        model_steps=len(history.model_outputs()), captured_actions=len(capture.record['events']),
                        receipt=capture.store_result, recall_ids=[m['id'] for m in hits],
                        recall_embedding=capture.recall_result['embedding'],
                        context_bytes=len(rendered.encode()), context_sha256=hashlib.sha256(rendered.encode()).hexdigest(),
                        reference_in_actual_model_messages=bool(rendered) and 'memorable-reference' in sent and 'Previous browser workflow' in sent,
                        private_marker_absent_from_recall='PRIVATE_DEMO_SENTINEL' not in json.dumps(capture.recall_result),
                        private_marker_absent_from_model='PRIVATE_DEMO_SENTINEL' not in sent)
                    if not verified or not capture.store_result: raise RuntimeError('browser verification or memory store failed')
                    if i == 1 and not row['reference_in_actual_model_messages']: raise RuntimeError('recalled reference missing from actual model messages')
                finally:
                    if capture:
                        row['diagnostics']=capture.diagnostics
                        row.setdefault('id',capture.record['run_id'])
                        row.setdefault('receipt',capture.store_result)
                    report['runs'].append(row)
                    private_json(out/'report.json',report)
                    await browser.kill()
        # Each call starts a fresh CLI process. Check hard filters against actual
        # persisted records, not a seeded retrieval fixture.
        query = {'query':TASKS[1], 'metadata':{'project':'quotes-demo','website':'quotes.toscrape.com','outcome':'verified'}}
        checks = {}
        for field, value in [('project','different-project'),('website','different.example'),('outcome','failed')]:
            result = await memory.recall({**query,'metadata':{**query['metadata'],field:value}})
            checks[field] = {'matches':len(result['matches']), 'eligible':result['eligible'], 'embedding':result['embedding']['status']}
            if result['matches'] or result['eligible']: raise RuntimeError('hard filter failed')
        unrelated = await memory.recall({**query,'query':'Configure database backups and rotate encryption certificates'})
        report['hard_filter_checks']=checks
        report['unrelated_query_matches']=len(unrelated['matches'])
        report['complete']=len(unrelated['matches'])==0
        if not report['complete']: raise RuntimeError('unrelated query returned browser workflow')
    except BaseException as error:
        report['failure']=type(error).__name__
        raise
    finally:
        private_json(out/'report.json',report)
        print(json.dumps(report,indent=2))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--memorable-cli',required=True)
    parser.add_argument('--node',default='node')
    parser.add_argument('--chrome',required=True)
    parser.add_argument('--output',required=True)
    parser.add_argument('--env-file')
    parser.add_argument('--embedding',choices=['required','optional','off'],default='required')
    parser.add_argument('--enable-local-store',action='store_true')
    asyncio.run(exercise(parser.parse_args()))
