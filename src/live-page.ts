export const PAGE = String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>headstart</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Geist+Mono:wght@400;500&display=swap">
<style>
:root{--bg:#0a0a0b;--surface:#111113;--surface-2:#1a1a1d;--fg:#fff;--muted:rgb(161,161,161);--subtle:rgb(138,138,138);--line:rgba(255,255,255,.12);--line-2:rgba(255,255,255,.06);--accent:#38bdf8;--ui:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;--mono:"Geist Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
*{box-sizing:border-box}html,body{background:var(--bg);color:var(--fg);margin:0}
body{font:14px/1.5 var(--ui);padding:0 24px 80px}
main{max-width:1240px;margin:0 auto}
header{display:flex;align-items:center;gap:14px;padding:22px 0 18px;border-bottom:1px solid var(--line)}
header img{width:22px;height:22px;opacity:.9}header h1{font:500 15px var(--ui);margin:0;letter-spacing:.01em}header .sub{color:var(--muted);font:12px var(--mono);margin-left:auto}
section{padding:28px 0 8px;border-bottom:1px solid var(--line-2)}
h2{font:500 11px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 14px}
.lanes{display:grid;grid-template-columns:1fr 1fr;gap:18px}@media(max-width:760px){.lanes{grid-template-columns:1fr}}
.lane{background:var(--surface);border:1px solid var(--line);min-height:300px;display:flex;flex-direction:column}
.lane .head{display:flex;justify-content:space-between;align-items:baseline;padding:10px 14px;border-bottom:1px solid var(--line-2);font:12px var(--mono)}
.lane .head b{font-weight:500;color:var(--fg)}.lane.hs .head b{color:var(--accent)}
.counters{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border-bottom:1px solid var(--line-2)}
.counters div{padding:10px 14px;border-right:1px solid var(--line-2)}.counters div:last-child{border-right:0}
.counters .n{font:500 22px/1.1 var(--mono);font-variant-numeric:tabular-nums}.counters .l{font:11px var(--mono);color:var(--subtle);margin-top:3px;letter-spacing:.04em;text-transform:uppercase}
.ticker{flex:1;overflow:auto;max-height:340px;padding:8px 0;font:12.5px/1.6 var(--mono)}
.t{display:grid;grid-template-columns:64px 1fr;gap:10px;padding:1px 14px;color:var(--muted);animation:in .28s ease-out}
.t .k{color:var(--subtle)}.t.write{color:var(--fg)}.t.write .k{color:var(--accent)}.t.execute .k{color:var(--muted)}
.t.prompt{color:var(--fg);padding:6px 14px;border-bottom:1px solid var(--line-2);margin-bottom:4px}.t.prompt .k{color:var(--accent)}
.t.inject{color:var(--accent)}.t.stop{color:var(--subtle);border-top:1px solid var(--line-2);margin-top:4px;padding-top:6px}
@keyframes in{from{opacity:.2;transform:translateY(3px)}to{opacity:1;transform:none}}
.delta{margin-top:14px;font:12.5px var(--mono);color:var(--muted);min-height:20px}.delta b{color:var(--accent);font-weight:500;font-size:20px;margin-right:6px}
canvas{display:block;width:100%;background:var(--surface);border:1px solid var(--line)}
.legend{display:flex;gap:18px;font:11px var(--mono);color:var(--subtle);margin-top:8px;flex-wrap:wrap}.legend i{display:inline-block;width:9px;height:9px;border-radius:50%;vertical-align:-1px;margin-right:6px;background:var(--muted)}.legend i.ring{background:none;border:1.5px solid var(--muted)}.legend i.acc{background:var(--accent)}.legend i.file{border-radius:0;width:6px;height:6px;background:var(--subtle)}
.tip{position:fixed;pointer-events:none;background:var(--surface-2);border:1px solid var(--line);padding:8px 10px;font:12px/1.5 var(--mono);color:var(--fg);max-width:360px;display:none;z-index:9}
table{border-collapse:collapse;width:100%;font:13px var(--mono);font-variant-numeric:tabular-nums}
th,td{padding:8px 10px;border-bottom:1px solid var(--line-2);text-align:right;white-space:nowrap}th:first-child,td:first-child{text-align:left;color:var(--muted);font-family:var(--ui)}
th{font-weight:500;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--subtle)}
td .sd{color:var(--subtle);font-size:11px;margin-left:6px}td .d{color:var(--accent);margin-left:8px}td .d.neg{color:var(--muted)}
.wrap{overflow-x:auto}.note{font:12px var(--mono);color:var(--subtle);margin-top:10px}
</style></head><body><main>
<header><img src="/mark.svg" alt="" onerror="this.style.display='none'"><h1>headstart</h1><span class="sub" id="sub">connecting</span></header>

<section><h2>Live</h2>
<div class="lanes">
  <div class="lane" id="lane-cold"><div class="head"><b>cold</b><span class="s">waiting</span></div><div class="counters"><div><div class="n">0</div><div class="l">tool calls</div></div><div><div class="n">0</div><div class="l">before first edit</div></div><div><div class="n">0s</div><div class="l">elapsed</div></div></div><div class="ticker"></div></div>
  <div class="lane hs" id="lane-headstart"><div class="head"><b>headstart</b><span class="s">waiting</span></div><div class="counters"><div><div class="n">0</div><div class="l">tool calls</div></div><div><div class="n">0</div><div class="l">before first edit</div></div><div><div class="n">0s</div><div class="l">elapsed</div></div></div><div class="ticker"></div></div>
</div>
<div class="delta" id="delta"></div>
</section>

<section><h2>Sessions over time</h2><canvas id="tl" height="220"></canvas>
<div class="legend"><span><i></i>cold session</span><span><i class="acc"></i>with a head start</span><span>height is tool calls, one column per task, the line joins the two means</span></div></section>

<section><h2>What it knows</h2><canvas id="g" height="560"></canvas>
<div class="legend"><span><i></i>session</span><span><i class="ring"></i>devin session</span><span><i class="file"></i>file it changed</span><span><i class="acc"></i>recalled just now</span><span>edges are compression similarity (gzip), clusters are average-linkage on the same distance</span></div></section>

<section><h2>Measured</h2><div class="wrap" id="table"></div><div class="note" id="tnote"></div></section>
</main><div class="tip" id="tip"></div>
<script>
const $=s=>document.querySelector(s);const fmt=n=>Math.round(n).toLocaleString('en-US');
const CLS={Bash:'execute',exec:'execute',shell:'execute',Read:'read',read:'read',Grep:'search',Glob:'search',LS:'search',grep:'search',glob:'search',Edit:'write',Write:'write',MultiEdit:'write',edit:'write',write:'write',apply_patch:'write'};
const cls=n=>CLS[n]||(/edit|write|patch/i.test(n)?'write':/grep|find|glob|search|ls/i.test(n)?'search':/read|view|cat/i.test(n)?'read':/exec|bash|shell/i.test(n)?'execute':'other');
const short=s=>String(s||'').replace(/^\/.*?\/work\/[^/]+\//,'').replace(/^\/private\/tmp\/[^/]+\//,'').replace(/^\/tmp\/[^/]+\//,'').slice(0,90);

// ---- live lanes
const lanes={};function lane(name){if(lanes[name])return lanes[name];const el=$('#lane-'+name)||$('#lane-headstart');const L={el,ticker:el.querySelector('.ticker'),n:el.querySelectorAll('.n'),s:el.querySelector('.s'),calls:0,disc:0,edited:false,t0:0,stopped:false,session:null};lanes[name]=L;return L;}
function row(L,k,p,c){const d=document.createElement('div');d.className='t '+c;d.innerHTML='<span class="k">'+k+'</span><span class="p"></span>';d.querySelector('.p').textContent=p;if(c==='inject'){const pr=L.ticker.querySelector('.t.prompt');const after=L.ticker.querySelectorAll('.t.inject');const ref=after.length?after[after.length-1].nextSibling:(pr?pr.nextSibling:null);L.ticker.insertBefore(d,ref);}else L.ticker.appendChild(d);L.ticker.scrollTop=L.ticker.scrollHeight;}
function tick(){for(const L of Object.values(lanes)){if(L.t0&&!L.stopped)L.n[2].textContent=Math.round((Date.now()-L.t0)/1000)+'s';}requestAnimationFrame(tick);}tick();
function elapsed(L,ts){if(L.ts0&&ts)L.n[2].textContent=Math.round((ts-L.ts0)/1000)+'s';}
function onTrace(e){const L=lane(e.lane);if(L.session&&L.session!==e.session&&e.event==='start'){L.ticker.innerHTML='';L.calls=0;L.disc=0;L.edited=false;L.stopped=false;}
 if(e.event==='start'){L.session=e.session;L.t0=Date.now();L.ts0=e.ts||Date.now();L.s.textContent='running';return;}
 elapsed(L,e.ts);
 if(e.event==='prompt'){row(L,'prompt',e.prompt||'',"prompt");return;}
 if(e.event==='stop'){L.stopped=true;L.s.textContent='done';row(L,'stop',L.calls+' tool calls, '+L.disc+' before the first edit','stop');delta();return;}
 if(e.event==='tool'){const c=cls(e.tool||'');if(c==='other')return;L.calls++;if(c==='write'&&!L.edited){L.edited=true;L.disc=L.calls-1;}if(!L.edited)L.disc=L.calls;L.n[0].textContent=L.calls;L.n[1].textContent=L.disc;row(L,c==='execute'?'run':c,short(e.target),c);}}
function onInject(e){const L=lane(e.lane);row(L,'given',(e.kind==='start'?'repo facts, ':'closest earlier task, ')+fmt(e.chars)+' chars'+(e.score?', match '+e.score.toFixed(2):''),'inject');if(e.from)pulse(e.from);}
function delta(){const a=lanes.cold,b=lanes.headstart;if(!a||!b||!a.stopped||!b.stopped)return;const d=a.calls-b.calls,dd=a.disc-b.disc;$('#delta').innerHTML='<b>'+(d>=0?'-':'+')+Math.abs(d)+'</b>tool calls with a head start, <b>'+(dd>=0?'-':'+')+Math.abs(dd)+'</b>before the first edit';}

// ---- timeline: every measured run, grouped by task. Grey is cold, accent is headstart.
const tl=$('#tl'),tc=tl.getContext('2d');let RUNS=[],tlT0=0,LIVE=[];
function drawTL(){const r=devicePixelRatio,W=tl.width=tl.clientWidth*r,H=tl.height=220*r;tc.clearRect(0,0,W,H);const p=36*r;const rows=RUNS.filter(x=>x.arm==='cold'||x.arm==='full');if(!rows.length&&!LIVE.length)return;
 const tasks=[...new Set(rows.map(x=>x.task))];if(LIVE.length)tasks.push('live');const max=Math.max(...rows.map(x=>x.calls),...LIVE.map(x=>x.calls),1);
 const gx=i=>p+(W-2*p)*(i+.5)/tasks.length,y=v=>H-p-(H-2*p)*v/max;const age=(Date.now()-tlT0)/1000;
 tc.strokeStyle='rgba(255,255,255,.06)';tc.lineWidth=r;for(const v of [0,max/2,max]){tc.beginPath();tc.moveTo(p,y(v));tc.lineTo(W-p,y(v));tc.stroke();}
 tc.fillStyle='rgb(138,138,138)';tc.font=(10*r)+'px Geist Mono, monospace';tc.fillText(String(max),6*r,y(max)+4*r);tc.fillText('0',6*r,y(0)+4*r);
 tasks.forEach((t,i)=>{const cx=gx(i);tc.fillStyle='rgb(138,138,138)';tc.textAlign='center';tc.fillText(t,cx,H-p+16*r);tc.textAlign='left';
  const cold=rows.filter(x=>x.task===t&&x.arm==='cold'),hs=t==='live'?LIVE:rows.filter(x=>x.task===t&&x.arm==='full');const mean=a=>a.reduce((s,x)=>s+x.calls,0)/Math.max(1,a.length);
  const reveal=Math.min(1,Math.max(0,(age-i*.12)*2.2));if(reveal<=0)return;tc.globalAlpha=reveal;
  cold.forEach((x,k)=>{tc.fillStyle='rgb(161,161,161)';tc.beginPath();tc.arc(cx-14*r+((k*7)%9)*r,y(x.calls),3*r,0,7);tc.fill();});
  hs.forEach((x,k)=>{tc.fillStyle='#38bdf8';tc.beginPath();tc.arc(cx+14*r+((k*7)%9)*r,y(x.calls),3*r,0,7);tc.fill();});
  if(cold.length&&hs.length){tc.strokeStyle='rgba(56,189,248,.55)';tc.lineWidth=1.2*r;tc.beginPath();tc.moveTo(cx-10*r,y(mean(cold)));tc.lineTo(cx+10*r,y(mean(hs)));tc.stroke();}
  tc.globalAlpha=1;});
 if(age<3)requestAnimationFrame(drawTL);}
tl.addEventListener('mousemove',ev=>{const rc=tl.getBoundingClientRect(),rows=RUNS.filter(x=>x.arm==='cold'||x.arm==='full'),tasks=[...new Set(rows.map(x=>x.task))];if(LIVE.length)tasks.push('live');const i=Math.floor((ev.clientX-rc.left-36)/(rc.width-72)*tasks.length);const t=tasks[i];if(!t){hide();return;}const cold=rows.filter(x=>x.task===t&&x.arm==='cold'),hs=t==='live'?LIVE:rows.filter(x=>x.task===t&&x.arm==='full');const m=a=>a.length?(a.reduce((s,x)=>s+x.calls,0)/a.length).toFixed(1):'-';tip(ev,t+'\ncold '+m(cold)+' tool calls, n='+cold.length+'\nheadstart '+m(hs)+' tool calls, n='+hs.length);});tl.addEventListener('mouseleave',hide);

// ---- graph
const g=$('#g'),gc=g.getContext('2d');let G={nodes:[],edges:[]},N=[],E=[],byId={},hover=null,pulses=[];
let loaded=false;
function setGraph(data){G=data;const old=byId;byId={};N=data.nodes.map(n=>{const o=old[n.id];const r=n.kind==='file'?2.2:3+Math.sqrt(n.calls||4)*.9;const seed=(n.cluster||0)*2.4;const m=o?Object.assign(o,{n,r}):{n,r,x:Math.cos(seed)*120+(Math.random()-.5)*40,y:Math.sin(seed)*120+(Math.random()-.5)*40,vx:0,vy:0,born:loaded?Date.now():0};byId[n.id]=m;return m;});E=data.edges.map(e=>({a:byId[e.a],b:byId[e.b],w:e.w,kind:e.kind})).filter(e=>e.a&&e.b);if(!loaded){for(let i=0;i<220;i++)step();loaded=true;revealT=Date.now();}}
let revealT=0;
function step(){const W=g.clientWidth||900,H=560;
 // centre gravity, then a pull toward each cluster's mean so shapes read as islands
 const cm={};for(const a of N){if(a.n.kind!=='session')continue;const c=a.n.cluster??-1;(cm[c]=cm[c]||{x:0,y:0,n:0});cm[c].x+=a.x;cm[c].y+=a.y;cm[c].n++;}
 for(const a of N){a.vx-=a.x*.012;a.vy-=a.y*.012;if(a.n.kind==='session'){const c=cm[a.n.cluster??-1];if(c&&c.n>1){a.vx+=(c.x/c.n-a.x)*.02;a.vy+=(c.y/c.n-a.y)*.02;}}}
 for(let i=0;i<N.length;i++)for(let j=i+1;j<N.length;j++){const a=N[i],b=N[j];let dx=a.x-b.x,dy=a.y-b.y,d2=dx*dx+dy*dy+.01;if(d2>40000)continue;const f=(a.n.kind==='file'||b.n.kind==='file'?60:220)/d2;dx*=f;dy*=f;a.vx+=dx;a.vy+=dy;b.vx-=dx;b.vy-=dy;}
 for(const e of E){const dx=e.b.x-e.a.x,dy=e.b.y-e.a.y,d=Math.sqrt(dx*dx+dy*dy)+.01,want=e.kind==='wrote'?22:30+(1-e.w)*140,f=(d-want)/d*(e.kind==='wrote'?.04:.06*e.w);e.a.vx+=dx*f;e.a.vy+=dy*f;e.b.vx-=dx*f;e.b.vy-=dy*f;}
 for(const a of N){if(a===hover)continue;a.vx*=.8;a.vy*=.8;a.x+=a.vx;a.y+=a.vy;a.x=Math.max(-W/2+14,Math.min(W/2-14,a.x));a.y=Math.max(-H/2+14,Math.min(H/2-14,a.y));}}
function draw(){const r=devicePixelRatio,W=g.width=g.clientWidth*r,H=g.height=560*r;gc.clearRect(0,0,W,H);gc.save();gc.translate(W/2,H/2);gc.scale(r,r);const rv=revealT?Math.min(1,(Date.now()-revealT)/1600):0;gc.globalAlpha=rv;
 for(const e of E){if(e.kind==='wrote'){gc.strokeStyle='rgba(255,255,255,.05)';gc.setLineDash([2,3]);}else{gc.strokeStyle='rgba(255,255,255,'+(.04+.16*e.w*e.w)+')';gc.setLineDash([]);}gc.lineWidth=1;gc.beginPath();gc.moveTo(e.a.x,e.a.y);gc.lineTo(e.b.x,e.b.y);gc.stroke();}gc.setLineDash([]);
 const now=Date.now();pulses=pulses.filter(p=>now-p.t<1600);for(const p of pulses){const m=byId[p.id];if(!m)continue;const a=1-(now-p.t)/1600;gc.strokeStyle='rgba(56,189,248,'+a+')';gc.lineWidth=1.5;gc.beginPath();gc.arc(m.x,m.y,m.r+4+(1-a)*26,0,7);gc.stroke();}
 for(const m of N){const n=m.n,age=Math.min(1,(now-(m.born||0))/900);if(n.kind==='file'){gc.fillStyle='rgba(138,138,138,'+(.7*age)+')';gc.fillRect(m.x-2,m.y-2,4,4);continue;}
  const hot=(hover===m)||(hover&&E.some(e=>e.kind==='wrote'&&((e.a===hover&&e.b===m)||(e.b===hover&&e.a===m))));const fresh=m.born>0&&now-m.born<6000;
  if(m.n.harness==='devin'){gc.strokeStyle=hot||fresh?'#38bdf8':'rgba(161,161,161,'+age+')';gc.lineWidth=1.4;gc.beginPath();gc.arc(m.x,m.y,m.r,0,7);gc.stroke();}else{gc.fillStyle=hot||fresh?'#38bdf8':'rgba(161,161,161,'+(.55+.45*age)+')';gc.beginPath();gc.arc(m.x,m.y,m.r,0,7);gc.fill();}
  if(hot)dither(m.x,m.y,m.r+3,m.r+12);}
 if(hover&&hover.n.kind==='file'){gc.fillStyle='#38bdf8';gc.fillRect(hover.x-2.5,hover.y-2.5,5,5);for(const e of E)if(e.kind==='wrote'&&(e.a===hover||e.b===hover)){const o=e.a===hover?e.b:e.a;gc.fillStyle='#38bdf8';gc.beginPath();gc.arc(o.x,o.y,o.r,0,7);gc.fill();}}
 gc.globalAlpha=1;
 // cluster labels at the mean of each cluster
 const cm={};for(const m of N){if(m.n.kind!=='session')continue;const c=m.n.cluster??-1;(cm[c]=cm[c]||{x:0,y:0,n:0,t:{}});cm[c].x+=m.x;cm[c].y+=m.y;cm[c].n++;const t=(m.n.task||'').split('-')[0];cm[c].t[t]=(cm[c].t[t]||0)+1;}
 gc.font='10px Geist Mono, monospace';gc.fillStyle='rgba(138,138,138,'+rv+')';gc.textAlign='center';for(const c of Object.values(cm)){if(c.n<3)continue;const top=Object.entries(c.t).sort((a,b)=>b[1]-a[1])[0];gc.fillText(top[0]+' x'+c.n,c.x/c.n,c.y/c.n-22);}gc.textAlign='left';
 gc.restore();}
const B=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];function dither(cx,cy,r0,r1){gc.fillStyle='#38bdf8';for(let y=-r1;y<=r1;y++)for(let x=-r1;x<=r1;x++){const d=Math.sqrt(x*x+y*y);if(d<r0||d>r1)continue;const t=1-(d-r0)/(r1-r0);if(t*16>B[(y+64)%4][(x+64)%4])gc.fillRect(cx+x,cy+y,1,1);}}
function loop(){step();draw();requestAnimationFrame(loop);}loop();
g.addEventListener('mousemove',ev=>{const rc=g.getBoundingClientRect(),x=ev.clientX-rc.left-rc.width/2,y=ev.clientY-rc.top-280;let best=null,bd=14;for(const m of N){const d=Math.hypot(m.x-x,m.y-y);if(d<bd){bd=d;best=m;}}hover=best;if(!best){hide();return;}const n=best.n;tip(ev,n.kind==='file'?n.label+'\n'+E.filter(e=>e.kind==='wrote'&&(e.a===best||e.b===best)).length+' sessions changed it':n.label+'\n'+(n.task||'')+'  '+(n.harness||'')+'\n'+n.calls+' tool calls, '+n.discovery+' before the first edit'+(n.verified?', verified':'')+'\nchanged: '+(n.files||[]).slice(0,4).join(', '));});
g.addEventListener('mouseleave',()=>{hover=null;hide();});
function pulse(id){pulses.push({id,t:Date.now()});}
function tip(ev,text){const t=$('#tip');t.textContent=text;t.style.display='block';t.style.left=(ev.clientX+14)+'px';t.style.top=(ev.clientY+14)+'px';}function hide(){$('#tip').style.display='none';}

// ---- table
const LABEL={cold:'cold',doc:'hand-written doc',autodoc:'generated doc',facts:'repo facts',full:'headstart'};
const ROWS=[['context tokens','context_tokens','tok'],['tool calls','tool_calls',''],['calls before first edit','discovery_calls',''],['seconds','duration_s',''],['cost per session','cost_usd','$']];
function table(d){if(!d||!d.summary){$('#table').innerHTML='';$('#tnote').textContent='no results directory given';return;}const s=d.summary,arms=Object.keys(s.arms),cold=s.arms.cold;const f=(v,u)=>u==='$'?'$'+v.toFixed(3):u==='tok'?fmt(v):v>=100?fmt(v):v.toFixed(1);const noCost=arms.every(a=>s.arms[a].cost_usd.mean===0);
 let h='<table><tr><th></th>'+arms.map(a=>'<th>'+(LABEL[a]||a)+' <span class="sd">n='+s.arms[a].context_tokens.n+'</span></th>').join('')+'</tr>';
 for(const [lab,k,u] of ROWS){if(k==='cost_usd'&&noCost){h+='<tr><td>'+lab+'</td>'+arms.map(()=>'<td class="sd">not reported</td>').join('')+'</tr>';continue;}h+='<tr><td>'+lab+'</td>'+arms.map(a=>{const m=s.arms[a][k];const dl=a!=='cold'&&cold?Math.round((1-m.mean/cold[k].mean)*100):null;return '<td>'+f(m.mean,u)+'<span class="sd">± '+f(m.sd,u)+'</span>'+(dl===null?'':'<span class="d'+(dl<0?' neg':'')+'">'+(dl>0?'-':'+')+Math.abs(dl)+'%</span>')+'</td>';}).join('')+'</tr>';}
 h+='<tr><td>tests pass</td>'+arms.map(a=>'<td>'+Math.round(s.pass[a]*100)+'%</td>').join('')+'</tr></table>';
 if(s.fleet&&Object.keys(s.fleet).length){h+='<div class="note" style="margin:16px 0 6px">fleet of 9,000 sessions, mean delta times 9,000, ± is a 95% interval</div><table><tr><th></th><th>context tokens saved</th><th>minutes saved</th><th>ACU saved</th><th>cost saved</th></tr>'+Object.entries(s.fleet).map(([a,x])=>'<tr><td>'+(LABEL[a]||a)+'</td><td>'+fmt(x.tokens)+'<span class="sd">± '+fmt(x.tokens_ci||0)+'</span></td><td>'+fmt(x.minutes)+'<span class="sd">± '+fmt(x.minutes_ci||0)+'</span></td><td>'+fmt(x.acu)+'</td><td>'+(noCost?'<span class="sd">not reported</span>':'$'+fmt(x.usd)+'<span class="sd">± '+fmt(x.usd_ci||0)+'</span>')+'</td></tr>').join('')+'</table>';}
 $('#table').innerHTML=h;$('#tnote').textContent=d.n+' runs, '+d.runner+' '+d.model+'. Cold is the baseline. Context tokens include cache reads; cost is the paid number.';}

// ---- wire up
fetch('/api/graph').then(r=>r.json()).then(d=>{setGraph(d);});
fetch('/api/summary').then(r=>r.json()).then(d=>{table(d);RUNS=(d&&d.runs)||[];tlT0=Date.now();drawTL();});
const es=new EventSource('/api/live');
es.addEventListener('hello',e=>{const d=JSON.parse(e.data);$('#sub').textContent=d.lanes.length+' lanes, '+d.stores.length+' stores';});
es.addEventListener('trace',e=>onTrace(JSON.parse(e.data)));
es.addEventListener('inject',e=>onInject(JSON.parse(e.data)));
es.addEventListener('stored',e=>{const d=JSON.parse(e.data);LIVE.push({calls:d.total,discovery:d.discovery});tlT0=Date.now()-2.4;drawTL();});
es.addEventListener('graph',e=>{setGraph(JSON.parse(e.data));});
window.addEventListener('resize',drawTL);
</script></body></html>`;
