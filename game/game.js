// GTA Mini — kota top-down, JavaScript murni, tanpa dependensi, offline.
// Deterministik: semua variasi bangunan berasal dari PRNG seed tetap (1337).
"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const speedEl = document.getElementById("speed");
const timeEl = document.getElementById("time");

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORLD_W = 2400, WORLD_H = 1800;
const PITCH = 300, ROAD_W = 120, BLOCK = PITCH - ROAD_W;
const rand = mulberry32(1337);

// Bangunan: satu per blok di antara jalan, inset 14px, tinggi/warna dari seed.
const buildings = [];
for (let bx = 0; bx * PITCH < WORLD_W; bx++) {
  for (let by = 0; by * PITCH < WORLD_H; by++) {
    const x = bx * PITCH + ROAD_W + 14;
    const y = by * PITCH + ROAD_W + 14;
    const w = BLOCK - 28, h = BLOCK - 28;
    if (x + w > WORLD_W || y + h > WORLD_H) continue;
    const shade = 52 + Math.floor(rand() * 28);
    buildings.push({ x, y, w, h, c: "rgb(" + shade + "," + (shade + 8) + "," + (shade + 18) + ")" });
  }
}

const car = { x: ROAD_W / 2, y: ROAD_W / 2, angle: 0, speed: 0 };
const keys = {};
let elapsed = 0;

addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key.toLowerCase())) e.preventDefault();
});
addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

function resize() {
  canvas.width = innerWidth; canvas.height = innerHeight;
}
addEventListener("resize", resize); resize();

function collideBuildings() {
  const r = 14;
  for (const b of buildings) {
    const cx = Math.max(b.x, Math.min(car.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(car.y, b.y + b.h));
    const dx = car.x - cx, dy = car.y - cy, d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      const d = Math.sqrt(d2) || 0.001;
      car.x = cx + (dx / d) * r; car.y = cy + (dy / d) * r;
      car.speed = 0; // tabrakan menghentikan mobil
    }
  }
}

function update(dt) {
  const up = keys["w"] || keys["arrowup"];
  const down = keys["s"] || keys["arrowdown"];
  const left = keys["a"] || keys["arrowleft"];
  const right = keys["d"] || keys["arrowright"];
  const MAX_F = 340, MAX_R = 120, ACCEL = 420;

  if (up) car.speed += ACCEL * dt;
  if (down) car.speed -= ACCEL * dt;
  if (!up && !down) car.speed -= car.speed * 2.2 * dt; // gesekan
  else car.speed -= car.speed * 0.35 * dt; // hambatan gelinding
  car.speed = Math.max(-MAX_R, Math.min(MAX_F, car.speed));
  if (Math.abs(car.speed) < 1 && !up && !down) car.speed = 0;

  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  const grip = Math.min(1, Math.abs(car.speed) / 90);
  car.angle += steer * 2.6 * grip * dt * (car.speed < 0 ? -1 : 1);

  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = Math.max(16, Math.min(WORLD_W - 16, car.x));
  car.y = Math.max(16, Math.min(WORLD_H - 16, car.y));
  collideBuildings();
}

function drawRoads(camX, camY) {
  ctx.fillStyle = "#2a2f36";
  for (let x = 0; x < WORLD_W; x += PITCH) ctx.fillRect(x - camX, -camY, ROAD_W, WORLD_H);
  for (let y = 0; y < WORLD_H; y += PITCH) ctx.fillRect(-camX, y - camY, WORLD_W, ROAD_W);
  // Garis tengah putus-putus
  ctx.strokeStyle = "rgba(230,200,90,0.55)"; ctx.lineWidth = 3; ctx.setLineDash([22, 26]);
  ctx.beginPath();
  for (let x = 0; x < WORLD_W; x += PITCH) { ctx.moveTo(x + ROAD_W / 2 - camX, -camY); ctx.lineTo(x + ROAD_W / 2 - camX, WORLD_H - camY); }
  for (let y = 0; y < WORLD_H; y += PITCH) { ctx.moveTo(-camX, y + ROAD_W / 2 - camY); ctx.lineTo(WORLD_W - camX, y + ROAD_W / 2 - camY); }
  ctx.stroke(); ctx.setLineDash([]);
}

function draw(camX, camY) {
  ctx.fillStyle = "#16211a"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawRoads(camX, camY);
  for (const b of buildings) {
    if (b.x + b.w < camX || b.x > camX + canvas.width || b.y + b.h < camY || b.y > camY + canvas.height) continue;
    ctx.fillStyle = b.c; ctx.fillRect(b.x - camX, b.y - camY, b.w, b.h);
    ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.strokeRect(b.x - camX, b.y - camY, b.w, b.h);
  }
  // Mobil pemain
  ctx.save();
  ctx.translate(car.x - camX, car.y - camY); ctx.rotate(car.angle);
  ctx.fillStyle = "#d63a2f"; ctx.fillRect(-18, -10, 36, 20);
  ctx.fillStyle = "#8fc7e8"; ctx.fillRect(2, -8, 10, 16);
  ctx.fillStyle = "#111"; ctx.fillRect(-18, -10, 5, 20);
  ctx.restore();
}

function fmtTime(t) {
  const m = String(Math.floor(t / 60)).padStart(2, "0");
  const s = String(Math.floor(t % 60)).padStart(2, "0");
  return m + ":" + s;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000); last = now;
  elapsed += dt;
  update(dt);
  const camX = Math.max(0, Math.min(WORLD_W - canvas.width, car.x - canvas.width / 2));
  const camY = Math.max(0, Math.min(WORLD_H - canvas.height, car.y - canvas.height / 2));
  draw(camX, camY);
  speedEl.textContent = Math.round(Math.abs(car.speed) * 0.36) + " km/jam";
  timeEl.textContent = fmtTime(elapsed);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
