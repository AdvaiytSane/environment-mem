import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemorable } from '../dist/sdk/index.js';

const metadata = { project: { use: 'filter' }, task: { use: 'semantic' }, notes: { use: 'private' } };
const child = `let data=''; for await (const c of process.stdin) data+=c; const b=JSON.parse(data); const op=process.argv[2]; console.log(JSON.stringify({schema:'memorable.memory.v1',operation:op,result:op==='store'?{status:'stored',storage:'local',id:b.request.id,definition:b.config.metadata,argv:process.argv.slice(1),providerLeaked:'OPENAI_API_KEY' in process.env}:{matches:[],eligible:0,schema:'fixture'}}));`;
test('metadata SDK delegates both operations to native CLI with schema snapshot and scrubbed child environment', async () => {
  const defs=structuredClone(metadata);
  const memory=createMemorable({command:process.execPath,args:['--input-type=module','-e',child],metadata:defs,env:{OPENAI_API_KEY:'test-only-provider-key'}});
  defs.notes.use='semantic';
  const receipt=await memory.store({id:'actual-run-id',trace:[{action:'click'}],metadata:{project:'demo',task:'Find quotes',notes:'private'}});
  assert.deepEqual(receipt.argv,['memory','store','-']);
  assert.equal(receipt.definition.notes.use,'private');
  assert.equal(receipt.providerLeaked,false);
  assert.deepEqual((await memory.recall({query:'Find quotes',metadata:{project:'demo'}})).matches,[]);
});
test('an older CLI cannot silently turn metadata requests into successful text responses',async()=>{
  const memory=createMemorable({command:process.execPath,args:['-e',"console.log('usage: memorable recall <task>')"],metadata});
  await assert.rejects(memory.recall({query:'Find quotes',metadata:{project:'demo'}}),/does not support/);
});
