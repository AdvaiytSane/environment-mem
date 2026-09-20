import {body,db,owner,failure,latest,listRuns} from '@/lib/server';
import {fieldsOf} from '@/lib/model';
import {resolve} from '@/lib/resolve';
export async function POST(r:Request){try{const user=await owner();const p=await body(r);const w=await latest(user,p.workflowId);if(!p.input||typeof p.input!=='object'||Array.isArray(p.input))throw new Error('Supply incoming metadata');const input:Record<string,string>={};for(const f of fieldsOf(w)){if(f.exposure==='send'&&['must_match','prefer'].includes(f.purpose)){const v=p.input[f.key];if(v!==undefined){if(typeof v!=='string'||v.length>2000)throw new Error('Invalid value for '+f.label);input[f.key]=v}}}
const receipt=resolve(w,await listRuns(user,w.id),input,new Date().toISOString());await db().prepare('INSERT INTO retrieval_receipts (id,owner,workflow_id,data,created_at) VALUES (?,?,?,?,?)').bind(receipt.id,user,w.id,JSON.stringify(receipt),receipt.asOf).run();return Response.json(receipt)}catch(e){return failure(e)}}
