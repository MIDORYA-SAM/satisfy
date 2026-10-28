import * as THREE from 'three';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

let scene, camera, renderer;
let playerMesh, terrain;
const mobsMeshes = {};

let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;

let playerData = {
  level: 5,
  classes: ['Guerreiro'],
  unlockedNecromancer: false,
  hp: 100,
  maxHp: 100
};

function init() {
  const container = document.getElementById('canvas-container');

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f172a);
  scene.fog = new THREE.FogExp2(0x0f172a, 0.015);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(50, 100, 50);
  dirLight.castShadow = true;
  scene.add(dirLight);

  const terrainGeo = new THREE.PlaneGeometry(300, 300, 32, 32);
  const terrainMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
  terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.rotation.x = -Math.PI / 2;
  terrain.receiveShadow = true;
  scene.add(terrain);

  createEnvironment();

  const playerGeo = new THREE.BoxGeometry(1, 2, 1);
  const playerMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6 });
  playerMesh = new THREE.Mesh(playerGeo, playerMat);
  playerMesh.position.set(0, 1, 0);
  playerMesh.castShadow = true;
  scene.add(playerMesh);

  createMysticalRuneStone();

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('resize', onWindowResize);

  setupUI();
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    document.getElementById('joystick-base').style.display = 'block';
    setupMobileJoystick();
  }

  socket.on('init', () => {
    showNotification('Conectado ao servidor SATISFY com sucesso!');
  });

  socket.on('notification', (msg) => {
    showNotification(msg);
  });

  socket.on('classUpdated', (data) => {
    playerData.classes = data.classes;
    playerData.level = data.level;
    updateHUD();
  });

  socket.on('mobDamaged', (data) => {
    const mob = mobsMeshes[data.mobId];
    if (mob && !data.alive) {
      scene.remove(mob);
      delete mobsMeshes[data.mobId];
    }
  });

  animate();
}

function createEnvironment() {
  for (let i = 0; i < 30; i++) {
    const x = (Math.random() - 0.5) * 200;
    const z = (Math.random() - 0.5) * 200;
    if (Math.abs(x) < 10 && Math.abs(z) < 10) continue;

    const trunkGeo = new THREE.CylinderGeometry(0.4, 0.6, 4, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x451a03 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 2, z);

    const leavesGeo = new THREE.ConeGeometry(2.5, 5, 6);
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x065f46 });
    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.position.set(x, 5.5, z);

    scene.add(trunk);
    scene.add(leaves);
  }
}

function createMysticalRuneStone() {
  const stoneGeo = new THREE.DodecahedronGeometry(1.5);
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8b5cf6, emissive: 0x4c1d95, roughness: 0.2 });
  const runeStone = new THREE.Mesh(stoneGeo, stoneMat);
  runeStone.position.set(15, 1.5, -15);
  scene.add(runeStone);
}

function onKeyDown(e) {
  switch (e.code) {
    case 'KeyW': moveForward = true; break;
    case 'KeyS': moveBackward = true; break;
    case 'KeyA': moveLeft = true; break;
    case 'KeyD': moveRight = true; break;
    case 'KeyE': interactWithWorld(); break;
    case 'Space': attackAction(); break;
  }
}

function onKeyUp(e) {
  switch (e.code) {
    case 'KeyW': moveForward = false; break;
    case 'KeyS': moveBackward = false; break;
    case 'KeyA': moveLeft = false; break;
    case 'KeyD': moveRight = false; break;
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function setupMobileJoystick() {
  const base = document.getElementById('joystick-base');
  const knob = document.getElementById('joystick-knob');
  let active = false;
  let baseRect = base.getBoundingClientRect();

  base.addEventListener('touchstart', () => {
    active = true;
    baseRect = base.getBoundingClientRect();
  });

  window.addEventListener('touchmove', (e) => {
    if (!active) return;
    const touch = e.touches[0];
    const dx = touch.clientX - (baseRect.left + baseRect.width / 2);
    const dy = touch.clientY - (baseRect.top + baseRect.height / 2);
    const dist = Math.min(50, Math.sqrt(dx * dx + dy * dy));
    const angle = Math.atan2(dy, dx);

    const kx = Math.cos(angle) * dist;
    const ky = Math.sin(angle) * dist;
    knob.style.transform = `translate(${kx}px, ${ky}px)`;

    moveForward = ky < -10;
    moveBackward = ky > 10;
    moveLeft = kx < -10;
    moveRight = kx > 10;
  });

  window.addEventListener('touchend', () => {
    active = false;
    knob.style.transform = `translate(0px, 0px)`;
    moveForward = moveBackward = moveLeft = moveRight = false;
  });
}

function setupUI() {
  document.getElementById('btn-inventory').onclick = () => {
    openModal('Inventário', '<p>Espada de Ferrugem (+10 ATK)</p><p>Poção de Vida (x3)</p>');
  };

  document.getElementById('btn-classes').onclick = () => {
    let html = `<p>Classes Atuais: ${playerData.classes.join(', ')}</p>`;
    html += `<p>Nível atual: ${playerData.level}</p>`;
    html += `<p style="font-size:12px; color:#cbd5e1;">Adicionar uma segunda classe custa 2 níveis (Mínimo Nv. 1).</p>`;
    if (playerData.unlockedNecromancer && !playerData.classes.includes('Necromante')) {
      html += `<button class="menu-btn" id="btn-add-necro" style="margin-top:10px;">Adicionar Necromante (-2 Níveis)</button>`;
    }
    html += `<button class="menu-btn" id="btn-add-mage" style="margin-top:10px; background:#8b5cf6;">Adicionar Mago (-2 Níveis)</button>`;
    openModal('Sistema de Classes', html);

    setTimeout(() => {
      const btnNecro = document.getElementById('btn-add-necro');
      if (btnNecro) {
        btnNecro.onclick = () => {
          if (confirm('Deseja adicionar a classe Necromante? Custo: 2 níveis.')) {
            socket.emit('unlockClass', 'Necromancer');
            closeModal();
          }
        };
      }
      const btnMage = document.getElementById('btn-add-mage');
      if (btnMage) {
        btnMage.onclick = () => {
          if (confirm('Deseja adicionar a classe Mago? Custo: 2 níveis.')) {
            socket.emit('unlockClass', 'Mago');
            closeModal();
          }
        };
      }
    }, 100);
  };

  document.getElementById('btn-prof').onclick = () => {
    openModal('Profissões', '<p>Minerador (Nv. 2)</p><p>Ferreiro (Nv. 1)</p><p>Lenhador (Nv. 3)</p>');
  };

  document.getElementById('btn-interact').onclick = () => {
    interactWithWorld();
  };
}

function openModal(title, htmlContent) {
  const modal = document.getElementById('modal-overlay');
  const body = document.getElementById('modal-body');
  body.innerHTML = `<h2>${title}</h2>${htmlContent}<button class="menu-btn" id="modal-close" style="margin-top: 15px;">Fechar</button>`;
  modal.style.display = 'flex';
  document.getElementById('modal-close').onclick = closeModal;
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

function showNotification(msg) {
  const note = document.getElementById('notification');
  note.innerText = msg;
  note.style.display = 'block';
  setTimeout(() => {
    note.style.display = 'none';
  }, 4000);
}

function interactWithWorld() {
  const dist = playerMesh.position.distanceTo(new THREE.Vector3(15, 1.5, -15));
  if (dist < 4) {
    socket.emit('unlockClass', 'Necromancer');
    showNotification('Você tocou na Pedra Rúnica Mística e revelou a classe secreta Necromante!');
  } else {
    showNotification('Nenhuma interação disponível por perto.');
  }
}

function attackAction() {
  showNotification('Ataque realizado!');
  socket.emit('attackMob', 'mob_1');
}

function updateHUD() {
  document.getElementById('lbl-level').innerText = playerData.level;
  document.getElementById('lbl-classes').innerText = playerData.classes.join(', ');
}

function animate() {
  requestAnimationFrame(animate);

  const speed = 0.1;
  if (moveForward) playerMesh.position.z -= speed;
  if (moveBackward) playerMesh.position.z += speed;
  if (moveLeft) playerMesh.position.x -= speed;
  if (moveRight) playerMesh.position.x += speed;

  camera.position.x = playerMesh.position.x;
  camera.position.y = playerMesh.position.y + 6;
  camera.position.z = playerMesh.position.z + 10;
  camera.lookAt(playerMesh.position);

  socket.emit('playerMove', {
    x: playerMesh.position.x,
    y: playerMesh.position.y,
    z: playerMesh.position.z
  });

  renderer.render(scene, camera);
}

init();
