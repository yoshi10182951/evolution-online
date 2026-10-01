import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: '*' }, transports: ['websocket','polling'] });
const PORT = process.env.PORT || 3000;
const WORLD = 6000;
const players = new Map();
const foods = Array.from({length: 500}, () => ({id: crypto.randomUUID(), x: Math.random()*WORLD, y: Math.random()*WORLD, r: 4+Math.random()*5}));
const hands = ['rock','scissors','paper'];
const beats = (a,b)=>(a==='rock'&&b==='scissors')||(a==='scissors'&&b==='paper')||(a==='paper'&&b==='rock');
const canEat=(a,b)=> a.hand===b.hand ? a.r>b.r*1.12 : beats(a.hand,b.hand) ? a.r>b.r*.82 : a.r>b.r*1.48;
const speedFromSize=r=>{const t=Math.max(0,Math.min(1,(r-10)/130));return 350-235*Math.pow(t,.7)};
const respawn = (p) => Object.assign(p,{x:100+Math.random()*(WORLD-200),y:100+Math.random()*(WORLD-200),r:18,score:0,alive:true,cd:0,burstUntil:0,guardUntil:0});

app.use(express.static(path.join(__dirname,'public')));
app.get('/health',(req,res)=>res.json({ok:true,players:players.size}));

io.on('connection', socket => {
  const p={id:socket.id,name:'Player',x:WORLD/2,y:WORLD/2,r:18,score:0,hand:'rock',alive:true,cd:0,burstUntil:0,guardUntil:0,targetX:WORLD/2,targetY:WORLD/2};
  respawn(p); players.set(socket.id,p);
  socket.emit('welcome',{id:socket.id,world:WORLD,foods});
  socket.on('join', name => { p.name=String(name||'Player').slice(0,16); });
  socket.on('input', data => {
    if(!p.alive) return;
    if(Number.isFinite(data?.x)) p.targetX=Math.max(0,Math.min(WORLD,data.x));
    if(Number.isFinite(data?.y)) p.targetY=Math.max(0,Math.min(WORLD,data.y));
    if(hands.includes(data?.hand)) p.hand=data.hand;
  });
  socket.on('ability', ()=>{
    const now=Date.now(); if(!p.alive || now<p.cd) return; p.cd=now+4000;
    if(p.hand==='rock') p.burstUntil=now+600;
    if(p.hand==='paper') p.guardUntil=now+1200;
    if(p.hand==='scissors'){
      for(const o of players.values()) if(o.id!==p.id && o.alive){const dx=o.x-p.x,dy=o.y-p.y;if(dx*dx+dy*dy<(p.r+80)**2){o.r=Math.max(9,o.r*.88);p.score+=20}}
    }
  });
  socket.on('respawn',()=>respawn(p));
  socket.on('disconnect',()=>players.delete(socket.id));
});

let last=Date.now();
setInterval(()=>{
  const now=Date.now(), dt=Math.min(.05,(now-last)/1000); last=now;
  const arr=[...players.values()];
  for(const p of arr){
    if(!p.alive) continue;
    const dx=p.targetX-p.x,dy=p.targetY-p.y,d=Math.hypot(dx,dy)||1;
    let sp=speedFromSize(p.r)*(p.hand==='rock'?.82:p.hand==='scissors'?1.18:1); if(now<p.burstUntil) sp*=1.75;
    const step=Math.min(d,sp*dt); if(d>2){p.x+=dx/d*step;p.y+=dy/d*step}
    p.x=Math.max(p.r,Math.min(WORLD-p.r,p.x));p.y=Math.max(p.r,Math.min(WORLD-p.r,p.y));
    for(let i=foods.length-1;i>=0;i--){const f=foods[i],fx=f.x-p.x,fy=f.y-p.y;if(fx*fx+fy*fy<(p.r+f.r)**2){p.r=Math.min(145,p.r+.15);p.score+=Math.round(f.r*2);foods.splice(i,1);foods.push({id:crypto.randomUUID(),x:Math.random()*WORLD,y:Math.random()*WORLD,r:4+Math.random()*5});break}}
  }
  for(let i=0;i<arr.length;i++) for(let j=i+1;j<arr.length;j++){
    const a=arr[i],b=arr[j]; if(!a.alive||!b.alive) continue; const dx=a.x-b.x,dy=a.y-b.y;if(dx*dx+dy*dy>=(a.r+b.r)**2)continue;
    const aw=canEat(a,b),bw=canEat(b,a);
    if(aw&&!bw){if(now<b.guardUntil){b.guardUntil=0;continue} a.r=Math.min(150,a.r+b.r*.045);a.score+=Math.round(b.r*14);b.alive=false;}
    else if(bw&&!aw){if(now<a.guardUntil){a.guardUntil=0;continue} b.r=Math.min(150,b.r+a.r*.045);b.score+=Math.round(a.r*14);a.alive=false;}
  }
  io.emit('state',{t:now,players:arr.map(({targetX,targetY,...rest})=>rest),foods});
},50);

server.listen(PORT,'0.0.0.0',()=>console.log(`Listening on ${PORT}`));
