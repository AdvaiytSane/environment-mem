import type {Source,Field,Evidence} from './model';
export async function github(repo:string,transport:'server'|'browser'='server'):Promise<Source>{
 const raw=repo.trim().replace(/^https:\/\/github.com\//,'').replace(/\/$/,'').replace(/\.git$/,'');
 if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(raw))throw new Error('Enter a public GitHub URL or owner/repository');
 const proofs:Evidence[]=[];
 async function get(path:string,optional=false){const url='https://api.github.com/repos/'+path;const r=await fetch(url,{headers:transport==='server'?{Accept:'application/vnd.github+json','User-Agent':'Memorable-Workflow-Studio'}:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000)});proofs.push({url,status:r.status,requestId:r.headers.get('x-github-request-id'),observedAt:new Date().toISOString()});if(optional&&r.status===404)return null;if(!r.ok)throw new Error(r.status===403||r.status===429?'GitHub rate limit reached. Try again later.':r.status===404?'Public repository not found. Check the URL.':'GitHub could not be read ('+r.status+')');return r.json() as Promise<any>}
 const data=await get(raw);const branch=await get(raw+'/branches/'+encodeURIComponent(data.default_branch));const sha=branch.commit.sha;
 const pkg=await get(raw+'/contents/package.json?ref='+encodeURIComponent(sha),true);
 let parsed:any={};if(pkg?.content&&pkg.encoding==='base64'){try{parsed=JSON.parse(atob(pkg.content.replace(/\n/g,'')))}catch{}}
 const observedAt=new Date().toISOString();const values:[string,string,unknown,Field['purpose']][]=[['repository_id','Repository ID',data.id,'must_match'],['repository','Repository',data.full_name,'context'],['branch','Default branch',data.default_branch,'prefer'],['language','Language',data.language,'prefer'],['commit','Observed commit',sha,'context'],['node','Node requirement',parsed.engines?.node,'prefer'],['package_manager','Package manager',parsed.packageManager,'prefer']];
 return {id:'github',kind:'github',name:data.full_name,transport,observedAt,evidence:proofs,fields:values.filter(v=>v[2]!==null&&v[2]!==undefined).map(([key,label,value,purpose])=>({key:'github.'+key,label,value:String(value),type:typeof value==='number'?'number':'string',purpose,exposure:'send',include:key!=='repository_id',maxAge:key==='commit'?86400:0,sourceId:'github',observedAt}))};
}
