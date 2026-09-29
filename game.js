const socket=io();
let mode="pc", started=false, me=null, level=1, hp=100;
let scene,camera,renderer,clock,gun;
const remote=new Map(), keys={};
let yaw=0,pitch=0,velocityY=0,onGround=true;
let audioCtx=null;

const menu=document.getElementById("menu"), hud=document.getElementById("hud");
const mobile=document.getElementById("mobile"), levelEl=document.getElementById("level");
document.getElementById("pcBtn").onclick=()=>{mode="pc";document.getElementById("pcBtn").classList.add("selected");document.getElementById("mobileBtn").classList.remove("selected")};
document.getElementById("mobileBtn").onclick=()=>{mode="mobile";document.getElementById("mobileBtn").classList.add("selected");document.getElementById("pcBtn").classList.remove("selected")};
document.getElementById("play").onclick=()=>{
  started=true; menu.classList.add("hidden"); hud.classList.remove("hidden");
  if(mode==="mobile"){mobile.classList.remove("hidden"); document.getElementById("controlsHelp").textContent="Arraste o analógico • arraste a tela para mirar • 🔫 atirar • ⬆ pular"}
  else document.body.requestPointerLock?.();
  init(); socket.emit("join",{name:document.getElementById("name").value});
};

function beep(freq=440,dur=.06){
  try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();
    const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=freq;
    g.gain.setValueAtTime(.06,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+dur);
    o.connect(g).connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+dur);
  }catch(e){}
}

function init(){
 scene=new THREE.Scene(); scene.background=new THREE.Color(0x8ab0d0);
 scene.fog=new THREE.Fog(0x8ab0d0,50,180);
 camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.1,300);
 renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;document.body.prepend(renderer.domElement);
 clock=new THREE.Clock();
 scene.add(new THREE.HemisphereLight(0xffffff,0x445566,2));
 const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(30,80,20);sun.castShadow=true;scene.add(sun);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.MeshStandardMaterial({color:0x39434b}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
 for(let i=0;i<35;i++){let x=(Math.random()-.5)*150,z=(Math.random()-.5)*150,w=4+Math.random()*8,h=2+Math.random()*7;
   if(Math.abs(x)<10&&Math.abs(z)<10)continue;
   const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,w),new THREE.MeshStandardMaterial({color:0x606b75}));
   b.position.set(x,h/2,z);b.castShadow=true;b.receiveShadow=true;scene.add(b);
 }
 for(let i=-80;i<=80;i+=10){let m=new THREE.Mesh(new THREE.BoxGeometry(1,.15,180),new THREE.MeshStandardMaterial({color:0x273038}));m.position.x=i;scene.add(m)}
 requestAnimationFrame(loop);
}

function makePlayer(color=0x38bdf8){
 const g=new THREE.Group();
 const body=new THREE.Mesh(new THREE.CapsuleGeometry(.45,.8,4,8),new THREE.MeshStandardMaterial({color}));body.position.y=1;body.castShadow=true;g.add(body);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.32,12,8),new THREE.MeshStandardMaterial({color:0xf1c7a8}));head.position.y=1.85;head.castShadow=true;g.add(head);
 return g;
}
function shoot(){
 if(!started)return; beep(150,.07);
 const dir=new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(pitch,yaw,0,"YXZ"));
 const origin=camera.position.clone();
 socket.emit("shoot",{origin,dir});
 const ray=new THREE.Raycaster(origin,dir,0,100);
 const hits=[];
 remote.forEach((obj,id)=>{const box=new THREE.Box3().setFromObject(obj);const hit=ray.ray.intersectsBox(box);if(hit)hits.push(id)});
 if(hits[0])socket.emit("hit",{victim:hits[0]});
}
function loop(){
 requestAnimationFrame(loop); if(!started)return;
 const dt=Math.min(clock.getDelta(),.05);
 let f=(keys.KeyW?1:0)-(keys.KeyS?1:0), s=(keys.KeyD?1:0)-(keys.KeyA?1:0);
 const dir=new THREE.Vector3(s,0,-f); if(dir.length())dir.normalize().applyAxisAngle(new THREE.Vector3(0,1,0),yaw);
 if(me){me.x+=dir.x*10*dt;me.z+=dir.z*10*dt;
   velocityY-=24*dt;me.y+=velocityY*dt;if(me.y<1.5){me.y=1.5;velocityY=0;onGround=true}
   camera.position.set(me.x,me.y+0.8,me.z);camera.rotation.set(pitch,yaw,0,"YXZ");
   socket.emit("state",{x:me.x,y:me.y,z:me.z,ry:yaw});
 }
 renderer.render(scene,camera);
}
addEventListener("keydown",e=>{keys[e.code]=true;if(e.code==="Space"&&onGround){velocityY=9;onGround=false}});
addEventListener("keyup",e=>keys[e.code]=false);
addEventListener("mousedown",e=>{if(started&&mode==="pc"&&e.button===0)shoot()});
addEventListener("mousemove",e=>{if(started&&mode==="pc"&&document.pointerLockElement===document.body){yaw-=e.movementX*.002;pitch-=e.movementY*.002;pitch=Math.max(-1.45,Math.min(1.45,pitch))}});
document.getElementById("fire").onclick=shoot;
document.getElementById("jump").onclick=()=>{if(onGround){velocityY=9;onGround=false}};

let touchLook=null,joyTouch=null;
document.getElementById("look").addEventListener("touchmove",e=>{
 const t=e.touches[0]; if(!touchLook)touchLook={x:t.clientX,y:t.clientY};
 yaw-=(t.clientX-touchLook.x)*.006;pitch-=(t.clientY-touchLook.y)*.006;
 pitch=Math.max(-1.45,Math.min(1.45,pitch));touchLook={x:t.clientX,y:t.clientY};
});
document.getElementById("look").addEventListener("touchend",()=>touchLook=null);
document.getElementById("joy").addEventListener("touchmove",e=>{
 const r=document.getElementById("joy").getBoundingClientRect(),t=e.touches[0];
 let x=t.clientX-(r.left+r.width/2),y=t.clientY-(r.top+r.height/2),d=Math.min(45,Math.hypot(x,y)),a=Math.atan2(y,x);
 keys.KeyA=keys.KeyD=keys.KeyW=keys.KeyS=false;
 if(d>8){keys.KeyD=Math.cos(a)<-.25;keys.KeyA=Math.cos(a)>.25;keys.KeyS=Math.sin(a)<-.25;keys.KeyW=Math.sin(a)>.25}
});
document.getElementById("joy").addEventListener("touchend",()=>{keys.KeyA=keys.KeyD=keys.KeyW=keys.KeyS=false});

socket.on("joined",data=>{me=data.player;level=me.level;levelEl.textContent=level});
socket.on("players",list=>{
 list.forEach(p=>{
   if(p.id===socket.id){if(me){me.level=p.level;level=p.level;levelEl.textContent=level;hp=p.hp||100;document.getElementById("hp").textContent=hp}return}
   if(!remote.has(p.id)){const o=makePlayer();scene.add(o);remote.set(p.id,o)}
   const o=remote.get(p.id);o.position.set(p.x,p.y-1.5,p.z);o.rotation.y=p.ry;
 });
 const ids=new Set(list.map(p=>p.id));remote.forEach((o,id)=>{if(!ids.has(id)){scene.remove(o);remote.delete(id)}});
 document.getElementById("online").textContent=list.length;
});
socket.on("playerState",p=>{const o=remote.get(p.id);if(o)o.position.set(p.x,p.y-1.5,p.z),o.rotation.y=p.ry});
socket.on("damage",d=>{hp=d.hp;document.getElementById("hp").textContent=hp;beep(80,.1)});
socket.on("respawn",p=>{if(me){me.x=p.x;me.y=p.y;me.z=p.z}hp=100;document.getElementById("hp").textContent=100});
socket.on("shot",()=>beep(220,.035));
socket.on("kill",d=>{document.getElementById("feed").textContent=`${d.killer} eliminou ${d.victim}`;setTimeout(()=>document.getElementById("feed").textContent="",2000)});
socket.on("leaderboard",list=>{
 const ol=document.getElementById("leaders");ol.innerHTML="";
 list.forEach(p=>{const li=document.createElement("li");li.innerHTML=`${p.name}<b>${p.level}</b>`;ol.appendChild(li)});
});
addEventListener("resize",()=>{if(camera){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)}});
