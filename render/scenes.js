/*
 * scenes.js — 《逆光》MV 54 个镜头的场景定义（p5.brush 蜡笔笔刷）
 * 每个镜头：
 *   cam  镜头关键帧 [[u, z, cx, cy], ...]，u∈[0,1] 为镜头内进度；z 为推近倍数，(cx,cy) 为画面中心在“世界”中的位置（0–1）
 *   bg() 本镜头内静止的背景笔触（由引擎按当前视角绘制、在视角变化不大时复用）
 *   dyn(u, t) 角色、道具与会动的元素（每张作画都重画）
 * 所有坐标都写在“世界”里（1920×1080，z=1 时即画面），绘制时统一经过当前视角 VIEW 映射：
 * 背景、角色、道具在同一块画布里按同一视角画出，镜头推拉时同步运动。
 * 角色一律经由 character.js（Crab.draw / Crab.drawProp）。
 */
const W = 1920, H = 1080;
const VIEW = { z: 1, x: 0.5, y: 0.5 };
const MX = x => (x - VIEW.x * W) * VIEW.z + W / 2, MY = y => (y - VIEW.y * H) * VIEW.z + H / 2;
const M = p => [MX(p[0]), MY(p[1])];
const ZZ = v => v * VIEW.z;

// ───────── 基础工具（世界坐标，像素）─────────
const R = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const E = (cx, cy, rx, ry, n = 36) => Array.from({ length: n }, (_, i) => [cx + Math.cos(i / n * Math.PI * 2) * rx, cy + Math.sin(i / n * Math.PI * 2) * ry]);
const lerp = (a, b, k) => a + (b - a) * k, clamp01 = v => Math.max(0, Math.min(1, v));
const ease = k => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(k));
const seg = (u, a, b) => clamp01((u - a) / (b - a));
function hatch(pts, col, { dist = 6, angle = 45, cross = null, w = 1, kind = 'cpencil', rand = 0.12, cont = true } = {}) {
  brush.noStroke(); brush.noFill(); brush.setHatch(kind, col, w);
  const P = pts.map(M);
  brush.hatch(dist, angle, { rand, continuous: cont, gradient: 0 }); brush.polygon(P);
  if (cross !== null) { brush.hatch(dist * 1.3, cross, { rand, continuous: cont, gradient: 0 }); brush.polygon(P); }
  brush.noHatch();
}
function ln(pts, col, w = 1, kind = '2B') {   // 不能叫 line：会覆盖 p5 全局函数（p5.brush 会调用）
  brush.noHatch(); brush.set(kind, col, w);
  for (let i = 0; i < pts.length - 1; i++) { const a = M(pts[i]), b = M(pts[i + 1]); brush.line(a[0], a[1], b[0], b[1]); }
  brush.noStroke();
}
const lp = (pts, col, w, kind) => ln(pts.concat([pts[0]]), col, w, kind);
function ring(x, y, r, col, w = 1, kind = 'cpencil') { brush.noHatch(); brush.set(kind, col, w); brush.circle(MX(x), MY(y), ZZ(r), true); brush.noStroke(); }
const PX = xp => xp / 100 * W, PY = yp => yp / 100 * H;
const FACE = { 正: 'front', 背: 'back', 侧右: 'right', 侧左: 'left' };
function crab(face, hp, xp, yp, o = {}) {   // 构图记法：朝向·高度%·(x%,y%)，均为世界坐标
  const size = hp / 100 * H / 176 * (o.sit ? 1.15 : 1);
  const opt = Object.assign({}, o, { x: MX(PX(xp)), y: MY(PY(yp) + 89 * size), size: ZZ(size), facing: FACE[face] });
  if (o.clip) opt.clip = [MX(o.clip[0]), MY(o.clip[1]), MX(o.clip[2]), MY(o.clip[3])];
  Crab.draw(opt);
  return size;
}
function prop(name, xp, yp, size) { Crab.drawProp(name, MX(PX(xp)), MY(PY(yp)), ZZ(size)); }
function glow(xp, yp, r, g = 1) { if (g <= 0.02) return; const x = PX(xp), y = PY(yp); hatch(E(x, y, r * (0.7 + 0.5 * g), r * (0.7 + 0.5 * g)), '#ffd98a', { dist: 6, angle: 60, w: 0.8 }); if (g > 0.4) hatch(E(x, y, r * 0.62 * g, r * 0.62 * g), '#fff0c0', { dist: 4, angle: 120, w: 0.8 }); }
function lantern(xp, yp, size, g = 1) { glow(xp, yp, 46 * size, g); prop(g > 0.05 ? 'lantern' : 'lantern_off', xp, yp, size); }
function flame(xp, yp, size, bend = 0) {   // 提灯里的火苗（可被风压弯）
  const x = PX(xp) + 2 * size, y = PY(yp) + 6 * size, h = 13 * size, b = bend * 9 * size;
  const f = [[x - 5 * size, y], [x - 3 * size, y - h * 0.5], [x + b, y - h], [x + 3 * size, y - h * 0.5], [x + 5 * size, y]];
  hatch(f, '#ffb04a', { dist: 2, angle: 70, w: 0.9 }); hatch(f.map(([px, py]) => [x + (px - x) * 0.5, y + (py - y) * 0.6]), '#fff2c4', { dist: 1.6, angle: 20, w: 0.8 });
}
function motion(pts, col = '#9fb6e0') { ln(pts, col, 0.6, 'HB'); }
function waveCrest(cx, base, w, h, dir = 1) {   // 一道卷起的浪：稀疏排线 + 白色浪尖（不把角色整个盖住）
  const pts = []; for (let i = 0; i <= 24; i++) { const k = i / 24, x = cx + (k - 0.5) * w * dir; pts.push([x, base - h * Math.sin(Math.PI * Math.pow(k, 0.8)) * (k < 0.85 ? 1 : (1 - k) / 0.15 * 0.8 + 0.2)]); }
  const poly = pts.concat([[cx + 0.5 * w * dir, base], [cx - 0.5 * w * dir, base]]);
  hatch(poly, '#c9d8ee', { dist: 9, angle: 20, w: 0.8, rand: 0.25 }); ln(pts, '#ffffff', 1.4, 'cpencil');
  for (let i = 0; i < 8; i++) { const p = pts[16 + (i % 8)]; ring(p[0] + 20 * dir, p[1] - 14 - i * 6, 6, '#ffffff', 0.7, 'cpencil'); }
}

// ───────── 场景积木 ─────────
const NIGHT = { wall: '#26306a', floor: '#4a3a55', seam: '#2b2133' };
const DARK = { wall: '#1f2658', floor: '#3e3248', seam: '#241c2c' };
const DAY = { wall: '#7a4a6e', floor: '#8a5a52', seam: '#5a3a40' };
const SUNNY = { wall: '#8a5a6e', floor: '#a0705a', seam: '#6a4a40' };
function room(p = NIGHT, floorY = 780) {
  hatch(R(-40, -40, W + 80, floorY + 40), p.wall, { dist: 6, angle: 30, cross: 120, w: 1.1 });
  hatch(R(-40, floorY, W + 80, H - floorY + 40), p.floor, { dist: 6, angle: -15, cross: 80, w: 1.1 });
  for (const y of [floorY + 50, floorY + 120, floorY + 210]) ln([[-40, y], [W + 40, y - 6]], p.seam, 0.8);
}
function warmGlow(x, y, rx, ry) { hatch(E(x, y, rx, ry), '#d9784e', { dist: 7, angle: 70, w: 1 }); hatch(E(x, y, rx * 0.62, ry * 0.62), '#f4b456', { dist: 6, angle: 100, w: 1 }); }
function nightSky(x, y, w, h, stars = 14, seed = 1) {
  hatch(R(x, y, w, h), '#1f2758', { dist: 5, angle: 100, cross: 10, w: 1 });
  let s = seed * 9301; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < stars; i++) { const sx = x + rnd() * w, sy = y + rnd() * h * 0.7; ln([[sx - 6, sy], [sx + 6, sy]], '#f6eecf', 0.7, 'cpencil'); ln([[sx, sy - 6], [sx, sy + 6]], '#f6eecf', 0.7, 'cpencil'); }
}
function sunriseSky(x, y, w, h) { for (const [c, a, b] of [['#56609f', 0, 0.3], ['#c8707a', 0.25, 0.28], ['#ef9450', 0.48, 0.25], ['#ffd27a', 0.7, 0.3]]) hatch(R(x, y + h * a, w, h * b), c, { dist: 5, angle: 95, cross: 15, w: 1 }); }
function dawnSky(y2 = 500) { hatch(R(-40, -40, W + 80, 340), '#3b3a7a', { dist: 5, angle: 100 }); hatch(R(-40, 300, W + 80, y2 - 300), '#7a4f8a', { dist: 5, angle: 95 }); }
function sea(y, col = '#24305e', y2 = H + 40) { hatch(R(-40, y, W + 80, y2 - y), col, { dist: 6, angle: 0, cross: 170, w: 1 }); for (let k = 0; k < 6; k++) ln([[-40, y + 30 + k * 40], [W + 40, y + 26 + k * 40]], '#5d6fb0', 0.5, 'HB'); }
function sand(y, col = '#4e4258') { hatch(R(-40, y, W + 80, H - y + 40), col, { dist: 6, angle: -20, cross: 60, w: 1.1 }); }
function sun(x, y, r) { hatch(E(x, y, r * 2, r * 2), '#ffd98a', { dist: 6, angle: 70, w: 0.9 }); hatch(E(x, y, r, r), '#fff2c4', { dist: 3, angle: 30, cross: 120, w: 1.1 }); ring(x, y, r, '#f6a84a', 1.2); }
function door(x, y, w, h, { open = 0, inside = '#1f2758', glowIn = 0, stars = 0 } = {}) {
  if (open > 0.02) {
    hatch(R(x, y, w, h), inside, { dist: 5, angle: 90, cross: 0, w: 1 });
    if (stars) nightSky(x, y, w, h * 0.6, stars, 2);
    if (glowIn > 0) hatch(E(x + w / 2, y + h * 0.7, w * 0.6 * glowIn + 10, h * 0.35 * glowIn + 10), '#ffd98a', { dist: 4, angle: 70, w: 0.9 });
    const px = x + w, d = w * 0.38 * open; const pane = [[px, y], [px + d, y - 30 * open], [px + d, y + h + 30 * open], [px, y + h]];
    hatch(pane, '#5a3f45', { dist: 5, angle: 85 }); lp(pane, '#151833', 1.2, 'charcoal');
  } else { hatch(R(x, y, w, h), '#5a3f45', { dist: 5, angle: 85, w: 1 }); hatch(E(x + w * 0.85, y + h * 0.5, 10, 10, 12), '#c9a070', { dist: 2, angle: 30 }); }
  lp(R(x, y, w, h), '#151833', 2, 'charcoal');
}
function windowFrame(x, y, w, h, sky = 'night', open = 0, sunPos = 0.78) {
  if (sky === 'night') nightSky(x, y, w, h, 8, 3); else if (sky === 'dark') hatch(R(x, y, w, h), '#141a3c', { dist: 4, angle: 90, cross: 0, w: 1.1 });
  else { sunriseSky(x, y, w, h); sun(x + w * 0.6, y + h * sunPos, Math.min(w, h) * 0.09); }
  lp(R(x, y, w, h), '#151833', 2.2, 'charcoal'); ln([[x + w / 2, y], [x + w / 2, y + h]], '#151833', 1.6, 'charcoal'); ln([[x, y + h * 0.45], [x + w, y + h * 0.45]], '#151833', 1.6, 'charcoal');
  ln([[x - 20, y + h + 14], [x + w + 20, y + h + 14]], '#151833', 2.2, 'charcoal');
  if (open > 0.02) { const d = w * 0.28 * open, pane = [[x + w, y], [x + w + d, y - 40 * open], [x + w + d, y + h + 40 * open], [x + w, y + h]]; hatch(pane, sky === 'sunrise' ? '#e0955a' : '#3a4a80', { dist: 5, angle: 85 }); lp(pane, '#151833', 1.4, 'charcoal'); }
}
function shutters(x, y, w, h, open, col = '#3a4a80') {   // 向外推开的两扇窗（0 关 → 1 全开）
  const d = (w / 2) * (1 - open * 0.75);
  const L = [[x, y], [x + d, y + 20 * open], [x + d, y + h - 20 * open], [x, y + h]], Rr = [[x + w, y], [x + w - d, y + 20 * open], [x + w - d, y + h - 20 * open], [x + w, y + h]];
  for (const p of [L, Rr]) { hatch(p, col, { dist: 5, angle: 85 }); lp(p, '#151833', 1.4, 'charcoal'); }
}
function table(x, y, w) { hatch(R(x, y, w, 26), '#6b4a3a', { dist: 4, angle: 10 }); ln([[x + 20, y + 26], [x + 20, y + 200]], '#3a2a2a', 1.6, 'charcoal'); ln([[x + w - 20, y + 26], [x + w - 20, y + 200]], '#3a2a2a', 1.6, 'charcoal'); }
function beam(pts, col = '#ffe1a0', dist = 18, angle = 105) { hatch(pts, col, { dist, angle, w: 0.6, rand: 0.3 }); }
function lighthouse(x, y) { hatch([[x - 22, y], [x + 22, y], [x + 12, y - 150], [x - 12, y - 150]], '#d9d2c4', { dist: 3, angle: 0 }); hatch(R(x - 16, y - 175, 32, 25), '#ffd36e', { dist: 2.5, angle: 45 }); lp([[x - 22, y], [x + 22, y], [x + 12, y - 150], [x - 12, y - 150]], '#151833', 0.8); }
function moon(x, y, r) { hatch(E(x, y, r, r), '#f6eecf', { dist: 3, angle: 40, cross: 130 }); ring(x, y, r, '#c9c0a0', 0.8); }
function post(x, y, h) { hatch(R(x - 18, y - h, 36, h), '#6b4a3a', { dist: 4, angle: 80 }); lp(R(x - 18, y - h, 36, h), '#2a1a1a', 0.8); }
function stormBeach() { hatch(R(-40, -40, W + 80, 600), '#171b3d', { dist: 5, angle: 100, cross: 10 }); sea(560, '#1c254e', 700); sand(700, '#4a3e52'); }
function windStreaks(t, n = 8, col = '#8a94c0') { for (let k = 0; k < n; k++) { const off = ((t * 900 + k * 260) % (W + 600)) - 300; motion([[W - off, 120 + k * 110], [W - off - 520, 140 + k * 110]], col); } }
function footprints(pts, upto, col = '#3a3044') { const n = Math.floor(pts.length * clamp01(upto)); for (let i = 0; i < n; i += 2) hatch(E(pts[i][0], pts[i][1], 9, 5, 10), col, { dist: 2, angle: 0 }); }

// 视角求解：世界里高度 wh% 位于 (wx,wy) 的角色，要在画面上高 sh% 位于 (sx,sy) 时的镜头
function solve(wx, wy, wh, sx, sy, sh) { const z = sh / wh; return [z, (wx - (sx - 50) / z) / 100, (wy - (sy - 50) / z) / 100]; }
const C0 = [1, 0.5, 0.5];
const fixed = c => [[0, ...c], [1, ...c]];

// ───────── 共用世界 ─────────
// A：开场小屋（S01/S02/L01，O02 为白天版）——门在世界 x 1100–1300
function houseA(p = NIGHT, { doorOpen = 0, inside = '#1f2758', stars = 0, win = 'dark' } = {}) {
  room(p); windowFrame(560, 200, 300, 240, win);
  if (doorOpen >= 0) door(1100, 420, 200, 360, { open: doorOpen, inside, stars });
}
const S01out = solve(30, 74, 15, 32, 70, 22);
// B：门口逆光（L13–L17）
function doorwayB() { room(NIGHT); }
const L13out = solve(50, 68, 25, 50, 62, 45);
// C：从屋里望出门框（L18/I01/I02）
function doorwayC() { room(NIGHT); hatch(R(560, 140, 800, 700), '#1f2758', { dist: 5, angle: 100, cross: 10 }); nightSky(560, 140, 800, 520, 26, 8); hatch(R(560, 660, 800, 100), '#24305e', { dist: 6, angle: 0 }); hatch(R(560, 760, 800, 80), '#5a4a50', { dist: 5, angle: 0 }); lp(R(560, 140, 800, 700), '#151833', 2.6, 'charcoal'); }
// D：窗台日出（L43–L46）
function sillD() { hatch(R(-40, -40, W + 80, H + 80), '#6e4470', { dist: 6, angle: 30, w: 1 }); windowFrame(300, 60, 1320, 700, 'sunrise', 0); hatch(R(200, 760, 1520, 60), '#8a5a52', { dist: 4, angle: 0 }); }
// E：日出的屋里望向窗框（L47/O01/L48）
function roomE() { room(DAY); warmGlow(960, 420, 700, 420); windowFrame(560, 140, 800, 560, 'sunrise', 0); hatch(R(560, 560, 800, 140), '#5a4a8a', { dist: 6, angle: 0 }); }

const SHOTS = {
  // ═══════ 前奏 ═══════
  S01: { cam: [[0, ...C0], [1, ...S01out]], bg() { houseA(NIGHT); },
    dyn(u, t, k) { const sh = u > 0.55 && u < 0.78 ? (k % 2 ? 0.18 : -0.18) : 0; crab('正', 15, 30 + sh, 74, { expression: 'sad', pose: 'chest' }); } },
  S02: { cam: fixed(S01out), bg() { houseA(NIGHT, { doorOpen: -1 }); },
    dyn(u) {
      door(1100, 420, 200, 360, { open: ease(u / 0.08), inside: '#1f2758', stars: 5 });
      const r = ease(seg(u, 0.05, 0.55)), lx = lerp(62.5, 45.7, r), ly = lerp(76, 78.1, r), wob = Math.sin(r * 18) * (1 - r) * 0.5;
      const lf = seg(u, 0.45, 0.6);
      if (lf > 0) prop('letter', lerp(lx, 36.8, ease(lf)), lerp(ly - 2, 80.8, ease(lf)) - Math.sin(Math.PI * lf) * 4, 1.5);
      crab('正', 15, 30, 74, { expression: u > 0.6 ? 'neutral' : 'sad', pose: 'chest' });
      lantern(lx + wob, ly, 1.64, 1);
      if (lf <= 0) prop('letter', lx + 1, ly + 1.5, 1.2);
    } },
  // ═══════ 主歌一 ═══════
  L01: { cam: [[0, ...S01out], [1, ...solve(30, 74, 15, 38, 60, 42)]], bg() { houseA(NIGHT, { doorOpen: 1, stars: 5 }); },
    dyn(u) {
      const s = ease(seg(u, 0.3, 0.55)); prop('letter', lerp(36.8, 27, s), lerp(80.8, 79, s), 1.5);
      lantern(45.7, 78.1, 1.64, 1);
      crab('正', 15, 30, 74, { expression: 'shy', pose: u < 0.3 ? undefined : u < 0.6 ? 'sweep' : 'chest' });
    } },
  L02: { cam: fixed(C0), bg() { room(NIGHT, 760); door(1520, 120, 260, 640); },
    dyn(u, t) { for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + t * 2.2; hatch(E(960 + Math.cos(a) * 560, 480 + Math.sin(a) * 260, 40, 26), '#ffd98a', { dist: 4, angle: 60 }); }
      lantern(50 + Math.sin(t * 7) * 0.8, 64, 3.6, 1); motion([[880, 860], [960, 900], [1060, 860]], '#ffd98a'); } },
  L03: { cam: fixed(C0), bg() { nightSky(-40, -40, W + 80, 600, 20, 4); sea(560, '#24305e', 700); sand(700); hatch(R(1420, 220, 540, 560), '#5a3f45', { dist: 5, angle: 85, w: 1 }); door(1560, 470, 160, 310, { open: 1, inside: '#2a2a50', glowIn: 0.6 }); },
    path(u) { if (u < 0.12) { const k = ease(u / 0.12); return [lerp(82, 67, k), lerp(72, 73, k), 18, 0]; }
      if (u < 0.88) { const th = (u - 0.12) / 0.76 * Math.PI * 2; return [45 + 22 * Math.cos(th), 73 + 3 * Math.sin(th), 18 + 2 * Math.sin(th), Math.sin(th)]; }
      const k = ease((u - 0.88) / 0.12); return [lerp(67, 80, k), lerp(73, 70, k), 18, 0]; },
    dyn(u, t) {
      const pts = []; for (let i = 0; i <= 60; i++) { const p = this.path(i / 60); pts.push([PX(p[0]), PY(p[1]) + 100]); }
      footprints(pts, u, '#2e2838');
      const [x, y, h, d] = this.path(u);
      if (d < 0) { crab('正', h, x, y, { action: 'walk', t: t * 1.6 }); post(864, 790, 160); } else { post(864, 790, 160); crab('正', h, x, y, { action: 'walk', t: t * 1.6 }); }
    } },
  L04: { cam: [[0, ...C0], [1, ...solve(80, 70, 18, 60, 50, 40)]],
    bg() { nightSky(-40, -40, W + 80, 470, 12, 5); sea(420, '#24305e', 560); sand(560); hatch(E(1536, 905, 230, 60), '#3a4a80', { dist: 4, angle: 0, cross: 170 }); },
    dyn(u, t) {
      const sw = Math.sin(t * 3) * 0.5, s = crab('正', 18, 80 + sw, 70);
      const feet = PY(70) + 89 * s;
      Crab.draw({ x: MX(PX(80 - sw)), y: MY(feet + 4), size: ZZ(s), facing: 'front', flipY: true, clip: [MX(1306), MY(850), MX(1766), MY(965)] });
      hatch(E(1536, 905, 230, 60), '#2e3c72', { dist: 5, angle: 0, w: 0.8 }); for (let i = 0; i < 3; i++) ln([[1330, 880 + i * 22], [1740, 878 + i * 22]], '#9fb6e0', 0.5, 'HB');
    } },
  L05: { cam: fixed(C0), bg() { room(NIGHT); },
    dyn(u, t, k) { door(120 + (k % 2 ? 3 : -3), 220, 260, 560); motion([[400, 300], [430, 330]]);
      if (u < 0.3) { lantern(60, 74, 3.0, 1); crab('正', 40, 60, 50, { expression: 'sad' }); } else crab('正', 40, 60, 50, { expression: 'sad', action: 'hug', prop: 'lantern' }); } },
  L06: { cam: fixed(C0), bg() { room(NIGHT); door(120, 220, 260, 560); },
    dyn(u, t, k) { const knock = u > 0.25 && u < 0.75 && k % 3 !== 2; crab('正', 40, 60, 50, { expression: 'sad', action: 'hug', prop: 'lantern', pose: knock ? 'knock' : undefined }); } },
  L07: { cam: fixed(C0), bg() { room(NIGHT); door(120, 220, 260, 560); },
    dyn(u) { if (u < 0.3) crab('正', 40, 60, 50, { expression: 'shy', action: 'hug', prop: 'lantern' });
      else { lantern(60, 74, 3.0, 1); crab('正', 40, 60, 50, { expression: 'shy', pose: u < 0.6 ? 'open' : 'chest' }); } } },
  L08: { cam: fixed(C0), bg() { room(NIGHT); hatch(R(-40, -40, 160, H + 80), '#5a3f45', { dist: 5, angle: 85 }); },
    dyn(u) { const m = ease(seg(u, 0.35, 0.7)); crab('正', 40, 60, 50, { expression: 'sad', action: u > 0.3 && u < 0.7 ? 'push' : 'idle' }); lantern(60, lerp(74, 118, m), 3.2 + m, 1);
      if (m > 0 && m < 1) for (const dx of [-60, 0, 60]) motion([[1152 + dx, 820], [1152 + dx, 980]], '#ffd98a'); } },
  // ═══════ 副歌一 ═══════
  L09: { cam: fixed(C0), bg() { hatch(R(-40, -40, W + 80, 800), '#2a2440', { dist: 5, angle: 85, cross: 0, w: 1.1 }); hatch(R(-40, 760, W + 80, 360), '#3a2e48', { dist: 6, angle: -10, w: 1 }); },
    dyn(u) { const l = ease(seg(u, 0.05, 0.7)); if (l > 0) { hatch(R(0, 744, W, 16), '#ffe9b0', { dist: 2, angle: 0 }); beam([[700, 760], [1220, 760], [lerp(1220, 1500, l), 760 + 320 * l], [lerp(700, 420, l), 760 + 320 * l]], '#ffd98a', 10); } prop('letter', 50, 84, 6); } },
  L10: { cam: fixed(C0), bg() { hatch(R(-40, -40, W + 80, H + 80), '#3a2e48', { dist: 6, angle: -10, w: 1 }); beam([[300, -40], [1300, -40], [1700, H + 40], [700, H + 40]], '#ffd98a', 9); },
    dyn(u) { prop('letter', 50, 58, 14); const d = seg(u, 0, 0.45), y = lerp(-40, 500, ease(d));
      if (u < 0.45) { const dr = [[1010, y], [1030, y + 50], [1022, y + 82], [998, y + 82], [990, y + 50]]; hatch(dr, '#8cc4e8', { dist: 2, angle: 70 }); lp(dr, '#4e7fa5', 0.6); }
      else { const g = ease(seg(u, 0.45, 0.9)); hatch(E(1010, 540, 30 + 50 * g, 20 + 34 * g), '#8cc4e8', { dist: 3, angle: 30 }); } } },
  L11: { cam: fixed(C0), bg() { room(NIGHT); },
    dyn(u) { const l = ease(seg(u, 0, 0.5)); hatch([[W, 300], [W, 700], [lerp(W, 700, l), 760], [lerp(W, 700, l), 520]], '#ffd98a', { dist: 10, angle: 6, w: 0.6, rand: 0.25, cont: false }); crab('正', 55, 50, 58, { expression: u < 0.35 ? 'sad' : 'neutral' }); } },
  L12: { cam: fixed(C0), bg() { nightSky(-40, -40, W + 80, H + 80, 16, 6); hatch(R(-40, 820, W + 80, 300), '#4a3a40', { dist: 6, angle: 0 }); },
    dyn(u, t) { const bend = Math.sin(Math.PI * seg(u, 0.1, 0.7)) * 1.6 * Math.max(0, Math.sin(t * 5) * 0.3 + 0.7); windStreaks(t, 4, '#c9d4f0'); lantern(50 + bend * 0.4, 52, 13, 1); flame(50 + bend * 0.4, 52, 13, bend); } },
  L13: { cam: [[0, ...C0], [1, ...L13out]], bg() { doorwayB(); },
    dyn(u) { const o = ease(seg(u, 0.15, 0.45)); door(660, 120, 600, 700, { open: o, inside: '#ffd98a', glowIn: o });
      if (o > 0.3) beam([[660, 820], [1260, 820], [1500, H + 40], [420, H + 40]], '#ffe1a0', 12);
      crab('背', 25, 50, 68, { action: u > 0.1 && u < 0.5 ? 'push' : 'idle' }); } },
  L14: { cam: fixed(L13out), bg() { doorwayB(); door(660, 120, 600, 700, { open: 1, inside: '#ffd98a', glowIn: 1 }); beam([[660, 820], [1260, 820], [1500, H + 40], [420, H + 40]], '#ffe1a0', 12); },
    dyn(u) { crab('背', 25, 50, 68, { expression: 'sad' }); const f = seg(u, 0.3, 0.8); if (f > 0) { const x = 1012, y = lerp(430, 640, f); ln([[x - 14, y], [x + 14, y]], '#ffffff', 1, 'cpencil'); ln([[x, y - 14], [x, y + 14]], '#ffffff', 1, 'cpencil'); hatch(E(x, y + 26, 6, 9), '#8cc4e8', { dist: 1.6, angle: 70 }); } } },
  L15: { cam: fixed(L13out), bg() { SHOTS.L14.bg(); }, dyn(u) { crab('背', 25, 50, 68, { pose: u > 0.3 ? 'open' : undefined }); } },
  L16: { cam: fixed(L13out), bg() { SHOTS.L14.bg(); },
    dyn(u, t) { const m = ease(u); lantern(57, 70, 1.4, 1); crab('背', lerp(25, 21.1, m), 50, lerp(68, 66, m), { action: 'walk', t: t * 1.4, pose: 'open' }); } },
  L17: { cam: [[0, ...L13out], [1, ...solve(50, 66, 21.1, 50, 60, 50)]], bg() { SHOTS.L14.bg(); },
    dyn(u) { if (u < 0.2) { lantern(57, 70, 1.4, 1); crab('背', 21.1, 50, 66, {}); } else crab('背', 21.1, 50, 66, { action: 'hug', prop: 'lantern' }); } },
  L18: { cam: [[0, ...solve(50, 70, 15, 50, 60, 50)], [1, ...C0]], bg() { doorwayC(); },
    dyn(u) { if (u < 0.2) crab('背', 15, 50, 70, { action: 'hug', prop: 'lantern' }); else { lantern(55, 72, 1.3, 1); crab('背', 15, 50, 70, { sit: true }); } } },
  // ═══════ 间奏 ═══════
  I01: { cam: fixed(C0), bg() { doorwayC(); },
    dyn(u) { const a = u * Math.PI; moon(lerp(640, 1280, u), 300 - Math.sin(a) * 110, 30); lantern(55, 72, 1.3, 1); crab('背', 15, 50, 70, { sit: true, expression: 'sleepy' }); } },
  I02: { cam: [[0, ...C0], [1, ...solve(55, 72, 7, 50, 55, 18)]], bg() { doorwayC(); moon(1280, 300, 30); },
    dyn(u) { const g = 1 - ease(seg(u, 0.2, 0.92)); lantern(55, 72, 1.3, g); if (g > 0.05) flame(55, 72, 1.3, 0); crab('背', 15, 50, 70, { sit: true, expression: 'sleepy' }); if (u > 0.6) hatch(R(-40, -40, W + 80, H + 80), '#0e1230', { dist: lerp(30, 9, seg(u, 0.6, 1)), angle: 45, w: 0.7 }); } },
  // ═══════ 主歌二 ═══════
  L19: { cam: [[0, ...solve(60, 62, 9.2, 50, 55, 18)], [1, ...C0]], bg() { stormBeach(); },
    dyn(u, t) { windStreaks(t); crab('侧右', 28, 45, 66, { action: 'hold', prop: 'lantern_off', expression: 'sad' }); } },
  L20: { cam: fixed(C0), bg() { stormBeach(); hatch([[100, 760], [600, 520], [760, 760]], '#3a3044', { dist: 5, angle: 60 }); },
    dyn(u, t) { windStreaks(t, 5); const b = ease(seg(u, 0.15, 0.6)); prop('lantern_off', 62, 70, 3.2);
      crab('侧右', 28, 45, lerp(66, 70, b), { expression: 'sad', clip: [-40, -40, W + 40, lerp(1000, 672, b)] }); if (b > 0) hatch(E(864, 712, 260 * b + 20, 70 * b + 8), '#5a4c60', { dist: 4, angle: -20, cross: 60 }); } },
  L21: { cam: fixed(C0), bg() { stormBeach(); hatch([[100, 760], [600, 520], [760, 760]], '#3a3044', { dist: 5, angle: 60 }); lighthouse(1700, 560); prop('lantern_off', 62, 70, 3.2); },
    dyn(u, t) { const a = -0.25 + 0.5 * Math.sin(t * 0.9); const bx = 1700 - Math.cos(a) * 1300, by = 400 + Math.sin(a) * 300;
      hatch([[1700, 395], [bx, by - 70], [bx, by + 70]], '#ffe1a0', { dist: 9, angle: -Math.atan2(by - 395, bx - 1700) * 180 / Math.PI, w: 0.6, rand: 0.2, cont: false }); crab('侧右', 28, 45, 70, { expression: 'neutral', clip: [-40, -40, W + 40, 672] }); hatch(E(864, 712, 280, 78), '#5a4c60', { dist: 4, angle: -20, cross: 60 }); } },
  L22: { cam: fixed(C0), bg() { hatch(R(-40, -40, W + 80, 600), '#171b3d', { dist: 5, angle: 100, cross: 10 }); sea(560, '#1c254e', 760); sand(760, '#4a3e52'); },
    dyn(u, t) { const m = ease(seg(u, 0.3, 0.8)); prop('lantern_off', lerp(62, 80, m), lerp(70, 69, m) + Math.sin(t * 3) * m * 0.5, 3.2 - m * 0.6);
      crab('侧右', 28, 45, 70, { expression: 'sad', action: u > 0.25 && u < 0.7 ? 'push' : 'idle', clip: [-40, -40, W + 40, 700] }); hatch(E(864, 740, 280, 80), '#5a4c60', { dist: 4, angle: -20, cross: 60 }); if (m > 0.5) motion([[1400, 770], [1600, 770]], '#c9d4f0'); } },
  // ═══════ 副歌二 ═══════
  L23: { cam: fixed(C0), bg() { hatch(R(-40, -40, W + 80, 560), '#141a3c', { dist: 5, angle: 100, cross: 10 }); sea(520, '#1c254e'); },
    dyn(u, t) { const g = ease(seg(u, 0.25, 0.6)); const y = 60 + Math.sin(t * 2.2) * 0.4; if (g > 0) hatch(E(960, PY(y) + 8, 160 * g, 40 * g), '#ffd98a', { dist: 6, angle: 0 }); lantern(50, y, 1.6, g); } },
  L24: { cam: fixed(C0), bg() { sand(-40, '#5a4c60'); ln([[200, 1120], [700, 600], [1100, 400], [1180, 330]], '#3a3044', 3, 'charcoal'); ln([[240, 1120], [730, 610], [1120, 410], [1190, 340]], '#3a3044', 3, 'charcoal'); },
    dyn(u) { const r = ease(seg(u, 0, 0.7)); const ox = lerp(-500, 0, r), oy = lerp(-420, 0, r); const wv = [[1100 - ox, -40], [W + 40, -40], [W + 40, 520 - oy], [1300 - ox, 360 - oy], [1180 - ox, 200 - oy]].map(([x, y]) => [x - ox * 0 + (1 - r) * -700, y + (1 - r) * 600]);
      hatch(wv, '#2e3a6a', { dist: 5, angle: 0, cross: 170 }); ln([wv[4], wv[3], wv[2]], '#e8eef8', 1.4, 'cpencil'); } },
  L25: { cam: fixed(C0), bg() { hatch(R(-40, -40, W + 80, 460), '#1f2350', { dist: 5, angle: 100 }); sea(420, '#1c254e', 560); sand(560, '#4a3e52'); },
    dyn(u) { const l = ease(seg(u, 0, 0.4)); hatch([[W, 300], [W, 520], [lerp(W, 760, l), 600], [lerp(W, 760, l), 460]], '#ffd98a', { dist: 9, angle: 6, w: 0.6, rand: 0.25, cont: false });
      crab('正', 40, 40, 60, { expression: u > 0.5 && u < 0.58 ? 'sleepy' : 'neutral', pose: 'chest', clip: [-40, -40, W + 40, 545] }); hatch(E(768, 600, 320, 70), '#5a4c60', { dist: 4, angle: -20, cross: 60 }); } },
  L26: { cam: fixed(C0), bg() { hatch(R(-40, -40, W + 80, 520), '#2a2a60', { dist: 5, angle: 100 }); sea(480, '#1c254e'); },
    dyn(u, t) { const y = 58 + Math.sin(t * 2.4) * 0.6; lantern(50, y, 3.4, 1); const w = seg(u, 0.25, 0.65); if (w > 0 && w < 1) waveCrest(lerp(-300, 2200, w), 760, 900, 260, 1); } },
  L27: { cam: [[0, 1.2, 0.5, 0.5], [0.2, 1.2, 0.5, 0.5], [1, 1.2, 0.4333, 0.5]], bg() { dawnSky(); sea(500, '#3a3f78'); },
    dyn(u, t) { lantern(50 + Math.sin(t * 2) * 0.3, 58, 1.5, 1); const x = lerp(-8, 39.2, ease(seg(u, 0.05, 0.85)));
      crab('侧右', 18.3, x, 61, { action: 'walk', t: t * 2.6, clip: [-40, -40, W + 40, 760] }); for (const k of [0, 1, 2]) motion([[PX(x) - 140 - k * 50, 760], [PX(x) - 90 - k * 50, 700]], '#e8eef8'); } },
  L28: { cam: fixed(C0), bg() { sea(-40, '#3a3f78'); },
    dyn(u) { const d = seg(u, 0, 0.3); if (d < 1) { const y = lerp(200, 520, ease(d)); const dr = [[960, y], [980, y + 50], [972, y + 82], [948, y + 82], [940, y + 50]]; hatch(dr, '#8cc4e8', { dist: 2, angle: 70 }); }
      else { const g = seg(u, 0.3, 1); for (let i = 0; i < 4; i++) { const r = 40 + (g * 500 + i * 120) % 500; brush.noHatch(); brush.set('cpencil', r < 220 ? '#ffe9b0' : '#a8b8e8', 1.2); brush.circle(MX(960), MY(540), ZZ(r), false); brush.noStroke(); } hatch(E(960, 540, 60, 60), '#ffe9b0', { dist: 3, angle: 30 }); } } },
  L29: { cam: fixed(C0), bg() { hatch(R(-40, -40, W + 80, 400), '#7a4f8a', { dist: 5, angle: 95 }); sea(360, '#3a3f78'); },
    dyn(u, t) { lantern(66, 62 + Math.sin(t * 2.3) * 0.5, 3.2, 1); crab('正', 40, 50, 55, { expression: 'neutral', clip: [-40, -40, W + 40, 820] });
      const w = seg(u, 0.15, 0.6); if (w > 0 && w < 1) waveCrest(lerp(W + 500, -500, w), 860, 1000, 520, -1); } },
  L30: { cam: fixed(C0), bg() { SHOTS.L29.bg(); },
    dyn(u, t) { if (u < 0.3) { lantern(66, 62 + Math.sin(t * 2.3) * 0.5, 3.2, 1); crab('正', 40, 50, 55, { expression: 'neutral', clip: [-40, -40, W + 40, 820] }); }
      else crab('正', 40, 50, 55, { expression: 'happy', action: 'hold', prop: 'lantern', clip: [-40, -40, W + 40, 820] }); } },
  L31: { cam: fixed(C0), bg() { hatch(R(-40, -40, W + 80, 400), '#8a5a8a', { dist: 5, angle: 95 }); sea(360, '#3a3f78'); },
    dyn(u) { const l = ease(seg(u, 0.15, 0.6)); if (l > 0) { hatch([[1180, 420], [1300, 420], [lerp(1300, 1800, l), lerp(420, 1080, l)], [lerp(1180, 600, l), lerp(420, 1080, l)]], '#ffd98a', { dist: 7, angle: 0, w: 0.9, rand: 0.25 }); hatch(E(1240, 380, 260 * l, 40 * l + 5), '#ffe9b0', { dist: 6, angle: 0, w: 0.8 }); }
      crab('正', 40, 50, 55, { expression: 'happy', action: 'hold', prop: 'lantern', pose: u > 0.15 ? 'raise' : undefined, clip: [-40, -40, W + 40, 840] }); } },
  L32: { cam: [[0, ...solve(50, 60, 28, 50, 58, 40)], [1, ...C0]], bg() { hatch(R(-40, -40, W + 80, 340), '#8a5a8a', { dist: 5, angle: 95 }); hatch(R(-40, 300, W + 80, 160), '#c8707a', { dist: 5, angle: 95 }); sea(460, '#3a3f78', 640); sand(640, '#6a5468'); },
    dyn(u, t) { const x = lerp(50, -14, ease(seg(u, 0.15, 1))); const pts = []; for (let i = 0; i <= 30; i++) { const xx = lerp(52, x, i / 30); pts.push([PX(xx) + (i % 2 ? 20 : -20), PY(60) + 150]); }
      footprints(pts.reverse(), 1, '#3a3044'); crab('正', 28, x, 60, { expression: 'happy', action: 'hold', prop: 'lantern', pose: 'raise' }); } },
  // ═══════ 桥段 ═══════
  L33: { cam: fixed(C0), bg() { room(DARK); table(1240, 560, 300); },
    dyn(u, t) { lantern(70, 50, 3.0, 1); const x = lerp(58, -16, ease(seg(u, 0.05, 0.95))); crab('正', 30, x, 64, { expression: 'sad', action: 'walk', t: -t * 1.2 }); } },
  L34: { cam: fixed(C0), bg() { hatch(R(-40, -40, W + 80, H + 80), '#3a4070', { dist: 6, angle: 30, w: 1 }); hatch(R(80, 60, 1760, 960), '#c9d0e0', { dist: 4, angle: 20, cross: 110, w: 0.9 }); lp(R(80, 60, 1760, 960), '#151833', 3, 'charcoal'); },
    dyn(u) { const hx = 1400, hy = 520, heart = [[hx, hy + 120], [hx - 150, hy - 20], [hx - 90, hy - 110], [hx, hy - 40], [hx + 90, hy - 110], [hx + 150, hy - 20], [hx, hy + 120]];
      const d = seg(u, 0.1, 0.6), n = Math.max(2, Math.ceil(heart.length * d)); if (d > 0) ln(heart.slice(0, n), '#6a7aa8', 1.6, 'cpencil');
      const c = seg(u, 0.65, 0.85); if (c > 0) ln([[hx - 190, hy + 140], [lerp(hx - 190, hx + 190, c), lerp(hy + 140, hy - 160, c)]], '#4a5a88', 2, 'cpencil');
      const tip = c > 0 ? [lerp(hx - 190, hx + 190, c), lerp(hy + 140, hy - 160, c)] : heart[Math.min(n, heart.length) - 1];
      const z = VIEW.z; Crab.draw({ x: MX(tip[0] + 560), y: MY(tip[1] + 780), size: ZZ(4), facing: 'left', pose: 'press', shadow: false }); } },
  L35: { cam: fixed(C0), bg() { room(DARK); windowFrame(660, 120, 600, 460, 'dark'); hatch(R(-40, 900, W + 80, 220), '#f4b456', { dist: 9, angle: 100, w: 0.8 }); },
    dyn(u) { const back = u > 0.45; if (back) hatch([[860, 560], [1060, 560], [1120, 200], [800, 200]], '#0e1230', { dist: 4, angle: 80 }); crab(back ? '背' : '正', 35, 50, 60, { expression: 'sad' }); } },
  L36: { cam: [[0, ...C0], [1, ...solve(50, 60, 35, 50, 58, 55)]], bg() { SHOTS.L35.bg(); hatch([[860, 560], [1060, 560], [1120, 200], [800, 200]], '#0e1230', { dist: 4, angle: 80 }); },
    dyn(u) { Crab.draw({ x: MX(1114), y: MY(470), size: ZZ(1.15), facing: 'front', expression: u > 0.4 ? 'sleepy' : 'sad', shadow: false }); hatch(R(860, 200, 520, 300), '#141a3c', { dist: 13, angle: 60, w: 0.5 }); crab('背', 35, 50, 60, {}); } },
  L37: { cam: fixed(solve(50, 60, 35, 50, 58, 55)), bg() { room(DARK); hatch(R(660, 120, 600, 460), '#f2c48a', { dist: 6, angle: 95 }); lp(R(660, 120, 600, 460), '#151833', 2.2, 'charcoal'); hatch(R(-40, 900, W + 80, 220), '#f4b456', { dist: 9, angle: 100, w: 0.8 }); },
    dyn(u) { const o = ease(seg(u, 0.2, 0.6)); shutters(660, 120, 600, 460, o); if (o > 0.3) beam([[700, 580], [1220, 580], [1400, H + 40], [520, H + 40]], '#ffd98a', 14); crab('背', 35, 50, 60, { action: u > 0.15 && u < 0.6 ? 'push' : 'idle' }); } },
  L38: { cam: [[0, ...solve(50, 64, 25, 50, 58, 55)], [1, ...C0]], bg() { hatch(R(-40, -40, W + 80, H + 80), '#6e4470', { dist: 6, angle: 30, cross: 120, w: 1 }); warmGlow(1100, 420, 700, 520); windowFrame(720, 120, 560, 520, 'sunrise', 1); hatch(R(-40, 820, W + 80, 300), '#8a5a52', { dist: 6, angle: -15, w: 1 }); },
    dyn(u) { const g = ease(seg(u, 0.2, 0.7)); hatch(E(1267, 432, 40 + 40 * g, 40 + 40 * g), '#fff2c4', { dist: 3, angle: 40 }); crab('背', 25, 50, 64, {}); } },
  // ═══════ 副歌三 ═══════
  L39: { cam: fixed(C0), bg() { room(DAY); warmGlow(400, 300, 600, 400); },
    dyn(u) { const s = ease(seg(u, 0, 0.7)); const x = lerp(-300, 0, s); beam([[200 + x, -40], [700 + x, -40], [1200 + x, H + 40], [500 + x, H + 40]], '#ffd98a', 8); prop('letter', 50, 62, 5.2); } },
  L40: { cam: [[0, ...C0], [1, ...solve(50, 62, 20, 50, 60, 40)]], bg() { room(DAY); beam([[600, -40], [1100, -40], [1300, H + 40], [600, H + 40]], '#ffd98a', 9); },
    dyn(u) { crab('正', 45, 50, 40, { expression: 'shy', pose: 'chest' }); prop(u > 0.45 ? 'letter_open' : 'letter', 50, 64, u > 0.45 ? 6.5 : 5.2); } },
  L41: { cam: fixed(C0), bg() { hatch(R(-40, -40, W + 80, H + 80), '#c4844f', { dist: 7, angle: 30, w: 1 }); },
    dyn(u) { const s = lerp(9, 15, ease(seg(u, 0, 0.5))); Crab.drawProp('drawing', MX(960), MY(560), ZZ(s)); } },
  L42: { cam: fixed(C0), bg() { sunriseSky(-40, -40, W + 80, 800); sun(1300, 640, 80); hatch(R(-40, 760, W + 80, 360), '#8a5a52', { dist: 6, angle: 0 }); },
    dyn(u, t) { const b = Math.sin(t * 2.2) * 0.7; lantern(60, 50, 9, 1); flame(60, 50, 9, b); } },
  L43: { cam: [[0, ...solve(66, 66, 14, 60, 50, 35)], [1, ...C0]], bg() { sillD(); },
    dyn(u, t) { lantern(66, 66, 2.6, 1); const c = ease(seg(u, 0.15, 0.75)); crab('背', 30, 45, lerp(100, 60, c), { action: c < 1 ? 'walk' : 'idle', t: t * 1.5 }); } },
  L44: { cam: fixed(C0), bg() { sillD(); const pane = [[1400, 60], [1800, 0], [1800, 900], [1400, 760]]; hatch(pane, '#e8b08a', { dist: 5, angle: 85 }); lp(pane, '#151833', 2, 'charcoal'); },
    dyn(u) { Crab.draw({ x: MX(1649), y: MY(518 + 89 * 1.1), size: ZZ(1.1), facing: 'front', expression: u > 0.2 ? 'teary-happy' : 'happy', shadow: false }); hatch([[1400, 60], [1800, 0], [1800, 900], [1400, 760]], '#e8b08a', { dist: 10, angle: 60, w: 0.6 }); lantern(66, 66, 2.6, 1); crab('背', 30, 45, 60, {}); } },
  L45: { cam: fixed(C0), bg() { sillD(); }, dyn(u) { lantern(66, 66, 2.6, 1); crab('背', 30, 45, 60, { pose: u > 0.3 ? 'open' : undefined }); } },
  L46: { cam: fixed(C0), bg() { sillD(); },
    dyn(u, t) { const m = ease(seg(u, 0, 0.3)); if (u < 0.3) { lantern(66, 66, 2.6, 1); crab('背', 30, lerp(45, 50, m), 60, { action: 'walk', t: t * 1.5, pose: 'open' }); } else crab('背', 30, 50, 60, { action: 'hug', prop: 'lantern' }); } },
  L47: { cam: [[0, ...solve(50, 64, 12, 50, 60, 30)], [1, ...C0]], bg() { roomE(); },
    dyn(u) { if (u < 0.2) crab('背', 12, 50, 64, { action: 'hug', prop: 'lantern' }); else { lantern(54, 63, 1.1, 1); crab('背', 12, 50, 64, { sit: true }); } } },
  // ═══════ 尾声 ═══════
  O01: { cam: fixed(C0), bg() { roomE(); },
    dyn(u) { const m = ease(seg(u, 0.15, 0.4)); const g = seg(u, 0.4, 1); if (g > 0) hatch(E(1229, 497, 80 + 50 * g, 60 + 40 * g), '#fff2c4', { dist: 6, angle: 60, w: 0.7 });
      Crab.drawProp('drawing', MX(lerp(1000, 1229, m)), MY(lerp(700, 497, m)), ZZ(3.2)); lantern(54, 63, 1.1, 1); crab('背', 12, 50, 64, { sit: true, pose: u > 0.12 && u < 0.45 ? 'press' : undefined }); } },
  L48: { cam: [[0, ...C0], [1, 2.2, 0.5, 0.36]], bg() { roomE(); Crab.drawProp('drawing', MX(1229), MY(497), ZZ(3.2)); },
    dyn(u) { const l = ease(seg(u, 0.25, 0.7)); if (l > 0) hatch([[1010, 640], [1060, 640], [lerp(1060, 1180, l), lerp(640, 470, l)], [lerp(1010, 1150, l), lerp(640, 470, l)]], '#ffd98a', { dist: 5, angle: 0, w: 0.9 });
      crab('背', 12, 50, 64, { sit: true, action: 'hold', prop: 'lantern', pose: u > 0.15 ? 'raise' : undefined }); } },
  O02: { cam: fixed(C0), bg() { houseA(SUNNY, { doorOpen: -1, win: 'sunrise' }); warmGlow(1200, 600, 420, 360); door(1100, 420, 200, 360, { open: 1, inside: '#ffd27a' }); hatch(R(1100, 640, 200, 140), '#c9a070', { dist: 4, angle: 0 }); Crab.drawProp('drawing', MX(710), MY(320), ZZ(1.6)); for (let k = 0; k < 8; k++) hatch(E(980 + k * 16, 900 - k * 22, 8, 5), '#6a4a40', { dist: 1.6, angle: 0 }); },
    dyn(u, t) { const tAbs = t; const wave = tAbs >= 289.27 && tAbs < 291.2; crab('正', 4, 62.5, 66, { expression: 'happy', action: 'hold', prop: 'lantern', holdSide: 'far', pose: wave ? 'press' : undefined }); } },
};
