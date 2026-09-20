import json
import unittest
import uuid
from memorable_browser_use import BrowserMetadata, BROWSER_METADATA
from memorable_browser_use.wire import BrowserWire

class MetadataTests(unittest.TestCase):
    def mapper(self):
        wire=BrowserWire(label_salt='a stable private salt',task_label='Find ten quotes on the second page',instance_id=str(uuid.uuid4()))
        return BrowserMetadata(wire,project='demo',website='quotes.test',workflow='Paginate quotes',recall_query='Next quote page',private_notes='PRIVATE_TEST')

    def test_unknown_action_retains_position_without_fabricating_success(self):
        m=self.mapper()
        event=m.normalize_event({'phase':'finished','action':{'custom_tool':{'text':'PRIVATE_TYPED_VALUE'}}})
        self.assertEqual(event['outcome'],'unknown')
        self.assertNotIn('PRIVATE_TYPED_VALUE',json.dumps(event))
        record={'run_id':'run-one','events':[event],'verification':{'ok':True},'outcome':'completed'}
        body=m.store_request(record)
        self.assertEqual(body['metadata']['outcome'],'verified')
        self.assertEqual(body['trace']['actions'][0]['outcome'],'unknown')
        self.assertEqual(body['metadata']['runNotes'],'PRIVATE_TEST')
        self.assertEqual(BROWSER_METADATA['runNotes']['use'],'private')
        self.assertEqual(m.recall_request({})['metadata'],{'project':'demo','website':'quotes.test','outcome':'verified'})

    def test_renderer_uses_actual_actions_and_never_private_notes(self):
        m=self.mapper()
        trace={'schema':'browser-use.trace.v1','verification':{'ok':True},'actions':[{'browser_event':{
            'verb':'click','target':{'role':'link','name_tokens':['next']},'result':{'status':'ok'}}}]}
        match={'trace':trace,'metadata':{'project':'demo','website':'quotes.test','outcome':'verified','runNotes':'PRIVATE_TEST'}}
        text=m.render_recall({'matches':[match]})
        self.assertIn('click link "next"; observed outcome: success',text)
        self.assertNotIn('PRIVATE_TEST',text)
        self.assertEqual(m.render_recall({'matches':[{**match,'metadata':{**match['metadata'],'website':'wrong.test'}}]}),'')

    def test_renderer_requires_verification_evidence(self):
        m = self.mapper()
        for verification in (None, {}, {"ok": False}, {"ok": "true"}):
            match = {"trace": {"schema": "browser-use.trace.v1", "actions": [], "verification": verification},
                     "metadata": {"project": "demo", "website": "quotes.test", "outcome": "verified"}}
            self.assertEqual(m.render_recall({"matches": [match]}), "")
