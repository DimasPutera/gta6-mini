// game/systems.js - city systems: traffic, peds, police, missions, wanted.
const ROADS=[128,384,640,896,1152],SIZE=1280,HALF=48;
const S=globalThis.S=globalThis.S||{};
const R=(a,b)=>a+Math.random()*(b-a),RI=n=>Math.floor(Math.random()*n);
const CL=(v,a,b)=>Math.max(a,Math.min(b,v)),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const NR=v=>ROADS.reduce((p,c)=>Math.abs(c-v)<Math.abs(p-v)?c:p);
const player=()=>globalThis.G?.api?.state?.player||null;
const onRoad=v=>ROADS.some(c=>Math.abs(c-v)<HALF);
function mkCar(police){const h=RI(2),r=ROADS[RI(5)];
  return{x:h?r:R(0,SIZE),y:h?R(0,SIZE):r,dx:h?0:(Math.random()<.5?1:-1),
  dy:h?(Math.random()<.5?1:-1):0,speed:police?150:R(70,110),police:!!police};}
function mkPed(){const r=ROADS[RI(5)],s=r+(Math.random()<.5?-1:1)*(HALF+12),h=RI(2);
  return{x:h?s:R(80,SIZE-80),y:h?R(80,SIZE-80):s,
  dx:h?0:(Math.random()<.5?1:-1),dy:h?(Math.random()<.5?1:-1):0,speed:R(18,30)};}
function mkMission(i){const p=()=>({x:ROADS[RI(5)],y:ROADS[RI(5)]});
  return{id:i,pickup:p(),drop:p(),reward:150,stage:"pickup",done:false};}
S.traffic=Array.from({length:8},()=>mkCar(false));
S.peds=Array.from({length:10},mkPed);
S.police=[mkCar(true)];
S.missions=Array.from({length:5},(_,i)=>mkMission(i));
S.wanted=0;S._safe=0;S._hitCd=0;
function ahead(c,list){let m=1e9;
  for(const o of list){if(o===c)continue;
    if(c.dx&&o.y===c.y&&Math.sign(o.x-c.x)===c.dx)m=Math.min(m,Math.abs(o.x-c.x));
    if(c.dy&&o.x===c.x&&Math.sign(o.y-c.y)===c.dy)m=Math.min(m,Math.abs(o.y-c.y));}
  return m;}
function turnAt(c){if(!onRoad(c.x)||!onRoad(c.y)||Math.random()>=.35)return;
  const h=RI(2);c.dx=h?0:(Math.random()<.5?1:-1);c.dy=h?(Math.random()<.5?1:-1):0;
  c.x=NR(c.x);c.y=NR(c.y);}
function moveCar(c,dt,list){if(ahead(c,list)<52)return;
  c.x+=c.dx*c.speed*dt;c.y+=c.dy*c.speed*dt;
  if(c.x<0){c.x=0;c.dx=1;}if(c.x>SIZE){c.x=SIZE;c.dx=-1;}
  if(c.y<0){c.y=0;c.dy=1;}if(c.y>SIZE){c.y=SIZE;c.dy=-1;}turnAt(c);}
function movePed(p,dt){p.x+=p.dx*p.speed*dt;p.y+=p.dy*p.speed*dt;
  if(p.x<40){p.x=40;p.dx=1;}if(p.x>SIZE-40){p.x=SIZE-40;p.dx=-1;}
  if(p.y<40){p.y=40;p.dy=1;}if(p.y>SIZE-40){p.y=SIZE-40;p.dy=-1;}}
function chase(c,dt){const p=player();if(!p)return moveCar(c,dt,S.police);
  const dx=p.x-c.x,dy=p.y-c.y;
  if(Math.abs(dx)>Math.abs(dy)){c.dx=Math.sign(dx);c.dy=0;}
  else{c.dy=Math.sign(dy);c.dx=0;}
  c.speed=170;c.x+=c.dx*c.speed*dt;c.y+=c.dy*c.speed*dt;
  c.x=CL(c.x,0,SIZE);c.y=CL(c.y,0,SIZE);}
function checkMissions(){const p=player();if(!p)return;
  for(const m of S.missions){if(m.done)continue;
    if(m.stage==="pickup"&&dist(p,m.pickup)<36)m.stage="drop";
    else if(m.stage==="drop"&&dist(p,m.drop)<36){m.stage="done";m.done=true;
      p.money=(p.money||0)+m.reward;}}}
function checkHits(dt){const p=player();if(!p)return;
  S._hitCd=Math.max(0,S._hitCd-dt);
  for(let i=0;i<S.peds.length;i++){if(dist(p,S.peds[i])<22&&S._hitCd===0){
    S.wanted=CL(S.wanted+1,0,5);S._safe=0;S._hitCd=1;S.peds[i]=mkPed();}}}
function update(dt){dt=CL(dt||0,0,.05);
  for(const c of S.traffic)moveCar(c,dt,S.traffic);
  for(const p of S.peds)movePed(p,dt);
  if(S.wanted>0)for(const c of S.police)chase(c,dt);
  else for(const c of S.police)moveCar(c,dt,S.police);
  checkMissions();checkHits(dt);
  S._safe+=dt;if(S._safe>8&&S.wanted>0){S.wanted--;S._safe=0;}}
S.api={traffic:S.traffic,peds:S.peds,police:S.police,missions:S.missions,
  get wanted(){return S.wanted},set wanted(v){S.wanted=CL(v,0,5);S._safe=0;},
  stealCar(){S.wanted=CL(S.wanted+1,0,5);S._safe=0;
    const p=player();if(!p)return false;
    const i=S.traffic.findIndex(c=>dist(p,c)<40);
    if(i<0)return false;S.traffic.splice(i,1);S.traffic.push(mkCar(false));return true;},
  update};