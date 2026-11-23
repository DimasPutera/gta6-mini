// systems.js — city systems for game.js: traffic, pedestrians, police, missions, wanted.
// Grid: 5x5 roads (STEP 256), roads 96 wide, blocks 160; road centres at i*256+128.
// Player: G.api.state.player {x, y}. Money/wanted mirror into G.api.state when present.
// game.js usage: S.api.update(dt) every frame; S.api.traffic.steal(car) on car theft;
// S.api.police.reportCrime(n) on any other crime game.js detects.
// Exposes S.api = { traffic, peds, police, missions, update }.
const ROAD = 96, BLOCK = 160, GRID = 5, STEP = 256, WORLD = 1280;
const SYS = (globalThis.S = globalThis.S || {});

// ---------- helpers ----------
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const LINES = Array.from({ length: GRID }, (_, i) => i * STEP + STEP / 2);
const WALK = ROAD / 2 + 10; // sidewalk offset from a road centre-line
const ROAD_HALF = ROAD / 2;

// ---------- shared state ----------
const gameState = () => (globalThis.G && globalThis.G.api && globalThis.G.api.state) || null;
const getPlayer = () => { const s = gameState(); return s ? s.player || null : null; };
let wanted = 0, lastCrimeAt = -1e9, elapsed = 0;
function syncState() {
  const s = gameState(); if (!s) return;
  if (typeof s.wanted !== 'number') s.wanted = wanted; else wanted = s.wanted;
}
function addWanted(n) {
  wanted = clamp(wanted + n, 0, 5); if (n > 0) lastCrimeAt = elapsed;
  const s = gameState(); if (s) s.wanted = wanted;
}
function addMoney(n) {
  const s = gameState(); if (!s) return;
  s.money = (typeof s.money === 'number' ? s.money : 0) + n;
}

// ---------- traffic: 8 cars on the grid roads ----------
const CAR_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#e67e22', '#9b59b6', '#ecf0f1', '#1abc9c'];
const STOP_GAP = 52; // stop when a car ahead is closer than this
function spawnCar(i) {
  const horizontal = Math.random() < 0.5, line = pick(LINES);
  const dir = horizontal ? pick([0, 2]) : pick([1, 3]);
  const dirs = [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 0, dy: -1 }];
  const d = dirs[dir], maxSpeed = rand(55, 95), along = rand(0, WORLD);
  return { x: horizontal ? along : line, y: horizontal ? line : along,
    dx: d.dx, dy: d.dy, speed: maxSpeed, maxSpeed, color: CAR_COLORS[i % CAR_COLORS.length],
    w: horizontal ? 36 : 18, h: horizontal ? 18 : 36 };
}
const traffic = [];
for (let i = 0; i < 8; i++) traffic.push(spawnCar(i));
function carAhead(car) {
  for (const other of traffic) {
    if (other === car || other.dx !== car.dx || other.dy !== car.dy) continue;
    const sameLane = car.dx !== 0 ? Math.abs(other.y - car.y) < 4 : Math.abs(other.x - car.x) < 4;
    if (!sameLane) continue;
    const gap = (other.x - car.x) * car.dx + (other.y - car.y) * car.dy;
    if (gap > 0 && gap < STOP_GAP) return true;
  }
  return false;
}
const nearestLine = (v) => LINES.reduce((b, l) => (Math.abs(l - v) < Math.abs(b - v) ? l : b), LINES[0]);
function maybeTurn(car) {
  if (!LINES.some((l) => Math.abs(car.x - l) < 7 && Math.abs(car.y - l) < 7)) return;
  car.x = nearestLine(car.x); car.y = nearestLine(car.y); // snap onto the intersection
  const roll = Math.random(); if (roll < 0.6) return; // mostly straight, sometimes turn
  const dirs = [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 0, dy: -1 }];
  const cur = dirs.findIndex((d) => d.dx === car.dx && d.dy === car.dy);
  const next = dirs[(cur + (roll < 0.8 ? 1 : 3)) % 4]; // left or right, never a U-turn
  car.dx = next.dx; car.dy = next.dy;
  const tmp = car.w; car.w = car.h; car.h = tmp; // swap footprint with heading
}
function moveTraffic(dt) {
  for (const car of traffic) {
    if (carAhead(car)) { car.speed = 0; continue; }
    car.speed = car.maxSpeed;
    car.x = clamp(car.x + car.dx * car.speed * dt, 0, WORLD);
    car.y = clamp(car.y + car.dy * car.speed * dt, 0, WORLD);
    maybeTurn(car);
    if (car.x <= 0 || car.x >= WORLD || car.y <= 0 || car.y >= WORLD) {
      car.dx *= -1; car.dy *= -1; // U-turn at the world edge
    }
  }
}
// Steal a traffic car: game.js calls this when the player takes a car.
// The car despawns (player drives it now) and wanted rises.
traffic.steal = function (car) {
  const idx = traffic.indexOf(car); if (idx === -1) return false;
  traffic.splice(idx, 1); traffic.push(spawnCar(Date.now() % 100000));
  addWanted(2); return true;
};
traffic.nearest = function (x, y) {
  let best = null, bestD = Infinity;
  for (const car of traffic) { const d = dist(x, y, car.x, car.y); if (d < bestD) { bestD = d; best = car; } }
  return best;
};
traffic.reset = function () { traffic.length = 0; for (let i = 0; i < 8; i++) traffic.push(spawnCar(i)); };

// ---------- peds: 10 pedestrians on the sidewalks ----------
const PED_HIT_DIST = 26;
function spawnPed(i) {
  const horizontal = Math.random() < 0.5, line = pick(LINES), side = Math.random() < 0.5 ? -1 : 1;
  const seg = randi(0, GRID - 2); // block between LINES[seg] and LINES[seg+1]
  const from = LINES[seg] + ROAD_HALF, to = from + BLOCK; // walk spans one block (160)
  const dir = Math.random() < 0.5 ? 1 : -1, speed = rand(18, 34);
  return { x: horizontal ? rand(from, to) : line + side * WALK,
    y: horizontal ? line + side * WALK : rand(from, to),
    dx: horizontal ? dir : 0, dy: horizontal ? 0 : dir, speed,
    from, to, horizontal, down: 0 };
}
const peds = [];
for (let i = 0; i < 10; i++) peds.push(spawnPed(i));
function movePeds(dt) {
  for (const ped of peds) {
    if (ped.down > 0) { ped.down -= dt; continue; } // knocked down, getting up
    const pos = ped.horizontal ? ped.x : ped.y, next = pos + (ped.horizontal ? ped.dx : ped.dy) * ped.speed * dt;
    if (next <= ped.from || next >= ped.to) { // turn at the block end
      if (ped.horizontal) ped.dx *= -1; else ped.dy *= -1;
    } else if (ped.horizontal) ped.x = next; else ped.y = next;
  }
}
peds.reset = function () { peds.length = 0; for (let i = 0; i < 10; i++) peds.push(spawnPed(i)); };

// ---------- police: one patrol car that chases the player when wanted ----------
const POLICE_SPEED = 150, CATCH_DIST = 36;
const police = [{ x: LINES[0], y: LINES[0], dx: 1, dy: 0, speed: 80, maxSpeed: 150,
  color: '#2c3e50', w: 36, h: 18, mode: 'patrol', cooldown: 0 }];
function movePolice(dt) {
  const car = police[0], p = getPlayer();
  if (car.cooldown > 0) { car.cooldown -= dt; if (car.cooldown <= 0) car.mode = 'patrol'; }
  if (wanted > 0 && p && car.cooldown <= 0) car.mode = 'chase';
  else if (car.mode === 'chase') car.mode = 'patrol';
  if (car.mode === 'chase' && p) {
    const d = dist(car.x, car.y, p.x, p.y) || 1;
    car.dx = (p.x - car.x) / d; car.dy = (p.y - car.y) / d; car.speed = POLICE_SPEED;
    car.x += car.dx * POLICE_SPEED * dt; car.y += car.dy * POLICE_SPEED * dt;
    if (d < CATCH_DIST) { // busted: wanted clears, cruiser resets to a far corner
      wanted = 0; const s = gameState(); if (s) s.wanted = 0;
      car.x = LINES[0]; car.y = LINES[0]; car.dx = 1; car.dy = 0;
      car.mode = 'cooldown'; car.cooldown = 5;
    }
    return;
  }
  // Patrol: cruise the grid like a traffic car.
  car.speed = 80;
  car.x = clamp(car.x + car.dx * car.speed * dt, 0, WORLD);
  car.y = clamp(car.y + car.dy * car.speed * dt, 0, WORLD);
  if (LINES.some((l) => Math.abs(car.x - l) < 7 && Math.abs(car.y - l) < 7) && Math.random() < 0.3) {
    const dirs = [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 0, dy: -1 }];
    const cur = dirs.findIndex((d) => d.dx === car.dx && d.dy === car.dy);
    const next = dirs[(cur + pick([1, 3])) % 4];
    car.dx = next.dx; car.dy = next.dy;
  }
  if (car.x <= 0 || car.x >= WORLD || car.y <= 0 || car.y >= WORLD) { car.dx *= -1; car.dy *= -1; }
}
// game.js calls this on any crime it detects (car theft is also covered by traffic.steal).
police.reportCrime = function (n) { addWanted(n || 1); };
police.getWanted = function () { return wanted; };
police.reset = function () {
  const car = police[0];
  car.x = LINES[0]; car.y = LINES[0]; car.dx = 1; car.dy = 0;
  car.mode = 'patrol'; car.cooldown = 0;
};

// ---------- missions: 5 package deliveries ----------
const MISSION_REWARDS = [150, 200, 250, 300, 400];
function missionPoint(used) {
  let pt; do { pt = { x: pick(LINES), y: pick(LINES) }; }
  while (used.some((u) => u.x === pt.x && u.y === pt.y));
  used.push(pt); return pt;
}
function buildMissions() {
  const used = [], list = [];
  for (let i = 0; i < 5; i++) list.push({ id: i, pickup: missionPoint(used),
    dropoff: missionPoint(used), reward: MISSION_REWARDS[i], done: false, phase: 'pickup' });
  return list;
}
const missions = buildMissions();
missions.current = missions[0];
missions.reset = function () {
  const fresh = buildMissions(); missions.length = 0;
  fresh.forEach((m) => missions.push(m)); missions.current = missions[0];
};
missions.allDone = function () { return missions.every((m) => m.done); };
function checkMissions() {
  const p = getPlayer(), m = missions.current; if (!p || !m || m.done) return;
  if (m.phase === 'pickup' && dist(p.x, p.y, m.pickup.x, m.pickup.y) < 40) m.phase = 'deliver';
  else if (m.phase === 'deliver' && dist(p.x, p.y, m.dropoff.x, m.dropoff.y) < 40) {
    m.done = true; m.phase = 'done'; addMoney(m.reward); // delivery complete: pay out
    missions.current = missions.find((mm) => !mm.done) || null;
  }
}

// ---------- collisions: player vs pedestrian ----------
function checkPedCollisions() {
  const p = getPlayer(); if (!p) return;
  for (const ped of peds) {
    if (ped.down > 0) continue;
    if (dist(p.x, p.y, ped.x, ped.y) < PED_HIT_DIST) { ped.down = 2; addWanted(1); } // hit a ped: crime
  }
}

// ---------- update: one step for every system ----------
function update(dt) {
  dt = clamp(dt || 0, 0, 0.05); elapsed += dt; syncState();
  moveTraffic(dt); movePeds(dt); movePolice(dt);
  checkPedCollisions(); checkMissions();
  if (wanted > 0 && elapsed - lastCrimeAt > 6) { // wanted decays slowly with no crime
    wanted = Math.max(0, wanted - dt * 0.25);
    const s = gameState(); if (s) s.wanted = wanted;
  }
}

SYS.api = { traffic, peds, police, missions, update };
