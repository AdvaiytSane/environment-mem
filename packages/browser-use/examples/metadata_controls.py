"""Real-browser failure controls for native CLI memory; scripted actions, no LLM."""
import argparse
import asyncio
import json
import os
import tempfile
import uuid
from pathlib import Path
os.environ.setdefault('ANONYMIZED_TELEMETRY','false')
os.environ.setdefault('BROWSER_USE_LOGGING_LEVEL','error')
from browser_use import BrowserSession, Tools
from memorable_browser_use import BrowserMemory, MemorableMemory, BrowserMetadata, BROWSER_METADATA, collect_page_snapshot
from memorable_browser_use.wire import BrowserWire

async def main(args):
    output=Path(args.output).resolve()
    output.mkdir(parents=True,exist_ok=True,mode=0o700)
    report={'execution':'scripted real Browser Use Tools.act; no model', 'cases':[]}
    for case in ('disabled','kill_switch','missing_cli','no_consent'):
        with tempfile.TemporaryDirectory(prefix='memorable-control-') as directory:
            root=Path(directory)
            os.environ['MEMORABLE_HOME']=str(root/'memory-home')
            os.environ['MEMORABLE_BACKEND']='local'
            os.environ['MEMORABLE_BROWSER_USE_DISABLED']='1' if case=='kill_switch' else '0'
            # No configured credentials, embedding request or provider call is needed.
            memory=MemorableMemory([str(root/'absent-cli')] if case=='missing_cli' else [args.node,str(Path(args.memorable_cli).resolve())],metadata=BROWSER_METADATA,embedding='off')
            wire=BrowserWire(label_salt='public-control-salt',instance_id=str(uuid.uuid4()),task_label='Navigate to the next quote page',allowed_path_segments=['page'])
            mapper=BrowserMetadata(wire,project='control',website='quotes.toscrape.com',workflow='Paginate quote listings',recall_query='Navigate to the next quote page')
            browser=BrowserSession(headless=True,executable_path=args.chrome,user_data_dir=str(root/'chrome'),keep_alive=True)
            try:
                await browser.start()
                tools=Tools(); Action=tools.registry.create_action_model()
                await tools.act(Action(navigate={'url':'https://quotes.toscrape.com/'}),browser_session=browser)
                async def state(): return wire.snapshot(await collect_page_snapshot(browser))
                journal=output/case/'journal'
                capture=BrowserMemory(memory=memory,task='Navigate to the next quote page',enabled=case!='disabled',journal_dir=journal,state_provider=state,normalize_event=mapper.normalize_event,store_request=mapper.store_request,recall_request=mapper.recall_request,render_recall=mapper.render_recall)
                await capture.prepare()
                wrapped=capture.wrap_tools(tools)
                await browser.get_browser_state_summary(include_screenshot=False)
                selectors=await browser.get_selector_map()
                index=next(i for i,node in selectors.items() if node.attributes.get('href')=='/page/2/')
                await wrapped.act(Action(click={'index':index}),browser_session=browser)
                page=await browser.must_get_current_page()
                observed=json.loads(await page.evaluate('() => ({url:location.href,quotes:document.querySelectorAll(".quote").length})'))
                ok=observed=={'url':'https://quotes.toscrape.com/page/2/','quotes':10}
                await capture.finish(verification={'ok':ok,**observed})
                row={'case':case,'page_verified':ok,'context_empty':not capture.context,'captured_actions':len(capture.record['events']),'diagnostics':capture.diagnostics,'journal_exists':journal.exists(),'outbox_retained':(journal/'outbox.jsonl').exists(),'store_receipt':capture.store_result}
                assert ok and not capture.context and capture.store_result is None
                if case in ('disabled','kill_switch'): assert not journal.exists() and not capture.record['events']
                else:
                    assert row['outbox_retained'] and {d['stage'] for d in capture.diagnostics}>={'recall','store'}
                    if case=='no_consent': assert all(d['error']=='consent_required' for d in capture.diagnostics)
                report['cases'].append(row)
            finally:
                await browser.kill()
    report['complete']=True
    target=output/'report.json';target.write_text(json.dumps(report,indent=2)+'\n');target.chmod(0o600)
    print(json.dumps(report,indent=2))

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--node',default='node');p.add_argument('--memorable-cli',required=True)
    p.add_argument('--chrome',required=True);p.add_argument('--output',required=True)
    asyncio.run(main(p.parse_args()))
