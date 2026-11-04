/* 온고 게임제작반 마을 — 탑다운 마을 / 학생 집 (그림은 모두 코드로 그려요)
   마을 = ART 2(부드러운 일러스트), 집 안 = ART(도트). 그림을 바꾸려면 ART 부분의 함수만 바꾸면 됩니다. */
(function(){
"use strict";
const T = 16;          // 타일 한 칸 = 16px (화면에서는 S배로 확대)
const S = 3;           // 확대 배율 (선명한 도트를 위해 정수)
const STEP_MS = 150;   // 한 칸 걷는 시간

const rand = (x, y, k=0) => { const n = Math.sin(x*127.1 + y*311.7 + k*74.7) * 43758.5453; return n - Math.floor(n); };
/* ================= ART: 부드러운 일러스트 (마을 + 작업실) =================
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

/* ---------- 작업실(집 안) ---------- */
function fRoomShell(c, m, accent){
  const W = m.W*K, H = m.H*K;
  // 마룻바닥
  c.fillStyle = "#e3b27c"; c.fillRect(0, 0, W, H);
  for (let y=2*K; y<H; y+=16){ const row = (y/16)|0;
    c.fillStyle = row%2 ? "#dcaa73" : "#e6b882"; c.fillRect(0, y, W, 16);
    c.fillStyle = "rgba(120,70,30,.18)"; c.fillRect(0, y+15, W, 1);
    for (let x = (row%3)*37; x < W; x += 112) c.fillRect(x, y, 1, 15); }
  // 뒷벽 (벽지 + 굽도리)
  c.fillStyle = "#fbf3e2"; c.fillRect(0, 0, W, 2*K);
  for (let x=8; x<W; x+=24){ c.fillStyle = "rgba(230,200,160,.35)"; c.fillRect(x, 0, 8, 2*K-10); }
  c.fillStyle = "#c98f5a"; c.fillRect(0, 2*K-10, W, 10); c.fillStyle = "#e0a96f"; c.fillRect(0, 2*K-10, W, 3);
  c.fillStyle = "rgba(90,50,20,.15)"; c.fillRect(0, 2*K, W, 6);
  // 옆벽·아랫벽 (위에서 본 두꺼운 벽)
  const wall = (x,y,w,h) => { c.fillStyle = "#8b5e3c"; c.fillRect(x,y,w,h); };
  wall(0, 0, K, H); wall(W-K, 0, K, H); wall(0, H-K, W, K);
  c.fillStyle = "#a8774f"; c.fillRect(K-6, 0, 6, H-K); c.fillRect(W-K, 0, 6, H-K); c.fillRect(K-6, H-K, W-2*K+12, 6);
  // 문 (아래 가운데 출구 칸)
  for (let x=0;x<m.W;x++) if (m.tiles[(m.H-1)*m.W+x]==="exit"){
    c.fillStyle = "#e3b27c"; c.fillRect(x*K, H-K, K, K);
    c.fillStyle = "#6b4426"; c.fillRect(x*K-4, H-K, 4, K); c.fillRect(x*K+K, H-K, 4, K);
    c.fillStyle = "#7fb76a"; c.fillRect(x*K, H-10, K, 10); }
}
function fRug(c, tx, ty, w, h, accent){
  const x = tx*K, y = ty*K, W = w*K, H = h*K;
  c.fillStyle = "rgba(90,50,20,.15)"; rr(c, x+4, y+6, W, H, 18); c.fill();
  c.fillStyle = "#f6e7c8"; rr(c, x, y, W, H, 18); c.fill();
  c.fillStyle = accent; rr(c, x+8, y+8, W-16, H-16, 12); c.fill();
  c.fillStyle = "rgba(255,255,255,.22)"; rr(c, x+16, y+16, W-32, H-32, 8); c.fill();
  for (let i=0;i<7;i++){ circle(c, x+W/2 + (i-3)*22, y+H-24, 3, "rgba(255,255,255,.55)"); circle(c, x+W/2 + (i-3)*22, y+24, 3, "rgba(255,255,255,.55)"); }
}
function fMat(c, tx, ty){ const x = tx*K, y = ty*K; c.fillStyle = "#b5835a"; rr(c, x-10, y-6, K+20, 16, 7); c.fill(); c.fillStyle = "#d8a777"; rr(c, x-6, y-3, K+12, 10, 5); c.fill(); }
/* 액자: st = null(빈 액자) | "v1" | "v2" */
function fFrame(c, tx, ty, st, isGame, accent){
  const cx = tx*K + 16, x = cx-22, y = 7, w = 44, h = 40;
  c.strokeStyle = "#a0714a"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(cx, 3); c.lineTo(x+8, y+2); c.moveTo(cx, 3); c.lineTo(x+w-8, y+2); c.stroke();
  circle(c, cx, 3, 2.5, "#8b5e3c");
  c.fillStyle = "rgba(90,50,20,.18)"; rr(c, x+2, y+4, w, h, 6); c.fill();
  c.fillStyle = st ? "#e9b44c" : "#d9c7a6"; rr(c, x, y, w, h, 6); c.fill();
  c.fillStyle = st ? "#fff8e6" : "#efe4cf"; rr(c, x+5, y+5, w-10, h-10, 3); c.fill();
  if (!st){ c.fillStyle = "#c8b48f"; rr(c, cx-1.5, y+13, 3, 14, 1.5); c.fill(); rr(c, cx-7, y+18.5, 14, 3, 1.5); c.fill(); return; }
  if (isGame){
    c.fillStyle = "#2a3b6e"; rr(c, x+5, y+5, w-10, h-10, 3); c.fill();
    c.fillStyle = "#58c46a"; c.fillRect(x+5, y+h-12, w-10, 7);
    circle(c, x+15, y+h-16, 4, "#ffd84d"); c.fillStyle = "#ff7a7a"; rr(c, x+22, y+13, 8, 5, 2); c.fill();
    circle(c, x+28, y+11, 1.2, "#fff"); circle(c, x+12, y+12, 1, "#fff");
  } else {
    c.fillStyle = accent; rr(c, x+10, y+11, 20, 3, 1.5); c.fill();
    c.fillStyle = "#c9c2b4"; for (let i=0;i<3;i++){ rr(c, x+10, y+18+i*5, i===2 ? 12 : 20, 2.5, 1.2); c.fill(); }
  }
  circle(c, x+w-6, y+h-6, 6, st === "v2" ? "#3b82f6" : "#22c55e");
  c.strokeStyle = "#fff"; c.lineWidth = 2; c.lineCap = "round"; c.lineJoin = "round";
  c.beginPath(); c.moveTo(x+w-9, y+h-6); c.lineTo(x+w-6.5, y+h-3.5); c.lineTo(x+w-3, y+h-8.5); c.stroke();
}
function fArcade(c, tx, ty, tw, accent){
  const cx = tx*K + tw*K/2, top = ty*K - 6, w = 54, x = cx - w/2, h = 2*K + 4;
  c.fillStyle = "rgba(60,30,20,.22)"; c.beginPath(); c.ellipse(cx, top+h, w/2+6, 8, 0, 0, 7); c.fill();
  c.fillStyle = shade(accent, -.25); rr(c, x, top, w, h, 10); c.fill();
  c.fillStyle = accent; rr(c, x+4, top+3, w-8, h-6, 8); c.fill();
  c.fillStyle = "#fff6d6"; rr(c, x+9, top+7, w-18, 9, 4); c.fill();
  c.fillStyle = shade(accent, -.15); rr(c, x+18, top+10, w-36, 3, 1.5); c.fill();
  c.fillStyle = "#1f2440"; rr(c, x+7, top+20, w-14, 24, 5); c.fill();
  const sg = c.createLinearGradient(0, top+22, 0, top+42); sg.addColorStop(0, "#3f6fd8"); sg.addColorStop(1, "#22408f");
  c.fillStyle = sg; rr(c, x+10, top+23, w-20, 18, 3); c.fill();
  c.fillStyle = "#6ee07a"; c.fillRect(x+10, top+37, w-20, 4); circle(c, x+20, top+33, 3, "#ffd84d"); c.fillStyle = "#ff7a7a"; rr(c, x+30, top+27, 7, 4, 1.5); c.fill();
  c.fillStyle = "rgba(255,255,255,.25)"; c.beginPath(); c.moveTo(x+10, top+23); c.lineTo(x+20, top+23); c.lineTo(x+10, top+33); c.closePath(); c.fill();
  c.fillStyle = shade(accent, -.12); rr(c, x+5, top+47, w-10, 14, 5); c.fill();
  c.fillStyle = "#333"; c.fillRect(x+14, top+50, 2, 6); circle(c, x+15, top+50, 3.5, "#e8443a");
  circle(c, x+30, top+54, 3, "#ffd84d"); circle(c, x+39, top+54, 3, "#3ee6ff");
}
function fDesk(c, tx, ty, tw){
  const x = tx*K + 6, y = ty*K - 4, w = tw*K - 12, h = 26;
  c.fillStyle = "rgba(60,30,20,.2)"; rr(c, x+2, y+h-2, w, 10, 5); c.fill();
  c.fillStyle = "#8a5a35"; c.fillRect(x+6, y+h-4, 6, 12); c.fillRect(x+w-12, y+h-4, 6, 12);
  c.fillStyle = "#b07a4a"; rr(c, x, y+4, w, h-4, 6); c.fill();
  c.fillStyle = "#c98f5a"; rr(c, x, y, w, 10, 5); c.fill();
  // 노트북
  const lx = x + 18; c.fillStyle = "#3a3f55"; rr(c, lx, y-22, 38, 26, 4); c.fill();
  c.fillStyle = "#8fd3ff"; rr(c, lx+3, y-19, 32, 19, 2); c.fill();
  c.fillStyle = "#fff"; c.fillRect(lx+7, y-15, 16, 2); c.fillRect(lx+7, y-11, 22, 2); c.fillRect(lx+7, y-7, 12, 2);
  c.fillStyle = "#5a6078"; rr(c, lx-4, y+2, 46, 5, 2); c.fill();
  // 공책 + 연필꽂이 + 스탠드
  c.save(); c.translate(x+w/2+22, y+3); c.rotate(-.12); c.fillStyle = "#fff"; rr(c, 0, -2, 26, 10, 2); c.fill();
  c.fillStyle = "#ffb3c1"; c.fillRect(0, -2, 4, 10); c.restore();
  c.fillStyle = "#6fa8dc"; rr(c, x+w-30, y-10, 10, 14, 2); c.fill();
  c.fillStyle = "#ffd84d"; c.fillRect(x+w-28, y-18, 2, 9); c.fillStyle = "#ff7a7a"; c.fillRect(x+w-24, y-16, 2, 7);
  c.fillStyle = "#fff6c2"; c.beginPath(); c.moveTo(x+w-50, y-22); c.lineTo(x+w-38, y-22); c.lineTo(x+w-35, y-12); c.lineTo(x+w-53, y-12); c.closePath(); c.fill();
  c.fillStyle = "#777"; c.fillRect(x+w-45, y-12, 2, 14);
}
function fPlant(c, tx, ty){
  const cx = tx*K + 16, by = ty*K + 28;
  c.fillStyle = "rgba(60,30,20,.2)"; c.beginPath(); c.ellipse(cx, by, 12, 4, 0, 0, 7); c.fill();
  c.fillStyle = "#d77a4a"; c.beginPath(); c.moveTo(cx-10, by-14); c.lineTo(cx+10, by-14); c.lineTo(cx+7, by); c.lineTo(cx-7, by); c.closePath(); c.fill();
  c.fillStyle = "#c06a3e"; rr(c, cx-11, by-16, 22, 5, 2); c.fill();
  [[-8,-22,7],[7,-23,7],[0,-30,8],[-3,-21,6],[4,-34,5]].forEach(([dx,dy,r],i) => circle(c, cx+dx, by+dy, r, i%2 ? F.leaf2 : F.leaf));
  circle(c, cx-2, by-32, 2.5, "rgba(255,255,255,.35)");
}
function paintRoom(c, m, o){
  const accent = ROOF2[o.idx % ROOF2.length], st = o.data;
  fRoomShell(c, m, accent);
  const rug = m.rug; fRug(c, rug.x, rug.y, rug.w, rug.h, accent);
  m.objs.forEach(ob => { if (ob.kind==="exit") fMat(c, ob.x, ob.y); });
  m.objs.slice().sort((a,b) => (a.y+a.h)-(b.y+b.h)).forEach(ob => {
    if (ob.kind==="frame"){ const w = st.week(ob.week), s = st.state(o.repo, ob.week); fFrame(c, ob.x, ob.y, s.cls ? (s.cls==="v2" ? "v2" : "v1") : (s.last ? "v1" : null), w && w.game, accent); }
    if (ob.kind==="arcade") fArcade(c, ob.x, ob.y, ob.w, accent);
    if (ob.kind==="desk") fDesk(c, ob.x, ob.y, ob.w);
    if (ob.kind==="plant") fPlant(c, ob.x, ob.y);
  });
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
  /* 작업실: 가로 15칸 (가운데 = 7번 칸). 액자는 2~6주차 5개를 같은 간격으로 걸어요. */
  const W = 15, H = 11, tiles = [], solid = new Set(), objs = [];
  for (let y=0;y<H;y++) for (let x=0;x<W;x++){
    let t = "floor"; if (y<2) t = "wall"; if (x===0||x===W-1||y===H-1) t = "side";
    tiles[y*W+x] = t; if (t!=="floor") solid.add(x+","+y);
  }
  const DOOR = 7; tiles[(H-1)*W+DOOR] = "exit"; solid.delete(DOOR+","+(H-1));
  [1,4,7,10,13].forEach((fx, i) => objs.push({kind:"frame", week:i+2, x:fx, y:0, w:1, h:2, face:[fx,2]}));
  objs.push({kind:"arcade", x:6, y:4, w:3, h:2});
  objs.push({kind:"desk", x:5, y:7, w:5, h:1});
  objs.push({kind:"plant", x:1, y:8, w:1, h:1}); objs.push({kind:"plant", x:13, y:8, w:1, h:1});
  objs.forEach(o => { if (o.kind!=="frame") for (let y=o.y;y<o.y+o.h;y++) for (let x=o.x;x<o.x+o.w;x++) solid.add(x+","+y); });
  objs.push({kind:"exit", x:DOOR, y:H-1, w:0, h:0});
  return { W, H, tiles, solid, objs, rug:{x:4, y:3, w:7, h:4}, start:{x:DOOR, y:9, dir:3} };
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
  out.save(); out.scale(S*T/K, S*T/K);
  if (o.scene === "village") paintVillage(out, m, o.data); else paintRoom(out, m, o);
  out.restore();
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
  c.save(); c.scale(S*T/K, S*T/K);
  if (g.opts.scene==="village"){
    // 굴뚝 연기 (제출한 집)
    g.map.objs.forEach(o => { if (o.kind!=="house") return; const stu = g.opts.data.students[o.idx]; if (!stu || !g.opts.data.done(stu.repo)) return;
      for (let i=0;i<3;i++){ const k = ((now/1400) + i/3) % 1; circle(c, o.x*K + 5*K-42 + Math.sin(k*6+i)*4, o.y*K + 14 - k*26, 3 + k*5, `rgba(255,255,255,${.75*(1-k)})`); } });
  }
  fPlayer(c, p.fx*K/T, p.fy*K/T, p.dir, fr);
  c.restore();
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
    const W = "rgba(255,255,255,.95)", D = "#2b2d4a";
    g.map.objs.forEach(o => { if (o.kind==="frame") tag(c, `${o.week}주`, (o.x+.5)*T*S, (2*T - 5)*S - 10, W, D, true); });
    const a = g.map.objs.find(o => o.kind==="arcade"); tag(c, "🎮 게임기", (a.x+a.w/2)*T*S, (a.y*T - 6)*S - 12, W, D, true);
    const k = g.map.objs.find(o => o.kind==="desk"); tag(c, "✏️ 책상", (k.x+k.w/2)*T*S, ((k.y+1)*T + 3)*S, W, D, true);
    const e = g.map.objs.find(o => o.kind==="exit"); tag(c, "🚪 마을로", (e.x+.5)*T*S, (g.map.H*T - 6)*S - 12, W, D, true);
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
