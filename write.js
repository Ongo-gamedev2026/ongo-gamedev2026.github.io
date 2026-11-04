/* 작성하기 페이지
   학생 저장소의 md 문서를 입력칸이 있는 양식으로 보여 주고,
   저장하면 GitHub에 커밋, 제출하면 weekN-vN 릴리스를 만들어요.
   열쇠(fine-grained 토큰)는 학생 저장소 하나에만 쓸 수 있는 것을 사용해요. */
(function(){
const API = "https://api.github.com";
const W = { segs:[], dirty:false, sha:null, st:null, w:null, doc:null, busy:false };

/* ---------- 열쇠(토큰) ---------- */
const keyName = repo => "ghkey:" + repo;
function getKey(repo){
  try{ return sessionStorage.getItem(keyName(repo)) || localStorage.getItem(keyName(repo)) || ""; }catch(_){ return ""; }
}
function setKey(repo, k, remember){
  try{ sessionStorage.setItem(keyName(repo), k); if(remember) localStorage.setItem(keyName(repo), k); }catch(_){}
}
function clearKey(repo){
  try{ sessionStorage.removeItem(keyName(repo)); localStorage.removeItem(keyName(repo)); }catch(_){}
}
/* 학생 코드(XXXX-XXXX)로 keys.json의 잠긴 열쇠를 풀어요 */
const b64bytes = b => Uint8Array.from(atob(b), c => c.charCodeAt(0));
async function codeToKey(repo, code){
  const c = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const r = await fetch("keys.json?t=" + Date.now()); if(!r.ok) throw new Error("열쇠 목록을 불러오지 못했어요.");
  const j = await r.json(), e = j.keys && j.keys[repo];
  if(!e) throw new Error("이 작업실에는 아직 열쇠가 없어요. 선생님께 알려 주세요.");
  try{
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(c), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey({ name:"PBKDF2", salt:b64bytes(e.salt), iterations:j.iter || 300000, hash:"SHA-256" }, base, { name:"AES-GCM", length:256 }, false, ["decrypt"]);
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name:"AES-GCM", iv:b64bytes(e.iv) }, key, b64bytes(e.ct)));
  }catch(_){ throw new Error("코드가 맞지 않아요. 내 작업실이 맞는지, 코드를 정확히 넣었는지 확인해 주세요."); }
}
/* 코드나 열쇠를 받아 확인하고 저장해요. 성공하면 true, 실패하면 오류 문장을 던져요 */
async function connect(repo, input, remember){
  let k = input.trim(); if(!k) throw new Error("코드를 넣어 주세요.");
  if(!/^github_pat_|^ghp_/.test(k)) k = await codeToKey(repo, k);
  let r;
  try{ r = await fetch(`${API}/repos/${S.cfg.org}/${repo}`, { headers:{ Authorization:"Bearer " + k, Accept:"application/vnd.github+json" }, cache:"no-store" }); }
  catch(_){ throw new Error("확인하지 못했어요. 인터넷 연결을 확인해 주세요."); }
  if(r.status === 401) throw new Error("열쇠 기간이 끝났거나 지워졌어요. 선생님께 알려 주세요.");
  if(r.status === 404) throw new Error("이 열쇠로는 이 저장소에 들어갈 수 없어요.");
  if(!r.ok) throw new Error("확인하지 못했어요. 잠시 뒤 다시 해 주세요.");
  setKey(repo, k, remember); return true;
}

async function gh(path, opt = {}){
  const k = getKey(W.st.repo);
  const headers = { Accept:"application/vnd.github+json", "X-GitHub-Api-Version":"2022-11-28", ...(opt.headers||{}) };
  if(k) headers.Authorization = "Bearer " + k;
  return fetch(API + path, { ...opt, headers, cache:"no-store" });
}
const repoPath = () => `/repos/${S.cfg.org}/${W.st.repo}`;

/* ---------- base64 (UTF-8) ---------- */
function b64enc(str){
  const bytes = new TextEncoder().encode(str); let bin = "";
  for(let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function b64dec(b64){
  const bin = atob(b64.replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

/* ---------- md → 조각 ---------- */
const isBlockStart = l => /^(#|>|\||[-*] |[-*]$|```|---|<|\d+\. )/.test(l);
const escLead = l => isBlockStart(l) ? "\\" + l : l;
const unescLead = l => l.replace(/^\\(?=[#>|\-*`<\d])/, "");
const PH = /^\((예[:：]\s*)?[^()]*\)$|^\d{4}\. ?\d{1,2}\. ?__$/;   // (이름), (예: 벽돌깨기), 2026. 10. __ 같은 자리표시
const reChk = /^(\s*[-*] )\[( |x|X)\][ ]?(.*)$/;
const reLabel = /^([-*] )(?!\[[ xX]\])((?:(?![:：]).){1,40}[:：])[ ]?(.*)$/;

function splitRow(line){
  let s = line.trim().replace(/^\|/, "").replace(/\|\s*$/, "");
  const cells = []; let cur = "";
  for(let i = 0; i < s.length; i++){
    if(s[i] === "\\" && s[i+1] === "|"){ cur += "\\|"; i++; continue; }
    if(s[i] === "|"){ cells.push(cur.trim()); cur = ""; continue; }
    cur += s[i];
  }
  cells.push(cur.trim()); return cells;
}
const cellToVal = c => c.replace(/<br\s*\/?>/gi, "\n").replace(/\\\|/g, "|");
const valToCell = v => v.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");

function parseTable(lines){
  const head = splitRow(lines[0]);
  const exCols = head.map(h => /예시/.test(h));
  const rows = lines.slice(2).map(l => {
    const raw = splitRow(l); while(raw.length < head.length) raw.push("");
    const exRow = /^예\s*[:：]/.test(raw[0]);
    return raw.slice(0, head.length).map((c, ci) => {
      const ro = exRow || exCols[ci] || /\*\*/.test(c);
      if(ro) return { ro:true, text:c };
      const v = cellToVal(c);
      return PH.test(v.trim()) ? { ro:false, ph:v.trim(), val:"" } : { ro:false, ph:"", val:v };
    });
  });
  const last = rows[rows.length-1];
  return { t:"table", headLine:lines[0], sepLine:lines[1], head, rows, canAdd: !!last && last.every(c => !c.ro) };
}

function isFree(l){
  if(!/^[-*]( |$)/.test(l)) return false;
  const c = l.match(reChk); if(c) return !c[3].trim();
  return !reLabel.test(l);
}
const freeText = l => unescLead(l.replace(/^[-*] ?/, "").replace(/^\[[ xX]\] ?/, "")).trim();

function parseMd(md){
  const L = md.replace(/\r\n/g, "\n").split("\n");
  const segs = []; let raw = [];
  const flush = () => { if(raw.length){ segs.push({ t:"raw", lines:raw }); raw = []; } };
  let i = 0;
  while(i < L.length){
    const l = L[i]; let m;
    if(/^```/.test(l)){
      let j = i + 1; while(j < L.length && !/^```\s*$/.test(L[j])) j++;
      const body = L.slice(i + 1, j).join("\n");
      flush(); segs.push({ t:"code", open:l, close:"```", ph: PH.test(body.trim()) ? body.trim() : "", val: PH.test(body.trim()) ? "" : body });
      i = j + 1; continue;
    }
    if(/^\|/.test(l) && i + 1 < L.length && /^\|[\s:|-]+\|?\s*$/.test(L[i+1])){
      let j = i + 2; while(j < L.length && /^\|/.test(L[j])) j++;
      flush(); segs.push(parseTable(L.slice(i, j))); i = j; continue;
    }
    if((m = l.match(/^(\*\*[^*\n]+?[:：]\*\*)[ ]?(.*)$/) || l.match(/^(답\s*[:：])[ ]?(.*)$/))){
      const vals = [m[2]]; let j = i + 1;
      while(j < L.length && L[j].trim() && !isBlockStart(L[j])){ vals.push(L[j]); j++; }
      flush(); segs.push({ t:"ans", label:m[1], val: vals.map(v => unescLead(v.replace(/\s+$/, ""))).join("\n").trim() });
      i = j; continue;
    }
    if((m = l.match(reChk)) && m[3].trim()){ flush(); segs.push({ t:"chk", pre:m[1], on:m[2] !== " ", text:m[3] }); i++; continue; }
    if((m = l.match(reLabel))){ flush(); segs.push({ t:"field", pre:m[1], label:m[2], val:m[3].trim() }); i++; continue; }
    if(isFree(l)){
      const items = []; let j = i;
      while(j < L.length && isFree(L[j])){ items.push(freeText(L[j])); j++; }
      flush(); segs.push({ t:"list", val: items.filter(Boolean).join("\n") }); i = j; continue;
    }
    raw.push(l); i++;
  }
  flush(); return segs;
}

/* ---------- 조각 → md ---------- */
function toMd(){
  const out = [];
  for(const s of W.segs){
    if(s.t === "raw") out.push(...s.lines);
    else if(s.t === "code") out.push(s.open, (s.val.replace(/\s+$/, "") || s.ph), s.close);
    else if(s.t === "table"){
      out.push(s.headLine, s.sepLine);
      s.rows.forEach(r => out.push("| " + r.map(c => c.ro ? c.text : (valToCell(c.val.trim()) || c.ph)).join(" | ") + " |"));
    }
    else if(s.t === "ans"){
      const lines = s.val.split("\n").map(x => x.trim()).filter(Boolean);
      out.push(lines.length ? [s.label + " " + lines[0], ...lines.slice(1).map(escLead)].join("  \n") : s.label);
    }
    else if(s.t === "chk") out.push(`${s.pre}[${s.on ? "x" : " "}] ${s.text}`);
    else if(s.t === "field") out.push(s.pre + s.label + (s.val.trim() ? " " + s.val.replace(/\s*\n\s*/g, " ").trim() : ""));
    else if(s.t === "list"){
      const items = s.val.split("\n").map(x => x.trim()).filter(Boolean);
      out.push(...(items.length ? items.map(x => "- " + x) : ["- "]));
    }
  }
  return out.join("\n");
}

/* ---------- 화면 ---------- */
const mdHtml = t => DOMPurify.sanitize(marked.parse(t, { gfm:true, breaks:true }));
const inl = t => DOMPurify.sanitize(marked.parseInline(t, { gfm:true }));
function grow(el){ el.style.height = "auto"; el.style.height = (el.scrollHeight + 2) + "px"; }
function ta(val, ph, cls, onIn){
  const el = document.createElement("textarea");
  el.className = cls; el.rows = 1; el.value = val; el.placeholder = ph || "";
  el.addEventListener("input", () => { onIn(el.value); grow(el); markDirty(); });
  requestAnimationFrame(() => grow(el));
  return el;
}

function renderSegs(box){
  box.innerHTML = "";
  W.segs.forEach(s => {
    if(s.t === "raw"){
      const d = document.createElement("div"); d.className = "md wr-raw"; d.innerHTML = mdHtml(s.lines.join("\n"));
      d.querySelectorAll("p").forEach(p => { if(/^예\s*[:：)]/.test(p.textContent.trim())) p.classList.add("ex"); });
      d.querySelectorAll("a").forEach(a => { a.target = "_blank"; a.rel = "noopener"; });
      d.querySelectorAll("img").forEach(im => { const src = im.getAttribute("src") || ""; if(/^(https?:|data:|blob:|\/)/.test(src)) return;
        const p = docDir() + src.replace(/^\.\//, ""); im.src = LOCAL_IMG[p] || rawUrl(W.st, "main", p) + "?t=" + Date.now();
        const k = Object.keys(IMG).find(x => IMG[x].alt === im.alt); if(k) im.dataset.pic = k; im.classList.add("wr-pic"); });
      d.querySelectorAll("blockquote").forEach(b => { if(/작성 방법|Commit changes/.test(b.textContent)) b.remove(); });
      if(d.textContent.trim() || d.querySelector("img,hr,table")) box.appendChild(d);
      return;
    }
    if(s.t === "ans"){
      const d = document.createElement("div"); d.className = "wr-ans" + (s.hl ? " hl-" + s.hl : "");
      d.innerHTML = `<div class="wr-label">${inl(s.label)}</div>`;
      d.appendChild(ta(s.val, "여기에 적어요", "wr-in", v => s.val = v));
      box.appendChild(d); return;
    }
    if(s.t === "field"){
      const d = document.createElement("label"); d.className = "wr-field";
      d.innerHTML = `<span class="wr-label">${inl(s.label)}</span>`;
      d.appendChild(ta(s.val, "", "wr-in", v => s.val = v));
      box.appendChild(d); return;
    }
    if(s.t === "list"){
      const d = document.createElement("div"); d.className = "wr-list";
      d.appendChild(ta(s.val, "한 줄에 하나씩 적어요 (Enter로 줄 바꾸기)", "wr-in", v => s.val = v));
      box.appendChild(d); return;
    }
    if(s.t === "code"){
      const d = document.createElement("div"); d.className = "wr-code";
      d.appendChild(ta(s.val, s.ph || "여기에 붙여 넣어요", "wr-in mono", v => s.val = v));
      box.appendChild(d); return;
    }
    if(s.t === "chk"){
      const d = document.createElement("label"); d.className = "wr-chk" + (s.hl ? " hl-" + s.hl : "");
      const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = s.on;
      cb.onchange = () => { s.on = cb.checked; markDirty(); };
      d.appendChild(cb); d.insertAdjacentHTML("beforeend", `<span>${inl(s.text)}</span>`);
      box.appendChild(d); return;
    }
    if(s.t === "table"){
      const wrap = document.createElement("div"); wrap.className = "wr-table";
      const tb = document.createElement("table");
      tb.innerHTML = `<thead><tr>${s.head.map(h => `<th>${inl(h)}</th>`).join("")}</tr></thead>`;
      const body = document.createElement("tbody");
      const addRow = r => {
        const tr = document.createElement("tr");
        r.forEach(c => {
          const td = document.createElement("td");
          if(c.ro){ td.className = /^예\s*[:：]/.test(r[0].text || "") ? "ro ex" : "ro"; td.innerHTML = inl(c.text); }
          else { td.className = "in" + (c.hl ? " hl-" + c.hl : ""); td.appendChild(ta(c.val, c.ph, "wr-cell", v => c.val = v)); }
          tr.appendChild(td);
        });
        body.appendChild(tr);
      };
      s.rows.forEach(addRow);
      tb.appendChild(body); wrap.appendChild(tb);
      if(s.canAdd){
        const b = document.createElement("button"); b.type = "button"; b.className = "wr-add"; b.textContent = "+ 줄 추가";
        b.onclick = () => { const r = s.head.map(() => ({ ro:false, ph:"", val:"" })); s.rows.push(r); addRow(r); markDirty(); };
        wrap.appendChild(b);
      }
      box.appendChild(wrap);
    }
  });
  addTips(box);
}

/* ---------- ❓ 작성 팁 ----------
   weeks: 팁이 나오는 주차, match: 칸 이름(라벨·표 머리·제목)에 들어 있으면 ? 버튼이 붙어요.
   새 팁은 아래 목록에 하나 더 추가하면 돼요. */
const TIPS = [
  {
    weeks:[2, 3], match:/대상|타깃|타겟/, title:"🎯 \"대상\" 칸 작성 예시",
    html:`<p>나이 + 성별 + 성향 + 상황을 함께 적으면 훨씬 구체적이 돼요!</p>
      <div class="tip-h">🎮 게임별 타깃 예시</div>
      <ul class="tip-list">
        <li><b>로블록스</b> → 초등학생<br><span>친구와 같이 놀고 꾸미기를 좋아하는 아이들</span></li>
        <li><b>마인크래프트</b> → 초등학생 ~ 20대<br><span>만들고 탐험하는 걸 좋아하는 사람</span></li>
        <li><b>롤, 배그</b> → 10대 ~ 30대<br><span>친구와 팀을 짜서 경쟁하고 이기는 걸 좋아하는 사람</span></li>
        <li><b>리니지</b> → 40대 ~ 60대<br><span>캐릭터를 오래 키우고 길드에서 인정받고 싶은 사람</span></li>
        <li><b>블루 아카이브, 명일방주</b> → 10대 후반 ~ 20대 남성 중심<br><span>캐릭터 수집과 스토리, 일러스트를 좋아하는 사람</span></li>
        <li><b>샤이닝니키</b> → 10대 ~ 20대 여성 중심<br><span>옷을 골라 코디하고 꾸미는 걸 좋아하는 사람</span></li>
        <li><b>애니팡, 캔디크러시</b> → 전 연령 (특히 30대 이상)<br><span>쉬는 시간에 짧게 즐기고 싶은 사람</span></li>
      </ul>
      <div class="tip-h">✏️ 내 게임 대상 쓰는 법</div>
      <ol class="tip-list">
        <li><b>나이</b>: 몇 살 정도가 할까?</li>
        <li><b>성별</b>: 더 좋아할 성별이 있을까? (없으면 "누구나")</li>
        <li><b>성향</b>: 어떤 걸 좋아하는 사람일까?</li>
        <li><b>상황</b>: 언제, 어디서, 얼마나 할까?</li>
      </ol>
      <p class="tip-ex">예) 10대 ~ 20대, 누구나 / 짧고 빠른 승부를 좋아하는 사람 / 쉬는 시간 5분 동안 혼자 가볍게 즐기는 게임</p>
      <div class="tip-warn"><b>⚠️ 주의</b>
        <ul>
          <li>성별을 적은 예시는 "주로 하는 사람"이라는 뜻이에요. 다른 성별은 못 한다는 뜻이 아니에요!</li>
          <li>예시를 그대로 베끼지 말고, 내 게임에 맞게 직접 생각해서 적어 주세요.</li>
          <li>"모든 사람"처럼 너무 넓게 쓰기보다, 내 게임을 가장 좋아할 사람을 떠올려 보세요.</li>
        </ul></div>`
  }
];
function openTip(tip){
  const dlg = document.createElement("div"); dlg.className = "wr-modal";
  dlg.innerHTML = `<div class="wr-dialog tip-dialog" role="dialog" aria-modal="true"><h3>${tip.title}</h3>${tip.html}
    <div class="btns" style="justify-content:flex-end;margin-top:12px"><button class="btn primary" data-x>알겠어요</button></div></div>`;
  document.body.appendChild(dlg);
  const close = () => dlg.remove();
  dlg.querySelector("[data-x]").onclick = close;
  dlg.onclick = e => { if(e.target === dlg) close(); };
}
function addTips(box){
  const tips = TIPS.filter(t => t.weeks.includes(W.w.week)); if(!tips.length) return;
  const used = new Set();
  box.querySelectorAll(".wr-label, th, h1, h2, h3, h4, .wr-raw strong, td.ro").forEach(el => {
    const txt = el.textContent.trim(); if(!txt || txt.length > 40) return;
    const tip = tips.find(t => t.match.test(txt)); if(!tip || used.has(tip)) return;
    used.add(tip);
    const b = document.createElement("button"); b.type = "button"; b.className = "tip-btn";
    b.textContent = "?"; b.title = "작성 팁 보기"; b.setAttribute("aria-label", "작성 팁 보기");
    b.onclick = e => { e.preventDefault(); e.stopPropagation(); openTip(tip); };
    (el.querySelector("p") || el).appendChild(b);
  });
}

/* ---------- 상태 표시 ---------- */
function setStatus(msg, kind){
  const el = document.getElementById("wrStatus"); if(!el) return;
  el.textContent = msg; el.className = "wr-status " + (kind || "");
}
function markDirty(){ if(!W.dirty){ W.dirty = true; setStatus("저장하지 않은 내용이 있어요", "warn"); } }
window.addEventListener("beforeunload", e => { if(W.dirty){ e.preventDefault(); e.returnValue = ""; } });

/* ---------- 불러오기 / 저장 / 제출 ---------- */
async function load(){
  const box = document.getElementById("wrDoc");
  box.innerHTML = `<div class="empty">문서를 불러오는 중…</div>`;
  W.dirty = false; W.sha = null;
  let text = null;
  try{
    if(getKey(W.st.repo)){
      const r = await gh(`${repoPath()}/contents/${encodeURI(W.doc.path)}?ref=main`);
      if(r.status === 401){ clearKey(W.st.repo); drawKey("열쇠가 맞지 않거나 기간이 끝났어요. 다시 넣어 주세요."); return load(); }
      if(r.ok){ const j = await r.json(); W.sha = j.sha; text = b64dec(j.content); }
      else if(r.status !== 404) throw new Error(r.status);
    }else{
      const r = await fetch(rawUrl(W.st, "main", W.doc.path) + "?t=" + Date.now());
      if(r.ok) text = await r.text(); else if(r.status !== 404) throw new Error(r.status);
    }
  }catch(e){ box.innerHTML = `<div class="empty">문서를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.</div>`; return; }
  if(text == null){ box.innerHTML = `<div class="empty">아직 문서가 없어요. 선생님께 알려 주세요.</div>`; return; }
  W.segs = parseMd(text);
  const pre = W.doc.path === PLAN_PATH ? await prepPlan() : 0;
  renderSegs(box);
  setStatus(getKey(W.st.repo) ? "불러왔어요" : "열쇠를 넣으면 저장할 수 있어요", "");
  if(pre){ W.dirty = false; markDirty(); setStatus(`2주차 기획서 내용을 미리 채웠어요 (${pre}곳). 고친 뒤 💾 저장하기를 눌러야 저장돼요`, "warn"); }
  applyPending();
}

async function save(quiet){
  if(!getKey(W.st.repo)){ setStatus("먼저 위에서 열쇠를 넣어 주세요", "err"); document.getElementById("wrKey").scrollIntoView({ behavior:"smooth" }); return false; }
  if(W.busy) return false;
  W.busy = true; setStatus("저장하는 중…", "");
  try{
    if(!W.sha){
      const g = await gh(`${repoPath()}/contents/${encodeURI(W.doc.path)}?ref=main`);
      if(g.ok) W.sha = (await g.json()).sha;
    }
    const body = { message:`${W.w.week}주차 ${W.doc.name} 저장 (사이트에서)`, content:b64enc(toMd()), branch:"main" };
    if(W.sha) body.sha = W.sha;
    const r = await gh(`${repoPath()}/contents/${encodeURI(W.doc.path)}`, { method:"PUT", body:JSON.stringify(body), headers:{ "Content-Type":"application/json" } });
    if(r.status === 409 || r.status === 422){ setStatus("다른 곳에서 이 문서가 바뀌었어요. 내 내용을 복사해 두고 새로고침해 주세요.", "err"); return false; }
    if(r.status === 401 || r.status === 403 || r.status === 404){ setStatus("저장 권한이 없어요. 열쇠를 확인해 주세요.", "err"); return false; }
    if(!r.ok) throw new Error(r.status);
    W.sha = (await r.json()).content.sha; W.dirty = false;
    const t = new Date(); setStatus(`저장했어요 · ${t.getHours()}:${String(t.getMinutes()).padStart(2, "0")}`, "ok");
    return true;
  }catch(e){ setStatus("저장하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.", "err"); return false; }
  finally{ W.busy = false; }
}

async function nextVersion(){
  const r = await gh(`${repoPath()}/releases?per_page=100`);
  if(!r.ok) throw new Error(r.status);
  const re = new RegExp(`^week${W.w.week}-v(\\d+)$`);
  return (await r.json()).reduce((m, x) => { const k = re.exec(x.tag_name || ""); return k ? Math.max(m, +k[1]) : m; }, 0) + 1;
}

async function openSubmit(){
  if(!getKey(W.st.repo)){ setStatus("먼저 위에서 열쇠를 넣어 주세요", "err"); document.getElementById("wrKey").scrollIntoView({ behavior:"smooth" }); return; }
  let v;
  try{ v = await nextVersion(); }catch(e){ setStatus("제출 기록을 확인하지 못했어요. 열쇠를 확인해 주세요.", "err"); return; }
  const memo = W.w.game ? "## 🛠 패치노트\n- 바뀐 점: \n- 고친 버그: \n- 다음 버전에서 할 일: " : "## 📝 제출 메모\n- 이번에 쓴 내용: \n- 선생님께 질문: ";
  const dlg = document.createElement("div"); dlg.className = "wr-modal";
  dlg.innerHTML = `<div class="wr-dialog" role="dialog" aria-modal="true">
    <h3>📮 ${W.w.week}주차 v${v} 제출하기</h3>
    <p>지금 저장된 내용이 <b>v${v}</b>로 제출돼요. 제출한 버전은 바꿀 수 없고, 고치고 싶으면 다음에 v${v + 1}로 다시 제출하면 돼요.</p>
    <label class="wr-label">${W.w.game ? "패치노트" : "제출 메모"}</label>
    <textarea class="wr-in" rows="5"></textarea>
    <div class="btns" style="justify-content:flex-end;margin-top:12px">
      <button class="btn" data-x>취소</button><button class="btn primary" data-go>v${v} 제출하기</button>
    </div><p class="wr-status" data-msg></p></div>`;
  document.body.appendChild(dlg);
  const memoEl = dlg.querySelector("textarea"); memoEl.value = memo;
  const close = () => dlg.remove();
  dlg.querySelector("[data-x]").onclick = close;
  dlg.onclick = e => { if(e.target === dlg) close(); };
  dlg.querySelector("[data-go]").onclick = async ev => {
    const btn = ev.currentTarget, msg = dlg.querySelector("[data-msg]");
    btn.disabled = true; msg.textContent = "제출하는 중…";
    if(W.dirty && !(await save(true))){ msg.textContent = "저장에 실패해서 제출하지 않았어요."; btn.disabled = false; return; }
    try{
      const r = await gh(`${repoPath()}/releases`, { method:"POST", headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({ tag_name:`week${W.w.week}-v${v}`, target_commitish:"main", name:`${W.w.week}주차 v${v} 제출`, body:memoEl.value }) });
      if(r.status === 422){ msg.textContent = `이미 v${v}가 제출되어 있어요. 창을 닫고 다시 눌러 주세요.`; btn.disabled = false; return; }
      if(!r.ok) throw new Error(r.status);
      dlg.querySelector(".wr-dialog").innerHTML = `<h3>🎉 v${v} 제출 완료!</h3><p>메인 사이트 액자에는 최대 1시간 뒤에 표시돼요.</p>
        <div class="btns" style="justify-content:flex-end"><button class="btn primary" data-x>확인</button></div>`;
      dlg.querySelector("[data-x]").onclick = close;
      setStatus(`v${v} 제출했어요`, "ok");
    }catch(e){ msg.textContent = "제출하지 못했어요. 열쇠 권한(Contents 읽기·쓰기)을 확인해 주세요."; btn.disabled = false; }
  };
}

/* ---------- 열쇠 상자 ---------- */
function drawKey(notice){
  const el = document.getElementById("wrKey"); if(!el) return;
  const k = getKey(W.st.repo);
  if(k){
    el.className = "wr-key on";
    el.innerHTML = `<span>🔑 열쇠가 연결되어 있어요. 저장하면 내 저장소(${esc(W.st.repo)})에 바로 기록돼요.</span>
      <button class="btn" data-out>열쇠 빼기</button>`;
    el.querySelector("[data-out]").onclick = () => { clearKey(W.st.repo); drawKey("열쇠를 뺐어요. 공용 컴퓨터라면 꼭 빼 두세요."); setStatus("열쇠를 넣으면 저장할 수 있어요", ""); };
    if(notice) el.insertAdjacentHTML("beforeend", `<p class="hint">${esc(notice)}</p>`);
    return;
  }
  el.className = "wr-key";
  el.innerHTML = `<div class="wr-key-title">🔑 내 열쇠 넣기</div>
    <p class="hint" style="margin:0 0 8px">선생님께 받은 <b>내 코드</b>(예: ABCD-1234)를 넣으면 이 화면에서 바로 저장·제출할 수 있어요.</p>
    <div class="wr-key-row"><input type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD-1234" aria-label="내 코드">
    <button class="btn primary" data-ok>확인</button></div>
    <label class="wr-remember"><input type="checkbox"> 이 컴퓨터에 기억하기 (내 컴퓨터일 때만 체크)</label>
    <p class="wr-status" data-msg>${esc(notice || "")}</p>`;
  const inp = el.querySelector("input"), msg = el.querySelector("[data-msg]");
  const go = async () => {
    if(!inp.value.trim()) return;
    msg.textContent = "코드를 확인하는 중…"; msg.className = "wr-status";
    try{
      await connect(W.st.repo, inp.value, el.querySelector(".wr-remember input").checked);
      drawKey(); if(!W.dirty) load(); else setStatus("열쇠를 넣었어요. 이제 저장할 수 있어요", "ok");
    }catch(e){ msg.textContent = e.message; msg.className = "wr-status err"; }
  };
  el.querySelector("[data-ok]").onclick = go;
  inp.onkeydown = e => { if(e.key === "Enter") go(); };
}


/* ---------- 🤖 3주차 게임 기획서 (보완) 도우미 ----------
   ① 2주차 기획서(docs/week2-plan.md)를 불러와 칸별로 정리
   ② 정리한 기획서를 넣은 Gemini 점검 프롬프트를 자동으로 작성
   ③ 보완한 내용을 정해진 형식의 Word 파일로 달라고 요청하는 프롬프트
   ④ Word 파일을 올리면 3주차 기획서(docs/week3-plan.md) 칸에 자동으로 반영 (비어 있으면 2주차 내용을 먼저 깔아요)
   REVIEW_WEEKS에 주차를 넣으면 그 주차 화면에 나와요. */
const REVIEW_WEEKS = [3];
const PLAN_PATH = "docs/week3-plan.md";       // 채우기 대상 (3주차 보완 기획서)
const SRC_PATH = "docs/week2-plan.md";        // 불러올 2주차 기획서
function summarizePlan(md){
 const L=md.replace(/\r\n/g,'\n').split('\n');const S={intro:'',target:'',core:'',refs:[],s51:[],s52:[],s53rows:[],s53in:[],view:'',extras:[]};let sec='',tbl=0;
 const cells=l=>{const s=l.trim().replace(/^\|/,'').replace(/\|\s*$/,'');const o=[];let c='';for(let i=0;i<s.length;i++){if(s[i]==='\\'&&s[i+1]==='|'){c+='|';i++;continue}if(s[i]==='|'){o.push(c);c='';continue}c+=s[i]}o.push(c);return o.map(x=>x.replace(/<br\s*\/?>/gi,' / ').trim())};
 const clean=t=>t.replace(/\*\*/g,'').replace(/[^\p{L}\p{N}\s()·,./-]/gu,'').replace(/\s+/g,' ').trim();
 for(const l of L){
  if(/^#{2,3}\s/.test(l)){tbl=0;sec=/화면 그림/.test(l)?'':/5-4|화면 시점/.test(l)?'view':/6️⃣|더 추가/.test(l)?'extra':/한 문장/.test(l)?'intro':/타깃|타겟/.test(l)?'target':/레퍼런스/.test(l)?'refs':/핵심/.test(l)?'core':/5-1/.test(l)?'s51':/5-2/.test(l)?'s52':/5-3/.test(l)?'s53':(/5️⃣|스테이지 1 만들어/.test(l)?'':sec);continue}
  let m;
  if((m=l.match(/^\*\*답:\*\*[ \t]*(.*)$/))&&['intro','target','core','view'].includes(sec)){S[sec]=m[1].trim();continue}
  if((m=l.match(/^\s*-\s*\[(x|X)\]\s*(.*)$/))&&sec==='s53'){S.s53in.push(clean(m[2]));continue}
  if(/^\|/.test(l)){tbl++;if(tbl<=2)continue;const c=cells(l);
   if(sec==='refs'&&c.some(Boolean))S.refs.push(c);
   if(sec==='s51')S.s51.push([clean(c[0]),c[1]||'']);
   if(sec==='s52'&&(c[1]||c[2]||/플레이어/.test(c[0])||clean(c[0])))S.s52.push([clean(c[0])||'(이름 없음)',c[1]||'',c[2]||'']);
   if(sec==='s53'&&!/^예\s*[:：]/.test(c[0])&&(c[0]||c[1]))S.s53rows.push(c);
   if(sec==='extra'&&(c[0]||c[1]))S.extras.push(c);
  }else if(l.trim()==='')tbl=tbl;else if(!/^\|/.test(l))tbl=0;
 }
 const v=x=>x&&!/^ㅇ+$/.test(x.trim())?x.trim():'(비어 있음)';
 const out=['[내 게임 기획서]',`1. 한 문장 소개: ${v(S.intro)}`,`2. 타깃 플레이어: ${v(S.target)}`,'3. 레퍼런스 게임:'];
 out.push(...(S.refs.length?S.refs.map(r=>`   - ${v(r[0])} (장르: ${v(r[1])}) → 참고하고 싶은 점: ${v(r[2])}`):['   - (비어 있음)']));
 out.push(`4. 핵심 재미 요소: ${v(S.core)}`,'5-1. 스테이지 1에서 일어나는 일:');
 out.push(...S.s51.map(r=>`   - ${r[0]}: ${v(r[1])}`));
 out.push('5-2. 스테이지 1에 등장하는 것들:');
 out.push(...(S.s52.length?S.s52.map(r=>`   - ${r[0]} → 갖고 있는 정보: ${v(r[1])} / 하는 행동·규칙: ${v(r[2])}`):['   - (비어 있음)']));
 out.push(`5-3. 입력 방식: ${S.s53in.length?S.s53in.join(', '):'(비어 있음)'}`);
 out.push(...(S.s53rows.length?S.s53rows.map(r=>`   - ${v(r[0])} → ${v(r[1])}`):['   - (비어 있음)']));
 if(S.view)out.push(`5-4. 화면 시점: ${S.view}`);
 if(S.extras.length)out.push('6. 더 추가한 것:',...S.extras.map(r=>`   - ${v(r[0])}: ${v(r[1])}`));
 const filled=[S.intro,S.target,S.core].filter(x=>x&&!/^ㅇ+$/.test(x.trim())).length+S.refs.length+S.s52.filter(r=>r[1]||r[2]).length;
 return {text:out.join('\n'),empty:filled<2,S};
}

const REVIEW_PROMPT = `너는 고등학생의 첫 게임을 도와주는 게임 기획자야.
맨 아래 [내 게임 기획서]는 내가 작성한 2주차 게임 기획서야. 이 기획서를 기반으로 보완해야 하는 내용을 알려 줘.
"(비어 있음)"은 아직 못 쓴 칸이야. 다음 주에는 이 기획서로 AI와 함께 "스테이지 1"을 구성요소 하나씩 만들 거야.

[규칙]
- 게임 코드는 만들지 마.
- 내 게임 아이디어와 재미 요소는 바꾸지 마.
- 고등학생이 이해할 수 있는 쉬운 말로 써 줘.

[이렇게 알려 줘]
1. 내가 이해한 게임: 이 게임을 한 문장으로 정리해 줘.
2. 칸별 점검표: 기획서의 칸(1~4번, 5-1 시작·플레이 중·클리어·실패, 5-2 등장하는 것들, 5-3 입력 방식)마다
   | 칸 | 상태(✅ 충분 / 🔺 보완 필요 / ❌ 비어 있음) | 이유 |
3. 보완해야 할 내용: 🔺·❌ 칸을 중요한 순서대로 최대 5개. 칸마다
   - 정해야 할 것 (숫자가 없는 것, 확인할 수 없는 클리어·실패 조건, 서로 맞지 않는 내용 등)
   - 내 게임에 맞는 예시 3가지 (서로 다른 방향, 필요하면 숫자 포함)
4. 더 추가하면 좋은 것: 5-1이나 5-3에는 나오는데 5-2 "등장하는 것들"에 빠진 것, 스테이지 1에 꼭 필요한데 없는 것.
5. 스테이지 1에서 뒤로 미뤄도 되는 것.
6. 화면 시점 추천: 탑다운 / 사이드뷰 / 세로 스크롤 / 고정 한 화면 / 쿼터뷰 / 3D 중 하나와 이유.

마지막에 "3번에서 어떤 예시를 고를래? 아니면 네 생각을 말해 줘"라고 물어봐 줘.`;
async function copyText(s, btn){
  try{ await navigator.clipboard.writeText(s); }
  catch(_){ const t = document.createElement("textarea"); t.value = s; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); }
  const o = btn.textContent; btn.textContent = "✓ 복사했어요!"; setTimeout(() => btn.textContent = o, 1500);
}
async function fetchDoc(path){
  if(W.doc && W.doc.path === path && W.segs.length) return toMd();      // 지금 고치는 중인 문서(저장 전 내용 포함)
  if(getKey(W.st.repo)){
    const r = await gh(`${repoPath()}/contents/${encodeURI(path)}?ref=main`);
    if(r.ok) return b64dec((await r.json()).content);
    if(r.status === 404) return null;
  }
  const r = await fetch(rawUrl(W.st, "main", path) + "?t=" + Date.now());
  if(r.status === 404) return null; if(!r.ok) throw new Error(r.status); return r.text();
}
async function latestPlan(){
  const t = await fetchDoc(SRC_PATH); if(t == null) throw new Error("no plan");
  return summarizePlan(t);
}
/* 정리된 2주차 기획서(S) → 채우기 형식(F) */
function planToFill(S){
  const k = l => /시작/.test(l) ? "start" : /플레이/.test(l) ? "play" : /클리어/.test(l) ? "clear" : /실패/.test(l) ? "fail" : "";
  const F = { intro:S.intro, target:S.target, core:S.core, s51:{}, refs:S.refs.map(r => [r[0], r[1] || "", r[2] || ""]),
    s52:S.s52.filter(r => r[1] || r[2]).map(r => [r[0], r[1], r[2]]), keys:S.s53in.slice(), inputs:S.s53rows.map(r => [r[0], r[1] || ""]) };
  S.s51.forEach(([l, v]) => { const kk = k(l); if(kk) F.s51[kk] = v; });
  return F;
}

/* ---------- 📥 Gemini 정리 결과(Word·글)로 기획서 채우기 ----------
   정해진 [칸 이름] 형식의 줄을 읽어 게임 기획서 (보완) 칸에 채워요.
   바뀐 칸은 고치고, 새로운 레퍼런스·등장하는 것·입력은 줄을 추가해요. 지우지는 않아요. */
const FILL_PROMPT = `지금까지 우리가 나눈 대화를 바탕으로 내 2주차 게임 기획서를 보완해서, 아래 형식 그대로 Word 문서 파일로 만들어 줘. (파일을 만들 수 없으면 글로 보여 줘.)

[규칙]
- 내가 대화에서 고르거나 답한 내용을 반영해. 내가 말하지 않은 내용은 새로 지어내지 마.
- 바뀌지 않은 칸은 원래 2주차 기획서 내용을 그대로 써. 빠뜨리는 칸이 없게 모든 칸을 써.
- 대괄호 [ ] 안의 칸 이름은 절대 바꾸지 말고, 한 줄에 한 칸씩 써. 표로 만들지 마.
- 레퍼런스, 등장하는 것, 입력은 하나마다 한 줄씩 쓰고, 칸은 | 로 나눠.
- 아직 정하지 못한 칸은 "(비어 있음)"이라고 써.
- 대화에서 내가 새로 정한 것 중 위 칸에 맞지 않는 것(점수·보상, 아이템, 화면 구성, 소리, 난이도, 나중에 할 것 등)은 버리지 말고 [7 추가]에 하나마다 한 줄씩 써.

[1 한 문장 소개] 
[2 타깃 플레이어] 
[3 레퍼런스] 게임 이름 | 장르 | 참고하고 싶은 점
[4 핵심 재미] 
[5-1 시작할 때] 
[5-1 플레이 중] 
[5-1 클리어 조건] 
[5-1 실패 조건] 
[5-2 등장] 이름 | 갖고 있는 정보 | 하는 행동 또는 규칙
[5-3 입력 방식] 키보드, 마우스 중 사용하는 것
[5-3 입력] 입력 | 게임 속 동작
[6 화면 시점] 탑다운 / 사이드뷰 / 세로 스크롤 / 고정 한 화면 / 쿼터뷰 / 3D 중 하나와 이유
[7 추가] 항목 이름 | 내용`;

/* ---------- 🎨 스테이지 1 화면 그림 → Gemini 목업 ---------- */
const MOCKUP_PROMPT = `너는 HTML 웹게임 화면을 디자인하는 게임 UI 디자이너야.
첨부한 사진은 내가 그림판(또는 종이)에 직접 그린 내 게임의 "스테이지 1" 화면이야.
이 그림과 맨 아래 [내 게임 기획서]를 바탕으로, 실제 게임 화면처럼 보이는 목업 이미지 1장을 만들 거야.
게임 코드는 만들지 마.

[1단계: 이미지를 만들기 전에 먼저 확인해 줘]
아래 [확인할 목록]에 있는 것을 하나도 빠뜨리지 말고 하나씩 내 그림과 비교해서 표로 보여 줘.
| 확인할 것 | 내 그림에 있나? (✅ 있음 / ❓ 안 보임) | 그림에서 어디쯤 있는지 |

{{CHECK}}

그리고 ❓인 것마다 나에게 물어봐 줘.
- "○○는 화면에 보이지 않는 거야? 아니면 그리는 걸 빠뜨린 거야? 빠뜨렸다면 화면 어디에 둘까?"
- 플레이어, 손님처럼 원래 화면에 보여야 할 것 같은 것과 점수 규칙, 레시피처럼 화면에 안 보여도 되는 것을 구분해서 물어봐.
❓가 하나도 없으면 바로 2단계로 넘어가.
내가 답하기 전에는 이미지를 만들지 마.

[2단계: 내 답을 반영해서 목업 이미지 만들기]
- 내 그림의 배치를 그대로 지켜. 무엇이 어디에 있는지, 대략적인 크기 비율을 바꾸지 마.
- 내가 "빠뜨렸다"고 답한 것은 내가 말한 위치에 넣고, "안 보인다"고 답한 것은 넣지 마.
- 내 그림, 기획서, 내 답에 없는 캐릭터, 버튼, 장식은 새로 더하지 마.
- 화면 시점은 기획서의 5-4 화면 시점을 따라. 없으면 내 그림의 시점을 따라.

[HTML 웹게임으로 만들 수 있는 그래픽 기준]
- 스크롤 없는 한 화면. 가로 16:9(예: 960×540), 세로로 하는 게임이면 9:16.
- 평평한 2D 그래픽: 단색이나 간단한 그라데이션의 사각형, 둥근 사각형, 원, 굵은 테두리, 단순한 아이콘이나 이모지로 표현해.
- 캐릭터와 물건도 도형 몇 개를 겹친 정도로 단순하게 그려. (나중에 HTML·CSS·Canvas로 직접 그릴 수 있는 수준)
- 사진 같은 질감, 3D 렌더링, 빛 번짐, 복잡한 일러스트, 그림 배경은 쓰지 마. 배경은 단색이나 간단한 도형 2~3개로.
- 점수, 시간, 목숨 같은 정보와 버튼 글자는 한국어로 또렷하게 쓰고, 버튼은 누를 수 있는 모양으로 그려.
- 전체 색은 5~6가지 이내로 맞춰.

[이미지를 만든 다음 글로 정리해 줘]
1. 화면 구성 요소 표: | 구성 요소 | 화면 위치 | 모양·색 | 기획서의 어느 칸과 연결되는지 |
2. 화면에 보이지 않는 것: 내가 "안 보인다"고 답한 것과 그 이유 (예: 레시피 → 손님 주문 말풍선으로만 보여서)
3. 사용한 색 목록 (이름과 색 코드, 예: 배경 #FFF4E6)
4. 내 그림에서 바꾸거나 정리한 점 (없으면 "없음")

마지막에 "더 고치고 싶은 곳이 있으면 말해 줘"라고 물어봐 줘.`;
/* 프롬프트에 넣을 기획서: 작성 중인 3주차 기획서 → 저장된 3주차 → 2주차 순서로 */
async function planForMockup(){
  const ok = t => t && !summarizePlan(t).empty;
  if(W.doc && W.doc.path === PLAN_PATH && W.segs.length && ok(toMd())) return summarizePlan(toMd());
  try{ const t3 = await fetchDoc(PLAN_PATH); if(ok(t3)) return summarizePlan(t3); }catch(_){}
  try{ const t2 = await fetchDoc(SRC_PATH); if(t2) return summarizePlan(t2); }catch(_){}
  return null;
}
/* [확인할 목록]: 5-2 등장하는 것들 + 5-3 입력 */
function checkList(S){
  const ok = x => x && !/^\(?이름 없음\)?$|^\(?비어 있음\)?$/.test(x.trim());
  const ents = (S ? S.s52 : []).filter(r => ok(r[0]) && (r[1] || r[2] || /플레이어/.test(r[0])));
  const ins = (S ? S.s53rows : []).filter(r => ok(r[0]));
  const out = ["[확인할 목록]", "A. 5-2 스테이지 1에 등장하는 것들"];
  out.push(...(ents.length ? ents.map((r, i) => `   ${i + 1}) ${r[0]}${r[2] ? ` — 하는 일: ${r[2]}` : ""}`) : ["   (기획서에 아직 없어요. 내 그림에 보이는 것을 표로 정리해 줘.)"]));
  out.push("B. 5-3 입력 (버튼이나 화면에 보여야 하는 것)");
  out.push(...(ins.length ? ins.map((r, i) => `   ${i + 1}) ${r[0]}${r[1] ? ` → ${r[1]}` : ""}`) : ["   (없음)"]));
  return out.join("\n");
}
/* 사진을 줄여서(긴 쪽 1600px) base64로. 작은 png는 그대로 */
async function shrinkImg(file){
  let bmp; try{ bmp = await createImageBitmap(file); }catch(_){ throw new Error("이 그림 파일은 열 수 없어요. jpg나 png로 바꿔서 올려 주세요."); }
  const sc = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const toB64 = blob => new Promise(res => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.readAsDataURL(blob); });
  if(/png/.test(file.type) && sc === 1 && file.size < 1.5e6) return { ext:"png", b64:await toB64(file), blob:file };
  const cv = document.createElement("canvas"); cv.width = Math.round(bmp.width * sc); cv.height = Math.round(bmp.height * sc);
  const cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(bmp, 0, 0, cv.width, cv.height);
  const blob = await new Promise(res => cv.toBlob(res, "image/jpeg", 0.88));
  return { ext:"jpg", b64:await toB64(blob), blob };
}
const LOCAL_IMG = {};   // 방금 올린 그림은 GitHub 반영을 기다리지 않고 바로 보여 줘요
const docDir = () => (W.doc && W.doc.path.includes("/")) ? W.doc.path.replace(/[^/]*$/, "") : "";
async function uploadPic(k, file, msg){
  if(!getKey(W.st.repo)){ msg.textContent = "먼저 위에서 열쇠(코드)를 넣어 주세요."; msg.className = "wr-status err"; document.getElementById("wrKey").scrollIntoView({ behavior:"smooth" }); return; }
  msg.textContent = `${IMG[k].alt} 올리는 중…`; msg.className = "wr-status";
  try{
    const im = await shrinkImg(file), rel = `images/${IMG[k].file}.${im.ext}`, path = docDir() + rel;
    const g = await gh(`${repoPath()}/contents/${encodeURI(path)}?ref=main`);
    const body = { message:`${W.w.week}주차 ${IMG[k].alt} 올리기 (사이트에서)`, content:im.b64, branch:"main" };
    if(g.ok) body.sha = (await g.json()).sha;
    const r = await gh(`${repoPath()}/contents/${encodeURI(path)}`, { method:"PUT", body:JSON.stringify(body), headers:{ "Content-Type":"application/json" } });
    if(r.status === 401 || r.status === 403 || r.status === 404) throw new Error("저장 권한이 없어요. 열쇠를 확인해 주세요.");
    if(!r.ok) throw new Error("그림을 올리지 못했어요. 잠시 뒤 다시 해 주세요.");
    LOCAL_IMG[path] = URL.createObjectURL(im.blob);
    setPicLine(k, rel); renderSegs(document.getElementById("wrDoc")); markDirty();
    const saved = await save(true);
    msg.textContent = saved ? `✅ ${IMG[k].alt}을 올려서 기획서 맨 아래 7️⃣ 칸에 넣었어요.` : `그림은 올렸어요. 아래 💾 저장하기를 눌러 기획서에도 넣어 주세요.`;
    msg.className = "wr-status " + (saved ? "ok" : "warn");
    document.getElementById("wrDoc").querySelector("img[data-pic='" + k + "']")?.scrollIntoView({ behavior:"smooth", block:"center" });
  }catch(e){ msg.textContent = e.message || "그림을 올리지 못했어요."; msg.className = "wr-status err"; }
}

/* docx → 줄 글 (외부 라이브러리 없이 zip을 풀어요) */
async function docxText(buf){
  const dv = new DataView(buf), u8 = new Uint8Array(buf);
  let eocd = -1; for(let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--){ if(dv.getUint32(i, true) === 0x06054b50){ eocd = i; break; } }
  if(eocd < 0) throw new Error("zip");
  let p = dv.getUint32(eocd + 16, true), n = dv.getUint16(eocd + 10, true), ent = null;
  for(let k = 0; k < n; k++){
    const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl));
    if(name === "word/document.xml") ent = { method:dv.getUint16(p + 10, true), size:dv.getUint32(p + 20, true), off:dv.getUint32(p + 42, true) };
    p += 46 + nl + xl + cl;
  }
  if(!ent) throw new Error("not docx");
  const lo = ent.off, start = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
  let data = u8.subarray(start, start + ent.size);
  if(ent.method === 8) data = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
  const doc = new DOMParser().parseFromString(new TextDecoder().decode(data), "application/xml");
  const kids = (el, nm) => [...el.childNodes].filter(x => x.localName === nm);
  const ptext = pe => { let t = ""; pe.querySelectorAll("*").forEach(x => { if(x.localName === "t") t += x.textContent; else if(x.localName === "tab") t += " "; else if(x.localName === "br") t += "\n"; }); return t; };
  const out = [];
  const walk = el => [...el.childNodes].forEach(x => {
    if(x.localName === "p") out.push(ptext(x));
    else if(x.localName === "tbl") kids(x, "tr").forEach(tr => out.push(kids(tr, "tc").map(tc => kids(tc, "p").map(ptext).join(" ").trim()).join(" | ")));
    else if(x.localName === "sdt" || x.localName === "sdtContent" || x.localName === "body") walk(x);
  });
  walk(doc.getElementsByTagNameNS("*", "body")[0] || doc.documentElement);
  return out.join("\n");
}

const normName = t => String(t || "").replace(/\*\*/g, "").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
const isBlank = v => !v || /^\(?\s*(비어\s*있음|없음|미정|-)\s*\)?$/.test(v.trim()) || /^ㅇ+$/.test(v.trim());
function parseFill(text){
  const F = { intro:"", target:"", core:"", s51:{}, refs:[], s52:[], keys:[], inputs:[], view:"", extras:[] }; let hit = 0;
  text.replace(/\r/g, "").split("\n").forEach(raw => {
    const l = raw.replace(/\*\*/g, "").replace(/^[\s>*•·\-–]+/, "").trim();
    const m = l.match(/^\[\s*([^\]]+?)\s*\]\s*[:：]?\s*(.*)$/); if(!m) return;
    const tag = m[1].replace(/\s/g, ""), val = m[2].replace(/\s*←.*$/, "").trim();
    const cells = () => { let c = val.split("|").map(x => x.trim()); if(c[0] === "") c.shift(); if(c[c.length-1] === "") c.pop(); return c; };
    hit++;
    if(/^7?추가|더추가/.test(tag)){ const c = cells(); if(!isBlank(c[0])) F.extras.push(c.length > 1 ? [c[0], c.slice(1).join(" | ")] : ["기타", c[0]]); }
    else if(/화면시점|시점|카메라/.test(tag)) F.view = val;
    else if(/입력방식/.test(tag)) F.keys = val.split(/[,，/]/).map(x => x.trim()).filter(Boolean);
    else if(/입력/.test(tag)){ const c = cells(); if(!isBlank(c[0])) F.inputs.push([c[0], c.slice(1).join(" | ")]); }
    else if(/등장/.test(tag)){ const c = cells(); if(!isBlank(c[0])) F.s52.push([c[0], c[1] || "", c.slice(2).join(" | ")]); }
    else if(/레퍼런스/.test(tag)){ const c = cells(); if(!isBlank(c[0])) F.refs.push([c[0], c[1] || "", c.slice(2).join(" | ")]); }
    else if(/한문장/.test(tag)) F.intro = val;
    else if(/타깃|타겟/.test(tag)) F.target = val;
    else if(/핵심/.test(tag)) F.core = val;
    else if(/시작/.test(tag)) F.s51.start = val;
    else if(/플레이중|진행/.test(tag)) F.s51.play = val;
    else if(/클리어|성공/.test(tag)) F.s51.clear = val;
    else if(/실패/.test(tag)) F.s51.fail = val;
    else if(!isBlank(val) && !/^(내)?게임기획서$|^규칙$/.test(tag)){ hit--; F.extras.push([m[1].replace(/^\d+(-\d+)?\s*/, "").trim() || "기타", val]); }   // 모르는 칸도 버리지 않고 [7 추가]로
    else hit--;
  });
  return hit ? F : null;
}

/* 5-4 화면 시점 · 6 더 추가한 것 칸이 없는 기획서에는 맨 아래(마지막 --- 앞)에 새로 만들어요 */
const EXTRA_MD = {
  view:`### 5-4. 화면 시점

> 탑다운 / 사이드뷰 / 세로 스크롤 / 고정 한 화면 / 쿼터뷰 / 3D 중 하나와 이유를 적습니다.

**답:**
`,
  extra:`---

## 6️⃣ 더 추가한 것

> 위 칸에 맞지 않지만 보완하면서 새로 정한 것(점수·보상, 아이템, 화면 구성, 소리, 나중에 할 것 등)을 적습니다.

| 항목 | 내용 |
|---|---|
|  |  |
`};
const secOf = (h, sec) => /화면 그림/.test(h) ? "pic" : /5-4|화면 시점/.test(h) ? "view" : /6️⃣|더 추가/.test(h) ? "extra" : /한 문장/.test(h) ? "intro" : /타깃|타겟/.test(h) ? "target" : /레퍼런스/.test(h) ? "refs" : /핵심/.test(h) ? "core" : /5-1/.test(h) ? "s51" : /5-2/.test(h) ? "s52" : /5-3/.test(h) ? "s53" : sec;
/* re 제목이 든 조각 번호 (없으면 -1) */
const headAt = re => W.segs.findIndex(s => s.t === "raw" && s.lines.some(l => /^#{2,3}\s/.test(l) && re.test(l)));
/* md를 넣어요. before 제목이 있으면 그 제목 바로 앞(바로 위 --- 포함), 없으면 마지막 --- 앞 */
function insertSec(md, before){
  let i = -1, k = -1;
  for(const re of before || []){ i = headAt(re); if(i >= 0){ const L = W.segs[i].lines; k = L.findIndex(l => /^#{2,3}\s/.test(l) && re.test(l)); const hr = L.lastIndexOf("---", k); if(hr >= 0 && L.slice(hr + 1, k).every(l => !l.trim())) k = hr; break; } }
  if(i < 0){ for(let j = W.segs.length - 1; j >= 0; j--){ const s = W.segs[j]; if(s.t === "raw" && s.lines.lastIndexOf("---") >= 0){ i = j; k = s.lines.lastIndexOf("---"); break; } } }
  const add = parseMd(md);
  if(i < 0){ W.segs.push(...add); return; }
  const s = W.segs[i], parts = [{ t:"raw", lines:s.lines.slice(0, k) }, ...add, { t:"raw", lines:s.lines.slice(k) }].filter(x => x.t !== "raw" || x.lines.length);
  W.segs.splice(i, 1, ...parts);
}
const IMG = { sketch:{ alt:"내 손그림", file:"week3-sketch", label:"✏️ 내 손그림" }, mockup:{ alt:"Gemini 목업", file:"week3-mockup", label:"🖼️ Gemini 목업" } };
const imgWait = k => `_(${IMG[k].alt}을 아직 올리지 않았어요)_`;
const PIC_MD = `---

## 7️⃣ 스테이지 1 화면 그림

> 그림판이나 종이에 그린 스테이지 1 화면과, 그 그림으로 Gemini에게 받은 목업을 올립니다.

**${IMG.sketch.label}**

${imgWait("sketch")}

**${IMG.mockup.label}**

${imgWait("mockup")}
`;
/* 5-5 칸의 그림 줄을 바꿔요 (칸이 없으면 5-4 다음에 만들어요) */
function setPicLine(k, rel){
  if(headAt(/화면 그림/) < 0) insertSec(PIC_MD);     // 기획서 맨 끝(마지막 --- 앞)
  const s = W.segs[headAt(/화면 그림/)];
  const re = new RegExp("^!\\[" + IMG[k].alt + "\\]|" + IMG[k].alt + "을 아직");
  const i = s.lines.findIndex(l => re.test(l)), line = `![${IMG[k].alt}](${rel})`;
  if(i >= 0) s.lines[i] = line;
  else { const h = s.lines.findIndex(l => l.includes(IMG[k].label)); s.lines.splice(h < 0 ? s.lines.length : h + 1, 0, "", line); }
}
function ensureExtraSecs(F){
  if(!isBlank(F.view) && headAt(/5-4|화면 시점/) < 0) insertSec(EXTRA_MD.view, [/6️⃣|더 추가/, /화면 그림/]);
  if(F.extras.length && headAt(/6️⃣|더 추가/) < 0) insertSec(EXTRA_MD.extra, [/화면 그림/]);
}
function mergeFill(F){
  const log = []; let sec = "";
  F.view = F.view || ""; F.extras = F.extras || [];
  ensureExtraSecs(F);
  const setCell = (c, v, where, quiet) => {
    if(isBlank(v) || c.ro) return false;
    const old = (c.val || "").trim(); if(old === v.trim()) return false;
    c.hl = old ? "chg" : "new"; c.val = v.trim(); if(!quiet) log.push((old ? "✏️ " : "➕ ") + where); return c.hl;
  };
  const freeRow = t => t.rows.find(r => r.every(c => c.ro ? false : !(c.val || "").trim()) && !/^예\s*[:：]/.test((r[0].text || r[0].val || "")));
  const addRow = t => { let r = freeRow(t); if(!r){ r = t.head.map(() => ({ ro:false, ph:"", val:"" })); t.rows.push(r); } return r; };
  const rowName = r => r[0].ro ? r[0].text : (r[0].val || "");
  const key = t => normName(String(t || "").replace(/\([^)]*\)|（[^）]*）/g, ""));
  const findRow = (t, name, playerOk) => {
    const n = key(name); if(!n) return null;
    return t.rows.find(r => !/^예\s*[:：]/.test(rowName(r)) && key(rowName(r)) === n)
      || (playerOk && /플레이어|주인공/.test(name) ? t.rows.find(r => /플레이어/.test(rowName(r))) : null);
  };
  const upsert = (t, list, label, playerOk) => list.forEach(item => {
    let r = findRow(t, item[0], playerOk);
    if(r){ const res = item.slice(1).map((v, i) => r[i + 1] ? setCell(r[i + 1], v, "", true) : false).filter(Boolean);
      if(res.length) log.push(`${res.includes("chg") ? "✏️" : "➕"} ${label} · ${item[0]}`); }
    else { r = addRow(t); r.forEach(c => delete c.hl); item.forEach((v, i) => { if(r[i] && !isBlank(v)){ r[i].val = v; r[i].hl = "new"; } }); log.push(`🆕 ${label} 새로 추가: ${item[0]}`); }
  });
  for(const s of W.segs){
    if(s.t === "raw"){ const h = s.lines.filter(l => /^#{2,3}\s/.test(l)).pop();
      if(h) sec = secOf(h, sec);
      continue; }
    if(s.t === "ans" && ["intro","target","core"].includes(sec)){
      const v = F[sec], old = (s.val || "").trim();
      if(!isBlank(v) && old !== v.trim()){ s.hl = isBlank(old) ? "new" : "chg"; s.val = v.trim(); log.push(`${s.hl === "new" ? "➕" : "✏️"} ${{intro:"1. 한 문장 소개",target:"2. 타깃 플레이어",core:"4. 핵심 요소"}[sec]}`); }
    }
    if(s.t === "table" && sec === "s51") s.rows.forEach(r => {
      const k = normName(r[0].text || ""), key = /시작/.test(k) ? "start" : /플레이중/.test(k) ? "play" : /클리어/.test(k) ? "clear" : /실패/.test(k) ? "fail" : "";
      if(key && r[1]) setCell(r[1], F.s51[key] || "", `5-1 ${(r[0].text || "").replace(/\*\*/g, "").replace(/[^\p{L}\p{N}\s]/gu, "").trim()}`);
    });
    if(s.t === "table" && sec === "refs") upsert(s, F.refs, "3. 레퍼런스", false);
    if(s.t === "table" && sec === "s52") upsert(s, F.s52, "5-2 등장", true);
    if(s.t === "table" && sec === "s53") upsert(s, F.inputs, "5-3 입력", false);
    if(s.t === "ans" && sec === "view"){
      const old = (s.val || "").trim();
      if(!isBlank(F.view) && old !== F.view.trim()){ s.hl = isBlank(old) ? "new" : "chg"; s.val = F.view.trim(); log.push(`${s.hl === "new" ? "➕" : "✏️"} 5-4 화면 시점`); }
    }
    if(s.t === "table" && sec === "extra") upsert(s, F.extras, "6. 더 추가한 것", false);
    if(s.t === "chk" && sec === "s53"){
      const want = F.keys.some(k => (/키보드/.test(k) && /키보드/.test(s.text)) || (/마우스/.test(k) && /마우스/.test(s.text)));
      if(want && !s.on){ s.on = true; s.hl = "new"; log.push(`➕ 5-3 입력 방식: ${s.text.replace(/[^\p{L}\s]/gu, "").trim()}`); }
    }
  }
  return log;
}

let FILL_UNDO = null, BASE_FILL = null;
const formEmpty = () => !W.segs.some(s => (s.t === "ans" && (s.val || "").trim() && !/^ㅇ+$/.test(s.val.trim())) || (s.t === "table" && s.rows.some(r => r.some(c => !c.ro && (c.val || "").trim()))));
let BASE_REPO = null;   // BASE_FILL이 어느 학생 것인지 (다른 학생 페이지로 옮기면 다시 불러와요)
async function loadBase(){ if(BASE_FILL && BASE_REPO === W.st.repo) return BASE_FILL; BASE_FILL = null; try{ const t = await fetchDoc(SRC_PATH); if(t){ BASE_FILL = planToFill(summarizePlan(t).S); BASE_REPO = W.st.repo; } }catch(_){ } return BASE_FILL; }
/* 3주차 기획서를 열 때: 5-1 표의 '예시' 칸을 빼고, 비어 있으면 2주차 내용을 미리 채워요. 미리 채운 칸 수를 돌려줘요 */
function dropExampleCol(){
  let sec = "";
  W.segs.forEach(s => {
    if(s.t === "raw"){ const h = s.lines.filter(l => /^#{2,3}\s/.test(l)).pop(); if(h) sec = secOf(h, sec); return; }
    if(s.t !== "table" || sec !== "s51") return;
    const keep = s.head.map(h => !/예시/.test(h)); if(keep.every(Boolean)) return;
    s.head = s.head.filter((_, i) => keep[i]);
    s.rows = s.rows.map(r => r.filter((_, i) => keep[i]));
    s.headLine = "| " + s.head.join(" | ") + " |"; s.sepLine = "|" + s.head.map(() => "---").join("|") + "|";
  });
}
async function prepPlan(){
  dropExampleCol();
  if(!formEmpty()) return 0;
  const base = await loadBase(); if(!base) return 0;
  const n = mergeFill(JSON.parse(JSON.stringify(base))).length;
  W.segs.forEach(s => { delete s.hl; if(s.rows) s.rows.forEach(r => r.forEach(c => delete c.hl)); });
  return n;
}
async function runFill(text, msg, list){
  const F = parseFill(text);
  if(!F){ msg.textContent = "정해진 형식([1 한 문장 소개] 같은 줄)을 찾지 못했어요. 정리 프롬프트로 다시 받아 주세요."; msg.className = "wr-status err"; return; }
  if(W.doc && W.doc.path === PLAN_PATH && W.segs.length) await loadBase();
  if(!(W.doc && W.doc.path === PLAN_PATH && W.segs.length)){
    try{ sessionStorage.setItem("pendingFill:" + W.st.repo, text); }catch(_){}
    const i = W.w.docs.findIndex(d => d.path === PLAN_PATH);
    location.hash = `#/write/${W.w.week}/${W.st.repo}/${i < 0 ? 0 : i}`; return;
  }
  const clearHl = () => W.segs.forEach(s => { delete s.hl; if(s.rows) s.rows.forEach(r => r.forEach(c => delete c.hl)); });
  clearHl();
  FILL_UNDO = JSON.stringify(W.segs);
  if(formEmpty() && BASE_FILL){ mergeFill(JSON.parse(JSON.stringify(BASE_FILL))); clearHl(); }   // 비어 있는 3주차 양식에는 2주차 내용을 먼저 깔아요
  const log = mergeFill(F);
  renderSegs(document.getElementById("wrDoc"));
  if(!log.length){ msg.textContent = "새로 바뀐 칸이 없어요. 이미 기획서와 같은 내용이에요."; msg.className = "wr-status"; list.innerHTML = ""; return; }
  markDirty();
  msg.textContent = `✅ ${log.length}곳을 채웠어요. 노란 칸은 바뀐 곳, 초록 칸은 새로 들어간 곳이에요. 내 말로 다듬은 뒤 💾 저장하기를 눌러요.`; msg.className = "wr-status ok";
  list.innerHTML = `<ul>${log.map(x => `<li>${esc(x)}</li>`).join("")}</ul><button class="btn" type="button" data-undo>↩️ 채우기 전으로 되돌리기</button>`;
  list.querySelector("[data-undo]").onclick = () => { W.segs = JSON.parse(FILL_UNDO); renderSegs(document.getElementById("wrDoc")); list.innerHTML = ""; msg.textContent = "되돌렸어요."; msg.className = "wr-status"; };
}
function applyPending(){
  if(onDevlog()){ let p = null; try{ p = sessionStorage.getItem("pendingPrompt:" + W.st.repo); sessionStorage.removeItem("pendingPrompt:" + W.st.repo); }catch(_){}
    const c = p && segUnder(/1️⃣/, s => s.t === "code"); if(c && !(c.val || "").trim() && putPromptInLog(p)) setStatus("학생 페이지에서 복사한 프롬프트를 1️⃣에 넣었어요. 💾 저장하기를 눌러 주세요", "warn"); }
  let t = null; try{ t = sessionStorage.getItem("pendingFill:" + W.st.repo); sessionStorage.removeItem("pendingFill:" + W.st.repo); }catch(_){}
  const box = document.getElementById("wrAi"); if(!t || !box) return;
  runFill(t, box.querySelector("[data-fmsg]"), box.querySelector("[data-flist]"));
  box.querySelector("[data-fill-area]").scrollIntoView({ behavior:"smooth", block:"start" });
}

function reviewBox(){
  return `<section class="wr-ai" id="wrAi">
    <div class="wr-ai-title">🤖 Gemini와 기획서 보완하기 <span>2주차 기획서 불러오기 → 프롬프트 → Word 파일 → 기획서에 반영 → 화면 목업</span></div>
    <div class="wr-ai-step"><div class="wr-ai-h"><i>1</i>2주차 게임 기획서 불러오기</div>
      <div class="btns"><button class="btn primary" type="button" data-load>📥 2주차 기획서 불러오기</button></div>
      <p class="wr-status" data-msg></p>
      <pre class="wr-ai-out" data-plan hidden></pre>
    </div>
    <div class="wr-ai-step"><div class="wr-ai-h"><i>2</i>Gemini에 보완할 내용 요청하기 <span>불러온 기획서가 프롬프트에 자동으로 들어가요</span></div>
      <p class="hint"><a href="https://gemini.google.com/" target="_blank" rel="noopener">Gemini ↗</a> 새 채팅에 붙여 넣고 보내요. Gemini가 보완할 칸과 예시를 알려 주면, 고르거나 내 생각을 말하며 대화를 이어 가요.</p>
      <details class="wr-ai-peek"><summary>프롬프트 보기</summary><pre class="wr-ai-out" data-out>먼저 1단계에서 2주차 기획서를 불러와 주세요.</pre></details>
      <div class="btns"><button class="btn" type="button" data-copy disabled>📋 보완 요청 프롬프트 복사</button></div>
    </div>
    <div class="wr-ai-step"><div class="wr-ai-h"><i>3</i>보완한 기획서를 Word 파일로 받기</div>
      <p class="hint">보완할 내용을 다 정했으면 <b>같은 채팅</b>에 보내요. Gemini가 Word 파일을 바로 주지 않으면 <b>Google Docs로 내보내기 → 파일 → 다운로드 → Microsoft Word(.docx)</b>로 받아요.</p>
      <details class="wr-ai-peek"><summary>프롬프트 보기</summary><pre class="wr-ai-out">${esc(FILL_PROMPT)}</pre></details>
      <div class="btns"><button class="btn" type="button" data-fillp>📋 Word 파일 요청 프롬프트 복사</button></div>
    </div>
    <div class="wr-ai-step" data-fill-area><div class="wr-ai-h"><i>4</i>Word 파일 올려서 기획서에 반영하기 <span>바뀐 칸은 노랑, 새로 생긴 칸은 초록으로 표시돼요</span></div>
      <div class="wr-ai-drop"><label class="btn primary"><input type="file" accept=".docx,.txt,.md" data-file hidden>📄 Word 파일 올리기 (.docx)</label><span data-fname class="hint" style="margin:0"></span></div>
      <details class="wr-ai-peek"><summary>파일이 안 되면: Gemini 답을 붙여 넣기</summary>
        <textarea class="wr-in wr-ai-paste" rows="4" data-paste placeholder="[1 한 문장 소개] ... 처럼 시작하는 Gemini 답을 붙여 넣어요"></textarea>
        <div class="btns"><button class="btn" type="button" data-fill>✍️ 기획서에 반영하기</button></div></details>
      <p class="wr-status" data-fmsg></p>
      <div class="wr-ai-log" data-flist></div>
      <p class="hint">반영된 내용을 확인하고 내 말로 다듬은 뒤 아래 <b>💾 저장하기</b>를 눌러요. 기획서를 다 쓰면 맨 아래 <b>🎨 스테이지 1 화면 그리고 목업 받기</b>로 이어져요.</p>
    </div>
  </section>`;
}
function picBox(){
  return `<section class="wr-ai" id="wrPic" style="margin-top:18px">
    <div class="wr-ai-title">🎨 스테이지 1 화면 그리고 목업 받기 <span>기획서를 다 쓴 다음에 해요 · 그림은 기획서 맨 아래 7️⃣ 칸에 들어가요</span></div>
    <div class="wr-ai-step">
      <ol class="wr-ai-steps">
        <li><b>그림판이나 종이</b>에 스테이지 1 화면을 그려요. 잘 그릴 필요 없어요. 플레이어·등장하는 것·점수·버튼이 <b>어디에 있는지</b>만 보이면 되고, 이름을 옆에 적어 두면 좋아요.</li>
        <li>그린 그림을 저장하거나 사진을 찍어서 아래 <b>✏️ 내 손그림 올리기</b>로 올려요.</li>
        <li><a href="https://gemini.google.com/" target="_blank" rel="noopener">Gemini ↗</a>에 <b>그림 파일을 첨부</b>하고, 프롬프트를 붙여 넣어 보내요. Gemini가 먼저 <b>5-2 등장하는 것들 중 그림에 안 보이는 것</b>을 물어보면, "화면에 안 보이는 거야" 또는 "빠뜨렸어, ○○에 둬"라고 답해요. 목업을 받은 뒤 고치고 싶은 곳은 "버튼을 더 크게"처럼 말해서 다시 받아요.</li>
        <li>마음에 드는 목업 이미지를 내려받아 <b>🖼️ Gemini 목업 올리기</b>로 올려요.</li>
      </ol>
      <details class="wr-ai-peek" data-mock-peek><summary>프롬프트 보기</summary><pre class="wr-ai-out" data-mock-out>${esc(MOCKUP_PROMPT.replace("{{CHECK}}", "[확인할 목록]\n(내 기획서의 5-2 등장하는 것들과 5-3 입력이 자동으로 들어가요)"))}</pre></details>
      <div class="btns"><button class="btn" type="button" data-mockp>📋 목업 요청 프롬프트 복사 (내 기획서 포함)</button></div>
      <div class="wr-ai-drop">
        <label class="btn primary"><input type="file" accept="image/*" data-pic="sketch" hidden>✏️ 내 손그림 올리기</label>
        <label class="btn primary"><input type="file" accept="image/*" data-pic="mockup" hidden>🖼️ Gemini 목업 올리기</label>
      </div>
      <p class="wr-status" data-pmsg></p>
      <p class="hint">그림을 올리면 기획서에 자동으로 저장돼요. 다 됐으면 아래 <b>📮 제출하기</b>를 눌러요.</p>
    </div>
  </section>`;
}
function mountPic(){
  const box = document.getElementById("wrPic"); if(!box) return;
  const pmsg = box.querySelector("[data-pmsg]"), mockOut = box.querySelector("[data-mock-out]");
  const fullMock = async () => { const sm = await planForMockup();
    const t = MOCKUP_PROMPT.replace("{{CHECK}}", checkList(sm && sm.S)) + "\n\n" + (sm ? sm.text : "[내 게임 기획서]\n(아직 불러오지 못했어요. 내 게임을 두세 문장으로 직접 적어 줘.)");
    mockOut.textContent = t; return t; };
  box.querySelector("[data-mock-peek]").addEventListener("toggle", e => { if(e.target.open) fullMock(); });
  box.querySelector("[data-mockp]").onclick = async e => { const b = e.currentTarget; copyText(await fullMock(), b); };
  box.querySelectorAll("input[data-pic]").forEach(inp => inp.onchange = e => { const f = e.target.files[0]; e.target.value = ""; if(f) uploadPic(inp.dataset.pic, f, pmsg); });
}
function mountReview(){
  const box = document.getElementById("wrAi"); if(!box) return;
  const msg = box.querySelector("[data-msg]"), plan = box.querySelector("[data-plan]"), out = box.querySelector("[data-out]"), cp = box.querySelector("[data-copy]");
  let prompt = "";
  box.querySelector("[data-load]").onclick = async () => {
    msg.textContent = "2주차 기획서를 불러오는 중…"; msg.className = "wr-status";
    try{
      const sm = await latestPlan(); BASE_FILL = planToFill(sm.S); BASE_REPO = W.st.repo;
      plan.textContent = sm.text; plan.hidden = false;
      prompt = REVIEW_PROMPT + "\n\n" + sm.text; out.textContent = prompt; cp.disabled = false;
      msg.textContent = sm.empty ? "⚠️ 2주차 기획서가 거의 비어 있어요. 그래도 Gemini에게 보내면 무엇부터 정할지 함께 정리할 수 있어요." : "✅ 불러왔어요. 2단계에서 프롬프트를 복사하세요.";
      msg.className = "wr-status " + (sm.empty ? "warn" : "ok");
    }catch(e){ msg.textContent = "2주차 기획서를 불러오지 못했어요. 잠시 뒤 다시 눌러 주세요."; msg.className = "wr-status err"; }
  };
  cp.onclick = () => copyText(prompt, cp);
  box.querySelector("[data-fillp]").onclick = e => copyText(FILL_PROMPT, e.currentTarget);
  const fmsg = box.querySelector("[data-fmsg]"), flist = box.querySelector("[data-flist]"), paste = box.querySelector("[data-paste]");
  box.querySelector("[data-file]").onchange = async e => {
    const f = e.target.files[0]; if(!f) return; e.target.value = "";
    box.querySelector("[data-fname]").textContent = "📄 " + f.name;
    try{ paste.value = /\.docx$/i.test(f.name) ? await docxText(await f.arrayBuffer()) : await f.text(); }
    catch(_){ fmsg.textContent = "파일을 읽지 못했어요. Word(.docx) 파일인지 확인하거나, 아래 '붙여 넣기'를 이용해 주세요."; fmsg.className = "wr-status err"; return; }
    runFill(paste.value, fmsg, flist);
  };
  box.querySelector("[data-fill]").onclick = () => runFill(paste.value, fmsg, flist);
}

/* ---------- 🎮 4주차 Gemini로 내 게임 만들기 ----------
   ① 3주차 게임 기획서(docs/week3-plan.md, 없으면 2주차)를 불러와 정리
   ② 기획서를 넣은 게임 만들기 프롬프트 자동 작성 (복사하면 개발일지 1️⃣에도 들어가요)
   ③ 3주차 목업 이미지(기획서 7️⃣ 칸) 불러오기·내려받기
   ④⑤⑥ Gemini에서 받은 게임 미리 해 보기 → ver1.html 내려받기 → play/index.html로 올리고 제출
   ⑦ 추가·수정·버그 요청 문장 만들기 ⑧ ver2 같은 방법으로 올리기
   ⑨ 대화에서 요청한 것을 Word로 받아 올리면 개발일지 3️⃣·4️⃣·💬·📌에 반영
   GAME_WEEKS에 주차를 넣으면 그 주차 개발일지 작성 화면에 나와요. */
const GAME_WEEKS = [4];
const DEVLOG4 = "devlog/week04.md";
const GAME_PATH = "play/index.html";
const G = { plan:null, from:"", mock:null, sketch:null, repo:null, code:{}, undo:null };

/* 3주차 기획서의 7️⃣ 칸에서 그림 위치를 찾아요 */
function picPaths(md){
  const out = {}; if(!md) return out;
  const re = /!\[([^\]]*)\]\(([^)\s]+)\)/g; let m;
  while((m = re.exec(md))){
    const p = "docs/" + m[2].replace(/^\.\//, "");
    if(/목업/.test(m[1])) out.mock = p; else if(/손그림/.test(m[1])) out.sketch = p;
  }
  return out;
}
async function loadWeek3(){
  let t3 = null, t2 = null;
  try{ t3 = await fetchDoc(PLAN_PATH); }catch(_){}
  const ok3 = t3 && !summarizePlan(t3).empty;
  if(!ok3){ try{ t2 = await fetchDoc(SRC_PATH); }catch(_){} }
  const md = ok3 ? t3 : (t2 || t3);
  if(!md) throw new Error("no plan");
  const pics = picPaths(t3);
  G.plan = summarizePlan(md); G.from = ok3 ? "3주차" : (t2 ? "2주차" : "3주차");
  G.mock = pics.mock || null; G.sketch = pics.sketch || null; G.repo = W.st.repo;
  return G;
}

const GAME_PROMPT = `너는 고등학생과 함께 HTML 웹게임을 만드는 게임 개발자야.
맨 아래 [내 게임 기획서]는 내가 {{FROM}}에 정리한 게임 기획서야.
{{MOCK}}
이것을 바탕으로 "스테이지 1"을 실제로 플레이할 수 있는 웹게임으로 만들어 줘. Canvas에서 바로 실행해 볼 수 있게 만들어 줘.

[만드는 규칙]
- HTML 파일 하나에 HTML, CSS, JavaScript를 모두 넣어. 외부 이미지·소리 파일이나 라이브러리 없이 브라우저에서 바로 실행되게 해.
- 기획서의 5-1(시작할 때·플레이 중·클리어 조건·실패 조건), 5-2(등장하는 것들), 5-3(입력)을 하나도 빠뜨리지 말고 넣어.
- 화면 시점은 기획서의 화면 시점을 따라. 없으면 목업 이미지의 시점을 따라.
- 캐릭터와 물건은 도형, 이모지, Canvas 그리기로 단순하게 표현해.
- 기획서에 없는 기능(새 캐릭터, 스테이지 2, 상점, 업그레이드 등)은 넣지 마.
- 기획서에 숫자가 없는 것(속도, 시간, 개수 등)은 처음 하는 사람도 할 만한 값으로 정하고, 코드 맨 위에 "설정값"으로 모아 둬.
- 순서: 시작 화면(게임 제목, 조작법, 시작 버튼) → 게임 → 클리어 또는 게임오버 화면(결과, 다시 하기 버튼).
- 화면을 클릭하지 않아도 키보드가 바로 동작하게 하고, 방향키나 스페이스를 눌러도 페이지가 스크롤되지 않게 해.
- 코드 중요한 곳에 한국어 주석을 달아 줘.

[게임을 만든 다음 글로 알려 줘]
1. 기획서 반영 점검표: | 기획서 칸 | 게임에 넣은 방법 | ✅ 넣음 / 🔺 바꿈 / ❌ 못 넣음 |
2. 네가 정한 숫자: 기획서에 없어서 네가 정한 값(속도, 시간, 개수 등)과 코드 속 설정값 이름
3. 조작법
4. 처음 플레이할 때 꼭 확인해 볼 것 3가지

마지막에 "플레이해 보고 고치고 싶은 곳을 하나씩 말해 줘"라고 말해 줘.`;
const MOCK_ON = `첨부한 이미지는 3주차에 만든 이 게임의 "스테이지 1" 화면 목업이야. 화면 배치, 색, 모양, 점수·버튼 위치는 이 목업을 최대한 따라 해.`;
const MOCK_OFF = `(목업 이미지는 없어. 화면 배치는 기획서를 보고 보기 좋게 정해 줘.)`;
function gamePrompt(){
  const withMock = !!G.mock && G.useMock !== false;
  return GAME_PROMPT.replace("{{FROM}}", G.from || "3주차").replace("{{MOCK}}", withMock ? MOCK_ON : MOCK_OFF)
    + "\n\n" + (G.plan ? G.plan.text : "[내 게임 기획서]\n(아직 불러오지 못했어요. 내 게임을 두세 문장으로 직접 적어 줘.)");
}

/* 수정 요청 문장 만들기 (7단계) */
const REQ_KIND = {
  add:{ label:"➕ 추가", name:"추가", now:"", want:"이렇게 넣어 줘", ex:{ what:"예: 아이템(하트)", want:"예: 10초마다 화면 위쪽 아무 곳에 하트가 생기고, 먹으면 목숨이 1 늘어나게" } },
  fix:{ label:"✏️ 수정", name:"수정", now:"지금은", want:"이렇게 바꿔 줘", ex:{ what:"예: 플레이어 점프", now:"예: 점프가 너무 낮아서 장애물을 넘을 수 없어", want:"예: 점프 높이를 지금의 2배로" } },
  bug:{ label:"🐞 버그", name:"버그", now:"지금은 이렇게 동작해", want:"원래는 이렇게 동작해야 해", ex:{ what:"예: 게임오버 후 다시 하기 버튼", now:"예: 다시 하기를 누르면 점수가 0으로 안 돌아가고 적이 2배로 나와", want:"예: 다시 하기를 누르면 처음 시작할 때와 똑같이 시작" } }
};
function reqPrompt(k, what, now, want){
  const K = REQ_KIND[k], L = [];
  L.push(`지금 게임에서 다른 부분은 그대로 두고, 아래 한 가지만 ${k === "add" ? "추가해" : "고쳐"} 줘.`);
  L.push(`[종류] ${K.name}${k === "bug" ? " (원하는 대로 동작하지 않아요)" : ""}`);
  L.push(`[어디] ${what.trim() || "(어디를)"}`);
  if(K.now) L.push(`[${K.now}] ${now.trim() || "(지금 상태)"}`);
  L.push(`[${K.want}] ${want.trim() || "(원하는 것)"}`);
  L.push("", "- 고친 뒤 전체 코드를 HTML 파일 하나로 다시 보여 줘.", "- 무엇을 어떻게 바꿨는지 한 줄로 알려 줘.");
  if(k === "bug") L.push("- 왜 그런 문제가 생겼는지도 쉬운 말로 한 줄 알려 줘.");
  return L.join("\n");
}

/* 9단계: 요청 정리 Word */
const LOG_PROMPT = `지금까지 우리가 나눈 대화를 처음부터 끝까지 살펴보고, 내가 게임에 추가하거나 수정해 달라고 요청한 내용을 정리해서 아래 형식 그대로 Word 문서 파일로 만들어 줘. (파일을 만들 수 없으면 글로 보여 줘.)

[규칙]
- 맨 처음 "게임을 만들어 줘" 요청은 빼고, 그다음부터 내가 보낸 요청을 보낸 순서대로 하나도 빠뜨리지 말고 [요청] 줄로 써.
- 종류는 추가 / 수정 / 버그 중 하나로 써. (추가: 새 기능을 넣어 달라고 함, 수정: 있는 것을 바꿔 달라고 함, 버그: 원하는 대로 동작하지 않아서 고쳐 달라고 함)
- 결과는 ✅ 잘 됨 / 🔺 조금 됨 / ❌ 안 됨 중 하나로 써. 내가 대화에서 결과를 말하지 않았으면 "❓ 확인 필요"라고 써.
- 대괄호 [ ] 안의 칸 이름은 절대 바꾸지 말고, 한 줄에 하나씩 써. 표로 만들지 마. 칸은 | 로 나눠.
- 내가 하지 않은 요청이나 말하지 않은 결과는 지어내지 마.

[게임 제목]
[요청] 종류 | 내가 요청한 내용(한 문장) | 결과 | 남은 문제 (없으면 "없음")
[ver2 바뀐 점] 처음 만든 게임(ver1)과 비교해서 바뀐 점을 한 줄로
[가장 효과가 좋았던 요청] 원하는 대로 가장 잘 고쳐진 요청을 내가 보낸 문장 그대로
[다음에 할 일] 아직 해결하지 못한 것 (하나마다 한 줄)`;

function parseLog(text){
  const R = { title:"", reqs:[], ver2:"", best:"", next:[] }; let hit = 0;
  const kindRe = /^(➕|✏️|🐞)?\s*(추가|수정|버그)/;
  text.replace(/\r/g, "").split("\n").forEach(raw => {
    const l = raw.replace(/\*\*/g, "").replace(/^[\s>*•·\-–]+/, "").trim(); if(!l) return;
    const m = l.match(/^\[\s*([^\]]+?)\s*\]\s*[:：]?\s*(.*)$/);
    const cells = v => { let c = v.split("|").map(x => x.trim()); if(c[0] === "") c.shift(); if(c[c.length-1] === "") c.pop(); return c; };
    if(!m){   // 표로 와도 읽어요: "버그 | ... | ✅ | ..." 줄
      const c = cells(l); if(c.length >= 3 && kindRe.test(c[0])){ R.reqs.push([c[0], c[1] || "", c[2] || "", c.slice(3).join(" | ")]); hit++; }
      return;
    }
    const tag = m[1].replace(/\s/g, ""), val = m[2].trim(); hit++;
    if(/^요청$|수정요청|추가요청/.test(tag)){ const c = cells(val); if(!isBlank(c[0])) R.reqs.push([c[0], c[1] || "", c[2] || "", c.slice(3).join(" | ")]); }
    else if(/제목/.test(tag)) R.title = val;
    else if(/ver2|바뀐/.test(tag)) R.ver2 = val;
    else if(/효과|좋았던요청/.test(tag)) R.best = val.replace(/^["“'「]|["”'」]$/g, "");
    else if(/다음/.test(tag)){ if(!isBlank(val)) R.next.push(val); }
    else hit--;
  });
  return hit ? R : null;
}
const kindName = t => { const m = String(t).match(/추가|수정|버그/); return m ? m[0] : t.trim(); };

/* 개발일지에서 re 제목 아래(다음 제목 전까지) 조각을 찾아요 */
function segUnder(re, pred){
  let on = false;
  for(const s of W.segs){
    if(s.t === "raw"){ const hs = s.lines.filter(l => /^#{2,3}\s/.test(l)); if(hs.length) on = re.test(hs[hs.length - 1]); continue; }
    if(on && pred(s)) return s;
  }
  return null;
}
const firstTable = () => W.segs.find(s => s.t === "table");
const today = () => { const d = new Date(); return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`; };
function setIfEmpty(c, v){ if(c && !c.ro && !(c.val || "").trim() && !isBlank(v)){ c.val = v; c.hl = "new"; return true; } return false; }
const onDevlog = () => W.doc && W.doc.path === DEVLOG4 && W.segs.length;

function putPromptInLog(text){
  if(!onDevlog()) return false;
  const c = segUnder(/1️⃣/, s => s.t === "code"); if(!c) return false;
  c.val = text;
  const chk = segUnder(/1️⃣/, s => s.t === "chk");
  if(chk && G.mock && G.useMock !== false && !chk.on){ chk.on = true; chk.hl = "new"; }
  const head = firstTable(); if(head && head.rows[0]) setIfEmpty(head.rows[0][0], today());
  renderSegs(document.getElementById("wrDoc")); markDirty(); return true;
}
function putVersionInLog(ver, note){
  if(!onDevlog()) return;
  const t = segUnder(/버전 기록/, s => s.t === "table"); if(!t) return;
  let r = t.rows.find(r => new RegExp("ver\\s*" + ver + "\\b", "i").test(r[0].text || r[0].val || ""));
  if(!r){ r = t.head.map(() => ({ ro:false, ph:"", val:"" })); r[0].val = "ver" + ver; t.rows.push(r); }
  [[1, today()], [2, note]].forEach(([i, v]) => { if(r[i] && !r[i].ro && !isBlank(v)){ r[i].hl = (r[i].val || "").trim() ? "chg" : "new"; r[i].val = v; } });
  const head = firstTable(); if(head && head.rows[0]) setIfEmpty(head.rows[0][0], today());
  renderSegs(document.getElementById("wrDoc")); markDirty();
}
function mergeLog(R){
  const log = [];
  const head = firstTable(); if(head && head.rows[0] && setIfEmpty(head.rows[0][1], R.title)) log.push("➕ 내 게임 제목");
  const t = segUnder(/추가 · 수정|수정 요청 기록|추가·수정/, s => s.t === "table");
  if(t){
    const key = v => normName(v).slice(0, 24);
    const freeRow = () => t.rows.find(r => r.every(c => c.ro || !(c.val || "").trim()));
    R.reqs.forEach(q => {
      if(t.rows.some(r => key(r[1].val || r[1].text || "") && key(r[1].val || r[1].text || "") === key(q[1]))) return;   // 이미 적은 요청
      let r = freeRow(); if(!r){ r = t.head.map(() => ({ ro:false, ph:"", val:"" })); t.rows.push(r); }
      [kindName(q[0]), q[1], q[2], q[3]].forEach((v, i) => { if(r[i] && !isBlank(v)){ r[i].val = v; r[i].hl = "new"; } });
      log.push(`🆕 요청 기록: [${kindName(q[0])}] ${q[1].slice(0, 30)}${q[1].length > 30 ? "…" : ""}`);
    });
  }
  if(!isBlank(R.ver2)){
    const v = segUnder(/버전 기록/, s => s.t === "table");
    const r = v && v.rows.find(r => /ver\s*2\b/i.test(r[0].text || r[0].val || ""));
    if(r && r[2] && !r[2].ro && (r[2].val || "").trim() !== R.ver2){ r[2].hl = (r[2].val || "").trim() ? "chg" : "new"; r[2].val = R.ver2; log.push("✏️ 버전 기록 · ver2 바뀐 점"); }
  }
  if(!isBlank(R.best)){
    const c = segUnder(/가장 효과가 좋았던/, s => s.t === "code");
    if(c && !(c.val || "").trim()){ c.val = R.best; log.push("➕ 가장 효과가 좋았던 수정 요청"); }
  }
  if(R.next.length){
    const li = segUnder(/다음 주/, s => s.t === "list");
    if(li){ const have = li.val.split("\n").map(x => x.trim()).filter(Boolean); const add = R.next.filter(x => !have.includes(x));
      if(add.length){ li.val = have.concat(add).join("\n"); log.push(`➕ 다음 주에 할 일 ${add.length}개`); } }
  }
  return log;
}
function runLog(text, msg, list){
  const R = parseLog(text);
  if(!R){ msg.textContent = "정해진 형식([요청] 같은 줄)을 찾지 못했어요. 9단계 프롬프트로 다시 받아 주세요."; msg.className = "wr-status err"; return; }
  if(!onDevlog()){ msg.textContent = "개발일지를 아직 불러오지 못했어요. 잠시 뒤 다시 올려 주세요."; msg.className = "wr-status err"; return; }
  W.segs.forEach(s => { delete s.hl; if(s.rows) s.rows.forEach(r => r.forEach(c => delete c.hl)); });
  G.undo = JSON.stringify(W.segs);
  const log = mergeLog(R);
  renderSegs(document.getElementById("wrDoc"));
  if(!log.length){ msg.textContent = "새로 채울 칸이 없어요. 이미 개발일지에 들어 있는 내용이에요."; msg.className = "wr-status"; list.innerHTML = ""; return; }
  markDirty();
  msg.textContent = `✅ ${log.length}곳을 채웠어요. 초록 칸이 새로 들어간 곳이에요. 결과(✅/🔺/❌)를 직접 확인하고 💾 저장하기를 눌러요.`; msg.className = "wr-status ok";
  list.innerHTML = `<ul>${log.map(x => `<li>${esc(x)}</li>`).join("")}</ul><button class="btn" type="button" data-undo>↩️ 채우기 전으로 되돌리기</button>`;
  list.querySelector("[data-undo]").onclick = () => { W.segs = JSON.parse(G.undo); renderSegs(document.getElementById("wrDoc")); list.innerHTML = ""; msg.textContent = "되돌렸어요."; msg.className = "wr-status"; };
}

/* Gemini 답에서 HTML 코드만 꺼내요 (```html … ``` 로 와도 돼요) */
function cleanCode(t){
  let s = String(t || "").replace(/\r\n/g, "\n").trim();
  const f = s.match(/```(?:html|HTML)?\s*\n([\s\S]*?)```/); if(f && /<(html|body|script|canvas|!doctype)/i.test(f[1])) s = f[1].trim();
  const i = s.search(/<!doctype html|<html/i); if(i > 0) s = s.slice(i);
  return s;
}
const looksGame = s => /<(html|body)[\s>]/i.test(s) && /<(script|canvas)/i.test(s);
function dl(name, blob){ const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }

async function uploadGame(ver, code, note, msg){
  if(!getKey(W.st.repo)){ msg.textContent = "먼저 위에서 열쇠(코드)를 넣어 주세요."; msg.className = "wr-status err"; document.getElementById("wrKey").scrollIntoView({ behavior:"smooth" }); return; }
  if(!looksGame(code)){ msg.textContent = "게임 코드가 아닌 것 같아요. <html>부터 </html>까지 전체 코드를 넣어 주세요."; msg.className = "wr-status err"; return; }
  msg.textContent = `ver${ver} 게임을 올리는 중…`; msg.className = "wr-status";
  try{
    const g = await gh(`${repoPath()}/contents/${GAME_PATH}?ref=main`);
    const body = { message:`${W.w.week}주차 게임 ver${ver} 올리기 (사이트에서)`, content:b64enc(code), branch:"main" };
    if(g.ok) body.sha = (await g.json()).sha;
    const r = await gh(`${repoPath()}/contents/${GAME_PATH}`, { method:"PUT", body:JSON.stringify(body), headers:{ "Content-Type":"application/json" } });
    if(r.status === 401 || r.status === 403 || r.status === 404) throw new Error("저장 권한이 없어요. 열쇠를 확인해 주세요.");
    if(!r.ok) throw new Error("게임을 올리지 못했어요. 잠시 뒤 다시 해 주세요.");
    putVersionInLog(ver, note);
    if(!(await save(true))){ msg.textContent = `ver${ver} 게임은 올렸어요. 개발일지 저장이 안 됐으니 아래 💾 저장하기를 누른 뒤 📮 제출하기로 제출해 주세요.`; msg.className = "wr-status warn"; return; }
    const v = await nextVersion();
    const notes = `## 🛠 패치노트 · 게임 ver${ver}\n- 바뀐 점: ${note || ""}\n- 고친 버그: \n- 다음 버전에서 할 일: `;
    const rr = await gh(`${repoPath()}/releases`, { method:"POST", headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ tag_name:`week${W.w.week}-v${v}`, target_commitish:"main", name:`${W.w.week}주차 v${v} 제출 · 게임 ver${ver}`, body:notes }) });
    if(!rr.ok) throw new Error(`게임은 올렸지만 제출(v${v})은 하지 못했어요. 아래 📮 제출하기를 눌러 주세요.`);
    msg.innerHTML = `✅ ver${ver} 게임을 올리고 <b>${W.w.week}주차 v${v}</b>로 제출했어요. <a href="${hubUrl(W.st)}play/" target="_blank" rel="noopener">내 게임 열기 ↗</a> (반영까지 1~2분 걸릴 수 있어요)`;
    msg.className = "wr-status ok";
  }catch(e){ msg.textContent = e.message || "게임을 올리지 못했어요."; msg.className = "wr-status err"; }
}

/* 5·6단계, 8단계에 같은 모양으로 들어가는 게임 칸 */
function slotHtml(ver){
  return `<div class="wr-slot" data-slot="${ver}">
      <div class="wr-ai-drop"><label class="btn"><input type="file" accept=".html,.htm,.txt" data-gfile hidden>📄 내려받은 html 파일 고르기</label><span class="hint" data-gname style="margin:0">또는 아래 칸에 코드를 붙여 넣어요</span></div>
      <textarea class="wr-in mono wr-ai-paste" rows="4" data-gcode placeholder="Gemini Canvas의 코드(</>)를 전체 선택해 복사한 뒤 여기에 붙여 넣어요"></textarea>
      <div class="btns"><button class="btn" type="button" data-gprev>▶ 미리 해 보기</button><button class="btn" type="button" data-gdl>💾 ver${ver}.html 내려받기</button></div>
      <div class="wr-game-prev" data-gbox hidden><iframe sandbox="allow-scripts allow-pointer-lock" title="ver${ver} 미리 보기" data-gframe></iframe></div>
      <label class="wr-label" style="display:block;margin-top:10px">🛠 ver${ver}에서 바뀐 점 (버전 기록·패치노트에 들어가요)</label>
      <textarea class="wr-in" rows="1" data-gnote>${ver === 1 ? "3주차 기획서와 목업으로 Gemini가 처음 만든 스테이지 1 게임" : ""}</textarea>
      <div class="btns" style="margin-top:8px"><button class="btn primary" type="button" data-gup>⬆️ ver${ver}로 올리고 제출하기</button></div>
      <p class="wr-status" data-gmsg></p>
    </div>`;
}
function mountSlot(box, ver){
  const el = box.querySelector(`[data-slot="${ver}"]`); if(!el) return;
  const code = el.querySelector("[data-gcode]"), msg = el.querySelector("[data-gmsg]"), frame = el.querySelector("[data-gframe]"), pbox = el.querySelector("[data-gbox]");
  if(G.code[ver]) code.value = G.code[ver];
  code.addEventListener("input", () => { G.code[ver] = code.value; });
  el.querySelector("[data-gfile]").onchange = async e => { const f = e.target.files[0]; e.target.value = ""; if(!f) return;
    code.value = await f.text(); G.code[ver] = code.value; el.querySelector("[data-gname]").textContent = "📄 " + f.name; };
  const get = () => { const s = cleanCode(code.value); if(!looksGame(s)){ msg.textContent = "게임 코드가 아닌 것 같아요. <html>부터 </html>까지 전체 코드를 넣어 주세요."; msg.className = "wr-status err"; return null; } msg.textContent = ""; return s; };
  el.querySelector("[data-gprev]").onclick = () => { const s = get(); if(!s) return; pbox.hidden = false; frame.srcdoc = s; setTimeout(() => frame.focus(), 300); };
  el.querySelector("[data-gdl]").onclick = () => { const s = get(); if(!s) return; dl(`ver${ver}.html`, new Blob([s], { type:"text/html;charset=utf-8" })); msg.textContent = `💾 ver${ver}.html을 내려받았어요. 컴퓨터에 잘 보관해 두세요.`; msg.className = "wr-status ok"; };
  el.querySelector("[data-gup]").onclick = async ev => { const s = get(); if(!s) return; const b = ev.currentTarget; b.disabled = true;
    await uploadGame(ver, s, el.querySelector("[data-gnote]").value.trim(), msg); b.disabled = false; };
}

function gameBox(lite){
  if(lite) return gameBoxFull(true).split('<!--LITE-END-->')[0];
  return gameBoxFull(false).replace('<!--LITE-END-->','');
}
function gameBoxFull(lite){
  const gem = `<a href="https://gemini.google.com/" target="_blank" rel="noopener">Gemini ↗</a>`;
  return `<section class="wr-ai" id="wrGame">
    <div class="wr-ai-title">🎮 Gemini로 내 게임 만들기 <span>3주차 기획서 → 프롬프트 → 목업 → ver1 → 수정 요청 → ver2 → Word 정리</span></div>
    <div class="wr-ai-step"><div class="wr-ai-h"><i>1</i>3주차 게임 기획서 불러오기</div>
      <div class="btns"><button class="btn primary" type="button" data-gload>📥 3주차 기획서 불러오기</button></div>
      <p class="wr-status" data-msg></p>
      <pre class="wr-ai-out" data-plan hidden></pre>
    </div>
    <div class="wr-ai-step"><div class="wr-ai-h"><i>2</i>게임 만들기 프롬프트 (자동 작성) <span>불러온 기획서가 자동으로 들어가요</span></div>
      <details class="wr-ai-peek"><summary>프롬프트 보기</summary><pre class="wr-ai-out" data-out>먼저 1단계에서 3주차 기획서를 불러와 주세요.</pre></details>
      <div class="btns"><button class="btn" type="button" data-copy disabled>📋 게임 만들기 프롬프트 복사</button></div>
      <p class="hint">복사하면 아래 개발일지 <b>1️⃣</b> 칸에도 자동으로 들어가요.</p>
    </div>
    <div class="wr-ai-step"><div class="wr-ai-h"><i>3</i>3주차 목업 이미지 불러오기</div>
      <div class="wr-mock" data-mock><p class="hint" style="margin:0">1단계를 누르면 3주차 기획서 7️⃣ 칸에 올린 목업이 여기에 나와요.</p></div>
    </div>
    <div class="wr-ai-step"><div class="wr-ai-h"><i>4</i>Gemini에 넣고 게임 만들기 요청</div>
      <ol class="wr-ai-steps">
        <li>${gem} 에서 <b>새 채팅</b>을 열고, 입력창의 <b>도구 → Canvas</b>를 켜요.</li>
        <li><b>+ (파일 추가)</b>로 3단계에서 내려받은 <b>목업 이미지</b>를 첨부해요.</li>
        <li>2단계에서 복사한 프롬프트를 붙여 넣고 보내요.</li>
      </ol>
    </div>
    ${lite ? `<div class="wr-ai-step"><div class="wr-ai-h"><i>5</i>게임 확인 · ver1·ver2 올리기 · 수정 요청 · Word 정리는 작성하기 화면에서 <span>5~9단계</span></div>
      <div class="btns"><a class="btn primary" href="#/write/${W.w.week}/${esc(W.st.repo)}/0">✏️ 작성하기에서 이어 하기</a></div></div>
  </section>` : ""}<!--LITE-END-->
    <div class="wr-ai-step"><div class="wr-ai-h"><i>5</i>만들어진 게임 확인하고 내려받기 <span>Canvas 미리 보기에서 먼저 해 봐요</span></div>
      <p class="hint">Canvas 오른쪽 위 <b>코드(&lt;/&gt;)</b>를 눌러 전체 코드를 복사해 아래 칸에 붙여 넣거나, 내려받은 html 파일을 골라요. <b>▶ 미리 해 보기</b>로 확인하고 <b>💾 ver1.html 내려받기</b>로 내 컴퓨터에도 저장해요.</p>
      ${slotHtml(1)}
    </div>
    <div class="wr-ai-step"><div class="wr-ai-h"><i>6</i>ver1로 업데이트 <span>5단계의 ⬆️ 버튼을 누르면 돼요</span></div>
      <p class="hint">내 게임(<code>play/index.html</code>)이 ver1로 바뀌고 4주차 제출 기록과 개발일지 <b>4️⃣ 버전 기록</b>에 자동으로 남아요. 올린 다음 아래 개발일지 <b>2️⃣ ver1 플레이해 보기</b> 표를 채워요.</p>
    </div>
    <div class="wr-ai-step"><div class="wr-ai-h"><i>7</i>부족한 부분 · 안 되는 부분 요청하기 <span>같은 Gemini 채팅에서 한 번에 하나씩</span></div>
      <p class="hint">2️⃣ 표에서 🔺·❌인 것부터 요청해요. 종류를 고르고 빈칸을 채우면 요청 문장이 만들어져요. 결과를 확인하고 다음 요청으로 넘어가요.</p>
      <div class="wr-req">
        <div class="btns" data-kinds>${Object.entries(REQ_KIND).map(([k, K], i) => `<button class="btn${i ? "" : " primary"}" type="button" data-kind="${k}">${K.label}</button>`).join("")}</div>
        <label class="wr-label">어디를?</label><textarea class="wr-in" rows="1" data-rwhat></textarea>
        <div data-rnow-wrap><label class="wr-label" data-rnow-l></label><textarea class="wr-in" rows="1" data-rnow></textarea></div>
        <label class="wr-label" data-rwant-l></label><textarea class="wr-in" rows="1" data-rwant></textarea>
        <pre class="wr-ai-out" data-rout></pre>
        <div class="btns"><button class="btn" type="button" data-rcopy>📋 요청 문장 복사</button><button class="btn" type="button" data-rclear>🧹 새 요청</button></div>
      </div>
      <details class="wr-ai-peek"><summary>💡 잘 고쳐지는 요청 쓰는 법</summary><ul class="wr-ai-steps">
        <li><b>한 번에 하나씩</b> 요청해요. 여러 개를 한꺼번에 말하면 다른 곳이 망가지기 쉬워요.</li>
        <li>"좀 더", "이상해" 대신 <b>숫자와 위치</b>로 말해요. (예: 속도를 절반으로, 화면 오른쪽 위에)</li>
        <li>버그는 <b>무엇을 했을 때 → 어떻게 됐는지 → 원래 어떻게 돼야 하는지</b>를 적어요.</li>
        <li>고쳐진 게임은 Canvas 미리 보기에서 <b>바로 다시 해 보고</b> 결과(✅/🔺/❌)를 Gemini에게도 알려 주면 9단계 정리가 정확해져요.</li>
      </ul></details>
    </div>
    <div class="wr-ai-step"><div class="wr-ai-h"><i>8</i>ver2 내려받고 올리기 <span>요청을 다 마친 뒤 마지막 코드로</span></div>
      ${slotHtml(2)}
    </div>
    <div class="wr-ai-step" data-log-area><div class="wr-ai-h"><i>9</i>요청한 내용을 Word 파일로 정리하기 <span>같은 채팅에 보내요</span></div>
      <details class="wr-ai-peek"><summary>프롬프트 보기</summary><pre class="wr-ai-out">${esc(LOG_PROMPT)}</pre></details>
      <div class="btns"><button class="btn" type="button" data-logp>📋 Word 정리 요청 프롬프트 복사</button></div>
      <p class="hint">Gemini가 Word 파일을 바로 주지 않으면 <b>Google Docs로 내보내기 → 파일 → 다운로드 → Microsoft Word(.docx)</b>로 받아요. 받은 파일을 올리면 개발일지 <b>3️⃣ 요청 기록 · 4️⃣ ver2 바뀐 점 · 💬 · 📌</b>에 채워져요.</p>
      <div class="wr-ai-drop"><label class="btn primary"><input type="file" accept=".docx,.txt,.md" data-lfile hidden>📄 Word 파일 올리기 (.docx)</label><span data-lname class="hint" style="margin:0"></span></div>
      <details class="wr-ai-peek"><summary>파일이 안 되면: Gemini 답을 붙여 넣기</summary>
        <textarea class="wr-in wr-ai-paste" rows="4" data-lpaste placeholder="[게임 제목] ... [요청] ... 처럼 시작하는 Gemini 답을 붙여 넣어요"></textarea>
        <div class="btns"><button class="btn" type="button" data-lfill>✍️ 개발일지에 반영하기</button></div></details>
      <p class="wr-status" data-lmsg></p>
      <div class="wr-ai-log" data-llist></div>
      <p class="hint">마지막으로 <b>💬 좋았던 이유 · 🤔 비교 소감</b>은 내 말로 쓰고 💾 저장 → 📮 제출해요.</p>
    </div>
  </section>`;
}
function drawMock(box){
  const el = box.querySelector("[data-mock]");
  if(!G.mock){
    el.innerHTML = `<p class="wr-status warn" style="margin:0">3주차 목업 이미지가 아직 없어요. 3주차 작성하기 화면 맨 아래 <b>🎨 스테이지 1 화면 그리고 목업 받기</b>에서 먼저 올리면 좋아요. 목업 없이 진행하면 2단계 프롬프트가 자동으로 "목업 없음"으로 바뀌어요.</p>
      <div class="btns" style="margin-top:8px"><a class="btn" href="#/write/3/${esc(W.st.repo)}/0">3주차 작성하기로 가기</a></div>`;
    return;
  }
  const src = p => (LOCAL_IMG[p] || rawUrl(W.st, "main", p)) + "?t=" + Date.now();
  el.innerHTML = `<div class="wr-mock-pics">
      <figure><img src="${src(G.mock)}" alt="Gemini 목업"><figcaption>🖼️ 3주차 Gemini 목업</figcaption></figure>
      ${G.sketch ? `<figure><img src="${src(G.sketch)}" alt="내 손그림"><figcaption>✏️ 내 손그림 (참고)</figcaption></figure>` : ""}
    </div>
    <div class="btns"><button class="btn primary" type="button" data-mdl>⬇️ 목업 이미지 내려받기</button></div>
    <p class="wr-status" data-mmsg></p>`;
  el.querySelector("[data-mdl]").onclick = async () => {
    const m = el.querySelector("[data-mmsg]");
    try{ const r = await fetch(rawUrl(W.st, "main", G.mock) + "?t=" + Date.now()); if(!r.ok) throw 0;
      dl("week3-mockup." + (G.mock.split(".").pop() || "png"), await r.blob());
      m.textContent = "⬇️ 내려받았어요. 4단계에서 Gemini에 첨부해요."; m.className = "wr-status ok"; }
    catch(_){ m.textContent = "내려받지 못했어요. 이미지를 마우스 오른쪽 버튼으로 눌러 '이미지를 다른 이름으로 저장'을 해 주세요."; m.className = "wr-status err"; }
  };
}
function mountGame(){
  const box = document.getElementById("wrGame"); if(!box) return;
  if(G.repo !== W.st.repo){ G.plan = null; G.mock = G.sketch = null; G.code = {}; G.repo = null; }
  const msg = box.querySelector("[data-msg]"), plan = box.querySelector("[data-plan]"), out = box.querySelector("[data-out]"), cp = box.querySelector("[data-copy]");
  const ready = () => { plan.textContent = G.plan.text; plan.hidden = false; out.textContent = gamePrompt(); cp.disabled = false; drawMock(box); };
  box.querySelector("[data-gload]").onclick = async () => {
    msg.textContent = "3주차 기획서를 불러오는 중…"; msg.className = "wr-status";
    try{
      await loadWeek3(); ready();
      const warn = G.from !== "3주차" ? `⚠️ 3주차 기획서가 비어 있어서 ${G.from} 기획서를 불러왔어요. ` : (G.plan.empty ? "⚠️ 기획서가 거의 비어 있어요. " : "");
      msg.textContent = (warn || "✅ 불러왔어요. ") + (G.mock ? "목업 이미지도 찾았어요." : "목업 이미지는 아직 없어요 (3단계 참고).");
      msg.className = "wr-status " + (warn || !G.mock ? "warn" : "ok");
    }catch(_){ msg.textContent = "기획서를 불러오지 못했어요. 잠시 뒤 다시 눌러 주세요."; msg.className = "wr-status err"; }
  };
  if(G.plan) ready();
  cp.onclick = () => { const t = gamePrompt(); copyText(t, cp); G.lastPrompt = t; if(putPromptInLog(t)) setStatus("프롬프트를 개발일지 1️⃣에 넣었어요. 💾 저장하기를 눌러 주세요", "warn"); else { try{ sessionStorage.setItem("pendingPrompt:" + W.st.repo, t); }catch(_){} } };
  mountSlot(box, 1); mountSlot(box, 2);
  if(!box.querySelector("[data-rwhat]")) return;   // 학생 페이지(1~4단계만)

  /* 7단계 요청 문장 만들기 */
  let kind = "add";
  const what = box.querySelector("[data-rwhat]"), now = box.querySelector("[data-rnow]"), want = box.querySelector("[data-rwant]"), rout = box.querySelector("[data-rout]");
  const redraw = () => {
    const K = REQ_KIND[kind];
    box.querySelectorAll("[data-kind]").forEach(b => b.classList.toggle("primary", b.dataset.kind === kind));
    box.querySelector("[data-rnow-wrap]").hidden = !K.now;
    box.querySelector("[data-rnow-l]").textContent = K.now ? K.now + "?" : "";
    box.querySelector("[data-rwant-l]").textContent = K.want + "!";
    what.placeholder = K.ex.what; now.placeholder = K.ex.now || ""; want.placeholder = K.ex.want;
    rout.textContent = reqPrompt(kind, what.value, now.value, want.value);
  };
  box.querySelectorAll("[data-kind]").forEach(b => b.onclick = () => { kind = b.dataset.kind; redraw(); });
  [what, now, want].forEach(t => t.addEventListener("input", () => { grow(t); redraw(); }));
  box.querySelector("[data-rcopy]").onclick = e => { if(!what.value.trim() || !want.value.trim()){ rout.textContent = "✋ '어디를?'과 마지막 칸을 먼저 채워 주세요.\n\n" + reqPrompt(kind, what.value, now.value, want.value); return; } copyText(rout.textContent, e.currentTarget); };
  box.querySelector("[data-rclear]").onclick = () => { [what, now, want].forEach(t => { t.value = ""; grow(t); }); redraw(); what.focus(); };
  redraw();

  /* 9단계 Word 정리 */
  box.querySelector("[data-logp]").onclick = e => copyText(LOG_PROMPT, e.currentTarget);
  const lmsg = box.querySelector("[data-lmsg]"), llist = box.querySelector("[data-llist]"), lpaste = box.querySelector("[data-lpaste]");
  box.querySelector("[data-lfile]").onchange = async e => {
    const f = e.target.files[0]; if(!f) return; e.target.value = "";
    box.querySelector("[data-lname]").textContent = "📄 " + f.name;
    try{ lpaste.value = /\.docx$/i.test(f.name) ? await docxText(await f.arrayBuffer()) : await f.text(); }
    catch(_){ lmsg.textContent = "파일을 읽지 못했어요. Word(.docx) 파일인지 확인하거나, 아래 '붙여 넣기'를 이용해 주세요."; lmsg.className = "wr-status err"; return; }
    runLog(lpaste.value, lmsg, llist);
  };
  box.querySelector("[data-lfill]").onclick = () => runLog(lpaste.value, lmsg, llist);
}

/* ---------- 페이지 ---------- */
function view(n, repo, docIdx){
  const w = findWeek(n), st = findStu(repo);
  if(!w || !st) return `<div class="empty">페이지를 찾을 수 없어요.</div>`;
  const di = Math.min(+docIdx || 0, w.docs.length - 1), d = w.docs[di];
  return `<div class="crumb"><a href="#/">홈</a> › <a href="#/week/${w.week}">${w.week}주차</a> › <a href="#/week/${w.week}/${esc(st.repo)}">${esc(label(st))}</a> › 작성하기</div>
    <div class="row-head"><h2>✏️ ${w.week}주차 · ${esc(d.name)} <em>${esc(label(st))}</em></h2></div>
    ${w.docs.length > 1 ? `<div class="doc-bar">${w.docs.map((x, i) => `<a class="tab ${i === di ? "on" : ""}" href="#/write/${w.week}/${esc(st.repo)}/${i}">${esc(x.name)}</a>`).join("")}</div>` : ""}
    <div id="wrKey"></div>
    ${REVIEW_WEEKS.includes(w.week) ? reviewBox() : ""}
    ${GAME_WEEKS.includes(w.week) && d.path === DEVLOG4 ? gameBox() : ""}
    <div class="paper wr"><div id="wrDoc"></div></div>
    ${REVIEW_WEEKS.includes(w.week) && d.path === PLAN_PATH ? picBox() : ""}
    <div class="wr-bar">
      <span id="wrStatus" class="wr-status"></span>
      <a class="btn" href="${repoUrl(st)}/edit/main/${esc(d.path)}" target="_blank" rel="noopener" title="GitHub 화면에서 직접 고치기">GitHub에서 열기</a>
      <button class="btn" id="wrSubmit">📮 제출하기</button>
      <button class="btn primary" id="wrSave">💾 저장하기</button>
    </div>`;
}
function mount(n, repo, docIdx){
  const w = findWeek(n), st = findStu(repo); if(!w || !st) return;
  W.w = w; W.st = st; W.doc = w.docs[Math.min(+docIdx || 0, w.docs.length - 1)];
  drawKey(); load(); mountReview(); mountPic(); mountGame();
  document.getElementById("wrSave").onclick = () => save();
  document.getElementById("wrSubmit").onclick = openSubmit;
}

/* 작업실(게임방)에서 코드 넣기 */
function keyDialog(repo, onDone){
  const has = !!getKey(repo);
  const dlg = document.createElement("div"); dlg.className = "wr-modal";
  dlg.innerHTML = `<div class="wr-dialog" role="dialog" aria-modal="true">
    <h3>🔑 내 열쇠</h3>
    ${has ? `<p>열쇠가 연결되어 있어요. 책상에서 과제를 쓰고 바로 저장·제출할 수 있어요.</p>
      <div class="btns" style="justify-content:flex-end"><button class="btn" data-out>열쇠 빼기</button><button class="btn primary" data-x>닫기</button></div>`
    : `<p>선생님께 받은 <b>내 코드</b>를 넣어 주세요. 복사해서 붙여 넣어도 돼요.</p>
      <div class="wr-key-row"><input type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD-1234" aria-label="내 코드"><button class="btn primary" data-ok>확인</button></div>
      <label class="wr-remember"><input type="checkbox"> 이 컴퓨터에 기억하기 (내 컴퓨터일 때만 체크)</label>
      <p class="wr-status" data-msg></p>
      <div class="btns" style="justify-content:flex-end"><button class="btn" data-x>닫기</button></div>`}
  </div>`;
  document.body.appendChild(dlg);
  const close = () => { dlg.remove(); if(onDone) onDone(!!getKey(repo)); };
  dlg.querySelectorAll("[data-x]").forEach(b => b.onclick = close);
  dlg.onclick = e => { if(e.target === dlg) close(); };
  const out = dlg.querySelector("[data-out]"); if(out) out.onclick = () => { clearKey(repo); close(); };
  const inp = dlg.querySelector("input[type=text]"); if(!inp) return;
  const msg = dlg.querySelector("[data-msg]"); inp.focus();
  const go = async () => {
    msg.textContent = "코드를 확인하는 중…"; msg.className = "wr-status";
    try{ await connect(repo, inp.value, dlg.querySelector(".wr-remember input").checked);
      dlg.querySelector(".wr-dialog").innerHTML = `<h3>🎉 열쇠 연결 완료!</h3><p>이제 책상에서 과제를 쓰고 바로 저장·제출할 수 있어요.</p><div class="btns" style="justify-content:flex-end"><button class="btn primary" data-x>확인</button></div>`;
      dlg.querySelector("[data-x]").onclick = close;
    }catch(e){ msg.textContent = e.message; msg.className = "wr-status err"; }
  };
  dlg.querySelector("[data-ok]").onclick = go;
  inp.onkeydown = e => { e.stopPropagation(); if(e.key === "Enter") go(); };
  inp.onkeyup = e => e.stopPropagation();
}

/* 학생 상세 페이지(#/week/N/repo)에도 같은 🤖 상자를 보여 줘요. 4단계 채우기는 작성하기 화면으로 넘어가서 채워요. */
function reviewFor(n, repo){ const w = findWeek(n), st = findStu(repo); if(!w) return "";
  if(REVIEW_WEEKS.includes(w.week)) return reviewBox();
  if(GAME_WEEKS.includes(w.week) && st){ W.w = w; W.st = st; return gameBox(true); }
  return ""; }
function mountReviewFor(n, repo){
  const w = findWeek(n), st = findStu(repo); if(!w || !st || !(REVIEW_WEEKS.includes(w.week) || GAME_WEEKS.includes(w.week))) return;
  W.w = w; W.st = st; W.doc = null; W.segs = []; W.dirty = false;
  if(REVIEW_WEEKS.includes(w.week)) mountReview(); else mountGame();
}

window.Writer = { view, mount, keyDialog, reviewFor, mountReviewFor, hasKey: repo => !!getKey(repo), isDirty: () => W.dirty, reset: () => { W.dirty = false; }, _parse: parseMd, _toMd: segs => { W.segs = segs; return toMd(); } };
})();
