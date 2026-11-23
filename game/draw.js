// game/draw.js — renderer kota: tanah, jalan, bangunan, lalu lintas, misi, kamera, minimap.
const D = globalThis.D = { api: {} };
const DRAW_ROADS = [128, 384, 640, 896, 1152];
const DRAW_ROAD_W = 96;
const DRAW_WORLD = 1280;
const DRAW_HALF = DRAW_ROAD_W / 2;
function clampNum(v, a, b) { return v < a ? a : v > b ? b : v; }
function dot(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
function box(c, x, y, w, h) { c.fillRect(x - w / 2, y - h / 2, w, h); }
function car(c, v, body, glass) {
  const w = v.dy === 0 ? 34 : 18, h = v.dy === 0 ? 18 : 34;
  c.fillStyle = body; box(c, v.x, v.y, w, h);
  c.fillStyle = glass; box(c, v.x, v.y, w - 10, h - 8);
}
function roads(c) {
  c.fillStyle = '#2c313a';
  for (const r of DRAW_ROADS) { c.fillRect(r - DRAW_HALF, 0, DRAW_ROAD_W, DRAW_WORLD); c.fillRect(0, r - DRAW_HALF, DRAW_WORLD, DRAW_ROAD_W); }
  c.strokeStyle = '#f5c518'; c.lineWidth = 3; c.setLineDash([18, 16]); c.beginPath();
  for (const r of DRAW_ROADS) { c.moveTo(r, 0); c.lineTo(r, DRAW_WORLD); c.moveTo(0, r); c.lineTo(DRAW_WORLD, r); }
  c.stroke(); c.setLineDash([]);
}
function blocks(c) {
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
    const x0 = i === 0 ? 0 : DRAW_ROADS[i - 1] + DRAW_HALF, x1 = i === 5 ? DRAW_WORLD : DRAW_ROADS[i] - DRAW_HALF;
    const y0 = j === 0 ? 0 : DRAW_ROADS[j - 1] + DRAW_HALF, y1 = j === 5 ? DRAW_WORLD : DRAW_ROADS[j] - DRAW_HALF;
    c.fillStyle = (i + j) % 2 ? '#3d5a80' : '#6b5d4f';
    c.fillRect(x0 + 8, y0 + 8, x1 - x0 - 16, y1 - y0 - 16);
  }
}
function missionDot(c, t) {
  c.fillStyle = 'rgba(34,197,94,0.25)'; dot(c, t.x, t.y, 26);
  c.strokeStyle = '#22c55e'; c.lineWidth = 3; c.beginPath(); c.arc(t.x, t.y, 18, 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#22c55e'; dot(c, t.x, t.y, 6);
}
function missions(c, list, single) {
  for (const m of list || []) {
    if (m.done) continue;
    const t = m.stage === 'drop' ? m.drop : m.pickup;
    if (t) missionDot(c, t);
  }
  if (single) missionDot(c, single);
}
function traffic(c, list) {
  const colors = ['#c0392b', '#d8dee9', '#e67e22', '#7f8c8d'];
  (list || []).forEach((v, i) => car(c, v, v.color || colors[i % colors.length], '#1c2733'));
}
function police(c, list) {
  for (const v of list || []) {
    c.fillStyle = '#2563eb'; c.fillRect(v.x - 11, v.y - 11, 22, 22);
    c.fillStyle = '#f8fafc'; c.fillRect(v.x - 6, v.y - 6, 12, 12);
    c.fillStyle = '#2563eb'; c.fillRect(v.x - 3, v.y - 3, 6, 6);
  }
}
function peds(c, list) { c.fillStyle = '#ffd93b'; for (const v of list || []) dot(c, v.x, v.y, 3); }
function drawMini(m, api, p) {
  if (!m) return;
  const s = 200 / DRAW_WORLD;
  m.fillStyle = '#10131a'; m.fillRect(0, 0, 200, 200);
  m.fillStyle = '#374151';
  for (const r of DRAW_ROADS) { m.fillRect(r * s - DRAW_HALF * s, 0, DRAW_ROAD_W * s, 200); m.fillRect(0, r * s - DRAW_HALF * s, 200, DRAW_ROAD_W * s); }
  m.fillStyle = '#22c55e';
  for (const mi of api.missions || []) {
    if (mi.done) continue;
    const t = mi.stage === 'drop' ? mi.drop : mi.pickup;
    if (t) dot(m, t.x * s, t.y * s, 3);
  }
  if (api.mission) dot(m, api.mission.x * s, api.mission.y * s, 3);
  m.fillStyle = '#d8dee9';
  for (const v of api.traffic || []) m.fillRect(v.x * s - 1, v.y * s - 1, 2, 2);
  m.fillStyle = '#ffd93b';
  for (const v of api.peds || []) m.fillRect(v.x * s - 1, v.y * s - 1, 2, 2);
  m.fillStyle = '#2563eb';
  for (const v of api.police || []) m.fillRect(v.x * s - 2, v.y * s - 2, 4, 4);
  m.fillStyle = '#f8fafc'; dot(m, p.x * s, p.y * s, 3);
  m.fillStyle = '#ef4444'; dot(m, p.x * s, p.y * s, 2);
}
D.api.draw = function (ctx, state, minimapCtx) {
  const api = (globalThis.S && globalThis.S.api) || (state && state.api) || {};
  const st = (globalThis.G && globalThis.G.api && globalThis.G.api.state) || state || {};
  const p = st.player || { x: 640, y: 640 };
  const vw = ctx.canvas.width, vh = ctx.canvas.height;
  const camX = clampNum(p.x - vw / 2, 0, DRAW_WORLD - vw);
  const camY = clampNum(p.y - vh / 2, 0, DRAW_WORLD - vh);
  ctx.save(); ctx.translate(-camX, -camY);
  ctx.fillStyle = '#161a20'; ctx.fillRect(0, 0, DRAW_WORLD, DRAW_WORLD);
  blocks(ctx); roads(ctx); missions(ctx, api.missions, api.mission || st.mission);
  traffic(ctx, api.traffic); police(ctx, api.police); peds(ctx, api.peds);
  ctx.fillStyle = '#f8fafc'; dot(ctx, p.x, p.y, 12);
  ctx.fillStyle = '#ef4444'; dot(ctx, p.x, p.y, 4);
  ctx.restore();
  drawMini(minimapCtx, api, p);
  if (minimapCtx) {
    const s = 200 / DRAW_WORLD;
    minimapCtx.strokeStyle = 'rgba(255,255,255,0.85)'; minimapCtx.lineWidth = 1;
    minimapCtx.strokeRect(camX * s, camY * s, vw * s, vh * s);
  }
};
