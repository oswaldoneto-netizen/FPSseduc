const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(__dirname));

const players = new Map();
const levels = new Map();

const spawnPoints = [
  [-35,1.5,-35],[0,1.5,-35],[35,1.5,-35],
  [-35,1.5,0],[35,1.5,0],
  [-35,1.5,35],[0,1.5,35],[35,1.5,35]
];

function randomSpawn(){
  const p = spawnPoints[Math.floor(Math.random()*spawnPoints.length)];
  return {x:p[0],y:p[1],z:p[2]};
}

function safeName(n){
  n = String(n || "Player").replace(/[^\wÀ-ÿ -]/g,"").trim().slice(0,18);
  return n || "Player";
}

function publicPlayers(){
  return [...players.values()].map(p => ({
    id:p.id,name:p.name,x:p.x,y:p.y,z:p.z,ry:p.ry,hp:p.hp,level:p.level
  }));
}

function leaderboard(){
  return [...levels.entries()]
    .map(([name,level])=>({name,level}))
    .sort((a,b)=>b.level-a.level || a.name.localeCompare(b.name))
    .slice(0,10);
}

io.on("connection", socket=>{
  socket.on("join", data=>{
    const name = safeName(data?.name);
    const saved = levels.get(name) || 1;
    const s = randomSpawn();
    const p = {id:socket.id,name,x:s.x,y:s.y,z:s.z,ry:0,hp:100,level:saved};
    players.set(socket.id,p);
    levels.set(name,saved);
    socket.emit("joined",{id:socket.id,player:p});
    io.emit("players",publicPlayers());
    io.emit("leaderboard",leaderboard());
    io.emit("online",players.size);
  });

  socket.on("state", d=>{
    const p=players.get(socket.id);
    if(!p) return;
    p.x=Number(d.x)||0; p.y=Number(d.y)||1.5; p.z=Number(d.z)||0;
    p.ry=Number(d.ry)||0;
    io.emit("playerState",{id:socket.id,x:p.x,y:p.y,z:p.z,ry:p.ry});
  });

  socket.on("shoot", d=>{
    if(!players.has(socket.id)) return;
    socket.broadcast.emit("shot",{id:socket.id,origin:d.origin,dir:d.dir});
  });

  socket.on("hit", d=>{
    const victim=players.get(d.victim);
    const attacker=players.get(socket.id);
    if(!victim || !attacker || d.victim===socket.id) return;
    victim.hp=Math.max(0,victim.hp-25);
    io.to(victim.id).emit("damage",{hp:victim.hp});
    if(victim.hp<=0){
      attacker.level += 1;
      levels.set(attacker.name,attacker.level);
      const s=randomSpawn();
      victim.hp=100; victim.x=s.x; victim.y=s.y; victim.z=s.z;
      io.to(victim.id).emit("respawn",{x:s.x,y:s.y,z:s.z});
      io.emit("kill",{killer:attacker.name,victim:victim.name});
      io.emit("leaderboard",leaderboard());
    }
    io.emit("players",publicPlayers());
  });

  socket.on("saveLevel", level=>{
    const p=players.get(socket.id);
    if(!p) return;
    p.level=Math.max(1,Math.floor(Number(level)||1));
    levels.set(p.name,p.level);
  });

  socket.on("disconnect",()=>{
    const p=players.get(socket.id);
    if(p) levels.set(p.name,p.level);
    players.delete(socket.id);
    io.emit("players",publicPlayers());
    io.emit("online",players.size);
    io.emit("leaderboard",leaderboard());
  });
});

setInterval(()=>{
  io.emit("leaderboard",leaderboard());
  io.emit("online",players.size);
},5000);

const PORT=process.env.PORT || 3000;
server.listen(PORT,()=>console.log(`FPS 3D online on ${PORT}`));
