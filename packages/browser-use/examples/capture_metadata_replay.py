"""Capture genuine browser frames around the existing two-run metadata example.

This replays a recording for people; it does not replay browser actions. Only the
public quotes demo is supported. Private journals/provider logs stay outside the
publishable replay directory. Requires the same arguments as metadata_browser.py.
"""
import argparse
import asyncio
import base64
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import time

import metadata_browser as example


def actions(output):
    """Allowlist public demonstration action arguments; omit typed/model prose."""
    rows = []
    for action in getattr(output, 'action', []) or []:
        body = action.model_dump(exclude_none=True)
        for name, value in body.items():
            row = {'name': name}
            if isinstance(value, dict):
                if isinstance(value.get('index'), int): row['index'] = value['index']
                if isinstance(value.get('url'), str) and value['url'].startswith(example.ORIGIN + '/'):
                    row['url'] = value['url']
                if name == 'done' and isinstance(value.get('success'), bool): row['reportedSuccess'] = value['success']
            rows.append(row)
    return rows


async def main(args):
    out = Path(args.output).resolve()
    public = out / 'replay'
    public.mkdir(parents=True, exist_ok=True, mode=0o700)
    started = time.monotonic()
    replay = {'schema': 'memorable.replay.v1', 'id': 'browser',
        'title': 'Browser Use remembers a real pagination workflow',
        'agent': 'Browser Use 0.13.10 / OpenAI gpt-4.1-mini',
        'recordedAt': datetime.now(timezone.utc).isoformat(),
        'summary': 'Two fresh agents visit a public website. The second recalls the first run through Memorable.',
        'sourceUrl': example.ORIGIN,
        'limitations': [
            'Recorded real screenshots and action events; this is a visual playback, not deterministic action replay.',
            'Before frames are the browser state captured for the model; after frames are taken after a whole model step. A step can contain multiple actions.',
            'Recall and injection boundaries are assembled from the validated run report in their lifecycle order before Agent.run(); they have no exact event timestamps.',
            'No cursor position or movement is fabricated. Screenshots do not by themselves prove every action succeeded.',
            'Independent final URL and quote-count verification proves the final task, not every unknown tool result.',
            'Storage receipts refer to the existing encrypted local Memorable store; embeddings use its configured production service.',
            'This demonstration establishes memory delivery, not a speedup or a causal performance benefit.',
        ], 'chapters': []}

    def persist():
        path = public / 'replay.json'
        path.write_text(json.dumps(replay, indent=2) + '\n')
        path.chmod(0o600)

    OriginalAgent = example.Agent

    class RecordedAgent(OriginalAgent):
        def __init__(self, *a, **kwargs):
            self._replay_n = len(replay['chapters']) + 1
            self._chapter = {'id': f'run-{self._replay_n}',
                'title': 'First run · learn the workflow' if self._replay_n == 1 else 'Second run · recall the workflow',
                'task': example.TASKS[self._replay_n - 1], 'result': 'running', 'events': []}
            replay['chapters'].append(self._chapter)
            self._step = 0
            self._proposed = []
            self._frame = 0
            self._step_started = time.monotonic()
            kwargs['register_new_step_callback'] = self._before_action
            super().__init__(*a, **kwargs)

        async def _snapshot(self, encoded=None):
            page = await self.browser_session.must_get_current_page()
            observation = json.loads(await page.evaluate('() => ({url:location.href,quotes:document.querySelectorAll(".quote").length})'))
            if not observation['url'].startswith(example.ORIGIN + '/'):
                raise RuntimeError('Refusing to publish screenshots outside the public demonstration origin')
            if encoded is None: encoded = await page.screenshot()
            self._frame += 1
            name = f'run-{self._replay_n}-frame-{self._frame:02d}.png'
            binary = base64.b64decode(encoded)
            (public / name).write_bytes(binary)
            return name, observation, hashlib.sha256(binary).hexdigest()

        def _event(self, kind, title, summary, **extra):
            event = {'id': f"run-{self._replay_n}-event-{len(self._chapter['events'])+1}",
                'kind': kind, 'title': title, 'summary': summary, 'status': 'observed', 'durationMs': None,
                'elapsedMs': round((time.monotonic()-started)*1000), **extra}
            self._chapter['events'].append(event)
            persist()

        async def _before_action(self, state, output, step):
            self._step = step
            self._proposed = actions(output)
            self._step_started = time.monotonic()
            # Browser Use calls this callback after receiving the model output,
            # before executing its proposed actions. Its screenshot was captured
            # earlier as the actual model input, not re-created from history.
            frame, observed, digest = await self._snapshot(state.screenshot)
            self._event('tool', f'Step {step} · before action',
                'Real browser state supplied to the model; these actions are proposed and have not executed at this event.',
                tool=', '.join(row['name'] for row in self._proposed),
                input={'proposedActions': self._proposed}, output={'observedAtCallback': observed, 'frameSha256': digest},
                frame=frame, frameCaption='Before execution · browser screenshot from this model step', phase='before')

        async def _after_step(self, agent):
            frame, observed, digest = await self._snapshot()
            latest = self.history.history[-1] if self.history.history else None
            results = []
            for result in getattr(latest, 'result', []) or []:
                results.append({'isDone': bool(getattr(result, 'is_done', False)),
                    'reportedSuccess': getattr(result, 'success', None),
                    'hasError': bool(getattr(result, 'error', None))})
            self._event('tool', f'Step {self._step} · observed result',
                'Screenshot after the model step finished; execution results remain separate from task verification.',
                tool=', '.join(row['name'] for row in self._proposed),
                input={'proposedActions': self._proposed}, output={'observation': observed, 'toolResults': results, 'frameSha256': digest},
                frame=frame, frameCaption='After execution · actual page at the end of this model step', phase='after',
                durationMs=round((time.monotonic()-self._step_started)*1000),
                status='failed' if any(row['hasError'] for row in results) else 'observed')

        async def run(self, *a, **kwargs):
            frame, observed, digest = await self._snapshot()
            self._event('start', 'Fresh browser session', 'Real initial page after bootstrap navigation, before this agent runs.',
                output={'observation': observed, 'frameSha256': digest}, frame=frame, frameCaption='Initial browser state · page one')
            kwargs['on_step_end'] = self._after_step
            try:
                return await super().run(*a, **kwargs)
            finally:
                persist()

    example.Agent = RecordedAgent
    try:
        await example.exercise(args)
    finally:
        example.Agent = OriginalAgent
        report_path = out / 'report.json'
        if report_path.exists():
            report = json.loads(report_path.read_text())
            for index, row in enumerate(report.get('runs', [])):
                if index >= len(replay['chapters']): break
                chapter = replay['chapters'][index]
                chapter['runId'] = row.get('id')
                chapter['result'] = 'verified' if row.get('independently_verified') and row.get('receipt') else 'incomplete'
                recall = {'id': f'run-{index+1}-recall', 'kind': 'recall',
                    'title': 'Recall returned the earlier workflow' if row.get('recall_ids') else 'Recall searched an empty store',
                    'summary': 'Observed CLI recall before agent construction. Returned IDs are from this actual run.',
                    'status': 'observed', 'durationMs': None,
                    'output': {'memoryIds': row.get('recall_ids', []), 'embedding': row.get('recall_embedding')}}
                chapter['events'].insert(0, recall)
                if row.get('reference_in_actual_model_messages'):
                    chapter['events'].insert(1, {'id': f'run-{index+1}-inject', 'kind': 'inject',
                        'title': 'Memory reached the next model input',
                        'summary': 'The existing verifier inspected the actual model message list for the recalled reference.',
                        'status': 'verified', 'durationMs': None,
                        'output': {'referenceInActualModelMessages': True, 'contextBytes': row.get('context_bytes'),
                                   'contextSha256': row.get('context_sha256')}})
                chapter['events'].append({'id': f'run-{index+1}-verify', 'kind': 'verify',
                    'title': 'Final page checked independently', 'summary': 'Independent DOM check: exact page-two URL and ten quote cards.',
                    'status': 'verified' if row.get('independently_verified') else 'failed', 'durationMs': None,
                    'output': row.get('observation', {}),
                    'frame': next((e['frame'] for e in reversed(chapter['events']) if e.get('frame')), None),
                    'frameCaption': 'Last real browser frame before the independent final check'})
                if row.get('receipt'):
                    chapter['events'].append({'id': f'run-{index+1}-store', 'kind': 'store',
                        'title': 'Trace stored in Memorable', 'summary': 'Actual receipt from the existing local procedure store.',
                        'status': 'observed', 'durationMs': None, 'output': row['receipt']})
            replay['complete'] = report.get('complete', False)
            replay['verification'] = {'hardFilterChecks': report.get('hard_filter_checks'),
                                      'unrelatedQueryMatches': report.get('unrelated_query_matches')}
        persist()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--memorable-cli', required=True)
    parser.add_argument('--node', default='node')
    parser.add_argument('--chrome', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--env-file')
    parser.add_argument('--embedding', choices=['required', 'optional', 'off'], default='required')
    parser.add_argument('--enable-local-store', action='store_true')
    asyncio.run(main(parser.parse_args()))
