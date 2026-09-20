"""One paired, live Browser Use benchmark: cold run then retrieved context.

Read-only public-site task. No Browser Use or Memorable internals are patched.
Provider response usage is recorded, including extraction calls and cached tokens.
"""
import argparse
import asyncio
import base64
import hashlib
import json
import os
import re
import secrets
import tempfile
import time
import uuid
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

os.environ.setdefault('ANONYMIZED_TELEMETRY','false')
os.environ.setdefault('BROWSER_USE_LOGGING_LEVEL','error')
import httpx
from pydantic import BaseModel
from browser_use import Agent, BrowserSession, ChatOpenAI, Tools
from memorable_browser_use import BrowserMemory, MemorableMemory, BrowserMetadata, BROWSER_METADATA, collect_page_snapshot
from memorable_browser_use.wire import BrowserWire

ORIGIN='https://quotes.toscrape.com'
AUTHORS=['Albert Einstein','Marilyn Monroe','Jane Austen','Mark Twain','Bob Marley']
MODEL='gpt-4.1-mini-2025-04-14'
TASK='''Audit https://quotes.toscrape.com using the rendered browser website. Visit every one of its ten quote-listing pages. For each page report its page number, quote count, number of quotes carrying the exact tag love, first quote author, and last quote author. Then open the site's author biography pages for Albert Einstein, Marilyn Monroe, Jane Austen, Mark Twain, and Bob Marley; report each author's birth date and birth location exactly as displayed. Return all ten page rows, total quote count, total love-tagged quote count, and the five author rows. Use the site's browser pages and links; do not use external search, direct HTTP requests, or programmatic multi-page scraping. You may keep working notes in files. Even if given a past workflow, revisit every required page and verify its current data. Do not treat historical results as current answers. The evaluate tool may read the current page DOM, but must not fetch other pages. The extract tool takes a natural-language question, not a CSS selector. For exact numerical counts use evaluate on the current DOM rather than estimating from text extraction. Save page-specific results before navigating away. Preserve the birth location text including any leading in. Follow actual author links instead of guessing URLs.'''

class PageRow(BaseModel):
    page: int
    quote_count: int
    love_count: int
    first_author: str
    last_author: str
class AuthorRow(BaseModel):
    name: str
    birth_date: str
    birth_location: str
class AuditResult(BaseModel):
    pages: list[PageRow]
    total_quotes: int
    total_love_quotes: int
    authors: list[AuthorRow]

def save(path, body):
    path.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
    path.write_text(json.dumps(body,indent=2,ensure_ascii=False)+'\n'); path.chmod(0o600)

def cost(usage):
    # Official model page checked 2026-09-20. Estimate, not an invoice.
    return ((usage['input_tokens']-usage['cached_input_tokens'])*0.40 + usage['cached_input_tokens']*0.10 + usage['output_tokens']*1.60)/1_000_000

class UsageRecorder:
    def __init__(self,folder): self.rows=[]; self.folder=folder; self.reference_seen=False
    async def request(self,request):
        request.extensions['benchmark_start']=time.perf_counter()
        if b'<memorable-reference>' in request.content: self.reference_seen=True
    async def response(self,response):
        await response.aread()
        try: body=response.json()
        except ValueError: body={}
        usage=body.get('usage') or {}
        self.rows.append({'call':len(self.rows)+1,'status':response.status_code,'response_id':body.get('id'),
            'model':body.get('model'),'system_fingerprint':body.get('system_fingerprint'),
            'seconds':round(time.perf_counter()-response.request.extensions['benchmark_start'],3),
            'input_tokens':usage.get('prompt_tokens',0),'output_tokens':usage.get('completion_tokens',0),
            'cached_input_tokens':(usage.get('prompt_tokens_details') or {}).get('cached_tokens',0),
            'usage_available':bool(usage)})
        save(self.folder/'provider-usage.json',self.rows)
    def summary(self):
        result={k:sum(row[k] for row in self.rows) for k in ('input_tokens','output_tokens','cached_input_tokens')}
        result['total_tokens']=result['input_tokens']+result['output_tokens']
        result['api_calls']=len(self.rows)
        result['all_responses_have_usage']=bool(self.rows) and all(r['usage_available'] for r in self.rows)
        result['estimated_model_cost_usd']=round(cost(result),8)
        result['uncached_equivalent_cost_usd']=round((result['input_tokens']*.4+result['output_tokens']*1.6)/1e6,8)
        return result

class LongMetadata(BrowserMetadata):
    recall_outcome = 'verified'
    def recall_request(self, record):
        request = super().recall_request(record)
        request['metadata']['outcome'] = self.recall_outcome
        return request
    def render_recall(self, response):
        if self.recall_outcome == 'verified':
            return super().render_recall(response)
        lines = []
        for match in response.get('matches', [])[:1]:
            data, trace = match.get('metadata', {}), match.get('trace', {})
            if data.get('project') != self.project or data.get('website') != self.website or data.get('outcome') != 'unverified':
                continue
            if trace.get('schema') != 'browser-use.trace.v1' or trace.get('verification', {}).get('ok') is not False:
                continue
            lines.append('Historical unsuccessful browser attempt. It FAILED independent verification. These are observed attempts, not a recommended or verified procedure. Recheck every target and result; do not repeat a loop solely because it appears here.')
            for event in trace.get('actions', [])[:50]:
                lines.append(self._action_text(event, verified=False))
            lines.append('The previous attempt did not establish successful task completion. Complete the current task using current page evidence.')
        return '\n'.join(lines)
    def store_request(self,record):
        body=super().store_request(record)
        if body:
            # Long traces remain intact. Compact only the semantic search field,
            # deterministically, without inventing a better workflow for treatment.
            counts=Counter(body['metadata']['steps'])
            body['metadata']['steps']=[f'{n} occurrences: {text}' for text,n in counts.items()]
            search='\n'.join(f'{k}: {json.dumps(v,separators=(",",":"),sort_keys=True)}' for k,v in sorted(body['metadata'].items()) if BROWSER_METADATA[k]['use']=='semantic')
            if len(search)>2000: raise ValueError('semantic representation exceeds CLI limit')
        return body

class Observer:
    def __init__(self,browser,wire,folder): self.browser=browser; self.wire=wire; self.folder=folder; self.pages={};self.authors={}
    async def state(self):
        page=await self.browser.must_get_current_page()
        data=json.loads(await page.evaluate('''() => ({url:location.href,
          quote_count:document.querySelectorAll('.quote').length,
          love_count:[...document.querySelectorAll('.quote')].filter(q=>[...q.querySelectorAll('.tags .tag')].some(t=>t.textContent.trim()==='love')).length,
          first_author:document.querySelector('.quote .author')?.textContent.trim()||'',
          last_author:[...document.querySelectorAll('.quote .author')].at(-1)?.textContent.trim()||'',
          name:document.querySelector('.author-title')?.textContent.trim()||'',
          birth_date:document.querySelector('.author-born-date')?.textContent.trim()||'',
          birth_location:document.querySelector('.author-born-location')?.textContent.trim()||''})'''))
        if urlparse(data['url']).hostname=='quotes.toscrape.com':
            route=urlparse(data['url']).path
            if data['quote_count'] and (route=='/' or re.fullmatch(r'/page/\d+/',route)):
                number=1 if route=='/' else int(route.split('/')[2])
                self.pages[number]={'page':number,**{k:data[k] for k in ('quote_count','love_count','first_author','last_author')}}
            if data['name'] in AUTHORS and data['birth_date']:
                self.authors[data['name']]={k:data[k] for k in ('name','birth_date','birth_location')}
        save(self.folder/'observations.json',{'pages':list(self.pages.values()),'authors':list(self.authors.values())})
        return self.wire.snapshot(await collect_page_snapshot(self.browser))
    def verify(self,result):
        errors=[]
        if set(self.pages)!=set(range(1,11)): errors.append('not_all_ten_listing_pages_visited')
        if set(self.authors)!=set(AUTHORS): errors.append('not_all_five_author_pages_visited')
        if not result: errors.append('missing_structured_result')
        else:
            pages={r.page:r.model_dump() for r in result.pages}
            authors={r.name:r.model_dump() for r in result.authors}
            if len(result.pages)!=10 or pages!=self.pages: errors.append('page_results_differ_from_observed_DOM')
            if len(result.authors)!=5 or authors!=self.authors: errors.append('author_results_differ_from_observed_DOM')
            if result.total_quotes!=sum(p['quote_count'] for p in self.pages.values()): errors.append('wrong_total_quotes')
            if result.total_love_quotes!=sum(p['love_count'] for p in self.pages.values()): errors.append('wrong_total_love_quotes')
        return {'ok':not errors,'method':'independent DOM observations on every visited required page and exact final-output comparison','errors':errors,'listing_pages_visited':sorted(self.pages),'author_pages_visited':sorted(self.authors)}

async def main(args):
    from dotenv import dotenv_values
    for k,v in dotenv_values(args.env_file).items():
        if k in ('OPENAI_API_KEY','MEMORABLE_API_KEY','MEMORABLE_API_URL') and v: os.environ[k]=v
    if not os.environ.get('OPENAI_API_KEY'): raise RuntimeError('OpenAI key required')
    config=json.loads((Path(os.environ.get('MEMORABLE_HOME',str(Path.home())))/'.memorable/config.json').read_text())
    for env,key in [('MEMORABLE_API_KEY','api_key'),('MEMORABLE_API_URL','api_url')]:
        if not os.environ.get(env) and config.get(key): os.environ[env]=config[key]
    out=Path(args.output).resolve()
    resumed = args.resume_failed_baseline
    if resumed:
        previous = json.loads((out/'report.json').read_text())
        if len(previous['runs']) != 1 or previous['runs'][0].get('verification', {}).get('ok') is not False or not previous['runs'][0].get('receipt'):
            raise RuntimeError('Resume requires exactly one completed, stored baseline with failed verification')
        if previous['task'] != TASK: raise RuntimeError('Resume task must exactly match the baseline')
        settings = json.loads((out/'private-settings.json').read_text())
    else:
        if out.exists(): raise RuntimeError('Use a new output directory; no runs will be overwritten')
        out.mkdir(parents=True,mode=0o700)
        settings={'salt':secrets.token_hex(32),'instance_id':str(uuid.uuid4()),'store_key':secrets.token_hex(32)}
        save(out/'private-settings.json',settings)
    os.environ['MEMORABLE_HOME']=str(out/'memory-home');os.environ['MEMORABLE_BACKEND']='local';os.environ['MEMORABLE_STORE_KEY']=settings['store_key']
    command=[args.node,str(Path(args.memorable_cli).resolve())]
    env={k:v for k,v in os.environ.items() if k in {'PATH','HOME','TMPDIR','LANG'} or k.startswith('MEMORABLE_')}
    p=await asyncio.create_subprocess_exec(*command,'enable',env=env,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE)
    await p.communicate()
    if p.returncode: raise RuntimeError('local memory consent setup failed')
    memory=MemorableMemory(command,metadata=BROWSER_METADATA,embedding='required',timeout=30)
    report={'task':TASK,'task_sha256':hashlib.sha256(TASK.encode()).hexdigest(),'model':MODEL,'browser_use':'0.13.10',
        'settings':{'temperature':0,'seed':42,'vision':False,'max_steps':80,'max_actions_per_step':5,'judge':False,'excluded_tools':['search'],'max_completion_tokens':8192,'fresh_profiles':True},
        'pricing':{'source':'https://developers.openai.com/api/docs/models/gpt-4.1-mini','checked':'2026-09-20','per_million_input':.4,'per_million_cached_input':.1,'per_million_output':1.6},
        'runs':[],'complete':False,'embedding_cost_usd':None,'embedding_cost_note':'Existing API returns vector/model but no billable token or monetary usage; not treated as free.'}
    if resumed:
        report = previous
        report['injection_policy'] = 'Explicitly labeled unsuccessful attempt; outcome=unverified. No verified-workflow claim.'
    save(out/'report.json',report)
    for index,label in enumerate(('baseline','with-memory')):
        if resumed and index == 0: continue
        folder=out/label;folder.mkdir(mode=0o700)
        usage=UsageRecorder(folder)
        wire=BrowserWire(label_salt=settings['salt'],instance_id=settings['instance_id'],task_label='Audit ten quote listing pages and five author biographies',allowed_path_segments=['page','author'],runtime_version='0.13.10')
        mapper=LongMetadata(wire,project='long-browser-benchmark',website='quotes.toscrape.com',workflow='Audit paginated listings then verify author birth details',recall_query=TASK)
        if resumed: mapper.recall_outcome = 'unverified'
        row={'condition':label,'status':'running'};report['runs'].append(row);save(out/'report.json',report)
        with tempfile.TemporaryDirectory(prefix='memorable-long-chrome-') as profile:
            browser=BrowserSession(headless=True,executable_path=args.chrome,user_data_dir=profile,keep_alive=True,allowed_domains=['quotes.toscrape.com'])
            agent=None;capture=None
            async with httpx.AsyncClient(event_hooks={'request':[usage.request],'response':[usage.response]},timeout=90) as http:
                try:
                    await browser.start()
                    tools=Tools(exclude_actions=['search'])
                    Action=tools.registry.create_action_model()
                    await tools.act(Action(navigate={'url':ORIGIN+'/'}),browser_session=browser)
                    observer=Observer(browser,wire,folder)
                    capture=BrowserMemory(memory=memory,task=TASK,journal_dir=folder/'journal',enabled=True,state_provider=observer.state,
                        normalize_event=mapper.normalize_event,store_request=mapper.store_request,recall_request=mapper.recall_request,render_recall=mapper.render_recall,recall_timeout=25)
                    t=time.perf_counter();await capture.prepare();row['prepare_seconds']=round(time.perf_counter()-t,3)
                    if capture.diagnostics: raise RuntimeError('memory preparation failed')
                    if index==0 and capture.context: raise RuntimeError('baseline store must be empty')
                    if index==1 and (not capture.context or not any(m['id']==report['runs'][0]['run_id'] for m in capture.recall_result['matches'])): raise RuntimeError('baseline memory was not retrieved')
                    save(folder/'recalled.json',capture.recall_result)
                    (folder/'injected-reference.txt').write_text(capture.context)
                    llm=ChatOpenAI(model=MODEL,api_key=os.environ['OPENAI_API_KEY'],base_url='https://api.openai.com/v1',http_client=http,temperature=0,seed=42,max_retries=0,timeout=90,service_tier='default',max_completion_tokens=8192)
                    async def progress(state,output,step):
                        snap={'condition':label,'step':step,'actions':[list(a.model_dump(exclude_none=True)) for a in output.action],
                            'listing_pages_seen':sorted(observer.pages),'authors_seen':sorted(observer.authors),'usage':usage.summary()}
                        save(folder/'progress.json',snap)
                        print(json.dumps({'progress':snap}),flush=True)
                    async def stop(): return usage.summary()['total_tokens']>=1_000_000
                    agent=Agent(task=capture.task_with_context,llm=llm,tools=capture.wrap_tools(tools),browser_session=browser,use_vision=False,
                        output_model_schema=AuditResult,use_judge=False,max_failures=2,final_response_after_failure=False,max_actions_per_step=5,
                        file_system_path=str(folder/'agent-files'),register_new_step_callback=progress,register_should_stop_callback=stop)
                    t=time.perf_counter()
                    history=await asyncio.wait_for(agent.run(max_steps=80),timeout=1800)
                    row['agent_seconds']=round(time.perf_counter()-t,3)
                    try:
                        result=history.structured_output
                    except Exception:
                        result=None
                    verification=observer.verify(result)
                    if usage.summary()['total_tokens'] >= 1_000_000:
                        verification['stop_reason']='token_budget_reached'
                    save(folder/'final-answer.json',result.model_dump() if result else {'missing':True})
                    t=time.perf_counter();await capture.finish(verification=verification);row['store_seconds']=round(time.perf_counter()-t,3)
                    page=await browser.must_get_current_page();(folder/'final-browser.png').write_bytes(base64.b64decode(await page.screenshot()))
                    row.update(status='completed',run_id=capture.record['run_id'],verification=verification,model_steps=len(history.model_outputs()),
                        action_count=len(history.action_names()),action_counts=dict(Counter(history.action_names())),agent_errors=sum(e is not None for e in history.errors()),
                        usage=usage.summary(),browser_use_usage=history.usage.model_dump() if history.usage else None,
                        captured_actions=len(capture.record['events']),context_bytes=len(capture.context.encode()),
                        reference_in_provider_request=usage.reference_seen,recall_ids=[m['id'] for m in capture.recall_result['matches']],
                        recall_embedding=capture.recall_result['embedding'],receipt=capture.store_result,diagnostics=capture.diagnostics)
                    if not verification['ok'] and not resumed: raise RuntimeError('task output failed independent verification; result retained')
                    if not capture.store_result: raise RuntimeError('memory storage failed; result retained')
                    if not row['usage']['all_responses_have_usage']: raise RuntimeError('incomplete provider usage')
                    if index and not usage.reference_seen: raise RuntimeError('memory not present in provider request')
                except BaseException as error:
                    row.update(status='failed',error_type=type(error).__name__,usage=usage.summary())
                    if capture: row.update(diagnostics=capture.diagnostics,run_id=capture.record['run_id'])
                    raise
                finally:
                    save(out/'report.json',report)
                    await browser.kill()
    a,b=report['runs']
    report['comparison']={metric:{'baseline':a['usage'][metric],'with_memory':b['usage'][metric],'reduction_percent':round((1-b['usage'][metric]/a['usage'][metric])*100,2)} for metric in ('total_tokens','input_tokens','output_tokens','estimated_model_cost_usd','uncached_equivalent_cost_usd')}
    report['both_verified']=all(row['verification']['ok'] for row in report['runs'])
    report['complete']=True;save(out/'report.json',report)
    print(json.dumps({'complete':True,'comparison':report['comparison']}),flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--memorable-cli',required=True);p.add_argument('--node',default='node');p.add_argument('--chrome',required=True)
    p.add_argument('--env-file',required=True);p.add_argument('--output',required=True)
    p.add_argument('--resume-failed-baseline',action='store_true',help='Run the second condition using a stored failed baseline, explicitly marked unsuccessful in its reference')
    args=p.parse_args()
    try: asyncio.run(main(args))
    except Exception as error:
        # Provider/library error strings may contain keys; emit only the class.
        print(json.dumps({'benchmark_failed':type(error).__name__}),flush=True)
        raise SystemExit(1)
