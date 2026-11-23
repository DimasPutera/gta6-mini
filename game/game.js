// game/game.js — GTA 6 Mini: gerak pemain, curi mobil, HUD, simpan otomatis, loop.
// S (systems.js) dan D (draw.js) sudah global — dipakai langsung, jangan dideklarasi ulang.
(() => {
  'use strict';
  const WORLD = 1280;
  const WALK_SPEED = 150;
  const CAR_SPEED = 320;
  const SAVE_KEY = 'gta6mini-save';
  const SAVE_MS = 10000;
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');
  const mm = document.getElementById('minimap');
  const mmx = mm ? mm.getContext('2d') : null;
  const elSpeed = document.getElementById('speed');
  const elTime = document.getElementById('time');
  const elMoney = document.getElementById('money');
  const elWanted = document.getElementById('wanted');
  const btnStart = document.getElementById('start');
  const G = (window.G = window.G || {});
  const state = {
    player: { x: 640, y: 640, angle: 0, speed: 0, inCar: false, money: 0, stoleCar: false },
    time: 0,
    started: false
  };
  G.api = { state };
  const keys = {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function fmtTime(t) {
    const m = String(Math.floor(t / 60)).padStart(2, '0');
    const s = String(Math.floor(t % 60)).padStart(2, '0');
    return m + ':' + s;
  }
  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ player: state.player, time: state.time }));
    } catch (e) {}
  }
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!d || !d.player) return false;
      const p = state.player;
      p.x = clamp(+d.player.x || 640, 0, WORLD);
      p.y = clamp(+d.player.y || 640, 0, WORLD);
      p.angle = +d.player.angle || 0;
      p.speed = 0;
      p.inCar = false;
      p.money = +d.player.money || 0;
      p.stoleCar = !!d.player.stoleCar;
      state.time = +d.time || 0;
      return true;
    } catch (e) {
      return false;
    }
  }
  function start() {
    state.started = true;
    if (btnStart) btnStart.textContent = 'Bermain…';
  }
  function enterCar() {
    if (!S.api || !S.api.stealCar) return;
    if (S.api.stealCar()) {
      state.player.inCar = true;
      state.player.stoleCar = true;
    }
  }
  function exitCar() {
    state.player.inCar = false;
  }
  function toggleCar() {
    if (state.player.inCar) exitCar();
    else enterCar();
  }
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    keys[k] = true;
    if (k === 'arrowup' || k === 'arrowdown' || k === 'arrowleft' || k === 'arrowright' || k === ' ') {
      e.preventDefault();
    }
    if ((e.key === 'e' || e.key === 'E') && !e.repeat && state.started) toggleCar();
  });
  window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
  });
  if (btnStart) btnStart.addEventListener('click', start);
  function update(dt) {
    const p = state.player;
    let dx = 0;
    let dy = 0;
    if (keys['w'] || keys['arrowup']) dy -= 1;
    if (keys['s'] || keys['arrowdown']) dy += 1;
    if (keys['a'] || keys['arrowleft']) dx -= 1;
    if (keys['d'] || keys['arrowright']) dx += 1;
    const len = Math.hypot(dx, dy);
    const speed = p.inCar ? CAR_SPEED : WALK_SPEED;
    if (len > 0) {
      dx /= len;
      dy /= len;
      p.angle = Math.atan2(dy, dx);
      p.speed = speed;
      p.x = clamp(p.x + dx * speed * dt, 12, WORLD - 12);
      p.y = clamp(p.y + dy * speed * dt, 12, WORLD - 12);
    } else {
      p.speed = 0;
    }
  }
  function drawHUD() {
    if (elSpeed) elSpeed.textContent = String(Math.round(state.player.speed));
    if (elTime) elTime.textContent = fmtTime(state.time);
    if (elMoney) elMoney.textContent = String(state.player.money);
    if (elWanted) elWanted.textContent = String((S.api && S.api.wanted) || 0);
  }
  load();
  let last = performance.now();
  function frame(now) {
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    if (state.started) {
      state.time += dt;
      update(dt);
      if (S.api && S.api.update) S.api.update(dt);
    }
    if (D.api && D.api.draw) D.api.draw(ctx, state, mmx);
    drawHUD();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  setInterval(save, SAVE_MS);
})();
