// game.js — GTA 6 Mini: kota top-down (grid sama dengan systems.js).
// Grid: WORLD 1280, STEP 256, ROAD 96, BLOCK 160.
// Pusat jalan: i*256+128 -> 128, 384, 640, 896, 1152 (jalan 96 lebar).
// Bangunan 160x160 di celah antar jalan (x,y mulai 176+256i, i 0..3).
(() => {
  'use strict';
  const WORLD = 1280, STEP = 256, ROAD = 96, BLOCK = 160;
  const CENTRES = [128, 384, 640, 896, 1152];
  // Kecepatan jalan kaki pemain, piksel per detik.
  const WALK_SPEED = 150, CAR_SPEED = 260, SAVE_KEY = 'gta6mini-save';
  const cv = document.getElementById('game'), ctx = cv.getContext('2d');
  const mm = document.getElementById('minimap'), mmx = mm ? mm.getContext('2d') : null;
  const elSpeed = document.getElementById('speed'), elTime = document.getElementById('time');
  const elMoney = document.getElementById('money'), elWanted = document.getElementById('wanted');
  const btnStart = document.getElementById('start');
  const state = {
    player: { x: 640, y: 640, angle: 0, speed: 0, inCar: false },
    money: 0, wanted: 0, time: 0, started: false,
  };
  let car = null;
  const keys = {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const S = () => (window.S && window.S.api) || null;
  const fmtTime = (t) => String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(Math.floor(t % 60)).padStart(2, '0');
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!d || !d.player) return false;
      state.player.x = clamp(+d.player.x || 640, 0, WORLD);
      state.player.y = clamp(+d.player.y || 640, 0, WORLD);
      state.player.angle = +d.player.angle || 0;
      state.player.speed = 0; state.player.inCar = false;
      state.money = +d.money || 0; state.wanted = +d.wanted || 0;
      state.time = +d.time || 0; state.started = !!d.started;
      car = null; return true;
    } catch (e) { return false; }
  }
  function start() {
    state.started = true;
    if (btnStart) btnStart.textContent = 'Bermain…';
  }
  function enterCar() {
    const api = S();
    if (!api || !api.traffic || !api.traffic.nearest) return;
    const near = api.traffic.nearest(state.player.x, state.player.y);
    if (!near || dist(state.player.x, state.player.y, near.x, near.y) > 64) return;
    if (api.traffic.steal) api.traffic.steal(near);
    car = near; state.player.inCar = true;
    state.player.x = near.x; state.player.y = near.y;
  }
  function exitCar() {
    if (!car) { state.player.inCar = false; return; }
    state.player.x = clamp(car.x + 28, 0, WORLD);
    state.player.y = clamp(car.y + 28, 0, WORLD);
    state.player.inCar = false; car = null;
  }
  window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) e.preventDefault();
    if ((e.key === 'e' || e.key === 'E') && !e.repeat && state.started) {
      if (state.player.inCar) exitCar(); else enterCar();
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  if (btnStart) btnStart.addEventListener('click', start);
  function update(dt) {
    const p = state.player;
    let dx = 0, dy = 0;
    if (keys['w'] || keys['arrowup']) dy -= 1;
    if (keys['s'] || keys['arrowdown']) dy += 1;
    if (keys['a'] || keys['arrowleft']) dx -= 1;
    if (keys['d'] || keys['arrowright']) dx += 1;
    const len = Math.hypot(dx, dy), speed = p.inCar ? CAR_SPEED : WALK_SPEED;
    if (len > 0) {
      dx /= len; dy /= len; p.angle = Math.atan2(dy, dx); p.speed = speed;
      p.x = clamp(p.x + dx * speed * dt, 12, WORLD - 12);
      p.y = clamp(p.y + dy * speed * dt, 12, WORLD - 12);
    } else p.speed = 0;
    if (p.inCar && car) {
      car.x = p.x; car.y = p.y;
      car.dx = Math.cos(p.angle); car.dy = Math.sin(p.angle);
    }
  }
  function drawRoads() {
    ctx.fillStyle = '#2d5a2e'; ctx.fillRect(0, 0, WORLD, WORLD);
    ctx.fillStyle = '#3a3a3f';
    for (const c of CENTRES) { ctx.fillRect(c - ROAD / 2, 0, ROAD, WORLD); ctx.fillRect(0, c - ROAD / 2, WORLD, ROAD); }
    ctx.strokeStyle = '#f7d54d'; ctx.setLineDash([18, 18]); ctx.beginPath();
    for (const c of CENTRES) { ctx.moveTo(c, 0); ctx.lineTo(c, WORLD); ctx.moveTo(0, c); ctx.lineTo(WORLD, c); }
    ctx.stroke(); ctx.setLineDash([]);
  }
  function drawBuildings() {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const x = 176 + STEP * i, y = 176 + STEP * j;
      ctx.fillStyle = (i + j) % 2 === 0 ? '#7a6a58' : '#6b7a8a';
      ctx.fillRect(x, y, BLOCK, BLOCK);
      ctx.strokeStyle = '#222'; ctx.strokeRect(x + 1, y + 1, BLOCK - 2, BLOCK - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x + 16, y + 16, BLOCK - 32, BLOCK - 32);
    }
  }
  function drawCarShape(x, y, angle, color, w, h) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = color; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-w / 6, -h / 2 + 2, w / 3, h - 4);
    ctx.restore();
  }
  function drawTraffic() {
    const api = S(); if (!api || !api.traffic) return;
    for (const t of api.traffic) {
      drawCarShape(t.x, t.y, Math.atan2(t.dy || 0, t.dx || 1), t.color || '#ccc', t.w || 36, t.h || 18);
    }
  }
  function drawPeds() {
    const api = S(); if (!api || !api.peds) return;
    for (const ped of api.peds) {
      ctx.fillStyle = ped.down > 0 ? '#888' : '#f5d76e';
      ctx.beginPath(); ctx.arc(ped.x, ped.y, ped.down > 0 ? 5 : 7, 0, Math.PI * 2); ctx.fill();
    }
  }
  function drawPolice() {
    const api = S(); if (!api || !api.police) return;
    for (const pc of api.police) {
      drawCarShape(pc.x, pc.y, Math.atan2(pc.dy || 0, pc.dx || 1), pc.color || '#2c3e50', pc.w || 36, pc.h || 18);
      ctx.fillStyle = pc.mode === 'chase' ? '#e74c3c' : '#3498db';
      ctx.beginPath(); ctx.arc(pc.x, pc.y, 4, 0, Math.PI * 2); ctx.fill();
    }
  }
  function missionTarget() {
    const api = S(); if (!api || !api.missions || !api.missions.current) return null;
    const m = api.missions.current;
    if (m.phase === 'pickup') return { p: m.pickup, c: '#2ecc71' };
    if (m.phase === 'deliver') return { p: m.dropoff, c: '#f39c12' };
    return null;
  }
  function drawMission() {
    const t = missionTarget(); if (!t) return;
    const pulse = 18 + Math.sin(performance.now() / 200) * 4;
    ctx.strokeStyle = t.c; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(t.p.x, t.p.y, pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = t.c;
    ctx.beginPath(); ctx.arc(t.p.x, t.p.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 1;
  }
  function drawPlayer() {
    const p = state.player;
    if (p.inCar && car) { drawCarShape(p.x, p.y, p.angle, '#e74c3c', 36, 18); return; }
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
    ctx.fillStyle = '#ecf0f1';
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e74c3c'; ctx.fillRect(4, -3, 10, 6);
    ctx.restore();
  }
  function drawMinimap() {
    if (!mmx) return;
    const k = mm.width / WORLD;
    mmx.fillStyle = '#1c2b1e'; mmx.fillRect(0, 0, mm.width, mm.height);
    mmx.fillStyle = '#3a3a3f';
    for (const c of CENTRES) { mmx.fillRect((c - ROAD / 2) * k, 0, ROAD * k, mm.height); mmx.fillRect(0, (c - ROAD / 2) * k, mm.width, ROAD * k); }
    const t = missionTarget();
    if (t) { mmx.fillStyle = '#f39c12'; mmx.fillRect(t.p.x * k - 3, t.p.y * k - 3, 6, 6); }
    const api = S();
    if (api && api.police) for (const pc of api.police) { mmx.fillStyle = '#3498db'; mmx.fillRect(pc.x * k - 2, pc.y * k - 2, 4, 4); }
    mmx.fillStyle = '#fff';
    mmx.beginPath(); mmx.arc(state.player.x * k, state.player.y * k, 4, 0, Math.PI * 2); mmx.fill();
  }
  function drawHUD() {
    if (elSpeed) elSpeed.textContent = String(Math.round(state.player.speed));
    if (elTime) elTime.textContent = fmtTime(state.time);
    if (elMoney) elMoney.textContent = String(state.money);
    if (elWanted) elWanted.textContent = String(Math.round(state.wanted));
  }
  function draw() {
    const p = state.player;
    const camX = clamp(p.x - cv.width / 2, 0, Math.max(0, WORLD - cv.width));
    const camY = clamp(p.y - cv.height / 2, 0, Math.max(0, WORLD - cv.height));
    ctx.save(); ctx.translate(-camX, -camY);
    drawRoads(); drawBuildings(); drawMission();
    drawTraffic(); drawPeds(); drawPolice(); drawPlayer();
    ctx.restore(); drawMinimap(); drawHUD();
  }
  const G = (globalThis.G = globalThis.G || {});
  G.api = { state, enterCar, exitCar, start, save, load };
  load();
  let last = performance.now();
  function frame(now) {
    const dt = clamp((now - last) / 1000, 0, 0.05); last = now;
    if (state.started) {
      state.time += dt; update(dt);
      const api = S(); if (api && api.update) api.update(dt);
    }
    draw(); requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // Simpan progres otomatis tiap 10 detik agar progres tidak hilang.
  setInterval(save, 10000);
})();