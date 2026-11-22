// game.js — game kota 2D top-down (canvas #game)
(() => {
  'use strict';
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');
  const mm = document.getElementById('minimap');
  const mmx = mm ? mm.getContext('2d') : null;
  const elSpeed = document.getElementById('speed');
  const elTime = document.getElementById('time');
  const elMoney = document.getElementById('money');
  const btnStart = document.getElementById('start');
  const TILE = 48, COLS = 24, ROWS = 18;
  const W = COLS * TILE, H = ROWS * TILE;
  const SAVE_KEY = 'cityGameSaveV1';
  const ROAD = 0, WALK = 1, BUILD = 2;
  const grid = [];
  for (let y = 0; y < ROWS; y++) {
    const row = [];
    for (let x = 0; x < COLS; x++) {
      if (x % 4 === 0 || y % 4 === 0) row.push(ROAD);
      else if (x % 4 === 1 || y % 4 === 1) row.push(WALK);
      else row.push(BUILD);
    }
    grid.push(row);
  }
  const buildings = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x] === BUILD) {
        buildings.push({ x: x * TILE, y: y * TILE, w: TILE, h: TILE,
          c: ['#7a8a99', '#8a7a6a', '#6a7a8a', '#9a8a7a'][(x + y) % 4] });
      }
    }
  }
  function roadTiles() {
    const out = [];
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++)
        if (grid[y][x] === ROAD) out.push({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 });
    return out;
  }
  function randRoad(exclude) {
    const roads = roadTiles().filter(p => !exclude || Math.hypot(p.x - exclude.x, p.y - exclude.y) > 300);
    return roads[Math.floor(Math.random() * roads.length)];
  }
  function freshState() {
    const spawn = { x: TILE * 2 + 24, y: TILE * 2 + 24 };
    const dest = randRoad(spawn);
    return { started: false, x: spawn.x, y: spawn.y, angle: 0, speed: 0,
      inCar: false, money: 0, minutes: 8 * 60, hasPkg: true,
      pkg: { x: spawn.x, y: spawn.y }, dest,
      car: { x: TILE * 4 + 24, y: TILE * 2 + 24, angle: 0 } };
  }
  let state = freshState();
  const saved = load();
  if (saved) state = Object.assign(freshState(), saved);
  const keys = {};
  addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true;
    if (e.key.toLowerCase() === 'e') toggleCar(); });
  addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  function hitsBuilding(x, y, r) {
    for (const b of buildings) {
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
    }
    return false;
  }
  function moveEntity(e, dx, dy, r) {
    const nx = e.x + dx, ny = e.y + dy;
    if (!hitsBuilding(nx, e.y, r)) e.x = nx;
    if (!hitsBuilding(e.x, ny, r)) e.y = ny;
    e.x = Math.max(r, Math.min(W - r, e.x));
    e.y = Math.max(r, Math.min(H - r, e.y));
  }
  function toggleCar() {
    if (!state.started) return;
    if (state.inCar) exitCar(); else enterCar();
  }
  function enterCar() {
    if (state.inCar) return false;
    if (Math.hypot(state.x - state.car.x, state.y - state.car.y) > 70) return false;
    state.inCar = true; return true;
  }
  function exitCar() {
    if (!state.inCar) return false;
    state.inCar = false;
    state.x = state.car.x + 40; state.y = state.car.y;
    if (hitsBuilding(state.x, state.y, 12)) { state.x = state.car.x - 40; }
    return true;
  }
  function newDelivery() {
    state.pkg = { x: state.x, y: state.y };
    state.dest = randRoad(state.pkg);
    state.hasPkg = true;
  }
  function update(dt) {
    if (!state.started) return;
    state.minutes += dt * 2;
    let dx = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
    let dy = (keys.s ? 1 : 0) - (keys.w ? 1 : 0);
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const spd = state.inCar ? 260 : 120; // jalan kaki sedikit lebih cepat
    const vx = dx * spd, vy = dy * spd;
    const target = state.inCar ? state.car : state;
    const ox = target.x, oy = target.y;
    moveEntity(target, vx * dt, vy * dt, state.inCar ? 16 : 12);
    if (state.inCar) { state.x = state.car.x; state.y = state.car.y; }
    state.speed = Math.hypot(target.x - ox, target.y - oy) / Math.max(dt, 0.001);
    if (dx || dy) state.angle = Math.atan2(dy, dx);
    if (state.inCar) state.car.angle = state.angle;
    if (state.hasPkg && Math.hypot(state.x - state.dest.x, state.y - state.dest.y) < 36) {
      state.money += 15000;
      state.hasPkg = false;
      setTimeout(newDelivery, 800);
      save();
    }
  }
  function draw() {
    const camX = Math.max(0, Math.min(W - cv.width, state.x - cv.width / 2));
    const camY = Math.max(0, Math.min(H - cv.height, state.y - cv.height / 2));
    ctx.fillStyle = '#2b2f33'; ctx.fillRect(0, 0, cv.width, cv.height);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const px = x * TILE - camX, py = y * TILE - camY;
        if (px < -TILE || py < -TILE || px > cv.width || py > cv.height) continue;
        if (grid[y][x] === ROAD) ctx.fillStyle = '#3a3f45';
        else if (grid[y][x] === WALK) ctx.fillStyle = '#9aa0a6';
        else ctx.fillStyle = '#22262a';
        ctx.fillRect(px, py, TILE, TILE);
        if (grid[y][x] === ROAD) {
          ctx.strokeStyle = '#f5c542'; ctx.setLineDash([10, 12]);
          ctx.beginPath();
          if (y % 4 === 0) { ctx.moveTo(px, py + TILE / 2); ctx.lineTo(px + TILE, py + TILE / 2); }
          if (x % 4 === 0) { ctx.moveTo(px + TILE / 2, py); ctx.lineTo(px + TILE / 2, py + TILE); }
          ctx.stroke(); ctx.setLineDash([]);
        }
      }
    }
    for (const b of buildings) {
      ctx.fillStyle = b.c;
      ctx.fillRect(b.x - camX + 3, b.y - camY + 3, b.w - 6, b.h - 6);
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.fillRect(b.x - camX + 9, b.y - camY + 9, 10, 8);
      ctx.fillRect(b.x - camX + 26, b.y - camY + 9, 10, 8);
    }
    const dx = state.dest.x - camX, dy = state.dest.y - camY;
    ctx.fillStyle = state.hasPkg ? '#ff5a5a' : '#5aff8a';
    ctx.beginPath(); ctx.arc(dx, dy, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif';
    ctx.fillText('◉', dx - 6, dy + 4);
    ctx.save();
    ctx.translate(state.car.x - camX, state.car.y - camY);
    ctx.rotate(state.car.angle);
    ctx.fillStyle = state.inCar ? '#2fa8ff' : '#ff8c2f';
    ctx.fillRect(-18, -10, 36, 20);
    ctx.fillStyle = '#123'; ctx.fillRect(-6, -8, 14, 16);
    ctx.restore();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(state.x - camX, state.y - camY, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(state.x - camX, state.y - camY, 4, 0, Math.PI * 2); ctx.fill();
    drawMinimap();
    updateHUD();
  }
  function drawMinimap() {
    if (!mmx) return;
    const sx = mm.width / W, sy = mm.height / H;
    mmx.fillStyle = '#222'; mmx.fillRect(0, 0, mm.width, mm.height);
    for (const b of buildings) mmx.fillStyle = b.c, mmx.fillRect(b.x * sx, b.y * sy, b.w * sx, b.h * sy);
    mmx.fillStyle = '#ff5a5a'; mmx.fillRect(state.dest.x * sx - 2, state.dest.y * sy - 2, 4, 4);
    mmx.fillStyle = '#ff8c2f'; mmx.fillRect(state.car.x * sx - 2, state.car.y * sy - 2, 4, 4);
    mmx.fillStyle = '#ffd23f'; mmx.beginPath();
    mmx.arc(state.x * sx, state.y * sy, 3, 0, Math.PI * 2); mmx.fill();
  }
  function updateHUD() {
    const kmh = Math.round((state.speed || 0) * 0.09);
    if (elSpeed) elSpeed.textContent = kmh + ' km/jam';
    const hh = String(Math.floor(state.minutes / 60) % 24).padStart(2, '0');
    const mi = String(Math.floor(state.minutes) % 60).padStart(2, '0');
    if (elTime) elTime.textContent = hh + ':' + mi;
    if (elMoney) elMoney.textContent = 'Rp' + state.money.toLocaleString('id-ID');
  }
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); return true; }
    catch (e) { return false; }
  }
  function load() {
    try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }
  function start() {
    state.started = true;
    if (btnStart) btnStart.disabled = true;
    save();
  }
  if (btnStart) btnStart.addEventListener('click', start);
  addEventListener('beforeunload', save);
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  window.G = window.G || {};
  window.G.api = { state, enterCar, exitCar, start, save, load };
})();
