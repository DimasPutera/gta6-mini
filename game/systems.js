// systems.js — sistem kota untuk game 2D top-down (dipakai game.js)
// G.api = { state, enterCar, exitCar, start, save, load }
// S.api = { traffic, peds, police, missions, update }
'use strict';
const ROAD = 96, BLOCK = 160, GRID = 5, STEP = ROAD + BLOCK, WORLD = GRID * STEP;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const roadCoord = (i) => i * STEP + ROAD / 2;
const roads = Array.from({ length: GRID }, (_, i) => roadCoord(i));
function nearestRoad(v) { let best = roads[0]; for (const r of roads) if (Math.abs(v - r) < Math.abs(v - best)) best = r; return best; }
function onRoad(v) { return roads.some((r) => Math.abs(v - r) < 10); }
function getPlayer() { try { return G.api.state.player || null; } catch (e) { return null; } }
function getState() { try { return G.api.state || null; } catch (e) { return null; } }
// --- Lalu lintas: mobil di jalan mengikuti grid, belok di persimpangan ---
const traffic = [];
const CAR_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#ecf0f1', '#e67e22'];
function laneOffset(dx, dy) {
  if (dx > 0) return { x: 0, y: 14 };
  if (dx < 0) return { x: 0, y: -14 };
  if (dy > 0) return { x: -14, y: 0 };
  return { x: 14, y: 0 };
}
function spawnCar() {
  const vertical = Math.random() < 0.5, lane = pick(roads), side = Math.random() < 0.5 ? -1 : 1;
  const dx = vertical ? 0 : side, dy = vertical ? side : 0, off = laneOffset(dx, dy);
  const car = { x: vertical ? lane + off.x : (dx > 0 ? -40 : WORLD + 40), y: vertical ? (dy > 0 ? -40 : WORLD + 40) : lane + off.y,
    dx, dy, speed: 0, maxSpeed: rand(55, 95), color: pick(CAR_COLORS), w: 26, h: 14, justTurned: false };
  traffic.push(car); return car;
}
function carAhead(car) {
  for (const o of traffic) {
    if (o === car || o.dx !== car.dx || o.dy !== car.dy) continue;
    const ahead = (o.x - car.x) * car.dx + (o.y - car.y) * car.dy;
    const side = Math.abs((o.x - car.x) * car.dy - (o.y - car.y) * car.dx);
    if (ahead > 0 && ahead < 52 && side < 22) return o;
  }
  return null;
}
function maybeTurn(car) {
  if (!onRoad(car.x) || !onRoad(car.y) || car.justTurned || Math.random() > 0.3) return;
  const wasHorizontal = car.dx !== 0, side = pick([-1, 1]);
  const ndx = wasHorizontal ? 0 : side, ndy = wasHorizontal ? side : 0, off = laneOffset(ndx, ndy);
  car.x = nearestRoad(car.x) + off.x; car.y = nearestRoad(car.y) + off.y;
  car.dx = ndx; car.dy = ndy; car.justTurned = true;
}
function updateTraffic(dt) {
  for (let i = traffic.length - 1; i >= 0; i--) {
    const car = traffic[i];
    car.speed = carAhead(car) ? Math.max(0, car.speed - 220 * dt) : Math.min(car.maxSpeed, car.speed + 90 * dt);
    car.x += car.dx * car.speed * dt; car.y += car.dy * car.speed * dt;
    maybeTurn(car);
    if (!onRoad(car.x) || !onRoad(car.y)) car.justTurned = false;
    if (car.x < -60 || car.x > WORLD + 60 || car.y < -60 || car.y > WORLD + 60) traffic.splice(i, 1);
  }
  while (traffic.length < 10) spawnCar();
}
// --- Pejalan kaki: berjalan di trotoar (tepi jalan) ---
const peds = [];
const PED_COLORS = ['#f39c12', '#1abc9c', '#e84393', '#00cec9', '#fd79a8', '#636e72'];
function spawnPed() {
  const vertical = Math.random() < 0.5, lane = pick(roads), side = Math.random() < 0.5 ? -1 : 1;
  const dx = vertical ? 0 : side, dy = vertical ? side : 0, off = ROAD / 2 + 12;
  const ped = { x: vertical ? lane + (side > 0 ? off : -off) : (dx > 0 ? -20 : WORLD + 20),
    y: vertical ? (dy > 0 ? -20 : WORLD + 20) : lane + (side > 0 ? off : -off),
    dx, dy, speed: rand(20, 42), color: pick(PED_COLORS), justTurned: false };
  peds.push(ped); return ped;
}
function updatePeds(dt) {
  for (let i = peds.length - 1; i >= 0; i--) {
    const p = peds[i];
    p.x += p.dx * p.speed * dt; p.y += p.dy * p.speed * dt;
    if (onRoad(p.x) && onRoad(p.y) && !p.justTurned && Math.random() < 0.02) {
      const wasHorizontal = p.dx !== 0, side = pick([-1, 1]);
      p.dx = wasHorizontal ? 0 : side; p.dy = wasHorizontal ? side : 0; p.justTurned = true;
    }
    if (!onRoad(p.x) || !onRoad(p.y)) p.justTurned = false;
    if (p.x < -30 || p.x > WORLD + 30 || p.y < -30 || p.y > WORLD + 30) peds.splice(i, 1);
  }
  while (peds.length < 12) spawnPed();
}
// --- Wanted & polisi: bintang naik saat curi mobil / tabrak pejalan kaki ---
let wanted = 0, wantedTimer = 0;
const police = [];
function addWanted(n) { wanted = clamp(wanted + n, 0, 5); wantedTimer = 0; }
function decayWanted(dt) { if (wanted <= 0) return; wantedTimer += dt; if (wantedTimer >= 12) { wanted -= 1; wantedTimer = 0; } }
function spawnPolice() {
  const player = getPlayer(), base = player || { x: WORLD / 2, y: WORLD / 2 }, angle = rand(0, Math.PI * 2);
  const cop = { x: base.x + Math.cos(angle) * 320, y: base.y + Math.sin(angle) * 320, speed: rand(115, 145), color: '#2c3e50', siren: 0 };
  police.push(cop); return cop;
}
function updatePolice(dt) {
  const player = getPlayer(), want = wanted > 0 ? Math.min(wanted, 3) : 0;
  while (police.length < want) spawnPolice();
  for (let i = police.length - 1; i >= 0; i--) {
    const cop = police[i]; cop.siren += dt;
    if (!player || wanted <= 0) { if (police.length > want) police.splice(i, 1); continue; }
    const d = dist(cop, player), a = Math.atan2(player.y - cop.y, player.x - cop.x);
    cop.x += Math.cos(a) * cop.speed * dt; cop.y += Math.sin(a) * cop.speed * dt;
    if (d < 28) { // tertangkap: denda Rp50, polisi mundur sejenak
      const st = getState();
      if (st && typeof st.money === 'number') st.money = Math.max(0, st.money - 50);
      cop.x -= Math.cos(a) * 40; cop.y -= Math.sin(a) * 40;
    }
  }
}
function stealCar() {
  const player = getPlayer();
  if (!player) return null;
  let best = null, bestD = 48;
  for (const car of traffic) { const d = dist(car, player); if (d < bestD) { best = car; bestD = d; } }
  if (!best) return null;
  traffic.splice(traffic.indexOf(best), 1);
  addWanted(1);
  try { G.api.enterCar(best); } catch (e) { /* game.js belum siap */ }
  return best;
}
function checkPedHit() {
  const player = getPlayer(), st = getState();
  if (!player || !st || !st.inCar) return;
  for (let i = peds.length - 1; i >= 0; i--) {
    if (dist(peds[i], player) < 22) { peds.splice(i, 1); addWanted(1); }
  }
}
// --- Misi: antar paket ke titik tujuan, dapat hadiah uang ---
const missions = [
  { id: 'm1', name: 'Antar paket — Pasar', to: { x: roads[4], y: roads[1] }, reward: 150, active: false, done: false },
  { id: 'm2', name: 'Antar paket — Pelabuhan', to: { x: roads[0], y: roads[4] }, reward: 200, active: false, done: false },
  { id: 'm3', name: 'Antar paket — Stasiun', to: { x: roads[3], y: roads[3] }, reward: 250, active: false, done: false },
  { id: 'm4', name: 'Antar paket — Rumah Sakit', to: { x: roads[1], y: roads[0] }, reward: 300, active: false, done: false },
];
let activeMission = null;
function startMission(id) {
  const m = missions.find((x) => x.id === id && !x.done);
  if (!m) return null;
  missions.forEach((x) => { x.active = false; });
  m.active = true; activeMission = m; return m;
}
function updateMissions() {
  if (!activeMission) return;
  const player = getPlayer();
  if (!player || dist(player, activeMission.to) >= 32) return;
  const st = getState();
  if (st && typeof st.money === 'number') st.money += activeMission.reward;
  activeMission.done = true; activeMission.active = false; activeMission = null;
}
// --- Gambar (opsional, dipanggil game.js tiap frame) ---
function drawTraffic(ctx) {
  for (const c of traffic) { ctx.fillStyle = c.color; ctx.fillRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h); }
}
function drawPeds(ctx) {
  for (const p of peds) { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill(); }
}
function drawPolice(ctx) {
  for (const cop of police) {
    ctx.fillStyle = cop.color; ctx.fillRect(cop.x - 13, cop.y - 7, 26, 14);
    ctx.fillStyle = Math.floor(cop.siren * 4) % 2 ? '#e74c3c' : '#3498db';
    ctx.fillRect(cop.x - 13, cop.y - 11, 26, 4);
  }
}
function drawMissions(ctx) {
  if (!activeMission) return;
  ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(activeMission.to.x, activeMission.to.y, 18, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#f1c40f'; ctx.font = '12px sans-serif';
  ctx.fillText(activeMission.name, activeMission.to.x + 24, activeMission.to.y);
}
function resetCity() {
  traffic.length = 0; peds.length = 0; police.length = 0;
  wanted = 0; wantedTimer = 0; activeMission = null;
  missions.forEach((m) => { m.active = false; m.done = false; });
  for (let i = 0; i < 10; i++) spawnCar();
  for (let i = 0; i < 12; i++) spawnPed();
}
// --- Update utama & ekspor ---
function update(dt) {
  const step = clamp(dt || 0.016, 0, 0.05);
  updateTraffic(step); updatePeds(step); checkPedHit();
  decayWanted(step); updatePolice(step); updateMissions();
}
for (let i = 0; i < 10; i++) spawnCar();
for (let i = 0; i < 12; i++) spawnPed();
const S = (typeof window !== 'undefined' ? window : globalThis).S || {};
S.api = { traffic, peds, police, missions, update,
  wanted: () => wanted, addWanted, stealCar, startMission, spawnCar, spawnPed,
  draw: { traffic: drawTraffic, peds: drawPeds, police: drawPolice, missions: drawMissions }, resetCity };
if (typeof window !== 'undefined') window.S = S;
if (typeof globalThis !== 'undefined') globalThis.S = S;
