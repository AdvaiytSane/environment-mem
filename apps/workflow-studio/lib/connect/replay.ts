export type ReplayEvent={id:string;kind:'start'|'tool'|'store'|'recall'|'inject'|'verify';title:string;summary:string;status:'observed'|'verified'|'failed'|'unknown';tool?:string;phase?:'before'|'after';input?:unknown;output?:unknown;durationMs:number|null;frame?:string;frameCaption?:string};
export type ReplayChapter={id:string;title:string;task:string;result:string;events:ReplayEvent[]};
export type ReplayRecording={schema:'memorable.replay.v1';id:string;title:string;agent:string;recordedAt:string;summary:string;sourceUrl:string;limitations:string[];chapters:ReplayChapter[]};
export function parseReplay(value:unknown,id:string):ReplayRecording{
 const r=value as ReplayRecording;
 if(!r||r.schema!=='memorable.replay.v1'||r.id!==id||!Array.isArray(r.chapters)||!r.chapters.length||!Array.isArray(r.limitations))throw new Error('The replay recording is incomplete.');
 const seen=new Set<string>();
 for(const c of r.chapters){if(!c.id||!Array.isArray(c.events)||!c.events.length)throw new Error('This recording has an empty chapter.');for(const e of c.events){if(!e.id||seen.has(e.id)||!e.title||!['start','tool','store','recall','inject','verify'].includes(e.kind)||!['observed','verified','failed','unknown'].includes(e.status))throw new Error('This recording has an invalid event.');seen.add(e.id);if(e.frame&&!/^[a-zA-Z0-9_.-]+\.(png|jpg|jpeg|webp)$/.test(e.frame))throw new Error('Invalid recording image.');if(e.durationMs!==null&&(!Number.isFinite(e.durationMs)||e.durationMs<0))throw new Error('Invalid recorded duration.');}}
 if(seen.size>250)throw new Error('This recording is too large.');
 return r;
}
