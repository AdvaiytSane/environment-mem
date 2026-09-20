import {body,owner,failure,github} from '@/lib/server';
export async function POST(r:Request){try{await owner();const p=await body(r);if(typeof p.repo!=='string')throw new Error('Repository URL is required');return Response.json(await github(p.repo))}catch(e){return failure(e)}}
