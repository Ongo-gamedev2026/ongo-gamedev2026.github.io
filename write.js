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
  renderSegs(box);
  setStatus(getKey(W.st.repo) ? "불러왔어요" : "열쇠를 넣으면 저장할 수 있어요", "");
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


/* ---------- 🤖 Gemini 기획서 점검 (3주차) ----------
   학생의 최신 2주차 기획서(docs/week2-plan.md)를 불러와, 예시·안내는 빼고 칸별로 정리한 뒤
   점검 프롬프트 끝에 붙여 줘요. REVIEW_WEEKS에 주차를 넣으면 그 주차 작성하기 화면에 나와요. */
const REVIEW_WEEKS = [3];
const PLAN_PATH = "docs/week2-plan.md";
function summarizePlan(md){
 const L=md.replace(/\r\n/g,'\n').split('\n');const S={intro:'',target:'',core:'',refs:[],s51:[],s52:[],s53rows:[],s53in:[]};let sec='',tbl=0;
 const cells=l=>{const s=l.trim().replace(/^\|/,'').replace(/\|\s*$/,'');const o=[];let c='';for(let i=0;i<s.length;i++){if(s[i]==='\\'&&s[i+1]==='|'){c+='|';i++;continue}if(s[i]==='|'){o.push(c);c='';continue}c+=s[i]}o.push(c);return o.map(x=>x.replace(/<br\s*\/?>/gi,' / ').trim())};
 const clean=t=>t.replace(/\*\*/g,'').replace(/[^\p{L}\p{N}\s()·,./-]/gu,'').replace(/\s+/g,' ').trim();
 for(const l of L){
  if(/^#{2,3}\s/.test(l)){tbl=0;sec=/한 문장/.test(l)?'intro':/타깃|타겟/.test(l)?'target':/레퍼런스/.test(l)?'refs':/핵심/.test(l)?'core':/5-1/.test(l)?'s51':/5-2/.test(l)?'s52':/5-3/.test(l)?'s53':(/5️⃣|스테이지 1 만들어/.test(l)?'':sec);continue}
  let m;
  if((m=l.match(/^\*\*답:\*\*[ \t]*(.*)$/))&&['intro','target','core'].includes(sec)){S[sec]=m[1].trim();continue}
  if((m=l.match(/^\s*-\s*\[(x|X)\]\s*(.*)$/))&&sec==='s53'){S.s53in.push(clean(m[2]));continue}
  if(/^\|/.test(l)){tbl++;if(tbl<=2)continue;const c=cells(l);
   if(sec==='refs'&&c.some(Boolean))S.refs.push(c);
   if(sec==='s51')S.s51.push([clean(c[0]),c[1]||'']);
   if(sec==='s52'&&(c[1]||c[2]||/플레이어/.test(c[0])||clean(c[0])))S.s52.push([clean(c[0])||'(이름 없음)',c[1]||'',c[2]||'']);
   if(sec==='s53'&&!/^예\s*[:：]/.test(c[0])&&(c[0]||c[1]))S.s53rows.push(c);
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
 const filled=[S.intro,S.target,S.core].filter(x=>x&&!/^ㅇ+$/.test(x.trim())).length+S.refs.length+S.s52.filter(r=>r[1]||r[2]).length;
 return {text:out.join('\n'),empty:filled<2};
}

const REVIEW_PROMPT = `너는 고등학생의 첫 게임 기획을 도와주는 게임 기획 멘토야.
맨 아래 [내 게임 기획서]는 내가 2주차에 쓴 게임 기획서야. "(비어 있음)"은 아직 못 쓴 칸이야. 다음 주에 이 기획서를 바탕으로 AI와 함께 "스테이지 1"을 구성요소 하나씩 만들 거야.

[규칙]
- 게임 코드는 절대 만들지 마.
- 기획서를 대신 다시 써 주지 마. 내가 직접 고칠 수 있게 짚어 주고 질문해 줘.
- 내 게임 아이디어와 재미 요소는 바꾸지 마.
- 고등학생이 이해할 수 있는 쉬운 말로 써 줘.

[이렇게 알려줘]
1. 내가 이해한 게임: 이 게임을 한 문장으로 정리해 줘.
2. 칸별 점검표: 기획서의 칸(1~4번, 5-1 시작·플레이 중·클리어·실패, 5-2 등장하는 것들, 5-3 입력 방식)마다 아래 표로 알려 줘.
   | 칸 | 상태(✅ 충분 / 🔺 보완 필요 / ❌ 비어 있음) | 이유 | 내가 답해야 할 질문 |
3. 꼭 고쳐야 할 것 TOP 3: 스테이지 1을 만들기 전에 반드시 정해야 하는 것. 특히 아래를 확인해 줘.
   - 숫자가 없는 것 (체력, 속도, 개수, 시간 등)
   - 클리어·실패 조건이 확인할 수 없게 적힌 것 (예: "막는다" → "몇 마리를 막으면 성공?")
   - 서로 맞지 않는 것 (예: 입력 방식에는 있는데 등장하는 것에 없는 행동)
4. 더 추가해야 할 것: 5-1이나 5-3에는 나오는데 5-2 "등장하는 것들"에 빠진 것, 또는 스테이지 1에 꼭 필요한데 없는 것.
5. 스테이지 1에서 뒤로 미뤄도 되는 것: 처음부터 만들기엔 너무 큰 기능.
6. 화면 시점 추천: 탑다운 / 사이드뷰 / 세로 스크롤 / 고정 한 화면 / 쿼터뷰 / 3D 중에서 내 게임에 맞는 것과 이유.
7. 구성요소 만들기 순서: 화면 → 플레이어 → 조작 → … 처럼 스테이지 1을 하나씩 만들 순서를 7~10단계로 적어 줘.

마지막에 "가장 먼저 답해 줄 질문 3개"를 번호로 물어봐 줘.`;
const FOLLOW_PROMPT = `네 질문에 대한 내 답이야.
1. (칸 이름): (고른 예시 번호 또는 내 생각)
2. (칸 이름): (고른 예시 번호 또는 내 생각)
3. (칸 이름): (고른 예시 번호 또는 내 생각)

내 답이 기획서의 어느 칸에 들어가야 하는지 알려 주고, 아직 부족한 부분이 있으면 한 가지만 더 물어봐 줘. 기획서는 대신 써 주지 마.`;
async function copyText(s, btn){
  try{ await navigator.clipboard.writeText(s); }
  catch(_){ const t = document.createElement("textarea"); t.value = s; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); }
  const o = btn.textContent; btn.textContent = "✓ 복사했어요!"; setTimeout(() => btn.textContent = o, 1500);
}
async function latestPlan(){
  if(W.doc && W.doc.path === PLAN_PATH && W.segs.length) return toMd();      // 지금 고치는 중인 기획서(저장 전 내용 포함)
  if(getKey(W.st.repo)){
    const r = await gh(`${repoPath()}/contents/${encodeURI(PLAN_PATH)}?ref=main`);
    if(r.ok) return b64dec((await r.json()).content);
  }
  const r = await fetch(rawUrl(W.st, "main", PLAN_PATH) + "?t=" + Date.now());
  if(!r.ok) throw new Error(r.status); return r.text();
}

/* ---------- 📥 Gemini 정리 결과(Word·글)로 기획서 채우기 ----------
   정해진 [칸 이름] 형식의 줄을 읽어 게임 기획서 (보완) 칸에 채워요.
   바뀐 칸은 고치고, 새로운 레퍼런스·등장하는 것·입력은 줄을 추가해요. 지우지는 않아요. */
const FILL_PROMPT = `지금까지 우리가 나눈 대화를 바탕으로, 내 게임 기획서를 보완한 결과를 아래 형식 그대로 정리해서 Word 문서 파일로 만들어 줘. (파일을 만들 수 없으면 글로 보여 줘.)

[규칙]
- 내가 대화에서 직접 답한 내용만 반영해. 내가 말하지 않은 내용은 새로 지어내지 마.
- 바뀌지 않은 칸은 원래 기획서 내용을 그대로 써.
- 대괄호 [ ] 안의 칸 이름은 절대 바꾸지 말고, 한 줄에 한 칸씩 써. 표로 만들지 마.
- 레퍼런스, 등장하는 것, 입력은 하나마다 한 줄씩 쓰고, 칸은 | 로 나눠.
- 아직 정하지 못한 칸은 "(비어 있음)"이라고 써.

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
[5-3 입력] 입력 | 게임 속 동작`;

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
  const F = { intro:"", target:"", core:"", s51:{}, refs:[], s52:[], keys:[], inputs:[] }; let hit = 0;
  text.replace(/\r/g, "").split("\n").forEach(raw => {
    const l = raw.replace(/\*\*/g, "").replace(/^[\s>*•·\-–]+/, "").trim();
    const m = l.match(/^\[\s*([^\]]+?)\s*\]\s*[:：]?\s*(.*)$/); if(!m) return;
    const tag = m[1].replace(/\s/g, ""), val = m[2].replace(/\s*←.*$/, "").trim();
    const cells = () => { let c = val.split("|").map(x => x.trim()); if(c[0] === "") c.shift(); if(c[c.length-1] === "") c.pop(); return c; };
    hit++;
    if(/입력방식/.test(tag)) F.keys = val.split(/[,，/]/).map(x => x.trim()).filter(Boolean);
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
    else hit--;
  });
  return hit ? F : null;
}

function mergeFill(F){
  const log = []; let sec = "";
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
      if(h) sec = /한 문장/.test(h) ? "intro" : /타깃|타겟/.test(h) ? "target" : /레퍼런스/.test(h) ? "refs" : /핵심/.test(h) ? "core" : /5-1/.test(h) ? "s51" : /5-2/.test(h) ? "s52" : /5-3/.test(h) ? "s53" : sec;
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
    if(s.t === "chk" && sec === "s53"){
      const want = F.keys.some(k => (/키보드/.test(k) && /키보드/.test(s.text)) || (/마우스/.test(k) && /마우스/.test(s.text)));
      if(want && !s.on){ s.on = true; s.hl = "new"; log.push(`➕ 5-3 입력 방식: ${s.text.replace(/[^\p{L}\s]/gu, "").trim()}`); }
    }
  }
  return log;
}

let FILL_UNDO = null;
function runFill(text, msg, list){
  const F = parseFill(text);
  if(!F){ msg.textContent = "정해진 형식([1 한 문장 소개] 같은 줄)을 찾지 못했어요. 정리 프롬프트로 다시 받아 주세요."; msg.className = "wr-status err"; return; }
  if(!(W.doc && W.doc.path === PLAN_PATH && W.segs.length)){
    try{ sessionStorage.setItem("pendingFill:" + W.st.repo, text); }catch(_){}
    const i = W.w.docs.findIndex(d => d.path === PLAN_PATH);
    location.hash = `#/write/${W.w.week}/${W.st.repo}/${i < 0 ? 0 : i}`; return;
  }
  W.segs.forEach(s => { delete s.hl; if(s.rows) s.rows.forEach(r => r.forEach(c => delete c.hl)); });
  FILL_UNDO = JSON.stringify(W.segs);
  const log = mergeFill(F);
  renderSegs(document.getElementById("wrDoc"));
  if(!log.length){ msg.textContent = "새로 바뀐 칸이 없어요. 이미 기획서와 같은 내용이에요."; msg.className = "wr-status"; list.innerHTML = ""; return; }
  markDirty();
  msg.textContent = `✅ ${log.length}곳을 채웠어요. 노란 칸은 바뀐 곳, 초록 칸은 새로 들어간 곳이에요. 내 말로 다듬은 뒤 💾 저장하기를 눌러요.`; msg.className = "wr-status ok";
  list.innerHTML = `<ul>${log.map(x => `<li>${esc(x)}</li>`).join("")}</ul><button class="btn" type="button" data-undo>↩️ 채우기 전으로 되돌리기</button>`;
  list.querySelector("[data-undo]").onclick = () => { W.segs = JSON.parse(FILL_UNDO); renderSegs(document.getElementById("wrDoc")); list.innerHTML = ""; msg.textContent = "되돌렸어요."; msg.className = "wr-status"; };
}
function applyPending(){
  let t = null; try{ t = sessionStorage.getItem("pendingFill:" + W.st.repo); sessionStorage.removeItem("pendingFill:" + W.st.repo); }catch(_){}
  const box = document.getElementById("wrAi"); if(!t || !box) return;
  box.open = true; runFill(t, box.querySelector("[data-fmsg]"), box.querySelector("[data-flist]"));
  box.querySelector("[data-fill-area]").scrollIntoView({ behavior:"smooth", block:"start" });
}

const BOOST_PROMPT = `점검해 줘서 고마워. 이제 🔺 보완 필요와 ❌ 비어 있음 칸을 채우고 싶어.
가장 중요한 칸부터 최대 5칸까지, 칸마다 아래처럼 알려 줘.

[칸 이름]
- 정해야 할 것: 이 칸에서 무엇을 정해야 하는지 한 줄로
- 예시 3가지: 내 게임 아이디어에 맞게, 서로 다른 방향으로 (숫자가 필요하면 숫자도 넣어서)
  ① …  ② …  ③ …
- 고르면 달라지는 점: 각 예시를 고르면 게임이 어떻게 달라지는지 한 줄씩

[규칙]
- 내 게임 아이디어와 재미 요소는 바꾸지 마.
- 정답처럼 하나만 골라 주지 마. 내가 고르거나 내 생각을 말할 수 있게 해 줘.
- 스테이지 1에 필요한 것만 다뤄 줘. 게임 코드는 만들지 마.

마지막에 "각 칸에서 어떤 걸 고를래? 아니면 네 생각을 말해 줘"라고 물어봐 줘.`;
function reviewBox(){
  return `<details class="wr-ai" id="wrAi"><summary>🤖 Gemini와 기획서 보완하기 <span>점검 → 보완 요청 → 답하기 → 기획서에 채우기</span></summary>
    <div class="wr-ai-step"><div class="wr-ai-h"><i>1</i>점검받기 <span>고쳐야 할 칸과 더 적어야 할 내용을 알려 줘요</span></div>
      <p class="hint">버튼을 누르면 내 기획서가 정리되어 프롬프트 끝에 붙어요. <a href="https://gemini.google.com/" target="_blank" rel="noopener">Gemini ↗</a> 새 채팅에 붙여 넣고 보내요.</p>
      <div class="btns"><button class="btn primary" type="button" data-make>🧩 내 기획서로 점검 프롬프트 만들기</button><button class="btn" type="button" data-copy disabled>📋 복사</button></div>
      <p class="wr-status" data-msg></p>
      <pre class="wr-ai-out" data-out hidden></pre>
    </div>
    <div class="wr-ai-step"><div class="wr-ai-h"><i>2</i>보완할 내용 요청하기 <span>부족한 칸마다 고를 수 있는 예시 3가지를 받아요</span></div>
      <p class="hint">점검 결과를 받은 <b>같은 채팅</b>에 보내요.</p>
      <details class="wr-ai-peek"><summary>프롬프트 보기</summary><pre class="wr-ai-out">${esc(BOOST_PROMPT)}</pre></details>
      <div class="btns"><button class="btn" type="button" data-boost>📋 보완 요청 프롬프트 복사</button></div>
    </div>
    <div class="wr-ai-step"><div class="wr-ai-h"><i>3</i>내 답 보내기 <span>예시 중에 고르거나 내 생각을 적어요</span></div>
      <details class="wr-ai-peek"><summary>프롬프트 보기</summary><pre class="wr-ai-out">${esc(FOLLOW_PROMPT)}</pre></details>
      <div class="btns"><button class="btn" type="button" data-follow>📋 답하기 문장 복사</button></div>
      <p class="hint">( ) 부분을 내 답으로 바꿔서 보내요. 부족한 칸이 남아 있으면 2~3단계를 반복해요. 받은 피드백은 <b>3주차 개발일지 1️⃣</b>에 적어요.</p>
    </div>
    <div class="wr-ai-step" data-fill-area><div class="wr-ai-h"><i>4</i>정리해서 기획서에 채우기 <span>바뀐 칸은 고치고, 새로 생긴 것은 줄을 추가해요</span></div>
      <p class="hint">정리 프롬프트를 같은 채팅에 보내 Word 파일을 받고, 아래에 올리거나 답을 붙여 넣어요. <b>게임 기획서 (보완)</b> 탭에 바뀐 칸(노랑)과 새 칸(초록)이 표시되면 확인하고 다듬은 뒤 💾 저장해요.</p>
      <div class="btns"><button class="btn" type="button" data-fillp>📋 정리 프롬프트 복사</button></div>
      <div class="wr-ai-drop"><label class="btn"><input type="file" accept=".docx,.txt,.md" data-file hidden>📄 Word 파일 올리기 (.docx)</label><span data-fname class="hint" style="margin:0">또는 아래에 붙여 넣기</span></div>
      <textarea class="wr-in wr-ai-paste" rows="4" data-paste placeholder="[1 한 문장 소개] ... 처럼 시작하는 Gemini 답을 붙여 넣어요"></textarea>
      <div class="btns"><button class="btn primary" type="button" data-fill>✍️ 기획서에 채우기</button></div>
      <p class="wr-status" data-fmsg></p>
      <div class="wr-ai-log" data-flist></div>
    </div>
    <p class="hint">💡 Gemini가 써 준 문장을 그대로 붙이지 말고, 내 생각을 내 말로 고쳐 적어요. 제안이 내 게임과 다르면 따르지 않아도 돼요.</p>
  </details>`;
}
function mountReview(){
  const box = document.getElementById("wrAi"); if(!box) return;
  const msg = box.querySelector("[data-msg]"), out = box.querySelector("[data-out]"), cp = box.querySelector("[data-copy]");
  let prompt = "";
  box.querySelector("[data-make]").onclick = async () => {
    msg.textContent = "기획서를 불러오는 중…"; msg.className = "wr-status";
    try{
      const sm = summarizePlan(await latestPlan());
      prompt = REVIEW_PROMPT + "\n\n" + sm.text;
      out.textContent = prompt; out.hidden = false; cp.disabled = false;
      msg.textContent = sm.empty ? "⚠️ 기획서가 거의 비어 있어요. 게임 기획서 (보완) 탭에서 1~5번을 먼저 채우면 더 좋은 피드백을 받을 수 있어요." : "✅ 만들었어요. 복사해서 Gemini에 붙여 넣으세요.";
      msg.className = "wr-status " + (sm.empty ? "warn" : "ok");
    }catch(e){ msg.textContent = "기획서를 불러오지 못했어요. 잠시 뒤 다시 눌러 주세요."; msg.className = "wr-status err"; }
  };
  cp.onclick = () => copyText(prompt, cp);
  box.querySelector("[data-follow]").onclick = e => copyText(FOLLOW_PROMPT, e.currentTarget);
  box.querySelector("[data-boost]").onclick = e => copyText(BOOST_PROMPT, e.currentTarget);
  box.querySelector("[data-fillp]").onclick = e => copyText(FILL_PROMPT, e.currentTarget);
  const fmsg = box.querySelector("[data-fmsg]"), flist = box.querySelector("[data-flist]"), paste = box.querySelector("[data-paste]");
  box.querySelector("[data-file]").onchange = async e => {
    const f = e.target.files[0]; if(!f) return; e.target.value = "";
    box.querySelector("[data-fname]").textContent = "📄 " + f.name;
    try{ paste.value = /\.docx$/i.test(f.name) ? await docxText(await f.arrayBuffer()) : await f.text(); grow(paste);
      runFill(paste.value, fmsg, flist); }
    catch(_){ fmsg.textContent = "파일을 읽지 못했어요. Word(.docx) 파일인지 확인하거나, 내용을 복사해서 붙여 넣어 주세요."; fmsg.className = "wr-status err"; }
  };
  box.querySelector("[data-fill]").onclick = () => runFill(paste.value, fmsg, flist);
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
    <div class="paper wr"><div id="wrDoc"></div></div>
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
  drawKey(); load(); mountReview();
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

window.Writer = { view, mount, keyDialog, hasKey: repo => !!getKey(repo), isDirty: () => W.dirty, reset: () => { W.dirty = false; }, _parse: parseMd, _toMd: segs => { W.segs = segs; return toMd(); } };
})();
