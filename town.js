/* 온고 게임제작반 마을 — 탑다운 마을 / 학생 집 (그림은 모두 코드로 그려요)
   마을 = ART 2(부드러운 일러스트), 집 안 = ART(도트). 그림을 바꾸려면 ART 부분의 함수만 바꾸면 됩니다. */
(function(){
"use strict";
const T = 16;          // 타일 한 칸 = 16px (화면에서는 S배로 확대)
const S = 3;           // 확대 배율 (선명한 도트를 위해 정수)
const STEP_MS = 150;   // 한 칸 걷는 시간

/* ================= ART: 도트 그림 ================= */
const C = {
  grass:"#5fae46", grass2:"#4f9a3a", grass3:"#78c25a", path:"#e2c48a", path2:"#c9a86c",
  trunk:"#7a4a25", leaf:"#2f7d32", leaf2:"#3f9a40", leaf3:"#5cbf55",
  wall:"#f3e3c0", wall2:"#d9c39a", door:"#8a5a2b", door2:"#5e3b1a", win:"#9fd7ff", winLit:"#ffe27a",
  floor:"#c98f55", floor2:"#b57d47", iwall:"#efe6d2", iwall2:"#d8ccb0", trim:"#8a5a2b",
  skin:"#ffd7b0", hair:"#3b2a20", shirt:"#e8443a", pants:"#2d3e74", shoe:"#2a1d16", ink:"#1d1d2b"
};
const ROOF = ["#d94b3d","#e88a2d","#3d7fd9","#8a5bd6","#e05a9a","#2fa39a","#c9a227","#5a6f88"];
const rand = (x, y, k=0) => { const n = Math.sin(x*127.1 + y*311.7 + k*74.7) * 43758.5453; return n - Math.floor(n); };
function R(c, x, y, w, h, col){ c.fillStyle = col; c.fillRect(x, y, w, h); }

function drawGrass(c, tx, ty){
  const x = tx*T, y = ty*T; R(c, x, y, T, T, C.grass);
  for (let i=0;i<5;i++){ const px = Math.floor(rand(tx,ty,i)*14)+1, py = Math.floor(rand(ty,tx,i)*13)+1;
    R(c, x+px, y+py, 1, 2, i%2 ? C.grass2 : C.grass3); }
}
function drawFlowers(c, tx, ty){
  drawGrass(c, tx, ty); const x = tx*T, y = ty*T;
  const cols = ["#fff","#ffd23f","#ff7aa8"];
  for (let i=0;i<3;i++){ const px = 2+Math.floor(rand(tx,ty,i+9)*11), py = 2+Math.floor(rand(ty,tx,i+9)*11);
    R(c, x+px, y+py, 2, 2, cols[i]); R(c, x+px, y+py+2, 1, 1, C.grass2); }
}
function drawPath(c, tx, ty){
  const x = tx*T, y = ty*T; R(c, x, y, T, T, C.path);
  for (let i=0;i<4;i++){ R(c, x+Math.floor(rand(tx,ty,i+3)*14)+1, y+Math.floor(rand(ty,tx,i+3)*14)+1, 2, 1, C.path2); }
}
function drawTree(c, tx, ty){
  drawGrass(c, tx, ty); const x = tx*T, y = ty*T;
  R(c, x+6, y+10, 4, 6, C.trunk);
  R(c, x+3, y+2, 10, 9, C.leaf); R(c, x+1, y+4, 14, 5, C.leaf); R(c, x+5, y, 6, 2, C.leaf);
  R(c, x+4, y+3, 4, 3, C.leaf2); R(c, x+5, y+2, 2, 1, C.leaf3); R(c, x+9, y+5, 3, 2, C.leaf2);
}
function drawFence(c, tx, ty){
  drawGrass(c, tx, ty); const x = tx*T, y = ty*T;
  R(c, x, y+6, T, 2, "#c79c62"); R(c, x, y+11, T, 2, "#c79c62");
  R(c, x+2, y+4, 3, 11, "#e0b97c"); R(c, x+11, y+4, 3, 11, "#e0b97c");
}
/* 집: 5칸 x 4칸. 지붕 2줄, 벽 2줄, 문은 가운데(아래 줄) */
function drawHouse(c, hx, hy, roof, lit){
  const x = hx*T, y = hy*T, W = 5*T;
  R(c, x+2, y+2*T, W-4, 2*T, C.wall); R(c, x+2, y+4*T-3, W-4, 3, C.wall2);
  for (let i=0;i<4;i++) R(c, x+2, y+2*T+6+i*7, W-4, 1, C.wall2);
  // 지붕
  for (let i=0;i<2*T;i++){ const inset = Math.max(0, 10 - Math.floor(i/2)); R(c, x+inset, y+i, W-inset*2, 1, roof); }
  for (let i=4;i<2*T;i+=5) R(c, x+2, y+i, W-4, 1, "rgba(0,0,0,.18)");
  R(c, x, y+2*T-2, W, 3, "rgba(0,0,0,.28)");
  // 굴뚝
  R(c, x+W-20, y+2, 6, 10, "#8d6e63"); R(c, x+W-21, y+1, 8, 2, "#6d4c41");
  // 창문
  for (const wx of [x+6, x+W-18]){ R(c, wx, y+2*T+6, 12, 10, C.trim); R(c, wx+1, y+2*T+7, 10, 8, lit ? C.winLit : C.win);
    R(c, wx+5, y+2*T+7, 1, 8, C.trim); R(c, wx+1, y+2*T+10, 10, 1, C.trim); }
  // 문
  const dx = x+2*T+2; R(c, dx, y+3*T-2, 12, T+2, C.door2); R(c, dx+1, y+3*T-1, 10, T+1, C.door); R(c, dx+8, y+3*T+8, 2, 2, "#ffd54a");
}
function drawLibrary(c, hx, hy){
  const x = hx*T, y = hy*T, W = 6*T;
  R(c, x+1, y+T, W-2, 3*T, "#e9e2d0");
  for (let i=0;i<5;i++) R(c, x+7+i*19, y+T+10, 5, 2*T+6, "#cfc5ad");
  R(c, x, y+T-2, W, 6, "#7b8aa0"); for (let i=0;i<T;i++){ const inset = Math.max(0, 48 - i*3); if (inset>=W/2) continue; R(c, x+inset, y+i, W-inset*2, 1, "#5d6d86"); }
  const dx = x+2*T+8; R(c, dx, y+3*T-2, T, T+2, "#3e4a5e"); R(c, dx+1, y+3*T-1, T-2, T+1, "#5b6b84");
  R(c, x+36, y+T+6, 24, 7, "#fff"); R(c, x+39, y+T+8, 18, 3, "#3e4a5e");
}
function drawBoard(c, tx, ty){
  drawGrass(c, tx, ty); drawGrass(c, tx+1, ty); const x = tx*T, y = ty*T;
  R(c, x+4, y+8, 3, 8, C.trunk); R(c, x+25, y+8, 3, 8, C.trunk);
  R(c, x+1, y, 30, 12, "#8a5a2b"); R(c, x+3, y+2, 26, 8, "#f1e2bc");
  R(c, x+5, y+3, 7, 5, "#ff9a8a"); R(c, x+14, y+3, 6, 6, "#9ad0ff"); R(c, x+22, y+4, 5, 4, "#c6f29b");
}
/* 집 안 */
function drawFloor(c, tx, ty){ const x = tx*T, y = ty*T; R(c, x, y, T, T, C.floor); R(c, x, y+7, T, 1, C.floor2); R(c, x, y+15, T, 1, C.floor2); R(c, x+((tx+ty)%2?4:11), y, 1, 7, C.floor2); R(c, x+((tx+ty)%2?10:3), y+8, 1, 7, C.floor2); }
function drawIWall(c, tx, ty, row){ const x = tx*T, y = ty*T; R(c, x, y, T, T, C.iwall); for (let i=2;i<T;i+=6) R(c, x+i, y, 1, T, C.iwall2); if (row===1){ R(c, x, y+12, T, 4, C.trim); } }
function drawSide(c, tx, ty){ R(c, tx*T, ty*T, T, T, "#6b4a2b"); R(c, tx*T+(tx===0?T-3:0), ty*T, 3, T, "#8a5a2b"); }
function drawFrame(c, tx, ty, st, isGame, color){
  const x = tx*T, y = ty*T;
  R(c, x+1, y+2, 14, 18, "#a0712f"); R(c, x+2, y+3, 12, 16, "#f6c768"); R(c, x+3, y+4, 10, 14, st ? "#fff" : "#4a4458");
  if (!st){ R(c, x+5, y+9, 6, 1, "#6d6680"); R(c, x+7, y+7, 2, 5, "#6d6680"); return; }
  if (isGame){ R(c, x+3, y+4, 10, 14, "#1e2a4a"); R(c, x+5, y+12, 6, 3, color); R(c, x+7, y+6, 2, 2, "#ffe27a"); R(c, x+4, y+15, 8, 2, "#4fbf5a"); }
  else { R(c, x+4, y+5, 8, 1, color); for (let i=0;i<4;i++) R(c, x+4, y+8+i*2, i===3?5:8, 1, "#9a9aa8"); }
  if (st === "v2"){ R(c, x+10, y+15, 4, 4, "#2563eb"); } else { R(c, x+10, y+15, 4, 4, "#16a34a"); }
}
function drawArcade(c, tx, ty, color){
  const x = tx*T, y = ty*T;
  R(c, x+2, y+30, 28, 3, "rgba(0,0,0,.25)");
  R(c, x+3, y, 26, 31, "#222039"); R(c, x+4, y+1, 24, 6, color); R(c, x+7, y+2, 18, 4, "#fff6c2");
  R(c, x+6, y+9, 20, 12, "#0b0b16"); R(c, x+7, y+10, 18, 10, "#163a5c");
  R(c, x+10, y+16, 3, 3, "#ffe27a"); R(c, x+18, y+12, 4, 2, "#ff6b6b"); R(c, x+8, y+19, 16, 1, "#4fbf5a");
  R(c, x+5, y+22, 22, 6, "#36335a"); R(c, x+9, y+23, 2, 3, "#bbb"); R(c, x+8, y+22, 4, 2, "#e8443a"); R(c, x+17, y+24, 3, 3, "#ffd23f"); R(c, x+22, y+24, 3, 3, "#3ee6ff");
}
function drawDesk(c, tx, ty){
  const x = tx*T, y = ty*T, W = 4*T;
  R(c, x+1, y+3, W-2, 10, "#8a5a2b"); R(c, x+1, y+3, W-2, 3, "#a8733a"); R(c, x+3, y+13, 3, 3, "#5e3b1a"); R(c, x+W-6, y+13, 3, 3, "#5e3b1a");
  R(c, x+8, y-6, 16, 10, "#2b2b3a"); R(c, x+9, y-5, 14, 7, "#7fd1ff"); R(c, x+15, y+3, 2, 1, "#2b2b3a");
  R(c, x+34, y, 10, 4, "#fff"); R(c, x+35, y+1, 8, 1, "#9a9aa8"); R(c, x+48, y-2, 3, 6, "#ffd23f");
}
function drawRug(c, tx, ty, w, h){ const x = tx*T, y = ty*T; R(c, x+2, y+2, w*T-4, h*T-4, "#b23b4e"); R(c, x+5, y+5, w*T-10, h*T-10, "#d6566b"); R(c, x+8, y+8, w*T-16, h*T-16, "#b23b4e"); }
function drawMat(c, tx, ty){ const x = tx*T, y = ty*T; R(c, x, y, 2*T, T, "#6b4a2b"); R(c, x+3, y+3, 2*T-6, T-6, "#c9a86c"); }
function drawPlant(c, tx, ty){ const x = tx*T, y = ty*T; R(c, x+5, y+10, 6, 6, "#b5651d"); R(c, x+3, y+3, 10, 8, C.leaf); R(c, x+6, y, 4, 4, C.leaf2); }

/* 플레이어: 16x16, dir 0아래 1왼쪽 2오른쪽 3위, frame 0~2 */
function drawPlayer(c, x, y, dir, frame){
  x = Math.round(x); y = Math.round(y);
  R(c, x+3, y+14, 10, 2, "rgba(0,0,0,.25)");
  const step = frame===1 ? 1 : frame===2 ? -1 : 0;
  // 다리
  if (dir===0 || dir===3){ R(c, x+5, y+12+Math.max(0,step), 2, 3-Math.max(0,step), C.pants); R(c, x+9, y+12+Math.max(0,-step), 2, 3-Math.max(0,-step), C.pants);
    R(c, x+5, y+14, 2, 1, C.shoe); R(c, x+9, y+14, 2, 1, C.shoe); }
  else { R(c, x+6+step, y+12, 2, 3, C.pants); R(c, x+8-step, y+12, 2, 3, C.pants); R(c, x+6+step, y+14, 2, 1, C.shoe); R(c, x+8-step, y+14, 2, 1, C.shoe); }
  // 몸
  R(c, x+4, y+8, 8, 5, C.shirt); R(c, x+4, y+12, 8, 1, "#b8322b");
  if (dir===0 || dir===3){ R(c, x+3, y+9, 1, 3, C.skin); R(c, x+12, y+9, 1, 3, C.skin); }
  else { R(c, dir===1 ? x+7-step : x+8+step, y+9, 2, 3, C.skin); }
  // 머리
  R(c, x+4, y+2, 8, 7, C.skin);
  if (dir===3){ R(c, x+4, y+1, 8, 7, C.hair); }
  else { R(c, x+4, y+1, 8, 3, C.hair); R(c, x+3, y+2, 1, 4, C.hair); R(c, x+12, y+2, 1, 4, C.hair);
    if (dir===0){ R(c, x+6, y+5, 1, 2, C.ink); R(c, x+9, y+5, 1, 2, C.ink); R(c, x+5, y+7, 1, 1, "#ff9e9e"); R(c, x+10, y+7, 1, 1, "#ff9e9e"); }
    if (dir===1){ R(c, x+5, y+5, 1, 2, C.ink); R(c, x+9, y+2, 3, 5, C.hair); }
    if (dir===2){ R(c, x+10, y+5, 1, 2, C.ink); R(c, x+4, y+2, 3, 5, C.hair); } }
}


/* ================= ART 2: 마을 — 부드러운 일러스트 =================
   마을(바깥)은 매끈한 그림, 집 안은 도트 그림이에요.
   좌표 단위: 한 칸 = 32 (그릴 때 화면 크기에 맞게 늘려요) */
const K = 32;
const F = {
  grassTop:"#9fd77a", grassBot:"#86c867", path:"#f3dfb0", pathEdge:"#e4c98e",
  wall:"#fff4de", wall2:"#f1dfbd", trunk:"#8a5a35", leaf:"#3f9a4a", leaf2:"#56b65e",
  winLit:"#ffe58a", win:"#cfeaff", shadow:"rgba(30,60,20,.22)", fence:"#c99a62", fence2:"#e2b57a"
};
const ROOF2 = ["#e5604f","#f0954a","#4f8fe0","#9a6fe0","#ea72a8","#3fb3a6","#d8b23c","#6c7f99"];
function shade(hex, amt){ const n = parseInt(hex.slice(1),16); const f = v => Math.max(0, Math.min(255, Math.round(v + amt*255)));
  return `rgb(${f(n>>16)},${f(n>>8&255)},${f(n&255)})`; }
function rr(c, x, y, w, h, r){ c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else roundRect(c, x, y, w, h, Array.isArray(r) ? r[0] : r); }
function circle(c, x, y, r, col){ c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI*2); c.fill(); }

function fGround(c, m){
  const g = c.createLinearGradient(0, 0, 0, m.H*K); g.addColorStop(0, F.grassTop); g.addColorStop(1, F.grassBot);
  c.fillStyle = g; c.fillRect(0, 0, m.W*K, m.H*K);
  for (let i=0;i<260;i++){ c.fillStyle = "rgba(255,255,255,.18)"; c.beginPath(); c.ellipse(rand(i,1)*m.W*K, rand(2,i)*m.H*K, 6, 3, 0, 0, 7); c.fill(); }
}
function fPaths(c, m){
  // 길 칸을 가로/세로 띠로 묶어서 둥근 모서리로 그려요
  const isP = (x,y) => m.tiles[y*m.W+x] === "path";
  c.fillStyle = F.path; c.strokeStyle = F.pathEdge; c.lineWidth = 3;
  const bands = [];
  for (let y=0;y<m.H;y++){ let x=0; while (x<m.W){ if (!isP(x,y)){ x++; continue; } let e=x; while (e<m.W && isP(e,y)) e++; if (e-x>2) bands.push([x,y,e-x,1]); x=e; } }
  for (let x=0;x<m.W;x++){ let y=0; while (y<m.H){ if (!isP(x,y)){ y++; continue; } let e=y; while (e<m.H && isP(x,e)) e++; if (e-y>2) bands.push([x,y,1,e-y]); y=e; } }
  // 가로 띠, 세로 2칸 띠는 하나로
  const draw = (x,y,w,h,stroke) => { rr(c, x*K+4, y*K+4, w*K-8, h*K-8, 14); c.fill(); if (stroke) c.stroke(); };
  const merged = []; bands.forEach(b => { if (b[2]===1){ const prev = merged.find(o => o[2]>=1 && o[3]===b[3] && o[1]===b[1] && o[0]+o[2]===b[0] && o[3]>1); if (prev){ prev[2]++; return; } } merged.push(b.slice()); });
  merged.forEach(b => draw(...b, true));
  merged.forEach(b => { c.fillRect(b[0]*K+6, b[1]*K+6, b[2]*K-12, b[3]*K-12); });
}
function fFlower(c, tx, ty){
  for (let j=0;j<2;j++){
    const x = tx*K + 6 + rand(tx,ty,j)*20, y = ty*K + 6 + rand(ty,tx,j)*20, col = ["#fff","#ffd84d","#ff8fb5","#c8a6ff"][Math.floor(rand(tx,ty,j+5)*4)];
    for (let k=0;k<5;k++) circle(c, x+Math.cos(k*1.26)*3, y+Math.sin(k*1.26)*3, 2.6, col);
    circle(c, x, y, 1.8, "#ffb02e");
  }
}
function fTree(c, tx, ty){
  const cx = tx*K+16, cy = ty*K+18, s = 1.08;
  c.fillStyle = F.shadow; c.beginPath(); c.ellipse(cx, cy+12*s, 15*s, 6*s, 0, 0, 7); c.fill();
  c.fillStyle = F.trunk; rr(c, cx-3*s, cy, 6*s, 13*s, 2); c.fill();
  circle(c, cx, cy-6*s, 15*s, F.leaf); circle(c, cx-4*s, cy-10*s, 10*s, F.leaf2); circle(c, cx-7*s, cy-14*s, 4*s, "rgba(255,255,255,.35)");
}
function fFence(c, tx, ty){
  const x = tx*K, y = ty*K + K/2;
  c.strokeStyle = F.fence; c.lineWidth = 4; c.lineCap = "round";
  c.beginPath(); c.moveTo(x+2, y-4); c.lineTo(x+K-2, y-4); c.moveTo(x+2, y+6); c.lineTo(x+K-2, y+6); c.stroke();
  for (const dx of [8, 24]){ c.fillStyle = F.fence2; rr(c, x+dx-3, y-14, 6, 26, 3); c.fill(); }
}
function fBoard(c, tx, ty){
  const x = tx*K, y = ty*K;
  c.fillStyle = F.shadow; c.beginPath(); c.ellipse(x+32, y+30, 30, 5, 0, 0, 7); c.fill();
  c.fillStyle = F.trunk; c.fillRect(x+10, y+10, 5, 20); c.fillRect(x+49, y+10, 5, 20);
  c.fillStyle = "#a8703f"; rr(c, x+2, y-6, 60, 26, 6); c.fill(); c.fillStyle = "#fff5dc"; rr(c, x+6, y-2, 52, 18, 4); c.fill();
  [["#ff9a8a",10],["#9ad0ff",24],["#c6f29b",38]].forEach(([col,dx]) => { c.fillStyle = col; rr(c, x+dx, y+1, 11, 12, 2); c.fill(); });
}
function fHouse(c, hx, hy, roof, lit){
  const x = hx*K, y = hy*K, w = 5*K, h = 4*K;
  c.fillStyle = F.shadow; c.beginPath(); c.ellipse(x+w/2, y+h-2, w/2+4, 10, 0, 0, 7); c.fill();
  c.fillStyle = F.wall; rr(c, x+12, y+56, w-24, h-58, 6); c.fill();
  c.fillStyle = F.wall2; c.fillRect(x+12, y+h-14, w-24, 12);
  // 굴뚝
  c.fillStyle = "#b07a5a"; rr(c, x+w-48, y+18, 12, 26, 2); c.fill(); c.fillStyle = "#8d5f45"; rr(c, x+w-50, y+16, 16, 5, 2); c.fill();
  // 지붕
  c.fillStyle = shade(roof, -.18); c.beginPath(); c.moveTo(x+2, y+64); c.lineTo(x+w/2, y+10); c.lineTo(x+w-2, y+64); c.closePath(); c.fill();
  c.fillStyle = roof; c.beginPath(); c.moveTo(x+6, y+58); c.lineTo(x+w/2, y+8); c.lineTo(x+w-6, y+58); c.closePath(); c.fill();
  c.fillStyle = "rgba(255,255,255,.25)"; c.beginPath(); c.moveTo(x+w/2, y+8); c.lineTo(x+w/2-12, y+20); c.lineTo(x+24, y+50); c.lineTo(x+10, y+58); c.closePath(); c.fill();
  // 창문 (제출한 집은 불이 켜져요)
  for (const wx of [x+22, x+w-50]){
    c.fillStyle = "#fff"; rr(c, wx-2, y+74, 32, 26, 6); c.fill();
    c.fillStyle = lit ? F.winLit : F.win; rr(c, wx+1, y+77, 26, 20, 4); c.fill();
    c.fillStyle = "#fff"; c.fillRect(wx+13, y+77, 2, 20); c.fillRect(wx+1, y+86, 26, 2);
    c.fillStyle = shade(roof, -.05); rr(c, wx-4, y+100, 36, 5, 2); c.fill();
  }
  // 문 + 화분
  c.fillStyle = shade(roof, -.25); rr(c, x+w/2-13, y+h-46, 26, 44, [13,13,2,2]); c.fill();
  circle(c, x+w/2+6, y+h-22, 2.5, "#ffd54a");
  c.fillStyle = "#d77a4a"; rr(c, x+w/2-30, y+h-14, 10, 10, 2); c.fill(); circle(c, x+w/2-25, y+h-17, 7, F.leaf2);
  c.fillStyle = "#d77a4a"; rr(c, x+w/2+20, y+h-14, 10, 10, 2); c.fill(); circle(c, x+w/2+25, y+h-17, 7, "#ff8fb5");
}
function fLibrary(c, hx, hy, tw){
  const x = hx*K, y = hy*K, w = tw*K, h = 4*K;
  c.fillStyle = F.shadow; c.beginPath(); c.ellipse(x+w/2, y+h-2, w/2+4, 10, 0, 0, 7); c.fill();
  c.fillStyle = "#f6f1e6"; rr(c, x+8, y+40, w-16, h-42, 4); c.fill();
  c.fillStyle = "#6a7fa8"; c.beginPath(); c.moveTo(x, y+44); c.lineTo(x+w/2, y+10); c.lineTo(x+w, y+44); c.closePath(); c.fill();
  c.fillStyle = "rgba(255,255,255,.18)"; c.beginPath(); c.moveTo(x+w/2, y+10); c.lineTo(x+w/2, y+44); c.lineTo(x, y+44); c.closePath(); c.fill();
  c.fillStyle = "#8597bf"; c.fillRect(x+2, y+40, w-4, 8);
  circle(c, x+w/2, y+30, 7, "#fff"); circle(c, x+w/2, y+30, 4, "#6a7fa8");
  for (let i=0;i<5;i++){ c.fillStyle = "#e2dccb"; rr(c, x+18+i*36, y+54, 12, h-64, 3); c.fill(); }
  c.fillStyle = "#4b5b80"; rr(c, x+w/2-16, y+h-44, 32, 42, [16,16,2,2]); c.fill();
  c.fillStyle = "#d9d2bf"; c.fillRect(x+4, y+h-10, w-8, 8);
}
/* 마을용 주인공 (매끈한 그림). x,y = 칸의 왼쪽 위(단위 K) */
function fPlayer(c, x, y, dir, frame){
  const cx = x+16, by = y+16 + (frame ? -1.5 : 0), leg = frame===1 ? 2 : frame===2 ? -2 : 0;
  c.fillStyle = "rgba(0,0,0,.2)"; c.beginPath(); c.ellipse(cx, y+30, 10, 4, 0, 0, 7); c.fill();
  c.fillStyle = "#2d3e74"; rr(c, cx-7, by+3+Math.max(0,leg), 6, 11-Math.max(0,leg), 3); c.fill(); rr(c, cx+1, by+3+Math.max(0,-leg), 6, 11-Math.max(0,-leg), 3); c.fill();
  c.fillStyle = "#e8443a"; rr(c, cx-9, by-6, 18, 13, 6); c.fill();
  circle(c, cx, by-14, 10, "#ffd7b0");
  c.fillStyle = "#3b2a20"; c.beginPath();
  if (dir===3) c.arc(cx, by-14, 10.5, 0, Math.PI*2); else c.arc(cx, by-17, 10, Math.PI, 0);
  c.fill();
  if (dir===3) return;
  const ex = dir===1 ? -3 : dir===2 ? 3 : 0;
  if (dir!==2) circle(c, cx-4+ex, by-12, 1.6, "#1d1d2b");
  if (dir!==1) circle(c, cx+4+ex, by-12, 1.6, "#1d1d2b");
  if (dir===0){ circle(c, cx-7, by-9, 2, "#ff9e9e"); circle(c, cx+7, by-9, 2, "#ff9e9e"); }
}
function paintVillage(c, m, data){
  fGround(c, m); fPaths(c, m);
  for (let y=0;y<m.H;y++) for (let x=0;x<m.W;x++){ const t = m.tiles[y*m.W+x]; if (t==="flower") fFlower(c,x,y); if (t==="fence") fFence(c,x,y); }
  // 나무와 건물은 위에서 아래 순서로 (앞쪽이 뒤를 가리도록)
  const items = [];
  for (let y=0;y<m.H;y++) for (let x=0;x<m.W;x++) if (m.tiles[y*m.W+x]==="tree") items.push({y:y+1, fn:() => fTree(c,x,y)});
  m.objs.forEach(o => items.push({y:o.y+o.h, fn:() => {
    if (o.kind==="house"){ const stu = data.students[o.idx]; fHouse(c, o.x, o.y, ROOF2[o.idx%ROOF2.length], stu && data.done(stu.repo) > 0); }
    if (o.kind==="library") fLibrary(c, o.x, o.y, o.w);
    if (o.kind==="board") fBoard(c, o.x, o.y);
  }}));
  items.sort((a,b) => a.y-b.y).forEach(it => it.fn());
}

/* ================= MAPS ================= */
function buildVillage(){
  /* 배치: 모든 건물 사이 간격 = 1칸, 가장자리 여백도 1칸으로 통일.
     가운데 길(16~17번 칸)을 기준으로 좌우 대칭이에요. */
  const W = 34, H = 20, tiles = [], solid = new Set(), objs = [];
  const set = (x,y,t) => { tiles[y*W+x] = t; };
  for (let y=0;y<H;y++) for (let x=0;x<W;x++) set(x,y, rand(x,y,7) < .08 ? "flower" : "grass");
  for (let x=0;x<W;x++){ set(x,0,"tree"); set(x,H-1,"tree"); }
  for (let y=0;y<H;y++){ set(0,y,"tree"); set(W-1,y,"tree"); }
  for (let x=1;x<W-1;x++){ set(x,6,"path"); set(x,17,"path"); }
  for (let y=6;y<=18;y++){ set(16,y,"path"); set(17,y,"path"); }
  set(16,19,"path"); set(17,19,"path");      // 마을 입구
  const COLS = [2, 8, 21, 27];               // 집 왼쪽 x (2~6 · 8~12 | 자료실 14~19 | 21~25 · 27~31)
  const housePos = [...COLS.map(x => [x,2]), ...COLS.map(x => [x,13])];
  // 가운데 잔디밭 나무: 좌우 대칭
  [[4,9],[10,10],[7,11],[23,9],[29,10],[26,11]].forEach(([x,y]) => set(x,y,"tree"));
  for (let x=14;x<=19;x++) if (x<16||x>17) set(x,14,"fence");
  const board = {kind:"board", x:13, y:10, w:2, h:1};
  objs.push(board);
  const lib = {kind:"library", x:14, y:2, w:6, h:4, door:[16,5]};
  objs.push(lib);
  housePos.forEach(([hx,hy], i) => objs.push({kind:"house", idx:i, x:hx, y:hy, w:5, h:4, door:[hx+2, hy+3]}));
  for (let y=0;y<H;y++) for (let x=0;x<W;x++){ const t = tiles[y*W+x]; if (t==="tree"||t==="fence") solid.add(x+","+y); }
  objs.forEach(o => { for (let y=o.y;y<o.y+o.h;y++) for (let x=o.x;x<o.x+o.w;x++) solid.add(x+","+y); });
  solid.delete("16,19"); solid.delete("17,19");
  return { W, H, tiles, solid, objs, start:{x:16, y:11, dir:0} };
}
function buildRoom(){
  const W = 14, H = 11, tiles = [], solid = new Set(), objs = [];
  for (let y=0;y<H;y++) for (let x=0;x<W;x++){
    let t = "floor"; if (y<2) t = "iwall"+y; if (x===0||x===W-1) t = "side"; if (y===H-1) t = "side";
    tiles[y*W+x] = t; if (t!=="floor") solid.add(x+","+y);
  }
  // 문 (아래 가운데)
  tiles[(H-1)*W+6] = "exit"; tiles[(H-1)*W+7] = "exit"; solid.delete("6,"+(H-1)); solid.delete("7,"+(H-1));
  [1,3,5,8,10,12].forEach((fx, i) => objs.push({kind:"frame", week:i+1, x:fx, y:0, w:1, h:2, face:[fx,2]}));
  objs.push({kind:"arcade", x:6, y:4, w:2, h:2});
  objs.push({kind:"desk", x:5, y:7, w:4, h:1});
  objs.push({kind:"plant", x:1, y:8, w:1, h:1}); objs.push({kind:"plant", x:12, y:8, w:1, h:1});
  objs.forEach(o => { if (o.kind!=="frame") for (let y=o.y;y<o.y+o.h;y++) for (let x=o.x;x<o.x+o.w;x++) solid.add(x+","+y); });
  return { W, H, tiles, solid, objs, start:{x:7, y:9, dir:3} };
}

/* ================= ENGINE ================= */
let G = null;   // 현재 장면

function stop(){ if (!G) return; cancelAnimationFrame(G.raf); window.removeEventListener("keydown", G.kd); window.removeEventListener("keyup", G.ku); G = null; closeArcade(); }

function start(canvas, opts){
  stop();
  const map = opts.scene === "house" ? buildRoom() : buildVillage();
  const lw = map.W*T, lh = map.H*T;
  const bg = document.createElement("canvas"); bg.width = lw*S; bg.height = lh*S;
  canvas.width = lw*S; canvas.height = lh*S;
  const g = G = { U: opts.scene === "house" ? 0.62 : 1, canvas, ctx:canvas.getContext("2d"), bg, map, opts, keys:[], dialog:null, path:null, t0:performance.now(), raf:0,
    p:{ x:map.start.x, y:map.start.y, dir:map.start.dir, fx:map.start.x*T, fy:map.start.y*T, moving:null, frame:0 } };
  if (opts.scene === "village" && opts.from){                 // 집에서 나오면 그 집 문 앞에서 시작
    const h = map.objs.find(o => o.kind==="house" && o.idx===opts.from);
    if (h){ const below = h.y < 10; g.p.x = h.door[0]; g.p.y = below ? h.door[1]+1 : h.door[1]+1; g.p.dir = 0; g.p.fx = g.p.x*T; g.p.fy = g.p.y*T; }
  }
  paintBg(g);
  g.kd = e => onKey(e, true); g.ku = e => onKey(e, false);
  window.addEventListener("keydown", g.kd); window.addEventListener("keyup", g.ku);
  canvas.onpointerdown = e => onPointer(e);
  const loop = now => { if (G !== g) return; update(g, now); draw(g, now); g.raf = requestAnimationFrame(loop); };
  g.raf = requestAnimationFrame(loop);
  if (opts.intro) setTimeout(() => { if (G===g && !g.dialog) say(opts.intro); }, 300);
}

function paintBg(g){
  const m = g.map, o = g.opts, out = g.bg.getContext("2d");
  if (o.scene === "village"){                       // 마을: 매끈한 일러스트
    out.save(); out.scale(S*T/K, S*T/K); paintVillage(out, m, o.data); out.restore(); return;
  }
  const lowBg = document.createElement("canvas"); lowBg.width = m.W*T; lowBg.height = m.H*T;   // 집 안: 도트 그림
  const c = lowBg.getContext("2d");
  for (let y=0;y<m.H;y++) for (let x=0;x<m.W;x++){
    const t = m.tiles[y*m.W+x];
    if (t==="floor") drawFloor(c,x,y); else if (t==="iwall0") drawIWall(c,x,y,0); else if (t==="iwall1") drawIWall(c,x,y,1);
    else if (t==="side") drawSide(c,x,y); else if (t==="exit") drawFloor(c,x,y);
  }
  drawRug(c, 4, 3, 6, 4); drawMat(c, 6, m.H-1);
  const st = o.data;
  m.objs.forEach(ob => {
    if (ob.kind==="frame"){ const w = st.week(ob.week); const s = st.state(o.repo, ob.week); drawFrame(c, ob.x, ob.y, s.cls ? (s.cls==="v2"?"v2":"v1") : (s.last ? "v1" : null), w && w.game, ROOF[o.idx%ROOF.length]); }
    if (ob.kind==="arcade") drawArcade(c, ob.x, ob.y, ROOF[o.idx%ROOF.length]);
    if (ob.kind==="desk") drawDesk(c, ob.x, ob.y);
    if (ob.kind==="plant") drawPlant(c, ob.x, ob.y);
  });
  out.imageSmoothingEnabled = false; out.drawImage(lowBg, 0, 0, g.bg.width, g.bg.height);
}

const DIRS = { ArrowDown:0, KeyS:0, ArrowLeft:1, KeyA:1, ArrowRight:2, KeyD:2, ArrowUp:3, KeyW:3 };
const DV = [[0,1],[-1,0],[1,0],[0,-1]];
function onKey(e, down){
  const g = G; if (!g) return;
  const tag = (document.activeElement && document.activeElement.tagName) || "";
  if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
  if (document.getElementById("arcadeBox")){ if (down && e.code==="Escape") closeArcade(); return; }
  const d = DIRS[e.code];
  if (d !== undefined){ e.preventDefault();
    if (down){ if (g.dialog){ if (g.dialog.choices && (d===0||d===3)) moveSel(d===0?1:-1); return; }
      g.path = null; g.tap = d; if (!g.keys.includes(d)) g.keys.push(d); }
    else g.keys = g.keys.filter(k => k!==d);
    return; }
  if (!down) return;
  if (e.code==="Space" || e.code==="Enter" || e.code==="KeyZ"){ e.preventDefault(); g.dialog ? confirm() : interact(); }
  if (e.code==="Escape" || e.code==="KeyX"){ if (g.dialog) closeDialog(); }
}
function blocked(g, x, y){ const m = g.map; if (x<0||y<0||x>=m.W||y>=m.H) return true; return m.solid.has(x+","+y); }
function objAt(g, x, y){ return g.map.objs.find(o => x>=o.x && x<o.x+o.w && y>=o.y && y<o.y+o.h); }

function update(g, now){
  const p = g.p;
  if (p.moving){
    const k = Math.min(1, (now - p.moving.t) / STEP_MS);
    p.fx = (p.moving.sx + (p.x - p.moving.sx)*k) * T; p.fy = (p.moving.sy + (p.y - p.moving.sy)*k) * T;
    p.frame = k < .5 ? (p.moving.alt ? 1 : 2) : 0;
    if (k >= 1){ p.moving = null; p.fx = p.x*T; p.fy = p.y*T; arrived(g); }
    return;
  }
  if (g.dialog) return;
  let d = g.keys.length ? g.keys[g.keys.length-1] : (g.tap ?? null); g.tap = null;
  if (d === null && g.path && g.path.length){
    const [nx, ny] = g.path[0];
    d = DV.findIndex(([dx,dy]) => p.x+dx===nx && p.y+dy===ny);
    if (d < 0){ g.path = null; return; }
    g.path.shift();
  } else if (d === null && g.path && !g.path.length){
    const o = g.pathObj; g.path = null; g.pathObj = null;
    if (o){ let fd = o.door ? 3 : DV.findIndex(([dx,dy]) => objAt(g, p.x+dx, p.y+dy) === o); if (o.face) fd = 3; if (fd>=0){ p.dir = fd; interact(); } }
    return;
  }
  if (d === null) return;
  p.dir = d;
  const nx = p.x + DV[d][0], ny = p.y + DV[d][1];
  if (blocked(g, nx, ny)){
    if (g.path){ g.path = null; return; }
    // 문 앞에서 ↑ 키를 누르면 바로 들어가요
    const o = d === 3 ? objAt(g, nx, ny) : null;
    if (o && o.door && nx === o.door[0] && ny === o.door[1] && !g.knock){
      g.keys = []; g.knock = true; setTimeout(() => { g.knock = false; }, 400);
      if (o.kind === "house" && g.opts.actions.houseInfo(o.idx)) g.opts.actions.enterHouse(o.idx);
      else interact();
    }
    return; }
  p.moving = { sx:p.x, sy:p.y, t:now, alt:!(p.moving && p.moving.alt) && !p.lastAlt };
  p.lastAlt = p.moving.alt; p.x = nx; p.y = ny;
}
function arrived(g){
  const m = g.map, p = g.p;
  if (g.opts.scene === "house" && m.tiles[p.y*m.W+p.x] === "exit"){ g.keys = []; g.opts.onExit && g.opts.onExit(); }
  if (g.opts.scene === "village" && p.y === m.H-1){ g.p.y = m.H-2; g.p.fy = g.p.y*T; say(["마을 밖은 아직 공사 중이에요. 🚧"]); }
}

function interact(){
  const g = G, p = g.p, tx = p.x + DV[p.dir][0], ty = p.y + DV[p.dir][1];
  const o = objAt(g, tx, ty); if (!o) return;
  const A = g.opts.actions;
  if (o.kind==="house"){ if (!(tx===o.door[0] && ty===o.door[1])) return say(["창문 너머로 누군가의 작업실이 보여요."]);
    const info = A.houseInfo(o.idx); if (!info) return say(["아직 주인이 없는 빈집이에요."]);
    return say([info.title, info.sub], [{label:"들어간다", fn:() => A.enterHouse(o.idx)}, {label:"그만둔다"}]); }
  if (o.kind==="library"){ if (!(tx===o.door[0] && ty===o.door[1])) return say(["커다란 도서관이에요. 문은 가운데에 있어요."]);
    return say(["📚 수업 자료실", "주차별 학습지와 수업 자료가 있어요."], [{label:"들어간다", fn:A.openMaterials}, {label:"그만둔다"}]); }
  if (o.kind==="board") return say(["📊 마을 게시판", A.boardText()], [{label:"전체 현황 보기", fn:A.openStatus}, {label:"닫기"}]);
  if (o.kind==="frame") return A.frame(o.week);
  if (o.kind==="arcade") return A.arcade();
  if (o.kind==="desk") return A.desk();
  if (o.kind==="plant") return say(["싱그러운 화분이에요. 🌱"]);
}

/* ---------- 대화창 ---------- */
function say(lines, choices){ if (!G) return; G.keys = []; G.path = null; G.dialog = { lines:lines.filter(Boolean), choices: choices && choices.length ? choices : null, sel:0, rects:[] }; }
function moveSel(d){ const dl = G.dialog; dl.sel = (dl.sel + d + dl.choices.length) % dl.choices.length; }
function closeDialog(){ if (G) G.dialog = null; }
function confirm(){
  const dl = G.dialog; if (!dl) return;
  if (!dl.choices){ G.dialog = null; return; }
  const ch = dl.choices[dl.sel]; G.dialog = null; if (ch && ch.fn) ch.fn();
}

/* ---------- 클릭/터치 이동 ---------- */
function onPointer(e){
  const g = G; if (!g) return; e.preventDefault(); g.canvas.focus && g.canvas.focus();
  const r = g.canvas.getBoundingClientRect(); const cx = (e.clientX - r.left) * g.canvas.width / r.width, cy = (e.clientY - r.top) * g.canvas.height / r.height;
  if (g.dialog){
    if (g.dialog.choices){ const i = g.dialog.rects.findIndex(b => cx>=b[0] && cx<=b[0]+b[2] && cy>=b[1] && cy<=b[1]+b[3]); if (i>=0){ g.dialog.sel = i; confirm(); } }
    else confirm();
    return;
  }
  const tx = Math.floor(cx / (T*S)), ty = Math.floor(cy / (T*S));
  if (tx === g.p.x && ty === g.p.y) return;
  if (blocked(g, tx, ty)){
    const o = objAt(g, tx, ty); if (!o) return;
    let cands = [];
    if (o.face) cands = [o.face];
    else if (o.door) cands = [[o.door[0], o.door[1]+1]];
    else for (let y=o.y;y<o.y+o.h;y++) for (let x=o.x;x<o.x+o.w;x++) DV.forEach(([dx,dy]) => { const nx=x+dx, ny=y+dy; if (!blocked(g,nx,ny)) cands.push([nx,ny]); });
    let best = null; for (const cnd of cands){ const pth = bfs(g, [g.p.x,g.p.y], cnd); if (pth && (!best || pth.length < best.length)) best = pth; }
    if (!best) return; g.path = best; g.pathObj = o; return;
  }
  const pth = bfs(g, [g.p.x,g.p.y], [tx, ty]); if (pth){ g.path = pth; g.pathObj = null; }
}
function bfs(g, s, e){
  if (s[0]===e[0] && s[1]===e[1]) return [];
  const key = (x,y) => x+","+y, prev = new Map([[key(s[0],s[1]), null]]), q = [s];
  while (q.length){ const [x,y] = q.shift();
    for (const [dx,dy] of DV){ const nx=x+dx, ny=y+dy, k=key(nx,ny); if (prev.has(k) || blocked(g,nx,ny)) continue; prev.set(k,[x,y]);
      if (nx===e[0] && ny===e[1]){ const out=[[nx,ny]]; let c=[x,y]; while (c && !(c[0]===s[0]&&c[1]===s[1])){ out.unshift(c); c = prev.get(key(c[0],c[1])); } return out; }
      q.push([nx,ny]); } }
  return null;
}

/* ---------- 그리기 ---------- */
function draw(g, now){
  const c = g.ctx, p = g.p, fr = p.moving ? p.frame : 0;
  c.imageSmoothingEnabled = true; c.drawImage(g.bg, 0, 0);
  if (g.opts.scene==="village"){
    c.save(); c.scale(S*T/K, S*T/K);
    // 굴뚝 연기 (제출한 집)
    g.map.objs.forEach(o => { if (o.kind!=="house") return; const stu = g.opts.data.students[o.idx]; if (!stu || !g.opts.data.done(stu.repo)) return;
      for (let i=0;i<3;i++){ const k = ((now/1400) + i/3) % 1; circle(c, o.x*K + 5*K-42 + Math.sin(k*6+i)*4, o.y*K + 14 - k*26, 3 + k*5, `rgba(255,255,255,${.75*(1-k)})`); } });
    fPlayer(c, p.fx*K/T, p.fy*K/T, p.dir, fr);
    c.restore();
  } else {
    c.save(); c.scale(S, S); drawPlayer(c, p.fx, p.fy, p.dir, fr); c.restore();
  }
  labels(g, c);
  if (g.dialog) drawDialog(g, c);
}
function font(px, bold){ return `${bold?"700 ":""}${px}px Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`; }
function tag(c, text, cx, y, bg, fg, pill){
  const u = G ? G.U : 1; c.font = font(16*S/2*u, true); const w = c.measureText(text).width + (pill ? 18 : 12)*S/2*u, h = 22*S/2*u;
  c.fillStyle = bg; roundRect(c, cx - w/2, y, w, h, pill ? h/2 : 6); c.fill();
  if (pill){ c.lineWidth = 1.5; c.strokeStyle = "rgba(40,40,70,.18)"; c.stroke(); } c.fillStyle = fg; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(text, cx, y + h/2 + 1); c.textAlign = "left";
}
function labels(g, c){
  const d = g.opts.data;
  if (g.opts.scene==="village"){
    g.map.objs.forEach(o => {
      if (o.kind==="house"){ const stu = d.students[o.idx]; if (!stu) return; const n = d.done(stu.repo);
        tag(c, `${d.label(stu)}${n ? "  ★"+n : ""}`, (o.x+2.5)*T*S, (o.y*T - 4)*S - 12, "rgba(255,255,255,.95)", n ? "#c2410c" : "#2b2d4a", true); }
      if (o.kind==="library") tag(c, "📚 자료실", (o.x+o.w/2)*T*S, (o.y*T - 1)*S - 12, "rgba(255,255,255,.95)", "#2b2d4a", true);
      if (o.kind==="board") tag(c, "📊 게시판", (o.x+1)*T*S, (o.y*T - 10)*S - 12, "rgba(255,255,255,.95)", "#2b2d4a", true);
    });
  } else {
    g.map.objs.forEach(o => { if (o.kind==="frame") tag(c, `${o.week}주`, (o.x+.5)*T*S, (2*T - 1)*S - 8, "rgba(20,18,40,.75)", "#fff"); });
    const a = g.map.objs.find(o => o.kind==="arcade"); tag(c, "🎮 게임기", (a.x+1)*T*S, (a.y*T - 2)*S - 12, "rgba(20,18,40,.82)", "#ffe27a");
    const k = g.map.objs.find(o => o.kind==="desk"); tag(c, "✏️ 책상", (k.x+2)*T*S, ((k.y+1)*T + 1)*S, "rgba(20,18,40,.82)", "#fff");
    tag(c, "🚪 마을로", 7*T*S, (g.map.H*T - 6)*S - 12, "rgba(20,18,40,.82)", "#fff");
  }
}
function roundRect(c, x, y, w, h, r){ c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); }
function windowBox(c, x, y, w, h){
  const grd = c.createLinearGradient(0, y, 0, y+h); grd.addColorStop(0, "rgba(34,40,92,.94)"); grd.addColorStop(1, "rgba(16,18,52,.94)");
  c.fillStyle = grd; roundRect(c, x, y, w, h, 10); c.fill(); c.lineWidth = 3; c.strokeStyle = "#e9ecff"; c.stroke();
  c.lineWidth = 1; c.strokeStyle = "rgba(160,170,255,.6)"; roundRect(c, x+5, y+5, w-10, h-10, 7); c.stroke();
}
function drawDialog(g, c){
  const dl = g.dialog, W = g.canvas.width, H = g.canvas.height, u = g.U, pad = Math.round(8*S*u), fs = Math.round(10*S*u), lh = Math.round(15*S*u);
  const boxH = pad*2 + lh*Math.max(2, dl.lines.length) - (lh - fs);
  const bx = 6*S, by = H - boxH - 6*S, bw = W - 12*S;
  windowBox(c, bx, by, bw, boxH);
  c.font = font(fs, false); c.fillStyle = "#fff"; c.textBaseline = "top";
  dl.lines.forEach((t, i) => c.fillText(t, bx + pad, by + pad + i*lh, bw - pad*2));
  if (!dl.choices){ if (Math.floor(performance.now()/400)%2) { c.fillStyle = "#fff"; c.fillText("▼", bx + bw - pad - fs, by + boxH - pad - fs + 4); } return; }
  c.font = font(fs, true);
  const cw = Math.max(...dl.choices.map(ch => c.measureText(ch.label).width)) + pad*2 + fs*1.4;
  const ch = pad*2 + lh*dl.choices.length - (lh - fs);
  const cx = W - cw - 6*S, cy = by - ch - 4*S;
  windowBox(c, cx, cy, cw, ch);
  dl.rects = [];
  dl.choices.forEach((o, i) => {
    const yy = cy + pad + i*lh; dl.rects.push([cx, yy - (lh-fs)/2, cw, lh]);
    if (i === dl.sel){ c.fillStyle = "rgba(255,255,255,.16)"; c.fillRect(cx + 6, yy - (lh-fs)/2, cw - 12, lh); c.fillStyle = "#ffe27a"; c.fillText("▶", cx + pad, yy); }
    c.fillStyle = i === dl.sel ? "#ffe27a" : "#fff"; c.fillText(o.label, cx + pad + fs*1.4, yy);
  });
}

/* ---------- 오락기 화면 (HTML 오버레이) ---------- */
function openArcade(url, title){
  closeArcade();
  const box = document.createElement("div"); box.id = "arcadeBox";
  box.innerHTML = `<div class="arcade-panel"><div class="arcade-top"><b>🎮 ${title}</b><span><a href="${url}" target="_blank" rel="noopener">새 탭으로 ↗</a><button type="button">닫기 ✕ (Esc)</button></span></div><iframe src="${url}" title="게임" allow="fullscreen; gamepad; autoplay"></iframe></div>`;
  box.querySelector("button").onclick = closeArcade;
  const fr = box.querySelector("iframe");
  const hook = w => { try { w.addEventListener("keydown", e => { if (e.key === "Escape") closeArcade(); });
    w.addEventListener("load", () => {}, {once:true}); w.document.querySelectorAll("iframe").forEach(f => { try { hook(f.contentWindow); f.addEventListener("load", () => hook(f.contentWindow)); } catch(_){} }); } catch(_){} };
  fr.addEventListener("load", () => { hook(fr.contentWindow); setTimeout(() => hook(fr.contentWindow), 1500); });
  box.onclick = e => { if (e.target === box) closeArcade(); };
  document.body.appendChild(box);
}
function closeArcade(){ const b = document.getElementById("arcadeBox"); if (b) b.remove(); }

window.Town = { start, stop, say, openArcade, closeArcade };
})();
