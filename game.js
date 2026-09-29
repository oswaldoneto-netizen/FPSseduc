const socket=io();
let mode="mobile",started=false,me=null,level=1,hp=100;
let scene,camera,renderer,clock,weapon,flashLight;
const remote=new Map(),keys={};
let yaw=0,pitch=0,velocityY=0,onGround=true;
let audioCtx=null,joyTouchId=null,lookTouchId=null;
const mobileMove={x:0,y:0};

const $=id=>document.getElementById(id);
$("pcBtn").onclick=()=>{mode="pc";$("pcBtn").classList.add("selected");$("mobileBtn").classList.remove("selected")};
$("mobileBtn").onclick=()=>{mode="mobile";$("mobileBtn").classList.add("selected");$("pcBtn").classList.remove("selected")};

$("play").onclick=()=>{
  if(started)return;
  started=true;$("menu").classList.add("hidden");$("hud").classList.remove("hidden");
  if(mode==="mobile"){
    $("mobile").classList.remove("hidden");
    $("controlsHelp").textContent="ANALÓGICO • ARRASTE A TELA • 🔫 ATIRAR • ⬆ PULAR";
  }else{
    $("controlsHelp").textContent="WASD • MOUSE • CLIQUE • ESPAÇO";
    document.body.requestPointerLock?.();
  }
  init();
  socket.emit("join",{name:$("name").value});
};

function beep(freq=440,dur=.06){
  try{
    audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();
    const o=audioCtx.createOscillator(),g=audioCtx.createGain();
    o.type="square";o.frequency.value=freq;g.gain.setValueAtTime(.045,audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+dur);
    o.connect(g).connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+dur);
  }catch(e){}
}

function mat(c,rough=.8){return new THREE.MeshStandardMaterial({color:c,roughness:rough})}

function init(){
  scene=new THREE.Scene();
  scene.background=new THREE.Color(0x87b6dd);
  scene.fog=new THREE.Fog(0x87b6dd,45,190);
  camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.05,350);
  renderer=new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
  renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  clock=new THREE.Clock();
  scene.add(new THREE.HemisphereLight(0xbfe3ff,0x29313a,2.2));
  const sun=new THREE.DirectionalLight(0xffffff,3);
  sun.position.set(35,80,25);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);

  buildMap();
  buildWeapon();
  requestAnimationFrame(loop);
}

function buildMap(){
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(180,180),mat(0x4b5962));
  ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);

  // Roads
  for(let x=-80;x<=80;x+=20){
    const road=new THREE.Mesh(new THREE.BoxGeometry(7,.04,180),mat(0x252d34));
    road.position.set(x,.02,0);scene.add(road);
  }
  for(let z=-80;z<=80;z+=20){
    const road=new THREE.Mesh(new THREE.BoxGeometry(180,.045,7),mat(0x252d34));
    road.position.set(0,.025,z);scene.add(road);
  }

  // Buildings and crates
  for(let i=0;i<42;i++){
    const x=(Math.floor(Math.random()*17)-8)*10+((Math.random()-.5)*2);
    const z=(Math.floor(Math.random()*17)-8)*10+((Math.random()-.5)*2);
    if(Math.abs(x)<14&&Math.abs(z)<14)continue;
    const w=5+Math.random()*6,d=5+Math.random()*6,h=2.5+Math.random()*7;
    const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(0x59636d));
    b.position.set(x,h/2,z);b.castShadow=true;b.receiveShadow=true;scene.add(b);
    const roof=new THREE.Mesh(new THREE.BoxGeometry(w+.12,.18,d+.12),mat(0x303942));
    roof.position.set(x,h+.08,z);roof.castShadow=true;scene.add(roof);
    if(h>5){
      const winMat=mat(0x77b9d8,.35);
      for(let side=-1;side<=1;side+=2){
        const win=new THREE.Mesh(new THREE.BoxGeometry(.06,1.1,1.4),winMat);
        win.position.set(x+side*(w/2+.04),h*.58,z);scene.add(win);
      }
    }
  }
  for(let i=0;i<30;i++){
    const c=new THREE.Mesh(new THREE.BoxGeometry(1.7,1.7,1.7),mat(0x8b684b));
    c.position.set((Math.random()-.5)*150,.85,(Math.random()-.5)*150);
    c.castShadow=true;scene.add(c);
  }
  // Boundary walls
  [[0,2,-90,180,4,1],[0,2,90,180,4,1],[-90,2,0,1,4,180],[90,2,0,1,4,180]].forEach(a=>{
    const w=new THREE.Mesh(new THREE.BoxGeometry(a[3],a[4],a[5]),mat(0x202832));w.position.set(a[0],a[1],a[2]);scene.add(w);
  });
}

function buildWeapon(){
  weapon=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(.28,.22,.9),mat(0x1d2329));body.position.set(.28,-.22,-.65);weapon.add(body);
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.65,12),mat(0x0d1115));barrel.rotation.x=Math.PI/2;barrel.position.set(.28,-.17,-1.15);weapon.add(barrel);
  const grip=new THREE.Mesh(new THREE.BoxGeometry(.16,.38,.18),mat(0x343b42));grip.rotation.x=-.25;grip.position.set(.28,-.43,-.52);weapon.add(grip);
  const mag=new THREE.Mesh(new THREE.BoxGeometry(.14,.28,.2),mat(0x252b31));mag.rotation.x=-.2;mag.position.set(.28,-.4,-.73);weapon.add(mag);
  const sight=new THREE.Mesh(new THREE.BoxGeometry(.08,.08,.18),mat(0x11161a));sight.position.set(.28,-.07,-.65);weapon.add(sight);
  camera.add(weapon);scene.add(camera);
}

function makePlayer(){
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.43,.85,5,10),mat(0x1677e8));body.position.y=1;body.castShadow=true;g.add(body);
  const vest=new THREE.Mesh(new THREE.BoxGeometry(.55,.62,.32),mat(0x16202b));vest.position.set(0,1.02,.18);vest.castShadow=true;g.add(vest);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.31,16,10),mat(0xe4ad88));head.position.y=1.86;head.castShadow=true;g.add(head);
  const helmet=new THREE.Mesh(new THREE.SphereGeometry(.34,16,8,0,Math.PI*2,0,Math.PI*.55),mat(0x202b38));helmet.position.y=2.02;g.add(helmet);
  const gun=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,.55),mat(0x14181c));gun.position.set(.38,1.05,-.38);gun.rotation.x=-.05;g.add(gun);
  return g;
}

function shoot(){
  if(!started||!me)return;
  beep(120,.08);
  weapon.position.z=.08;setTimeout(()=>weapon&&(weapon.position.z=0),45);
  const dir=new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(pitch,yaw,0,"YXZ"));
  const origin=camera.position.clone();
  socket.emit("shoot",{origin:{x:origin.x,y:origin.y,z:origin.z},dir:{x:dir.x,y:dir.y,z:dir.z}});
  const ray=new THREE.Raycaster(origin,dir,0,120);
  const candidates=[];
  remote.forEach((obj,id)=>{const box=new THREE.Box3().setFromObject(obj);if(ray.ray.intersectsBox(box))candidates.push({id,dist:origin.distanceTo(obj.position)})});
  candidates.sort((a,b)=>a.dist-b.dist);
  if(candidates[0])socket.emit("hit",{victim:candidates[0].id});
}

function loop(){
  requestAnimationFrame(loop);
  if(!started||!renderer)return;
  const dt=Math.min(clock.getDelta(),.05);
  let forward=(keys.KeyW?1:0)-(keys.KeyS?1:0);
  let strafe=(keys.KeyD?1:0)-(keys.KeyA?1:0);
  if(mode==="mobile"){
    strafe += mobileMove.x;
    forward += -mobileMove.y;
  }
  const move=new THREE.Vector3(strafe,0,-forward);
  if(move.length()>1)move.normalize();
  move.applyAxisAngle(new THREE.Vector3(0,1,0),yaw);
  if(me){
    const speed=mode==="mobile"?8.5:10;
    me.x+=move.x*speed*dt;me.z+=move.z*speed*dt;
    me.x=Math.max(-84,Math.min(84,me.x));me.z=Math.max(-84,Math.min(84,me.z));
    velocityY-=24*dt;me.y+=velocityY*dt;
    if(me.y<1.5){me.y=1.5;velocityY=0;onGround=true}
    camera.position.set(me.x,me.y+.75,me.z);
    camera.rotation.set(pitch,yaw,0,"YXZ");
    socket.emit("state",{x:me.x,y:me.y,z:me.z,ry:yaw});
  }
  renderer.render(scene,camera);
}

addEventListener("keydown",e=>{keys[e.code]=true;if(e.code==="Space"&&onGround){velocityY=9;onGround=false}});
addEventListener("keyup",e=>keys[e.code]=false);
addEventListener("mousedown",e=>{if(started&&mode==="pc"&&e.button===0)shoot()});
addEventListener("mousemove",e=>{
  if(started&&mode==="pc"&&document.pointerLockElement===document.body){
    yaw-=e.movementX*.002;pitch-=e.movementY*.002;pitch=Math.max(-1.4,Math.min(1.4,pitch));
  }
});

$("fire").onclick=shoot;
$("jump").onclick=()=>{if(onGround){velocityY=9;onGround=false}};

const joy=$("joy"),knob=$("knob");
function setJoy(clientX,clientY){
  const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
  let dx=clientX-cx,dy=clientY-cy,dist=Math.hypot(dx,dy),max=43;
  if(dist>max){dx=dx/dist*max;dy=dy/dist*max}
  knob.style.transform=`translate(${dx}px,${dy}px)`;
  mobileMove.x=dx/max;
  mobileMove.y=dy/max;
}
function resetJoy(){knob.style.transform="translate(0,0)";mobileMove.x=0;mobileMove.y=0}
joy.addEventListener("touchstart",e=>{e.preventDefault();joyTouchId=e.changedTouches[0].identifier;const t=e.changedTouches[0];setJoy(t.clientX,t.clientY)},{passive:false});
joy.addEventListener("touchmove",e=>{e.preventDefault();for(const t of e.changedTouches)if(t.identifier===joyTouchId)setJoy(t.clientX,t.clientY)},{passive:false});
joy.addEventListener("touchend",e=>{for(const t of e.changedTouches)if(t.identifier===joyTouchId){joyTouchId=null;resetJoy()}},{passive:false});
joy.addEventListener("touchcancel",resetJoy);

let lastLook=null;
$("look").addEventListener("touchstart",e=>{
  if(e.target===joy||e.target===knob)return;
  const t=e.changedTouches[0];lookTouchId=t.identifier;lastLook={x:t.clientX,y:t.clientY};
},{passive:false});
$("look").addEventListener("touchmove",e=>{
  if(lookTouchId===null)return;
  e.preventDefault();
  for(const t of e.changedTouches)if(t.identifier===lookTouchId){
    const dx=t.clientX-lastLook.x,dy=t.clientY-lastLook.y;
    yaw-=dx*.006;pitch-=dy*.006;pitch=Math.max(-1.4,Math.min(1.4,pitch));lastLook={x:t.clientX,y:t.clientY};
  }
},{passive:false});
$("look").addEventListener("touchend",e=>{for(const t of e.changedTouches)if(t.identifier===lookTouchId){lookTouchId=null;lastLook=null}},{passive:false});

socket.on("joined",d=>{me=d.player;level=me.level; $("level").textContent=level});
socket.on("players",list=>{
  $("online").textContent=list.length;
  const ids=new Set(list.map(p=>p.id));
  list.forEach(p=>{
    if(p.id===socket.id){
      if(me){me.level=p.level;level=p.level;$("level").textContent=level;hp=p.hp||100;$("hp").textContent=hp}
      return;
    }
    if(!remote.has(p.id)){const o=makePlayer();scene.add(o);remote.set(p.id,o)}
    const o=remote.get(p.id);
    o.position.set(p.x,p.y-1.5,p.z);o.rotation.y=p.ry;
  });
  remote.forEach((o,id)=>{if(!ids.has(id)){scene.remove(o);remote.delete(id)}});
});
socket.on("playerState",p=>{const o=remote.get(p.id);if(o){o.position.set(p.x,p.y-1.5,p.z);o.rotation.y=p.ry}});
socket.on("damage",d=>{hp=d.hp;$("hp").textContent=hp;beep(70,.1)});
socket.on("respawn",p=>{if(me){me.x=p.x;me.y=p.y;me.z=p.z}hp=100;$("hp").textContent=100});
socket.on("shot",()=>beep(180,.035));
socket.on("kill",d=>{$("feed").textContent=`${d.killer} eliminou ${d.victim}`;setTimeout(()=>{$("feed").textContent=""},2000)});
socket.on("leaderboard",list=>{
  $("leaders").innerHTML="";
  list.forEach(p=>{const li=document.createElement("li");li.innerHTML=`${p.name}<b>${p.level}</b>`;$("leaders").appendChild(li)});
});
addEventListener("resize",()=>{if(camera&&renderer){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)}});
