// systems.js — sistem tambahan game kota 2D (dimuat setelah game.js).
// State: window.G.api.state { x, y, inCar, car, money, dest, hasPkg }.
// Kamera sama seperti game.js; loop rAF sendiri di canvas #game.
(function () {
  'use strict';
  var cv = document.getElementById('game');
  if (!cv) return;
  var ctx = cv.getContext('2d');
  var WORLD = 1152, ROAD_W = 56, GRID = 192;
  var wantedEl = document.getElementById('wanted');
  var missionEl = document.getElementById('mission');
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function state() { return (window.G && window.G.api && window.G.api.state) || {}; }
  function camera() {
    var s = state();
    return {
      x: clamp((s.x || 0) - cv.width / 2, 0, WORLD - cv.width),
      y: clamp((s.y || 0) - cv.height / 2, 0, WORLD - cv.height)
    };
  }
  function onRoad(v) {
    var m = ((v % GRID) + GRID) % GRID;
    return m < ROAD_W || m > GRID - ROAD_W;
  }
  function nearCross(x, y) { return onRoad(x) && onRoad(y); }
  function roadCoord() {
    var i = Math.floor(rnd(0, WORLD / GRID));
    return i * GRID + rnd(8, ROAD_W - 8);
  }
  function sideCoord() {
    var i = Math.floor(rnd(0, WORLD / GRID));
    return i * GRID + ROAD_W + rnd(6, 26);
  }
  var CAR_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22'];
  var DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // kanan, bawah, kiri, atas
  var cars = [];
  function spawnCar(i) {
    var horiz = Math.random() < 0.5;
    var d = horiz ? (Math.random() < 0.5 ? 0 : 2) : (Math.random() < 0.5 ? 1 : 3);
    return {
      x: horiz ? rnd(0, WORLD) : roadCoord(),
      y: horiz ? roadCoord() : rnd(0, WORLD),
      dir: d, speed: rnd(55, 95), color: CAR_COLORS[i % CAR_COLORS.length]
    };
  }
  for (var i = 0; i < 8; i++) cars.push(spawnCar(i)); // lalu lintas lebih ramai
  function turnAtCross(c) {
    if (!nearCross(c.x, c.y)) return;
    if (Math.random() > 0.35) return; // 35% belok, sisanya lurus
    var left = (c.dir + 3) % 4, right = (c.dir + 1) % 4;
    c.dir = Math.random() < 0.5 ? left : right;
    // Ratakan ke tengah jalan setelah belok.
    c.x = Math.round(c.x / GRID) * GRID + ROAD_W / 2;
    c.y = Math.round(c.y / GRID) * GRID + ROAD_W / 2;
  }
  function moveCar(c, dt) {
    var d = DIRS[c.dir];
    c.x += d[0] * c.speed * dt;
    c.y += d[1] * c.speed * dt;
    if (c.x < -30) { c.x = WORLD + 20; c.y = roadCoord(); }
    if (c.x > WORLD + 30) { c.x = -20; c.y = roadCoord(); }
    if (c.y < -30) { c.y = WORLD + 20; c.x = roadCoord(); }
    if (c.y > WORLD + 30) { c.y = -20; c.x = roadCoord(); }
    turnAtCross(c);
  }
  var PED_COLORS = ['#ff8fa3', '#7fb3ff', '#ffd166', '#90e0a0', '#d0a2ff', '#ffb08a'];
  var peds = [];
  for (var j = 0; j < 8; j++) {
    peds.push({
      x: Math.random() < 0.5 ? sideCoord() : rnd(0, WORLD),
      y: Math.random() < 0.5 ? rnd(0, WORLD) : sideCoord(),
      dir: Math.floor(rnd(0, 4)), speed: rnd(18, 32),
      color: PED_COLORS[j % PED_COLORS.length]
    });
  }
  function movePed(p, dt) {
    var d = DIRS[p.dir];
    p.x += d[0] * p.speed * dt;
    p.y += d[1] * p.speed * dt;
    if (p.x < 10 || p.x > WORLD - 10 || p.y < 10 || p.y > WORLD - 10) {
      p.dir = (p.dir + 2) % 4; // putar balik di tepi dunia
    } else if (nearCross(p.x, p.y) && Math.random() < 0.02) {
      p.dir = Math.floor(rnd(0, 4)); // kadang belok di persimpangan
    }
  }
  var wanted = 0, lastIncident = 0, lastHitAt = 0;
  function setWanted(v) {
    wanted = clamp(v, 0, 5);
    lastIncident = performance.now();
    if (wantedEl) wantedEl.textContent = 'Wanted: ' + wanted + '/5';
  }
  function tickWanted(now) {
    if (wanted > 0 && now - lastIncident >= 20000) setWanted(wanted - 1);
  }
  var patrol = { x: 600, y: 100, speed: 130, active: false };
  function updatePatrol(s, dt, now) {
    patrol.active = wanted > 0;
    if (!patrol.active) return;
    var dx = (s.x || 0) - patrol.x, dy = (s.y || 0) - patrol.y;
    var d = Math.hypot(dx, dy) || 1;
    patrol.x += (dx / d) * patrol.speed * dt;
    patrol.y += (dy / d) * patrol.speed * dt;
    if (d < 26 && now - lastHitAt > 1000) {
      lastHitAt = now;
      if (typeof s.money === 'number') s.money = Math.max(0, s.money - 500);
      setWanted(0);
      patrol.x = clamp((s.x || 0) + 300, 0, WORLD);
      patrol.y = clamp((s.y || 0) - 300, 0, WORLD);
    }
  }
  // ---- Tabrakan pemain: +1 wanted (cooldown 1 detik) ----
  function checkHits(s, now) {
    if (now - lastHitAt < 1000) return;
    var r = s.inCar ? 20 : 14, hit = false;
    for (var a = 0; a < cars.length; a++) {
      if (dist(s.x, s.y, cars[a].x, cars[a].y) < r + 14) { hit = true; break; }
    }
    if (!hit) for (var b = 0; b < peds.length; b++) {
      if (dist(s.x, s.y, peds[b].x, peds[b].y) < r + 8) { hit = true; break; }
    }
    if (hit) { lastHitAt = now; setWanted(wanted + 1); }
  }
  // ---- Audio: bip WebAudio saat paket terantar ----
  var actx = null, prevHasPkg = false;
  function beep(freq, dur) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = freq || 880;
      g.gain.setValueAtTime(0.15, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + (dur || 0.18));
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + (dur || 0.18));
    } catch (e) { /* audio tidak tersedia, abaikan */ }
  }
  function tickAudio(s) {
    if (prevHasPkg && !s.hasPkg) { beep(880, 0.15); setTimeout(function () { beep(1320, 0.25); }, 160); }
    prevHasPkg = !!s.hasPkg;
  }
  function tickMission(s) {
    if (!missionEl) return;
    if (s.hasPkg && s.dest) {
      missionEl.textContent = 'Misi: antar paket ke (' + Math.round(s.dest.x) + ', ' + Math.round(s.dest.y) + ')';
    } else if (s.hasPkg) {
      missionEl.textContent = 'Misi: antar paket ke tujuan';
    } else {
      missionEl.textContent = 'Misi: ambil paket';
    }
  }
  function drawCar(c, cam) {
    var horiz = c.dir === 0 || c.dir === 2;
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x - cam.x - (horiz ? 16 : 9), c.y - cam.y - (horiz ? 9 : 16),
      horiz ? 32 : 18, horiz ? 18 : 32);
  }
  function draw() {
    var cam = camera();
    for (var a = 0; a < cars.length; a++) drawCar(cars[a], cam);
    for (var b = 0; b < peds.length; b++) {
      ctx.fillStyle = peds[b].color;
      ctx.beginPath();
      ctx.arc(peds[b].x - cam.x, peds[b].y - cam.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    if (patrol.active) {
      ctx.fillStyle = '#111';
      ctx.fillRect(patrol.x - cam.x - 16, patrol.y - cam.y - 9, 32, 18);
      ctx.fillStyle = '#fff';
      ctx.fillRect(patrol.x - cam.x - 16, patrol.y - cam.y - 9, 32, 5);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(patrol.x - cam.x - 4, patrol.y - cam.y - 9, 8, 5);
    }
  }
  var last = performance.now();
  function frame(now) {
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    var s = state();
    for (var a = 0; a < cars.length; a++) moveCar(cars[a], dt);
    for (var b = 0; b < peds.length; b++) movePed(peds[b], dt);
    checkHits(s, now);
    tickWanted(now);
    updatePatrol(s, dt, now);
    tickAudio(s);
    tickMission(s);
    draw();
    requestAnimationFrame(frame);
  }
  setWanted(0);
  requestAnimationFrame(frame);
  window.G = window.G || {};
  window.G.systems = {
    cars: cars, peds: peds, patrol: patrol,
    get wanted() { return wanted; },
    setWanted: setWanted, beep: beep, camera: camera
  };
})();
