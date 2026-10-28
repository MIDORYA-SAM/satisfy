const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PLAYERS = {};
const MOBS = [
  { id: 'mob_1', x: 12, z: 12, hp: 50, maxHp: 50, alive: true, type: 'Lobo Cinzento' },
  { id: 'mob_2', x: -15, z: 20, hp: 50, maxHp: 50, alive: true, type: 'Goblin Saqueador' }
];

io.on('connection', (socket) => {
  console.log(`Jogador conectado: ${socket.id}`);

  PLAYERS[socket.id] = {
    id: socket.id,
    name: 'Aventureiro',
    x: 0,
    y: 0,
    z: 0,
    hp: 100,
    maxHp: 100,
    level: 5,
    exp: 0,
    classes: ['Guerreiro'],
    unlockedNecromancer: false,
    inventory: [
      { id: 'item_1', name: 'Poção de Vida', type: 'consumable', count: 3 },
      { id: 'item_2', name: 'Espada de Ferrugem', type: 'weapon', count: 1 }
    ]
  };

  socket.emit('init', { id: socket.id, players: PLAYERS, mobs: MOBS });
  socket.broadcast.emit('playerJoined', PLAYERS[socket.id]);

  socket.on('playerMove', (data) => {
    if (PLAYERS[socket.id]) {
      PLAYERS[socket.id].x = data.x;
      PLAYERS[socket.id].y = data.y;
      PLAYERS[socket.id].z = data.z;
      socket.broadcast.emit('playerMoved', { id: socket.id, x: data.x, y: data.y, z: data.z });
    }
  });

  socket.on('attackMob', (mobId) => {
    const mob = MOBS.find(m => m.id === mobId);
    if (mob && mob.alive) {
      mob.hp -= 25;
      if (mob.hp <= 0) {
        mob.alive = false;
        setTimeout(() => {
          mob.hp = mob.maxHp;
          mob.alive = true;
          io.emit('mobRespawn', mob);
        }, 10000);
      }
      io.emit('mobDamaged', { mobId: mob.id, hp: mob.hp, alive: mob.alive });
    }
  });

  socket.on('unlockClass', (className) => {
    const player = PLAYERS[socket.id];
    if (player) {
      if (className === 'Necromancer' && !player.unlockedNecromancer) {
        player.unlockedNecromancer = true;
        socket.emit('notification', 'Você descobriu a Pedra Rúnica Mística e desbloqueou a classe secreta Necromante!');
      } else if (player.classes.length < 2 && !player.classes.includes(className)) {
        if (player.level > 2) {
          player.level -= 2;
          player.classes.push(className);
          socket.emit('classUpdated', { classes: player.classes, level: player.level });
          socket.emit('notification', `Nova classe ${className} adicionada! Custo: -2 Níveis.`);
        } else {
          socket.emit('notification', 'Nível insuficiente para absorver o custo de 2 níveis!');
        }
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`Jogador desconectado: ${socket.id}`);
    delete PLAYERS[socket.id];
    io.emit('playerLeft', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor SATISFY rodando na porta ${PORT}`);
});
